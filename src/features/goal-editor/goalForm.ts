import {
  ActivePeriod,
  AggregationRule,
  CompletionRule,
  GoalRevision,
  NotifyConfig,
  ProgressRule,
  ScheduleRule,
  TrackingCycleRule,
  Weekday,
} from '../../domain/types';
import { addDays, todayLocal } from '../../domain/dates';
import { DEFAULT_NOTIFY } from '../../domain/notifications/reminderPlanner';
import { DEFAULT_ICON } from '../../shared/icons/registry';
import { GoalValidationError, validateGoalDraft } from '../../domain/goals/goalValidation';
import { isQuotaAvailableOn, scheduleMatchesDate } from '../../domain/recurrence/scheduleEvaluator';

/** Tipos de repetição oferecidos na UI (todos mapeiam 1:1 para ScheduleRule da engine). */
export type ScheduleKind = 'weekdays' | 'daily' | 'once' | 'quota' | 'interval' | 'monthlyDate' | 'container';

export type GoalFormState = {
  name: string;
  description: string;
  parentId: string | null;
  icon: string;
  color: string;
  scheduleKind: ScheduleKind;
  weekdays: Weekday[];
  onceDate: string;
  quotaCount: string;
  quotaPer: 'day' | 'week' | 'month';
  intervalEvery: string;
  intervalUnit: 'day' | 'week' | 'month';
  monthlyDay: string;
  startDate: string;
  endDate: string;
  cycleType: 'daily' | 'weekly' | 'monthly' | 'annual';
  weekStartsOn: Weekday;
  progressType: 'binary' | 'quantity';
  quantityTarget: string;
  quantityUnit: string;
  completionType: 'allRequired' | 'minimumCount' | 'minimumPercentage';
  minCount: string;
  minPct: string;
  isRequired: boolean;
  showParentOnHome: boolean;
  aggregationType: 'scheduledOccurrences' | 'directChildren';
  childWeights: Record<string, string>;
  notify: NotifyConfig;
};

export function emptyForm(parentId: string | null, today = todayLocal()): GoalFormState {
  return {
    name: '',
    description: '',
    parentId,
    icon: DEFAULT_ICON,
    color: '#C8DA7A',
    scheduleKind: 'weekdays',
    weekdays: [1, 3, 5],
    onceDate: today,
    quotaCount: '3',
    quotaPer: 'week',
    intervalEvery: '2',
    intervalUnit: 'day',
    monthlyDay: '1',
    startDate: today,
    endDate: '',
    cycleType: 'weekly',
    weekStartsOn: 1,
    progressType: 'binary',
    quantityTarget: '1',
    quantityUnit: '',
    completionType: 'allRequired',
    minCount: '1',
    minPct: '80',
    isRequired: true,
    showParentOnHome: true,
    aggregationType: 'scheduledOccurrences',
    childWeights: {},
    notify: { ...DEFAULT_NOTIFY },
  };
}

/** Ciclo sugerido para cada tipo de agenda (o usuário pode trocar em "Opções avançadas"). */
export function suggestedCycle(kind: ScheduleKind, quotaPer: GoalFormState['quotaPer'] = 'week'): GoalFormState['cycleType'] {
  switch (kind) {
    case 'weekdays':
    case 'container':
      return 'weekly';
    case 'quota':
      return quotaPer === 'day' ? 'daily' : quotaPer === 'month' ? 'monthly' : 'weekly';
    case 'monthlyDate':
      return 'monthly';
    default:
      return 'daily';
  }
}

export function formFromRevision(rev: GoalRevision, base = emptyForm(rev.parentId)): GoalFormState {
  const f: GoalFormState = {
    ...base,
    name: rev.name,
    description: rev.description ?? '',
    parentId: rev.parentId,
    icon: rev.icon ?? DEFAULT_ICON,
    color: rev.colorToken ?? '#C8DA7A',
    startDate: rev.activePeriod.startDate,
    endDate: rev.activePeriod.endDate ?? '',
    isRequired: rev.isRequired,
    showParentOnHome: rev.showParentOnHome,
    cycleType: (['daily', 'weekly', 'monthly', 'annual'] as const).includes(rev.trackingCycle.type as never)
      ? (rev.trackingCycle.type as GoalFormState['cycleType'])
      : 'weekly',
    weekStartsOn: rev.trackingCycle.type === 'weekly' ? rev.trackingCycle.weekStartsOn : 1,
    notify: rev.notify ? { ...rev.notify } : { ...DEFAULT_NOTIFY },
  };
  const s = rev.schedule;
  switch (s.type) {
    case 'weekdays':
      f.scheduleKind = 'weekdays';
      f.weekdays = [...s.weekdays];
      break;
    case 'daily':
      f.scheduleKind = 'daily';
      break;
    case 'once':
      f.scheduleKind = 'once';
      f.onceDate = s.date;
      break;
    case 'quota':
      f.scheduleKind = 'quota';
      f.quotaCount = String(s.count);
      f.quotaPer = s.per === 'year' ? 'month' : s.per;
      break;
    case 'interval':
      f.scheduleKind = 'interval';
      f.intervalEvery = String(s.every);
      f.intervalUnit = s.unit;
      break;
    case 'monthlyDate':
      f.scheduleKind = 'monthlyDate';
      f.monthlyDay = String(s.dayOfMonth);
      break;
    default:
      f.scheduleKind = 'container';
  }
  if (rev.progressRule.type === 'quantity') {
    f.progressType = 'quantity';
    f.quantityTarget = String(rev.progressRule.target);
    f.quantityUnit = rev.progressRule.unit;
  }
  const c = rev.completionRule;
  if (c.type === 'minimumCount') {
    f.completionType = 'minimumCount';
    f.minCount = String(c.count);
  } else if (c.type === 'minimumPercentage') {
    f.completionType = 'minimumPercentage';
    f.minPct = String(c.percentage);
  }
  if (rev.aggregationRule.type === 'directChildren') {
    f.aggregationType = 'directChildren';
    f.childWeights = Object.fromEntries(Object.entries(rev.aggregationRule.childWeights ?? {}).map(([k, v]) => [k, String(v)]));
  }
  return f;
}

const num = (v: string) => Number(String(v).replace(',', '.'));

export type GoalDraftValues = {
  name: string;
  description: string | undefined;
  parentId: string | null;
  icon: string;
  colorToken: string;
  activePeriod: ActivePeriod;
  schedule: ScheduleRule;
  trackingCycle: TrackingCycleRule;
  progressRule: ProgressRule;
  completionRule: CompletionRule;
  aggregationRule: AggregationRule;
  isRequired: boolean;
  showParentOnHome: boolean;
  notify: NotifyConfig | null;
};

/** Converte o formulário em valores da engine. TUDO que o formulário expõe é aplicado aqui. */
export function toDraft(f: GoalFormState): GoalDraftValues {
  let schedule: ScheduleRule;
  switch (f.scheduleKind) {
    case 'weekdays':
      schedule = { type: 'weekdays', weekdays: [...f.weekdays].sort() as Weekday[] };
      break;
    case 'daily':
      schedule = { type: 'daily' };
      break;
    case 'once':
      schedule = { type: 'once', date: f.onceDate };
      break;
    case 'quota':
      schedule = { type: 'quota', count: Math.trunc(num(f.quotaCount)), per: f.quotaPer };
      break;
    case 'interval':
      schedule = { type: 'interval', every: Math.trunc(num(f.intervalEvery)), unit: f.intervalUnit, anchorDate: f.startDate };
      break;
    case 'monthlyDate':
      schedule = { type: 'monthlyDate', dayOfMonth: Math.trunc(num(f.monthlyDay)) };
      break;
    default:
      schedule = { type: 'custom', expression: 'container' };
  }

  // Meta única: o período precisa conter o dia escolhido.
  let start = f.startDate;
  let end: string | null = f.endDate.trim() || null;
  if (f.scheduleKind === 'once' && f.onceDate) {
    if (!start || f.onceDate < start) start = f.onceDate;
    if (end && end < f.onceDate) end = f.onceDate;
  }

  const completionRule: CompletionRule =
    f.completionType === 'minimumCount'
      ? { type: 'minimumCount', count: Math.trunc(num(f.minCount)) }
      : f.completionType === 'minimumPercentage'
        ? { type: 'minimumPercentage', percentage: num(f.minPct) }
        : { type: 'allRequired' };

  const aggregationRule: AggregationRule =
    f.aggregationType === 'directChildren'
      ? {
          type: 'directChildren',
          weightMode: Object.keys(f.childWeights).length ? 'custom' : 'equal',
          optionalContribution: 'include',
          childWeights: Object.fromEntries(
            Object.entries(f.childWeights)
              .map(([k, v]) => [k, num(v)] as const)
              .filter(([, v]) => Number.isFinite(v) && v > 0)
          ),
        }
      : { type: 'scheduledOccurrences', depth: 'direct', weightMode: 'equal' };

  return {
    name: f.name.trim(),
    description: f.description.trim() || undefined,
    parentId: f.parentId,
    icon: f.icon,
    colorToken: f.color,
    activePeriod: { startDate: start, endDate: end },
    schedule,
    trackingCycle: { type: f.cycleType, ...(f.cycleType === 'weekly' ? { weekStartsOn: f.weekStartsOn } : {}) } as TrackingCycleRule,
    progressRule:
      f.progressType === 'quantity'
        ? { type: 'quantity', target: num(f.quantityTarget), unit: f.quantityUnit.trim() }
        : { type: 'binary' },
    completionRule,
    aggregationRule,
    isRequired: f.isRequired,
    showParentOnHome: f.showParentOnHome,
    notify: f.notify.enabled ? { ...f.notify, enabled: true } : null,
  };
}

export function validateForm(f: GoalFormState): string[] {
  const d = toDraft(f);
  const errors = validateGoalDraft({
    name: d.name,
    activePeriod: d.activePeriod,
    schedule: d.schedule,
    trackingCycle: d.trackingCycle,
    progressRule: d.progressRule,
    completionRule: d.completionRule,
    notify: d.notify,
  });
  if (f.aggregationType === 'directChildren') {
    for (const v of Object.values(f.childWeights)) {
      const n = num(v);
      if (v.trim() !== '' && !(Number.isFinite(n) && n > 0)) {
        errors.push('Os pesos das submetas devem ser números maiores que zero.');
        break;
      }
    }
  }
  return errors;
}

export { GoalValidationError };

/** Prévia: próximas datas em que a meta aparece, usando EXATAMENTE a engine de recorrência do app. */
export function previewDates(f: GoalFormState, from = todayLocal(), limit = 6, horizonDays = 120): string[] {
  const d = toDraft(f);
  if (validateForm(f).length > 0 && !d.name) {
    // nome vazio não impede a prévia da agenda
  }
  const out: string[] = [];
  const start = d.activePeriod.startDate && d.activePeriod.startDate > from ? d.activePeriod.startDate : from;
  for (let i = 0; i < horizonDays && out.length < limit; i++) {
    const date = addDays(start, i);
    if (scheduleMatchesDate(date, d.schedule, d.activePeriod)) out.push(date);
  }
  return out;
}

export function previewIsFlexible(f: GoalFormState): boolean {
  const d = toDraft(f);
  return isQuotaAvailableOn(f.startDate || todayLocal(), d.schedule, { startDate: '0000-01-01', endDate: null });
}
