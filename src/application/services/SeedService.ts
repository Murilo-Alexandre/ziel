import { GoalService } from './GoalService';
import { addDays, getWeekday, todayLocal } from '../../domain/dates';

/** Cenário de referência "Treinar" (exemplo opcional, criado só quando o usuário pede). */
export class SeedService {
  constructor(private goalService: GoalService) {}

  async seedTreinarScenario(today: string = todayLocal()): Promise<void> {
    // Início na segunda-feira da semana corrente, para a primeira semana já ter as 9 execuções.
    const dow = getWeekday(today);
    const monday = addDays(today, -((dow + 6) % 7));
    const period = { startDate: monday, endDate: null };
    const weekly = { type: 'weekly' as const, weekStartsOn: 1 as const };

    const { definition: parent } = await this.goalService.createGoal({
      name: 'Treinar',
      description: 'Treinos da semana',
      icon: 'Dumbbell',
      colorToken: '#3B82F6',
      activePeriod: period,
      trackingCycle: weekly,
      schedule: { type: 'custom', expression: 'container' },
      aggregationRule: { type: 'scheduledOccurrences', depth: 'direct', weightMode: 'equal' },
      completionRule: { type: 'allRequired' },
    });

    const children: { name: string; description: string; icon: string; color: string; days: (0 | 1 | 2 | 3 | 4 | 5 | 6)[] }[] = [
      { name: 'Futebol', description: 'Futebol com os amigos', icon: 'Trophy', color: '#10B981', days: [1, 3] },
      { name: 'Corrida', description: 'Corrida de 5 km', icon: 'Footprints', color: '#F59E0B', days: [2, 3, 4, 5] },
      { name: 'Musculação', description: 'Treino de força', icon: 'Dumbbell', color: '#8B5CF6', days: [3, 4, 5] },
    ];
    for (const c of children) {
      await this.goalService.addSubGoal(parent.id, {
        name: c.name,
        description: c.description,
        icon: c.icon,
        colorToken: c.color,
        activePeriod: period,
        trackingCycle: weekly,
        schedule: { type: 'weekdays', weekdays: c.days },
      });
    }
  }
}
