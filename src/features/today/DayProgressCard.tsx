import React from 'react';
import { Ring, CountUp } from '../../shared/ui/Ring';

type Props = { progress: number; total: number; completed: number; isToday: boolean };

/** Card com anel em degradê (referência 8) e frase de contexto. */
export const DayProgressCard: React.FC<Props> = ({ progress, total, completed, isToday }) => {
  const pct = Math.round(progress * 100);
  return (
    <section
      data-reveal
      data-progress-card
      className="flex items-center gap-5 rounded-[26px] border border-white/[0.08] p-5"
      style={{ background: 'linear-gradient(135deg, rgba(139,124,246,0.20) 0%, rgba(91,155,224,0.10) 45%, rgba(29,36,51,0.95) 100%)' }}
      aria-label="Progresso do dia"
    >
      <Ring value={progress} size={84} stroke={10} label={`Progresso do dia: ${pct}%`} gradient={['#F28B82', '#F5C542', '#62C48A']} trackClass="stroke-white/10">
        <CountUp value={pct} suffix="%" className="text-[18px] font-extrabold tracking-tight text-ziel-text" />
      </Ring>
      <div className="min-w-0">
        <h2 className="text-[15px] font-extrabold leading-tight text-ziel-text">Progresso {isToday ? 'de hoje' : 'do dia'}</h2>
        <p className="mt-1 text-sm text-ziel-sub">{total === 0 ? 'Nada planejado neste dia' : `${completed} de ${total} ${total === 1 ? 'concluída' : 'concluídas'}`}</p>
        {total > 0 && <p className="mt-2 text-xs font-bold text-ziel-success">{pct === 100 ? 'Dia completo ✦' : pct >= 50 ? 'Bom ritmo' : 'Vamos começar'}</p>}
      </div>
    </section>
  );
};
