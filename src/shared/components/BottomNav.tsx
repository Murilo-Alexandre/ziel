import React from 'react';
import { CalendarDays, Plus, Settings, Sun, Target } from 'lucide-react';

export type Tab = 'today' | 'agenda' | 'goals' | 'settings';

type Props = { activeTab: Tab; onTabChange: (t: Tab) => void; onNew: () => void };

const LEFT: { key: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'today', label: 'Hoje', Icon: Sun },
  { key: 'agenda', label: 'Agenda', Icon: CalendarDays },
];
const RIGHT: typeof LEFT = [
  { key: 'goals', label: 'Metas', Icon: Target },
  { key: 'settings', label: 'Ajustes', Icon: Settings },
];

/** Navegação inferior com "+" central; respeita a barra de gestos do Android (safe-area). */
export const BottomNav: React.FC<Props> = ({ activeTab, onTabChange, onNew }) => {
  const item = ({ key, label, Icon }: (typeof LEFT)[number]) => {
    const active = activeTab === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => onTabChange(key)}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-chip ${active ? 'text-ziel-accent' : 'text-ziel-muted'}`}
      >
        <Icon className="h-[22px] w-[22px]" />
        <span className="text-[11px] font-semibold">{label}</span>
      </button>
    );
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ziel-line bg-ziel-surface/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-lg items-center gap-1 px-3 py-1.5">
        {LEFT.map(item)}
        <button
          type="button"
          onClick={onNew}
          aria-label="Nova meta"
          className="mx-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ziel-accent text-ziel-bg shadow-lg shadow-black/40 active:opacity-80"
        >
          <Plus className="h-6 w-6" />
        </button>
        {RIGHT.map(item)}
      </div>
    </nav>
  );
};
