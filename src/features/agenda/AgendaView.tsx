import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AgendaDay } from '../../application/services/GoalQueryService';
import { queryService } from '../../application/container';
import { addDays, parseLocalDate, todayLocal } from '../../domain/dates';
import { StatusPill } from '../../shared/ui/status';
import { toneFor } from '../../shared/ui/goalIcons';
import { errorMessage, useAppData } from '../../shared/AppData';
import { useOverlays } from '../../shared/Overlays';
import { useScrollReveal } from '../../shared/motion';

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function mondayOf(date: string): string {
  const dow = parseLocalDate(date).getDay();
  return addDays(date, -((dow + 6) % 7));
}

/** Agenda: projeção SEMANAL das ocorrências (esperadas pela agenda + reais). Não cria dados. */
export const AgendaView: React.FC = () => {
  const { version } = useAppData();
  const { openDetails } = useOverlays();
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayLocal()));
  const [days, setDays] = useState<AgendaDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayLocal();
  const listRef = useScrollReveal('[data-day]', `${weekStart}:${days ? 'ok' : 'wait'}`);

  const load = useCallback(async () => {
    try {
      setDays(await queryService.getAgenda(weekStart, addDays(weekStart, 6)));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [weekStart]);
  useEffect(() => {
    setDays(null);
    load();
  }, [load, version]);

  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => parseLocalDate(d).toLocaleDateString('pt-BR', o);
  const rangeLabel = `${fmt(weekStart, { day: 'numeric', month: 'short' }).replace('.', '')} – ${fmt(addDays(weekStart, 6), { day: 'numeric', month: 'short' }).replace('.', '')}`;

  return (
    <div className="pb-nav mx-auto w-full max-w-lg px-5 pt-safe">
      <header className="pb-4 pt-5">
        <p className="text-sm text-ziel-muted">Planejamento</p>
        <h1 className="text-[26px] font-extrabold leading-[1.05] tracking-tight">Agenda</h1>
      </header>

      <div className="mb-4 flex items-center justify-between gap-2">
        <button type="button" aria-label="Semana anterior" className="orb" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-base font-bold">{rangeLabel}</p>
          {weekStart !== mondayOf(today) && (
            <button type="button" className="min-h-touch text-sm font-semibold text-ziel-accent" onClick={() => setWeekStart(mondayOf(today))}>
              Esta semana
            </button>
          )}
        </div>
        <button type="button" aria-label="Próxima semana" className="orb" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {error ? (
        <div role="alert" className="card space-y-3 p-5 text-center">
          <p className="text-ziel-danger">{error}</p>
          <button className="btn-primary" onClick={load}>
            Tentar de novo
          </button>
        </div>
      ) : !days ? (
        <div className="card h-40 animate-pulse bg-ziel-raised" aria-busy="true" />
      ) : (
        <div ref={listRef} className="space-y-3">
          {days.map((day) => (
            <section data-day key={day.date} aria-label={fmt(day.date, { weekday: 'long', day: 'numeric', month: 'long' })} className={`overflow-hidden rounded-[24px] ${day.date === today ? 'border border-ziel-accent/60 bg-ziel-surface' : 'border border-ziel-line-soft bg-ziel-surface'}`}>
              <h2 className="flex items-baseline justify-between px-4 pb-1 pt-3 text-sm font-semibold">
                <span className={`flex items-center gap-2 ${day.date === today ? 'text-ziel-accent' : 'text-ziel-text'}`}>{cap(fmt(day.date, { weekday: 'long' }))}{day.date === today && <span className="rounded-full bg-ziel-accent px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ziel-ink">Hoje</span>}</span>
                <span className="text-ziel-sub">{fmt(day.date, { day: 'numeric', month: 'short' }).replace('.', '')}</span>
              </h2>
              {day.items.length === 0 ? (
                <p className="px-4 pb-3 text-sm text-ziel-sub">Livre</p>
              ) : (
                <ul className="divide-y divide-ziel-line-soft">
                  {day.items.map((it) => (
                    <li key={`${it.goalId}-${it.isQuotaSlot ? 'q' : 'd'}`}>
                      <button
                        type="button"
                        onClick={() => openDetails({ goalId: it.goalId, date: it.date, occurrenceId: it.occurrenceId })}
                        className="flex min-h-[47px] w-full items-center gap-3 px-4 py-2 text-left"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: toneFor(it.colorToken, it.goalId).bg }} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium">{it.name}</span>
                          {(it.parentName || it.isQuotaSlot) && <span className="block truncate text-xs text-ziel-sub">{[it.parentName ? `↳ ${it.parentName}` : null, it.isQuotaSlot ? 'frequência flexível' : null].filter(Boolean).join(' · ')}</span>}
                        </span>
                        <StatusPill status={it.status} compact />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
