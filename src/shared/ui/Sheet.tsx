import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { gsap, motionOK } from '../motion';
import { inertElements, lockScroll, pushBack } from './overlayGuard';

type SheetProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Rodapé fixo (ações). Respeita a área segura inferior. */
  footer?: React.ReactNode;
  /** Ocupa quase toda a altura (formulários longos). */
  tall?: boolean;
  /** Cor de destaque do cabeçalho (bloco colorido, referência 9). */
  tone?: string;
};

const sheetStack: symbol[] = [];

/**
 * Bottom sheet mobile-first animado com GSAP (entrada e saída), altura limitada ao viewport dinâmico,
 * cabeçalho e rodapé fixos, miolo rolável, fecha com Esc (só a folha do topo) ou toque no fundo.
 */
export const Sheet: React.FC<SheetProps> = ({ open, title, subtitle, onClose, children, footer, tall, tone }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const openRef = useRef(open);
  openRef.current = open;
  // `mounted` mantém o DOM durante a animação de saída
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = Symbol('sheet');
    sheetStack.push(id);
    // o fundo é inerte, mas NUNCA um ancestral da própria folha (senão ela morre junto)
    const bg = Array.from(document.querySelectorAll('main, nav[aria-label="Navegação principal"]')).filter((el) => !panelRef.current?.contains(el) && !el.contains(panelRef.current));
    const releaseInert = inertElements(bg);
    const releaseScroll = lockScroll();
    const releaseBack = pushBack(() => closeRef.current());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sheetStack[sheetStack.length - 1] === id) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      sheetStack.splice(sheetStack.indexOf(id), 1);
      releaseInert();
      releaseScroll();
      releaseBack();
    };
  }, [open]);

  // entrada / saída
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const back = backdropRef.current;
    if (!mounted || !panel || !back) return;
    if (!motionOK()) {
      if (!open) setMounted(false);
      return;
    }
    gsap.killTweensOf([panel, back]);
    if (open) {
      gsap.fromTo(back, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' });
      gsap.fromTo(panel, { yPercent: 8, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.38, ease: 'power3.out', force3D: true });
    } else {
      gsap.to(back, { opacity: 0, duration: 0.2 });
      gsap.to(panel, { yPercent: 8, opacity: 0, duration: 0.2, ease: 'power2.in', force3D: true, onComplete: () => {
          if (!openRef.current) setMounted(false);
        },
      });
    }
  }, [open, mounted]);

  if (!mounted) return null;

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-end justify-center sm:items-center ${open ? '' : 'pointer-events-none'}`} role="presentation">
      <button
        ref={backdropRef}
        type="button"
        aria-label="Fechar"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/75"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex w-full max-w-lg flex-col rounded-t-sheet border border-b-0 border-ziel-line-soft bg-ziel-surface shadow-2xl outline-none sm:rounded-sheet sm:border-b"
        // altura vem de --app-h (px) e NÃO de dvh: WebViews antigos ignoram dvh e o modal estourava a tela
        style={{ maxHeight: `calc(var(--app-h, 100vh) * ${tall ? 0.94 : 0.9} - env(safe-area-inset-top, 0px))` }}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-ziel-line sm:hidden" aria-hidden />
        <header className="flex shrink-0 items-start justify-between gap-3 px-6 pb-3 pt-4">
          <div className="min-w-0">
            {tone && <span className="mb-2 block h-1.5 w-10 rounded-full" style={{ backgroundColor: tone }} aria-hidden />}
            <h2 className="truncate text-[20px] font-extrabold leading-tight tracking-tight text-ziel-text">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-sm text-ziel-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="orb !bg-ziel-raised text-ziel-sub">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4 pt-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-y]" data-sheet-scroll>{children}</div>
        {footer && (
          <footer className="shrink-0 border-t border-ziel-line-soft bg-ziel-surface px-6 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.1rem)' }}>
            {footer}
          </footer>
        )}
        {!footer && <div className="shrink-0" style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }} />}
      </div>
    </div>,
    document.body
  );
};
