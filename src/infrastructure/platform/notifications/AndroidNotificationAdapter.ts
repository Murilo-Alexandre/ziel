import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { NotificationPermission, NotificationPort } from '../../ports/NotificationPort';
import { PlannedReminder } from '../../../domain/notifications/reminderPlanner';

export const CHANNEL_ID = 'ziel-lembretes';
const SMALL_ICON = 'ic_stat_ziel';

const mapPerm = (p: string): NotificationPermission => (p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt');

/** Notificações locais do Android (AlarmManager via @capacitor/local-notifications). Sobrevivem ao fechamento do app e à reinicialização. */
export class AndroidNotificationAdapter implements NotificationPort {
  private channelReady = false;

  isSupported(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  private async ensureChannel() {
    if (this.channelReady) return;
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Lembretes de metas',
      description: 'Avisos antes e depois do horário estimado das suas metas',
      importance: 4,
      visibility: 1,
      vibration: true,
    });
    this.channelReady = true;
  }

  async getPermission(): Promise<NotificationPermission> {
    return mapPerm((await LocalNotifications.checkPermissions()).display);
  }

  async requestPermission(): Promise<NotificationPermission> {
    return mapPerm((await LocalNotifications.requestPermissions()).display);
  }

  async getPendingIds(): Promise<number[]> {
    return (await LocalNotifications.getPending()).notifications.map((n) => n.id);
  }

  async schedule(items: PlannedReminder[]): Promise<void> {
    if (!items.length) return;
    await this.ensureChannel();
    await LocalNotifications.schedule({
      notifications: items.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        channelId: CHANNEL_ID,
        smallIcon: SMALL_ICON,
        schedule: { at: new Date(r.fireAt), allowWhileIdle: true },
        extra: { goalId: r.goalId, date: r.date, occurrenceKey: r.occurrenceKey },
      })),
    });
  }

  async cancel(ids: number[]): Promise<void> {
    if (!ids.length) return;
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  }

  async canScheduleExact(): Promise<boolean> {
    try {
      return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
    } catch {
      return true;
    }
  }

  async openExactAlarmSettings(): Promise<void> {
    await LocalNotifications.changeExactNotificationSetting();
  }

  async notifyNow(title: string, body: string): Promise<void> {
    await this.ensureChannel();
    await LocalNotifications.schedule({
      notifications: [{ id: 2_000_000_001, title, body, channelId: CHANNEL_ID, smallIcon: SMALL_ICON, schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true } }],
    });
  }
}
