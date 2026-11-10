import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { LibraryItem } from '../../application/services/GoalQueryService';
import { queryService } from '../../application/container';
import { describeSchedule } from '../../domain/recurrence/scheduleLabels';
import { todayLocal } from '../../domain/dates';
import { iconFor } from '../../shared/ui/goalIcons';
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

  const shown = (items ?? []).filter((i) => (filter === 'archived' ? i.archived : !i.archived));
  const activeCount = (items ?? []).filter((i) => !i.archived).length;
  const archivedCount = (items ?? []).filter((i) => i.archived).length;

  return (
    <div className="pb-nav mx-auto w-full max-w-lg px-4 pt-safe">
      <header className="flex items-end justify-between gap-3 pb-4 pt-5">
        <div>
          <p className="text-sm text-ziel-muted">Sua estrutura</p>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Metas</h1>
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
            className={`min-h-touch rounded-[10px] text-sm font-semibold ${filter === k ? 'bg-ziel-accent-soft text-ziel-accent' : 'text-ziel-muted'}`}
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
        <ul className="card divide-y divide-ziel-line-soft overflow-hidden">
          {shown.map(({ definition, revision, depth, childCount }) => {
            const Icon = iconFor(revision.icon);
            const color = revision.colorToken ?? '#6D9BFF';
            return (
              <li key={definition.id} style={{ paddingLeft: Math.min(depth, 3) * 12 }}>
                <button
                  type="button"
                  onClick={() => openDetails({ goalId: definition.id, date: todayLocal(), occurrenceId: null })}
                  className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip" style={{ backgroundColor: `${color}24`, color }}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 break-words text-[15px] font-semibold leading-snug">{revision.name}</span>
                    <span className="block truncate text-xs text-ziel-muted">
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
