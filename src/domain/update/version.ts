// Versionamento: tag vMAJOR.MINOR.PATCH[-(alpha|beta|rc).N] <-> versionCode do Android.
// DEVE ser idêntico a scripts/version-from-tag.mjs (há um teste de paridade).

export type ParsedTag = { major: number; minor: number; patch: number; stage: 'alpha' | 'beta' | 'rc' | null; n: number };

const STAGE_BASE = { alpha: 0, beta: 30, rc: 70 } as const;

export function parseTag(tag: string): ParsedTag | null {
  const m = /^v(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/.exec(tag.trim());
  if (!m) return null;
  const stage = (m[4] as ParsedTag['stage']) ?? null;
  const n = m[5] ? Number(m[5]) : 0;
  if (stage && (n < 1 || n > 28)) return null;
  const p = { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), stage, n };
  if (p.minor > 99 || p.patch > 99 || p.major > 2000) return null;
  return p;
}

export function versionCodeFromTag(tag: string): number | null {
  const p = parseTag(tag);
  if (!p) return null;
  const stageCode = p.stage ? STAGE_BASE[p.stage] + p.n : 99;
  return p.major * 1_000_000 + p.minor * 10_000 + p.patch * 100 + stageCode;
}

export function versionNameFromTag(tag: string): string {
  return tag.replace(/^v/, '');
}
