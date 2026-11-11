import { DEFAULT_NOTIFICATION_SETTINGS, NotificationSettings } from '../../../domain/notifications/reminderPlanner';

const KEY = 'ziel.notifications.v1';

export interface NotificationSettingsStore {
  load(): NotificationSettings;
  save(s: NotificationSettings): void;
}

/** Preferências globais de notificação guardadas no aparelho (localStorage). */
export class LocalStorageSettingsStore implements NotificationSettingsStore {
  load(): NotificationSettings {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      if (raw && typeof raw === 'object') {
        const q = { ...DEFAULT_NOTIFICATION_SETTINGS.quietHours, ...(raw.quietHours ?? {}) };
        return {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...raw,
          quietHours: q,
          maxPerDay: Number(raw.maxPerDay) === 12 ? DEFAULT_NOTIFICATION_SETTINGS.maxPerDay : clamp(Number(raw.maxPerDay), 1, 100, DEFAULT_NOTIFICATION_SETTINGS.maxPerDay),
          maxTotal: Number(raw.maxTotal) === 120 ? DEFAULT_NOTIFICATION_SETTINGS.maxTotal : clamp(Number(raw.maxTotal), 10, 400, DEFAULT_NOTIFICATION_SETTINGS.maxTotal),
        };
      }
    } catch {
      /* ignora: usa padrões */
    }
    return { ...DEFAULT_NOTIFICATION_SETTINGS, quietHours: { ...DEFAULT_NOTIFICATION_SETTINGS.quietHours } };
  }
  save(s: NotificationSettings): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* sem armazenamento: não persiste */
    }
  }
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

export class MemorySettingsStore implements NotificationSettingsStore {
  constructor(private current: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS }) {}
  load() {
    return this.current;
  }
  save(s: NotificationSettings) {
    this.current = s;
  }
}
