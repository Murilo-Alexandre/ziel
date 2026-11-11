import { GoalRepository } from '../../infrastructure/ports/GoalRepository';
import {
  ActivePeriod,
  AggregationRule,
  CompletionRule,
  GoalDefinition,
  GoalRevision,
  ProgressRule,
  ScheduleRule,
  TrackingCycleRule,
  NotifyConfig,
} from '../../domain/types';
import { listDescendantIds, validateNoHierarchyCycle } from '../../domain/goals/goalTree';
import { GoalValidationError, validateGoalDraft } from '../../domain/goals/goalValidation';
import { addDays, todayLocal } from '../../domain/dates';
import { newId } from '../ids';

export type CreateGoalInput = {
  name: string;
  parentId?: string | null;
  description?: string;
  icon?: string;
  colorToken?: string;
  categoryId?: string;

  activePeriod?: ActivePeriod;
  trackingCycle?: TrackingCycleRule;
  schedule?: ScheduleRule;
  progressRule?: ProgressRule;
  completionRule?: CompletionRule;
  aggregationRule?: AggregationRule;

  isRequired?: boolean;
  showParentOnHome?: boolean;
  notify?: NotifyConfig | null;
};

export type RevisionUpdates = Partial<Omit<GoalRevision, 'id' | 'goalId' | 'effectiveFrom'>>;

export class GoalService {
  constructor(
    private goalRepo: GoalRepository,
    private today: () => string = () => todayLocal()
  ) {}

  async createGoal(input: CreateGoalInput): Promise<{ definition: GoalDefinition; revision: GoalRevision }> {
    const now = new Date().toISOString();
    const today = this.today();
    const activePeriod = input.activePeriod ?? { startDate: today, endDate: null };
    const schedule = input.schedule ?? { type: 'daily' };
    const trackingCycle = input.trackingCycle ?? { type: 'daily' };
    const progressRule = input.progressRule ?? { type: 'binary' };
    const completionRule = input.completionRule ?? { type: 'allRequired' };

    const errors = validateGoalDraft({ name: input.name, activePeriod, schedule, trackingCycle, progressRule, completionRule, notify: input.notify });
    if (input.parentId) {
      const parent = await this.goalRepo.getDefinition(input.parentId);
      if (!parent || parent.archivedAt) errors.push('A meta pai não existe ou está arquivada.');
    }
    if (errors.length) throw new GoalValidationError(errors);

    const goalId = newId('goal');
    const revisionId = newId('rev');
    const sortOrder = Date.now();

    const definition: GoalDefinition = {
      id: goalId,
      parentId: input.parentId ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      sortOrder,
      currentRevisionId: revisionId,
    };

    const revision: GoalRevision = {
      id: revisionId,
      goalId,
      effectiveFrom: activePeriod.startDate,
      effectiveTo: null,
      parentId: input.parentId ?? null,
      sortOrder,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      icon: input.icon ?? null,
      colorToken: input.colorToken ?? null,
      categoryId: input.categoryId ?? null,

      activePeriod,
      trackingCycle,
      schedule,
      progressRule,
      completionRule,
      aggregationRule: input.aggregationRule ?? { type: 'scheduledOccurrences', depth: 'direct', weightMode: 'equal' },

      isRequired: input.isRequired ?? true,
      showParentOnHome: input.showParentOnHome ?? true,
      inherit: { period: false, category: false, icon: false, color: false, reminders: false },
      reminders: [],
      notify: input.notify ?? null,
    };

    await this.goalRepo.saveGoalWithRevision(definition, revision);
    return { definition, revision };
  }

  async addSubGoal(parentId: string, input: Omit<CreateGoalInput, 'parentId'>) {
    return this.createGoal({ ...input, parentId });
  }

  /**
   * "Esta e as próximas": nova revisão vigente a partir de `effectiveFromDate`; a anterior é encerrada
   * no dia anterior, preservando o histórico. Se já existir uma revisão que COMEÇA nessa data, ela é
   * atualizada no lugar (evita revisões vazias e ocorrências duplicadas).
   */
  async editGoalThisAndFuture(goalId: string, effectiveFromDate: string, updates: RevisionUpdates): Promise<GoalRevision> {
    const currentRev = await this.goalRepo.getRevisionForDate(goalId, effectiveFromDate);
    if (!currentRev) {
      throw new Error(`Revision for goal ${goalId} on ${effectiveFromDate} not found.`);
    }

    const merged: GoalRevision = { ...currentRev, ...updates, goalId };
    const errors = validateGoalDraft({
      name: merged.name,
      activePeriod: merged.activePeriod,
      schedule: merged.schedule,
      trackingCycle: merged.trackingCycle,
      progressRule: merged.progressRule,
      completionRule: merged.completionRule,
      notify: merged.notify,
    });
    if (errors.length) throw new GoalValidationError(errors);

    if (updates.parentId !== undefined && updates.parentId !== currentRev.parentId) {
      await this.assertCanMove(goalId, updates.parentId);
    }
    merged.name = merged.name.trim();

    if (currentRev.effectiveFrom === effectiveFromDate) {
      const inPlace: GoalRevision = { ...merged, id: currentRev.id, effectiveFrom: effectiveFromDate };
      await this.goalRepo.updateRevision(inPlace);
      await this.syncDefinition(inPlace);
      return inPlace;
    }

    // Se existir revisão posterior, a nova termina no dia anterior a ela (sem sobreposição).
    const later = (await this.goalRepo.listRevisionsForGoal(goalId))
      .filter((r) => r.effectiveFrom > effectiveFromDate)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];

    const newRevision: GoalRevision = {
      ...merged,
      id: newId('rev'),
      goalId,
      effectiveFrom: effectiveFromDate,
      effectiveTo: later ? addDays(later.effectiveFrom, -1) : null,
    };

    await this.goalRepo.addRevision(newRevision, currentRev.id);
    // addRevision torna a nova revisão a "vigente" na definição; se existe posterior, mantém a mais recente.
    if (later) {
      const def = await this.goalRepo.getDefinition(goalId);
      if (def) await this.goalRepo.updateDefinition({ ...def, currentRevisionId: later.id });
    }
    return newRevision;
  }

  private async syncDefinition(rev: GoalRevision) {
    const def = await this.goalRepo.getDefinition(rev.goalId);
    if (def && def.currentRevisionId === rev.id) {
      await this.goalRepo.updateDefinition({ ...def, parentId: rev.parentId, sortOrder: rev.sortOrder, updatedAt: new Date().toISOString() });
    }
  }

  private async assertCanMove(goalId: string, newParentId: string | null) {
    const all = await this.goalRepo.listAllDefinitions();
    if (newParentId) {
      const parent = all.find((g) => g.id === newParentId);
      if (!parent || parent.archivedAt) throw new GoalValidationError(['A meta pai não existe ou está arquivada.']);
    }
    if (!validateNoHierarchyCycle(goalId, newParentId, all)) {
      throw new GoalValidationError(['Não é possível mover uma meta para dentro dela mesma ou de uma submeta sua.']);
    }
  }

  /** Move a meta para outro pai, recusando ciclos. */
  async moveGoal(goalId: string, newParentId: string | null): Promise<GoalDefinition> {
    await this.assertCanMove(goalId, newParentId);
    const def = await this.goalRepo.getDefinition(goalId);
    if (!def) throw new Error(`Goal ${goalId} not found.`);
    const updated = { ...def, parentId: newParentId, updatedAt: new Date().toISOString() };
    await this.goalRepo.updateDefinition(updated);
    for (const rev of await this.goalRepo.listRevisionsForGoal(goalId)) {
      await this.goalRepo.updateRevision({ ...rev, parentId: newParentId });
    }
    return updated;
  }

  /** Define a nova ordem dos irmãos (persistida em definição e revisões). */
  async reorderSiblings(orderedGoalIds: string[]): Promise<void> {
    for (let i = 0; i < orderedGoalIds.length; i++) {
      const def = await this.goalRepo.getDefinition(orderedGoalIds[i]);
      if (!def) continue;
      const sortOrder = i + 1;
      await this.goalRepo.updateDefinition({ ...def, sortOrder });
      for (const rev of await this.goalRepo.listRevisionsForGoal(def.id)) {
        await this.goalRepo.updateRevision({ ...rev, sortOrder });
      }
    }
  }

  /** Quantas metas (a própria + submetas) uma exclusão apagaria. */
  async countSubtree(goalId: string): Promise<number> {
    const all = await this.goalRepo.listAllDefinitions();
    return 1 + listDescendantIds(goalId, all).length;
  }

  /** EXCLUI definitivamente a meta, a subárvore e TODO o histórico ligado a elas. Irreversível. */
  async deleteGoalPermanently(goalId: string): Promise<string[]> {
    const all = await this.goalRepo.listAllDefinitions();
    const ids = [goalId, ...listDescendantIds(goalId, all)];
    await this.goalRepo.purgeGoals(ids);
    return ids;
  }

  /** Arquiva a meta e toda a sua subárvore. Histórico (ocorrências, registros) é preservado. */
  async archiveGoal(goalId: string): Promise<string[]> {
    const all = await this.goalRepo.listAllDefinitions();
    const ids = [goalId, ...listDescendantIds(goalId, all)];
    for (const id of ids) await this.goalRepo.deleteGoal(id);
    return ids;
  }
}
