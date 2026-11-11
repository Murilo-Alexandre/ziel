import { GoalRepository } from '../../ports/GoalRepository';
import { GoalDefinition, GoalRevision } from '../../../domain/types';
import { addDays } from '../../../domain/dates';
import { pickRevisionForDate } from '../../../domain/goals/revisions';

export class InMemoryGoalRepository implements GoalRepository {
  goals = new Map<string, GoalDefinition>();
  revisions = new Map<string, GoalRevision>();

  async getDefinition(id: string) {
    return this.goals.get(id) ?? null;
  }
  async getRevision(id: string) {
    return this.revisions.get(id) ?? null;
  }
  async listRevisionsForGoal(goalId: string) {
    return [...this.revisions.values()].filter((r) => r.goalId === goalId);
  }
  async listAllRevisions() {
    return [...this.revisions.values()];
  }
  async getRevisionForDate(goalId: string, dateStr: string) {
    return pickRevisionForDate(await this.listRevisionsForGoal(goalId), dateStr);
  }
  async listAllDefinitions() {
    return [...this.goals.values()];
  }
  async listChildren(parentId: string | null) {
    return [...this.goals.values()].filter((g) => g.parentId === parentId && !g.archivedAt);
  }
  async saveGoalWithRevision(definition: GoalDefinition, revision: GoalRevision) {
    this.goals.set(definition.id, definition);
    this.revisions.set(revision.id, revision);
  }
  async updateDefinition(definition: GoalDefinition) {
    this.goals.set(definition.id, definition);
  }
  async updateRevision(revision: GoalRevision) {
    this.revisions.set(revision.id, revision);
  }
  async addRevision(revision: GoalRevision, closePreviousRevisionId?: string) {
    if (closePreviousRevisionId) {
      const prev = this.revisions.get(closePreviousRevisionId);
      if (prev) this.revisions.set(prev.id, { ...prev, effectiveTo: addDays(revision.effectiveFrom, -1) });
    }
    this.revisions.set(revision.id, revision);
    const def = this.goals.get(revision.goalId);
    if (def) {
      this.goals.set(def.id, {
        ...def,
        currentRevisionId: revision.id,
        parentId: revision.parentId,
        sortOrder: revision.sortOrder,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  async purgeGoals(ids: string[]) {
    for (const id of ids) {
      this.goals.delete(id);
      for (const [k, r] of [...this.revisions]) if (r.goalId === id) this.revisions.delete(k);
    }
  }

  async deleteGoal(id: string) {
    const def = this.goals.get(id);
    if (def) this.goals.set(id, { ...def, archivedAt: new Date().toISOString() });
  }
}
