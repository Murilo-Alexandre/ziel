import { OccurrenceRepository } from '../../ports/OccurrenceRepository';
import { CycleInstance, Occurrence, OccurrenceStatus } from '../../../domain/types';
import { applyStatus } from '../occurrenceStatus';

export class InMemoryOccurrenceRepository implements OccurrenceRepository {
  occurrences = new Map<string, Occurrence>();
  cycleInstances = new Map<string, CycleInstance>();

  private all() {
    return [...this.occurrences.values()];
  }
  async findByDate(d: string) {
    return this.all().filter((o) => o.scheduledDate === d);
  }
  async findByGoalAndDate(goalId: string, d: string) {
    return this.all().find((o) => o.goalId === goalId && o.scheduledDate === d && o.slotKey === 'default') ?? null;
  }
  async listInRange(a: string, b: string) {
    return this.all().filter((o) => o.scheduledDate >= a && o.scheduledDate <= b);
  }
  async getByKey(key: string) {
    return this.all().find((o) => o.occurrenceKey === key) ?? null;
  }
  async getById(id: string) {
    return this.occurrences.get(id) ?? null;
  }
  async insertIfAbsent(occ: Occurrence) {
    const existing = await this.getByKey(occ.occurrenceKey);
    if (existing) return { occurrence: existing, created: false };
    this.occurrences.set(occ.id, occ);
    return { occurrence: occ, created: true };
  }
  async saveOccurrence(occ: Occurrence) {
    const clash = this.all().find((o) => o.occurrenceKey === occ.occurrenceKey && o.id !== occ.id);
    if (clash) throw new Error(`Já existe uma ocorrência para ${occ.occurrenceKey}.`);
    this.occurrences.set(occ.id, occ);
    return occ;
  }
  async updateStatus(id: string, status: OccurrenceStatus, progress?: number | null, qty?: number | null) {
    const existing = this.occurrences.get(id);
    if (!existing) throw new Error(`Occurrence ${id} not found.`);
    const updated = applyStatus(existing, status, progress, qty);
    this.occurrences.set(id, updated);
    return updated;
  }
  async getCycleInstance(goalId: string, cycleKey: string) {
    return [...this.cycleInstances.values()].find((c) => c.goalId === goalId && c.cycleKey === cycleKey) ?? null;
  }
  async saveCycleInstance(ci: CycleInstance) {
    this.cycleInstances.set(ci.id, ci);
  }
  async listCycleInstancesForGoal(goalId: string) {
    return [...this.cycleInstances.values()].filter((c) => c.goalId === goalId);
  }
  async listOccurrencesForCycle(goalId: string, a: string, b: string) {
    return this.all().filter((o) => o.goalId === goalId && o.scheduledDate >= a && o.scheduledDate <= b);
  }
  async listOccurrencesForGoal(goalId: string) {
    return this.all().filter((o) => o.goalId === goalId);
  }
}
