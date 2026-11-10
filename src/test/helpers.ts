import { InMemoryGoalRepository } from '../infrastructure/persistence/memory/InMemoryGoalRepository';
import { InMemoryOccurrenceRepository } from '../infrastructure/persistence/memory/InMemoryOccurrenceRepository';
import { InMemoryJournalRepository } from '../infrastructure/persistence/memory/InMemoryJournalRepository';
import { GoalService, CreateGoalInput } from '../application/services/GoalService';
import { OccurrenceService } from '../application/services/OccurrenceService';
import { JournalService } from '../application/services/JournalService';
import { TodayGoalNode } from '../domain/goals/goalTree';
import { Weekday } from '../domain/types';

export const PERIOD = { startDate: '2026-08-01', endDate: null };
export const WEEKLY = { type: 'weekly' as const, weekStartsOn: 1 as Weekday };
// Semana de referência: segunda 17/08/2026 .. domingo 23/08/2026
export const WEEK = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'];

/** Mundo isolado em memória com relógio injetado (nada depende da data real da máquina). */
export function makeWorld(today = '2026-08-19') {
  const clock = { today };
  const goalRepo = new InMemoryGoalRepository();
  const occRepo = new InMemoryOccurrenceRepository();
  const journalRepo = new InMemoryJournalRepository();
  const goals = new GoalService(goalRepo, () => clock.today);
  const occ = new OccurrenceService(goalRepo, occRepo, journalRepo, () => clock.today);
  const journal = new JournalService(journalRepo);
  return { clock, goalRepo, occRepo, journalRepo, goals, occ, journal };
}
export type World = ReturnType<typeof makeWorld>;

export async function createTreinar(w: World, parentOverrides: Partial<CreateGoalInput> = {}) {
  const { definition: parent } = await w.goals.createGoal({
    name: 'Treinar',
    trackingCycle: WEEKLY,
    activePeriod: PERIOD,
    schedule: { type: 'custom', expression: 'container' },
    ...parentOverrides,
  });
  const mk = (name: string, weekdays: Weekday[]) =>
    w.goals.addSubGoal(parent.id, { name, trackingCycle: WEEKLY, schedule: { type: 'weekdays', weekdays }, activePeriod: PERIOD });
  const futebol = (await mk('Futebol', [1, 3])).definition;
  const corrida = (await mk('Corrida', [2, 3, 4, 5])).definition;
  const musculacao = (await mk('Musculação', [3, 4, 5])).definition;
  return { parent, futebol, corrida, musculacao };
}

export const names = (nodes: TodayGoalNode[]) => nodes.map((n) => n.revision.name);

export function flatten(nodes: TodayGoalNode[]): TodayGoalNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

/** Marca como concluídas as ocorrências de um dia (por nome). */
export async function completeOn(w: World, date: string, onlyNames?: string[]) {
  const { nodes } = await w.occ.getTodayGoalTree(date);
  for (const n of flatten(nodes)) {
    if (n.occurrence && (!onlyNames || onlyNames.includes(n.revision.name))) {
      await w.occ.updateStatus(n.occurrence.id, 'completed');
    }
  }
}
