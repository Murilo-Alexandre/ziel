import React from 'react';
import { ProgressBar } from '../../shared/ui/status';

type Props = { progress: number; total: number; completed: number; isToday: boolean };

export const DayProgressCard: React.FC<Props> = ({ progress, total, completed, isToday }) => {
  const pct = Math.round(progress * 100);
  return (
    <section className="card p-5" aria-label="Progresso do dia">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ziel-sub">Progresso {isToday ? 'de hoje' : 'do dia'}</h2>
          <p className="mt-1 text-sm text-ziel-muted">
            {total === 0
              ? 'Nada planejado neste dia'
              : `${completed} de ${total} ${total === 1 ? 'concluída' : 'concluídas'}`}
          </p>
        </div>
        <span className="shrink-0 text-5xl font-bold leading-none tracking-tight text-ziel-success">
          {pct}
          <span className="text-2xl font-semibold text-ziel-muted">%</span>
        </span>
      </div>
      <ProgressBar value={progress} barClass="bg-ziel-success" className="mt-4 !h-2" label="Progresso do dia" />
    </section>
  );
};
