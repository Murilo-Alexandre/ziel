import { describe, it, expect } from 'vitest';
import { addDays, diffDays, formatLocalDate, isValidDateString, todayLocal } from '../domain/dates';
import { getCycleWindow } from '../domain/recurrence/cycleEvaluator';
import { getExpectedDates, scheduleMatchesDate } from '../domain/recurrence/scheduleEvaluator';

/**
 * Datas de agenda são datas de calendário. Estes testes devem passar em QUALQUER fuso
 * (rode com TZ=Pacific/Kiritimati, TZ=America/Los_Angeles, TZ=America/Sao_Paulo, TZ=UTC).
 */
describe('datas de calendário independentes de fuso/horário de verão', () => {
  it('"hoje" é o dia LOCAL, não o dia UTC (23:59 e 00:01)', () => {
    expect(todayLocal(new Date(2026, 7, 19, 23, 59))).toBe('2026-08-19');
    expect(todayLocal(new Date(2026, 7, 19, 0, 1))).toBe('2026-08-19');
    expect(todayLocal(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31');
  });

  it('addDays/diffDays cruzam mês, ano, bissexto e trocas de horário sem pular nem repetir dias', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    let d = '2026-01-01';
    const seen = new Set<string>();
    for (let i = 0; i < 800; i++) {
      seen.add(d);
      const next = addDays(d, 1);
      expect(diffDays(d, next)).toBe(1);
      expect(next > d).toBe(true);
      d = next;
    }
    expect(seen.size).toBe(800);
    expect(d).toBe('2028-03-11');
  });

  it('formatLocalDate/isValidDateString rejeitam datas impossíveis', () => {
    expect(formatLocalDate(new Date(2026, 1, 3, 12))).toBe('2026-02-03');
    expect(isValidDateString('2026-02-29')).toBe(false);
    expect(isValidDateString('2028-02-29')).toBe(true);
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('19/08/2026')).toBe(false);
  });

  it('ciclo semanal que atravessa a virada do ano (qui 31/12/2026)', () => {
    const w = getCycleWindow('2026-12-31', { type: 'weekly', weekStartsOn: 1 }, 'g', 'r');
    expect([w.startAt, w.endAt]).toEqual(['2026-12-28', '2027-01-03']);
    // semana que começa no domingo
    const s = getCycleWindow('2027-01-02', { type: 'weekly', weekStartsOn: 0 }, 'g', 'r');
    expect([s.startAt, s.endAt]).toEqual(['2026-12-27', '2027-01-02']);
  });

  it('ciclos mensal/anual respeitam fevereiro bissexto e a virada de mês', () => {
    const feb28 = getCycleWindow('2027-02-10', { type: 'monthly' }, 'g', 'r');
    const feb29 = getCycleWindow('2028-02-10', { type: 'monthly' }, 'g', 'r');
    expect([feb28.startAt, feb28.endAt]).toEqual(['2027-02-01', '2027-02-28']);
    expect([feb29.startAt, feb29.endAt]).toEqual(['2028-02-01', '2028-02-29']);
    const y = getCycleWindow('2026-12-31', { type: 'annual' }, 'g', 'r');
    expect([y.startAt, y.endAt]).toEqual(['2026-01-01', '2026-12-31']);
  });

  it('ciclo personalizado de 10 dias: janelas consecutivas, sem sobreposição', () => {
    const rule = { type: 'custom' as const, duration: 10, unit: 'day' as const, anchorDate: '2026-08-01' };
    const w1 = getCycleWindow('2026-08-10', rule, 'g', 'r');
    const w2 = getCycleWindow('2026-08-11', rule, 'g', 'r');
    expect([w1.startAt, w1.endAt]).toEqual(['2026-08-01', '2026-08-10']);
    expect([w2.startAt, w2.endAt]).toEqual(['2026-08-11', '2026-08-20']);
    const m = getCycleWindow('2026-10-15', { type: 'custom', duration: 2, unit: 'month', anchorDate: '2026-08-01' }, 'g', 'r');
    expect([m.startAt, m.endAt]).toEqual(['2026-10-01', '2026-11-30']);
    const before = getCycleWindow('2026-07-20', rule, 'g', 'r'); // antes da âncora
    expect(before.startAt <= '2026-07-20' && before.endAt >= '2026-07-20').toBe(true);
  });

  it('agenda diária durante um ano inteiro (com trocas de horário de verão) gera exatamente 365 dias', () => {
    const period = { startDate: '2026-01-01', endDate: null };
    const days = getExpectedDates('2026-01-01', '2026-12-31', { type: 'daily' }, period);
    expect(days).toHaveLength(365);
    expect(new Set(days).size).toBe(365);
    // intervalo de 1 dia = todos os dias; de 7 dias = sempre o mesmo dia da semana
    const every1 = getExpectedDates('2026-01-01', '2026-12-31', { type: 'interval', every: 1, unit: 'day', anchorDate: '2026-01-01' }, period);
    expect(every1).toHaveLength(365);
    const every7 = getExpectedDates('2026-01-01', '2026-12-31', { type: 'interval', every: 7, unit: 'day', anchorDate: '2026-01-01' }, period);
    expect(every7).toHaveLength(53);
    expect(every7.every((x) => new Date(x + 'T12:00:00').getDay() === 4)).toBe(true); // 01/01/2026 é quinta
  });

  it('anual em 29/02 só ocorre em anos bissextos; mensal dia 29/30 respeita o mês', () => {
    const p = { startDate: '2026-01-01', endDate: null };
    expect(getExpectedDates('2026-01-01', '2029-12-31', { type: 'annual', month: 2, day: 29 }, p)).toEqual(['2028-02-29']);
    expect(scheduleMatchesDate('2027-02-28', { type: 'monthlyDate', dayOfMonth: 29 }, p)).toBe(false);
    expect(scheduleMatchesDate('2028-02-29', { type: 'monthlyDate', dayOfMonth: 29 }, p)).toBe(true);
  });

  it('enésimo dia da semana do mês, inclusive "último"', () => {
    const p = { startDate: '2026-01-01', endDate: null };
    // 2ª terça de agosto/2026 = 11; última sexta = 28
    expect(getExpectedDates('2026-08-01', '2026-08-31', { type: 'monthlyNthWeekday', ordinal: 2, weekday: 2 }, p)).toEqual(['2026-08-11']);
    expect(getExpectedDates('2026-08-01', '2026-08-31', { type: 'monthlyNthWeekday', ordinal: -1, weekday: 5 }, p)).toEqual(['2026-08-28']);
  });
});
