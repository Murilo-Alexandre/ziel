import { Capacitor, registerPlugin } from '@capacitor/core';

export type WidgetPendingAction = { goalId: string; date: string; status?: 'pending' | 'partial' | 'completed' | 'not_done'; qty?: number; comment?: string; id?: string; ts: number };

interface ZielWidgetsPlugin {
  /** Entrega o retrato do app ao widget (e as imagens dos ícones, base64 PNG por chave). */
  saveSnapshot(opts: { json: string; icons: Record<string, string> }): Promise<void>;
  /** Marcações feitas nos widgets com o app fechado (a fila só esvazia quando o app confirma com ackPending). */
  drainPending(): Promise<{ actions: WidgetPendingAction[] }>;
  /** Confirma que as marcações até `upTo` (timestamp) já foram aplicadas no app. */
  ackPending(opts: { upTo: number }): Promise<void>;
}

const plugin = registerPlugin<ZielWidgetsPlugin>('ZielWidgets');

export const widgetsSupported = (): boolean => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const zielWidgets = {
  saveSnapshot: (json: string, icons: Record<string, string>) => plugin.saveSnapshot({ json, icons }),
  drainPending: () => plugin.drainPending(),
  ackPending: (upTo: number) => plugin.ackPending({ upTo }),
};
