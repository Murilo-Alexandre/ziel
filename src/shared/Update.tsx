import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PluginListenerHandle } from '@capacitor/core';
import { UpdateInfo, checkForUpdate, parseSha256, UpdateCheckError } from '../application/services/UpdateService';
import { AppInfo, isNativeUpdater, updater } from '../infrastructure/platform/updater/ZielUpdater';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'uptodate'
  | 'available'
  | 'downloading'
  | 'verifying'
  | 'needs-permission'
  | 'installing'
  | 'error';

type Ctx = {
  native: boolean;
  installed: AppInfo | null;
  status: UpdateStatus;
  update: UpdateInfo | null;
  progress: number; // 0..1 durante o download
  error: string | null;
  /** O aviso discreto já foi dispensado para esta versão? */
  bannerHidden: boolean;
  lastChecked: number | null;
  check: (opts?: { silent?: boolean }) => Promise<void>;
  install: () => Promise<void>;
  dismissBanner: () => void;
  openPermissionSettings: () => Promise<void>;
};

export const UpdateContext = createContext<Ctx | null>(null);
export const useUpdate = (): Ctx => {
  const c = useContext(UpdateContext);
  if (!c) throw new Error('useUpdate fora de UpdateProvider');
  return c;
};

const LAST_CHECK_KEY = 'ziel.update.lastCheck';
const DISMISSED_KEY = 'ziel.update.dismissed';
const AUTO_INTERVAL_MS = 12 * 60 * 60 * 1000;

const safeGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* sem armazenamento: só não lembra */
  }
};

export const UpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const native = isNativeUpdater();
  const [installed, setInstalled] = useState<AppInfo | null>(null);
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(() => safeGet(DISMISSED_KEY));
  const [lastChecked, setLastChecked] = useState<number | null>(() => Number(safeGet(LAST_CHECK_KEY)) || null);
  const busy = useRef(false);

  useEffect(() => {
    if (!native) return;
    updater.getAppInfo().then(setInstalled).catch(() => setInstalled(null));
  }, [native]);

  const check = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (busy.current) return;
      busy.current = true;
      if (!opts.silent) {
        setStatus('checking');
        setError(null);
      }
      try {
        // Sem a versão instalada (web/PWA) não dá para comparar: trata como 0 só para exibir a última release.
        const info = native ? (installed ?? (await updater.getAppInfo())) : null;
        if (info) setInstalled(info);
        const found = await checkForUpdate(info?.versionCode ?? Number.MAX_SAFE_INTEGER);
        const now = Date.now();
        safeSet(LAST_CHECK_KEY, String(now));
        setLastChecked(now);
        setUpdate(found);
        setStatus(found ? 'available' : 'uptodate');
      } catch (e) {
        // verificação automática falha em silêncio; a manual mostra o motivo
        if (!opts.silent) {
          setError(e instanceof UpdateCheckError ? e.message : 'Não foi possível verificar atualizações.');
          setStatus('error');
        } else setStatus('idle');
      } finally {
        busy.current = false;
      }
    },
    [native, installed]
  );

  // verificação automática ao abrir (no máx. a cada 12 h), só no app Android
  useEffect(() => {
    if (!native || !installed) return;
    const last = Number(safeGet(LAST_CHECK_KEY)) || 0;
    if (Date.now() - last > AUTO_INTERVAL_MS) check({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native, installed?.versionCode]);

  const doInstallIntent = useCallback(async () => {
    try {
      await updater.install();
      setStatus('installing');
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'NEEDS_PERMISSION') setStatus('needs-permission');
      else {
        setError(err.message ?? 'Não foi possível abrir o instalador.');
        setStatus('error');
      }
    }
  }, []);

  const install = useCallback(async () => {
    if (!update || !native) return;
    // Já baixado e aguardando permissão: só reabre o instalador.
    if (status === 'needs-permission') return doInstallIntent();
    let handle: PluginListenerHandle | null = null;
    try {
      setError(null);
      setProgress(0);
      setStatus('downloading');
      const sha = parseSha256(await updater.fetchText(update.sha256Url));
      if (!sha) throw new Error('O arquivo de verificação (SHA-256) da Release está inválido.');
      handle = await updater.onProgress((received, total) => setProgress(total > 0 ? received / total : 0));
      const done = updater.download(update.apkUrl, sha, update.versionCode);
      await done;
      setProgress(1);
      setStatus('verifying');
      await doInstallIntent();
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message ?? 'A atualização falhou.');
      setStatus('error');
    } finally {
      await handle?.remove();
    }
  }, [update, native, status, doInstallIntent]);

  const openPermissionSettings = useCallback(() => updater.openInstallSettings(), []);

  const dismissBanner = useCallback(() => {
    if (!update) return;
    safeSet(DISMISSED_KEY, update.tag);
    setDismissed(update.tag);
  }, [update]);

  const value = useMemo<Ctx>(
    () => ({
      native,
      installed,
      status,
      update,
      progress,
      error,
      bannerHidden: !update || dismissed === update.tag,
      lastChecked,
      check,
      install,
      dismissBanner,
      openPermissionSettings,
    }),
    [native, installed, status, update, progress, error, dismissed, lastChecked, check, install, dismissBanner, openPermissionSettings]
  );

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
};
