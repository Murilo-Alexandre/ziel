import React, { useEffect, useRef } from 'react';
import { CalendarDays, Check, ChevronDown, Minus, Paperclip, X as XIcon } from 'lucide-react';
import { TodayGoalNode } from '../../domain/goals/goalTree';
import { OccurrenceStatus } from '../../domain/types';
import { STATUS_META, CYCLE_STATUS_META } from '../../shared/ui/status';
import { iconFor, toneFor } from '../../shared/ui/goalIcons';
import { cycleScopeLabel, describeSchedule } from '../../domain/recurrence/scheduleLabels';
import { gsap, motionOK } from '../../shared/motion';
import { AnimBar, Collapse } from '../../shared/ui/Anim';

type Props = {
  node: TodayGoalNode;
  isExpanded: (goalId: string, depth: number) => boolean;
  onToggle: (goalId: string, depth: number) => void;
  onOpenDetails: (node: TodayGoalNode) => void;
  onSelectStatus: (node: TodayGoalNode) => void;
  onOpenEvidence: (node: TodayGoalNode) => void;
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));

/** Anel de status (estilo checkbox circular das referências): vazio = pendente, cheio = concluído. */
const StatusRing: React.FC<{
  status: OccurrenceStatus;
  hex: string;
  label: string;
  onClick: () => void;
  size?: number;
  innerRef?: React.Ref<HTMLButtonElement>;
}> = ({ status, hex, label, onClick, size = 44, innerRef }) => {
  const done = status === 'completed';
  const color = status === 'not_done' ? '#F2706A' : hex;
  return (
    <button
      ref={innerRef}
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, border: `2.5px solid ${color}`, backgroundColor: done ? color : 'transparent', color: done ? '#0F1320' : color }}
    >
      {done && <Check className="h-5 w-5" strokeWidth={3.2} />}
      {status === 'partial' && <Minus className="h-5 w-5" strokeWidth={3.2} />}
      {status === 'not_done' && <XIcon className="h-[18px] w-[18px]" strokeWidth={3.2} />}
    </button>
  );
};

export const GoalNodeCard: React.FC<Props> = ({ node, isExpanded, onToggle, onOpenDetails, onSelectStatus, onOpenEvidence }) => {
  const { revision, occurrence, cycleInstance, children, depth } = node;
  const expanded = isExpanded(node.goal.id, depth);
  const Icon = iconFor(revision.icon);
  const tone = toneFor(revision.colorToken, node.goal.id);
  const hex = tone.hex;
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
  const ringRef = useRef<HTMLButtonElement>(null);
  const prevStatus = useRef(status);

  // "pop" ao mudar o status (não na primeira renderização)
  useEffect(() => {
    if (prevStatus.current !== status && ringRef.current && motionOK()) {
      gsap.fromTo(ringRef.current, { scale: 0.6, rotate: status === 'completed' ? -30 : 0 }, { scale: 1, rotate: 0, duration: 0.65, ease: 'elastic.out(1, 0.5)', clearProps: 'transform' });
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

  const statusRing = occurrence ? (
    <StatusRing innerRef={ringRef} status={status} hex={hex} size={root ? 38 : 34} label={`Status: ${meta.label}. Alterar`} onClick={() => onSelectStatus(node)} />
  ) : null;

  const chevron = hasKids ? (
    <button
      type="button"
      onClick={() => onToggle(node.goal.id, depth)}
      aria-expanded={expanded}
      aria-label={expanded ? 'Recolher submetas' : 'Expandir submetas'}
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-ziel-sub before:absolute before:-inset-1 before:content-[''] active:bg-white/10"
    >
      <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
    </button>
  ) : null;

  const evidence =
    node.evidenceCount > 0 ? (
      <button type="button" onClick={() => onOpenEvidence(node)} aria-label={`${node.evidenceCount} registros. Abrir linha do tempo`} className="pill bg-white/[0.08] text-ziel-sub">
        <Paperclip className="h-3.5 w-3.5" />
        {node.evidenceCount}
      </button>
    ) : null;

  // Árvore explícita: bandeja "Submetas · N" + conector em cotovelo ligando cada filha à mãe (na cor da mãe).
  const kids = hasKids ? (
    <Collapse open={expanded}>
      <div className="mt-2.5" role="group" aria-label={`Submetas de ${displayName}`}>
        <div className="mb-2 flex items-center gap-2 pl-1 text-[11px] font-extrabold uppercase tracking-wider text-ziel-muted">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
          Submetas · {children.length}
        </div>
        <div className="tree-list" style={{ ['--tree-c' as string]: `${hex}99` }}>
          {children.map((c) => (
            <div key={c.goal.id} className={`tree-child ${c.depth <= 1 ? 'tree-l1' : c.depth === 2 ? 'tree-l2' : 'tree-l3'}`}>
              <GoalNodeCard node={c} isExpanded={isExpanded} onToggle={onToggle} onOpenDetails={onOpenDetails} onSelectStatus={onSelectStatus} onOpenEvidence={onOpenEvidence} />
            </div>
          ))}
        </div>
      </div>
    </Collapse>
  ) : null;

  /* -------- cartão raiz: borda/brilho na cor da meta, pílula vertical com ícone (referências 2 e 4) -------- */
  if (root) {
    return (
      <article
        data-reveal
        className="rounded-[22px] p-3 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.9)]"
        style={{ border: `1px solid ${hex}66`, background: `linear-gradient(140deg, ${hex}26 0%, rgba(29,36,51,0.96) 58%)` }}
      >
        <div className="flex items-start gap-3.5">
          <button type="button" onClick={() => onOpenDetails(node)} className="flex min-w-0 flex-1 items-start gap-3.5 text-left" aria-label={`Abrir ${displayName}`}>
            <span className="flex h-[50px] w-[40px] shrink-0 items-center justify-center rounded-[14px]" style={{ backgroundColor: hex, color: '#0F1320' }} aria-hidden>
              <Icon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1 pt-0.5">
              <span className="line-clamp-2 break-words text-[15px] font-extrabold leading-[1.15] tracking-tight text-ziel-text">{displayName}</span>
              <span className="mt-1.5 block truncate text-[12px] text-ziel-muted">{subtitle}</span>
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            {statusRing}
            {chevron}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 pl-[66px]">
          <span className="pill bg-white/[0.08] text-ziel-sub">
            <CalendarDays className="h-3.5 w-3.5" />
            {describeSchedule(revision.schedule)}
          </span>
          {evidence}
        </div>

        {(hasKids || (isQuota && cycleInstance)) && cycleInstance && (
          <div className="mt-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold" style={{ color: hex }}>
                {cycleMeta?.label}
              </span>
              <span className="font-semibold tabular-nums text-ziel-sub">{pct}%</span>
            </div>
            <AnimBar value={cycleInstance.computedProgress} className="mt-1.5 h-2 bg-white/10" fillStyle={{ background: `linear-gradient(90deg, ${hex}, ${hex}cc)` }} label={`Progresso do ciclo de ${displayName}`} />
          </div>
        )}

        {hasKids && (
          <p className="mt-2.5 text-xs font-semibold text-ziel-muted">
            Hoje · {todayDone} de {children.length}
          </p>
        )}
        {kids}
      </article>
    );
  }

  /* -------- linha de submeta -------- */
  return (
    <div
      data-depth={depth}
      className="rounded-[16px] p-2"
      style={{ border: `1px solid ${hex}44`, background: `linear-gradient(135deg, ${hex}1F 0%, rgba(255,255,255,${depth > 1 ? 0.07 : 0.045}) 70%)` }}
    >
      <div className="flex h-10 items-center gap-2">
        <button type="button" onClick={() => onOpenDetails(node)} className="flex h-10 min-w-0 flex-1 items-center gap-2.5 text-left">
          <span className="flex h-9 w-8 shrink-0 items-center justify-center rounded-[10px]" style={{ backgroundColor: hex, color: '#0F1320' }} aria-hidden>
            <Icon className="h-[17px] w-[17px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold leading-tight text-ziel-text">{displayName}</span>
            <span className="mt-px block truncate text-[11px] leading-tight text-ziel-muted">{subtitle}</span>
          </span>
        </button>
        {evidence}
        {statusRing}
        {chevron}
      </div>
      {hasKids && cycleInstance && (
        <div className="mt-1 flex items-center gap-2 pl-[2.6rem] pr-1">
          <AnimBar value={cycleInstance.computedProgress} className="h-1.5 flex-1 bg-white/10" fillStyle={{ backgroundColor: hex }} label={`Progresso do ciclo de ${displayName}`} />
          <span className="text-xs font-bold tabular-nums text-ziel-sub">{pct}%</span>
        </div>
      )}
      {kids}
    </div>
  );
};
