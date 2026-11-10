import { openDB, DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import {
  GoalDefinition,
  GoalRevision,
  Occurrence,
  CycleInstance,
  JournalRecord,
  Attachment,
  StatusChange,
} from '../../../domain/types';

export interface ZielDBSchema extends DBSchema {
  goals: { key: string; value: GoalDefinition };
  revisions: { key: string; value: GoalRevision; indexes: { 'by-goalId': string } };
  occurrences: {
    key: string;
    value: Occurrence;
    indexes: {
      'by-scheduledDate': string;
      'by-occurrenceKey': string;
      'by-goalAndDate': [string, string];
      'by-goalId': string;
    };
  };
  cycleInstances: {
    key: string;
    value: CycleInstance;
    indexes: { 'by-goalId': string; 'by-cycleKey': string };
  };
  journalRecords: { key: string; value: JournalRecord; indexes: { 'by-targetKey': string } };
  attachments: { key: string; value: Attachment; indexes: { 'by-recordId': string } };
  statusChanges: { key: string; value: StatusChange; indexes: { 'by-occurrenceId': string } };
}

export const DB_NAME = 'ziel_local_db';
/** v1: esquema inicial. v2: chave de ocorrência sem revisão (dedup), índices extras, chave de alvo nos registros. */
export const DB_VERSION = 2;

export function journalTargetKey(target: JournalRecord['target']): string {
  return target.type === 'occurrence' ? `occ:${target.occurrenceId}` : `cycle:${target.cycleInstanceId}`;
}

type UpgradeTx = IDBPTransaction<ZielDBSchema, StoreNames<ZielDBSchema>[], 'versionchange'>;

function createV1(db: IDBPDatabase<ZielDBSchema>) {
  db.createObjectStore('goals', { keyPath: 'id' });
  const revStore = db.createObjectStore('revisions', { keyPath: 'id' });
  revStore.createIndex('by-goalId', 'goalId');
  const occStore = db.createObjectStore('occurrences', { keyPath: 'id' });
  occStore.createIndex('by-scheduledDate', 'scheduledDate');
  occStore.createIndex('by-occurrenceKey', 'occurrenceKey', { unique: true });
  occStore.createIndex('by-goalAndDate', ['goalId', 'scheduledDate']);
  const cycleStore = db.createObjectStore('cycleInstances', { keyPath: 'id' });
  cycleStore.createIndex('by-goalId', 'goalId');
  cycleStore.createIndex('by-cycleKey', 'cycleKey');
  db.createObjectStore('journalRecords', { keyPath: 'id' });
  const attachStore = db.createObjectStore('attachments', { keyPath: 'id' });
  attachStore.createIndex('by-recordId', 'recordId');
  const statusStore = db.createObjectStore('statusChanges', { keyPath: 'id' });
  statusStore.createIndex('by-occurrenceId', 'occurrenceId');
}

/**
 * Migração v1 -> v2. Preserva todos os dados:
 *  - ocorrências passam a usar a chave goalId_data_slot; duplicatas (mesmo slot em revisões diferentes)
 *    são fundidas mantendo a que tem status resolvido e religando evidências/histórico à sobrevivente;
 *  - registros do diário ganham `targetKey` (índice);
 *  - cycleKey perde o id da revisão.
 */
async function migrateV1toV2(tx: UpgradeTx) {
  const occStore = tx.objectStore('occurrences');
  const occIndexNames = Array.from(occStore.indexNames) as string[];
  if (!occIndexNames.includes('by-goalId')) occStore.createIndex('by-goalId', 'goalId');

  // Índice único antigo precisa ser recriado depois de normalizar chaves.
  const all = await occStore.getAll();
  const survivors = new Map<string, Occurrence>();
  const idRemap = new Map<string, string>();
  const rank = (o: Occurrence) => (o.status === 'pending' ? 0 : 1) * 1e13 + Date.parse(o.updatedAt || '') || 0;
  for (const occ of all) {
    const key = `${occ.goalId}_${occ.scheduledDate}_${occ.slotKey}`;
    const current = survivors.get(key);
    if (!current || rank(occ) > rank(current)) {
      if (current) idRemap.set(current.id, occ.id);
      survivors.set(key, { ...occ, occurrenceKey: key });
    } else {
      idRemap.set(occ.id, current.id);
    }
  }
  occStore.deleteIndex('by-occurrenceKey');
  await occStore.clear();
  for (const occ of survivors.values()) await occStore.put(occ);
  occStore.createIndex('by-occurrenceKey', 'occurrenceKey', { unique: true });

  const journal = tx.objectStore('journalRecords');
  if (!(Array.from(journal.indexNames) as string[]).includes('by-targetKey')) {
    journal.createIndex('by-targetKey', 'targetKey');
  }
  const records = await journal.getAll();
  for (const rec of records) {
    let target = rec.target;
    if (target.type === 'occurrence' && idRemap.has(target.occurrenceId)) {
      target = { type: 'occurrence', occurrenceId: idRemap.get(target.occurrenceId)! };
    }
    await journal.put({ ...rec, target, targetKey: journalTargetKey(target) } as JournalRecord);
  }
  const changes = tx.objectStore('statusChanges');
  for (const sc of await changes.getAll()) {
    if (idRemap.has(sc.occurrenceId)) await changes.put({ ...sc, occurrenceId: idRemap.get(sc.occurrenceId)! });
  }

  const cycles = tx.objectStore('cycleInstances');
  for (const ci of await cycles.getAll()) {
    const m = /^(goal_[^_]+_[^_]+)_rev_[^_]+_[^_]+_(.*)$/.exec(ci.cycleKey);
    if (m) await cycles.put({ ...ci, cycleKey: `${m[1]}_${m[2]}` });
  }
}

let dbPromise: Promise<IDBPDatabase<ZielDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<ZielDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<ZielDBSchema>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          createV1(db);
          const occ = tx.objectStore('occurrences');
          occ.createIndex('by-goalId', 'goalId');
          tx.objectStore('journalRecords').createIndex('by-targetKey', 'targetKey');
          return;
        }
        if (oldVersion < 2) {
          await migrateV1toV2(tx as unknown as UpgradeTx);
        }
      },
      blocked() {
        console.warn('Ziel: abertura do banco bloqueada por outra aba/instância.');
      },
      terminated() {
        // Conexão perdida (ex.: o sistema liberou o banco): a próxima chamada reabre.
        dbPromise = null;
      },
    }).catch((err) => {
      dbPromise = null; // permite nova tentativa; o erro NÃO é engolido
      throw err;
    });
  }
  return dbPromise;
}

/** Fecha e esquece a conexão (usado em testes para simular "reiniciar o app"). */
export async function resetDbConnection(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise.catch(() => null);
    db?.close();
  }
  dbPromise = null;
}

/** Pede ao navegador/WebView armazenamento persistente (evita despejo do IndexedDB sob pressão de espaço). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    /* indisponível: segue sem persistência garantida */
  }
  return false;
}
