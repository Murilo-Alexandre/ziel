import { GoalRepository } from '../../ports/GoalRepository';
import { GoalDefinition, GoalRevision } from '../../../domain/types';
import { addDays } from '../../../domain/dates';
import { getDB } from './database';
import { pickRevisionForDate } from '../../../domain/goals/revisions';

export class IndexedDbGoalRepository implements GoalRepository {
  async getDefinition(id: string): Promise<GoalDefinition | null> {
    const db = await getDB();
    return (await db.get('goals', id)) ?? null;
  }

  async getRevision(revisionId: string): Promise<GoalRevision | null> {
    const db = await getDB();
    return (await db.get('revisions', revisionId)) ?? null;
  }

  async listRevisionsForGoal(goalId: string): Promise<GoalRevision[]> {
    const db = await getDB();
    return db.getAllFromIndex('revisions', 'by-goalId', goalId);
  }

  async listAllRevisions(): Promise<GoalRevision[]> {
    const db = await getDB();
    return db.getAll('revisions');
  }

  async getRevisionForDate(goalId: string, dateStr: string): Promise<GoalRevision | null> {
    return pickRevisionForDate(await this.listRevisionsForGoal(goalId), dateStr);
  }

  async listAllDefinitions(): Promise<GoalDefinition[]> {
    const db = await getDB();
    return db.getAll('goals');
  }

  async listChildren(parentId: string | null): Promise<GoalDefinition[]> {
    const all = await this.listAllDefinitions();
    return all.filter((g) => g.parentId === parentId && !g.archivedAt);
  }

  async saveGoalWithRevision(definition: GoalDefinition, revision: GoalRevision): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['goals', 'revisions'], 'readwrite');
    await Promise.all([tx.objectStore('goals').put(definition), tx.objectStore('revisions').put(revision), tx.done]);
  }

  async updateDefinition(definition: GoalDefinition): Promise<void> {
    const db = await getDB();
    await db.put('goals', definition);
  }

  async updateRevision(revision: GoalRevision): Promise<void> {
    const db = await getDB();
    await db.put('revisions', revision);
  }

  async addRevision(revision: GoalRevision, closePreviousRevisionId?: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['goals', 'revisions'], 'readwrite');
    const revisions = tx.objectStore('revisions');

    if (closePreviousRevisionId) {
      const prev = await revisions.get(closePreviousRevisionId);
      if (prev) await revisions.put({ ...prev, effectiveTo: addDays(revision.effectiveFrom, -1) });
    }
    await revisions.put(revision);

    const goals = tx.objectStore('goals');
    const def = await goals.get(revision.goalId);
    if (def) {
      await goals.put({
        ...def,
        currentRevisionId: revision.id,
        parentId: revision.parentId,
        sortOrder: revision.sortOrder,
        updatedAt: new Date().toISOString(),
      });
    }
    await tx.done;
  }

  async deleteGoal(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('goals', 'readwrite');
    const def = await tx.store.get(id);
    if (def) await tx.store.put({ ...def, archivedAt: new Date().toISOString() });
    await tx.done;
  }
}
