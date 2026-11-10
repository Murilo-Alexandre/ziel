import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { LibraryItem } from '../../application/services/GoalQueryService';
import { queryService } from '../../application/container';
import { describeSchedule } from '../../domain/recurrence/scheduleLabels';
import { todayLocal } from '../../domain/dates';
import { iconFor, toneFor } from '../../shared/ui/goalIcons';
import { useScrollReveal } from '../../shared/motion';
import { errorMessage, useAppData } from '../../shared/AppData';
import { useOverlays } from '../../shared/Overlays';

type Filter = 'active' | 'archived';

export const GoalsLibraryView: React.FC = () => {
  const { version } = useAppData();
  const { openDetails, openEditor } = useOverlays();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('active');

  const load = useCallback(async () => {
    try {
      setItems(await queryService.listLibrary());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load, version]);

  const listRef = useScrollReveal<HTMLUListElement>('[data-row]', `${filter}:${items ? items.length : -1}`);
  const shown = (items ?? []).filter((i) => (filter === 'archived' ? i.archived : !i.archived));
  const activeCount = (items ?? []).filter((i) => !i.archived).length;
  const archivedCount = (items ?? []).filter((i) => i.archived).length;

  return (
    <div className="pb-nav mx-auto w-full max-w-lg px-5 pt-safe">
      <header className="flex items-end justify-between gap-3 pb-4 pt-5">
        <div>
          <p className="text-sm text-ziel-muted">Sua estrutura</p>
          <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-tight">Metas</h1>
        </div>
        <button type="button" className="btn-primary" onClick={() => openEditor({ kind: 'create', parentId: null })}>
          <Plus className="h-4 w-4" /> Nova
        </button>
      </header>

      <div role="tablist" aria-label="Filtro" className="mb-4 grid grid-cols-2 gap-1 rounded-chip border border-ziel-line bg-ziel-surface p-1">
        {(
          [
            ['active', `Ativas (${activeCount})`],
            ['archived', `Arquivadas (${archivedCount})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={filter === k}
            onClick={() => setFilter(k)}
            className={`min-h-[44px] rounded-full text-sm font-bold ${filter === k ? 'bg-ziel-accent text-ziel-ink' : 'text-ziel-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div role="alert" className="card space-y-3 p-5 text-center">
          <p className="text-ziel-danger">{error}</p>
          <button className="btn-primary" onClick={load}>
            Tentar de novo
          </button>
        </div>
      ) : !items ? (
        <div className="card h-24 animate-pulse bg-ziel-raised" aria-busy="true" />
      ) : shown.length === 0 ? (
        <p className="card px-5 py-9 text-center text-sm text-ziel-muted">{filter === 'active' ? 'Nenhuma meta ainda. Toque em “Nova” para começar.' : 'Nenhuma meta arquivada.'}</p>
      ) : (
        <ul ref={listRef} className="space-y-2.5">
          {shown.map(({ definition, revision, depth, childCount, archived }) => {
            const archivedStyle = archived;
            const Icon = iconFor(revision.icon);
            const tone = toneFor(revision.colorToken, definition.id);
            return (
              <li data-row key={definition.id} style={{ marginLeft: Math.min(depth, 3) * 14 }}>
                <button
                  type="button"
                  onClick={() => openDetails({ goalId: definition.id, date: todayLocal(), occurrenceId: null })}
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-[26px] px-4 py-2.5 text-left text-ziel-ink active:opacity-85" style={{ backgroundColor: tone.bg, opacity: archivedStyle ? 0.55 : 1 }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/10">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 break-words text-[15px] font-semibold leading-snug">{revision.name}</span>
                    <span className="block truncate text-xs font-semibold text-black/60">
                      {describeSchedule(revision.schedule)}
                      {childCount > 0 ? ` · ${childCount} submeta${childCount > 1 ? 's' : ''}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
