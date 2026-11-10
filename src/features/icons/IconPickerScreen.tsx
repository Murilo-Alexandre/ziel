import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, Search, X } from 'lucide-react';
import { ICON_CATALOG, ICON_CATEGORIES, iconFor, iconLabel, searchIcons } from '../../shared/icons/registry';
import { gsap, motionOK } from '../../shared/motion';
import { inertElements, pushBack } from '../../shared/ui/overlayGuard';

type Props = {
  open: boolean;
  value: string;
  /** Cor da meta (prévia). */
  color: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

const RECENT_KEY = 'ziel.icons.recent.v1';
const readRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 18) : [];
  } catch {
    return [];
  }
};
const pushRecent = (id: string) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, 18)));
  } catch {
    /* sem armazenamento: só não lembra os recentes */
  }
};

/**
 * Seletor de ícones em TELA CHEIA: pesquisa por nome/palavra-chave (sem acento), categorias em português,
 * grade visual, prévia grande e confirmação explícita. Os ícones já salvos nas metas continuam válidos.
 */
export const IconPickerScreen: React.FC<Props> = ({ open, value, color, onSelect, onClose }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [mounted, setMounted] = useState(open);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [draft, setDraft] = useState(value);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setDraft(value);
      setQuery('');
      setCategory('all');
      setRecent(readRecent());
    }
  }, [open, value]);

  const list = useMemo(() => {
    if (category === 'recent') {
      const byId = new Map(ICON_CATALOG.map((i) => [i.id, i]));
      const rec = recent.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
      return searchIcons(query, null, rec);
    }
    return searchIcons(query, category === 'all' ? null : category);
  }, [query, category, recent]);

  // entrada / saída
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!mounted || !el) return;
    if (!motionOK()) {
      if (!open) setMounted(false);
      return;
    }
    gsap.killTweensOf(el);
    if (open) gsap.fromTo(el, { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: 'power4.out' });
    else gsap.to(el, { yPercent: 100, duration: 0.32, ease: 'power3.in', onComplete: () => {
        if (!openRef.current) setMounted(false);
      },
    });
  }, [open, mounted]);

  // tiles em cascata quando a lista muda (só os primeiros, para manter fluidez)
  useLayoutEffect(() => {
    if (!open || !gridRef.current || !motionOK()) return;
    const tiles = Array.from(gridRef.current.querySelectorAll('[data-tile]')).slice(0, 28);
    if (!tiles.length) return;
    const tw = gsap.fromTo(tiles, { opacity: 0, y: 14, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power2.out', stagger: 0.012, clearProps: 'transform,opacity' });
    return () => {
      tw.kill();
      gsap.set(tiles, { clearProps: 'transform,opacity' });
    };
  }, [open, query, category]);

  // prévia "pulsa" ao trocar o ícone
  useEffect(() => {
    if (open && previewRef.current && motionOK()) gsap.fromTo(previewRef.current, { scale: 0.82, rotate: -6 }, { scale: 1, rotate: 0, duration: 0.55, ease: 'elastic.out(1, 0.5)', clearProps: 'transform' });
  }, [draft, open]);

  // isolamento (foco/leitor de tela) e Esc
  useEffect(() => {
    if (!open) return;
    const others = Array.from(document.querySelectorAll('main, nav[aria-label="Navegação principal"], [role="dialog"]')).filter((n) => !rootRef.current?.contains(n));
    const releaseInert = inertElements(others);
    const releaseBack = pushBack(() => closeRef.current());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      releaseInert();
      releaseBack();
    };
  }, [open]);

  if (!mounted) return null;

  const Preview = iconFor(draft);
  const catChips: [string, string][] = [['all', 'Todos'], ...(recent.length ? ([['recent', 'Recentes']] as [string, string][]) : []), ...Object.entries(ICON_CATEGORIES)];
  const known = ICON_CATALOG.some((i) => i.id === draft);
  const draftMeta = ICON_CATALOG.find((i) => i.id === draft);

  const confirm = () => {
    pushRecent(draft);
    onSelect(draft);
  };

  return createPortal(
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label="Escolher ícone" className="fixed inset-0 z-[60] flex flex-col bg-ziel-bg">
      <header className="pt-safe shrink-0 px-5 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onClose} aria-label="Voltar" className="orb">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="flex-1 text-[20px] font-extrabold tracking-tight">Escolher ícone</h2>
          <span className="text-xs font-semibold text-ziel-muted">{list.length} de {ICON_CATALOG.length}</span>
        </div>

        <div className="mt-4 flex items-center gap-4 rounded-[22px] border border-white/[0.08] bg-ziel-surface p-3.5" style={{ background: `linear-gradient(135deg, ${color}26, rgba(29,36,51,0.96) 60%)` }}>
          <div ref={previewRef} className="flex h-[61px] w-[50px] shrink-0 items-center justify-center rounded-[17px]" style={{ backgroundColor: color, color: '#0F1320' }} aria-hidden>
            <Preview className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="truncate text-[15px] font-extrabold">{iconLabel(draft)}</p>
            <p className="truncate text-xs text-ziel-muted">{draftMeta ? ICON_CATEGORIES[draftMeta.cat] : known ? '' : 'Ícone anterior (mantido)'}</p>
          </div>
        </div>

        <label className="relative mt-3 block">
          <span className="sr-only">Pesquisar ícones</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ziel-muted" />
          <input
            type="search"
            className="field !pl-12 !pr-12"
            placeholder="Pesquisar: moto, remédio…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
            autoComplete="off"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Limpar pesquisa" className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ziel-muted">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>

        <div role="tablist" aria-label="Categorias" className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {catChips.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={category === id}
              onClick={() => setCategory(id)}
              className={`min-h-[40px] shrink-0 rounded-full px-4 text-[12px] font-bold transition-colors ${category === id ? 'bg-ziel-accent text-ziel-ink' : 'bg-ziel-raised text-ziel-sub'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
        {list.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-base font-bold">Nenhum ícone para “{query}”</p>
            <p className="mt-1 text-sm text-ziel-muted">Tente outro nome, como moto, remédio, futebol ou viagem.</p>
            <button type="button" className="btn-ghost mt-5" onClick={() => { setQuery(''); setCategory('all'); }}>
              Ver todos
            </button>
          </div>
        ) : (
          <div ref={gridRef} role="listbox" aria-label="Ícones" className="grid grid-cols-4 gap-2.5 min-[400px]:grid-cols-5">
            {list.map((i) => {
              const I = iconFor(i.id);
              const sel = draft === i.id;
              return (
                <button
                  key={i.id}
                  data-tile
                  role="option"
                  aria-selected={sel}
                  aria-label={i.label}
                  onClick={() => setDraft(i.id)}
                  onDoubleClick={() => {
                    setDraft(i.id);
                    pushRecent(i.id);
                    onSelect(i.id);
                  }}
                  className="flex aspect-square min-h-[58px] flex-col items-center justify-center gap-1 rounded-[17px] border px-1 transition-colors [contain-intrinsic-size:72px] [content-visibility:auto]"
                  style={sel ? { borderColor: color, backgroundColor: `${color}22`, color } : { borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.035)', color: '#C3C8D4' }}
                >
                  <I className="h-7 w-7" />
                  <span className="w-full truncate text-center text-[10px] font-semibold leading-tight">{i.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <footer className="pb-safe shrink-0 border-t border-ziel-line-soft bg-ziel-bg/95 px-5 pb-3 pt-3">
        <button type="button" className="btn-primary w-full !min-h-[49px] text-base" onClick={confirm}>
          <Check className="h-5 w-5" /> Usar “{iconLabel(draft)}”
        </button>
      </footer>
    </div>,
    document.body
  );
};
