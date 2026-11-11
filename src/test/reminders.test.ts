import { describe, it, expect } from 'vitest';
import { makeWorld, PERIOD, World } from './helpers';
import { ReminderService } from '../application/services/ReminderService';
import { MemorySettingsStore } from '../infrastructure/platform/notifications/settingsStore';
import { NotificationPermission, NotificationPort } from '../infrastructure/ports/NotificationPort';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettings,
  PlannedReminder,
  describeReminderTimes,
  reminderId,
  reminderOffsets,
  validateNotify,
} from '../domain/notifications/reminderPlanner';
import { NotifyConfig } from '../domain/types';
import { GoalValidationError } from '../domain/goals/goalValidation';

/** "Sistema operacional" simulado: guarda os agendamentos e dispara os vencidos SEM nenhum código do app rodando. */
class FakeOs implements NotificationPort {
  pending = new Map<number, PlannedReminder>();
  delivered: PlannedReminder[] = [];
  supported = true;
  permission: NotificationPermission = 'granted';
  scheduleCalls = 0;
  cancelCalls = 0;
  isSupported() {
    return this.supported;
  }
  async getPermission() {
    return this.permission;
  }
  async requestPermission() {
    this.permission = 'granted' as NotificationPermission;
    return this.permission;
  }
  async getPendingIds() {
    return [...this.pending.keys()];
  }
  async schedule(items: PlannedReminder[]) {
    if (items.length) this.scheduleCalls++;
    for (const i of items) this.pending.set(i.id, i);
  }
  async cancel(ids: number[]) {
    if (ids.length) this.cancelCalls++;
    for (const id of ids) this.pending.delete(id);
  }
  async canScheduleExact() {
    return true;
  }
  async openExactAlarmSettings() {}
  async notifyNow() {}
  /** O relógio do sistema avançou: entrega o que venceu (app pode estar fechado). */
  fireDue(now: Date): PlannedReminder[] {
    const due = [...this.pending.values()].filter((p) => p.fireAt <= now.getTime()).sort((a, b) => a.fireAt - b.fireAt);
    for (const d of due) {
      this.pending.delete(d.id);
      this.delivered.push(d);
    }
    return due;
  }
  times(): string[] {
    return [...this.pending.values()].sort((a, b) => a.fireAt - b.fireAt).map((p) => hhmm(p.fireAt));
  }
}

const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const LUNCH: NotifyConfig = { enabled: true, time: '12:00', beforeMin: 60, afterMin: 60, everyMin: 30 };

function setup(nowAt = new Date(2026, 7, 19, 10, 0), settings: Partial<NotificationSettings> = {}) {
  const w = makeWorld('2026-08-19');
  const os = new FakeOs();
  const clock = { now: nowAt };
  const store = new MemorySettingsStore({ ...DEFAULT_NOTIFICATION_SETTINGS, ...settings });
  const svc = new ReminderService(w.goalRepo, w.occRepo, os, store, () => clock.now);
  const at = (h: number, m = 0, day = 19) => {
    clock.now = new Date(2026, 7, day, h, m);
    w.clock.today = `2026-08-${String(day).padStart(2, '0')}`;
  };
  return { w, os, svc, store, clock, at };
}

async function lunchGoal(w: World, extra: Record<string, unknown> = {}) {
  return (
    await w.goals.createGoal({ name: 'Almoço', schedule: { type: 'daily' }, activePeriod: PERIOD, notify: LUNCH, ...extra })
  ).definition;
}

describe('grade de lembretes (antes / depois / intervalo)', () => {
  it('12h, 60 min antes, 60 min depois, a cada 30 → 11:00 11:30 12:00 12:30 13:00', () => {
    expect(describeReminderTimes(LUNCH)).toEqual(['11:00', '11:30', '12:00', '12:30', '13:00']);
    expect(reminderOffsets(LUNCH)).toEqual([-60, -30, 0, 30, 60]);
  });

  it('sem janela = só no horário; o horário exato sempre recebe aviso mesmo se a grade "pular" o zero', () => {
    expect(describeReminderTimes({ ...LUNCH, beforeMin: 0, afterMin: 0 })).toEqual(['12:00']);
    expect(reminderOffsets({ beforeMin: 50, afterMin: 50, everyMin: 30 })).toEqual([-50, -20, 0, 10, 40]);
    expect(describeReminderTimes({ ...LUNCH, beforeMin: 30, afterMin: 0, everyMin: 15 })).toEqual(['11:30', '11:45', '12:00']);
  });

  it('passa da meia-noite sem quebrar o formato', () => {
    expect(describeReminderTimes({ enabled: true, time: '23:30', beforeMin: 0, afterMin: 60, everyMin: 30 })).toEqual(['23:30', '00:00', '00:30']);
  });

  it('validação: horário, limites, intervalo e máximo por ocorrência', () => {
    expect(validateNotify(LUNCH)).toEqual([]);
    expect(validateNotify({ ...LUNCH, time: '25:00' })).not.toEqual([]);
    expect(validateNotify({ ...LUNCH, beforeMin: -5 })).not.toEqual([]);
    expect(validateNotify({ ...LUNCH, afterMin: 721 })).not.toEqual([]);
    expect(validateNotify({ ...LUNCH, everyMin: 2 })).not.toEqual([]);
    expect(validateNotify({ ...LUNCH, beforeMin: 360, afterMin: 360, everyMin: 5 }).join(' ')).toMatch(/Muitos lembretes/);
    expect(validateNotify({ ...LUNCH, beforeMin: 0, afterMin: 0, everyMin: 1 })).toEqual([]); // intervalo irrelevante sem janela
  });

  it('ids são estáveis e distintos', () => {
    expect(reminderId('a|1')).toBe(reminderId('a|1'));
    expect(reminderId('a|1')).not.toBe(reminderId('a|2'));
    expect(reminderId('x')).toBeGreaterThan(0);
  });
});

describe('agendamento no sistema (exemplo do almoço)', () => {
  it('agenda 11h, 11h30, 12h, 12h30 e 13h para hoje e os próximos dias da janela', async () => {
    const { w, os, svc } = setup();
    await lunchGoal(w);
    const r = await svc.sync();
    expect(r).toMatchObject({ skipped: null });
    const today = [...os.pending.values()].filter((p) => p.date === '2026-08-19').sort((a, b) => a.fireAt - b.fireAt);
    expect(today.map((p) => hhmm(p.fireAt))).toEqual(['11:00', '11:30', '12:00', '12:30', '13:00']);
    expect(today[2].body).toMatch(/Está na hora/);
    expect(today[0].body).toMatch(/Em 1 h/);
    expect(today[4].body).toMatch(/Ainda pendente/);
    expect(new Set([...os.pending.values()].map((p) => p.date)).size).toBe(7); // janela rolante de 7 dias
    expect(os.pending.size).toBe(35);
  });

  it('com o app fechado, o sistema entrega no horário (nenhum código do app roda entre os disparos)', async () => {
    const { w, os, svc } = setup();
    await lunchGoal(w);
    await svc.sync();
    // app "fechado": só o relógio do sistema anda
    expect(os.fireDue(new Date(2026, 7, 19, 11, 45)).map((p) => hhmm(p.fireAt))).toEqual(['11:00', '11:30']);
    expect(os.fireDue(new Date(2026, 7, 19, 12, 0)).map((p) => hhmm(p.fireAt))).toEqual(['12:00']);
    expect(os.fireDue(new Date(2026, 7, 19, 13, 30)).map((p) => hhmm(p.fireAt))).toEqual(['12:30', '13:00']);
    expect(os.delivered.map((d) => d.title)).toEqual(Array(5).fill('Almoço'));
  });

  it('registrar a execução cancela IMEDIATAMENTE os lembretes pendentes daquela ocorrência', async () => {
    const { w, os, svc, at } = setup();
    await lunchGoal(w);
    await svc.sync();
    os.fireDue(new Date(2026, 7, 19, 11, 10)); // 11:00 já tocou
    at(11, 10);
    const [occ] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    await w.occ.updateStatus(occ.id, 'completed');
    const r = await svc.sync();
    expect(r.cancelled).toBe(4); // 11:30, 12:00, 12:30, 13:00
    expect([...os.pending.values()].filter((p) => p.date === '2026-08-19')).toEqual([]);
    expect([...os.pending.values()].filter((p) => p.date === '2026-08-20')).toHaveLength(5); // amanhã segue intacto
    // nada mais toca hoje
    expect(os.fireDue(new Date(2026, 7, 19, 23, 59))).toEqual([]);
  });

  it('parcial e não realizado também encerram os lembretes; voltar a pendente reagenda só o que ainda vai ocorrer', async () => {
    const { w, os, svc, at } = setup();
    await lunchGoal(w);
    await svc.sync();
    at(11, 40);
    const [occ] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    for (const st of ['partial', 'not_done'] as const) {
      await w.occ.updateStatus(occ.id, st);
      await svc.sync();
      expect([...os.pending.values()].some((p) => p.date === '2026-08-19')).toBe(false);
    }
    await w.occ.updateStatus(occ.id, 'pending');
    await svc.sync();
    expect(os.times().slice(0, 4)).toEqual(['12:00', '12:30', '13:00', '11:00']); // hoje 12:00/12:30/13:00 (11:00/11:30 já passaram), depois amanhã
  });

  it('sincronizar várias vezes não duplica nem faz trabalho desnecessário (idempotente)', async () => {
    const { w, os, svc } = setup();
    await lunchGoal(w);
    await svc.sync();
    const before = [...os.pending.keys()].sort();
    const calls = { s: os.scheduleCalls, c: os.cancelCalls };
    for (let i = 0; i < 5; i++) expect(await svc.sync()).toMatchObject({ scheduled: 0, cancelled: 0 });
    await Promise.all([svc.sync(), svc.sync(), svc.sync()]);
    expect([...os.pending.keys()].sort()).toEqual(before);
    expect(os.scheduleCalls).toBe(calls.s);
    expect(os.cancelCalls).toBe(calls.c);
  });

  it('cada ocorrência recorrente tem os próprios lembretes (ids únicos, sem colisão entre metas/dias)', async () => {
    const { w, svc } = setup();
    await lunchGoal(w);
    await w.goals.createGoal({ name: 'Jantar', schedule: { type: 'daily' }, activePeriod: PERIOD, notify: { ...LUNCH, time: '19:00' } });
    await w.goals.createGoal({ name: 'Remédio', schedule: { type: 'weekdays', weekdays: [1, 3] }, activePeriod: PERIOD, notify: { enabled: true, time: '08:00', beforeMin: 0, afterMin: 0, everyMin: 30 } });
    const plan = await svc.plan();
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
    const keys = new Set(plan.map((p) => p.occurrenceKey));
    expect(keys.size).toBe(7 + 7 + 1); // almoço 7 dias + jantar 7 + remédio só na segunda 24/08 (08:00 de hoje já passou)
    const remedio = plan.filter((p) => p.title === 'Remédio');
    expect(remedio.map((p) => p.date)).toEqual(['2026-08-24']);
  });

  it('metas com dias da semana só notificam nos dias certos', async () => {
    const { w, svc, at } = setup(new Date(2026, 7, 16, 7, 0)); // domingo
    at(7, 0, 16);
    await w.goals.createGoal({ name: 'Remédio', schedule: { type: 'weekdays', weekdays: [1, 3] }, activePeriod: PERIOD, notify: { enabled: true, time: '08:00', beforeMin: 0, afterMin: 0, everyMin: 30 } });
    expect((await svc.plan()).map((p) => p.date)).toEqual(['2026-08-17', '2026-08-19']);
  });

  it('editar o horário substitui os agendamentos (sem sobrar os antigos)', async () => {
    const { w, os, svc } = setup();
    const g = await lunchGoal(w);
    await svc.sync();
    const oldIds = new Set(os.pending.keys());
    await w.goals.editGoalThisAndFuture(g.id, '2026-08-19', { notify: { ...LUNCH, time: '13:00' } });
    const r = await svc.sync();
    expect(r.cancelled).toBe(35);
    expect(r.scheduled).toBe(35);
    expect([...os.pending.keys()].some((id) => oldIds.has(id))).toBe(false);
    expect(os.times().slice(0, 5)).toEqual(['12:00', '12:30', '13:00', '13:30', '14:00']);
  });

  it('renomear a meta atualiza o texto das notificações pendentes', async () => {
    const { w, os, svc } = setup();
    const g = await lunchGoal(w);
    await svc.sync();
    await w.goals.editGoalThisAndFuture(g.id, '2026-08-19', { name: 'Almoço com a família' });
    await svc.sync();
    expect(new Set([...os.pending.values()].map((p) => p.title))).toEqual(new Set(['Almoço com a família']));
  });

  it('desligar lembretes na meta, arquivar ou excluir cancela tudo; "remover só deste dia" cancela só aquele dia', async () => {
    const { w, os, svc } = setup();
    const g = await lunchGoal(w);
    await svc.sync();
    // remover só hoje
    const [occ] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    await w.occ.overrideOccurrence(occ.id, { isRemovedFromDate: true });
    await svc.sync();
    expect([...os.pending.values()].filter((p) => p.date === '2026-08-19')).toHaveLength(0);
    expect(os.pending.size).toBe(30);
    // desligar na meta
    await w.goals.editGoalThisAndFuture(g.id, '2026-08-19', { notify: { ...LUNCH, enabled: false } });
    await svc.sync();
    expect(os.pending.size).toBe(0);
    // religar e arquivar
    await w.goals.editGoalThisAndFuture(g.id, '2026-08-19', { notify: LUNCH });
    await svc.sync();
    expect(os.pending.size).toBeGreaterThan(0);
    await w.goals.archiveGoal(g.id);
    await svc.sync();
    expect(os.pending.size).toBe(0);
  });

  it('arquivar a meta-pai cancela os lembretes das submetas', async () => {
    const { w, os, svc } = setup();
    const { definition: pai } = await w.goals.createGoal({ name: 'Saúde', schedule: { type: 'custom', expression: 'container' }, activePeriod: PERIOD });
    await w.goals.addSubGoal(pai.id, { name: 'Remédio', schedule: { type: 'daily' }, activePeriod: PERIOD, notify: LUNCH });
    await svc.sync();
    expect(os.pending.size).toBe(35);
    await w.goals.archiveGoal(pai.id);
    await svc.sync();
    expect(os.pending.size).toBe(0);
  });

  it('remarcar meta única move os lembretes para a nova data', async () => {
    const { w, os, svc } = setup();
    await w.goals.createGoal({ name: 'Consulta', schedule: { type: 'once', date: '2026-08-20' }, activePeriod: PERIOD, notify: { enabled: true, time: '15:00', beforeMin: 60, afterMin: 0, everyMin: 30 } });
    await svc.sync();
    expect([...os.pending.values()].map((p) => p.date)).toEqual(Array(3).fill('2026-08-20'));
    const [occ] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-20');
    await w.occ.rescheduleOneTimeGoal(occ.id, '2026-08-22');
    await svc.sync();
    expect([...os.pending.values()].map((p) => p.date)).toEqual(Array(3).fill('2026-08-22'));
    expect(os.times()).toEqual(['14:00', '14:30', '15:00']);
  });

  it('reabrir/concluir em outro dia não mexe nos lembretes de outras ocorrências', async () => {
    const { w, os, svc } = setup();
    await lunchGoal(w);
    await svc.sync();
    const [tomorrow] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-20');
    await w.occ.updateStatus(tomorrow.id, 'completed');
    await svc.sync();
    const dates = [...os.pending.values()].map((p) => p.date);
    expect(dates.filter((d) => d === '2026-08-19')).toHaveLength(5);
    expect(dates.filter((d) => d === '2026-08-20')).toHaveLength(0);
    expect(dates.filter((d) => d === '2026-08-21')).toHaveLength(5);
  });
});

describe('configurações globais e limites do sistema', () => {
  it('interruptor geral desligado cancela tudo e não agenda; ligar de novo reagenda', async () => {
    const { w, os, svc } = setup();
    await lunchGoal(w);
    await svc.sync();
    expect(os.pending.size).toBe(35);
    svc.updateSettings({ enabled: false });
    expect(await svc.sync()).toMatchObject({ cancelled: 35, scheduled: 0 });
    expect(os.pending.size).toBe(0);
    svc.updateSettings({ enabled: true });
    await svc.sync();
    expect(os.pending.size).toBe(35);
  });

  it('sem permissão ou sem suporte (web) não agenda nem falha', async () => {
    const { w, os, svc } = setup();
    await lunchGoal(w);
    os.permission = 'denied';
    expect(await svc.sync()).toMatchObject({ skipped: 'no-permission' });
    expect(os.pending.size).toBe(0);
    os.permission = 'granted';
    os.supported = false;
    expect(await svc.sync()).toMatchObject({ skipped: 'unsupported' });
    expect((await svc.plan()).length).toBe(35); // a prévia continua funcionando na web
  });

  it('horário de silêncio (inclusive atravessando a meia-noite) descarta avisos dentro da janela', async () => {
    const { w, svc } = setup(new Date(2026, 7, 19, 6, 0), { quietHours: { enabled: true, start: '22:00', end: '07:00' }, horizonDays: 1 });
    await w.goals.createGoal({ name: 'Acordar', schedule: { type: 'daily' }, activePeriod: PERIOD, notify: { enabled: true, time: '07:00', beforeMin: 60, afterMin: 30, everyMin: 30 } });
    expect((await svc.plan()).map((p) => hhmm(p.fireAt))).toEqual(['07:00', '07:30']); // 06:00 e 06:30 caem no silêncio
  });

  it('teto por dia mantém os avisos mais próximos do horário; teto total limita o agendamento', async () => {
    const a = setup(new Date(2026, 7, 19, 8, 0), { maxPerDay: 3, horizonDays: 1 });
    await lunchGoal(a.w);
    expect((await a.svc.plan()).map((p) => hhmm(p.fireAt))).toEqual(['11:30', '12:00', '12:30']);
    const b = setup(new Date(2026, 7, 19, 8, 0), { maxTotal: 7 });
    await lunchGoal(b.w);
    expect((await b.svc.plan()).length).toBe(7);
  });

  it('horários no passado são ignorados; a janela respeita horizonDays', async () => {
    const { w, svc } = setup(new Date(2026, 7, 19, 12, 20), { horizonDays: 2 });
    await lunchGoal(w);
    const t = (await svc.plan()).map((p) => `${p.date} ${hhmm(p.fireAt)}`);
    expect(t.slice(0, 3)).toEqual(['2026-08-19 12:30', '2026-08-19 13:00', '2026-08-20 11:00']);
    expect(t.length).toBe(2 + 5);
  });

  it('o tempo andando sem abrir o app não reagenda: o sistema segue com o que foi agendado; ao reabrir, a janela é renovada', async () => {
    const { w, os, svc, at } = setup();
    await lunchGoal(w);
    await svc.sync();
    os.fireDue(new Date(2026, 7, 21, 23, 0)); // 2 dias depois, app nunca aberto
    expect(os.delivered.length).toBe(15);
    at(8, 0, 22);
    await svc.sync(); // reabriu
    expect(new Set([...os.pending.values()].map((p) => p.date)).size).toBe(7);
    expect(os.times()[0]).toBe('11:00');
  });
});

describe('validação no cadastro da meta', () => {
  it('lembrete exige dias definidos e configuração válida', async () => {
    const { w } = setup();
    await expect(w.goals.createGoal({ name: 'X', schedule: { type: 'quota', count: 3, per: 'week' }, activePeriod: PERIOD, notify: LUNCH })).rejects.toBeInstanceOf(GoalValidationError);
    await expect(w.goals.createGoal({ name: 'X', schedule: { type: 'daily' }, activePeriod: PERIOD, notify: { ...LUNCH, time: '99:99' } })).rejects.toBeInstanceOf(GoalValidationError);
    await expect(w.goals.createGoal({ name: 'X', schedule: { type: 'daily' }, activePeriod: PERIOD, notify: { ...LUNCH, enabled: false, time: 'lixo' } })).resolves.toBeTruthy(); // desligado não valida
  });

  it('o lembrete fica salvo na revisão e é preservado em edições que não o tocam', async () => {
    const { w } = setup();
    const g = await lunchGoal(w);
    await w.goals.editGoalThisAndFuture(g.id, '2026-08-19', { description: 'x' });
    expect((await w.goalRepo.getRevisionForDate(g.id, '2026-08-19'))?.notify).toEqual(LUNCH);
  });
});

/* ---------------- janelas independentes de lembretes (rotina real) ---------------- */
import { legacyToWindows, windowMinutes } from '../domain/notifications/reminderPlanner';

const W = (start: string, end: string, everyMin: number, id = start) => ({ id, start, end, everyMin });
const TREINAR: NotifyConfig = {
  enabled: true, time: '05:00', beforeMin: 0, afterMin: 0, everyMin: 30,
  plannedStart: '05:00', plannedEnd: '06:00',
  windows: [W('06:30', '09:00', 30), W('17:00', '23:00', 60)],
};

describe('janelas de lembretes: horário previsto é independente dos avisos', () => {
  it('Treinar: treina 05h–06h, avisa 06h30–09h e 17h–23h, nada entre 09h e 17h', async () => {
    const { w, os, svc } = setup(new Date(2026, 7, 19, 4, 0));
    await w.goals.createGoal({ name: 'Treinar', schedule: { type: 'daily' }, activePeriod: PERIOD, notify: TREINAR });
    await svc.sync();
    const today = [...os.pending.values()].filter((p) => p.date === '2026-08-19').sort((a, b) => a.fireAt - b.fireAt).map((p) => hhmm(p.fireAt));
    expect(today).toEqual(['06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00']);
    expect(today.some((t) => t > '09:00' && t < '17:00')).toBe(false);
    const first = [...os.pending.values()].find((p) => hhmm(p.fireAt) === '06:30' && p.date === '2026-08-19')!;
    expect(first.body).toMatch(/Ainda pendente · era para 05:00/);
  });

  it('registrar o treino de manhã cancela as duas janelas do dia; voltar a pendente recalcula só o que falta', async () => {
    const { w, os, svc, at } = setup(new Date(2026, 7, 19, 4, 0));
    await w.goals.createGoal({ name: 'Treinar', schedule: { type: 'daily' }, activePeriod: PERIOD, notify: TREINAR });
    await svc.sync();
    at(5, 50);
    const [occ] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    await w.occ.updateStatus(occ.id, 'completed');
    await svc.sync();
    expect([...os.pending.values()].some((p) => p.date === '2026-08-19')).toBe(false);
    expect([...os.pending.values()].filter((p) => p.date === '2026-08-20')).toHaveLength(13);
    at(10, 0);
    await w.occ.updateStatus(occ.id, 'pending');
    await svc.sync();
    expect([...os.pending.values()].filter((p) => p.date === '2026-08-19').map((p) => hhmm(p.fireAt)).sort()).toEqual(['17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00']);
  });

  it('Tratamento capilar: 05h–07h e 17h–23h, sem aviso no expediente', () => {
    const cfg: NotifyConfig = { enabled: true, time: '06:00', beforeMin: 0, afterMin: 0, everyMin: 30, plannedStart: '06:00', windows: [W('05:00', '07:00', 30), W('17:00', '23:00', 60)] };
    const t = describeReminderTimes(cfg);
    expect(t.slice(0, 5)).toEqual(['05:00', '05:30', '06:00', '06:30', '07:00']);
    expect(t.filter((x) => x > '07:00' && x < '17:00')).toEqual([]);
    expect(validateNotify(cfg)).toEqual([]);
  });

  it('Cortar cabelo (data única 17h30): três janelas, sem aviso duplicado onde duas se encontram (18h)', async () => {
    const cfg: NotifyConfig = {
      enabled: true, time: '17:30', beforeMin: 0, afterMin: 0, everyMin: 30, plannedStart: '17:30',
      windows: [W('07:00', '16:00', 120, 'a'), W('16:30', '18:00', 15, 'b'), W('18:00', '22:00', 60, 'c')],
    };
    const { w, os, svc } = setup(new Date(2026, 7, 19, 6, 0));
    await w.goals.createGoal({ name: 'Cortar cabelo', schedule: { type: 'once', date: '2026-08-20' }, activePeriod: PERIOD, notify: cfg });
    await svc.sync();
    const times = [...os.pending.values()].sort((a, b) => a.fireAt - b.fireAt).map((p) => hhmm(p.fireAt));
    expect(times).toEqual(['07:00', '09:00', '11:00', '13:00', '15:00', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45', '18:00', '19:00', '20:00', '21:00', '22:00']);
    expect(new Set(times).size).toBe(times.length);
    expect(new Set([...os.pending.keys()]).size).toBe(times.length);
    expect([...os.pending.values()].every((p) => p.date === '2026-08-20')).toBe(true);
    const at1730 = [...os.pending.values()].find((p) => hhmm(p.fireAt) === '17:30')!;
    expect(at1730.body).toMatch(/Está na hora/);
  });

  it('lembretes sem horário previsto (só janelas) e "dia inteiro" com frequência configurável', () => {
    const cfg: NotifyConfig = { enabled: true, time: '09:00', beforeMin: 0, afterMin: 0, everyMin: 30, plannedStart: null, windows: [W('08:00', '20:00', 180)] };
    expect(describeReminderTimes(cfg)).toEqual(['08:00', '11:00', '14:00', '17:00', '20:00']);
    expect(windowMinutes([W('00:00', '23:59', 240)])).toEqual([0, 240, 480, 720, 960, 1200]);
  });

  it('janelas que se sobrepõem não duplicam e a ordem das janelas não importa', () => {
    const a = windowMinutes([W('09:00', '10:00', 30), W('09:30', '11:00', 30, 'x')]);
    const b = windowMinutes([W('09:30', '11:00', 30, 'x'), W('09:00', '10:00', 30)]);
    expect(a).toEqual([540, 570, 600, 630, 660]);
    expect(b).toEqual(a);
  });

  it('validação das janelas: fim antes do início, frequência fora do limite, excesso de avisos, janela de um instante só', () => {
    const base: NotifyConfig = { enabled: true, time: '09:00', beforeMin: 0, afterMin: 0, everyMin: 30 };
    expect(validateNotify({ ...base, windows: [W('10:00', '09:00', 30)] }).join(' ')).toMatch(/depois do início/);
    expect(validateNotify({ ...base, windows: [W('09:00', '10:00', 2)] }).join(' ')).toMatch(/frequência/);
    expect(validateNotify({ ...base, windows: [W('00:00', '23:59', 5)] }).join(' ')).toMatch(/Muitos avisos/);
    expect(validateNotify({ ...base, windows: [W('09:00', '09:00', 30)] })).toEqual([]);
    expect(validateNotify({ ...base, windows: [W('09:00', '10:00', 30)], plannedStart: '08:00', plannedEnd: '07:00' }).join(' ')).toMatch(/fim do horário previsto/);
  });

  it('metas no formato antigo continuam iguais e podem ser convertidas em janelas', () => {
    expect(describeReminderTimes(LUNCH)).toEqual(['11:00', '11:30', '12:00', '12:30', '13:00']);
    const ws = legacyToWindows(LUNCH);
    expect(ws).toHaveLength(1);
    expect(windowMinutes(ws)).toEqual([660, 690, 720, 750, 780]);
  });

  it('o silêncio noturno global e o teto por dia continuam valendo sobre as janelas', async () => {
    const { w, os, svc } = setup(new Date(2026, 7, 19, 4, 0), { quietHours: { enabled: true, start: '22:00', end: '07:00' }, maxPerDay: 5 });
    await w.goals.createGoal({ name: 'Treinar', schedule: { type: 'daily' }, activePeriod: PERIOD, notify: TREINAR });
    await svc.sync();
    const today = [...os.pending.values()].filter((p) => p.date === '2026-08-19');
    expect(today.length).toBeLessThanOrEqual(5);
    expect(today.every((p) => hhmm(p.fireAt) >= '07:00' && hhmm(p.fireAt) < '22:00')).toBe(true);
  });
});
