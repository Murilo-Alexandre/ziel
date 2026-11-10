/**
 * Altura útil da janela em px, mantida numa variável CSS (--app-h).
 * WebViews antigos do Android ignoram `dvh`; sem essa variável a altura máxima de um modal era descartada,
 * o modal passava da tela e o conteúdo (e o botão principal) ficava inalcançável.
 */
export function installViewportVar(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const set = () => {
    const h = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--app-h', `${Math.round(h)}px`);
  };
  set();
  window.addEventListener('resize', set);
  window.visualViewport?.addEventListener('resize', set);
  window.addEventListener('orientationchange', set);
  return () => {
    window.removeEventListener('resize', set);
    window.visualViewport?.removeEventListener('resize', set);
    window.removeEventListener('orientationchange', set);
  };
}
