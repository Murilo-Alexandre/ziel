import React, { useEffect, useRef } from 'react';
import { CalendarDays, ChevronDown, Paperclip } from 'lucide-react';
import { TodayGoalNode } from '../../domain/goals/goalTree';
import { OccurrenceStatus } from '../../domain/types';
import { STATUS_META, CYCLE_STATUS_META } from '../../shared/ui/status';
import { iconFor, toneFor } from '../../shared/ui/goalIcons';
import { cycleScopeLabel, describeSchedule } from '../../domain/recurrence/scheduleLabels';
import { gsap, motionOK } from '../../shared/motion';
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
  const tone = toneFor(revision.colorToken, node.goal.id);
  const hasKids = children.length > 0;
  const root = depth === 0;
  const status: OccurrenceStatus = occurrence?.status ?? 'pending';
  const meta = STATUS_META[status];
  const isQuota = revision.schedule.type === 'quota';
  const quantity = revision.progressRule.type === 'quantity' ? revision.progressRule : null;
  const showCycle = Boolean(cycleInstance) && (hasKids || node.hasConfiguredChildren || isQuota);
  const cycleMeta = cycleInstance ? CYCLE_STATUS_META[cycleInstance.computedStatus] : null;
  const pct = cycleInstance ? Math.round(cycleInstance.computedProgress * 100) : 0;
  const displayName = occurrence?.overrideData?.name ?? revision.name;
  const todayDone = children.filter((c) => c.occurrence?.status === 'completed').length;
  const orbRef = useRef<HTMLButtonElement>(null);
  const prevStatus = useRef(status);

  // "pop" ao mudar o status (não na primeira renderização)
  useEffect(() => {
    if (prevStatus.current !== status && orbRef.current && motionOK()) {
      gsap.fromTo(orbRef.current, { scale: 0.55, rotate: status === 'completed' ? -25 : 0 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
    }
    prevStatus.current = status;
  }, [status]);

  const subtitle = (() => {
    if (quantity && occurrence) return `${fmt(occurrence.quantityValue ?? 0)} / ${fmt(quantity.target)} ${quantity.unit}`;
    if (isQuota && cycleInstance) return `${cycleInstance.completedCount ?? 0} de ${cycleInstance.expectedCount ?? 0} ${cycleScopeLabel(revision.trackingCycle).toLowerCase()}`;
    if (showCycle && cycleInstance) return `${cycleScopeLabel(revision.trackingCycle)} · ${cycleInstance.completedCount ?? 0} de ${cycleInstance.expectedCount ?? 0}`;
    if (revision.description) return revision.description;
    return describeSchedule(revision.schedule);
  })();

  const statusOrb = occurrence ? (
    <button
      ref={orbRef}
      type="button"
      onClick={() => onSelectStatus(node)}
      aria-label={`Status: ${meta.label}. Alterar`}
      className={`orb h-12 w-12 ${root ? '' : '!bg-ziel-raised'} ${meta.text}`}
    >
      <meta.Icon className="h-6 w-6" />
    </button>
  ) : null;

  const chevron = hasKids ? (
    <button
      type="button"
      onClick={() => onToggle(node.goal.id, depth)}
      aria-expanded={expanded}
      aria-label={expanded ? 'Recolher submetas' : 'Expandir submetas'}
      className={`orb ${root ? '' : '!bg-ziel-raised'} text-ziel-text`}
    >
      <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
    </button>
  ) : null;

  const evidence =
    node.evidenceCount > 0 ? (
      <button
        type="button"
        onClick={() => onOpenEvidence(node)}
        aria-label={`${node.evidenceCount} registros. Abrir linha do tempo`}
        className={`pill ${root ? 'bg-black/10 text-ziel-ink' : 'bg-white/10 text-ziel-sub'}`}
      >
        <Paperclip className="h-3.5 w-3.5" />
        {node.evidenceCount}
      </button>
    ) : null;

  const kids =
    hasKids && expanded ? (
      <div className="mt-3 space-y-2.5">
        {children.map((c) => (
          <GoalNodeCard key={c.goal.id} node={c} isExpanded={isExpanded} onToggle={onToggle} onOpenDetails={onOpenDetails} onSelectStatus={onSelectStatus} onOpenEvidence={onOpenEvidence} />
        ))}
      </div>
    ) : null;

  /* -------- bloco raiz colorido -------- */
  if (root) {
    return (
      <article data-reveal className="rounded-card p-5 text-ziel-ink shadow-[0_10px_30px_-14px_rgba(0,0,0,0.7)]" style={{ backgroundColor: tone.bg }}>
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={() => onOpenDetails(node)} className="min-w-0 flex-1 text-left">
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/10" aria-hidden>
              <Icon className="h-5 w-5" />
            </span>
            <span className="line-clamp-2 break-words text-[24px] font-extrabold leading-[1.1] tracking-tight">{displayName}</span>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            {statusOrb}
            {chevron}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="pill bg-black/10">
            <CalendarDays className="h-3.5 w-3.5" />
            {describeSchedule(revision.schedule)}
          </span>
          {evidence}
          <span className="min-w-0 truncate text-xs font-semibold text-black/60">{subtitle}</span>
        </div>

        {(hasKids || (isQuota && cycleInstance)) && cycleInstance && (
          <div className="mt-4 flex items-center gap-3 rounded-full bg-white/80 py-2.5 pl-4 pr-2.5">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label={`Progresso do ciclo de ${displayName}`}
              className="h-2 flex-1 overflow-hidden rounded-full bg-black/15"
            >
              <div className="h-full rounded-full bg-ziel-ink transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-extrabold tabular-nums">{pct}%</span>
            <span className="rounded-full bg-ziel-ink px-3 py-1.5 text-[11px] font-bold text-ziel-text">{cycleMeta?.label}</span>
          </div>
        )}

        {hasKids && (
          <p className="mt-2.5 px-1 text-xs font-semibold text-black/60">
            Hoje · {todayDone} de {children.length}
          </p>
        )}
        {kids}
      </article>
    );
  }

  /* -------- linha de submeta (pílula escura dentro do bloco) -------- */
  return (
    <div style={{ marginLeft: Math.min(indentFor(depth) - 12, 24) }} className="rounded-[26px] bg-ziel-ink p-3 pl-4 text-ziel-text">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onOpenDetails(node)} className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: tone.bg, color: '#141414' }} aria-hidden>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 break-words text-[15px] font-bold leading-snug">{displayName}</span>
            <span className="mt-0.5 block truncate text-xs text-ziel-muted">{subtitle}</span>
          </span>
        </button>
        {evidence}
        {statusOrb}
        {chevron}
      </div>
      {hasKids && cycleInstance && (
        <div className="mt-2 flex items-center gap-2 pl-12 pr-1">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Progresso do ciclo de ${displayName}`}>
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, backgroundColor: tone.bg }} />
          </div>
          <span className="text-xs font-bold tabular-nums text-ziel-sub">{pct}%</span>
        </div>
      )}
      {kids}
    </div>
  );
};
