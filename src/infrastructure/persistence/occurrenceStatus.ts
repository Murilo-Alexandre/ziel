import { Occurrence, OccurrenceStatus } from '../../domain/types';

/** Transição pura de status (compartilhada pelos repositórios). */
export function applyStatus(
  existing: Occurrence,
  status: OccurrenceStatus,
  progressValue?: number | null,
  quantityValue?: number | null
): Occurrence {
  const now = new Date().toISOString();
  return {
    ...existing,
    status,
    progressValue: progressValue !== undefined ? progressValue : existing.progressValue,
    quantityValue: quantityValue !== undefined ? quantityValue : existing.quantityValue,
    completedAt: status === 'completed' ? now : status === 'pending' ? null : existing.completedAt,
    lastStatusChangedAt: now,
    updatedAt: now,
  };
}
