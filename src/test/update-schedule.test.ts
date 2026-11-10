import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AUTO_INTERVAL_MS, isCheckDue } from '../shared/Update';

const H = 3_600_000;

describe('verificação automática de atualizações (intervalo mínimo de 24 h)', () => {
  it('o intervalo é de 24 horas', () => {
    expect(AUTO_INTERVAL_MS).toBe(24 * H);
  });

  it('nunca consultou => consulta; antes de 24 h => NÃO consulta; a partir de 24 h => consulta', () => {
    const now = Date.UTC(2026, 10, 10, 12);
    expect(isCheckDue(null, now)).toBe(true);
    expect(isCheckDue(now - 1 * H, now)).toBe(false);
    expect(isCheckDue(now - 23 * H - 59 * 60_000, now)).toBe(false);
    expect(isCheckDue(now - 24 * H, now)).toBe(true);
    expect(isCheckDue(now - 72 * H, now)).toBe(true);
  });

  it('relógio do aparelho voltou atrás (última consulta "no futuro") => consulta em vez de ficar sem checar', () => {
    const now = Date.UTC(2026, 10, 10, 12);
    expect(isCheckDue(now + 5 * H, now)).toBe(true);
  });

  it('o provedor consulta ao abrir e ao voltar para o app, e a consulta só roda se estiver "devida"', () => {
    const src = readFileSync(resolve(__dirname, '../shared/Update.tsx'), 'utf-8');
    expect(src).toMatch(/appStateChange/); // ao voltar para o app (Android)
    expect(src).toMatch(/visibilitychange/); // e quando a aba/janela volta a ficar visível
    expect(src).toMatch(/isCheckDue\(last, Date\.now\(\)\)/);
    expect(src).toMatch(/silent: true/); // falhas de rede da consulta automática são silenciosas
    expect(src).toMatch(/LAST_CHECK_KEY/); // horário da última verificação é guardado
  });
});

describe('modal de atualização não pode prender o usuário', () => {
  const sheet = readFileSync(resolve(__dirname, '../shared/ui/Sheet.tsx'), 'utf-8');
  const ui = readFileSync(resolve(__dirname, '../features/update/UpdateUi.tsx'), 'utf-8');

  it('altura vem de --app-h (px), não de dvh (que WebViews antigos ignoram)', () => {
    expect(sheet).toMatch(/var\(--app-h/);
    expect(sheet).not.toMatch(/max-h-\[\d+dvh\]/);
    expect(sheet).toMatch(/overflow-y-auto/);
    expect(sheet).toMatch(/touch-action:pan-y/);
  });

  it('o botão de instalar fica no rodapé fixo do modal (fora da área rolável) e respeita a safe area', () => {
    expect(ui).toMatch(/footer=\{footer\}/);
    expect(ui).toMatch(/Instalar atualização/);
    expect(sheet).toMatch(/pb-safe/);
  });

  it('há aviso com "Atualizar" e "Depois"', () => {
    expect(ui).toMatch(/Depois/);
    expect(ui).toMatch(/Atualizar/);
  });
});
