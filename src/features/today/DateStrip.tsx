import React, { useEffect, useRef } from 'react';
import { addDays, todayLocal, parseLocalDate } from '../../domain/dates';
import { gsap, motionOK } from '../../shared/motion';

type Props = {
  selectedDate: string;
  onSelectDate: (d: string) => void;
};

const SPAN = 15; // dias para cada lado do dia selecionado

/** Faixa de dias (referências 4/5): rótulo da semana acima, número em círculo; o selecionado fica coral e centraliza. */
export const DateStrip: React.FC<Props> = ({ selectedDate, onSelectDate }) => {
  const today = todayLocal();
  const selectedRef = useRef<HTMLButtonElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const el = selectedRef.current;
    if (!el) return;
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: first.current ? 'auto' : 'smooth' });
    const circle = el.querySelector('[data-circle]');
    if (!first.current && circle && motionOK()) gsap.fromTo(circle, { scale: 0.6 }, { scale: 1, duration: 0.55, ease: 'back.out(2.4)', clearProps: 'transform' });
    first.current = false;
  }, [selectedDate]);

  const days = Array.from({ length: SPAN * 2 + 1 }, (_, i) => addDays(selectedDate, i - SPAN));

  return (
    <div
      role="listbox"
      aria-label="Escolher dia"
      className="-mx-5 flex snap-x snap-proximity gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            className="flex w-[42px] shrink-0 snap-center flex-col items-center gap-1.5 py-1 text-center"
          >
            <span className={`text-[11px] font-semibold capitalize ${selected ? 'text-ziel-text' : 'text-ziel-muted'}`}>{wd}</span>
            <span
              data-circle
              className={`flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-extrabold transition-colors duration-300 ${
                selected ? 'bg-ziel-accent text-ziel-ink shadow-[0_8px_20px_-8px_rgba(242,139,130,0.9)]' : isToday ? 'border border-ziel-accent/70 text-ziel-accent' : 'text-ziel-sub'
              }`}
            >
              {date.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
};
