import { CycleInstance, Occurrence, OccurrenceStatus } from '../../domain/types';

export interface OccurrenceRepository {
  findByDate(dateStr: string): Promise<Occurrence[]>;
  findByGoalAndDate(goalId: string, dateStr: string): Promise<Occurrence | null>;
  listInRange(startAt: string, endAt: string): Promise<Occurrence[]>;
  getByKey(occurrenceKey: string): Promise<Occurrence | null>;
  getById(id: string): Promise<Occurrence | null>;
  /**
   * Inserção atômica e idempotente pela chave determinística: se já existe, devolve a existente
   * sem alterar nada (nunca sobrescreve status, evidências ou exceções).
   */
  insertIfAbsent(occurrence: Occurrence): Promise<{ occurrence: Occurrence; created: boolean }>;
  /** Persiste uma ocorrência existente (por id), inclusive se a chave/data mudou (remarcação). */
  saveOccurrence(occurrence: Occurrence): Promise<Occurrence>;
  updateStatus(
    id: string,
    status: OccurrenceStatus,
    progressValue?: number | null,
    quantityValue?: number | null
  ): Promise<Occurrence>;
  getCycleInstance(goalId: string, cycleKey: string): Promise<CycleInstance | null>;
  saveCycleInstance(cycleInstance: CycleInstance): Promise<void>;
  listCycleInstancesForGoal(goalId: string): Promise<CycleInstance[]>;
  listOccurrencesForCycle(goalId: string, startAt: string, endAt: string): Promise<Occurrence[]>;
  listOccurrencesForGoal(goalId: string): Promise<Occurrence[]>;
}
