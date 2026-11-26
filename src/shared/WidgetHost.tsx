import React, { useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { occurrenceService, goalRepo, reminderService } from '../application/container';
import { WidgetSyncService } from '../application/services/WidgetSyncService';
import { widgetsSupported, zielWidgets } from '../infrastructure/platform/widgets/ZielWidgets';
import { renderTilePng } from '../infrastructure/platform/widgets/iconPng';
import { useAppData } from './AppData';

const widgetSync = new WidgetSyncService(occurrenceService, goalRepo, () => reminderService.plan());

/**
 * Mantém os widgets do Android em sincronia com o app:
 *  - ao abrir/voltar ao app: aplica as marcações feitas nos widgets com o app fechado (regras normais do app);
 *  - a cada mudança nos dados: entrega o retrato novo (hoje + próximos dias) e as imagens dos ícones.
 */
export const WidgetHost: React.FC = () => {
  const { version, bump } = useAppData();
  const sentIcons = useRef(new Set<string>());
  const busy = useRef(false);
  const again = useRef(false);

  const drainAndApply = async () => {
    try {
      const { actions } = await zielWidgets.drainPending();
      if (!actions.length) return;
      if ((await widgetSync.applyActions(actions)) > 0) bump();
      // só confirma DEPOIS de aplicar: se o app fechar no meio, as marcações ficam na fila para a próxima vez
      await zielWidgets.ackPending(Math.max(...actions.map((a) => a.ts)));
    } catch (e) {
      console.warn('Ziel: falha ao ler marcações dos widgets', e);
    }
  };

  const publish = async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      await drainAndApply(); // nunca sobrescreve uma marcação do widget que ainda não foi aplicada
      const snap = await widgetSync.buildSnapshot();
      const icons: Record<string, string> = {};
      for (const [key, v] of await widgetSync.iconsNeeded()) {
        if (sentIcons.current.has(key)) continue;
        const png = await renderTilePng(v.icon, v.color);
        if (png) icons[key] = png;
        sentIcons.current.add(key);
      }
      await zielWidgets.saveSnapshot(JSON.stringify(snap), icons);
    } catch (e) {
      console.warn('Ziel: falha ao atualizar widgets', e);
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        void publish();
      }
    }
  };

  // a cada mudança de dados (com pequena espera para agrupar toques seguidos)
  useEffect(() => {
    if (!widgetsSupported()) return;
    const t = window.setTimeout(() => void publish(), 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // ao voltar para o app: traz as marcações feitas nos widgets
  useEffect(() => {
    if (!widgetsSupported()) return;
    const h = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void publish();
    });
    return () => {
      h.then((x) => x.remove()).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};
