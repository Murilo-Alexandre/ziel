import { ActivePeriod, CompletionRule, NotifyConfig, ProgressRule, ScheduleRule, TrackingCycleRule } from '../types';
import { validateNotify } from '../notifications/reminderPlanner';
import { isValidDateString } from '../dates';

export type GoalDraft = {
  name: string;
  activePeriod: ActivePeriod;
  schedule: ScheduleRule;
  trackingCycle: TrackingCycleRule;
  progressRule: ProgressRule;
  completionRule: CompletionRule;
  notify?: NotifyConfig | null;
};

export class GoalValidationError extends Error {
  constructor(public readonly messages: string[]) {
    super(messages.join(' '));
    this.name = 'GoalValidationError';
  }
}

/** Regras de consistência de uma meta. Devolve mensagens em português (vazio = válida). */
export function validateGoalDraft(d: GoalDraft): string[] {
  const errors: string[] = [];

  if (!d.name || !d.name.trim()) errors.push('Dê um nome à meta.');
  if (d.name && d.name.trim().length > 120) errors.push('O nome pode ter no máximo 120 caracteres.');

  if (!isValidDateString(d.activePeriod.startDate)) errors.push('Informe uma data de início válida.');
  if (d.activePeriod.endDate) {
    if (!isValidDateString(d.activePeriod.endDate)) errors.push('Informe uma data de término válida.');
    else if (d.activePeriod.endDate < d.activePeriod.startDate) errors.push('O término não pode ser antes do início.');
  }

  const s = d.schedule;
  switch (s.type) {
    case 'once':
      if (!isValidDateString(s.date)) errors.push('Escolha o dia da meta única.');
      else {
        if (s.date < d.activePeriod.startDate) errors.push('O dia da meta única não pode ser antes do início.');
        if (d.activePeriod.endDate && s.date > d.activePeriod.endDate) errors.push('O dia da meta única está depois do término.');
      }
      break;
    case 'weekdays':
      if (s.weekdays.length === 0) errors.push('Selecione pelo menos um dia da semana.');
      break;
    case 'interval':
      if (!Number.isInteger(s.every) || s.every < 1) errors.push('O intervalo deve ser de pelo menos 1.');
      if (!isValidDateString(s.anchorDate)) errors.push('O intervalo precisa de uma data de referência válida.');
      break;
    case 'monthlyDate':
      if (!Number.isInteger(s.dayOfMonth) || s.dayOfMonth < 1 || s.dayOfMonth > 31) errors.push('Escolha um dia do mês entre 1 e 31.');
      break;
    case 'monthlyNthWeekday':
      if (![1, 2, 3, 4, 5, -1].includes(s.ordinal)) errors.push('Posição do dia da semana inválida.');
      break;
    case 'annual':
      if (s.month < 1 || s.month > 12 || s.day < 1 || s.day > 31) errors.push('Data anual inválida.');
      break;
    case 'quota':
      if (!Number.isInteger(s.count) || s.count < 1) errors.push('A frequência deve ser de pelo menos 1 vez.');
      break;
    default:
      break;
  }

  if (d.progressRule.type === 'quantity') {
    if (!(d.progressRule.target > 0)) errors.push('A quantidade-alvo deve ser maior que zero.');
    if (!d.progressRule.unit.trim()) errors.push('Informe a unidade da quantidade (ex.: L, km, páginas).');
  }

  if (d.completionRule.type === 'minimumCount' && !(d.completionRule.count >= 1)) {
    errors.push('A quantidade mínima deve ser de pelo menos 1.');
  }
  if (d.completionRule.type === 'minimumPercentage' && !(d.completionRule.percentage > 0 && d.completionRule.percentage <= 100)) {
    errors.push('A porcentagem mínima deve estar entre 1 e 100.');
  }

  if (d.trackingCycle.type === 'custom' && !(d.trackingCycle.duration >= 1)) {
    errors.push('O ciclo personalizado precisa de uma duração de pelo menos 1.');
  }

  if (d.notify?.enabled) {
    errors.push(...validateNotify(d.notify));
    if (d.schedule.type === 'quota' || d.schedule.type === 'custom') {
      errors.push('Lembretes precisam de dias definidos: use dias da semana, todo dia, data única, intervalo ou dia do mês.');
    }
  }

  return errors;
}
