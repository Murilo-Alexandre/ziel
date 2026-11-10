import { GoalRepository } from '../../infrastructure/ports/GoalRepository';
import { OccurrenceRepository } from '../../infrastructure/ports/OccurrenceRepository';
import { NotificationPort, NotificationPermission } from '../../infrastructure/ports/NotificationPort';
import { NotificationSettingsStore } from '../../infrastructure/platform/notifications/settingsStore';
import { NotificationSettings, PlannedReminder, planReminders } from '../../domain/notifications/reminderPlanner';
import { GoalDefinition, GoalRevision } from '../../domain/types';
import { addDays, formatLocalDate } from '../../domain/dates';

export type SyncResult = { skipped: 'unsupported' | 'no-permission' | null; scheduled: number; cancelled: number; pending: number };

/** Metas visíveis: não arquivadas e sem ancestral arquivado. */
export function visibleGoals(defs: GoalDefinition[]): GoalDefinition[] {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const hidden = (d: GoalDefinition): boolean => {
    const seen = new Set<string>();
    let cur: GoalDefinition | undefined = d;
    while (cur) {
      if (cur.archivedAt || seen.has(cur.id)) return true;
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return false;
  };
  return defs.filter((d) => !hidden(d));
}

/**
 * Mantém os agendamentos do sistema em sincronia com o estado real das metas.
 * É idempotente: ids determinísticos + diff com o que já está pendente => chamar N vezes não duplica nada.
 * Concluir/alterar/remover/remarcar uma meta => `sync()` cancela o que ficou obsoleto e agenda o que faltava.
 */
export class ReminderService {
  /** Fila: duas sincronizações nunca se intercalam. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private goalRepo: GoalRepository,
    private occRepo: OccurrenceRepository,
    private port: NotificationPort,
    private settings: NotificationSettingsStore,
    private now: () => Date = () => new Date()
  ) {}

  getSettings(): NotificationSettings {
    return this.settings.load();
  }

  updateSettings(patch: Partial<NotificationSettings>): NotificationSettings {
    const cur = this.settings.load();
    const next = { ...cur, ...patch, quietHours: { ...cur.quietHours, ...(patch.quietHours ?? {}) } };
    this.settings.save(next);
    return next;
  }

  /** Plano atual (puro leitura): serve para prévia e para o sync. */
  async plan(): Promise<PlannedReminder[]> {
    const settings = this.settings.load();
    const now = this.now();
    const start = formatLocalDate(now);
    const [defs, revs, occs] = await Promise.all([
      this.goalRepo.listAllDefinitions(),
      this.goalRepo.listAllRevisions(),
      this.occRepo.listInRange(start, addDays(start, settings.horizonDays)),
    ]);
    const revisionsByGoal = new Map<string, GoalRevision[]>();
    for (const r of revs) revisionsByGoal.set(r.goalId, [...(revisionsByGoal.get(r.goalId) ?? []), r]);
    return planReminders({ now, goals: visibleGoals(defs), revisionsByGoal, occurrences: occs, settings });
  }

  async permission(): Promise<NotificationPermission> {
    return this.port.getPermission();
  }

  async requestPermission(): Promise<NotificationPermission> {
    return this.port.requestPermission();
  }

  sync(): Promise<SyncResult> {
    const run = this.queue.then(() => this.doSync(), () => this.doSync());
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async doSync(): Promise<SyncResult> {
    if (!this.port.isSupported()) return { skipped: 'unsupported', scheduled: 0, cancelled: 0, pending: 0 };
    const pending = await this.port.getPendingIds();
    const settings = this.settings.load();

    // Interruptor geral desligado: nada deve ficar agendado.
    if (!settings.enabled) {
      await this.port.cancel(pending);
      return { skipped: null, scheduled: 0, cancelled: pending.length, pending: 0 };
    }
    if ((await this.port.getPermission()) !== 'granted') {
      return { skipped: 'no-permission', scheduled: 0, cancelled: 0, pending: pending.length };
    }

    const planned = await this.plan();
    const wanted = new Set(planned.map((p) => p.id));
    const have = new Set(pending);
    const toCancel = pending.filter((id) => !wanted.has(id));
    const toSchedule = planned.filter((p) => !have.has(p.id));

    await this.port.cancel(toCancel); // primeiro cancela (concluídas/removidas/alteradas)…
    await this.port.schedule(toSchedule); // …depois agenda o que faltava
    return { skipped: null, scheduled: toSchedule.length, cancelled: toCancel.length, pending: wanted.size };
  }

  /** Cancela tudo (ex.: usuário desativou as notificações). */
  async cancelAll(): Promise<void> {
    if (!this.port.isSupported()) return;
    await this.port.cancel(await this.port.getPendingIds());
  }
}
