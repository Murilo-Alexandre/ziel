import { CycleComputedStatus, GoalDefinition, GoalRevision, Occurrence } from '../types';
import { getCycleWindow, CycleWindow } from '../recurrence/cycleEvaluator';
import { getExpectedDates } from '../recurrence/scheduleEvaluator';
import { addDays } from '../dates';
import {
  aggregateDirectChildrenProgress,
  aggregateQuotaProgress,
  aggregateScheduledOccurrencesProgress,
  calculateQuantityProgress,
  getStatusNumericWeight,
  AggregationOptions,
  ChildProgressInput,
} from './progressAggregator';

/** Dados já carregados (puro: sem I/O) usados para agregar o progresso de ciclos. */
export type AggregationContext = {
  /** Metas não arquivadas. */
  goals: GoalDefinition[];
  childrenOf: Map<string | null, GoalDefinition[]>;
  revisionAt(goalId: string, date: string): GoalRevision | null;
  occurrencesByGoal: Map<string, Occurrence[]>;
  /** Data local de hoje; ciclos terminados antes dela e não cumpridos viram "não realizado". */
  today: string;
};

export type CycleSummary = {
  progress: number;
  status: CycleComputedStatus;
  completedCount: number;
  expectedCount: number;
};

type Win = { startAt: string; endAt: string };

export function buildChildrenIndex(goals: GoalDefinition[]): Map<string | null, GoalDefinition[]> {
  const map = new Map<string | null, GoalDefinition[]>();
  for (const g of goals) {
    if (!map.has(g.parentId)) map.set(g.parentId, []);
    map.get(g.parentId)!.push(g);
  }
  map.forEach((list) => list.sort((a, b) => a.sortOrder - b.sortOrder));
  return map;
}

/** Contribuição 0..1 de uma ocorrência (quantidade usa atual/alvo; demais usam o peso do status). */
export function occurrenceContribution(occ: Occurrence, revision: GoalRevision | null): number {
  if (revision?.progressRule.type === 'quantity' && occ.status !== 'not_done') {
    if (occ.quantityValue != null) return calculateQuantityProgress(occ.quantityValue, revision.progressRule.target);
    if (occ.status === 'completed') return 1;
  }
  return getStatusNumericWeight(occ.status);
}

function virtualOccurrence(goalId: string, revisionId: string, date: string, slot: string): Occurrence {
  return {
    id: `virt_${goalId}_${date}_${slot}`,
    goalId,
    revisionId,
    cycleInstanceId: null,
    scheduledDate: date,
    scheduledTime: null,
    slotKey: slot,
    occurrenceKey: `${goalId}_${date}_${slot}`,
    source: 'generated',
    status: 'pending',
    progressValue: null,
    quantityValue: null,
    completedAt: null,
    lastStatusChangedAt: null,
    createdAt: '',
    updatedAt: '',
    overrideData: null,
  };
}

const isRemoved = (o: Occurrence): boolean => Boolean(o.overrideData?.isRemovedFromDate);

function revisionInWindow(goalId: string, win: Win, ctx: AggregationContext): GoalRevision | null {
  return ctx.revisionAt(goalId, win.endAt) ?? ctx.revisionAt(goalId, win.startAt);
}

/** Itens esperados da agenda PRÓPRIA de uma meta dentro de uma janela (reais ou virtuais). */
function ownItems(goal: GoalDefinition, win: Win, ctx: AggregationContext): Occurrence[] {
  const rev = revisionInWindow(goal.id, win, ctx);
  if (!rev) return [];
  const occs = (ctx.occurrencesByGoal.get(goal.id) ?? []).filter(
    (o) => o.scheduledDate >= win.startAt && o.scheduledDate <= win.endAt && !isRemoved(o)
  );

  if (rev.schedule.type === 'quota') {
    // Uma cota por janela do próprio ciclo da meta que intersecta a janela pedida.
    const items: Occurrence[] = [];
    const count = rev.schedule.count;
    const seen = new Set<string>();
    let cursor = win.startAt;
    while (cursor <= win.endAt) {
      const w = getCycleWindow(cursor, rev.trackingCycle, goal.id, rev.id);
      if (!seen.has(w.cycleKey)) {
        seen.add(w.cycleKey);
        const done = occs
          .filter((o) => o.scheduledDate >= w.startAt && o.scheduledDate <= w.endAt)
          .filter((o) => o.status !== 'pending')
          .sort((a, b) => occurrenceContribution(b, rev) - occurrenceContribution(a, rev))
          .slice(0, count);
        items.push(...done);
        for (let i = done.length; i < count; i++) items.push(virtualOccurrence(goal.id, rev.id, w.startAt, `q${i}`));
      }
      cursor = addDays(w.endAt, 1);
    }
    return items;
  }

  // Datas removidas por exceção ("somente esta ocorrência") saem do esperado do ciclo.
  const removedDates = new Set(
    (ctx.occurrencesByGoal.get(goal.id) ?? [])
      .filter((o) => isRemoved(o) && o.slotKey === 'default')
      .map((o) => o.scheduledDate)
  );
  const dates = getExpectedDates(win.startAt, win.endAt, rev.schedule, rev.activePeriod).filter((d) => !removedDates.has(d));
  const byDate = new Map<string, Occurrence>();
  occs.forEach((o) => {
    if (o.slotKey === 'default') byDate.set(o.scheduledDate, o);
  });
  return dates.map((d) => byDate.get(d) ?? virtualOccurrence(goal.id, rev.id, d, 'default'));
}

/**
 * Itens que contribuem para o ciclo de `goal`.
 * - 'direct': agenda própria + filhos imediatos; filhos "contêiner" (sem agenda própria) são atravessados.
 * - 'descendants': toda a subárvore.
 */
export function collectCycleItems(
  goal: GoalDefinition,
  win: Win,
  ctx: AggregationContext,
  depthMode: 'direct' | 'descendants' = 'descendants',
  visited: Set<string> = new Set()
): Occurrence[] {
  if (visited.has(goal.id)) return [];
  visited.add(goal.id);
  const items = [...ownItems(goal, win, ctx)];
  for (const child of ctx.childrenOf.get(goal.id) ?? []) {
    if (!revisionInWindow(child.id, win, ctx)) continue;
    if (depthMode === 'descendants') {
      items.push(...collectCycleItems(child, win, ctx, 'descendants', visited));
    } else {
      const own = ownItems(child, win, ctx);
      items.push(...own);
      if (own.length === 0) items.push(...collectCycleItems(child, win, ctx, 'direct', visited));
    }
  }
  return items;
}

/** Resumo do ciclo de uma meta na janela que contém `date`. */
export function summarizeCycle(
  goal: GoalDefinition,
  revision: GoalRevision,
  date: string,
  ctx: AggregationContext
): { window: CycleWindow; summary: CycleSummary } {
  const window = getCycleWindow(date, revision.trackingCycle, goal.id, revision.id);
  const options: AggregationOptions = {
    cycleEnded: window.endAt < ctx.today,
    progressOf: (o) => occurrenceContribution(o, ctx.revisionAt(o.goalId, o.scheduledDate)),
    isRequiredOf: (o) => ctx.revisionAt(o.goalId, o.scheduledDate)?.isRequired ?? true,
  };
  const agg = revision.aggregationRule;
  const children = (ctx.childrenOf.get(goal.id) ?? []).filter((c) => revisionInWindow(c.id, window, ctx));

  const done = (
    res: { computedProgress: number; computedStatus: CycleComputedStatus; completedCount: number; totalExpectedCount: number },
    hasItems = true
  ) => ({
    window,
    summary: {
      progress: res.computedProgress,
      status: hasItems ? res.computedStatus : ('pending' as CycleComputedStatus),
      completedCount: res.completedCount,
      expectedCount: res.totalExpectedCount,
    },
  });

  if (agg.type === 'manual') {
    return done({ computedProgress: 0, computedStatus: 'pending', completedCount: 0, totalExpectedCount: 0 }, false);
  }

  if (agg.type === 'directChildren' && children.length > 0) {
    const inputs: ChildProgressInput[] = [];
    for (const child of children) {
      const childRev = revisionInWindow(child.id, window, ctx)!;
      const items = collectCycleItems(child, window, ctx, 'descendants');
      if (items.length === 0) continue;
      const res = aggregateScheduledOccurrencesProgress(items, childRev.completionRule, options);
      inputs.push({
        goalId: child.id,
        isRequired: childRev.isRequired,
        progress: res.computedProgress,
        status: res.computedStatus === 'completed' ? 'completed' : res.computedStatus === 'in_progress' ? 'partial' : 'pending',
      });
    }
    return done(
      aggregateDirectChildrenProgress(inputs, agg, revision.completionRule, { cycleEnded: options.cycleEnded }),
      inputs.length > 0
    );
  }

  // Meta de frequência flexível sem filhos: contagem por ciclo.
  if (revision.schedule.type === 'quota' && children.length === 0) {
    const inWin = (ctx.occurrencesByGoal.get(goal.id) ?? []).filter(
      (o) => o.scheduledDate >= window.startAt && o.scheduledDate <= window.endAt && !isRemoved(o)
    );
    return done(aggregateQuotaProgress(inWin, revision.schedule.count, revision.completionRule, options));
  }

  const depthMode = agg.type === 'scheduledOccurrences' ? agg.depth : 'descendants';
  const items = collectCycleItems(goal, window, ctx, depthMode);
  return done(aggregateScheduledOccurrencesProgress(items, revision.completionRule, options), items.length > 0);
}
