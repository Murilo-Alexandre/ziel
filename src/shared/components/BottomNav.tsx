import React, { useLayoutEffect, useRef } from 'react';
import { CalendarDays, Settings, Sun, Target } from 'lucide-react';
import { gsap, motionOK } from '../motion';

export type Tab = 'today' | 'agenda' | 'goals' | 'settings';

type Props = { activeTab: Tab; onTabChange: (t: Tab) => void };

const TABS: { key: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'today', label: 'Hoje', Icon: Sun },
  { key: 'agenda', label: 'Agenda', Icon: CalendarDays },
  { key: 'goals', label: 'Metas', Icon: Target },
  { key: 'settings', label: 'Ajustes', Icon: Settings },
];

/** Navegação flutuante em pílula (referência 9). O círculo amarelo desliza até a aba ativa (GSAP). */
export const BottomNav: React.FC<Props> = ({ activeTab, onTabChange }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const dot = dotRef.current;
    if (!track || !dot) return;
    const idx = TABS.findIndex((t) => t.key === activeTab);
    const btn = track.querySelectorAll('button')[idx] as HTMLElement | undefined;
    if (!btn) return;
    const x = btn.offsetLeft + btn.offsetWidth / 2 - dot.offsetWidth / 2;
    if (first.current || !motionOK()) {
      gsap.set(dot, { x });
      first.current = false;
    } else {
      gsap.to(dot, { x, duration: 0.5, ease: 'back.out(1.5)' });
      gsap.fromTo(btn, { scale: 0.86 }, { scale: 1, duration: 0.45, ease: 'back.out(2.2)' });
    }
  }, [activeTab]);

  // largura mudou (rotação/redimensionar): reposiciona o círculo sem animar
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const dot = dotRef.current;
      const idx = TABS.findIndex((t) => t.key === activeTab);
      const btn = track.querySelectorAll('button')[idx] as HTMLElement | undefined;
      if (dot && btn) gsap.set(dot, { x: btn.offsetLeft + btn.offsetWidth / 2 - dot.offsetWidth / 2 });
    });
    ro.observe(track);
    return () => ro.disconnect();
  }, [activeTab]);

  return (
    <nav
      aria-label="Navegação principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-6"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}
    >
      <div
        ref={trackRef}
        className="pointer-events-auto relative flex w-full max-w-[22rem] items-center justify-between rounded-full border border-white/5 bg-ziel-ink p-2 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)]"
      >
        <span ref={dotRef} aria-hidden className="absolute left-0 top-2 h-[52px] w-[52px] rounded-full bg-ziel-accent" />
        {TABS.map(({ key, label, Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              aria-label={label}
              title={label}
              aria-current={active ? 'page' : undefined}
              className={`relative z-10 flex h-[52px] w-[52px] items-center justify-center rounded-full transition-colors ${
                active ? 'text-ziel-ink' : 'text-ziel-sub'
              }`}
            >
              <Icon className="h-[22px] w-[22px]" />
            </button>
          );
        })}
      </div>
    </nav>
  );
};
