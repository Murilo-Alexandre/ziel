import React from 'react';
import { Ring, CountUp } from '../../shared/ui/Ring';

type Props = { progress: number; total: number; completed: number; isToday: boolean };

/** Card escuro com anel de progresso (referências 8 e 9). */
export const DayProgressCard: React.FC<Props> = ({ progress, total, completed, isToday }) => {
  const pct = Math.round(progress * 100);
  return (
    <section data-reveal className="flex items-center gap-5 rounded-card bg-ziel-ink p-5" aria-label="Progresso do dia">
      <Ring value={progress} size={112} stroke={13} label={`Progresso do dia: ${pct}%`} barColor="#C8DA7A" trackClass="stroke-white/10">
        <CountUp value={pct} suffix="%" className="text-[26px] font-extrabold tracking-tight text-ziel-text" />
      </Ring>
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold leading-tight text-ziel-text">Progresso {isToday ? 'de hoje' : 'do dia'}</h2>
        <p className="mt-1 text-sm text-ziel-sub">
          {total === 0 ? 'Nada planejado neste dia' : `${completed} de ${total} ${total === 1 ? 'concluída' : 'concluídas'}`}
        </p>
        {total > 0 && (
          <p className="mt-2 text-xs font-semibold text-ziel-success">{pct === 100 ? 'Dia completo ✦' : pct >= 50 ? 'Bom ritmo' : 'Vamos começar'}</p>
        )}
      </div>
    </section>
  );
};
