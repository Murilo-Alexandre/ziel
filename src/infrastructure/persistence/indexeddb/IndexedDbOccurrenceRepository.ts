import { OccurrenceRepository } from '../../ports/OccurrenceRepository';
import { CycleInstance, Occurrence, OccurrenceStatus } from '../../../domain/types';
import { getDB } from './database';
import { applyStatus } from '../occurrenceStatus';

export class IndexedDbOccurrenceRepository implements OccurrenceRepository {
  async findByDate(dateStr: string): Promise<Occurrence[]> {
    const db = await getDB();
    return db.getAllFromIndex('occurrences', 'by-scheduledDate', dateStr);
  }

  async findByGoalAndDate(goalId: string, dateStr: string): Promise<Occurrence | null> {
    const db = await getDB();
    const results = await db.getAllFromIndex('occurrences', 'by-goalAndDate', [goalId, dateStr]);
    return results.find((o) => o.slotKey === 'default') ?? null;
  }

  async listInRange(startAt: string, endAt: string): Promise<Occurrence[]> {
    const db = await getDB();
    return db.getAllFromIndex('occurrences', 'by-scheduledDate', IDBKeyRange.bound(startAt, endAt));
  }

  async getByKey(occurrenceKey: string): Promise<Occurrence | null> {
    const db = await getDB();
    return (await db.getFromIndex('occurrences', 'by-occurrenceKey', occurrenceKey)) ?? null;
  }

  async getById(id: string): Promise<Occurrence | null> {
    const db = await getDB();
    return (await db.get('occurrences', id)) ?? null;
  }

  /** Leitura + escrita na MESMA transação: chamadas concorrentes nunca duplicam nem violam o índice único. */
  async insertIfAbsent(occurrence: Occurrence): Promise<{ occurrence: Occurrence; created: boolean }> {
    const db = await getDB();
    const tx = db.transaction('occurrences', 'readwrite');
    const existing = await tx.store.index('by-occurrenceKey').get(occurrence.occurrenceKey);
    if (existing) {
      await tx.done;
      return { occurrence: existing, created: false };
    }
    await tx.store.put(occurrence);
    await tx.done;
    return { occurrence, created: true };
  }

  async saveOccurrence(occurrence: Occurrence): Promise<Occurrence> {
    const db = await getDB();
    await db.put('occurrences', occurrence); // índice único protege contra colisão de chave
    return occurrence;
  }

  async updateStatus(
    id: string,
    status: OccurrenceStatus,
    progressValue?: number | null,
    quantityValue?: number | null
  ): Promise<Occurrence> {
    const db = await getDB();
    const tx = db.transaction('occurrences', 'readwrite');
    const existing = await tx.store.get(id);
    if (!existing) {
      tx.abort();
      throw new Error(`Occurrence with ID ${id} not found.`);
    }
    const updated = applyStatus(existing, status, progressValue, quantityValue);
    await tx.store.put(updated);
    await tx.done;
    return updated;
  }

  async getCycleInstance(goalId: string, cycleKey: string): Promise<CycleInstance | null> {
    const db = await getDB();
    const instances = await db.getAllFromIndex('cycleInstances', 'by-cycleKey', cycleKey);
    return instances.find((ci) => ci.goalId === goalId) ?? null;
  }

  async saveCycleInstance(cycleInstance: CycleInstance): Promise<void> {
    const db = await getDB();
    await db.put('cycleInstances', cycleInstance);
  }

  async listCycleInstancesForGoal(goalId: string): Promise<CycleInstance[]> {
    const db = await getDB();
    return db.getAllFromIndex('cycleInstances', 'by-goalId', goalId);
  }

  async listOccurrencesForCycle(goalId: string, startAt: string, endAt: string): Promise<Occurrence[]> {
    const db = await getDB();
    return db.getAllFromIndex(
      'occurrences',
      'by-goalAndDate',
      IDBKeyRange.bound([goalId, startAt], [goalId, endAt])
    );
  }

  async listOccurrencesForGoal(goalId: string): Promise<Occurrence[]> {
    const db = await getDB();
    return db.getAllFromIndex('occurrences', 'by-goalId', goalId);
  }
}
