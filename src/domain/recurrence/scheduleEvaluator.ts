import { ActivePeriod, ScheduleRule, Weekday } from '../types';

export { parseLocalDate, formatLocalDate, getWeekday } from '../dates';
import { parseLocalDate, formatLocalDate, getWeekday, diffDays } from '../dates';

/**
 * Checks if a date falls strictly within the active period [startDate, endDate].
 */
export function isDateWithinActivePeriod(dateStr: string, activePeriod: ActivePeriod): boolean {
  if (dateStr < activePeriod.startDate) return false;
  if (activePeriod.endDate && dateStr > activePeriod.endDate) return false;
  return true;
}

/**
 * Evaluates whether a ScheduleRule expects an occurrence on dateStr.
 */
export function scheduleMatchesDate(
  dateStr: string,
  schedule: ScheduleRule,
  activePeriod: ActivePeriod
): boolean {
  if (!isDateWithinActivePeriod(dateStr, activePeriod)) {
    return false;
  }

  switch (schedule.type) {
    case 'once': {
      return schedule.date === dateStr;
    }

    case 'daily': {
      return true;
    }

    case 'weekdays': {
      const dayOfWeek = getWeekday(dateStr);
      return schedule.weekdays.includes(dayOfWeek);
    }

    case 'interval': {
      const anchor = parseLocalDate(schedule.anchorDate);
      const target = parseLocalDate(dateStr);

      if (target < anchor) return false;

      const elapsedDays = diffDays(schedule.anchorDate, dateStr);

      if (schedule.unit === 'day') {
        return elapsedDays >= 0 && elapsedDays % schedule.every === 0;
      }
      if (schedule.unit === 'week') {
        const elapsedWeeks = Math.floor(elapsedDays / 7);
        return elapsedDays % 7 === 0 && elapsedWeeks % schedule.every === 0;
      }
      if (schedule.unit === 'month') {
        const yearDiff = target.getFullYear() - anchor.getFullYear();
        const monthDiff = yearDiff * 12 + (target.getMonth() - anchor.getMonth());
        return target.getDate() === anchor.getDate() && monthDiff >= 0 && monthDiff % schedule.every === 0;
      }
      return false;
    }

    case 'monthlyDate': {
      const target = parseLocalDate(dateStr);
      const maxDaysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();

      if (schedule.dayOfMonth > maxDaysInMonth) {
        // Policy A17: If requested day (e.g. 31st) exceeds days in month (e.g. Feb 28), skip that month without crashing
        return false;
      }

      return target.getDate() === schedule.dayOfMonth;
    }

    case 'monthlyNthWeekday': {
      const target = parseLocalDate(dateStr);
      const dayOfWeek = target.getDay() as Weekday;
      if (dayOfWeek !== schedule.weekday) return false;

      const dayOfMonth = target.getDate();
      const nth = Math.ceil(dayOfMonth / 7);

      if (schedule.ordinal === -1) {
        // Last weekday of month
        const nextWeekDate = new Date(target);
        nextWeekDate.setDate(target.getDate() + 7);
        return nextWeekDate.getMonth() !== target.getMonth();
      }

      return nth === schedule.ordinal;
    }

    case 'annual': {
      const target = parseLocalDate(dateStr);
      return target.getMonth() + 1 === schedule.month && target.getDate() === schedule.day;
    }

    case 'quota': {
      // Frequência flexível (ex.: 3x/semana) NÃO cria datas fixas; o esperado é uma contagem por ciclo.
      // Os dias em que o usuário pode registrar uma execução são tratados por isQuotaAvailableOn().
      return false;
    }

    case 'custom': {
      return false;
    }

    default:
      return false;
  }
}

/**
 * Returns all expected YYYY-MM-DD dates in a range [startDate, endDate] matching schedule.
 */
export function getExpectedDates(
  startDateStr: string,
  endDateStr: string,
  schedule: ScheduleRule,
  activePeriod: ActivePeriod
): string[] {
  const dates: string[] = [];
  let current = parseLocalDate(startDateStr);
  const end = parseLocalDate(endDateStr);

  while (current <= end) {
    const currentStr = formatLocalDate(current);
    if (scheduleMatchesDate(currentStr, schedule, activePeriod)) {
      dates.push(currentStr);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/** Dias em que uma meta de frequência flexível pode receber uma execução (dentro do período ativo). */
export function isQuotaAvailableOn(
  dateStr: string,
  schedule: ScheduleRule,
  activePeriod: ActivePeriod
): boolean {
  return schedule.type === 'quota' && isDateWithinActivePeriod(dateStr, activePeriod);
}
