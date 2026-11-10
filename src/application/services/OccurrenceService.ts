import { GoalRepository } from '../../infrastructure/ports/GoalRepository';
import { OccurrenceRepository } from '../../infrastructure/ports/OccurrenceRepository';
import { JournalRepository } from '../../infrastructure/ports/JournalRepository';
import { generateExpectedOccurrencesForDate, computeOccurrenceKey } from '../../domain/recurrence/occurrenceGenerator';
import { getCycleWindow } from '../../domain/recurrence/cycleEvaluator';
import { buildTodayGoalTree, computeDailyProgress, TodayGoalNode } from '../../domain/goals/goalTree';
import {
  AggregationContext,
  buildChildrenIndex,
  occurrenceContribution,
  summarizeCycle,
} from '../../domain/progress/cycleAggregation';
import { pickRevisionForDate } from '../../domain/goals/revisions';
import { todayLocal, isValidDateString } from '../../domain/dates';
import { calculateQuantityProgress } from '../../domain/progress/progressAggregator';
import {
  CycleInstance,
  GoalDefinition,
  GoalRevision,
  Occurrence,
  OccurrenceOverride,
  OccurrenceStatus,
} from '../../domain/types';
import { newId } from '../ids';

export type TodayTree = {
  nodes: TodayGoalNode[];
  overallProgress: number;
  totalActionable: number;
  completedActionable: number;
};

export class OccurrenceService {
  /** Fila: operações que geram/alteram estado não se intercalam (React StrictMode, toques rápidos). */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private goalRepo: GoalRepository,
    private occurrenceRepo: OccurrenceRepository,
    private journalRepo: JournalRepository,
    private today: () => string = () => todayLocal()
  ) {}

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  // ---------------------------------------------------------------- geração

  private async loadActive(): Promise<{
    goals: GoalDefinition[];
    revisionsByGoal: Map<string, GoalRevision[]>;
  }> {
    const [defs, revs] = await Promise.all([this.goalRepo.listAllDefinitions(), this.goalRepo.listAllRevisions()]);
    const archived = new Set(defs.filter((d) => d.archivedAt).map((d) => d.id));
    // Submetas de uma meta arquivada também ficam fora.
    const byId = new Map(defs.map((d) => [d.id, d]));
    const isHidden = (d: GoalDefinition): boolean => {
      const seen = new Set<string>();
      let cur: GoalDefinition | undefined = d;
      while (cur) {
        if (archived.has(cur.id)) return true;
        if (seen.has(cur.id)) return true;
        seen.add(cur.id);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
      return false;
    };
    const goals = defs.filter((d) => !isHidden(d));
    const revisionsByGoal = new Map<string, GoalRevision[]>();
    for (const r of revs) {
      if (!revisionsByGoal.has(r.goalId)) revisionsByGoal.set(r.goalId, []);
      revisionsByGoal.get(r.goalId)!.push(r);
    }
    return { goals, revisionsByGoal };
  }

  private async ensureForDate(targetDate: string): Promise<Occurrence[]> {
    const { goals, revisionsByGoal } = await this.loadActive();
    const withRev: { definition: GoalDefinition; revision: GoalRevision }[] = [];
    for (const g of goals) {
      const rev = pickRevisionForDate(revisionsByGoal.get(g.id) ?? [], targetDate);
      if (rev) withRev.push({ definition: g, revision: rev });
    }
    const revById = new Map(withRev.map((x) => [x.definition.id, x.revision]));

    const result: Occurrence[] = [];
    for (const expected of generateExpectedOccurrencesForDate(withRev, targetDate)) {
      const { occurrence, created } = await this.occurrenceRepo.insertIfAbsent(expected);
      let final = occurrence;
      const rev = revById.get(occurrence.goalId);
      // Ocorrência ainda pendente acompanha a revisão vigente ("esta e as próximas"); as resolvidas
      // ficam presas à revisão com que foram executadas (verdade histórica).
      if (!created && occurrence.status === 'pending' && rev && occurrence.revisionId !== rev.id) {
        final = await this.occurrenceRepo.saveOccurrence({ ...occurrence, revisionId: rev.id, updatedAt: new Date().toISOString() });
      }
      result.push(final);
    }
    return result;
  }

  getOrGenerateOccurrencesForDate(targetDateStr: string): Promise<Occurrence[]> {
    return this.serialize(() => this.ensureForDate(targetDateStr));
  }

  // ---------------------------------------------------------------- árvore do dia

  getTodayGoalTree(targetDateStr: string): Promise<TodayTree> {
    return this.serialize(() => this.buildTree(targetDateStr));
  }

  private async buildTree(targetDate: string): Promise<TodayTree> {
    const expectedToday = await this.ensureForDate(targetDate);
    const expectedIds = new Set(expectedToday.map((o) => o.id));
    const { goals, revisionsByGoal } = await this.loadActive();

    const revisionAt = (goalId: string, date: string) => pickRevisionForDate(revisionsByGoal.get(goalId) ?? [], date);
    const revisionsMap = new Map<string, GoalRevision>();
    const windows = new Map<string, ReturnType<typeof getCycleWindow>>();
    let rangeStart = targetDate;
    let rangeEnd = targetDate;
    for (const g of goals) {
      const rev = revisionAt(g.id, targetDate);
      if (!rev) continue;
      revisionsMap.set(g.id, rev);
      const w = getCycleWindow(targetDate, rev.trackingCycle, g.id, rev.id);
      windows.set(g.id, w);
      if (w.startAt < rangeStart) rangeStart = w.startAt;
      if (w.endAt > rangeEnd) rangeEnd = w.endAt;
    }

    const occsInRange = await this.occurrenceRepo.listInRange(rangeStart, rangeEnd);
    const occurrencesByGoal = new Map<string, Occurrence[]>();
    for (const o of occsInRange) {
      if (!occurrencesByGoal.has(o.goalId)) occurrencesByGoal.set(o.goalId, []);
      occurrencesByGoal.get(o.goalId)!.push(o);
    }

    const ctx: AggregationContext = {
      goals,
      childrenOf: buildChildrenIndex(goals),
      revisionAt,
      occurrencesByGoal,
      today: this.today(),
    };

    const cycleInstancesMap = new Map<string, CycleInstance>();
    for (const g of goals) {
      const rev = revisionsMap.get(g.id);
      if (!rev) continue;
      const { window, summary } = summarizeCycle(g, rev, targetDate, ctx);
      const existing = await this.occurrenceRepo.getCycleInstance(g.id, window.cycleKey);
      const now = new Date().toISOString();
      const next: CycleInstance = {
        id: existing?.id ?? `ci_${window.cycleKey}`,
        goalId: g.id,
        revisionId: rev.id,
        startAt: window.startAt,
        endAt: window.endAt,
        cycleKey: window.cycleKey,
        computedProgress: summary.progress,
        computedStatus: summary.status,
        completedCount: summary.completedCount,
        expectedCount: summary.expectedCount,
        finalizedAt: existing?.finalizedAt ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const changed =
        !existing ||
        existing.computedProgress !== next.computedProgress ||
        existing.computedStatus !== next.computedStatus ||
        existing.completedCount !== next.completedCount ||
        existing.expectedCount !== next.expectedCount ||
        existing.revisionId !== next.revisionId;
      if (changed) await this.occurrenceRepo.saveCycleInstance(next);
      cycleInstancesMap.set(g.id, changed ? next : existing!);
    }

    const todays = occsInRange.filter((o) => o.scheduledDate === targetDate && o.slotKey === 'default');
    const evidenceCounts = await this.journalRepo.countRecordsByOccurrence(todays.map((o) => o.id));
    // Uma ocorrência pendente e intocada que a agenda vigente já NÃO espera (ex.: dia removido de uma
    // série "esta e as próximas") some da Home; com status resolvido ou evidências, é história e permanece.
    const occurrencesMap = new Map<string, Occurrence>();
    for (const o of todays) {
      const isHistory = o.status !== 'pending' || (evidenceCounts.get(o.id) ?? 0) > 0 || o.source === 'manual';
      if (expectedIds.has(o.id) || isHistory) occurrencesMap.set(o.goalId, o);
    }

    const nodes = buildTodayGoalTree({
      goals,
      revisionsMap,
      occurrencesMap,
      cycleInstancesMap,
      evidenceCounts,
    });

    const daily = computeDailyProgress(nodes, (occ, rev) => occurrenceContribution(occ, rev));
    return {
      nodes,
      overallProgress: daily.progress,
      totalActionable: daily.total,
      completedActionable: daily.completed,
    };
  }

  // ---------------------------------------------------------------- status

  updateStatus(
    occurrenceId: string,
    newStatus: OccurrenceStatus,
    progressValue?: number | null,
    quantityValue?: number | null
  ): Promise<Occurrence> {
    return this.serialize(async () => {
      const current = await this.occurrenceRepo.getById(occurrenceId);
      if (!current) throw new Error(`Ocorrência ${occurrenceId} não encontrada.`);
      const updated = await this.occurrenceRepo.updateStatus(occurrenceId, newStatus, progressValue, quantityValue);
      if (current.status !== newStatus) {
        await this.journalRepo.recordStatusChange({
          id: newId('sc'),
          occurrenceId,
          fromStatus: current.status,
          toStatus: newStatus,
          changedAt: new Date().toISOString(),
        });
      }
      return updated;
    });
  }

  /** Meta por quantidade: registra o valor realizado; o status acompanha (>=alvo concluído, >0 parcial). */
  async recordQuantity(occurrenceId: string, quantity: number): Promise<Occurrence> {
    if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Informe uma quantidade válida (zero ou mais).');
    const occ = await this.occurrenceRepo.getById(occurrenceId);
    if (!occ) throw new Error(`Ocorrência ${occurrenceId} não encontrada.`);
    const rev = await this.goalRepo.getRevision(occ.revisionId);
    if (!rev || rev.progressRule.type !== 'quantity') throw new Error('Esta meta não é medida por quantidade.');
    const ratio = calculateQuantityProgress(quantity, rev.progressRule.target);
    const status: OccurrenceStatus = ratio >= 1 ? 'completed' : quantity > 0 ? 'partial' : 'pending';
    return this.updateStatus(occurrenceId, status, ratio, quantity);
  }

  // ---------------------------------------------------------------- exceções e remarcação

  /** "Somente esta ocorrência": exceção local; a definição (e as demais datas) não mudam. */
  overrideOccurrence(occurrenceId: string, overrideData: OccurrenceOverride): Promise<Occurrence> {
    return this.serialize(async () => {
      const occ = await this.occurrenceRepo.getById(occurrenceId);
      if (!occ) throw new Error(`Ocorrência ${occurrenceId} não encontrada.`);
      return this.occurrenceRepo.saveOccurrence({
        ...occ,
        overrideData: { ...occ.overrideData, ...overrideData },
        updatedAt: new Date().toISOString(),
      });
    });
  }

  /**
   * Remarca uma meta ÚNICA para outra data. Não cria série recorrente e não deixa a ocorrência
   * acionável na data antiga: a agenda da meta passa a apontar para a nova data e a ocorrência
   * (com status e registros) acompanha, guardando a data original em `rescheduledFrom`.
   */
  rescheduleOneTimeGoal(occurrenceId: string, newDateStr: string): Promise<Occurrence> {
    return this.serialize(async () => {
      if (!isValidDateString(newDateStr)) throw new Error('Data inválida.');
      const occ = await this.occurrenceRepo.getById(occurrenceId);
      if (!occ) throw new Error(`Ocorrência ${occurrenceId} não encontrada.`);
      if (occ.scheduledDate === newDateStr) return occ;

      const rev = await this.goalRepo.getRevisionForDate(occ.goalId, occ.scheduledDate);
      if (!rev || rev.schedule.type !== 'once') {
        throw new Error('Só metas de data única podem ser remarcadas. Em metas recorrentes, use "Somente esta ocorrência".');
      }
      const newKey = computeOccurrenceKey(occ.goalId, newDateStr, occ.slotKey);
      if (await this.occurrenceRepo.getByKey(newKey)) throw new Error('Já existe uma ocorrência desta meta nessa data.');

      const start = rev.activePeriod.startDate <= newDateStr ? rev.activePeriod.startDate : newDateStr;
      const end = rev.activePeriod.endDate && rev.activePeriod.endDate < newDateStr ? newDateStr : rev.activePeriod.endDate;
      await this.goalRepo.updateRevision({
        ...rev,
        schedule: { ...rev.schedule, date: newDateStr },
        activePeriod: { startDate: start, endDate: end },
        effectiveFrom: rev.effectiveFrom <= newDateStr ? rev.effectiveFrom : newDateStr,
      });

      return this.occurrenceRepo.saveOccurrence({
        ...occ,
        scheduledDate: newDateStr,
        occurrenceKey: newKey,
        rescheduledFrom: occ.rescheduledFrom ?? occ.scheduledDate,
        updatedAt: new Date().toISOString(),
      });
    });
  }
}
