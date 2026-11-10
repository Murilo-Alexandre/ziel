import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

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
};

let openSheets = 0;
const sheetStack: symbol[] = [];

/** Torna o conteúdo atrás do sheet inerte (foco/leitor de tela não vazam para a página de fundo). */
function setBackgroundInert(inert: boolean) {
  document.querySelectorAll('main, nav[aria-label="Navegação principal"]').forEach((el) => {
    if (inert) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  });
}

/**
 * Bottom sheet mobile-first: altura limitada ao viewport dinâmico (teclado/barras do Android),
 * cabeçalho e rodapé fixos, miolo rolável, fecha com Esc/toque no fundo.
 */
export const Sheet: React.FC<SheetProps> = ({ open, title, subtitle, onClose, children, footer, tall }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const id = Symbol('sheet');
    sheetStack.push(id);
    openSheets += 1;
    setBackgroundInert(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      // Só a folha do topo responde ao Esc (folhas empilhadas fecham uma por vez).
      if (e.key === 'Escape' && sheetStack[sheetStack.length - 1] === id) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      sheetStack.splice(sheetStack.indexOf(id), 1);
      openSheets -= 1;
      if (openSheets === 0) {
        document.body.style.overflow = prevOverflow;
        setBackgroundInert(false);
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Fechar"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 animate-fade cursor-default bg-black/70"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex w-full max-w-lg animate-sheet-up flex-col rounded-t-sheet border border-b-0 border-ziel-line bg-ziel-surface shadow-2xl outline-none sm:rounded-sheet sm:border-b ${
          tall ? 'max-h-[94dvh]' : 'max-h-[88dvh]'
        }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-ziel-line sm:hidden" aria-hidden />
        <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-tight text-ziel-text">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-sm text-ziel-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-2 flex min-h-touch min-w-touch items-center justify-center rounded-chip text-ziel-muted hover:text-ziel-text"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <footer className="pb-safe shrink-0 border-t border-ziel-line-soft px-5 pb-3 pt-3">{footer}</footer>}
        {!footer && <div className="pb-safe shrink-0" />}
      </div>
    </div>
  );
};
