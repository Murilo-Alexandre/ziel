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

  async purgeGoals(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const db = await getDB();
    const tx = db.transaction(['goals', 'revisions', 'occurrences', 'cycleInstances', 'journalRecords', 'attachments', 'statusChanges'], 'readwrite');
    const dropRecords = async (targetKey: string) => {
      for (const rec of await tx.objectStore('journalRecords').index('by-targetKey').getAll(targetKey)) {
        for (const key of await tx.objectStore('attachments').index('by-recordId').getAllKeys(rec.id)) await tx.objectStore('attachments').delete(key);
        await tx.objectStore('journalRecords').delete(rec.id);
      }
    };
    for (const id of ids) {
      for (const occ of await tx.objectStore('occurrences').index('by-goalId').getAll(id)) {
        for (const key of await tx.objectStore('statusChanges').index('by-occurrenceId').getAllKeys(occ.id)) await tx.objectStore('statusChanges').delete(key);
        await dropRecords(`occ:${occ.id}`);
        await tx.objectStore('occurrences').delete(occ.id);
      }
      for (const cyc of await tx.objectStore('cycleInstances').index('by-goalId').getAll(id)) {
        await dropRecords(`cycle:${cyc.id}`);
        await tx.objectStore('cycleInstances').delete(cyc.id);
      }
      for (const key of await tx.objectStore('revisions').index('by-goalId').getAllKeys(id)) await tx.objectStore('revisions').delete(key);
      await tx.objectStore('goals').delete(id);
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
