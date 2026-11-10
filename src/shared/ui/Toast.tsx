import React, { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import { gsap, motionOK } from '../motion';

type Toast = { id: number; message: string; tone: 'info' | 'error' | 'success' };
type Ctx = { notify: (message: string, tone?: Toast['tone']) => void };

const ToastContext = createContext<Ctx>({ notify: () => undefined });
export const useToast = () => useContext(ToastContext);

const ToastItem: React.FC<{ className: string; children: React.ReactNode }> = ({ className, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current && motionOK()) gsap.fromTo(ref.current, { y: -28, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.7)' });
  }, []);
  return (
    <div ref={ref} role="status" className={className}>
      {children}
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3200);
  }, []);

  const tone = {
    info: 'border-ziel-line text-ziel-text',
    success: 'border-ziel-success/40 text-ziel-success',
    error: 'border-ziel-danger/50 text-ziel-danger',
  };

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} className={`pointer-events-auto max-w-md rounded-[17px] border bg-ziel-raised px-4 py-3 text-sm shadow-xl ${tone[t.tone]}`}>
            {t.message}
          </ToastItem>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
