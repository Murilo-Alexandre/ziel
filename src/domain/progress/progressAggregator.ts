import { AggregationRule, CompletionRule, Occurrence, OccurrenceStatus } from '../types';

export const DEFAULT_PARTIAL_WEIGHT = 0.5;

/**
 * Returns numeric status value (0.0 to 1.0).
 */
export function getStatusNumericWeight(
  status: OccurrenceStatus,
  partialWeight: number = DEFAULT_PARTIAL_WEIGHT
): number {
  switch (status) {
    case 'completed':
      return 1.0;
    case 'partial':
      return partialWeight;
    case 'not_done':
      return 0.0;
    case 'pending':
      return 0.0;
    default:
      return 0.0;
  }
}

/**
 * Calculates raw quantity progress ratio clamped between 0.0 and 1.0.
 * Example: 2.5 L / 4.0 L = 0.625 (62.5%).
 */
export function calculateQuantityProgress(actual: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1.0, Math.max(0.0, actual / target));
}

/**
 * Calculates frequency quota progress ratio clamped between 0.0 and 1.0.
 * Example: 2 completed out of 3 required = 0.6667 (66.7%).
 */
export function calculateFrequencyQuotaProgress(completedCount: number, requiredCount: number): number {
  if (requiredCount <= 0) return 0;
  return Math.min(1.0, Math.max(0.0, completedCount / requiredCount));
}

export type ChildProgressInput = {
  goalId: string;
  isRequired: boolean;
  progress: number; // 0.0 to 1.0
  status: 'pending' | 'in_progress' | 'completed' | 'partial' | 'not_done';
  quantityValue?: number | null;
};

export type ProgressAggregationResult = {
  computedProgress: number; // 0.0 to 1.0
  computedStatus: 'pending' | 'in_progress' | 'completed' | 'not_done';
  completedCount: number;
  totalExpectedCount: number;
};

/**
 * Aggregates parent progress based on scheduled occurrences across a cycle window.
 */
export type AggregationOptions = {
  partialWeight?: number;
  /** Contribuição 0..1 de uma ocorrência (padrão: peso do status; metas de quantidade usam actual/alvo). */
  progressOf?: (occurrence: Occurrence) => number;
  /** Ocorrências opcionais não bloqueiam a regra "todos obrigatórios". */
  isRequiredOf?: (occurrence: Occurrence) => boolean;
  /** Ciclo já encerrado: se o critério não foi atingido, o resultado é "não realizado". */
  cycleEnded?: boolean;
};

export function aggregateScheduledOccurrencesProgress(
  occurrences: Occurrence[],
  completionRule: CompletionRule,
  options: AggregationOptions = {}
): ProgressAggregationResult {
  const partialWeight = options.partialWeight ?? DEFAULT_PARTIAL_WEIGHT;
  const progressOf = options.progressOf ?? ((o: Occurrence) => getStatusNumericWeight(o.status, partialWeight));
  const isRequiredOf = options.isRequiredOf ?? (() => true);
  const totalExpectedCount = occurrences.length;

  if (totalExpectedCount === 0) {
    return {
      computedProgress: 0,
      computedStatus: 'pending',
      completedCount: 0,
      totalExpectedCount: 0,
    };
  }

  let totalWeightedScore = 0;
  let completedCount = 0;

  for (const occ of occurrences) {
    totalWeightedScore += progressOf(occ);
    if (occ.status === 'completed') completedCount += 1;
  }

  const computedProgress = Math.min(1.0, Math.max(0.0, totalWeightedScore / totalExpectedCount));

  const required = occurrences.filter(isRequiredOf);
  const requiredSet = required.length > 0 ? required : occurrences;
  let met: boolean;
  switch (completionRule.type) {
    case 'minimumCount':
      met = completedCount >= completionRule.count;
      break;
    case 'minimumPercentage':
      met = computedProgress >= completionRule.percentage / 100;
      break;
    default:
      met = requiredSet.every((o) => o.status === 'completed');
  }

  let computedStatus: ProgressAggregationResult['computedStatus'];
  if (met) computedStatus = 'completed';
  else if (options.cycleEnded) computedStatus = 'not_done';
  else if (totalWeightedScore > 0) computedStatus = 'in_progress';
  else computedStatus = 'pending';

  return {
    computedProgress,
    computedStatus,
    completedCount,
    totalExpectedCount,
  };
}

/**
 * Frequencia flexivel (ex.: 3x por ciclo): o esperado e uma contagem, nao datas fixas.
 * Execucoes acima da cota nao passam de 100%.
 */
export function aggregateQuotaProgress(
  occurrences: Occurrence[],
  requiredCount: number,
  completionRule: CompletionRule,
  options: AggregationOptions = {}
): ProgressAggregationResult {
  const partialWeight = options.partialWeight ?? DEFAULT_PARTIAL_WEIGHT;
  const progressOf = options.progressOf ?? ((o: Occurrence) => getStatusNumericWeight(o.status, partialWeight));
  const best = [...occurrences].sort((a, b) => progressOf(b) - progressOf(a)).slice(0, requiredCount);
  const score = best.reduce((sum, o) => sum + progressOf(o), 0);
  const completedCount = best.filter((o) => o.status === 'completed').length;
  const computedProgress = calculateFrequencyQuotaProgress(score, requiredCount);

  let met: boolean;
  if (completionRule.type === 'minimumPercentage') met = computedProgress >= completionRule.percentage / 100;
  else if (completionRule.type === 'minimumCount') met = completedCount >= Math.min(completionRule.count, requiredCount);
  else met = completedCount >= requiredCount;

  let computedStatus: ProgressAggregationResult['computedStatus'];
  if (met) computedStatus = 'completed';
  else if (options.cycleEnded) computedStatus = 'not_done';
  else if (score > 0) computedStatus = 'in_progress';
  else computedStatus = 'pending';

  return { computedProgress, computedStatus, completedCount, totalExpectedCount: requiredCount };
}

/**
 * Aggregates parent progress based on direct child goals with custom weights or quantity rollups.
 */
export function aggregateDirectChildrenProgress(
  childrenInputs: ChildProgressInput[],
  aggregationRule: AggregationRule,
  completionRule: CompletionRule,
  options: Pick<AggregationOptions, 'cycleEnded'> = {}
): ProgressAggregationResult {
  const totalChildren = childrenInputs.length;

  if (totalChildren === 0) {
    return {
      computedProgress: 0,
      computedStatus: 'pending',
      completedCount: 0,
      totalExpectedCount: 0,
    };
  }

  let totalProgress = 0;
  let completedCount = 0;
  let totalWeightSum = 0;

  const childWeights =
    aggregationRule.type === 'directChildren' && aggregationRule.childWeights
      ? aggregationRule.childWeights
      : {};

  const excludeOptional = aggregationRule.type === 'directChildren' && aggregationRule.optionalContribution === 'exclude';

  for (const child of childrenInputs) {
    if (excludeOptional && !child.isRequired) continue;
    const weight = childWeights[child.goalId] ?? 1;
    totalWeightSum += weight;
    totalProgress += child.progress * weight;

    if (child.status === 'completed') {
      completedCount += 1;
    }
  }

  const computedProgress = totalWeightSum > 0 ? totalProgress / totalWeightSum : 0;

  let computedStatus: 'pending' | 'in_progress' | 'completed' | 'not_done' = 'pending';

  switch (completionRule.type) {
    case 'allRequired': {
      const requiredChildren = childrenInputs.filter((c) => c.isRequired);
      const allRequiredDone = requiredChildren.length > 0
        ? requiredChildren.every((c) => c.status === 'completed')
        : childrenInputs.every((c) => c.status === 'completed');

      if (allRequiredDone) {
        computedStatus = 'completed';
      } else if (totalProgress > 0) {
        computedStatus = 'in_progress';
      } else {
        computedStatus = 'pending';
      }
      break;
    }

    case 'minimumCount': {
      if (completedCount >= completionRule.count) {
        computedStatus = 'completed';
      } else if (totalProgress > 0) {
        computedStatus = 'in_progress';
      } else {
        computedStatus = 'pending';
      }
      break;
    }

    case 'minimumPercentage': {
      if (computedProgress >= completionRule.percentage / 100) {
        computedStatus = 'completed';
      } else if (totalProgress > 0) {
        computedStatus = 'in_progress';
      } else {
        computedStatus = 'pending';
      }
      break;
    }

    default: {
      if (completedCount === totalChildren) {
        computedStatus = 'completed';
      } else if (totalProgress > 0) {
        computedStatus = 'in_progress';
      } else {
        computedStatus = 'pending';
      }
      break;
    }
  }

  if (options.cycleEnded && computedStatus !== 'completed') computedStatus = 'not_done';

  return {
    computedProgress: Math.min(1.0, Math.max(0.0, computedProgress)),
    computedStatus,
    completedCount,
    totalExpectedCount: totalChildren,
  };
}
