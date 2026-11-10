import React, { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { reminderService, notificationPort } from '../application/container';
import { todayLocal } from '../domain/dates';
import { useAppData } from './AppData';
import { useOverlays } from './Overlays';

/**
 * Mantém os lembretes do sistema sincronizados com os dados:
 *  - a cada mudança (status, edição, remarcação, exclusão…) — cancela na hora o que ficou obsoleto;
 *  - ao abrir o app e ao voltar para ele (renova a janela de dias à frente);
 *  - ao tocar numa notificação, abre os detalhes da meta.
 */
export const ReminderHost: React.FC = () => {
  const { version } = useAppData();
  const { openDetails } = useOverlays();

  useEffect(() => {
    reminderService.sync().catch((e) => console.warn('Ziel: falha ao sincronizar lembretes', e));
  }, [version]);

  useEffect(() => {
    if (!notificationPort.isSupported()) return;
    const handles: { remove: () => Promise<void> }[] = [];
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) reminderService.sync().catch(() => undefined);
    }).then((h) => handles.push(h));
    LocalNotifications.addListener('localNotificationActionPerformed', (ev) => {
      const extra = ev.notification.extra as { goalId?: string; date?: string } | undefined;
      if (extra?.goalId) openDetails({ goalId: extra.goalId, date: extra.date ?? todayLocal(), occurrenceId: null });
    }).then((h) => handles.push(h));
    return () => {
      handles.forEach((h) => h.remove().catch(() => undefined));
    };
  }, [openDetails]);

  return null;
};
