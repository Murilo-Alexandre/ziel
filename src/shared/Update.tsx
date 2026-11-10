import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PluginListenerHandle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
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
  /** O aviso foi adiado ("Depois") para esta versão? */
  bannerHidden: boolean;
  lastChecked: number | null;
  check: (opts?: { silent?: boolean }) => Promise<void>;
  install: () => Promise<void>;
  /** "Depois": esconde o aviso desta versão por 24 h. */
  dismissBanner: () => void;
  openPermissionSettings: () => Promise<void>;
};

export const UpdateContext = createContext<Ctx | null>(null);
export const useUpdate = (): Ctx => {
  const c = useContext(UpdateContext);
  if (!c) throw new Error('useUpdate fora de UpdateProvider');
  return c;
};

export const LAST_CHECK_KEY = 'ziel.update.lastCheck';
export const SNOOZE_KEY = 'ziel.update.snooze';
export const FOUND_KEY = 'ziel.update.found';
/** Intervalo mínimo entre consultas automáticas ao GitHub. */
export const AUTO_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const SNOOZE_MS = 24 * 60 * 60 * 1000;

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

/** Já passou o intervalo mínimo desde a última consulta? (pura, testável) */
export function isCheckDue(lastCheck: number | null, now: number, interval = AUTO_INTERVAL_MS): boolean {
  return !lastCheck || now - lastCheck >= interval || lastCheck > now; // relógio voltou atrás => consulta
}

type Snooze = { tag: string; until: number };
const readSnooze = (): Snooze | null => {
  try {
    const v = JSON.parse(safeGet(SNOOZE_KEY) ?? 'null');
    return v && typeof v.tag === 'string' && typeof v.until === 'number' ? v : null;
  } catch {
    return null;
  }
};
const readFound = (): UpdateInfo | null => {
  try {
    const v = JSON.parse(safeGet(FOUND_KEY) ?? 'null');
    return v && typeof v.tag === 'string' && typeof v.versionCode === 'number' ? (v as UpdateInfo) : null;
  } catch {
    return null;
  }
};

export const UpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const native = isNativeUpdater();
  const [installed, setInstalled] = useState<AppInfo | null>(null);
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [snooze, setSnooze] = useState<Snooze | null>(readSnooze);
  const [lastChecked, setLastChecked] = useState<number | null>(() => Number(safeGet(LAST_CHECK_KEY)) || null);
  const [clock, setClock] = useState(() => Date.now());
  const busy = useRef(false);

  useEffect(() => {
    if (!native) return;
    updater.getAppInfo().then(setInstalled).catch(() => setInstalled(null));
  }, [native]);

  // Atualização já descoberta numa consulta anterior continua visível mesmo sem rede / sem nova consulta.
  useEffect(() => {
    if (!installed) return;
    const found = readFound();
    if (found && found.versionCode > installed.versionCode) {
      setUpdate(found);
      setStatus((s) => (s === 'idle' ? 'available' : s));
    } else if (found) {
      safeSet(FOUND_KEY, 'null'); // já instalada
    }
  }, [installed]);

  const check = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (busy.current) return;
      busy.current = true;
      if (!opts.silent) {
        setStatus('checking');
        setError(null);
      }
      try {
        const info = native ? (installed ?? (await updater.getAppInfo())) : null;
        if (info) setInstalled(info);
        const found = await checkForUpdate(info?.versionCode ?? Number.MAX_SAFE_INTEGER);
        const now = Date.now();
        safeSet(LAST_CHECK_KEY, String(now));
        setLastChecked(now);
        safeSet(FOUND_KEY, found ? JSON.stringify(found) : 'null');
        setUpdate(found);
        setStatus(found ? 'available' : 'uptodate');
      } catch (e) {
        // A consulta automática falha em silêncio (offline não atrapalha nada); a manual explica o motivo.
        if (!opts.silent) {
          setError(e instanceof UpdateCheckError ? e.message : 'Não foi possível verificar atualizações.');
          setStatus('error');
        } else setStatus((s) => (s === 'checking' ? 'idle' : s));
      } finally {
        busy.current = false;
      }
    },
    [native, installed]
  );

  // Verificação automática: ao abrir e ao voltar para o app, no máximo 1x a cada 24 h.
  const checkIfDue = useCallback(() => {
    setClock(Date.now());
    if (!native || !installed) return;
    const last = Number(safeGet(LAST_CHECK_KEY)) || null;
    if (isCheckDue(last, Date.now())) check({ silent: true });
  }, [native, installed, check]);

  useEffect(() => {
    checkIfDue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native, installed?.versionCode]);

  useEffect(() => {
    if (!native) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkIfDue();
    };
    document.addEventListener('visibilitychange', onVisible);
    let handle: PluginListenerHandle | null = null;
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) checkIfDue();
    }).then((h) => {
      handle = h;
    });
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      handle?.remove().catch(() => undefined);
    };
  }, [native, checkIfDue]);

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
    if (status === 'needs-permission') return doInstallIntent();
    let handle: PluginListenerHandle | null = null;
    try {
      setError(null);
      setProgress(0);
      setStatus('downloading');
      const sha = parseSha256(await updater.fetchText(update.sha256Url));
      if (!sha) throw new Error('O arquivo de verificação (SHA-256) da Release está inválido.');
      handle = await updater.onProgress((received, total) => setProgress(total > 0 ? received / total : 0));
      await updater.download(update.apkUrl, sha, update.versionCode);
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
    const s = { tag: update.tag, until: Date.now() + SNOOZE_MS };
    safeSet(SNOOZE_KEY, JSON.stringify(s));
    setSnooze(s);
    setClock(Date.now());
  }, [update]);

  const bannerHidden = !update || (snooze?.tag === update.tag && snooze.until > clock);

  const value = useMemo<Ctx>(
    () => ({ native, installed, status, update, progress, error, bannerHidden, lastChecked, check, install, dismissBanner, openPermissionSettings }),
    [native, installed, status, update, progress, error, bannerHidden, lastChecked, check, install, dismissBanner, openPermissionSettings]
  );

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
};
