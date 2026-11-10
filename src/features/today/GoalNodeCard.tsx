import React from 'react';
import { ChevronDown, ChevronRight, Paperclip } from 'lucide-react';
import { TodayGoalNode } from '../../domain/goals/goalTree';
import { OccurrenceStatus } from '../../domain/types';
import { STATUS_META, CYCLE_STATUS_META, ProgressBar } from '../../shared/ui/status';
import { iconFor } from '../../shared/ui/goalIcons';
import { cycleScopeLabel, describeSchedule } from '../../domain/recurrence/scheduleLabels';
import { indentFor } from './treeLayout';

type Props = {
  node: TodayGoalNode;
  isExpanded: (goalId: string, depth: number) => boolean;
  onToggle: (goalId: string, depth: number) => void;
  onOpenDetails: (node: TodayGoalNode) => void;
  onSelectStatus: (node: TodayGoalNode) => void;
  onOpenEvidence: (node: TodayGoalNode) => void;
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));

export const GoalNodeCard: React.FC<Props> = ({ node, isExpanded, onToggle, onOpenDetails, onSelectStatus, onOpenEvidence }) => {
  const { revision, occurrence, cycleInstance, children, depth } = node;
  const expanded = isExpanded(node.goal.id, depth);
  const Icon = iconFor(revision.icon);
  const color = revision.colorToken ?? '#6D9BFF';
  const hasKids = children.length > 0;
  const status: OccurrenceStatus = occurrence?.status ?? 'pending';
  const meta = STATUS_META[status];
  const isQuota = revision.schedule.type === 'quota';
  const quantity = revision.progressRule.type === 'quantity' ? revision.progressRule : null;
  const showCycle = cycleInstance && (hasKids || node.hasConfiguredChildren || isQuota || revision.trackingCycle.type !== 'daily');
  const cycleMeta = cycleInstance ? CYCLE_STATUS_META[cycleInstance.computedStatus] : null;
  const pct = cycleInstance ? Math.round(cycleInstance.computedProgress * 100) : 0;
  const displayName = occurrence?.overrideData?.name ?? revision.name;
  const todayDone = children.filter((c) => c.occurrence?.status === 'completed').length;

  const subtitle = (() => {
    if (quantity && occurrence) {
      return `${fmt(occurrence.quantityValue ?? 0)} / ${fmt(quantity.target)} ${quantity.unit}`;
    }
    if (isQuota && cycleInstance) return `${cycleInstance.completedCount ?? 0} de ${cycleInstance.expectedCount ?? 0} ${cycleScopeLabel(revision.trackingCycle).toLowerCase()}`;
    if (revision.description) return revision.description;
    return describeSchedule(revision.schedule);
  })();

  const level = indentFor(depth);

  return (
    <div style={{ marginLeft: depth > 0 ? Math.min(level, 36) : 0 }} className={depth === 0 ? 'card overflow-hidden' : 'border-t border-ziel-line-soft first:border-t-0'}>
      <div className="flex items-stretch">
        {/* 1) Chevron: só expande/recolhe */}
        {hasKids ? (
          <button
            type="button"
            onClick={() => onToggle(node.goal.id, depth)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Recolher submetas' : 'Expandir submetas'}
            className="flex min-h-touch w-11 shrink-0 items-center justify-center text-ziel-muted active:text-ziel-text"
          >
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        ) : (
          <div className="w-3 shrink-0" aria-hidden />
        )}

        {/* 2) Nome/conteúdo: abre os detalhes */}
        <button
          type="button"
          onClick={() => onOpenDetails(node)}
          className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2 pr-2 text-left"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip"
            style={{ backgroundColor: `${color}24`, color }}
            aria-hidden
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 break-words text-[15px] font-semibold leading-snug text-ziel-text">{displayName}</span>
            <span className="mt-0.5 block truncate text-xs text-ziel-muted">{showCycle && !isQuota && !quantity ? `${cycleScopeLabel(revision.trackingCycle)} · ${cycleInstance!.completedCount ?? 0} de ${cycleInstance!.expectedCount ?? 0}` : subtitle}</span>
          </span>
        </button>

        {/* evidências (contagem compacta; nunca imagens na Home) */}
        {node.evidenceCount > 0 && (
          <button
            type="button"
            onClick={() => onOpenEvidence(node)}
            aria-label={`${node.evidenceCount} registros. Abrir linha do tempo`}
            className="flex min-h-touch min-w-touch shrink-0 items-center justify-center gap-0.5 text-xs text-ziel-muted"
          >
            <Paperclip className="h-3.5 w-3.5" />
            {node.evidenceCount}
          </button>
        )}

        {/* 3) Status: abre a ação rápida (ocorrência) ou mostra o resumo do ciclo (agrupador) */}
        {occurrence ? (
          <button
            type="button"
            onClick={() => onSelectStatus(node)}
            aria-label={`Status: ${meta.label}. Alterar`}
            className={`my-auto mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${meta.border} ${meta.bg} ${meta.text}`}
          >
            <meta.Icon className="h-6 w-6" />
          </button>
        ) : cycleMeta ? (
          <div className="mr-3 flex w-12 shrink-0 flex-col items-end justify-center">
            <span className={`text-base font-bold tabular-nums ${cycleMeta.text}`}>{pct}%</span>
          </div>
        ) : null}
      </div>

      {/* progresso do ciclo e resumo do dia para agrupadores */}
      {(hasKids || (isQuota && cycleInstance)) && cycleInstance && (
        <div className="px-4 pb-3 pl-[3.25rem]">
          <ProgressBar value={cycleInstance.computedProgress} barClass={cycleMeta?.bar} label={`Progresso do ciclo de ${displayName}`} />
          <div className="mt-1.5 flex items-center justify-between text-xs text-ziel-muted">
            <span className={cycleMeta?.text}>{cycleMeta?.label}</span>
            {hasKids && (
              <span>
                Hoje · {todayDone} de {children.length}
              </span>
            )}
          </div>
        </div>
      )}

      {hasKids && expanded && (
        <div className="border-t border-ziel-line-soft bg-ziel-bg/30">
          {children.map((c) => (
            <GoalNodeCard
              key={c.goal.id}
              node={c}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onOpenDetails={onOpenDetails}
              onSelectStatus={onSelectStatus}
              onOpenEvidence={onOpenEvidence}
            />
          ))}
        </div>
      )}
    </div>
  );
};
