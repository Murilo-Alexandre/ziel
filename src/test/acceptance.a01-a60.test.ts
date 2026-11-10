import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeWorld, createTreinar, names, flatten, completeOn, PERIOD, WEEKLY, WEEK } from './helpers';
import { validateNoHierarchyCycle, buildTodayGoalTree } from '../domain/goals/goalTree';
import { getCycleWindow } from '../domain/recurrence/cycleEvaluator';
import {
  getExpectedDates,
  scheduleMatchesDate,
  isQuotaAvailableOn,
} from '../domain/recurrence/scheduleEvaluator';
import {
  aggregateScheduledOccurrencesProgress,
  calculateQuantityProgress,
  getStatusNumericWeight,
} from '../domain/progress/progressAggregator';
import { GoalValidationError } from '../domain/goals/goalValidation';
import { MediaAccessError } from '../infrastructure/ports/CameraPort';
import { Occurrence } from '../domain/types';

/**
 * Cobertura A01–A60 em nível de DOMÍNIO/SERVIÇOS (repositórios em memória, relógio injetado).
 * Itens A43–A45 (interação de toque) e a durabilidade real em disco (A49, A52–A56) são cobertos
 * por testes complementares/validação no navegador — ver docs/AUDITORIA-HOMOLOGACAO.md.
 */

describe('1. Hierarquia (A01–A05)', () => {
  it('A01 — meta raiz: sem pai, persistida e exibida na Home no dia agendado', async () => {
    const w = makeWorld();
    const { definition } = await w.goals.createGoal({ name: 'Raiz', activePeriod: PERIOD });
    expect(definition.parentId).toBeNull();
    expect((await w.goalRepo.getDefinition(definition.id))?.parentId).toBeNull();
    const { nodes } = await w.occ.getTodayGoalTree('2026-08-19');
    expect(names(nodes)).toEqual(['Raiz']);
    expect(nodes[0].depth).toBe(0);
  });

  it('A02 — meta filha mantém id próprio e vínculo com o pai', async () => {
    const w = makeWorld();
    const { definition: p } = await w.goals.createGoal({ name: 'Pai', activePeriod: PERIOD });
    const { definition: c } = await w.goals.addSubGoal(p.id, { name: 'Filho', activePeriod: PERIOD });
    expect(c.id).not.toBe(p.id);
    expect(c.parentId).toBe(p.id);
    const { nodes } = await w.occ.getTodayGoalTree('2026-08-19');
    expect(nodes[0].children[0].goal.id).toBe(c.id);
    expect(nodes[0].children[0].depth).toBe(1);
  });

  it('A03 — 8 níveis aninhados: sem profundidade máxima, árvore e progresso íntegros', async () => {
    const w = makeWorld();
    let parentId: string | null = null;
    const ids: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const { definition } = await w.goals.createGoal({ name: `L${i}`, parentId, activePeriod: PERIOD });
      ids.push(definition.id);
      parentId = definition.id;
    }
    const { nodes } = await w.occ.getTodayGoalTree('2026-08-19');
    const chain = flatten(nodes);
    expect(chain.map((n) => n.depth)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(chain.map((n) => n.goal.id)).toEqual(ids);
  });

  it('A04 — recusa mover um pai para dentro de um descendente (serviço e função pura)', async () => {
    const w = makeWorld();
    const { definition: a } = await w.goals.createGoal({ name: 'A', activePeriod: PERIOD });
    const { definition: b } = await w.goals.addSubGoal(a.id, { name: 'B', activePeriod: PERIOD });
    const { definition: c } = await w.goals.addSubGoal(b.id, { name: 'C', activePeriod: PERIOD });
    const all = await w.goalRepo.listAllDefinitions();
    expect(validateNoHierarchyCycle(a.id, c.id, all)).toBe(false);
    expect(validateNoHierarchyCycle(a.id, a.id, all)).toBe(false);
    await expect(w.goals.moveGoal(a.id, c.id)).rejects.toBeInstanceOf(GoalValidationError);
    expect((await w.goalRepo.getDefinition(a.id))?.parentId).toBeNull(); // nada mudou
    await expect(w.goals.moveGoal(c.id, a.id)).resolves.toMatchObject({ parentId: a.id }); // movimento legítimo
  });

  it('A05 — reordenar irmãos persiste e define a ordem da Home', async () => {
    const w = makeWorld();
    const g1 = (await w.goals.createGoal({ name: 'A', activePeriod: PERIOD })).definition;
    const g2 = (await w.goals.createGoal({ name: 'B', activePeriod: PERIOD })).definition;
    const g3 = (await w.goals.createGoal({ name: 'C', activePeriod: PERIOD })).definition;
    expect(names((await w.occ.getTodayGoalTree('2026-08-19')).nodes)).toEqual(['A', 'B', 'C']);
    await w.goals.reorderSiblings([g3.id, g1.id, g2.id]);
    expect(names((await w.occ.getTodayGoalTree('2026-08-19')).nodes)).toEqual(['C', 'A', 'B']);
    expect((await w.goalRepo.getDefinition(g3.id))?.sortOrder).toBe(1);
  });
});

describe('2. Recorrência e ciclos (A06–A17)', () => {
  it('A06 — meta única aparece só no dia agendado (função e Home)', async () => {
    const w = makeWorld();
    await w.goals.createGoal({ name: 'Única', schedule: { type: 'once', date: '2026-08-19' }, activePeriod: PERIOD });
    expect(names((await w.occ.getTodayGoalTree('2026-08-19')).nodes)).toEqual(['Única']);
    expect((await w.occ.getTodayGoalTree('2026-08-20')).nodes).toEqual([]);
    expect((await w.occ.getTodayGoalTree('2026-08-18')).nodes).toEqual([]);
  });

  it('A07 — diária: exatamente uma ocorrência lógica por dia ativo', async () => {
    const w = makeWorld();
    await w.goals.createGoal({ name: 'Diária', schedule: { type: 'daily' }, activePeriod: PERIOD });
    for (const d of WEEK) await w.occ.getOrGenerateOccurrencesForDate(d);
    for (const d of WEEK) expect(await w.occRepo.findByDate(d)).toHaveLength(1);
  });

  it('A08 — dias da semana: Seg/Qua apenas', async () => {
    const w = makeWorld();
    await w.goals.createGoal({ name: 'SegQua', schedule: { type: 'weekdays', weekdays: [1, 3] }, activePeriod: PERIOD });
    const shown = [];
    for (const d of WEEK) if ((await w.occ.getTodayGoalTree(d)).nodes.length) shown.push(d);
    expect(shown).toEqual(['2026-08-17', '2026-08-19']);
  });

  it('A09 — abrir a mesma data 10 vezes (inclusive em paralelo) mantém 1 ocorrência e preserva status', async () => {
    const w = makeWorld();
    await w.goals.createGoal({ name: 'Diário', schedule: { type: 'daily' }, activePeriod: PERIOD });
    const first = (await w.occ.getOrGenerateOccurrencesForDate('2026-08-19'))[0];
    await w.occ.updateStatus(first.id, 'completed');
    for (let i = 0; i < 5; i++) await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    await Promise.all(Array.from({ length: 5 }, () => w.occ.getTodayGoalTree('2026-08-19')));
    const occs = await w.occRepo.findByDate('2026-08-19');
    expect(occs).toHaveLength(1);
    expect(occs[0].id).toBe(first.id);
    expect(occs[0].status).toBe('completed');
  });

  it('A10 — ciclo semanal (início segunda) de qua 19/08/2026 = 17–23/08; início domingo = 16–22/08', async () => {
    const win = getCycleWindow('2026-08-19', WEEKLY, 'g', 'r');
    expect([win.startAt, win.endAt]).toEqual(['2026-08-17', '2026-08-23']);
    const sun = getCycleWindow('2026-08-19', { type: 'weekly', weekStartsOn: 0 }, 'g', 'r');
    expect([sun.startAt, sun.endAt]).toEqual(['2026-08-16', '2026-08-22']);
    // domingo pertence à semana que começou na segunda anterior
    expect(getCycleWindow('2026-08-23', WEEKLY, 'g', 'r').startAt).toBe('2026-08-17');
    const w = makeWorld();
    const t = await createTreinar(w);
    const tree = await w.occ.getTodayGoalTree('2026-08-19');
    const ci = tree.nodes.find((n) => n.goal.id === t.parent.id)!.cycleInstance!;
    expect([ci.startAt, ci.endAt]).toEqual(['2026-08-17', '2026-08-23']);
  });

  it('A11 — filho com agenda independente (sábado) aparece mesmo com pai Seg–Sex', async () => {
    const w = makeWorld();
    const { definition: parent } = await w.goals.createGoal({
      name: 'Preparar apresentação',
      schedule: { type: 'weekdays', weekdays: [1, 2, 3, 4, 5] },
      activePeriod: PERIOD,
    });
    const { definition: child } = await w.goals.addSubGoal(parent.id, {
      name: 'Revisão final',
      schedule: { type: 'weekdays', weekdays: [6] },
      activePeriod: PERIOD,
    });
    const sat = await w.occ.getTodayGoalTree('2026-08-22');
    expect(sat.nodes).toHaveLength(1);
    expect(sat.nodes[0].occurrence).toBeNull(); // o pai não é devido no sábado
    expect(sat.nodes[0].children.map((c) => c.goal.id)).toEqual([child.id]);
  });

  it('A12 — pai mensal com filho semanal: cada ciclo é calculado de forma independente', async () => {
    const w = makeWorld('2026-08-19');
    const { definition: parent } = await w.goals.createGoal({
      name: 'Mensal',
      trackingCycle: { type: 'monthly' },
      schedule: { type: 'custom', expression: 'container' },
      activePeriod: PERIOD,
    });
    await w.goals.addSubGoal(parent.id, {
      name: 'Semanal',
      trackingCycle: WEEKLY,
      schedule: { type: 'weekdays', weekdays: [1] },
      activePeriod: PERIOD,
    });
    const tree = await w.occ.getTodayGoalTree('2026-08-17'); // segunda
    const p = tree.nodes[0];
    expect([p.cycleInstance?.startAt, p.cycleInstance?.endAt]).toEqual(['2026-08-01', '2026-08-31']);
    // segundas de agosto/2026 a partir do início do período: 3,10,17,24,31 → 5 execuções esperadas no mês
    expect(p.cycleInstance?.expectedCount).toBe(5);
    const c = p.children[0];
    expect([c.cycleInstance?.startAt, c.cycleInstance?.endAt]).toEqual(['2026-08-17', '2026-08-23']);
    expect(c.cycleInstance?.expectedCount).toBe(1);
    await w.occ.updateStatus(c.occurrence!.id, 'completed');
    const after = (await w.occ.getTodayGoalTree('2026-08-17')).nodes[0];
    expect(after.cycleInstance?.completedCount).toBe(1);
    expect(after.cycleInstance?.computedProgress).toBeCloseTo(1 / 5, 5);
    expect(after.children[0].cycleInstance?.computedStatus).toBe('completed');
  });

  it('A13 — período ativo começando em 20/08 não aparece em 19/08', async () => {
    const w = makeWorld();
    await w.goals.createGoal({ name: 'Futura', schedule: { type: 'daily' }, activePeriod: { startDate: '2026-08-20', endDate: null } });
    expect((await w.occ.getTodayGoalTree('2026-08-19')).nodes).toEqual([]);
    expect(names((await w.occ.getTodayGoalTree('2026-08-20')).nodes)).toEqual(['Futura']);
  });

  it('A14 — período terminando em 20/08 não gera ocorrências depois; o passado permanece', async () => {
    const w = makeWorld();
    await w.goals.createGoal({ name: 'Curta', schedule: { type: 'daily' }, activePeriod: { startDate: '2026-08-01', endDate: '2026-08-20' } });
    expect(names((await w.occ.getTodayGoalTree('2026-08-20')).nodes)).toEqual(['Curta']);
    expect((await w.occ.getTodayGoalTree('2026-08-21')).nodes).toEqual([]);
    expect(await w.occRepo.findByDate('2026-08-21')).toEqual([]);
    expect(await w.occRepo.findByDate('2026-08-20')).toHaveLength(1);
  });

  it('A15 — intervalo de 2 dias ancorado em 01/08 mantém a cadência após "reiniciar" os serviços', async () => {
    const w = makeWorld();
    const interval = { type: 'interval' as const, every: 2, unit: 'day' as const, anchorDate: '2026-08-01' };
    await w.goals.createGoal({ name: 'A cada 2 dias', schedule: interval, activePeriod: PERIOD });
    const days = async (svc: typeof w.occ) => {
      const out: string[] = [];
      for (const d of ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05']) {
        if ((await svc.getTodayGoalTree(d)).nodes.length) out.push(d);
      }
      return out;
    };
    expect(await days(w.occ)).toEqual(['2026-08-01', '2026-08-03', '2026-08-05']);
    // "reinício": novos serviços sobre os mesmos repositórios
    const { OccurrenceService } = await import('../application/services/OccurrenceService');
    const restarted = new OccurrenceService(w.goalRepo, w.occRepo, w.journalRepo, () => w.clock.today);
    expect(await days(restarted)).toEqual(['2026-08-01', '2026-08-03', '2026-08-05']);
    // semanal e mensal também ancorados
    expect(scheduleMatchesDate('2026-08-15', { type: 'interval', every: 2, unit: 'week', anchorDate: '2026-08-01' }, PERIOD)).toBe(true);
    expect(scheduleMatchesDate('2026-08-08', { type: 'interval', every: 2, unit: 'week', anchorDate: '2026-08-01' }, PERIOD)).toBe(false);
    expect(scheduleMatchesDate('2026-10-01', { type: 'interval', every: 2, unit: 'month', anchorDate: '2026-08-01' }, PERIOD)).toBe(true);
  });

  it('A16 — "3x por semana" não vira dias fixos: cota por ciclo, 2/3 → 3/3', async () => {
    const w = makeWorld('2026-08-19');
    const quota = { type: 'quota' as const, count: 3, per: 'week' as const };
    const { definition: g } = await w.goals.createGoal({ name: 'Academia', schedule: quota, trackingCycle: WEEKLY, activePeriod: PERIOD });
    for (const d of WEEK) {
      expect(scheduleMatchesDate(d, quota, PERIOD)).toBe(false); // nenhuma data fixa inventada
      expect(isQuotaAvailableOn(d, quota, PERIOD)).toBe(true);
    }
    expect(getExpectedDates('2026-08-17', '2026-08-23', quota, PERIOD)).toEqual([]);

    const ci = async () => {
      await w.occ.getTodayGoalTree('2026-08-19');
      return (await w.occRepo.listCycleInstancesForGoal(g.id))[0];
    };
    expect((await ci()).expectedCount).toBe(3);
    expect((await ci()).computedProgress).toBe(0);

    // dois dias quaisquer (terça e quinta): 2/3
    for (const d of ['2026-08-18', '2026-08-20']) {
      const n = (await w.occ.getTodayGoalTree(d)).nodes[0];
      await w.occ.updateStatus(n.occurrence!.id, 'completed');
    }
    expect((await ci()).computedProgress).toBeCloseTo(2 / 3, 5);
    expect((await ci()).computedStatus).toBe('in_progress');

    const third = (await w.occ.getTodayGoalTree('2026-08-22')).nodes[0];
    await w.occ.updateStatus(third.occurrence!.id, 'completed');
    expect((await ci()).computedStatus).toBe('completed');
    expect((await ci()).computedProgress).toBe(1);
    // cota cumprida: não oferece mais um slot pendente num novo dia da semana
    expect((await w.occ.getTodayGoalTree('2026-08-23')).nodes).toEqual([]);
    // mas o que já foi feito continua visível no histórico do dia
    expect((await w.occ.getTodayGoalTree('2026-08-22')).nodes[0].occurrence?.status).toBe('completed');
  });

  it('A17 — dia 31 mensal: pula meses sem dia 31 (sem quebrar) e dispara nos que têm', () => {
    const sched = { type: 'monthlyDate' as const, dayOfMonth: 31 };
    const hits = getExpectedDates('2026-01-01', '2026-12-31', sched, { startDate: '2026-01-01', endDate: null });
    expect(hits).toEqual(['2026-01-31', '2026-03-31', '2026-05-31', '2026-07-31', '2026-08-31', '2026-10-31', '2026-12-31']);
    expect(scheduleMatchesDate('2026-02-28', sched, { startDate: '2026-01-01', endDate: null })).toBe(false);
  });
});

describe('3. Cenário de referência Treinar (A18–A23)', () => {
  it('A18 — a semana tem 9 execuções esperadas (Futebol 2, Corrida 4, Musculação 3)', async () => {
    const w = makeWorld();
    const t = await createTreinar(w);
    const rev = async (id: string) => (await w.goalRepo.getRevisionForDate(id, '2026-08-19'))!;
    const count = async (id: string) => {
      const r = await rev(id);
      return getExpectedDates('2026-08-17', '2026-08-23', r.schedule, r.activePeriod).length;
    };
    expect([await count(t.futebol.id), await count(t.corrida.id), await count(t.musculacao.id)]).toEqual([2, 4, 3]);
    const root = (await w.occ.getTodayGoalTree('2026-08-19')).nodes[0];
    expect(root.cycleInstance?.expectedCount).toBe(9);
    expect(root.cycleInstance?.computedProgress).toBe(0);
    expect(root.cycleInstance?.computedStatus).toBe('pending');
  });

  it('A19–A21 — Home: seg=Futebol, ter=Corrida, qua=3 atividades; domingo não mostra Treinar', async () => {
    const w = makeWorld();
    await createTreinar(w);
    const kids = async (d: string) => {
      const { nodes } = await w.occ.getTodayGoalTree(d);
      return nodes.length ? names(nodes[0].children) : null;
    };
    expect(await kids('2026-08-17')).toEqual(['Futebol']);
    expect(await kids('2026-08-18')).toEqual(['Corrida']);
    expect(await kids('2026-08-19')).toEqual(['Futebol', 'Corrida', 'Musculação']);
    expect(await kids('2026-08-23')).toBeNull(); // nada relevante no domingo
    // o pai nunca é uma ocorrência acionável (é só agrupador)
    expect((await w.occ.getTodayGoalTree('2026-08-17')).nodes[0].occurrence).toBeNull();
  });

  it('A22 — concluir tudo na quarta NÃO conclui a semana (3/9, em andamento); semana vencida vira não realizada', async () => {
    const w = makeWorld('2026-08-19');
    await createTreinar(w);
    await completeOn(w, '2026-08-19');
    let root = (await w.occ.getTodayGoalTree('2026-08-19')).nodes[0];
    expect(root.children.every((c) => c.occurrence?.status === 'completed')).toBe(true);
    expect(root.cycleInstance?.computedStatus).toBe('in_progress');
    expect(root.cycleInstance?.computedProgress).toBeCloseTo(3 / 9, 5);
    expect(root.cycleInstance?.completedCount).toBe(3);

    // depois que a semana termina sem cumprir o critério, a análise (não a mutação) indica "não realizado"
    w.clock.today = '2026-08-25';
    root = (await w.occ.getTodayGoalTree('2026-08-19')).nodes[0];
    expect(root.cycleInstance?.computedStatus).toBe('not_done');
    expect(root.children.every((c) => c.occurrence?.status === 'completed')).toBe(true); // histórico intacto
  });

  it('A23 — critério mínimo de 7 de 9 conclui o pai com 2 pendentes', async () => {
    const w = makeWorld('2026-08-21');
    const t = await createTreinar(w, { completionRule: { type: 'minimumCount', count: 7 } });
    const done = [
      ['2026-08-17', ['Futebol']],
      ['2026-08-18', ['Corrida']],
      ['2026-08-19', ['Futebol', 'Corrida', 'Musculação']],
      ['2026-08-20', ['Corrida']],
    ] as const; // 1+1+3+1 = 6
    for (const [d, n] of done) await completeOn(w, d, [...n]);
    let root = (await w.occ.getTodayGoalTree('2026-08-21')).nodes[0];
    expect(root.cycleInstance?.completedCount).toBe(6);
    expect(root.cycleInstance?.computedStatus).toBe('in_progress');
    await completeOn(w, '2026-08-21', ['Musculação']); // 7ª execução; Corrida de sexta e 1 Musculação(qui) seguem pendentes
    root = (await w.occ.getTodayGoalTree('2026-08-21')).nodes[0];
    expect(root.cycleInstance?.completedCount).toBe(7);
    expect(root.cycleInstance?.expectedCount).toBe(9);
    expect(root.cycleInstance?.computedStatus).toBe('completed');
    expect(root.cycleInstance?.computedProgress).toBeCloseTo(7 / 9, 5);
    void t;
  });

  it('A18b — hierarquia profunda: avô agrega os 9 através de um pai-contêiner', async () => {
    const w = makeWorld('2026-08-19');
    const { definition: avo } = await w.goals.createGoal({
      name: 'Saúde',
      trackingCycle: WEEKLY,
      schedule: { type: 'custom', expression: 'container' },
      activePeriod: PERIOD,
      aggregationRule: { type: 'scheduledOccurrences', depth: 'direct', weightMode: 'equal' },
    });
    const t = await createTreinar(w);
    await w.goals.moveGoal(t.parent.id, avo.id);
    const tree = await w.occ.getTodayGoalTree('2026-08-19');
    expect(tree.nodes[0].revision.name).toBe('Saúde');
    expect(tree.nodes[0].cycleInstance?.expectedCount).toBe(9);
    expect(tree.nodes[0].children[0].children).toHaveLength(3);
    expect(tree.nodes[0].children[0].depth).toBe(1);
  });
});

describe('4. Status e progresso (A24–A32)', () => {
  const occ = (status: Occurrence['status']): Occurrence => ({ status } as Occurrence);

  it('A24 — ocorrência nova começa Pendente', async () => {
    const w = makeWorld();
    await w.goals.createGoal({ name: 'X', activePeriod: PERIOD });
    const [o] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    expect(o.status).toBe('pending');
    expect(o.completedAt).toBeNull();
  });

  it('A25–A27 — contribuições: concluído 100%, parcial 50%, não realizado 0%, pendente 0', () => {
    expect(getStatusNumericWeight('completed')).toBe(1);
    expect(getStatusNumericWeight('partial')).toBe(0.5);
    expect(getStatusNumericWeight('not_done')).toBe(0);
    expect(getStatusNumericWeight('pending')).toBe(0);
    const r = aggregateScheduledOccurrencesProgress([occ('completed'), occ('partial'), occ('not_done'), occ('pending')], { type: 'allRequired' });
    expect(r.computedProgress).toBeCloseTo((1 + 0.5) / 4, 5);
  });

  async function refeicoes(w: ReturnType<typeof makeWorld>, parent: object = {}) {
    const { definition: pai } = await w.goals.createGoal({
      name: 'Alimentação',
      schedule: { type: 'custom', expression: 'container' },
      activePeriod: PERIOD,
      ...parent,
    });
    const mk = (name: string, extra = {}) => w.goals.addSubGoal(pai.id, { name, schedule: { type: 'daily' }, activePeriod: PERIOD, ...extra });
    return { pai, cafe: (await mk('Café')).definition, almoco: (await mk('Almoço')).definition, jantar: (await mk('Jantar')).definition, mk };
  }
  const statusOf = async (w: ReturnType<typeof makeWorld>, name: string, date = '2026-08-19') => {
    const n = flatten((await w.occ.getTodayGoalTree(date)).nodes).find((x) => x.revision.name === name)!;
    return n.occurrence!;
  };

  it('A28 — Concluído, Parcial, Concluído = ~83% mas o pai NÃO conclui (todos obrigatórios)', async () => {
    const w = makeWorld();
    await refeicoes(w);
    await w.occ.updateStatus((await statusOf(w, 'Café')).id, 'completed');
    await w.occ.updateStatus((await statusOf(w, 'Almoço')).id, 'partial');
    await w.occ.updateStatus((await statusOf(w, 'Jantar')).id, 'completed');
    const root = (await w.occ.getTodayGoalTree('2026-08-19')).nodes[0];
    expect(root.cycleInstance?.computedProgress).toBeCloseTo(0.8333, 3);
    expect(root.cycleInstance?.computedStatus).toBe('in_progress');
    await w.occ.updateStatus((await statusOf(w, 'Almoço')).id, 'completed'); // revisão posterior
    expect((await w.occ.getTodayGoalTree('2026-08-19')).nodes[0].cycleInstance?.computedStatus).toBe('completed');
  });

  it('A29 — filho opcional pendente não bloqueia "todos obrigatórios"', async () => {
    const w = makeWorld();
    const { pai, mk } = await refeicoes(w);
    await mk('Sobremesa', { isRequired: false });
    for (const n of ['Café', 'Almoço', 'Jantar']) await w.occ.updateStatus((await statusOf(w, n)).id, 'completed');
    const root = (await w.occ.getTodayGoalTree('2026-08-19')).nodes[0];
    expect(root.goal.id).toBe(pai.id);
    expect(root.cycleInstance?.computedStatus).toBe('completed');
    expect(root.cycleInstance?.computedProgress).toBeCloseTo(3 / 4, 5); // opcional entra no percentual exibido (documentado)
  });

  it('A30 — pesos 10/50/25/15 (por filho) valem mais que fatias iguais de 25%', async () => {
    const w = makeWorld();
    const { definition: pai } = await w.goals.createGoal({
      name: 'Projeto',
      schedule: { type: 'custom', expression: 'container' },
      trackingCycle: { type: 'monthly' },
      activePeriod: PERIOD,
    });
    const mk = async (n: string) =>
      (await w.goals.addSubGoal(pai.id, { name: n, schedule: { type: 'once', date: '2026-08-19' }, trackingCycle: { type: 'monthly' }, activePeriod: PERIOD })).definition;
    const [pl, dev, te, doc] = [await mk('Planejamento'), await mk('Desenvolvimento'), await mk('Testes'), await mk('Documentação')];
    const rev = (await w.goalRepo.getRevisionForDate(pai.id, '2026-08-19'))!;
    await w.goalRepo.updateRevision({
      ...rev,
      aggregationRule: {
        type: 'directChildren',
        weightMode: 'custom',
        optionalContribution: 'include',
        childWeights: { [pl.id]: 10, [dev.id]: 50, [te.id]: 25, [doc.id]: 15 },
      },
    });
    await w.occ.updateStatus((await statusOf(w, 'Planejamento')).id, 'completed');
    await w.occ.updateStatus((await statusOf(w, 'Desenvolvimento')).id, 'partial');
    const root = (await w.occ.getTodayGoalTree('2026-08-19')).nodes[0];
    expect(root.cycleInstance?.computedProgress).toBeCloseTo((10 + 25) / 100, 5); // 35%, não 37,5%
    expect(root.cycleInstance?.computedStatus).toBe('in_progress');
  });

  it('A31 — quantidade 2,5 L de 4 L = 62,5%; alvo atingido conclui; excesso fica em 100%', async () => {
    expect(calculateQuantityProgress(2.5, 4)).toBe(0.625);
    const w = makeWorld();
    await w.goals.createGoal({ name: 'Água', progressRule: { type: 'quantity', target: 4, unit: 'L' }, activePeriod: PERIOD });
    const o = (await w.occ.getOrGenerateOccurrencesForDate('2026-08-19'))[0];
    const partial = await w.occ.recordQuantity(o.id, 2.5);
    expect(partial.progressValue).toBe(0.625);
    expect(partial.status).toBe('partial');
    const ci = (await w.occ.getTodayGoalTree('2026-08-19')).nodes[0].cycleInstance!;
    expect(ci.computedProgress).toBeCloseTo(0.625, 5);
    const full = await w.occ.recordQuantity(o.id, 5);
    expect(full.status).toBe('completed');
    expect(full.progressValue).toBe(1);
    await expect(w.occ.recordQuantity(o.id, -1)).rejects.toThrow();
  });

  it('A32 — revisar Concluído → Parcial persiste, mantém registros e guarda a trilha de status', async () => {
    const w = makeWorld();
    await w.goals.createGoal({ name: 'Leitura', activePeriod: PERIOD });
    const [o] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, 'li 10 páginas');
    await w.occ.updateStatus(o.id, 'completed');
    await w.occ.updateStatus(o.id, 'partial');
    expect((await w.occRepo.getById(o.id))?.status).toBe('partial');
    expect(await w.journal.getTimelineForOccurrence(o.id)).toHaveLength(1);
    const trail = await w.journalRepo.listStatusChangesForOccurrence(o.id);
    expect(trail.map((t) => [t.fromStatus, t.toStatus])).toEqual([
      ['pending', 'completed'],
      ['completed', 'partial'],
    ]);
  });

  it('A32b — status em data passada registra o "de" correto (não só o de hoje)', async () => {
    const w = makeWorld('2026-11-10');
    await w.goals.createGoal({ name: 'Antiga', activePeriod: PERIOD });
    const [o] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    await w.occ.updateStatus(o.id, 'not_done');
    await w.occ.updateStatus(o.id, 'completed');
    const trail = await w.journalRepo.listStatusChangesForOccurrence(o.id);
    expect(trail[1].fromStatus).toBe('not_done');
  });
});

describe('5. Edição e histórico (A33–A36)', () => {
  it('A33 — "somente esta ocorrência" altera só o dia; o dia seguinte e a definição ficam intactos', async () => {
    const w = makeWorld();
    const { definition: g } = await w.goals.createGoal({ name: 'Leitura', activePeriod: PERIOD });
    const [today] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    await w.occ.overrideOccurrence(today.id, { name: 'Leitura especial', description: 'só hoje' });
    expect((await w.occRepo.getById(today.id))?.overrideData?.name).toBe('Leitura especial');
    const [tomorrow] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-20');
    expect(tomorrow.overrideData ?? null).toBeNull();
    expect((await w.goalRepo.getRevisionForDate(g.id, '2026-08-20'))?.name).toBe('Leitura');
    // reabrir o dia não apaga a exceção
    await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    expect((await w.occRepo.getById(today.id))?.overrideData?.description).toBe('só hoje');
  });

  it('A33b — remover só a execução de um dia tira a meta daquele dia e do denominador do ciclo', async () => {
    const w = makeWorld('2026-08-19');
    const t = await createTreinar(w);
    const wed = (await w.occ.getTodayGoalTree('2026-08-19')).nodes[0];
    const corridaWed = wed.children.find((c) => c.revision.name === 'Corrida')!;
    await w.occ.overrideOccurrence(corridaWed.occurrence!.id, { isRemovedFromDate: true });
    const after = (await w.occ.getTodayGoalTree('2026-08-19')).nodes[0];
    expect(names(after.children)).toEqual(['Futebol', 'Musculação']);
    expect(after.cycleInstance?.expectedCount).toBe(8);
    const thu = (await w.occ.getTodayGoalTree('2026-08-20')).nodes[0];
    expect(names(thu.children)).toEqual(['Corrida', 'Musculação']); // outros dias intactos
    void t;
  });

  it('A34 — Seg/Qua → Seg/Sex a partir de 19/08: passado preservado, futuro novo, sem duplicar', async () => {
    const w = makeWorld('2026-08-19');
    const { definition: g } = await w.goals.createGoal({
      name: 'Treino B',
      schedule: { type: 'weekdays', weekdays: [1, 3] },
      trackingCycle: WEEKLY,
      activePeriod: PERIOD,
    });
    for (const d of ['2026-08-17', '2026-08-19']) await w.occ.getOrGenerateOccurrencesForDate(d);
    const monOcc = (await w.occRepo.findByGoalAndDate(g.id, '2026-08-17'))!;
    await w.occ.updateStatus(monOcc.id, 'completed');
    const oldRevId = monOcc.revisionId;

    const newRev = await w.goals.editGoalThisAndFuture(g.id, '2026-08-19', { schedule: { type: 'weekdays', weekdays: [1, 5] } });
    expect(newRev.id).not.toBe(oldRevId);

    // passado: ocorrência concluída intacta e presa à revisão antiga
    const monAfter = (await w.occRepo.getById(monOcc.id))!;
    expect(monAfter.status).toBe('completed');
    expect(monAfter.revisionId).toBe(oldRevId);
    expect((await w.goalRepo.getRevision(oldRevId))?.effectiveTo).toBe('2026-08-18');
    expect((await w.goalRepo.getRevisionForDate(g.id, '2026-08-17'))?.schedule).toEqual({ type: 'weekdays', weekdays: [1, 3] });

    // futuro: sexta aparece, quarta (19/08, vigência nova) deixou de ser esperada e some da Home
    expect(names((await w.occ.getTodayGoalTree('2026-08-21')).nodes)).toEqual(['Treino B']);
    expect((await w.occ.getTodayGoalTree('2026-08-19')).nodes).toEqual([]);
    expect(names((await w.occ.getTodayGoalTree('2026-08-24')).nodes)).toEqual(['Treino B']); // segunda
    expect((await w.occ.getTodayGoalTree('2026-08-26')).nodes).toEqual([]); // quarta futura
    // sem duplicidade
    for (const d of ['2026-08-17', '2026-08-21', '2026-08-24']) expect(await w.occRepo.findByDate(d)).toHaveLength(1);
  });

  it('A35 — uma data antiga continua resolvendo a revisão que valia naquele dia', async () => {
    const w = makeWorld();
    const { definition: g } = await w.goals.createGoal({ name: 'Meta Inicial', activePeriod: PERIOD });
    await w.goals.editGoalThisAndFuture(g.id, '2026-08-15', { name: 'Meta Editada' });
    await w.goals.editGoalThisAndFuture(g.id, '2026-08-25', { name: 'Meta Final' });
    const at = async (d: string) => (await w.goalRepo.getRevisionForDate(g.id, d))?.name;
    expect([await at('2026-08-05'), await at('2026-08-15'), await at('2026-08-24'), await at('2026-08-25')]).toEqual([
      'Meta Inicial',
      'Meta Editada',
      'Meta Editada',
      'Meta Final',
    ]);
    expect((await at('2026-07-01')) ?? null).toBeNull(); // antes de existir
    // abrir a Home numa data antiga usa a revisão daquele dia
    expect((await w.occ.getTodayGoalTree('2026-08-05')).nodes[0].revision.name).toBe('Meta Inicial');
  });

  it('A36 — editar metadados no mesmo dia não duplica a ocorrência e reaponta a pendente à nova revisão', async () => {
    const w = makeWorld();
    const { definition: g } = await w.goals.createGoal({ name: 'Meta', activePeriod: PERIOD });
    const [before] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    const rev = await w.goals.editGoalThisAndFuture(g.id, '2026-08-19', { description: 'Nova descrição' });
    await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    const occs = await w.occRepo.findByDate('2026-08-19');
    expect(occs).toHaveLength(1);
    expect(occs[0].id).toBe(before.id);
    expect(occs[0].revisionId).toBe(rev.id);
    // revisão que NÃO começa na data: nova revisão, ainda sem duplicar
    await w.goals.editGoalThisAndFuture(g.id, '2026-08-20', { description: 'Outra' });
    await w.occ.getOrGenerateOccurrencesForDate('2026-08-20');
    expect(await w.occRepo.findByDate('2026-08-20')).toHaveLength(1);
    expect(await w.occRepo.findByDate('2026-08-19')).toHaveLength(1);
  });
});

describe('6. Registros e anexos (A37–A42)', () => {
  const blob = (n: number, type = 'image/jpeg') => new Blob([new Uint8Array(n)], { type });
  async function oneOcc() {
    const w = makeWorld();
    await w.goals.createGoal({ name: 'Anexos', activePeriod: PERIOD });
    const [o] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    return { w, o };
  }

  it('A37 — várias entradas com carimbo de tempo na mesma ocorrência, mais recente primeiro', async () => {
    const { w, o } = await oneOcc();
    const r1 = await w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, 'primeira');
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, 'segunda');
    const tl = await w.journal.getTimelineForOccurrence(o.id);
    expect(tl.map((r) => r.comment)).toEqual(['segunda', 'primeira']);
    expect(Date.parse(r2.createdAt)).toBeGreaterThan(Date.parse(r1.createdAt) - 1);
  });

  it('A38 — só comentário salva e aparece; registro totalmente vazio é recusado', async () => {
    const { w, o } = await oneOcc();
    const r = await w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, '  só texto  ');
    expect(r.comment).toBe('só texto');
    expect((await w.journal.getTimelineForOccurrence(o.id))[0].attachments).toEqual([]);
    await expect(w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, '   ', [])).rejects.toThrow();
    expect(await w.journal.getTimelineForOccurrence(o.id)).toHaveLength(1);
  });

  it('A39 — só imagem (sem comentário) salva e guarda o conteúdo', async () => {
    const { w, o } = await oneOcc();
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, null, [
      { uri: '', displayName: 'foto.jpg', mimeType: 'image/jpeg', sizeBytes: 12, blob: blob(12) },
    ]);
    const [rec] = await w.journal.getTimelineForOccurrence(o.id);
    expect(rec.comment).toBeNull();
    expect(rec.attachments![0].kind).toBe('image');
    expect(rec.attachments![0].blob?.size).toBe(12);
  });

  it('A40 — vários anexos de tipos diferentes no mesmo registro, com ids distintos', async () => {
    const { w, o } = await oneOcc();
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, 'treino', [
      { uri: '', displayName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 1, blob: blob(1) },
      { uri: '', displayName: 'b.png', mimeType: 'image/png', sizeBytes: 2, blob: blob(2, 'image/png') },
      { uri: '', displayName: 'plano.pdf', mimeType: 'application/pdf', sizeBytes: 3, blob: blob(3, 'application/pdf') },
    ]);
    const atts = (await w.journal.getTimelineForOccurrence(o.id))[0].attachments!;
    expect(atts.map((a) => a.kind)).toEqual(['image', 'image', 'file']);
    expect(new Set(atts.map((a) => a.id)).size).toBe(3);
  });

  it('A41 — registro feito com a ocorrência Pendente sobrevive ao concluí-la', async () => {
    const { w, o } = await oneOcc();
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, 'antes');
    await w.occ.updateStatus(o.id, 'completed');
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, 'depois');
    expect((await w.journal.getTimelineForOccurrence(o.id)).map((r) => r.comment).sort()).toEqual(['antes', 'depois']);
    expect((await w.occRepo.getById(o.id))?.status).toBe('completed');
  });

  it('A42 — evidência no nível do ciclo (pai-contêiner, sem ocorrência própria)', async () => {
    const w = makeWorld();
    const t = await createTreinar(w);
    const root = (await w.occ.getTodayGoalTree('2026-08-19')).nodes[0];
    expect(root.occurrence).toBeNull();
    const ciId = root.cycleInstance!.id;
    await w.journal.addRecord({ type: 'cycle', cycleInstanceId: ciId }, 'semana pesada');
    expect((await w.journal.getTimelineForCycle(ciId)).map((r) => r.comment)).toEqual(['semana pesada']);
    // o mesmo ciclo é encontrado em outro dia da semana (id estável)
    const monRoot = (await w.occ.getTodayGoalTree('2026-08-17')).nodes[0];
    expect(monRoot.cycleInstance!.id).toBe(ciId);
    // e não vaza para uma ocorrência
    expect(await w.journal.getTimelineForOccurrence(root.children[0].occurrence!.id)).toEqual([]);
    void t;
  });
});

describe('7. Home e comportamento de UI (A43–A48)', () => {
  it('A43–A45 — contrato de interação: chevron/nome/status são alvos distintos (validado no navegador)', () => {
    // Este contrato é de interface; a verificação real foi feita no navegador (ver auditoria).
    // Aqui garantimos que o componente existe e expõe três controles independentes.
    const src = readFileSync(resolve(__dirname, '../features/today/GoalNodeCard.tsx'), 'utf-8');
    expect(src).toMatch(/aria-label=\{expanded \? 'Recolher submetas' : 'Expandir submetas'\}/);
    expect(src).toMatch(/onOpenDetails\(node\)/);
    expect(src).toMatch(/onSelectStatus\(/);
    expect(src).toMatch(/onToggle\(node\.goal\.id, depth\)/);
    expect(src).not.toMatch(/stopPropagation/); // sem alvos aninhados ambíguos
  });

  it('A46 — com muitas metas a Home mantém raízes recolhidas por padrão e limita o recuo', async () => {
    const { defaultExpanded, indentFor } = await import('../features/today/treeLayout');
    expect(defaultExpanded(0)).toBe(true); // raiz mostra o que vence hoje
    expect(defaultExpanded(1)).toBe(false);
    expect(defaultExpanded(5)).toBe(false);
    expect(indentFor(0)).toBe(0);
    expect(indentFor(1)).toBeGreaterThan(0);
    expect(indentFor(20)).toBe(indentFor(3)); // recuo não cresce indefinidamente
    const w = makeWorld();
    for (let i = 0; i < 60; i++) await w.goals.createGoal({ name: `M${i}`, activePeriod: PERIOD });
    const { nodes } = await w.occ.getTodayGoalTree('2026-08-19');
    expect(nodes).toHaveLength(60);
  });

  it('A47 — showParentOnHome=false: filhos devidos aparecem independentes e ainda agregam no ciclo do pai', async () => {
    const w = makeWorld('2026-08-19');
    const t = await createTreinar(w, { showParentOnHome: false });
    const tree = await w.occ.getTodayGoalTree('2026-08-19');
    expect(names(tree.nodes)).toEqual(['Futebol', 'Corrida', 'Musculação']);
    expect(tree.nodes.every((n) => n.depth === 0)).toBe(true);
    await w.occ.updateStatus(tree.nodes[0].occurrence!.id, 'completed');
    await w.occ.getTodayGoalTree('2026-08-19'); // recalcula o ciclo (a Home recarrega após cada mudança)
    const parentCycle = (await w.occRepo.listCycleInstancesForGoal(t.parent.id))[0];
    expect(parentCycle.completedCount).toBe(1);
    expect(parentCycle.expectedCount).toBe(9);
    // por padrão (true) continuam agrupados
    const w2 = makeWorld('2026-08-19');
    await createTreinar(w2);
    expect(names((await w2.occ.getTodayGoalTree('2026-08-19')).nodes)).toEqual(['Treinar']);
  });

  it('A48 — Home recebe só a CONTAGEM de evidências (nunca as imagens)', async () => {
    const w = makeWorld();
    await w.goals.createGoal({ name: 'Foto', activePeriod: PERIOD });
    const [o] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    const big = new Blob([new Uint8Array(1024)], { type: 'image/jpeg' });
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, 'a', [{ uri: '', displayName: 'x.jpg', mimeType: 'image/jpeg', sizeBytes: 1024, blob: big }]);
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, 'b');
    const node = (await w.occ.getTodayGoalTree('2026-08-19')).nodes[0];
    expect(node.evidenceCount).toBe(2);
    expect(JSON.stringify(Object.keys(node))).not.toMatch(/attachments|blob/);
  });
});

describe('8. Persistência e plataforma (A49–A56) — camada de serviços', () => {
  it('A49 — "reiniciar" serviços sobre os mesmos repositórios preserva metas, status e registros', async () => {
    const w = makeWorld();
    await createTreinar(w);
    await completeOn(w, '2026-08-19', ['Futebol']);
    const wed = (await w.occ.getTodayGoalTree('2026-08-19')).nodes[0].children[0];
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: wed.occurrence!.id }, 'ok');
    const { OccurrenceService } = await import('../application/services/OccurrenceService');
    const { JournalService } = await import('../application/services/JournalService');
    const occ2 = new OccurrenceService(w.goalRepo, w.occRepo, w.journalRepo, () => w.clock.today);
    const journal2 = new JournalService(w.journalRepo);
    const again = (await occ2.getTodayGoalTree('2026-08-19')).nodes[0];
    expect(again.children[0].occurrence?.status).toBe('completed');
    expect(again.cycleInstance?.completedCount).toBe(1);
    expect(await journal2.getTimelineForOccurrence(wed.occurrence!.id)).toHaveLength(1);
  });

  it('A50 — o núcleo funciona sem rede e o app não depende de recursos externos (fontes/CDN)', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error('sem rede');
    }) as typeof fetch;
    try {
      const w = makeWorld();
      await createTreinar(w);
      await completeOn(w, '2026-08-19');
      expect((await w.occ.getTodayGoalTree('2026-08-19')).nodes[0].cycleInstance?.completedCount).toBe(3);
    } finally {
      globalThis.fetch = realFetch;
    }
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8');
    expect(html).not.toMatch(/googleapis|gstatic|https?:\/\/(?!localhost)/);
  });

  it('A51 — câmera negada: erro recuperável; comentário/status continuam funcionando', async () => {
    const denied = {
      capturePhoto: async () => {
        throw new MediaAccessError('Permissão da câmera negada');
      },
      pickImageFromGallery: async () => null,
    };
    await expect(denied.capturePhoto()).rejects.toBeInstanceOf(MediaAccessError);
    const w = makeWorld();
    await w.goals.createGoal({ name: 'X', activePeriod: PERIOD });
    const [o] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    await w.occ.updateStatus(o.id, 'completed');
    const rec = await w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, 'sem foto');
    expect(rec.comment).toBe('sem foto');
    expect((await w.occRepo.getById(o.id))?.status).toBe('completed');
  });

  it('A52 — metadados do arquivo escolhido (nome, tipo, tamanho) são persistidos', async () => {
    const w = makeWorld();
    await w.goals.createGoal({ name: 'X', activePeriod: PERIOD });
    const [o] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, null, [
      { uri: '', displayName: 'relatorio.pdf', mimeType: 'application/pdf', sizeBytes: 500, blob: new Blob([new Uint8Array(500)], { type: 'application/pdf' }) },
    ]);
    const a = (await w.journal.getTimelineForOccurrence(o.id))[0].attachments![0];
    expect([a.displayName, a.mimeType, a.sizeBytes, a.kind]).toEqual(['relatorio.pdf', 'application/pdf', 500, 'file']);
  });

  it('A53–A56 — backup/importação/migração: ver persistence.idb.test.ts (IndexedDB real via fake-indexeddb)', () => {
    expect(readFileSync(resolve(__dirname, './persistence.idb.test.ts'), 'utf-8')).toMatch(/A53/);
  });
});

describe('9. Remarcação e fonte de agregação (A57–A60)', () => {
  it('A57 — remarcar meta única 19→20/08: some do 19, aparece no 20, sem criar série, com histórico', async () => {
    const w = makeWorld();
    const { definition: g } = await w.goals.createGoal({ name: 'Tarefa única', schedule: { type: 'once', date: '2026-08-19' }, activePeriod: PERIOD });
    const [o] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, 'nota antes de remarcar');
    const moved = await w.occ.rescheduleOneTimeGoal(o.id, '2026-08-20');
    expect(moved.scheduledDate).toBe('2026-08-20');
    expect(moved.rescheduledFrom).toBe('2026-08-19');
    expect(moved.id).toBe(o.id);

    expect((await w.occ.getTodayGoalTree('2026-08-19')).nodes).toEqual([]); // não é mais acionável
    expect(await w.occRepo.findByDate('2026-08-19')).toEqual([]); // e nada é re-gerado
    const d20 = await w.occ.getTodayGoalTree('2026-08-20');
    expect(names(d20.nodes)).toEqual(['Tarefa única']);
    expect(d20.nodes[0].occurrence?.id).toBe(o.id);
    expect(d20.nodes[0].evidenceCount).toBe(1);
    expect((await w.occ.getTodayGoalTree('2026-08-21')).nodes).toEqual([]); // sem série recorrente
    expect(await w.goalRepo.listAllDefinitions()).toHaveLength(1);
    expect((await w.goalRepo.getRevisionForDate(g.id, '2026-08-20'))?.schedule).toEqual({ type: 'once', date: '2026-08-20' });
    // remarcar para trás também funciona (e ajusta o período ativo)
    const back = await w.occ.rescheduleOneTimeGoal(o.id, '2026-07-30');
    expect(back.scheduledDate).toBe('2026-07-30');
    expect(names((await w.occ.getTodayGoalTree('2026-07-30')).nodes)).toEqual(['Tarefa única']);
  });

  it('A57b — meta recorrente NÃO pode ser remarcada como se fosse a série inteira', async () => {
    const w = makeWorld();
    await w.goals.createGoal({ name: 'Diária', activePeriod: PERIOD });
    const [o] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    await expect(w.occ.rescheduleOneTimeGoal(o.id, '2026-08-20')).rejects.toThrow(/única/);
    expect((await w.occRepo.getById(o.id))?.scheduledDate).toBe('2026-08-19');
  });

  it('A58 — exceção na quarta não altera quinta nem as seguintes da série', async () => {
    const w = makeWorld('2026-08-19');
    const t = await createTreinar(w);
    const wed = (await w.occ.getTodayGoalTree('2026-08-19')).nodes[0].children.find((c) => c.revision.name === 'Corrida')!;
    await w.occ.overrideOccurrence(wed.occurrence!.id, { name: 'Corrida na esteira', quantityValue: 3 });
    for (const d of ['2026-08-20', '2026-08-21', '2026-08-24']) {
      const kids = (await w.occ.getTodayGoalTree(d)).nodes[0]?.children ?? [];
      const run = kids.find((c) => c.revision.name === 'Corrida');
      if (run) expect(run.occurrence?.overrideData ?? null).toBeNull();
    }
    expect((await w.goalRepo.getRevisionForDate(t.corrida.id, '2026-08-20'))?.name).toBe('Corrida');
    expect((await w.goalRepo.listRevisionsForGoal(t.corrida.id)).length).toBe(1); // nenhuma revisão criada
  });

  it('A59 — Treinar conta 9 ocorrências esperadas, não 3 cartões de filhos', async () => {
    const w = makeWorld('2026-08-19');
    await createTreinar(w);
    await completeOn(w, '2026-08-17'); // 1 de 9
    const root = (await w.occ.getTodayGoalTree('2026-08-17')).nodes[0];
    expect(root.cycleInstance?.expectedCount).toBe(9);
    expect(root.cycleInstance?.computedProgress).toBeCloseTo(1 / 9, 5); // não 1/3
    // geração real ao longo da semana também resulta em 9
    let total = 0;
    for (const d of WEEK) total += (await w.occ.getOrGenerateOccurrencesForDate(d)).filter((o) => o.source === 'generated').length;
    expect(total).toBe(9 + 0); // o pai-contêiner não gera ocorrência
  });

  it('A60 — projeto por filhos diretos: cada filho conta UMA vez, mesmo com netos', async () => {
    const w = makeWorld('2026-08-19');
    const { definition: pai } = await w.goals.createGoal({
      name: 'Projeto',
      trackingCycle: { type: 'monthly' },
      schedule: { type: 'custom', expression: 'container' },
      activePeriod: PERIOD,
    });
    const mk = async (n: string, parentId: string) =>
      (await w.goals.addSubGoal(parentId, { name: n, trackingCycle: { type: 'monthly' }, schedule: { type: 'once', date: '2026-08-19' }, activePeriod: PERIOD })).definition;
    const f1 = await mk('F1', pai.id);
    const f2 = await mk('F2', pai.id);
    const f3 = await mk('F3', pai.id);
    const f4 = await mk('F4', pai.id);
    await mk('Neto A', f2.id);
    await mk('Neto B', f2.id);
    await mk('Neto C', f2.id);
    const rev = (await w.goalRepo.getRevisionForDate(pai.id, '2026-08-19'))!;
    await w.goalRepo.updateRevision({
      ...rev,
      aggregationRule: {
        type: 'directChildren',
        weightMode: 'custom',
        optionalContribution: 'include',
        childWeights: { [f1.id]: 10, [f2.id]: 50, [f3.id]: 25, [f4.id]: 15 },
      },
    });
    const all = async () => flatten((await w.occ.getTodayGoalTree('2026-08-19')).nodes);
    const by = async (n: string) => (await all()).find((x) => x.revision.name === n)!;
    await w.occ.updateStatus((await by('F1')).occurrence!.id, 'completed');
    for (const n of ['F2', 'Neto A', 'Neto B', 'Neto C']) await w.occ.updateStatus((await by(n)).occurrence!.id, 'completed');
    const ci = (await by('Projeto')).cycleInstance!;
    expect(ci.expectedCount).toBe(4); // 4 filhos imediatos; netos NÃO entram no denominador do projeto
    expect(ci.computedProgress).toBeCloseTo((10 + 50) / 100, 5);
    expect(ci.completedCount).toBe(2);
  });
});

describe('Validação e tipos de entrada', () => {
  it('rejeita metas inválidas com mensagens em português (sem gravar nada)', async () => {
    const w = makeWorld();
    const bad = [
      { name: '   ' },
      { name: 'X', schedule: { type: 'weekdays' as const, weekdays: [] } },
      { name: 'X', schedule: { type: 'quota' as const, count: 0, per: 'week' as const } },
      { name: 'X', activePeriod: { startDate: '2026-08-10', endDate: '2026-08-01' } },
      { name: 'X', schedule: { type: 'once' as const, date: '2026-07-30' }, activePeriod: PERIOD },
      { name: 'X', progressRule: { type: 'quantity' as const, target: 0, unit: 'L' } },
      { name: 'X', parentId: 'inexistente' },
    ];
    for (const input of bad) await expect(w.goals.createGoal(input)).rejects.toBeInstanceOf(GoalValidationError);
    expect(await w.goalRepo.listAllDefinitions()).toHaveLength(0);
  });

  it('metas arquivadas (e suas submetas) somem da Home, mas o histórico permanece', async () => {
    const w = makeWorld();
    const t = await createTreinar(w);
    await completeOn(w, '2026-08-19');
    const ids = await w.goals.archiveGoal(t.parent.id);
    expect(ids).toHaveLength(4);
    expect((await w.occ.getTodayGoalTree('2026-08-19')).nodes).toEqual([]);
    expect((await w.occRepo.findByDate('2026-08-19')).filter((o) => o.status === 'completed')).toHaveLength(3);
  });

  it('buildTodayGoalTree é puro: mesma entrada, mesma saída', () => {
    const out = buildTodayGoalTree({ goals: [], revisionsMap: new Map(), occurrencesMap: new Map(), cycleInstancesMap: new Map() });
    expect(out).toEqual([]);
  });
});
