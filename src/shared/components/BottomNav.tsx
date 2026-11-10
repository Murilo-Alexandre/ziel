import React, { useLayoutEffect, useRef } from 'react';
import { CalendarDays, Plus, Settings, Sun, Target } from 'lucide-react';
import { gsap, motionOK } from '../motion';
import { useOverlays } from '../Overlays';

export type Tab = 'today' | 'agenda' | 'goals' | 'settings';

type Props = { activeTab: Tab; onTabChange: (t: Tab) => void };

const TABS: { key: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'today', label: 'Hoje', Icon: Sun },
  { key: 'agenda', label: 'Agenda', Icon: CalendarDays },
  { key: 'goals', label: 'Metas', Icon: Target },
  { key: 'settings', label: 'Ajustes', Icon: Settings },
];

/** Barra inferior com ícone + rótulo (referência 4) e botão "+" coral. Indicador desliza com GSAP. */
export const BottomNav: React.FC<Props> = ({ activeTab, onTabChange }) => {
  const { openEditor } = useOverlays();
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  const place = (animate: boolean) => {
    const track = trackRef.current;
    const bar = barRef.current;
    if (!track || !bar) return;
    const idx = TABS.findIndex((t) => t.key === activeTab);
    const btn = track.querySelectorAll('button')[idx] as HTMLElement | undefined;
    if (!btn) return;
    const x = btn.offsetLeft + btn.offsetWidth / 2 - bar.offsetWidth / 2;
    if (!animate || !motionOK()) gsap.set(bar, { x });
    else {
      gsap.to(bar, { x, duration: 0.5, ease: 'back.out(1.6)' });
      const icon = btn.querySelector('svg');
      if (icon) gsap.fromTo(icon, { y: 4, scale: 0.8 }, { y: 0, scale: 1, duration: 0.5, ease: 'back.out(2.4)', clearProps: 'transform' });
    }
  };

  useLayoutEffect(() => {
    place(!first.current);
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(track);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <nav
      aria-label="Navegação principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    >
      <div className="pointer-events-auto flex w-full max-w-[26rem] items-end gap-3">
        <div ref={trackRef} className="relative flex flex-1 items-center rounded-[28px] border border-white/[0.08] bg-ziel-surface/95 px-2 pb-1.5 pt-2.5 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.9)] backdrop-blur">
          <span ref={barRef} aria-hidden className="absolute left-0 top-0 h-1 w-8 rounded-b-full bg-ziel-accent" />
          {TABS.map(({ key, label, Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTabChange(key)}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${active ? 'text-ziel-accent' : 'text-ziel-muted'}`}
              >
                <Icon className="h-[22px] w-[22px]" />
                <span className="text-[11px] font-bold leading-none">{label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => openEditor({ kind: 'create', parentId: null })}
          aria-label="Nova meta"
          className="mb-1 flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full bg-ziel-accent text-ziel-ink shadow-[0_14px_30px_-8px_rgba(242,139,130,0.85)]"
        >
          <Plus className="h-7 w-7" strokeWidth={2.6} />
        </button>
      </div>
    </nav>
  );
};
