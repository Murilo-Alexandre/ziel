import { GoalRevision, ScheduleRule, TrackingCycleRule, Weekday } from '../types';
import { parseLocalDate } from '../dates';

const WD_SHORT: Record<Weekday, string> = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };
const ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function formatDateBR(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

export function describeSchedule(s: ScheduleRule): string {
  switch (s.type) {
    case 'once':
      return `Única · ${formatDateBR(s.date)}`;
    case 'daily':
      return 'Todos os dias';
    case 'weekdays': {
      const days = ORDER.filter((d) => s.weekdays.includes(d));
      if (days.length === 7) return 'Todos os dias';
      if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Seg a Sex';
      return days.map((d) => WD_SHORT[d]).join(', ') || 'Sem dias';
    }
    case 'interval': {
      const unit =
        s.unit === 'day'
          ? s.every === 1 ? 'dia' : 'dias'
          : s.unit === 'week'
            ? s.every === 1 ? 'semana' : 'semanas'
            : s.every === 1 ? 'mês' : 'meses';
      return `A cada ${s.every} ${unit}`;
    }
    case 'monthlyDate':
      return `Todo dia ${s.dayOfMonth} do mês`;
    case 'monthlyNthWeekday':
      return `${s.ordinal === -1 ? 'Última' : `${s.ordinal}ª`} ${WD_SHORT[s.weekday]} do mês`;
    case 'annual':
      return `Todo ano em ${String(s.day).padStart(2, '0')}/${String(s.month).padStart(2, '0')}`;
    case 'quota': {
      const per = { day: 'dia', week: 'semana', month: 'mês', year: 'ano' }[s.per];
      return `${s.count}x por ${per}`;
    }
    case 'custom':
      return s.expression === 'container' ? 'Agrupa submetas' : 'Personalizada';
  }
}

export function describeCycle(c: TrackingCycleRule): string {
  switch (c.type) {
    case 'single':
      return 'Único';
    case 'daily':
      return 'Diário';
    case 'weekly':
      return 'Semanal';
    case 'monthly':
      return 'Mensal';
    case 'annual':
      return 'Anual';
    case 'custom':
      return `A cada ${c.duration} ${c.unit === 'day' ? 'dia(s)' : c.unit === 'week' ? 'semana(s)' : 'mês(es)'}`;
  }
}

/** Prefixo do progresso do ciclo exibido na Home: "Na semana · 3 de 9". */
export function cycleScopeLabel(c: TrackingCycleRule): string {
  switch (c.type) {
    case 'weekly':
      return 'Na semana';
    case 'monthly':
      return 'No mês';
    case 'annual':
      return 'No ano';
    case 'daily':
      return 'No dia';
    default:
      return 'No ciclo';
  }
}

export function describeCompletion(r: GoalRevision['completionRule']): string {
  switch (r.type) {
    case 'allRequired':
      return 'Todos os obrigatórios concluídos';
    case 'minimumCount':
      return `Mínimo de ${r.count} concluídas`;
    case 'minimumPercentage':
      return `Mínimo de ${r.percentage}% de progresso`;
    case 'quantityTarget':
      return 'Atingir a quantidade-alvo';
    case 'manual':
      return 'Manual';
  }
}
