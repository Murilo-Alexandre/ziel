import React, { useLayoutEffect, useRef } from 'react';
import { AlertTriangle, ArrowUp, Download, Search, ShieldCheck, SquareArrowOutUpRight } from 'lucide-react';
import { gsap, motionOK } from '../../shared/motion';
import { UpdateStatus } from '../../shared/Update';

const R = 40;
const C = 2 * Math.PI * R; // circunferência (viewBox 96)

const COLOR: Record<UpdateStatus, string> = {
  idle: '#F28B82',
  checking: '#F28B82',
  uptodate: '#62C48A',
  available: '#F28B82',
  downloading: '#F28B82',
  verifying: '#F5C542',
  'needs-permission': '#F5C542',
  installing: '#62C48A',
  error: '#F2706A',
};

/**
 * Ilustração animada (GSAP) de cada estado da atualização: verificando, atualizado, nova versão, baixando
 * (percentual real), preparando, instalador aberto e erro. Só anima transform/stroke/opacity (leve) e
 * nunca captura toques (pointer-events: none).
 */
export const UpdateHero: React.FC<{ status: UpdateStatus; progress: number }> = ({ status, progress }) => {
  const root = useRef<SVGSVGElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const icon = useRef<HTMLDivElement>(null);
  const check = useRef<SVGPathElement>(null);
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const color = COLOR[status];

  // animação de entrada de cada estado
  useLayoutEffect(() => {
    const a = arc.current;
    const ic = icon.current;
    if (!a) return;
    if (!motionOK()) {
      gsap.set(a, { strokeDasharray: status === 'checking' ? `${C * 0.28} ${C}` : `${C} ${C}`, strokeDashoffset: status === 'downloading' ? C * (1 - progress) : 0 });
      if (check.current) gsap.set(check.current, { strokeDashoffset: 0 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.killTweensOf([a, ic, check.current]);
      gsap.set(a, { rotation: 0, svgOrigin: '48 48' });
      if (ic) gsap.fromTo(ic, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' });
      switch (status) {
        case 'checking':
          gsap.set(a, { strokeDasharray: `${C * 0.28} ${C}`, strokeDashoffset: 0 });
          gsap.to(a, { rotation: 360, duration: 1.1, ease: 'none', repeat: -1 });
          if (ic) gsap.to(ic, { scale: 1.08, duration: 0.7, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.5 });
          break;
        case 'uptodate':
          gsap.set(a, { strokeDasharray: `${C} ${C}` });
          gsap.fromTo(a, { strokeDashoffset: C }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out' });
          if (check.current) gsap.fromTo(check.current, { strokeDashoffset: 40 }, { strokeDashoffset: 0, duration: 0.45, ease: 'power2.out', delay: 0.45 });
          if (ic) gsap.fromTo(ic, { scale: 0.85 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1,0.5)', delay: 0.7 });
          break;
        case 'available':
          gsap.set(a, { strokeDasharray: `${C} ${C}` });
          gsap.fromTo(a, { strokeDashoffset: C }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out' });
          if (ic) gsap.fromTo(ic, { y: 10 }, { y: 0, duration: 0.7, ease: 'bounce.out', delay: 0.15 });
          break;
        case 'downloading':
          gsap.set(a, { strokeDasharray: `${C} ${C}`, strokeDashoffset: C });
          break;
        case 'verifying':
        case 'needs-permission':
          gsap.set(a, { strokeDasharray: `${C * 0.5} ${C}`, strokeDashoffset: 0 });
          gsap.to(a, { rotation: 360, duration: 2.2, ease: 'none', repeat: -1 });
          if (ic) gsap.to(ic, { opacity: 0.55, duration: 0.8, ease: 'sine.inOut', yoyo: true, repeat: -1 });
          break;
        case 'installing':
          gsap.set(a, { strokeDasharray: `${C} ${C}` });
          gsap.fromTo(a, { strokeDashoffset: C }, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' });
          break;
        case 'error':
          gsap.set(a, { strokeDasharray: `${C} ${C}`, strokeDashoffset: 0 });
          if (root.current) gsap.fromTo(root.current, { x: 0 }, { x: 0, keyframes: { x: [0, -7, 7, -5, 5, -2, 0] }, duration: 0.5, ease: 'power1.inOut', clearProps: 'transform' });
          break;
        default:
          gsap.set(a, { strokeDasharray: `${C} ${C}`, strokeDashoffset: 0 });
      }
    }, root);
    return () => ctx.revert();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // progresso real do download
  useLayoutEffect(() => {
    if (status !== 'downloading' || !arc.current) return;
    const off = C * (1 - Math.min(1, Math.max(0, progress)));
    if (!motionOK()) arc.current.style.strokeDashoffset = String(off);
    else gsap.to(arc.current, { strokeDashoffset: off, duration: 0.3, ease: 'power1.out', overwrite: 'auto' });
  }, [progress, status]);

  const iconCls = 'h-9 w-9';
  return (
    <div className="pointer-events-none relative mx-auto h-[104px] w-[104px]" aria-hidden>
      <svg ref={root} viewBox="0 0 96 96" className="h-full w-full">
        <circle cx="48" cy="48" r={R} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="6" />
        <g transform="rotate(-90 48 48)">
          <circle ref={arc} cx="48" cy="48" r={R} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${C} ${C}`} strokeDashoffset={C} />
        </g>
      </svg>
      <div ref={icon} className="absolute inset-0 flex items-center justify-center" style={{ color }}>
        {status === 'checking' && <Search className={iconCls} strokeWidth={2.4} />}
        {status === 'uptodate' && (
          <svg viewBox="0 0 36 36" className={iconCls} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path ref={check} d="M8 19 L15 26 L28 10" strokeDasharray="40" strokeDashoffset="40" />
          </svg>
        )}
        {(status === 'available' || status === 'idle') && <ArrowUp className={iconCls} strokeWidth={2.6} />}
        {status === 'downloading' && <span className="text-[22px] font-extrabold tabular-nums text-ziel-text">{pct}%</span>}
        {(status === 'verifying' || status === 'needs-permission') && <ShieldCheck className={iconCls} strokeWidth={2.4} />}
        {status === 'installing' && <SquareArrowOutUpRight className={iconCls} strokeWidth={2.4} />}
        {status === 'error' && <AlertTriangle className={iconCls} strokeWidth={2.4} />}
      </div>
      {status === 'downloading' && pct === 0 && <Download className="sr-only" />}
    </div>
  );
};
