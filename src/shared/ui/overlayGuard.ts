/**
 * Infraestrutura comum das camadas sobrepostas (folhas, seletores, tela de ícones):
 *  - `inertElements`: torna o fundo inerte com contagem de referências (uma camada que fecha não "destrava"
 *    o que outra ainda precisa, e nenhuma deixa o fundo inerte para sempre);
 *  - `lockScroll`: trava a rolagem do body, também com contagem;
 *  - `pushBack`: pilha do botão Voltar do Android (fecha a camada do topo);
 *  - `installInteractionGuard`: rede de segurança — se não há nenhuma camada aberta, nada pode continuar
 *    inerte/travado (cura qualquer estado preso por corrida de animação).
 */
const inertCount = new Map<Element, number>();

export function inertElements(els: Element[]): () => void {
  els.forEach((e) => {
    inertCount.set(e, (inertCount.get(e) ?? 0) + 1);
    e.setAttribute('inert', '');
  });
  let done = false;
  return () => {
    if (done) return;
    done = true;
    els.forEach((e) => {
      const n = (inertCount.get(e) ?? 1) - 1;
      if (n <= 0) {
        inertCount.delete(e);
        e.removeAttribute('inert');
      } else inertCount.set(e, n);
    });
  };
}

let scrollLocks = 0;
let savedOverflow = '';
export function lockScroll(): () => void {
  if (scrollLocks === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLocks += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) document.body.style.overflow = savedOverflow;
  };
}

const backStack: { id: symbol; fn: () => void }[] = [];
export function pushBack(fn: () => void): () => void {
  const id = Symbol('back');
  backStack.push({ id, fn });
  return () => {
    const i = backStack.findIndex((b) => b.id === id);
    if (i >= 0) backStack.splice(i, 1);
  };
}
/** Fecha a camada do topo. Devolve false se não havia nenhuma (o chamador decide, ex.: minimizar o app). */
export function handleBack(): boolean {
  const top = backStack[backStack.length - 1];
  if (!top) return false;
  top.fn();
  return true;
}

const LAYER = '[role="dialog"], [role="listbox"]';

/** Se nenhuma camada existe no DOM, libera qualquer inert/overflow que tenha sobrado. */
export function releaseIfNoLayer(): boolean {
  if (typeof document === 'undefined' || document.querySelector(LAYER)) return false;
  let fixed = false;
  document.querySelectorAll('[inert]').forEach((e) => {
    e.removeAttribute('inert');
    fixed = true;
  });
  inertCount.clear();
  if (document.body.style.overflow === 'hidden') {
    document.body.style.overflow = '';
    fixed = true;
  }
  scrollLocks = 0;
  return fixed;
}

export function installInteractionGuard(): () => void {
  const check = () => {
    releaseIfNoLayer();
  };
  document.addEventListener('pointerdown', check, true);
  document.addEventListener('visibilitychange', check);
  const t = window.setInterval(check, 2000);
  return () => {
    document.removeEventListener('pointerdown', check, true);
    document.removeEventListener('visibilitychange', check);
    window.clearInterval(t);
  };
}
