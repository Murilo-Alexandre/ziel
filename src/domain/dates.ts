// Utilitários de data de calendário (YYYY-MM-DD) sem dependência de fuso horário.
// Datas de agenda são "datas de calendário", nunca instantes UTC: nunca use toISOString() para elas.

import { Weekday } from './types';

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((p) => parseInt(p, 10));
  return new Date(y, m - 1, d, 12, 0, 0, 0); // meio-dia evita saltos de horário de verão
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Data de hoje no fuso local do dispositivo (não UTC). */
export function todayLocal(now: Date = new Date()): string {
  return formatLocalDate(now);
}

export function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

export function diffDays(fromStr: string, toStr: string): number {
  const a = parseLocalDate(fromStr).getTime();
  const b = parseLocalDate(toStr).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function getWeekday(dateStr: string): Weekday {
  return parseLocalDate(dateStr).getDay() as Weekday;
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return formatLocalDate(parseLocalDate(value)) === value;
}

export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}
