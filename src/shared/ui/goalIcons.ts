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

export const GOAL_COLORS = ['#6D9BFF', '#6FD6A3', '#EDB65C', '#EE7F7A', '#A78BFA', '#F088B8'];

export function iconFor(name: string | null | undefined): IconComp {
  return (name && GOAL_ICONS[name]) || Layers;
}
