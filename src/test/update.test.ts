import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { versionCodeFromTag, parseTag, versionNameFromTag } from '../domain/update/version';
import {
  checkForUpdate,
  cleanNotes,
  parseSha256,
  selectUpdate,
  GithubRelease,
  UpdateCheckError,
  FetchLike,
} from '../application/services/UpdateService';

const rel = (tag: string, over: Partial<GithubRelease> = {}): GithubRelease => ({
  tag_name: tag,
  name: `Ziel ${tag}`,
  body: '## What\'s Changed\n* Novo visual\n**Full Changelog**: https://x/y',
  html_url: `https://github.com/Murilo-Alexandre/ziel/releases/tag/${tag}`,
  draft: false,
  prerelease: tag.includes('-'),
  published_at: '2026-11-10T00:00:00Z',
  assets: [
    { name: `Ziel-${tag}.apk`, browser_download_url: `https://github.com/x/${tag}.apk`, size: 3_000_000 },
    { name: `Ziel-${tag}.apk.sha256`, browser_download_url: `https://github.com/x/${tag}.sha256`, size: 89 },
  ],
  ...over,
});

describe('versão: tag ↔ versionCode', () => {
  it('é crescente entre betas, rc, final e patches', () => {
    const order = ['v0.1.0-alpha.1', 'v0.1.0-beta.1', 'v0.1.0-beta.2', 'v0.1.0-rc.1', 'v0.1.0', 'v0.1.1-beta.1', 'v0.2.0-beta.1', 'v1.0.0'];
    const codes = order.map((t) => versionCodeFromTag(t)!);
    expect(codes).toEqual([...codes].sort((a, b) => a - b));
    expect(new Set(codes).size).toBe(codes.length);
    expect(versionCodeFromTag('v0.1.0-beta.1')).toBe(10031);
    expect(versionCodeFromTag('v0.1.0-beta.2')).toBe(10032);
    expect(versionNameFromTag('v0.1.0-beta.2')).toBe('0.1.0-beta.2');
  });

  it('rejeita tags inválidas', () => {
    for (const t of ['0.1.0', 'v1', 'v1.0.0-beta', 'v1.0.0-beta.0', 'v1.0.0-beta.29', 'v1.100.0', 'latest', '']) {
      expect(parseTag(t), t).toBeNull();
    }
  });

  it('é idêntica ao script usado pelo CI (scripts/version-from-tag.mjs)', () => {
    const script = resolve(__dirname, '../../scripts/version-from-tag.mjs');
    for (const tag of ['v0.1.0-beta.1', 'v0.1.0-beta.2', 'v0.1.0', 'v0.1.1-rc.3', 'v1.0.0', 'v2.10.5-alpha.9']) {
      const out = JSON.parse(execFileSync(process.execPath, [script, tag], { encoding: 'utf-8' }));
      expect(out.versionCode, tag).toBe(versionCodeFromTag(tag));
    }
  });
});

describe('seleção de atualização', () => {
  const installed = versionCodeFromTag('v0.1.0-beta.1')!;

  it('beta.1 instalada + beta.2 publicada → oferece a beta.2', () => {
    const u = selectUpdate([rel('v0.1.0-beta.2'), rel('v0.1.0-beta.1')], installed);
    expect(u?.tag).toBe('v0.1.0-beta.2');
    expect(u?.versionCode).toBe(10032);
    expect(u?.apkUrl).toContain('v0.1.0-beta.2.apk');
    expect(u?.sha256Url).toContain('.sha256');
    expect(u?.prerelease).toBe(true);
    expect(u?.notes).toBe('• Novo visual');
  });

  it('escolhe a MAIS nova mesmo fora de ordem; ignora rascunho, tag inválida e release sem APK/SHA', () => {
    const noSha = rel('v0.3.0', { assets: [rel('v0.3.0').assets[0]] });
    const draft = rel('v0.9.0', { draft: true });
    const bad = rel('nightly');
    const u = selectUpdate([rel('v0.1.0-beta.2'), noSha, draft, bad, rel('v0.2.0-beta.1')], installed);
    expect(u?.tag).toBe('v0.2.0-beta.1');
  });

  it('sem versão maior → null (já atualizado, inclusive igual e mais antiga)', () => {
    expect(selectUpdate([rel('v0.1.0-beta.1')], installed)).toBeNull();
    expect(selectUpdate([rel('v0.1.0-alpha.1')], installed)).toBeNull();
    expect(selectUpdate([], installed)).toBeNull();
  });

  it('exige asset com o nome exato Ziel-<tag>.apk', () => {
    const wrong = rel('v0.2.0', { assets: [{ name: 'outro.apk', browser_download_url: 'https://x', size: 1 }] });
    expect(selectUpdate([wrong], installed)).toBeNull();
  });
});

describe('textos', () => {
  it('parseSha256 lê o formato do sha256sum e rejeita lixo', () => {
    const h = 'a'.repeat(64);
    expect(parseSha256(`${h.toUpperCase()}  Ziel-v0.1.0.apk\n`)).toBe(h);
    expect(parseSha256('nada')).toBeNull();
    expect(parseSha256('abc123')).toBeNull();
  });

  it('cleanNotes tira ruído do changelog automático e limita o tamanho', () => {
    expect(cleanNotes(null)).toBe('');
    expect(cleanNotes('**Full Changelog**: https://x')).toBe('');
    expect(cleanNotes('x'.repeat(2000), 100).length).toBeLessThanOrEqual(101);
  });
});

describe('checkForUpdate (GitHub API simulada)', () => {
  const ok = (data: unknown): FetchLike => async () => ({ ok: true, status: 200, json: async () => data });

  it('retorna a atualização e consulta a API pública de releases', async () => {
    let called = '';
    const f: FetchLike = async (url) => {
      called = url;
      return { ok: true, status: 200, json: async () => [rel('v0.1.0-beta.2')] };
    };
    const u = await checkForUpdate(10031, f);
    expect(u?.tag).toBe('v0.1.0-beta.2');
    expect(called).toContain('api.github.com/repos/Murilo-Alexandre/ziel/releases');
  });

  it('erros viram mensagens claras (offline, limite de consultas, 500, formato)', async () => {
    await expect(checkForUpdate(1, async () => { throw new Error('net'); })).rejects.toThrow(/Sem conexão/);
    await expect(checkForUpdate(1, async () => ({ ok: false, status: 403, json: async () => ({}) }))).rejects.toThrow(/limitou/);
    await expect(checkForUpdate(1, async () => ({ ok: false, status: 500, json: async () => ({}) }))).rejects.toBeInstanceOf(UpdateCheckError);
    await expect(checkForUpdate(1, ok({ message: 'x' }))).rejects.toThrow(/inesperada/);
  });
});
