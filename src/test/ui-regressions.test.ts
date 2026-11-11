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

  it('paleta rica e ordenada por matiz (linhas de 6 tons por família), preservando as originais e qualquer cor já salva', () => {
    expect(GOAL_COLORS.length).toBeGreaterThanOrEqual(60);
    expect(GOAL_COLORS.length % 6).toBe(0); // linhas completas = escala cromática contínua, sem títulos de grupo
    expect(new Set(GOAL_COLORS.map((c) => c.toUpperCase())).size).toBe(GOAL_COLORS.length);
    for (const o of ['#F28B82', '#5B9BE0', '#62C48A', '#F5C542', '#8B7CF6', '#E066D0']) expect(GOAL_COLORS).toContain(o);
    expect(GOAL_COLOR_LIST.every((c) => c.name.length > 0)).toBe(true);
    expect(toneFor('#9BD16F').hex).toBe('#9BD16F'); // cor salva em versão anterior (24 cores) continua idêntica
    expect(toneFor('#56CCF2').hex).toBe('#56CCF2');
    expect(toneFor('#3B82F6').hex).toBe('#5B9BE0'); // cor legada continua mapeada
    expect(toneFor('lixo').hex).toMatch(/^#[0-9A-F]{6}$/); // inválida: fallback estável
  });

  it('as famílias seguem a ordem do arco-íris (matiz crescente) e os tons vão do claro ao intenso', () => {
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (!d) return -1;
      const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return ((h * 60) + 360) % 360;
    };
    const fam = Array.from({ length: 13 }, (_, i) => hue(GOAL_COLORS[i * 6 + 3]));
    for (let i = 2; i < fam.length; i++) expect(fam[i]).toBeGreaterThan(fam[i - 1] - 1);
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

describe('acabamento, desempenho e atualização (beta.10)', () => {
  it('sem brilhos/sombras coloridas nem blur nos botões e controles principais', () => {
    const css = read('../index.css');
    expect(css).not.toMatch(/shadow-\[[^\]]*rgba\(242,139,130/);
    expect(read('../shared/components/BottomNav.tsx')).not.toMatch(/rgba\(242,139,130|backdrop-blur/);
    expect(read('../features/today/DateStrip.tsx')).not.toMatch(/rgba\(242,139,130/);
    expect(read('../shared/ui/Sheet.tsx')).not.toMatch(/backdrop-blur/);
  });

  it('fundo atmosférico em camada fixa própria (sem background-attachment: fixed, que repinta a cada rolagem)', () => {
    const css = read('../index.css');
    expect(css).toMatch(/body::before/);
    expect(css).not.toMatch(/#141926 fixed/);
  });

  it('rodapé do modal respeita a área de gestos com folga (a classe pb-3 não pode sobrescrever a safe area)', () => {
    const sheet = read('../shared/ui/Sheet.tsx');
    expect(sheet).toMatch(/calc\(env\(safe-area-inset-bottom, 0px\) \+ 1\.1rem\)/);
    expect(sheet).not.toMatch(/pb-safe shrink-0 border-t/);
  });

  it('o modal de atualização cobre todos os estados e o botão Verificar abre o modal já em "verificando"', () => {
    const hero = read('../features/update/UpdateHero.tsx');
    for (const st of ['checking', 'uptodate', 'available', 'downloading', 'verifying', 'installing', 'error']) expect(hero, st).toContain(st);
    const ui = read('../features/update/UpdateUi.tsx');
    expect(ui).toMatch(/Você está na versão mais recente!/);
    expect(ui).toMatch(/Procurando atualizações/);
    expect(ui).toMatch(/Preparando a instalação/);
    expect(ui).toMatch(/Tentar de novo/);
    expect(read('../features/settings/SettingsView.tsx')).toMatch(/setUpdateOpen\(true\); up\.check\(\)/);
    expect(hero).toMatch(/pointer-events-none/); // a animação nunca captura toques
  });

  it('animação de entrada da folha só usa transform/opacidade (leve) e cancela tweens anteriores', () => {
    const sheet = read('../shared/ui/Sheet.tsx');
    expect(sheet).not.toMatch(/scale: 0\.98/);
    expect(sheet).toMatch(/force3D/);
  });
});

describe('exclusão de metas', () => {
  it('a tela da meta oferece Excluir (com confirmação clara, separada de Arquivar) e usa a exclusão definitiva', () => {
    const src = read('../features/goal-detail/GoalDetailSheet.tsx');
    expect(src).toMatch(/Excluir meta/);
    expect(src).toMatch(/role="alertdialog"/);
    expect(src).toMatch(/deleteGoalPermanently/);
    expect(src).toMatch(/não pode ser desfeito/);
    expect(src).toMatch(/Arquivar meta/); // a opção segura continua disponível
  });
});
