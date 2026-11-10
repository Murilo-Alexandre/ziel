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
    let fallback = 0;
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
      // rede de segurança: se o gatilho não disparar, nada fica invisível (e portanto "intocável")
      fallback = window.setTimeout(() => {
        items.forEach((el) => {
          if (Number(getComputedStyle(el).opacity) < 0.05) gsap.to(el, { opacity: 1, y: 0, duration: 0.3, clearProps: 'transform,opacity' });
        });
      }, 1800);
    }, ref);
    return () => {
      window.clearTimeout(fallback);
      ctx.revert();
    };
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

/**
 * Feedback tátil global: elementos interativos "afundam" levemente ao toque e voltam com mola.
 * Um único conjunto de listeners delegados (sem custo por componente). Respeita reduced-motion.
 */
export function installPressFeedback(): () => void {
  if (typeof document === 'undefined' || !motionOK()) return () => undefined;
  const sel = 'button, a[href], [role="option"], [role="radio"], [role="tab"], [role="switch"], label[for]';
  let active: HTMLElement | null = null;

  const down = (e: PointerEvent) => {
    const el = (e.target as HTMLElement | null)?.closest?.(sel) as HTMLElement | null;
    if (!el || (el as HTMLButtonElement).disabled || el.closest('[data-no-press]')) return;
    active = el;
    gsap.to(el, { scale: el.offsetWidth > 220 ? 0.985 : 0.94, duration: 0.12, ease: 'power2.out', overwrite: 'auto' });
  };
  const release = () => {
    if (!active) return;
    const el = active;
    active = null;
    gsap.to(el, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.55)', overwrite: 'auto', clearProps: 'scale' });
  };
  document.addEventListener('pointerdown', down, { passive: true });
  document.addEventListener('pointerup', release, { passive: true, capture: true });
  document.addEventListener('pointercancel', release, { passive: true, capture: true });
  return () => {
    document.removeEventListener('pointerdown', down);
    document.removeEventListener('pointerup', release, true);
    document.removeEventListener('pointercancel', release, true);
  };
}
