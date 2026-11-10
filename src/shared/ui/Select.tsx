import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { gsap, motionOK } from '../motion';

type Opt = { value: string; label: string };

type Props = {
  id?: string;
  value: string | number;
  onChange: (e: { target: { value: string } }) => void;
  className?: string;
  'aria-label'?: string;
  disabled?: boolean;
  /** Mesma API do <select>: filhos <option value="x">Texto</option>. */
  children: React.ReactNode;
};

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
  return '';
}

/**
 * Seletor próprio (substitui o <select> nativo, quadrado e sem animação): o campo abre uma folha inferior
 * arredondada com opções grandes para toque, animada com GSAP, com marca de seleção, teclado e Esc.
 * Mantém a API do <select> (children <option> e onChange({ target: { value } })).
 */
export const Select: React.FC<Props> = ({ id, value, onChange, className = '', disabled, children, ...rest }) => {
  const options = useMemo<Opt[]>(
    () =>
      React.Children.toArray(children)
        .filter((c): c is React.ReactElement<{ value?: string | number; children?: React.ReactNode }> => React.isValidElement(c))
        .map((c) => ({ value: String(c.props.value ?? textOf(c.props.children)), label: textOf(c.props.children) })),
    [children]
  );
  const current = options.find((o) => o.value === String(value));
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const openIt = () => {
    if (disabled) return;
    const lab = id ? document.querySelector(`label[for="${id}"]`)?.textContent : null;
    setTitle(rest['aria-label'] ?? lab ?? 'Escolher');
    setMounted(true);
    setOpen(true);
  };
  const close = (focusBack = true) => {
    setOpen(false);
    if (focusBack) window.setTimeout(() => triggerRef.current?.focus(), 0);
  };
  const pick = (v: string) => {
    onChange({ target: { value: v } });
    const row = listRef.current?.querySelector(`[data-v="${CSS.escape(v)}"]`);
    if (row && motionOK()) gsap.fromTo(row, { scale: 0.96 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' });
    window.setTimeout(() => close(), motionOK() ? 160 : 0);
  };

  // entrada / saída
  useLayoutEffect(() => {
    if (!mounted || !panelRef.current || !backRef.current) return;
    if (!motionOK()) {
      if (!open) setMounted(false);
      return;
    }
    if (open) {
      gsap.fromTo(backRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      gsap.fromTo(panelRef.current, { yPercent: 100 }, { yPercent: 0, duration: 0.45, ease: 'power4.out' });
      const rows = listRef.current?.children;
      if (rows?.length) gsap.from(rows, { y: 16, opacity: 0, duration: 0.35, ease: 'power2.out', stagger: 0.025, delay: 0.1, clearProps: 'transform,opacity' });
    } else {
      gsap.to(backRef.current, { opacity: 0, duration: 0.18 });
      gsap.to(panelRef.current, { yPercent: 100, duration: 0.26, ease: 'power3.in', onComplete: () => setMounted(false) });
    }
  }, [open, mounted]);

  // isolamento, Esc, rolagem até a opção atual
  useEffect(() => {
    if (!open) return;
    const others = Array.from(document.querySelectorAll('main, nav[aria-label="Navegação principal"], [role="dialog"]')).filter((n) => !panelRef.current?.contains(n));
    others.forEach((n) => n.setAttribute('inert', ''));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const sel = listRef.current?.querySelector('[aria-selected="true"]') as HTMLElement | null;
    sel?.scrollIntoView({ block: 'center' });
    sel?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey, true);
      others.forEach((n) => n.removeAttribute('inert'));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[Math.min(items.length - 1, i + 1)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[Math.max(0, i - 1)]?.focus();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={openIt}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={rest['aria-label']}
        className={`${className} flex items-center justify-between gap-2 text-left disabled:opacity-50`}
      >
        <span className="min-w-0 flex-1 truncate">{current?.label ?? '—'}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ziel-muted transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {mounted &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-end justify-center" role="presentation">
            <div ref={backRef} className="absolute inset-0 bg-black/60" onClick={() => close()} aria-hidden />
            <div
              ref={panelRef}
              className="relative flex w-full max-w-lg flex-col rounded-t-[32px] border border-b-0 border-white/[0.08] bg-ziel-surface shadow-2xl"
              style={{ maxHeight: 'calc(var(--app-h, 100vh) * 0.75)' }}
            >
              <div className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-ziel-line" aria-hidden />
              <p className="shrink-0 px-6 pb-2 pt-3 text-sm font-extrabold text-ziel-sub">{title}</p>
              <ul
                ref={listRef}
                role="listbox"
                aria-label={title}
                onKeyDown={onListKey}
                className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-4 pb-3 [-webkit-overflow-scrolling:touch] [touch-action:pan-y]"
              >
                {options.map((o) => {
                  const sel = o.value === String(value);
                  return (
                    <li key={o.value} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={sel}
                        data-v={o.value}
                        onClick={() => pick(o.value)}
                        className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-[20px] px-4 text-left text-[15px] font-semibold transition-colors ${
                          sel ? 'bg-ziel-accent-soft text-ziel-accent' : 'bg-white/[0.04] text-ziel-text active:bg-white/10'
                        }`}
                      >
                        <span className="min-w-0 flex-1">{o.label}</span>
                        {sel && <Check className="h-5 w-5 shrink-0" strokeWidth={3} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="pb-safe shrink-0" />
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
