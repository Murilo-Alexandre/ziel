import React, { useLayoutEffect, useRef, useState } from 'react';
import { gsap, motionOK } from '../motion';

/** Barra de progresso cujo preenchimento anima com GSAP. */
export const AnimBar: React.FC<{ value: number; className?: string; fillClassName?: string; fillStyle?: React.CSSProperties; label?: string }> = ({
  value,
  className = '',
  fillClassName = '',
  fillStyle,
  label = 'Progresso',
}) => {
  const fill = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  useLayoutEffect(() => {
    if (!fill.current) return;
    if (first.current || !motionOK()) {
      fill.current.style.width = `${pct}%`;
      first.current = false;
      return;
    }
    const tw = gsap.to(fill.current, { width: `${pct}%`, duration: 0.8, ease: 'power3.out' });
    return () => {
      tw.kill();
    };
  }, [pct]);
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label} className={`overflow-hidden rounded-full ${className}`}>
      <div ref={fill} className={`h-full rounded-full ${fillClassName}`} style={{ width: 0, ...fillStyle }} />
    </div>
  );
};

/** Expande/recolhe conteúdo com altura animada (GSAP). Mantém o DOM montado só enquanto necessário. */
export const Collapse: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [render, setRender] = useState(open);
  const first = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (open && !render) setRender(true);
    if (!el) return;
    if (first.current || !motionOK()) {
      first.current = false;
      if (!open) setRender(false);
      return;
    }
    if (open) {
      gsap.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.45, ease: 'power3.out', clearProps: 'height,opacity' });
      gsap.from(el.children, { y: -10, opacity: 0, duration: 0.4, ease: 'power2.out', stagger: 0.05, delay: 0.05, clearProps: 'transform,opacity' });
    } else {
      gsap.to(el, { height: 0, opacity: 0, duration: 0.32, ease: 'power2.inOut', onComplete: () => setRender(false) });
    }
  }, [open, render]);

  if (!render && !open) return null;
  return (
    <div ref={ref} style={{ overflow: 'hidden' }}>
      {children}
    </div>
  );
};
