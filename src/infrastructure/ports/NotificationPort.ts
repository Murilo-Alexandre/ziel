import { PlannedReminder } from '../../domain/notifications/reminderPlanner';

export type NotificationPermission = 'granted' | 'denied' | 'prompt';

/** Notificações locais agendadas no sistema (disparam com o app fechado e sem internet). */
export interface NotificationPort {
  /** false na web/PWA: lá não é possível agendar avisos com o app fechado. */
  isSupported(): boolean;
  getPermission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  /** Ids dos agendamentos ainda pendentes (todos pertencem ao Ziel). */
  getPendingIds(): Promise<number[]>;
  schedule(items: PlannedReminder[]): Promise<void>;
  cancel(ids: number[]): Promise<void>;
  /** Android 12+: alarmes exatos permitidos? (false => avisos podem atrasar alguns minutos) */
  canScheduleExact(): Promise<boolean>;
  openExactAlarmSettings(): Promise<void>;
  /** Dispara uma notificação de teste agora. */
  notifyNow(title: string, body: string): Promise<void>;
}
