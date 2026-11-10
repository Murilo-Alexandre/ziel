import React, { useEffect, useRef } from 'react';
import { gsap, motionOK, tweenNumber } from '../motion';

type Props = { value: number; size?: number; stroke?: number; trackClass?: string; barColor?: string; label: string; children?: React.ReactNode };

/** Anel de progresso animado com GSAP (stroke-dashoffset). */
export const Ring: React.FC<Props> = ({ value, size = 132, stroke = 14, trackClass = 'stroke-ziel-raised', barColor = '#F6C85F', label, children }) => {
  const arc = useRef<SVGCircleElement>(null);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, value));

  useEffect(() => {
    if (!arc.current) return;
    const target = c * (1 - clamped);
    if (!motionOK()) {
      arc.current.style.strokeDashoffset = String(target);
      return;
    }
    const tw = gsap.to(arc.current, { strokeDashoffset: target, duration: 1.1, ease: 'power3.out' });
    return () => {
      tw.kill();
    };
  }, [clamped, c]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClass} />
        <circle
          ref={arc}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={barColor}
          strokeDasharray={c}
          strokeDashoffset={c}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

/** Número com contagem animada. */
export const CountUp: React.FC<{ value: number; className?: string; suffix?: string }> = ({ value, className, suffix = '' }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  useEffect(() => {
    if (!ref.current) return;
    tweenNumber(ref.current, prev.current, value, (n) => `${n}${suffix}`);
    prev.current = value;
  }, [value, suffix]);
  return (
    <span ref={ref} className={className}>
      {value}
      {suffix}
    </span>
  );
};
