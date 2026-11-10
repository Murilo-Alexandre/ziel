import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GOAL_COLOR_LIST, GOAL_COLORS, toneFor } from '../shared/ui/goalIcons';

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8');

describe('regressões de interface (beta.7)', () => {
  it('a folha é renderizada em portal no body: nunca fica dentro do <main> que vira inerte (modal "Como foi?" morto)', () => {
    const sheet = read('../shared/ui/Sheet.tsx');
    expect(sheet).toMatch(/createPortal\(/);
    expect(sheet).toMatch(/document\.body/);
    expect(sheet).toMatch(/el\.contains\(panelRef\.current\)/); // nunca inertiza um ancestral da própria folha
  });

  it('o realce de seleção não é cortado pela área rolável (anel interno)', () => {
    expect(read('../shared/components/QuickStatusSheet.tsx')).toMatch(/ring-inset/);
    expect(read('../shared/ui/Sheet.tsx')).toMatch(/pt-1 \[-webkit/);
  });

  it('paleta de 24–32 cores, únicas, preservando as 6 originais e metas antigas', () => {
    expect(GOAL_COLORS.length).toBeGreaterThanOrEqual(24);
    expect(GOAL_COLORS.length).toBeLessThanOrEqual(32);
    expect(new Set(GOAL_COLORS.map((c) => c.toUpperCase())).size).toBe(GOAL_COLORS.length);
    expect(GOAL_COLORS.slice(0, 6)).toEqual(['#F28B82', '#5B9BE0', '#62C48A', '#F5C542', '#8B7CF6', '#E066D0']);
    expect(GOAL_COLOR_LIST.every((c) => c.name.length > 0)).toBe(true);
    expect(toneFor('#9BD16F').hex).toBe('#9BD16F'); // cor nova é respeitada
    expect(toneFor('#3B82F6').hex).toBe('#5B9BE0'); // cor legada continua mapeada
  });

  it('ícone e cor numa só tela cheia; o editor não tem mais a fileira de cores solta', () => {
    const picker = read('../features/icons/IconPickerScreen.tsx');
    expect(picker).toMatch(/aria-label="Cor"/);
    expect(picker).toMatch(/onSelect\(draft, draftColor\)/);
    expect(read('../features/goal-editor/GoalEditorSheet.tsx')).not.toMatch(/role="radiogroup" aria-label="Cor"/);
  });

  it('árvore: conector com geometria única (cotovelo termina no centro da linha do filho)', () => {
    const css = read('../index.css');
    expect(css).toMatch(/--stub/);
    expect(css).toMatch(/\.tree-child::before/);
    expect(read('../features/today/GoalNodeCard.tsx')).toMatch(/tree-child/);
    expect(read('../features/goals/GoalsLibraryView.tsx')).toMatch(/tree-child/);
  });

  it('calendário sem contorno quadrado (foco no círculo) e Agenda sem texto sobre coral sólido', () => {
    expect(read('../features/today/DateStrip.tsx')).toMatch(/outline-none/);
    expect(read('../features/today/DateStrip.tsx')).toMatch(/group-focus-visible:ring-2/);
    const agenda = read('../features/agenda/AgendaView.tsx');
    expect(agenda).not.toMatch(/bg-ziel-accent text-ziel-ink/);
    expect(agenda).not.toMatch(/text-black\/60/);
  });

  it('o roteiro de auditoria funcional existe para rodar no navegador', () => {
    expect(read('../../scripts/ui-audit.js')).toMatch(/Como foi\?/);
  });
});

describe('ícone do launcher', () => {
  it('nenhum recurso por versão (drawable-v24) sobrepõe o ícone da marca com o robô padrão do Android', async () => {
    const { existsSync } = await import('node:fs');
    const res = resolve(__dirname, '../../android/app/src/main/res');
    expect(existsSync(resolve(res, 'drawable-v24'))).toBe(false);
    expect(read('../../android/app/src/main/res/drawable/ic_launcher_foreground.xml')).toMatch(/33FF7A59/);
  });
});

describe('geometria do ícone Matriz (proporção no launcher)', () => {
  const pathData = (f: string) => /pathData="([^"]+)"/g;
  const circles = (xml: string) => {
    const out: { x: number; y: number; r: number }[] = [];
    for (const m of xml.matchAll(/pathData="([^"]+)"/g)) {
      for (const seg of m[1].split('z').filter(Boolean)) {
        const mm = seg.match(/^M([\d.]+),([\d.]+)a([\d.]+),/);
        if (mm) out.push({ x: Number(mm[1]) + Number(mm[3]), y: Number(mm[2]), r: Number(mm[3]) });
      }
    }
    return out;
  };
  it('todos os pontos cabem no círculo seguro de 66dp com folga (nada é cortado por máscaras ou zoom de launcher)', () => {
    for (const f of ['ic_launcher_foreground.xml', 'ic_launcher_monochrome.xml']) {
      const cs = circles(read('../../android/app/src/main/res/drawable/' + f));
      expect(cs.length, f).toBeGreaterThanOrEqual(13);
      for (const c of cs) expect(Math.hypot(c.x - 54, c.y - 54) + c.r, f).toBeLessThanOrEqual(29.5);
    }
    void pathData;
  });
  it('o Z tem exatamente 13 pontos acesos e a versão monocromática só leva esses', () => {
    expect(circles(read('../../android/app/src/main/res/drawable/ic_launcher_monochrome.xml')).length).toBe(13);
  });
});
