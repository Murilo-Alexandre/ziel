import { NotificationPermission, NotificationPort } from '../../ports/NotificationPort';

/** Web/PWA: agendar avisos com o app fechado não é possível; o planejamento ainda pode ser pré-visualizado. */
export class NullNotificationAdapter implements NotificationPort {
  isSupported() {
    return false;
  }
  async getPermission(): Promise<NotificationPermission> {
    return 'denied';
  }
  async requestPermission(): Promise<NotificationPermission> {
    return 'denied';
  }
  async getPendingIds() {
    return [];
  }
  async schedule() {}
  async cancel() {}
  async canScheduleExact() {
    return true;
  }
  async openExactAlarmSettings() {}
  async notifyNow() {}
}
