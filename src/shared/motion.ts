import { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };

/** Respeita "reduzir movimento" do sistema: sem animações, estado final aplicado direto. */
export const motionOK = (): boolean =>
  typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Entrada em cascata dos elementos [data-reveal] de um contêiner.
 * Roda quando `key` muda (ex.: dia selecionado, aba) — NÃO a cada atualização de status.
 */
export function useRevealOnKey(key: string, ready = true) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ready || !ref.current || !motionOK()) return;
    const ctx = gsap.context(() => {
      const els = ref.current!.querySelectorAll('[data-reveal]');
      if (!els.length) return;
      gsap.fromTo(
        els,
        { y: 28, opacity: 0, scale: 0.97 },
        { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: 'power3.out', stagger: 0.07, clearProps: 'transform,opacity' }
      );
    }, ref);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);
  return ref;
}

/** Revela cartões ao entrarem na tela durante a rolagem (ScrollTrigger.batch). */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(selector: string, key: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!ref.current || !motionOK()) return;
    const ctx = gsap.context(() => {
      const items = ref.current!.querySelectorAll(selector);
      if (!items.length) return;
      gsap.set(items, { opacity: 0, y: 36 });
      ScrollTrigger.batch(items, {
        start: 'top 94%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08, overwrite: true, clearProps: 'transform,opacity' }),
      });
      ScrollTrigger.refresh();
    }, ref);
    return () => ctx.revert();
  }, [selector, key]);
  return ref;
}

/** Número que "sobe" até o valor novo. */
export function tweenNumber(el: HTMLElement, from: number, to: number, format: (n: number) => string) {
  if (!motionOK()) {
    el.textContent = format(to);
    return;
  }
  const o = { v: from };
  gsap.to(o, {
    v: to,
    duration: 0.9,
    ease: 'power2.out',
    onUpdate: () => {
      el.textContent = format(Math.round(o.v));
    },
    onComplete: () => {
      el.textContent = format(to);
    },
  });
}
