import React, { useLayoutEffect, useRef } from 'react';
import { gsap, motionOK } from '../motion';

/** Interruptor acessível (role=switch), alvo de toque de 44 px, com animação do botão e da cor. */
export const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }> = ({ checked, onChange, label, disabled }) => {
  const knob = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (!knob.current || !track.current) return;
    const x = checked ? 22 : 0;
    const bg = checked ? '#F28B82' : '#38425C';
    if (first.current || !motionOK()) {
      gsap.set(knob.current, { x });
      gsap.set(track.current, { backgroundColor: bg });
      first.current = false;
    } else {
      gsap.to(knob.current, { x, duration: 0.4, ease: 'back.out(2)' });
      gsap.to(track.current, { backgroundColor: bg, duration: 0.25 });
    }
  }, [checked]);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-[44px] min-w-[60px] shrink-0 items-center justify-center disabled:opacity-50"
    >
      <span ref={track} className="relative block h-[30px] w-[52px] rounded-full p-[3px]">
        <span ref={knob} className="block h-6 w-6 rounded-full bg-white shadow-md" />
      </span>
    </button>
  );
};
