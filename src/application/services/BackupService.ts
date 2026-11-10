import { BackupStore, ZielSnapshot } from '../../infrastructure/ports/BackupStore';

export const BACKUP_FORMAT = 'ziel-backup';
export const BACKUP_VERSION = 1;

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  backupVersion: number;
  exportedAt: string;
  counts: Record<string, number>;
  data: ZielSnapshot;
};

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

const COLLECTIONS = [
  'goals',
  'revisions',
  'occurrences',
  'cycleInstances',
  'journalRecords',
  'attachments',
  'statusChanges',
] as const;

function fail(msg: string): never {
  throw new BackupValidationError(msg);
}

function assertUniqueIds(list: { id: string }[], label: string) {
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item.id !== 'string' || !item.id) fail(`${label}: registro sem id.`);
    if (seen.has(item.id)) fail(`${label}: id duplicado (${item.id}).`);
    seen.add(item.id);
  }
}

/** Valida estrutura, versão e integridade referencial. Lança BackupValidationError; nunca toca no banco. */
export function validateBackup(raw: unknown): BackupFile {
  if (!raw || typeof raw !== 'object') fail('Arquivo de backup inválido.');
  const file = raw as Partial<BackupFile>;
  if (file.format !== BACKUP_FORMAT) fail('O arquivo não é um backup do Ziel.');
  if (typeof file.backupVersion !== 'number') fail('Backup sem versão.');
  if (file.backupVersion > BACKUP_VERSION) fail('Backup gerado por uma versão mais nova do Ziel. Atualize o aplicativo.');
  const data = file.data as ZielSnapshot | undefined;
  if (!data || typeof data !== 'object') fail('Backup sem dados.');
  for (const c of COLLECTIONS) {
    if (!Array.isArray(data[c])) fail(`Backup corrompido: coleção "${c}" ausente.`);
    assertUniqueIds(data[c] as { id: string }[], c);
  }

  const goalIds = new Set(data.goals.map((g) => g.id));
  const revisionIds = new Set(data.revisions.map((r) => r.id));
  const occurrenceIds = new Set(data.occurrences.map((o) => o.id));
  const recordIds = new Set(data.journalRecords.map((r) => r.id));
  const keys = new Set<string>();

  for (const g of data.goals) {
    if (g.parentId && !goalIds.has(g.parentId)) fail(`Meta ${g.id} aponta para um pai inexistente.`);
    if (!revisionIds.has(g.currentRevisionId)) fail(`Meta ${g.id} sem revisão vigente.`);
  }
  for (const r of data.revisions) {
    if (!goalIds.has(r.goalId)) fail(`Revisão ${r.id} sem meta.`);
    if (typeof r.name !== 'string' || !r.schedule || !r.trackingCycle || !r.activePeriod) fail(`Revisão ${r.id} incompleta.`);
  }
  for (const o of data.occurrences) {
    if (!goalIds.has(o.goalId)) fail(`Ocorrência ${o.id} sem meta.`);
    if (!['pending', 'partial', 'completed', 'not_done'].includes(o.status)) fail(`Ocorrência ${o.id} com status inválido.`);
    if (keys.has(o.occurrenceKey)) fail(`Ocorrência duplicada (${o.occurrenceKey}).`);
    keys.add(o.occurrenceKey);
  }
  for (const r of data.journalRecords) {
    if (r.target?.type === 'occurrence' && !occurrenceIds.has(r.target.occurrenceId)) {
      fail(`Registro ${r.id} aponta para ocorrência inexistente.`);
    }
  }
  for (const a of data.attachments) {
    if (!recordIds.has(a.recordId)) fail(`Anexo ${a.id} sem registro.`);
  }
  for (const s of data.statusChanges) {
    if (!occurrenceIds.has(s.occurrenceId)) fail(`Histórico de status ${s.id} sem ocorrência.`);
  }
  return file as BackupFile;
}

export class BackupService {
  constructor(private store: BackupStore) {}

  async exportBackup(): Promise<BackupFile> {
    const data = await this.store.readAll();
    const counts: Record<string, number> = {};
    for (const c of COLLECTIONS) counts[c] = data[c].length;
    return {
      format: BACKUP_FORMAT,
      backupVersion: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      counts,
      data,
    };
  }

  async exportToJson(): Promise<string> {
    return JSON.stringify(await this.exportBackup());
  }

  /** Lê e valida SEM aplicar (para pré-visualizar contagens ao usuário). */
  parse(json: string): BackupFile {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      throw new BackupValidationError('O arquivo não é um JSON válido.');
    }
    return validateBackup(raw);
  }

  /** Valida por completo e só então substitui os dados, atomicamente. Em qualquer erro, nada muda. */
  async importFromJson(json: string): Promise<BackupFile> {
    const file = this.parse(json);
    await this.store.replaceAll(file.data);
    return file;
  }
}
