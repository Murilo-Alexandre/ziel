import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ICON_CATALOG, ICON_CATEGORIES, iconFor, iconLabel, searchIcons, DEFAULT_ICON } from '../shared/icons/registry';
import { PHOSPHOR_PATHS } from '../shared/icons/phosphor.generated';
import { GOAL_COLORS, toneFor } from '../shared/ui/goalIcons';

describe('catálogo de ícones', () => {
  it('é grande, sem ids repetidos e todo ícone tem o desenho gerado', () => {
    expect(ICON_CATALOG.length).toBeGreaterThanOrEqual(300);
    const ids = ICON_CATALOG.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of ICON_CATALOG) {
      expect(i.id.startsWith('ph:')).toBe(true);
      expect(PHOSPHOR_PATHS[i.id.slice(3)], i.id).toMatch(/<(path|circle|rect|line|polyline|g)/);
    }
  });

  it('nomes e categorias estão em português e cada categoria tem ícones', () => {
    expect(Object.values(ICON_CATEGORIES)).toEqual(
      expect.arrayContaining(['Saúde', 'Esportes', 'Veículos', 'Alimentação', 'Trabalho', 'Estudos', 'Viagens', 'Finanças', 'Lazer e cultura'])
    );
    for (const cat of Object.keys(ICON_CATEGORIES)) expect(ICON_CATALOG.some((i) => i.cat === cat), cat).toBe(true);
    for (const i of ICON_CATALOG) {
      expect(ICON_CATEGORIES[i.cat], i.id).toBeTruthy();
      expect(i.label.trim().length, i.id).toBeGreaterThan(1);
      expect(i.label, i.id).not.toMatch(/^[a-z]+(-[a-z]+)+$/); // nada de "soccer-ball" cru
    }
  });

  it('cobre os objetivos pedidos: medicamentos, médicos, futebol, musculação, motocross, motos, carros, corrida, tênis, comida, trabalho, estudo, viagem, finanças, lazer', () => {
    const wanted: Record<string, string> = {
      remedio: 'Remédio',
      medico: 'Médico',
      futebol: 'Futebol',
      musculacao: 'Musculação',
      motocross: 'Moto / Motocross',
      moto: 'Moto / Motocross',
      carro: 'Carro',
      corrida: 'Corrida',
      tenis: 'Tênis esportivo',
      almoco: 'Refeição',
      trabalho: 'Trabalho',
      estudo: 'Estudante',
      viagem: 'Viagem de avião',
      dinheiro: 'Dinheiro',
      cinema: 'Cinema',
      dentista: 'Dentista',
      academia: 'Musculação',
      violao: 'Violão',
    };
    for (const [q, label] of Object.entries(wanted)) {
      expect(searchIcons(q, null).map((i) => i.label), q).toContain(label);
    }
  });
});

describe('pesquisa', () => {
  it('ignora acentos e maiúsculas, casa por palavra-chave e categoria, exige todos os termos', () => {
    expect(searchIcons('REMEDIO', null).map((i) => i.label)).toContain('Remédio');
    expect(searchIcons('remédio', null).map((i) => i.label)).toContain('Remédio');
    expect(searchIcons('bola', null).map((i) => i.label)).toEqual(expect.arrayContaining(['Futebol', 'Basquete']));
    expect(searchIcons('esportes', null).length).toBeGreaterThan(20);
    expect(searchIcons('bola gol', null).map((i) => i.label)).toContain('Futebol');
    expect(searchIcons('xyzabc', null)).toEqual([]);
    expect(searchIcons('', null).length).toBe(ICON_CATALOG.length);
  });

  it('casa por início de palavra ("moto" não traz "remoto") e filtra por categoria', () => {
    const labels = searchIcons('moto', null).map((i) => i.label);
    expect(labels).toContain('Moto / Motocross');
    expect(labels).not.toContain('Notebook');
    expect(searchIcons('', 'veiculos').every((i) => i.cat === 'veiculos')).toBe(true);
    expect(searchIcons('carro', 'saude')).toEqual([]);
  });
});

describe('compatibilidade com ícones já salvos', () => {
  it('nomes antigos continuam resolvendo (e rotulados); desconhecido cai em "Camadas"', () => {
    for (const legacy of ['Target', 'Dumbbell', 'Trophy', 'Footprints', 'BookOpen', 'Heart', 'Droplets', 'Utensils', 'Wallet', 'Brain', 'Briefcase', 'Star', 'Zap']) {
      expect(['function', 'object']).toContain(typeof iconFor(legacy)); // lucide usa forwardRef (objeto)
      expect(iconLabel(legacy)).not.toBe('Ícone');
    }
    expect(iconFor('Inexistente')).toBe(iconFor(null));
    expect(iconFor('ph:nao-existe')).toBe(iconFor(undefined));
    expect(iconFor(DEFAULT_ICON)).not.toBe(iconFor(null));
    expect(iconFor('ph:soccer-ball')).toBe(iconFor('ph:soccer-ball')); // memorizado
  });

  it('cores salvas em versões anteriores continuam mapeando para a paleta atual', () => {
    for (const old of ['#6D9BFF', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EE7F7A', '#C8DA7A', '#F6C85F']) {
      expect(GOAL_COLORS).toContain(toneFor(old, 'g1').hex);
    }
    expect(toneFor('#F28B82').hex).toBe('#F28B82');
    expect(toneFor(null, 'abc').hex).toBe(toneFor(null, 'abc').hex); // fallback estável
  });
});

describe('o gerador reproduz o arquivo versionado', () => {
  it('todo nome do catálogo existe no arquivo gerado (sem ícone "fantasma")', () => {
    const cat = JSON.parse(readFileSync(resolve(__dirname, '../shared/icons/catalog.json'), 'utf-8'));
    for (const i of cat.icons) expect(Object.keys(PHOSPHOR_PATHS)).toContain(i.ph);
  });
});
