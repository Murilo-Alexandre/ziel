import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { LibraryItem } from '../../application/services/GoalQueryService';
import { queryService } from '../../application/container';
import { describeSchedule } from '../../domain/recurrence/scheduleLabels';
import { todayLocal } from '../../domain/dates';
import { iconFor, toneFor } from '../../shared/ui/goalIcons';
import { errorMessage, useAppData } from '../../shared/AppData';
import { useOverlays } from '../../shared/Overlays';
import { useScrollReveal } from '../../shared/motion';

type Filter = 'active' | 'archived';
type TreeNode = { item: LibraryItem; children: TreeNode[] };

/** Monta a árvore a partir da lista em ordem de árvore (cada item sabe o id do pai). */
function buildTree(items: LibraryItem[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  items.forEach((item) => byId.set(item.definition.id, { item, children: [] }));
  const roots: TreeNode[] = [];
  for (const n of byId.values()) {
    const parent = n.item.definition.parentId ? byId.get(n.item.definition.parentId) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  return roots;
}

const Node: React.FC<{ node: TreeNode; level: number; onOpen: (id: string) => void }> = ({ node, level, onOpen }) => {
  const { definition, revision, childCount, archived } = node.item;
  const Icon = iconFor(revision.icon);
  const hex = toneFor(revision.colorToken, definition.id).hex;
  const root = level === 0;
  return (
    <div
      data-row={root ? '' : undefined}
      className={root ? 'rounded-[22px] p-3' : 'rounded-[16px] p-2'}
      style={{
        opacity: archived ? 0.6 : 1,
        border: `1px solid ${hex}${root ? '66' : '44'}`,
        background: `linear-gradient(135deg, ${hex}${root ? '26' : '1A'} 0%, rgba(255,255,255,${level > 1 ? 0.07 : 0.04}) 70%)`,
      }}
    >
      <button type="button" onClick={() => onOpen(definition.id)} className={`flex w-full items-center gap-2.5 text-left ${root ? 'min-h-[52px]' : 'h-10'}`} aria-label={`Abrir ${revision.name}`}>
        <span className={`flex shrink-0 items-center justify-center ${root ? 'h-[46px] w-[38px] rounded-[14px]' : 'h-9 w-8 rounded-[10px]'}`} style={{ backgroundColor: hex, color: '#0F1320' }} aria-hidden>
          <Icon className={root ? 'h-5 w-5' : 'h-[17px] w-[17px]'} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-ziel-text ${root ? 'line-clamp-2 break-words text-[15px] font-extrabold leading-snug' : 'truncate text-[13px] font-bold leading-tight'}`}>{revision.name}</span>
          <span className={`mt-px block truncate text-ziel-muted ${root ? 'text-xs' : 'text-[11px] leading-tight'}`}>
            {describeSchedule(revision.schedule)}
            {childCount > 0 ? ` · ${childCount} submeta${childCount > 1 ? 's' : ''}` : ''}
          </span>
        </span>
      </button>

      {node.children.length > 0 && (
        <div className="mt-2.5" role="group" aria-label={`Submetas de ${revision.name}`}>
          <div className="mb-2 flex items-center gap-2 pl-1 text-[11px] font-extrabold uppercase tracking-wider text-ziel-muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
            Submetas · {node.children.length}
          </div>
          <div className="tree-list" style={{ ['--tree-c' as string]: `${hex}99` }}>
            {node.children.map((c) => (
              <div key={c.item.definition.id} className={`tree-child ${level + 1 <= 1 ? 'tree-l1' : level + 1 === 2 ? 'tree-l2' : 'tree-l3'}`}>
                <Node node={c} level={level + 1} onOpen={onOpen} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

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

  const shown = useMemo(() => (items ?? []).filter((i) => (filter === 'archived' ? i.archived : !i.archived)), [items, filter]);
  const tree = useMemo(() => buildTree(shown), [shown]);
  const listRef = useScrollReveal<HTMLDivElement>('[data-row]', `${filter}:${items ? items.length : -1}`);
  const activeCount = (items ?? []).filter((i) => !i.archived).length;
  const archivedCount = (items ?? []).filter((i) => i.archived).length;

  return (
    <div className="pb-nav mx-auto w-full max-w-lg px-5 pt-safe">
      <header className="flex items-end justify-between gap-3 pb-4 pt-5">
        <div>
          <p className="text-sm text-ziel-muted">Sua estrutura</p>
          <h1 className="text-[26px] font-extrabold leading-[1.05] tracking-tight">Metas</h1>
        </div>
        <button type="button" className="btn-primary" onClick={() => openEditor({ kind: 'create', parentId: null })}>
          <Plus className="h-4 w-4" /> Nova
        </button>
      </header>

      <div role="tablist" aria-label="Filtro" className="mb-4 grid grid-cols-2 gap-1 rounded-full border border-white/[0.08] bg-ziel-surface p-1">
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
            className={`min-h-[40px] rounded-full text-sm font-bold transition-colors ${filter === k ? 'bg-ziel-accent text-ziel-ink' : 'text-ziel-muted'}`}
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
        <div ref={listRef} className="space-y-3.5">
          {tree.map((n) => (
            <Node key={n.item.definition.id} node={n} level={0} onOpen={(id) => openDetails({ goalId: id, date: todayLocal(), occurrenceId: null })} />
          ))}
        </div>
      )}
    </div>
  );
};
