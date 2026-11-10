import { TrackingCycleRule, Weekday } from '../types';
import { addDays, diffDays, formatLocalDate, parseLocalDate } from '../dates';

export type CycleWindow = {
  startAt: string; // YYYY-MM-DD
  endAt: string;   // YYYY-MM-DD
  cycleKey: string;
};

/**
 * Calculates the cycle start and end dates for a given reference date.
 */
export function getCycleWindow(
  dateStr: string,
  cycleRule: TrackingCycleRule,
  goalId: string,
  revisionId: string
): CycleWindow {
  const refDate = parseLocalDate(dateStr);

  switch (cycleRule.type) {
    case 'single': {
      return {
        startAt: dateStr,
        endAt: dateStr,
        cycleKey: `${goalId}_single_${dateStr}`,
      };
    }

    case 'daily': {
      return {
        startAt: dateStr,
        endAt: dateStr,
        cycleKey: `${goalId}_daily_${dateStr}`,
      };
    }

    case 'weekly': {
      const weekStartsOn = cycleRule.weekStartsOn ?? 1; // Default Monday (1)
      const currentDay = refDate.getDay() as Weekday;

      // Distance back to week start
      let diff = (currentDay - weekStartsOn + 7) % 7;
      const startDate = new Date(refDate);
      startDate.setDate(refDate.getDate() - diff);

      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      const startAt = formatLocalDate(startDate);
      const endAt = formatLocalDate(endDate);

      return {
        startAt,
        endAt,
        cycleKey: `${goalId}_weekly_${startAt}_${endAt}`,
      };
    }

    case 'monthly': {
      const year = refDate.getFullYear();
      const month = refDate.getMonth();

      const startDate = new Date(year, month, 1, 12);
      const endDate = new Date(year, month + 1, 0, 12); // Last day of month

      const startAt = formatLocalDate(startDate);
      const endAt = formatLocalDate(endDate);

      return {
        startAt,
        endAt,
        cycleKey: `${goalId}_monthly_${startAt}_${endAt}`,
      };
    }

    case 'annual': {
      const year = refDate.getFullYear();
      const startAt = `${year}-01-01`;
      const endAt = `${year}-12-31`;

      return {
        startAt,
        endAt,
        cycleKey: `${goalId}_annual_${year}`,
      };
    }

    case 'custom': {
      // Janelas consecutivas de `duration` unidades a partir da âncora.
      const stepDays = cycleRule.unit === 'day' ? cycleRule.duration : cycleRule.unit === 'week' ? cycleRule.duration * 7 : 0;
      if (cycleRule.unit === 'month') {
        const anchor = parseLocalDate(cycleRule.anchorDate);
        const months =
          (refDate.getFullYear() - anchor.getFullYear()) * 12 + (refDate.getMonth() - anchor.getMonth());
        let idx = Math.floor(months / cycleRule.duration);
        let start = new Date(anchor.getFullYear(), anchor.getMonth() + idx * cycleRule.duration, anchor.getDate(), 12);
        if (formatLocalDate(start) > dateStr) {
          idx -= 1;
          start = new Date(anchor.getFullYear(), anchor.getMonth() + idx * cycleRule.duration, anchor.getDate(), 12);
        }
        const next = new Date(start.getFullYear(), start.getMonth() + cycleRule.duration, start.getDate(), 12);
        const startAt = formatLocalDate(start);
        const endAt = addDays(formatLocalDate(next), -1);
        return { startAt, endAt, cycleKey: `${goalId}_custom_${startAt}_${endAt}` };
      }
      const size = Math.max(1, stepDays);
      const elapsed = diffDays(cycleRule.anchorDate, dateStr);
      const idx = Math.floor(elapsed / size);
      const startAt = addDays(cycleRule.anchorDate, idx * size);
      const endAt = addDays(startAt, size - 1);
      return { startAt, endAt, cycleKey: `${goalId}_custom_${startAt}_${endAt}` };
    }

    default:
      return {
        startAt: dateStr,
        endAt: dateStr,
        cycleKey: `${goalId}_default_${dateStr}`,
      };
  }
}
