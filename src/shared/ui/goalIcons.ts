// Reexporta o registro de ícones (mantido por compatibilidade de imports) + paleta de cores das metas.
export { iconFor, iconLabel, ICON_CATALOG, ICON_CATEGORIES, searchIcons, DEFAULT_ICON } from '../icons/registry';
export type { IconComp } from '../icons/registry';

/** Paleta de metas (identidade Ziel). O hex escolhido é o que fica salvo na meta. */
export const GOAL_COLORS = ['#F28B82', '#5B9BE0', '#62C48A', '#F5C542', '#8B7CF6', '#E066D0'];

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
  let hex = GOAL_COLORS.find((c) => c.toUpperCase() === up) ?? LEGACY[up];
  if (!hex) {
    let h = 0;
    for (const ch of goalId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    hex = GOAL_COLORS[h % GOAL_COLORS.length];
  }
  return { bg: hex, hex, light: true };
}
