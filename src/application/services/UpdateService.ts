import { versionCodeFromTag, versionNameFromTag } from '../../domain/update/version';

export const RELEASES_API = 'https://api.github.com/repos/Murilo-Alexandre/ziel/releases?per_page=15';
export const RELEASES_PAGE = 'https://github.com/Murilo-Alexandre/ziel/releases';

type GithubAsset = { name: string; browser_download_url: string; size: number };
export type GithubRelease = {
  tag_name: string;
  name?: string | null;
  body?: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  published_at?: string | null;
  assets: GithubAsset[];
};

export type UpdateInfo = {
  tag: string;
  versionName: string;
  versionCode: number;
  notes: string;
  pageUrl: string;
  apkUrl: string;
  sha256Url: string;
  size: number;
  prerelease: boolean;
  publishedAt: string | null;
};

/** Texto das novidades para exibir no app: remove cabeçalhos/links de "changelog" gerados automaticamente. */
export function cleanNotes(body: string | null | undefined, max = 600): string {
  if (!body) return '';
  const lines = body
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^\*\*full changelog\*\*/i.test(l) && !/^#+\s*what'?s changed/i.test(l));
  const text = lines
    .map((l) => l.replace(/^#+\s*/, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^[*-]\s+/, '• '))
    .join('\n');
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/**
 * Escolhe a release mais nova (por versionCode) que seja MAIOR que a instalada e tenha APK e SHA-256 anexados
 * com o nome esperado (Ziel-<tag>.apk / Ziel-<tag>.apk.sha256). Rascunhos e tags inválidas são ignorados.
 */
export function selectUpdate(releases: GithubRelease[], installedVersionCode: number): UpdateInfo | null {
  let best: UpdateInfo | null = null;
  for (const r of releases) {
    if (r.draft) continue;
    const code = versionCodeFromTag(r.tag_name);
    if (code === null || code <= installedVersionCode) continue;
    const apk = r.assets.find((a) => a.name === `Ziel-${r.tag_name}.apk`);
    const sha = r.assets.find((a) => a.name === `Ziel-${r.tag_name}.apk.sha256`);
    if (!apk || !sha) continue;
    if (best && best.versionCode >= code) continue;
    best = {
      tag: r.tag_name,
      versionName: versionNameFromTag(r.tag_name),
      versionCode: code,
      notes: cleanNotes(r.body),
      pageUrl: r.html_url,
      apkUrl: apk.browser_download_url,
      sha256Url: sha.browser_download_url,
      size: apk.size,
      prerelease: r.prerelease,
      publishedAt: r.published_at ?? null,
    };
  }
  return best;
}

/** O arquivo .sha256 tem o formato "<hash>  <nome>" (sha256sum). */
export function parseSha256(text: string): string | null {
  const m = /^\s*([0-9a-fA-F]{64})\b/.exec(text);
  return m ? m[1].toLowerCase() : null;
}

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export class UpdateCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpdateCheckError';
  }
}

export async function checkForUpdate(installedVersionCode: number, fetchFn: FetchLike = fetch as unknown as FetchLike): Promise<UpdateInfo | null> {
  let res;
  try {
    res = await fetchFn(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
  } catch {
    throw new UpdateCheckError('Sem conexão com o GitHub. Tente de novo quando estiver online.');
  }
  if (res.status === 403 || res.status === 429) throw new UpdateCheckError('O GitHub limitou as consultas por agora. Tente mais tarde.');
  if (!res.ok) throw new UpdateCheckError(`O GitHub respondeu ${res.status}.`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new UpdateCheckError('Resposta inesperada do GitHub.');
  return selectUpdate(data as GithubRelease[], installedVersionCode);
}
