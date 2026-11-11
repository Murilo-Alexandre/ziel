import { GoalDefinition, GoalRevision } from '../../domain/types';

export interface GoalRepository {
  getDefinition(id: string): Promise<GoalDefinition | null>;
  getRevision(revisionId: string): Promise<GoalRevision | null>;
  /** Revisão vigente na data; null se a meta ainda não existia nela. */
  getRevisionForDate(goalId: string, dateStr: string): Promise<GoalRevision | null>;
  listRevisionsForGoal(goalId: string): Promise<GoalRevision[]>;
  listAllRevisions(): Promise<GoalRevision[]>;
  listAllDefinitions(): Promise<GoalDefinition[]>;
  listChildren(parentId: string | null): Promise<GoalDefinition[]>;
  saveGoalWithRevision(definition: GoalDefinition, revision: GoalRevision): Promise<void>;
  updateDefinition(definition: GoalDefinition): Promise<void>;
  updateRevision(revision: GoalRevision): Promise<void>;
  /** Fecha a revisão anterior (dia anterior ao início da nova) e adiciona a nova, de forma atômica. */
  addRevision(revision: GoalRevision, closePreviousRevisionId?: string): Promise<void>;
  /** Arquiva (não apaga histórico). */
  deleteGoal(id: string): Promise<void>;
  /** EXCLUI de verdade (irreversível): metas, revisões, ocorrências, ciclos, registros, anexos e trocas de status, numa transação. */
  purgeGoals(ids: string[]): Promise<void>;
}
