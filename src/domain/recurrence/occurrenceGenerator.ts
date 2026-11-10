import { GoalDefinition, GoalRevision, Occurrence } from '../types';
import { isQuotaAvailableOn, scheduleMatchesDate } from './scheduleEvaluator';

/**
 * Chave determinística do slot lógico. NÃO inclui a revisão: editar a definição
 * ("esta e as próximas") nunca pode criar uma segunda ocorrência para o mesmo dia/slot.
 */
export function computeOccurrenceKey(goalId: string, scheduledDate: string, slotKey: string = 'default'): string {
  return `${goalId}_${scheduledDate}_${slotKey}`;
}

export function buildGeneratedOccurrence(
  definition: GoalDefinition,
  revision: GoalRevision,
  scheduledDate: string,
  slotKey: string = 'default',
  source: Occurrence['source'] = 'generated'
): Occurrence {
  const now = new Date().toISOString();
  const occurrenceKey = computeOccurrenceKey(definition.id, scheduledDate, slotKey);
  const time = 'time' in revision.schedule ? revision.schedule.time : undefined;

  return {
    id: `occ_${occurrenceKey}`,
    goalId: definition.id,
    revisionId: revision.id,
    cycleInstanceId: null,
    scheduledDate,
    scheduledTime: time ?? null,
    slotKey,
    occurrenceKey,
    source,
    status: 'pending',
    progressValue: null,
    quantityValue: null,
    completedAt: null,
    lastStatusChangedAt: null,
    createdAt: now,
    updatedAt: now,
    overrideData: null,
    rescheduledFrom: null,
  };
}

/**
 * Função pura: ocorrências esperadas para um dia. Metas de frequência flexível (quota)
 * recebem um slot "disponível" por dia (source 'quota_event'), sem inventar datas fixas;
 * o esperado delas é a contagem por ciclo.
 */
export function generateExpectedOccurrencesForDate(
  goalsWithRevisions: { definition: GoalDefinition; revision: GoalRevision }[],
  targetDateStr: string
): Occurrence[] {
  const occurrences: Occurrence[] = [];

  for (const { definition, revision } of goalsWithRevisions) {
    if (definition.archivedAt) continue;

    if (scheduleMatchesDate(targetDateStr, revision.schedule, revision.activePeriod)) {
      occurrences.push(buildGeneratedOccurrence(definition, revision, targetDateStr));
    } else if (isQuotaAvailableOn(targetDateStr, revision.schedule, revision.activePeriod)) {
      occurrences.push(buildGeneratedOccurrence(definition, revision, targetDateStr, 'default', 'quota_event'));
    }
  }

  return occurrences;
}
