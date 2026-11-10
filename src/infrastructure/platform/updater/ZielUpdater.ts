import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';

export type AppInfo = { packageName: string; versionName: string; versionCode: number; canInstall: boolean };

interface ZielUpdaterNative {
  getAppInfo(): Promise<AppInfo>;
  fetchText(opts: { url: string }): Promise<{ text: string }>;
  download(opts: { url: string; sha256: string; minVersionCode?: number }): Promise<{ sha256: string; size: number }>;
  install(): Promise<void>;
  openInstallSettings(): Promise<void>;
  addListener(event: 'downloadProgress', cb: (p: { received: number; total: number }) => void): Promise<PluginListenerHandle>;
}

const Native = registerPlugin<ZielUpdaterNative>('ZielUpdater');

/** Atualização pelo app só existe no Android (APK). Na web/PWA há só o aviso com link para a Release. */
export const isNativeUpdater = (): boolean => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const updater = {
  getAppInfo: (): Promise<AppInfo> => Native.getAppInfo(),
  fetchText: async (url: string): Promise<string> => (await Native.fetchText({ url })).text,
  download: (url: string, sha256: string, minVersionCode: number) => Native.download({ url, sha256, minVersionCode }),
  install: () => Native.install(),
  openInstallSettings: () => Native.openInstallSettings(),
  onProgress: (cb: (received: number, total: number) => void): Promise<PluginListenerHandle> =>
    Native.addListener('downloadProgress', (p) => cb(p.received, p.total)),
};
