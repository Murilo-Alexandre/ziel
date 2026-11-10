import React from 'react';
import { CheckCircle2, Circle, CircleDot, XCircle } from 'lucide-react';
import { CycleComputedStatus, OccurrenceStatus } from '../../domain/types';
import { AnimBar } from './Anim';

/** Semântica de status centralizada: concluído=lima, parcial=âmbar, pendente=neutro, não realizado=coral. */
export const STATUS_META: Record<
  OccurrenceStatus,
  { label: string; text: string; bg: string; border: string; Icon: React.FC<{ className?: string }> }
> = {
  completed: { label: 'Concluído', text: 'text-ziel-success', bg: 'bg-ziel-success-soft', border: 'border-ziel-success/40', Icon: CheckCircle2 },
  partial: { label: 'Parcial', text: 'text-ziel-warning', bg: 'bg-ziel-warning-soft', border: 'border-ziel-warning/40', Icon: CircleDot },
  not_done: { label: 'Não realizado', text: 'text-ziel-danger', bg: 'bg-ziel-danger-soft', border: 'border-ziel-danger/40', Icon: XCircle },
  pending: { label: 'Pendente', text: 'text-ziel-muted', bg: 'bg-ziel-raised', border: 'border-ziel-line', Icon: Circle },
};

export const CYCLE_STATUS_META: Record<CycleComputedStatus, { label: string; text: string; bar: string }> = {
  completed: { label: 'Concluído', text: 'text-ziel-success', bar: 'bg-ziel-success' },
  in_progress: { label: 'Em andamento', text: 'text-ziel-warning', bar: 'bg-ziel-warning' },
  pending: { label: 'Pendente', text: 'text-ziel-muted', bar: 'bg-ziel-accent' },
  not_done: { label: 'Não realizado', text: 'text-ziel-danger', bar: 'bg-ziel-danger' },
};

export const ProgressBar: React.FC<{ value: number; barClass?: string; className?: string; label?: string; trackClass?: string }> = ({
  value,
  barClass = 'bg-ziel-accent',
  className = '',
  label,
  trackClass = 'bg-ziel-line-soft',
}) => <AnimBar value={value} label={label} className={`h-2 w-full ${trackClass} ${className}`} fillClassName={barClass} />;

export const StatusPill: React.FC<{ status: OccurrenceStatus; compact?: boolean }> = ({ status, compact }) => {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${m.text} ${m.bg} ${m.border}`}>
      <m.Icon className="h-3.5 w-3.5" />
      {!compact && m.label}
    </span>
  );
};
