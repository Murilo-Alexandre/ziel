import React from 'react';
import {
  BookOpen,
  Briefcase,
  Dumbbell,
  Footprints,
  Heart,
  Layers,
  Target,
  Trophy,
  Droplets,
  Utensils,
  Wallet,
  Brain,
  Star,
  Zap,
} from 'lucide-react';

export type IconComp = React.FC<{ className?: string }>;

/** Ícones disponíveis para metas (nome persistido no domínio -> componente). */
export const GOAL_ICONS: Record<string, IconComp> = {
  Target,
  Dumbbell,
  Trophy,
  Footprints,
  BookOpen,
  Heart,
  Droplets,
  Utensils,
  Wallet,
  Brain,
  Briefcase,
  Star,
  Zap,
};

/** Paleta de blocos (referência 9). O hex escolhido é o que fica salvo na meta. */
export const GOAL_COLORS = ['#C8DA7A', '#F6C85F', '#E8594F', '#DAD8CF', '#9CCBEA', '#BBA8F2'];

/** Cores antigas (versões anteriores) mapeadas para a paleta atual — metas existentes continuam coloridas. */
const LEGACY: Record<string, string> = {
  '#6D9BFF': '#9CCBEA',
  '#3B82F6': '#9CCBEA',
  '#6FD6A3': '#C8DA7A',
  '#10B981': '#C8DA7A',
  '#EDB65C': '#F6C85F',
  '#F59E0B': '#F6C85F',
  '#EE7F7A': '#E8594F',
  '#EF4444': '#E8594F',
  '#A78BFA': '#BBA8F2',
  '#8B5CF6': '#BBA8F2',
  '#F088B8': '#BBA8F2',
  '#EC4899': '#BBA8F2',
};

export type Tone = { bg: string; hex: string; light: boolean };

/** Cor do bloco de uma meta (sempre da paleta; fallback estável por id). Texto sobre o bloco é sempre `ink`. */
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

export function iconFor(name: string | null | undefined): IconComp {
  return (name && GOAL_ICONS[name]) || Layers;
}
