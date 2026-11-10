import { GoalDefinition, GoalRevision, NotifyConfig, Occurrence } from '../types';
import { addDays, formatLocalDate } from '../dates';
import { pickRevisionForDate } from '../goals/revisions';
import { scheduleMatchesDate } from '../recurrence/scheduleEvaluator';
import { computeOccurrenceKey } from '../recurrence/occurrenceGenerator';

export type NotificationSettings = {
  /** Interruptor geral: desligado, nada é agendado e o que estava pendente é cancelado. */
  enabled: boolean;
  quietHours: { enabled: boolean; start: string; end: string };
  /** Teto de avisos por dia (evita excesso). */
  maxPerDay: number;
  /** Quantos dias à frente são agendados (janela rolante, renovada a cada abertura do app). */
  horizonDays: number;
  /** Teto total de agendamentos pendentes (o Android limita alarmes por app). */
  maxTotal: number;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  quietHours: { enabled: false, start: '22:00', end: '07:00' },
  maxPerDay: 12,
  horizonDays: 7,
  maxTotal: 120,
};

export const MAX_REMINDERS_PER_OCCURRENCE = 12;
export const DEFAULT_NOTIFY: NotifyConfig = { enabled: false, time: '09:00', beforeMin: 0, afterMin: 0, everyMin: 30 };

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function timeToMinutes(t: string): number {
  const m = TIME_RE.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

export function minutesToTime(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Deslocamentos (min) em relação ao horário estimado: -antes, ..., 0, ..., +depois, de `every` em `every`. */
export function reminderOffsets(cfg: Pick<NotifyConfig, 'beforeMin' | 'afterMin' | 'everyMin'>): number[] {
  if (cfg.beforeMin === 0 && cfg.afterMin === 0) return [0];
  const out: number[] = [];
  const step = Math.max(1, Math.floor(cfg.everyMin));
  for (let off = -cfg.beforeMin; off <= cfg.afterMin; off += step) out.push(off);
  if (!out.includes(0)) {
    // o horário estimado sempre recebe aviso, mesmo se a grade do intervalo "pular" o zero
    out.push(0);
    out.sort((a, b) => a - b);
  }
  return out;
}

/** Horários "HH:mm" em que a meta avisa (para prévia no editor). */
export function describeReminderTimes(cfg: NotifyConfig): string[] {
  const base = timeToMinutes(cfg.time);
  if (!Number.isFinite(base)) return [];
  return reminderOffsets(cfg).map((o) => minutesToTime(base + o));
}

export function validateNotify(cfg: NotifyConfig): string[] {
  const e: string[] = [];
  if (!TIME_RE.test(cfg.time)) e.push('Informe o horário estimado do lembrete (HH:mm).');
  const ints = [cfg.beforeMin, cfg.afterMin, cfg.everyMin].every((n) => Number.isInteger(n));
  if (!ints) e.push('Os minutos dos lembretes devem ser números inteiros.');
  else {
    if (cfg.beforeMin < 0 || cfg.beforeMin > 720) e.push('"Antes" deve ficar entre 0 e 720 minutos.');
    if (cfg.afterMin < 0 || cfg.afterMin > 720) e.push('"Depois" deve ficar entre 0 e 720 minutos.');
    if ((cfg.beforeMin > 0 || cfg.afterMin > 0) && (cfg.everyMin < 5 || cfg.everyMin > 240)) e.push('O intervalo deve ficar entre 5 e 240 minutos.');
    if (e.length === 0 && reminderOffsets(cfg).length > MAX_REMINDERS_PER_OCCURRENCE) {
      e.push(`Muitos lembretes por ocorrência (máximo ${MAX_REMINDERS_PER_OCCURRENCE}). Aumente o intervalo ou reduza a janela.`);
    }
  }
  return e;
}

/** Id numérico (31 bits) estável derivado de uma chave: mesma chave => mesmo id (agendamento idempotente). */
export function reminderId(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) & 0x7fffffff) || 1;
}

export type PlannedReminder = {
  id: number;
  fireAt: number; // epoch ms
  title: string;
  body: string;
  goalId: string;
  occurrenceKey: string;
  date: string;
  offsetMin: number;
};

function localDateTime(date: string, hhmm: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function inQuietHours(at: Date, q: NotificationSettings['quietHours']): boolean {
  if (!q.enabled) return false;
  const cur = at.getHours() * 60 + at.getMinutes();
  const s = timeToMinutes(q.start);
  const e = timeToMinutes(q.end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || s === e) return false;
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

function humanDelta(min: number): string {
  const a = Math.abs(min);
  if (a < 60) return `${a} min`;
  const h = Math.floor(a / 60);
  const r = a % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export type PlanInput = {
  now: Date;
  /** Metas visíveis (não arquivadas, nem filhas de arquivadas). */
  goals: GoalDefinition[];
  revisionsByGoal: Map<string, GoalRevision[]>;
  /** Ocorrências já materializadas no período (status/exceções). Ausente = pendente. */
  occurrences: Occurrence[];
  settings: NotificationSettings;
};

/**
 * Planeja, de forma pura, todos os lembretes futuros dentro da janela.
 * Regras: só ocorrências AINDA PENDENTES (concluir/parcial/não realizado cancela); exceção "remover do dia" cancela;
 * cada ocorrência tem seus próprios ids (sem duplicar); horário no passado é ignorado; silêncio noturno, teto por dia e teto total.
 */
export function planReminders(input: PlanInput): PlannedReminder[] {
  const { now, goals, revisionsByGoal, occurrences, settings } = input;
  if (!settings.enabled) return [];
  const occByKey = new Map(occurrences.map((o) => [o.occurrenceKey, o]));
  const startDate = formatLocalDate(now);
  const planned: PlannedReminder[] = [];
  const usedIds = new Set<number>();

  for (let i = 0; i < settings.horizonDays; i++) {
    const date = addDays(startDate, i);
    const perDay: PlannedReminder[] = [];
    for (const g of goals) {
      const rev = pickRevisionForDate(revisionsByGoal.get(g.id) ?? [], date);
      const cfg = rev?.notify;
      if (!rev || !cfg?.enabled || validateNotify(cfg).length) continue;
      if (!scheduleMatchesDate(date, rev.schedule, rev.activePeriod)) continue;

      const key = computeOccurrenceKey(g.id, date, 'default');
      const occ = occByKey.get(key);
      if (occ && (occ.status !== 'pending' || occ.overrideData?.isRemovedFromDate)) continue;

      const time = occ?.overrideData?.scheduledTime && TIME_RE.test(occ.overrideData.scheduledTime) ? occ.overrideData.scheduledTime : cfg.time;
      const base = localDateTime(date, time);
      const name = occ?.overrideData?.name ?? rev.name;

      for (const off of reminderOffsets(cfg)) {
        const at = new Date(base.getTime() + off * 60_000);
        if (at.getTime() <= now.getTime() + 2_000) continue;
        if (inQuietHours(at, settings.quietHours)) continue;
        const body = off < 0 ? `Em ${humanDelta(off)} · ${time}` : off === 0 ? `Está na hora · ${time}` : `Ainda pendente · era para ${time}`;
        let id = reminderId(`${key}|${off}|${at.getTime()}|${name}|${body}`);
        while (usedIds.has(id)) id = ((id + 1) & 0x7fffffff) || 1;
        usedIds.add(id);
        perDay.push({ id, fireAt: at.getTime(), title: name, body, goalId: g.id, occurrenceKey: key, date, offsetMin: off });
      }
    }
    // teto por dia: prioriza o horário exato e os avisos mais próximos dele
    perDay.sort((a, b) => Math.abs(a.offsetMin) - Math.abs(b.offsetMin) || a.fireAt - b.fireAt);
    planned.push(...perDay.slice(0, Math.max(1, settings.maxPerDay)));
  }

  planned.sort((a, b) => a.fireAt - b.fireAt);
  return planned.slice(0, Math.max(1, settings.maxTotal));
}
