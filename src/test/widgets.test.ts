import { describe, it, expect } from 'vitest';
import { makeWorld, createTreinar, PERIOD } from './helpers';
import { WidgetSyncService, iconKey } from '../application/services/WidgetSyncService';

const TODAY = '2026-08-19'; // quarta-feira

function setup(date = TODAY) {
  const w = makeWorld(date);
  const svc = new WidgetSyncService(w.occ, w.goalRepo, async () => [], () => w.clock.today);
  return { w, svc };
}

describe('widgets: retrato (snapshot) que o app entrega ao Android', () => {
  it('traz hoje e os próximos 7 dias com as mesmas regras da Home (status, hierarquia e progresso do dia)', async () => {
    const { w, svc } = setup();
    const t = await createTreinar(w);
    const snap = await svc.buildSnapshot();
    expect(Object.keys(snap.days)).toHaveLength(7);
    expect(snap.today).toBe(TODAY);

    const today = snap.days[TODAY];
    // quarta: Futebol (seg/qua), Corrida (ter-sex) e Musculação (qua-sex) vencem; "Treinar" só agrupa
    const names = today.items.map((i) => `${i.d}:${i.k}:${i.n}`);
    expect(names).toEqual(['0:g:Treinar', '1:o:Futebol', '1:o:Corrida', '1:o:Musculação']);
    expect(today.items.every((i) => i.s === 'pending')).toBe(true);
    expect(today.total).toBe(3);
    expect(today.completed).toBe(0);

    // outro dia tem outra lista (terça: só Corrida) — dia seguinte não herda o status de hoje
    const thursday = snap.days['2026-08-20'];
    expect(thursday.items.filter((i) => i.k === 'o').map((i) => i.n).sort()).toEqual(['Corrida', 'Musculação']);
    expect(t.parent.id).toBeTruthy();
  });

  it('marcações refletem no retrato e o progresso do dia acompanha (concluído = 1, parcial = peso do app)', async () => {
    const { w, svc } = setup();
    await createTreinar(w);
    const [fut, cor] = (await w.occ.getOrGenerateOccurrencesForDate(TODAY)).filter((o) => o.slotKey === 'default');
    await w.occ.updateStatus(fut.id, 'completed');
    await w.occ.updateStatus(cor.id, 'partial');
    const snap = await svc.buildSnapshot();
    const day = snap.days[TODAY];
    expect(day.completed).toBe(1);
    expect(day.progress).toBeGreaterThan(1 / 3);
    expect(day.progress).toBeLessThan(2 / 3 + 0.001);
    expect(day.items.filter((i) => i.k === 'o').map((i) => i.s).sort()).toEqual(['completed', 'partial', 'pending']);
    expect(day.items.find((i) => i.k === 'o')!.pw).toBeGreaterThan(0);
  });

  it('lista as metas para o widget individual (sem arquivadas) e guarda cor/ícone para as imagens', async () => {
    const { w, svc } = setup();
    const a = (await w.goals.createGoal({ name: 'Tratamento capilar', icon: 'ph:pill', colorToken: '#5B9BE0', schedule: { type: 'daily' }, activePeriod: PERIOD })).definition;
    const b = (await w.goals.createGoal({ name: 'Velha', schedule: { type: 'daily' }, activePeriod: PERIOD })).definition;
    await w.goals.archiveGoal(b.id);
    const snap = await svc.buildSnapshot();
    expect(snap.goals.map((g) => g.n)).toEqual(['Tratamento capilar']);
    expect(snap.goals[0]).toMatchObject({ id: a.id, c: '#5B9BE0', ic: iconKey('ph:pill', '#5B9BE0') });
    const icons = await svc.iconsNeeded();
    expect(icons.get(iconKey('ph:pill', '#5B9BE0'))).toEqual({ icon: 'ph:pill', color: '#5B9BE0' });
  });

  it('metas por quantidade levam alvo/unidade/valor e metas "só obrigatórias" respeitam a regra do progresso', async () => {
    const { w, svc } = setup();
    await w.goals.createGoal({ name: 'Água', schedule: { type: 'daily' }, activePeriod: PERIOD, progressRule: { type: 'quantity', target: 3, unit: 'L' }, isRequired: true });
    await w.goals.createGoal({ name: 'Extra', schedule: { type: 'daily' }, activePeriod: PERIOD, isRequired: false });
    const snap = await svc.buildSnapshot();
    const items = snap.days[TODAY].items;
    const agua = items.find((i) => i.n === 'Água')!;
    expect(agua.q).toEqual({ t: 3, u: 'L', v: null });
    expect(agua.w).toBe(1);
    expect(items.find((i) => i.n === 'Extra')!.w).toBe(0); // existe uma obrigatória: a opcional não conta
  });

  it('carrega os ids dos lembretes de cada ocorrência (o widget cancela ao marcar)', async () => {
    const w = makeWorld(TODAY);
    const g = (await w.goals.createGoal({ name: 'Remédio', schedule: { type: 'daily' }, activePeriod: PERIOD })).definition;
    const svc = new WidgetSyncService(w.occ, w.goalRepo, async () => [{ id: 111, fireAt: 1, title: 'x', body: '', goalId: g.id, occurrenceKey: 'k', date: TODAY, offsetMin: 0 }], () => TODAY);
    const snap = await svc.buildSnapshot();
    expect(snap.days[TODAY].items[0].r).toEqual([111]);
    expect(snap.days['2026-08-20'].items[0].r).toEqual([]);
  });
});

describe('widgets: marcações feitas com o app fechado são aplicadas pelas regras do app', () => {
  it('concluir pelo widget vira ocorrência concluída, com histórico de status e progresso atualizado', async () => {
    const { w, svc } = setup();
    const g = (await w.goals.createGoal({ name: 'Tratamento capilar', schedule: { type: 'daily' }, activePeriod: PERIOD })).definition;
    const n = await svc.applyActions([{ goalId: g.id, date: TODAY, status: 'completed', ts: 1 }]);
    expect(n).toBe(1);
    const tree = await w.occ.getTodayGoalTree(TODAY);
    expect(tree.nodes[0].occurrence?.status).toBe('completed');
    expect(tree.overallProgress).toBe(1);
  });

  it('corrigir a marcação funciona (concluído → pendente → parcial → não realizado) na ordem em que ocorreram', async () => {
    const { w, svc } = setup();
    const g = (await w.goals.createGoal({ name: 'X', schedule: { type: 'daily' }, activePeriod: PERIOD })).definition;
    await svc.applyActions([
      { goalId: g.id, date: TODAY, status: 'not_done', ts: 4 },
      { goalId: g.id, date: TODAY, status: 'completed', ts: 1 },
      { goalId: g.id, date: TODAY, status: 'pending', ts: 2 },
      { goalId: g.id, date: TODAY, status: 'partial', ts: 3 },
    ]);
    expect((await w.occ.getTodayGoalTree(TODAY)).nodes[0].occurrence?.status).toBe('not_done'); // a última (ts 4) vence
  });

  it('marcar um dia futuro e um dia passado (o dia mudou antes de o app abrir) vale para a data certa, sem contaminar hoje', async () => {
    const { w, svc } = setup('2026-08-21');
    const g = (await w.goals.createGoal({ name: 'Diária', schedule: { type: 'daily' }, activePeriod: { startDate: '2026-08-10', endDate: null } })).definition;
    await svc.applyActions([{ goalId: g.id, date: '2026-08-20', status: 'completed' }]);
    expect((await w.occ.getTodayGoalTree('2026-08-20')).nodes[0].occurrence?.status).toBe('completed');
    expect((await w.occ.getTodayGoalTree('2026-08-21')).nodes[0].occurrence?.status).toBe('pending');
  });

  it('ignora meta arquivada/excluída, data inválida e status inválido, sem travar as demais ações', async () => {
    const { w, svc } = setup();
    const a = (await w.goals.createGoal({ name: 'A', schedule: { type: 'daily' }, activePeriod: PERIOD })).definition;
    const b = (await w.goals.createGoal({ name: 'B', schedule: { type: 'daily' }, activePeriod: PERIOD })).definition;
    await w.goals.archiveGoal(a.id);
    const n = await svc.applyActions([
      { goalId: a.id, date: TODAY, status: 'completed' },
      { goalId: 'nao-existe', date: TODAY, status: 'completed' },
      { goalId: b.id, date: 'ontem', status: 'completed' },
      { goalId: b.id, date: TODAY, status: 'voando' as never },
      { goalId: b.id, date: TODAY, status: 'completed' },
    ]);
    expect(n).toBe(1);
    const tree = await w.occ.getTodayGoalTree(TODAY);
    expect(tree.nodes.map((x) => x.occurrence?.status)).toEqual(['completed']);
  });

  it('repetir a mesma ação não duplica histórico (idempotente)', async () => {
    const { w, svc } = setup();
    const g = (await w.goals.createGoal({ name: 'X', schedule: { type: 'daily' }, activePeriod: PERIOD })).definition;
    expect(await svc.applyActions([{ goalId: g.id, date: TODAY, status: 'completed' }])).toBe(1);
    expect(await svc.applyActions([{ goalId: g.id, date: TODAY, status: 'completed' }])).toBe(0);
  });

  it('submeta marcada pelo widget atualiza o progresso agregado da meta mãe', async () => {
    const { w, svc } = setup();
    const t = await createTreinar(w);
    const before = (await w.occ.getTodayGoalTree(TODAY)).nodes[0].cycleInstance!.computedProgress;
    await svc.applyActions([{ goalId: t.futebol.id, date: TODAY, status: 'completed' }]);
    const after = (await w.occ.getTodayGoalTree(TODAY)).nodes[0].cycleInstance!.computedProgress;
    expect(after).toBeGreaterThan(before);
    const snap = await svc.buildSnapshot();
    expect(snap.days[TODAY].items[0].p).toBeCloseTo(after, 5);
  });
});

describe('widgets: hierarquia, quantidade e comentários', () => {
  const mk = (date = TODAY) => {
    const w = makeWorld(date);
    const svc = new WidgetSyncService(w.occ, w.goalRepo, async () => [], () => w.clock.today, w.journal);
    return { w, svc };
  };

  it('o retrato traz a meta mãe de cada item e a lista de metas em ordem de árvore com profundidade', async () => {
    const { w, svc } = mk();
    const t = await createTreinar(w);
    const snap = await svc.buildSnapshot();
    expect(snap.goals.map((g) => `${g.dp}:${g.n}`)).toEqual(['0:Treinar', '1:Futebol', '1:Corrida', '1:Musculação']);
    expect(snap.goals.find((g) => g.n === 'Futebol')).toMatchObject({ pid: t.parent.id, pn: 'Treinar' });
    expect(snap.goals[0].pid).toBeNull();
    const items = snap.days[TODAY].items;
    expect(items.find((i) => i.n === 'Treinar')!.pid).toBeNull();
    expect(items.filter((i) => i.pid === t.parent.id).map((i) => i.n)).toEqual(['Futebol', 'Corrida', 'Musculação']);
  });

  it('hierarquia profunda (3 níveis) preserva pai e ordem', async () => {
    const { w, svc } = mk();
    const root = (await w.goals.createGoal({ name: 'Semana top', schedule: { type: 'custom', expression: 'container' }, activePeriod: PERIOD })).definition;
    const agua = (await w.goals.addSubGoal(root.id, { name: 'Água', schedule: { type: 'custom', expression: 'container' }, activePeriod: PERIOD })).definition;
    for (const n of ['1ª Garrafa', '2ª Garrafa', '3ª Garrafa']) await w.goals.addSubGoal(agua.id, { name: n, schedule: { type: 'daily' }, activePeriod: PERIOD });
    const snap = await svc.buildSnapshot();
    expect(snap.goals.map((g) => `${g.dp}:${g.n}`)).toEqual(['0:Semana top', '1:Água', '2:1ª Garrafa', '2:2ª Garrafa', '2:3ª Garrafa']);
    const g1 = snap.days[TODAY].items.find((i) => i.n === '1ª Garrafa')!;
    expect(g1.pid).toBe(agua.id);
    expect(snap.days[TODAY].items.find((i) => i.n === 'Água')!.k).toBe('g');
  });

  it('marcar um grupo (meta que só agrupa) pelo widget não altera nenhuma submeta', async () => {
    const { w, svc } = mk();
    const t = await createTreinar(w);
    expect(await svc.applyActions([{ goalId: t.parent.id, date: TODAY, status: 'completed' }])).toBe(0);
    const tree = await w.occ.getTodayGoalTree(TODAY);
    expect(tree.nodes[0].children.every((c) => c.occurrence?.status === 'pending')).toBe(true);
  });

  it('quantidade registrada pelo widget segue a regra do app (alvo = concluído, parte = parcial, zero = pendente)', async () => {
    const { w, svc } = mk();
    const g = (await w.goals.createGoal({ name: 'Água', schedule: { type: 'daily' }, activePeriod: PERIOD, progressRule: { type: 'quantity', target: 3, unit: 'L' } })).definition;
    const st = async () => (await w.occ.getTodayGoalTree(TODAY)).nodes[0].occurrence!;
    expect(await svc.applyActions([{ goalId: g.id, date: TODAY, qty: 1.5, ts: 1 }])).toBe(1);
    expect(await st()).toMatchObject({ status: 'partial', quantityValue: 1.5 });
    await svc.applyActions([{ goalId: g.id, date: TODAY, qty: 3, ts: 2 }]);
    expect((await st()).status).toBe('completed');
    await svc.applyActions([{ goalId: g.id, date: TODAY, qty: 0, ts: 3 }]);
    expect((await st()).status).toBe('pending');
    expect(await svc.applyActions([{ goalId: g.id, date: TODAY, qty: -2, ts: 4 }])).toBe(0);
  });

  it('comentário feito no widget vira registro na linha do tempo da ocorrência, uma única vez mesmo se a fila for reentregue', async () => {
    const { w, svc } = mk();
    const g = (await w.goals.createGoal({ name: 'Remédio', schedule: { type: 'daily' }, activePeriod: PERIOD })).definition;
    const a = { goalId: g.id, date: TODAY, comment: '  tomei com água  ', id: 'c1', ts: 1 };
    expect(await svc.applyActions([a])).toBe(1);
    expect(await svc.applyActions([a])).toBe(0);
    const occ = (await w.occ.getTodayGoalTree(TODAY)).nodes[0].occurrence!;
    const tl = await w.journal.getTimelineForOccurrence(occ.id);
    expect(tl.map((r) => r.comment)).toEqual(['tomei com água']);
    expect(await svc.applyActions([{ goalId: g.id, date: TODAY, comment: '   ', id: 'c2' }])).toBe(0); // vazio não grava
  });
});
