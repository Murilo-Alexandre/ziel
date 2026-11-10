import { GoalRevision } from '../types';

/** Revisão vigente numa data (a de `effectiveFrom` mais recente entre as que cobrem a data). */
export function pickRevisionForDate(revisions: GoalRevision[], dateStr: string): GoalRevision | null {
  const matching = revisions
    .filter((r) => r.effectiveFrom <= dateStr && (!r.effectiveTo || r.effectiveTo >= dateStr))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return matching[0] ?? null;
}
