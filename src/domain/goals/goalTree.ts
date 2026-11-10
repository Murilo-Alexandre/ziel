import { GoalDefinition, GoalRevision, Occurrence, CycleInstance } from '../types';

export type TodayGoalNode = {
  goal: GoalDefinition;
  revision: GoalRevision;
  /** Ocorrência do dia (null para metas-contêiner que só agrupam). */
  occurrence: Occurrence | null;
  cycleInstance: CycleInstance | null;
  children: TodayGoalNode[];
  depth: number;
  hasChildrenDueToday: boolean;
  /** A meta tem submetas cadastradas (mesmo que nenhuma vença hoje). */
  hasConfiguredChildren: boolean;
  evidenceCount: number;
};

/**
 * Valida que mover `childId` para `newParentId` não cria ciclo na hierarquia.
 */
export function validateNoHierarchyCycle(
  childId: string,
  newParentId: string | null,
  allGoals: GoalDefinition[]
): boolean {
  if (childId === newParentId) return false;
  if (!newParentId) return true;

  const parentMap = new Map<string, string | null>();
  allGoals.forEach((g) => parentMap.set(g.id, g.parentId));

  const visited = new Set<string>();
  let currentId: string | null = newParentId;
  while (currentId) {
    if (currentId === childId) return false;
    if (visited.has(currentId)) return false; // dados já corrompidos: recusa em vez de laço infinito
    visited.add(currentId);
    currentId = parentMap.get(currentId) ?? null;
  }
  return true;
}

export function listDescendantIds(goalId: string, allGoals: GoalDefinition[]): string[] {
  const byParent = new Map<string | null, GoalDefinition[]>();
  allGoals.forEach((g) => {
    if (!byParent.has(g.parentId)) byParent.set(g.parentId, []);
    byParent.get(g.parentId)!.push(g);
  });
  const out: string[] = [];
  const stack = [goalId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const child of byParent.get(id) ?? []) {
      out.push(child.id);
      stack.push(child.id);
    }
  }
  return out;
}

export type BuildTreeInput = {
  goals: GoalDefinition[];
  revisionsMap: Map<string, GoalRevision>;
  occurrencesMap: Map<string, Occurrence>; // goalId -> ocorrência do dia
  cycleInstancesMap: Map<string, CycleInstance>;
  evidenceCounts?: Map<string, number>; // occurrenceId -> nº de registros
};

/**
 * Árvore do dia. Um nó entra se tiver ocorrência própria no dia OU se tiver descendentes que entram.
 * Metas-contêiner NÃO aparecem em dias sem nada relevante (ex.: domingo sem atividades em "Treinar").
 * `showParentOnHome = false` faz as submetas devidas subirem de nível (aparecem independentes).
 */
export function buildTodayGoalTree(input: BuildTreeInput): TodayGoalNode[] {
  const { goals, revisionsMap, occurrencesMap, cycleInstancesMap, evidenceCounts } = input;

  const childrenMap = new Map<string | null, GoalDefinition[]>();
  goals.forEach((g) => {
    if (!childrenMap.has(g.parentId)) childrenMap.set(g.parentId, []);
    childrenMap.get(g.parentId)!.push(g);
  });
  childrenMap.forEach((list) => list.sort((a, b) => a.sortOrder - b.sortOrder));

  function dueOccurrence(goal: GoalDefinition): Occurrence | null {
    const occ = occurrencesMap.get(goal.id) ?? null;
    if (!occ || occ.overrideData?.isRemovedFromDate) return null;
    if (occ.source === 'quota_event' && occ.status === 'pending') {
      // Cota já cumprida no ciclo: não oferece mais um slot pendente.
      const ci = cycleInstancesMap.get(goal.id);
      if (ci?.computedStatus === 'completed') return null;
    }
    return occ;
  }

  function buildNodes(goal: GoalDefinition, depth: number, visited: Set<string>): TodayGoalNode[] {
    const revision = revisionsMap.get(goal.id);
    if (!revision || visited.has(goal.id)) return [];
    const path = new Set(visited).add(goal.id);

    const occurrence = dueOccurrence(goal);
    const configuredChildren = childrenMap.get(goal.id) ?? [];
    const shownAsOwnNode = revision.showParentOnHome || occurrence !== null;
    const childDepth = shownAsOwnNode ? depth + 1 : depth;

    const childNodes = configuredChildren.flatMap((c) => buildNodes(c, childDepth, path));
    if (!occurrence && childNodes.length === 0) return [];
    if (!shownAsOwnNode) return childNodes; // pai "invisível": submetas sobem de nível

    return [
      {
        goal,
        revision,
        occurrence,
        cycleInstance: cycleInstancesMap.get(goal.id) ?? null,
        children: childNodes,
        depth,
        hasChildrenDueToday: childNodes.length > 0,
        hasConfiguredChildren: configuredChildren.length > 0,
        evidenceCount: occurrence ? (evidenceCounts?.get(occurrence.id) ?? 0) : 0,
      },
    ];
  }

  return (childrenMap.get(null) ?? []).flatMap((root) => buildNodes(root, 0, new Set()));
}

/** Progresso do dia: média ponderada das ocorrências acionáveis (folhas) exibidas. */
export function computeDailyProgress(
  nodes: TodayGoalNode[],
  contributionOf: (occ: Occurrence, revision: GoalRevision) => number
): { progress: number; total: number; completed: number } {
  let weight = 0;
  let score = 0;
  let total = 0;
  let completed = 0;
  const items: { occ: Occurrence; revision: GoalRevision }[] = [];

  const walk = (list: TodayGoalNode[]) => {
    for (const n of list) {
      if (n.occurrence) items.push({ occ: n.occurrence, revision: n.revision });
      walk(n.children);
    }
  };
  walk(nodes);

  const hasRequired = items.some((i) => i.revision.isRequired);
  for (const { occ, revision } of items) {
    if (hasRequired && !revision.isRequired) continue;
    weight += 1;
    total += 1;
    score += contributionOf(occ, revision);
    if (occ.status === 'completed') completed += 1;
  }
  return { progress: weight > 0 ? score / weight : 0, total, completed };
}
