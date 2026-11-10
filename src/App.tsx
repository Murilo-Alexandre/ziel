import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TodayView } from './features/today/TodayView';
import { AgendaView } from './features/agenda/AgendaView';
import { GoalsLibraryView } from './features/goals/GoalsLibraryView';
import { SettingsView } from './features/settings/SettingsView';
import { BottomNav, Tab } from './shared/components/BottomNav';
import { AppDataProvider } from './shared/AppData';
import { OverlayProvider } from './shared/Overlays';
import { ToastProvider } from './shared/ui/Toast';
import { UpdateProvider } from './shared/Update';
import { ReminderHost } from './shared/ReminderHost';
import { gsap, installPressFeedback, motionOK } from './shared/motion';
import { getDB, requestPersistentStorage } from './infrastructure/persistence/indexeddb/database';

type BootState = { status: 'loading' } | { status: 'ready'; persisted: boolean } | { status: 'error'; message: string };

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('today');
  const [boot, setBoot] = useState<BootState>({ status: 'loading' });
  const mainRef = useRef<HTMLElement>(null);
  const firstTab = useRef(true);
  useLayoutEffect(() => {
    if (firstTab.current) {
      firstTab.current = false;
      return;
    }
    if (mainRef.current && motionOK()) gsap.fromTo(mainRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, [tab]);

  useEffect(() => installPressFeedback(), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await getDB(); // falha de armazenamento aparece aqui, nunca é mascarada
        const persisted = await requestPersistentStorage();
        if (alive) setBoot({ status: 'ready', persisted });
      } catch (e) {
        if (alive) setBoot({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (boot.status === 'loading') {
    return (
      <div className="flex min-h-screen min-h-dvh items-center justify-center text-sm text-ziel-muted" aria-busy="true">
        Abrindo o Ziel…
      </div>
    );
  }

  if (boot.status === 'error') {
    return (
      <div role="alert" className="mx-auto flex min-h-screen min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-bold text-ziel-danger">Não foi possível abrir seus dados</h1>
        <p className="text-sm text-ziel-muted">O armazenamento local do aparelho não respondeu. Nada foi apagado. Feche e abra o app novamente.</p>
        <p className="break-words rounded-chip bg-ziel-raised px-3 py-2 text-xs text-ziel-sub">{boot.message}</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <ToastProvider>
      <AppDataProvider>
        <UpdateProvider>
        <OverlayProvider>
          <ReminderHost />
          <main ref={mainRef}>
            {tab === 'today' && <TodayView />}
            {tab === 'agenda' && <AgendaView />}
            {tab === 'goals' && <GoalsLibraryView />}
            {tab === 'settings' && <SettingsView storagePersisted={boot.persisted} />}
          </main>
          <BottomNav activeTab={tab} onTabChange={setTab} />
        </OverlayProvider>
        </UpdateProvider>
      </AppDataProvider>
    </ToastProvider>
  );
};

export default App;
