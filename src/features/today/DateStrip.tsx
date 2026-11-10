import React, { useEffect, useRef } from 'react';
import { addDays, todayLocal, parseLocalDate } from '../../domain/dates';

type Props = {
  selectedDate: string;
  onSelectDate: (d: string) => void;
};

const SPAN = 15; // dias para cada lado do dia selecionado

/** Faixa de pílulas de data (referência 9): a ativa fica amarela e o dia selecionado centraliza. */
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
      className="-mx-5 flex snap-x snap-proximity gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {days.map((d) => {
        const date = parseLocalDate(d);
        const selected = d === selectedDate;
        const isToday = d === today;
        const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        return (
          <button
            key={d}
            ref={selected ? selectedRef : undefined}
            role="option"
            aria-selected={selected}
            aria-label={date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            onClick={() => onSelectDate(d)}
            className={`flex min-h-[48px] shrink-0 snap-center flex-col items-center justify-center rounded-full px-4 text-center leading-none transition-all duration-300 ${
              selected ? 'bg-ziel-accent text-ziel-ink' : 'bg-ziel-raised text-ziel-sub active:bg-ziel-line'
            }`}
          >
            <span className="text-[13px] font-bold">
              {String(date.getDate()).padStart(2, '0')} {month}
            </span>
            {(selected || isToday) && <span className={`mt-1 text-[11px] font-extrabold ${selected ? '' : 'text-ziel-accent'}`}>{isToday ? 'Hoje' : date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>}
          </button>
        );
      })}
    </div>
  );
};
