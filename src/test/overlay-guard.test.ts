import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { handleBack, inertElements, pushBack } from '../shared/ui/overlayGuard';

const fakeEl = () => {
  const attrs = new Set<string>();
  return { setAttribute: (k: string) => attrs.add(k), removeAttribute: (k: string) => attrs.delete(k), has: (k: string) => attrs.has(k) } as unknown as Element & { has: (k: string) => boolean };
};
const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8');

describe('camadas sobrepostas não podem deixar a interface travada', () => {
  it('inert com contagem: fechar uma camada não solta o fundo que outra ainda usa, e a última solta tudo', () => {
    const main = fakeEl();
    const a = inertElements([main]);
    const b = inertElements([main]);
    expect(main.has('inert')).toBe(true);
    a();
    expect(main.has('inert')).toBe(true);
    a(); // chamar duas vezes não pode "roubar" a referência da outra camada
    expect(main.has('inert')).toBe(true);
    b();
    expect(main.has('inert')).toBe(false);
  });

  it('botão Voltar fecha a camada do topo, uma por vez, e avisa quando não há nenhuma', () => {
    const closed: string[] = [];
    const r1 = pushBack(() => closed.push('folha'));
    const r2 = pushBack(() => closed.push('seletor'));
    expect(handleBack()).toBe(true);
    r2();
    expect(handleBack()).toBe(true);
    r1();
    expect(handleBack()).toBe(false);
    expect(closed).toEqual(['seletor', 'folha']);
  });

  it('as animações de saída não desmontam uma camada que foi reaberta (causa do travamento)', () => {
    for (const f of ['../shared/ui/Sheet.tsx', '../shared/ui/Select.tsx', '../features/icons/IconPickerScreen.tsx']) {
      const src = read(f);
      expect(src, f).toMatch(/killTweensOf/);
      expect(src, f).toMatch(/if \(!openRef\.current\) setMounted\(false\)/);
      expect(src, f).toMatch(/inertElements/);
    }
  });

  it('camada em saída não captura toques e o app tem rede de segurança e botão Voltar', () => {
    expect(read('../shared/ui/Sheet.tsx')).toMatch(/pointer-events-none/);
    expect(read('../shared/ui/Select.tsx')).toMatch(/pointer-events-none/);
    const app = read('../App.tsx');
    expect(app).toMatch(/installInteractionGuard/);
    expect(app).toMatch(/backButton/);
  });
});

describe('zoom: desligado só no app nativo', () => {
  it('WebView do Android sem zoom por gesto nem controles, sem fixar textZoom (acessibilidade de fonte)', () => {
    const java = read('../../android/app/src/main/java/com/ziel/app/MainActivity.java');
    expect(java).toMatch(/setSupportZoom\(false\)/);
    expect(java).toMatch(/setBuiltInZoomControls\(false\)/);
    expect(java).not.toMatch(/setTextZoom/);
  });

  it('navegador/PWA mantém o zoom: a restrição só vale com a classe native-app', () => {
    const html = read('../../index.html');
    expect(html).not.toMatch(/user-scalable=no|maximum-scale/);
    const css = read('../index.css');
    expect(css).toMatch(/html\.native-app/);
    expect(read('../main.tsx')).toMatch(/isNativePlatform/);
  });
});
