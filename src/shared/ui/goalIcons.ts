// Reexporta o registro de ícones (mantido por compatibilidade de imports) + paleta de cores das metas.
export { iconFor, iconLabel, ICON_CATALOG, ICON_CATEGORIES, searchIcons, DEFAULT_ICON } from '../icons/registry';
export type { IconComp } from '../icons/registry';

/** Paleta de metas (identidade Ziel). O hex escolhido é o que fica salvo na meta. */
/** Famílias de cor em ordem de matiz (escala cromática contínua) — cada uma tem 6 tons, do claro ao intenso. */
const FAMILIES: [string, number][] = [
  ['Vermelho', 358], ['Laranja', 22], ['Âmbar', 40], ['Amarelo', 50], ['Lima', 85], ['Verde', 140], ['Turquesa', 172],
  ['Ciano', 195], ['Azul', 218], ['Índigo', 248], ['Violeta', 275], ['Magenta', 312], ['Rosa', 336],
];
/** [luminosidade, saturação]: todos legíveis com o ícone escuro e como texto colorido sobre o fundo grafite. */
const TONES: [number, number][] = [[81, 76], [74, 74], [67, 72], [61, 70], [55, 68], [50, 64]];
const NEUTRALS = ['#E7EBF3', '#C9D0DE', '#AAB3C7', '#8D98B0', '#727E99', '#5C6882'];
/** As 6 cores originais do Ziel continuam exatas: entram no lugar do tom mais próximo da escala. */
const ORIGINALS = ['#F28B82', '#5B9BE0', '#62C48A', '#F5C542', '#8B7CF6', '#E066D0'];

function hslToHex(h: number, sPct: number, lPct: number): string {
  const s = sPct / 100;
  const l = lPct / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const x = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${x(f(0))}${x(f(8))}${x(f(4))}`.toUpperCase();
}
const dist = (a: string, b: string) => {
  const c = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return [0, 1, 2].reduce((t, i) => t + (c(a, i) - c(b, i)) ** 2, 0);
};

function buildPalette(): { hex: string; name: string }[] {
  const out: { hex: string; name: string }[] = [];
  for (const [fam, hue] of FAMILIES) TONES.forEach(([l, sat], i) => out.push({ hex: hslToHex(hue, sat, l), name: `${fam} ${i + 1}` }));
  NEUTRALS.forEach((hex, i) => out.push({ hex, name: `Grafite ${i + 1}` }));
  for (const o of ORIGINALS) {
    let best = 0;
    for (let i = 1; i < out.length; i++) if (dist(out[i].hex, o) < dist(out[best].hex, o)) best = i;
    out[best] = { hex: o, name: out[best].name };
  }
  return out;
}

/** Paleta ordenada: cada linha de 6 é uma família (claro → intenso); famílias vizinhas têm matizes vizinhos. */
export const GOAL_COLOR_LIST: { hex: string; name: string }[] = buildPalette();
export const GOAL_COLORS = GOAL_COLOR_LIST.map((c) => c.hex);

/** Cores salvas em versões anteriores mapeadas para a paleta atual — metas existentes continuam coloridas. */
const LEGACY: Record<string, string> = {
  '#6D9BFF': '#5B9BE0',
  '#3B82F6': '#5B9BE0',
  '#9CCBEA': '#5B9BE0',
  '#6FD6A3': '#62C48A',
  '#10B981': '#62C48A',
  '#C8DA7A': '#62C48A',
  '#EDB65C': '#F5C542',
  '#F59E0B': '#F5C542',
  '#F6C85F': '#F5C542',
  '#EE7F7A': '#F28B82',
  '#EF4444': '#F28B82',
  '#E8594F': '#F28B82',
  '#A78BFA': '#8B7CF6',
  '#8B5CF6': '#8B7CF6',
  '#BBA8F2': '#8B7CF6',
  '#F088B8': '#E066D0',
  '#EC4899': '#E066D0',
  '#DAD8CF': '#5B9BE0',
};

export type Tone = { bg: string; hex: string; light: boolean };

/** Cor de uma meta (sempre da paleta; fallback estável por id). */
export function toneFor(colorToken: string | null | undefined, goalId = ''): Tone {
  const up = (colorToken ?? '').toUpperCase();
  let hex: string | undefined = LEGACY[up] ?? (/^#[0-9A-F]{6}$/.test(up) ? up : undefined);
  if (!hex) {
    let h = 0;
    for (const ch of goalId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    hex = GOAL_COLORS[h % GOAL_COLORS.length];
  }
  return { bg: hex, hex, light: true };
}
