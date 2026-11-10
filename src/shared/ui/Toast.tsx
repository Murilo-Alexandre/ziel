import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

type Toast = { id: number; message: string; tone: 'info' | 'error' | 'success' };
type Ctx = { notify: (message: string, tone?: Toast['tone']) => void };

const ToastContext = createContext<Ctx>({ notify: () => undefined });
export const useToast = () => useContext(ToastContext);

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
          <div key={t.id} role="status" className={`pointer-events-auto max-w-md animate-fade rounded-chip border bg-ziel-raised px-4 py-3 text-sm shadow-xl ${tone[t.tone]}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
