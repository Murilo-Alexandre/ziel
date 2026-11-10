import React from 'react';
import {
  BookOpen,
  Briefcase,
  Brain,
  Droplets,
  Dumbbell,
  Footprints,
  Heart,
  Layers,
  Star,
  Target,
  Trophy,
  Utensils,
  Wallet,
  Zap,
} from 'lucide-react';
import catalog from './catalog.json';
import { PHOSPHOR_PATHS } from './phosphor.generated';

export type IconComp = React.FC<{ className?: string }>;

export type IconEntry = { id: string; label: string; cat: string; kw: string };
export const ICON_CATEGORIES: Record<string, string> = catalog.categories;
export const ICON_CATALOG: IconEntry[] = catalog.icons.map((i) => ({ id: i.id, label: i.label, cat: i.cat, kw: i.kw }));

/**
 * Ícones salvos antes do catálogo novo (lucide). Continuam renderizando exatamente como antes;
 * o catálogo novo usa ids "ph:<nome>" (Phosphor, peso regular).
 */
const LEGACY: Record<string, IconComp> = {
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
  Layers,
};
const LEGACY_LABEL: Record<string, string> = {
  Target: 'Alvo',
  Dumbbell: 'Haltere',
  Trophy: 'Troféu',
  Footprints: 'Pegadas',
  BookOpen: 'Livro aberto',
  Heart: 'Coração',
  Droplets: 'Gotas',
  Utensils: 'Talheres',
  Wallet: 'Carteira',
  Brain: 'Cérebro',
  Briefcase: 'Maleta',
  Star: 'Estrela',
  Zap: 'Raio',
  Layers: 'Camadas',
};

const cache = new Map<string, IconComp>();

/** Componente de ícone para um id salvo na meta (ph:... ou nome legado). Desconhecido => Camadas. */
export function iconFor(id: string | null | undefined): IconComp {
  const key = id ?? '';
  const hit = cache.get(key);
  if (hit) return hit;
  let comp: IconComp;
  if (key.startsWith('ph:') && PHOSPHOR_PATHS[key.slice(3)]) {
    const inner = PHOSPHOR_PATHS[key.slice(3)];
    comp = ({ className }) => (
      <svg
        viewBox="0 0 256 256"
        fill="currentColor"
        className={className}
        aria-hidden
        focusable="false"
        // conteúdo gerado em build a partir de @phosphor-icons/core (confiável, não vem do usuário)
        dangerouslySetInnerHTML={{ __html: inner }}
      />
    );
  } else {
    comp = LEGACY[key] ?? Layers;
  }
  cache.set(key, comp);
  return comp;
}

export function iconLabel(id: string | null | undefined): string {
  if (!id) return 'Camadas';
  return ICON_CATALOG.find((i) => i.id === id)?.label ?? LEGACY_LABEL[id] ?? 'Ícone';
}

export const DEFAULT_ICON = 'ph:target';

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca por nome, palavras-chave e categoria (sem acento, múltiplos termos = todos precisam casar). */
export function searchIcons(query: string, category: string | null, list: IconEntry[] = ICON_CATALOG): IconEntry[] {
  const terms = strip(query).split(/\s+/).filter(Boolean);
  return list.filter((i) => {
    if (category && i.cat !== category) return false;
    if (!terms.length) return true;
    // cada termo precisa COMEÇAR alguma palavra (evita "moto" casar com "remoto")
    const words = strip(`${i.label} ${i.kw} ${ICON_CATEGORIES[i.cat] ?? ''}`).split(/[^a-z0-9]+/).filter(Boolean);
    return terms.every((t) => words.some((w) => w.startsWith(t)));
  });
}
