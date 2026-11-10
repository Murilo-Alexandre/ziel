import React, { useEffect, useRef } from 'react';
import { addDays, todayLocal, parseLocalDate } from '../../domain/dates';

type Props = {
  selectedDate: string;
  onSelectDate: (d: string) => void;
};

const SPAN = 15; // dias para cada lado do dia selecionado

/** Faixa horizontal de dias com rolagem e snap; o dia selecionado fica centralizado. */
export const DateStrip: React.FC<Props> = ({ selectedDate, onSelectDate }) => {
  const today = todayLocal();
  const selectedRef = useRef<HTMLButtonElement>(null);
  const first = useRef(true);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: first.current ? 'auto' : 'smooth' });
    first.current = false;
  }, [selectedDate]);

  const days = Array.from({ length: SPAN * 2 + 1 }, (_, i) => addDays(selectedDate, i - SPAN));

  return (
    <div
      role="listbox"
      aria-label="Escolher dia"
      className="-mx-4 flex snap-x snap-proximity gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {days.map((d) => {
        const date = parseLocalDate(d);
        const selected = d === selectedDate;
        const isToday = d === today;
        const wd = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3);
        return (
          <button
            key={d}
            ref={selected ? selectedRef : undefined}
            role="option"
            aria-selected={selected}
            aria-label={date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            onClick={() => onSelectDate(d)}
            className={`flex min-h-[64px] w-[52px] shrink-0 snap-center flex-col items-center justify-center rounded-chip border text-center transition-colors ${
              selected
                ? 'border-ziel-accent bg-ziel-accent-soft text-ziel-text'
                : 'border-ziel-line-soft bg-ziel-surface text-ziel-sub'
            }`}
          >
            <span className="text-[11px] font-medium uppercase tracking-wide text-ziel-muted">{wd}</span>
            <span className="mt-0.5 text-lg font-bold leading-none">{date.getDate()}</span>
            <span className={`mt-1.5 h-1 w-1 rounded-full ${isToday ? 'bg-ziel-accent' : 'bg-transparent'}`} aria-hidden />
          </button>
        );
      })}
    </div>
  );
};
