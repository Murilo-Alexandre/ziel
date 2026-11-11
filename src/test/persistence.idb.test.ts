import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDB } from 'idb';
import { DB_NAME, DB_VERSION, getDB, resetDbConnection } from '../infrastructure/persistence/indexeddb/database';
import { IndexedDbGoalRepository } from '../infrastructure/persistence/indexeddb/IndexedDbGoalRepository';
import { IndexedDbOccurrenceRepository } from '../infrastructure/persistence/indexeddb/IndexedDbOccurrenceRepository';
import { IndexedDbJournalRepository } from '../infrastructure/persistence/indexeddb/IndexedDbJournalRepository';
import { IndexedDbBackupStore } from '../infrastructure/persistence/indexeddb/IndexedDbBackupStore';
import { GoalService } from '../application/services/GoalService';
import { OccurrenceService } from '../application/services/OccurrenceService';
import { JournalService } from '../application/services/JournalService';
import { BackupService, BackupValidationError } from '../application/services/BackupService';
import { createTreinar, flatten, completeOn, PERIOD } from './helpers';
import type { World } from './helpers';

/** Mundo real sobre IndexedDB (fake-indexeddb implementa a especificação; é o mesmo código do app). */
function realWorld(today = '2026-08-19') {
  const clock = { today };
  const goalRepo = new IndexedDbGoalRepository();
  const occRepo = new IndexedDbOccurrenceRepository();
  const journalRepo = new IndexedDbJournalRepository();
  return {
    clock,
    goalRepo,
    occRepo,
    journalRepo,
    goals: new GoalService(goalRepo, () => clock.today),
    occ: new OccurrenceService(goalRepo, occRepo, journalRepo, () => clock.today),
    journal: new JournalService(journalRepo),
    backup: new BackupService(new IndexedDbBackupStore()),
  };
}

async function wipe() {
  await resetDbConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

beforeEach(wipe);

const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 3) % 256);
const readBlob = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

describe('A55 — banco novo inicializa no esquema mais recente', () => {
  it('cria todas as stores e índices da versão atual', async () => {
    const db = await getDB();
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(
      ['attachments', 'cycleInstances', 'goals', 'journalRecords', 'occurrences', 'revisions', 'statusChanges'].sort()
    );
    const occ = db.transaction('occurrences').store;
    expect([...occ.indexNames].sort()).toEqual(['by-goalAndDate', 'by-goalId', 'by-occurrenceKey', 'by-scheduledDate']);
    expect(occ.index('by-occurrenceKey').unique).toBe(true);
    expect([...db.transaction('journalRecords').store.indexNames]).toContain('by-targetKey');
  });
});

describe('A49 — persistência após "reiniciar" (conexão fechada e reaberta)', () => {
  it('metas, revisões, status, trilha, registros e ciclos sobrevivem', async () => {
    const w = realWorld();
    await createTreinar(w as unknown as World);
    await completeOn(w as unknown as World, '2026-08-19', ['Futebol', 'Corrida']);
    const wed = (await w.occ.getTodayGoalTree('2026-08-19')).nodes[0].children[0];
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: wed.occurrence!.id }, 'gol de placa');
    await w.occ.updateStatus(wed.occurrence!.id, 'partial'); // revisão de status

    await resetDbConnection(); // app encerrado
    const r = realWorld(); // app reaberto: novos objetos, mesmo disco
    const tree = await r.occ.getTodayGoalTree('2026-08-19');
    const root = tree.nodes[0];
    expect(root.revision.name).toBe('Treinar');
    expect(root.children.map((c) => [c.revision.name, c.occurrence?.status])).toEqual([
      ['Futebol', 'partial'],
      ['Corrida', 'completed'],
      ['Musculação', 'pending'],
    ]);
    expect(root.cycleInstance?.expectedCount).toBe(9);
    expect(root.cycleInstance?.completedCount).toBe(1);
    expect(root.children[0].evidenceCount).toBe(1);
    expect((await r.journal.getTimelineForOccurrence(wed.occurrence!.id))[0].comment).toBe('gol de placa');
    expect((await r.journalRepo.listStatusChangesForOccurrence(wed.occurrence!.id)).map((s) => s.toStatus)).toEqual(['completed', 'partial']);
  });
});

describe('Geração idempotente e atômica (A09/A36 em disco)', () => {
  it('geração concorrente por instâncias independentes não duplica nem viola o índice único', async () => {
    const a = realWorld();
    const b = realWorld(); // duas "abas"/instâncias sem a mesma fila
    await a.goals.createGoal({ name: 'Diária', schedule: { type: 'daily' }, activePeriod: PERIOD });
    const runs = await Promise.all([
      ...Array.from({ length: 8 }, () => a.occ.getOrGenerateOccurrencesForDate('2026-08-19')),
      ...Array.from({ length: 8 }, () => b.occ.getOrGenerateOccurrencesForDate('2026-08-19')),
    ]);
    expect(new Set(runs.flat().map((o) => o.id)).size).toBe(1);
    expect(await a.occRepo.findByDate('2026-08-19')).toHaveLength(1);
  });

  it('editar "esta e as próximas" no mesmo dia não duplica e o status já resolvido não é sobrescrito', async () => {
    const w = realWorld();
    const { definition: g } = await w.goals.createGoal({ name: 'Meta', schedule: { type: 'daily' }, activePeriod: PERIOD });
    const [o] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    await w.occ.updateStatus(o.id, 'completed');
    await w.goals.editGoalThisAndFuture(g.id, '2026-08-19', { description: 'x' });
    await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    const all = await w.occRepo.findByDate('2026-08-19');
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('completed');
  });

  it('remarcar meta única em disco move a ocorrência e libera a chave antiga', async () => {
    const w = realWorld();
    await w.goals.createGoal({ name: 'Única', schedule: { type: 'once', date: '2026-08-19' }, activePeriod: PERIOD });
    const [o] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    await w.occ.rescheduleOneTimeGoal(o.id, '2026-08-21');
    expect(await w.occRepo.findByDate('2026-08-19')).toEqual([]);
    expect(await w.occ.getOrGenerateOccurrencesForDate('2026-08-19')).toEqual([]);
    expect((await w.occRepo.findByDate('2026-08-21'))[0].id).toBe(o.id);
    expect((await w.occRepo.getByKey(`${o.goalId}_2026-08-19_default`))).toBeNull();
  });
});

describe('A52 — anexos são guardados como conteúdo durável (não como blob: URL)', () => {
  it('foto e PDF sobrevivem ao reinício com os mesmos bytes e metadados', async () => {
    const w = realWorld();
    await w.goals.createGoal({ name: 'Evid', activePeriod: PERIOD });
    const [o] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    const photo = new Blob([bytes(2048)], { type: 'image/jpeg' });
    const pdf = new Blob([bytes(300)], { type: 'application/pdf' });
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: o.id }, 'foto + pdf', [
      { uri: '', displayName: 'IMG_1.jpg', mimeType: 'image/jpeg', sizeBytes: photo.size, blob: photo },
      { uri: '', displayName: 'plano.pdf', mimeType: 'application/pdf', sizeBytes: pdf.size, blob: pdf },
    ]);
    await resetDbConnection();
    const r = realWorld();
    const [rec] = await r.journal.getTimelineForOccurrence(o.id);
    expect(rec.attachments).toHaveLength(2);
    const img = rec.attachments!.find((a) => a.kind === 'image')!;
    expect(img.blob?.type).toBe('image/jpeg');
    expect(await readBlob(img.blob!)).toEqual(bytes(2048));
    expect(await readBlob(rec.attachments!.find((a) => a.kind === 'file')!.blob!)).toEqual(bytes(300));
  });
});

describe('A56 — migração v1 → v2 preserva dados e funde duplicatas', () => {
  it('atualiza um banco v1 real sem perder metas, ocorrências nem registros', async () => {
    // 1) banco no esquema ANTIGO (v1), com dados no formato antigo
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('goals', { keyPath: 'id' });
        db.createObjectStore('revisions', { keyPath: 'id' }).createIndex('by-goalId', 'goalId');
        const occ = db.createObjectStore('occurrences', { keyPath: 'id' });
        occ.createIndex('by-scheduledDate', 'scheduledDate');
        occ.createIndex('by-occurrenceKey', 'occurrenceKey', { unique: true });
        occ.createIndex('by-goalAndDate', ['goalId', 'scheduledDate']);
        const cy = db.createObjectStore('cycleInstances', { keyPath: 'id' });
        cy.createIndex('by-goalId', 'goalId');
        cy.createIndex('by-cycleKey', 'cycleKey');
        db.createObjectStore('journalRecords', { keyPath: 'id' });
        db.createObjectStore('attachments', { keyPath: 'id' }).createIndex('by-recordId', 'recordId');
        db.createObjectStore('statusChanges', { keyPath: 'id' }).createIndex('by-occurrenceId', 'occurrenceId');
      },
    });
    const goalId = 'goal_1700000000000_abcde';
    const rev1 = 'rev_1700000000000_aaaaa';
    const rev2 = 'rev_1700000000001_bbbbb';
    const mkOcc = (id: string, revisionId: string, status: string, updatedAt: string) => ({
      id,
      goalId,
      revisionId,
      cycleInstanceId: null,
      scheduledDate: '2026-08-19',
      scheduledTime: null,
      slotKey: 'default',
      occurrenceKey: `${goalId}_${revisionId}_2026-08-19_default`, // formato antigo (com revisão)
      source: 'generated',
      status,
      progressValue: null,
      quantityValue: null,
      completedAt: null,
      lastStatusChangedAt: null,
      createdAt: updatedAt,
      updatedAt,
    });
    await v1.put('goals', { id: goalId, parentId: null, createdAt: 'x', updatedAt: 'x', archivedAt: null, sortOrder: 1, currentRevisionId: rev2 });
    const baseRev = {
      goalId, effectiveTo: null, parentId: null, sortOrder: 1, name: 'Meta antiga', description: null, icon: null, colorToken: null, categoryId: null,
      activePeriod: PERIOD, trackingCycle: { type: 'daily' }, schedule: { type: 'daily' }, progressRule: { type: 'binary' }, completionRule: { type: 'allRequired' },
      aggregationRule: { type: 'scheduledOccurrences', depth: 'direct', weightMode: 'equal' }, isRequired: true, showParentOnHome: true,
      inherit: { period: false, category: false, icon: false, color: false, reminders: false }, reminders: [],
    };
    await v1.put('revisions', { ...baseRev, id: rev1, effectiveFrom: '2026-08-01', effectiveTo: '2026-08-18' });
    await v1.put('revisions', { ...baseRev, id: rev2, effectiveFrom: '2026-08-19' });
    // DUPLICATA gerada pelo bug antigo: mesmo dia/slot em duas revisões
    await v1.put('occurrences', mkOcc('occ_a', rev1, 'pending', '2026-08-19T10:00:00.000Z'));
    await v1.put('occurrences', mkOcc('occ_b', rev2, 'completed', '2026-08-19T11:00:00.000Z'));
    await v1.put('journalRecords', { id: 'rec_1', target: { type: 'occurrence', occurrenceId: 'occ_a' }, comment: 'nota na duplicata', createdAt: 'a', updatedAt: 'a' });
    await v1.put('journalRecords', { id: 'rec_2', target: { type: 'cycle', cycleInstanceId: 'ci_x' }, comment: 'nota de ciclo', createdAt: 'b', updatedAt: 'b' });
    await v1.put('statusChanges', { id: 'sc_1', occurrenceId: 'occ_a', fromStatus: null, toStatus: 'pending', changedAt: 'a' });
    await v1.put('cycleInstances', {
      id: `ci_${goalId}_${rev2}_daily_2026-08-19`, goalId, revisionId: rev2, startAt: '2026-08-19', endAt: '2026-08-19',
      cycleKey: `${goalId}_${rev2}_daily_2026-08-19`, computedProgress: 1, computedStatus: 'completed', finalizedAt: null, createdAt: 'a', updatedAt: 'a',
    });
    v1.close();

    // 2) o app (v2) abre o mesmo banco
    const g = new IndexedDbGoalRepository();
    const o = new IndexedDbOccurrenceRepository();
    const j = new IndexedDbJournalRepository();
    const db = await getDB();
    expect(db.version).toBe(2);

    expect((await g.getDefinition(goalId))?.id).toBe(goalId);
    expect((await g.listRevisionsForGoal(goalId)).map((r) => r.id).sort()).toEqual([rev1, rev2]);
    const occs = await o.findByDate('2026-08-19');
    expect(occs).toHaveLength(1); // duplicata fundida
    expect(occs[0].id).toBe('occ_b'); // sobrevive a que tem status resolvido
    expect(occs[0].status).toBe('completed');
    expect(occs[0].occurrenceKey).toBe(`${goalId}_2026-08-19_default`);
    // evidência e trilha da duplicata foram religadas à sobrevivente — nada se perdeu
    expect((await j.listRecordsForTarget({ type: 'occurrence', occurrenceId: 'occ_b' })).map((r) => r.comment)).toEqual(['nota na duplicata']);
    expect((await j.listRecordsForTarget({ type: 'cycle', cycleInstanceId: 'ci_x' })).map((r) => r.comment)).toEqual(['nota de ciclo']);
    expect((await j.listStatusChangesForOccurrence('occ_b')).map((s) => s.id)).toEqual(['sc_1']);
    expect((await o.getCycleInstance(goalId, `${goalId}_daily_2026-08-19`))?.computedProgress).toBe(1);
    // e o app continua funcionando em cima dos dados migrados, sem recriar a duplicata
    const clock = { today: '2026-08-19' };
    const occSvc = new OccurrenceService(g, o, j, () => clock.today);
    await occSvc.getOrGenerateOccurrencesForDate('2026-08-19');
    expect(await o.findByDate('2026-08-19')).toHaveLength(1);
    const tree = await occSvc.getTodayGoalTree('2026-08-19');
    expect(tree.nodes[0].revision.name).toBe('Meta antiga');
    expect(tree.nodes[0].occurrence?.status).toBe('completed');
  });
});

describe('A53 / A54 — backup versionado e importação segura', () => {
  async function seeded() {
    const w = realWorld();
    await createTreinar(w as unknown as World);
    await completeOn(w as unknown as World, '2026-08-19');
    const wed = flatten((await w.occ.getTodayGoalTree('2026-08-19')).nodes).find((n) => n.revision.name === 'Futebol')!;
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: wed.occurrence!.id }, 'com foto', [
      { uri: '', displayName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 64, blob: new Blob([bytes(64)], { type: 'image/jpeg' }) },
    ]);
    return { w, occId: wed.occurrence!.id };
  }

  it('A53 — exportação é um JSON versionado e portátil com todas as coleções e os anexos', async () => {
    const { w } = await seeded();
    const file = await w.backup.exportBackup();
    expect(file.format).toBe('ziel-backup');
    expect(file.backupVersion).toBe(1);
    expect(file.counts).toMatchObject({ goals: 4, revisions: 4, occurrences: 3, journalRecords: 1, attachments: 1 });
    expect(file.data.attachments[0].dataBase64).toBeTruthy();
    // portátil: é JSON puro (sem Blob/funções)
    const parsed = JSON.parse(await w.backup.exportToJson());
    expect(parsed.data.goals).toHaveLength(4);
  });

  it('A53b — exportar → apagar tudo → importar restaura dados e bytes dos anexos', async () => {
    const { w, occId } = await seeded();
    const json = await w.backup.exportToJson();
    // substitui por um backup vazio e válido (simula aparelho novo)
    await w.backup.importFromJson(
      JSON.stringify({ format: 'ziel-backup', backupVersion: 1, exportedAt: 'x', counts: {}, data: { goals: [], revisions: [], occurrences: [], cycleInstances: [], journalRecords: [], attachments: [], statusChanges: [] } })
    );
    expect(await w.goalRepo.listAllDefinitions()).toHaveLength(0);
    await w.backup.importFromJson(json);
    expect(await w.goalRepo.listAllDefinitions()).toHaveLength(4);
    const [rec] = await w.journal.getTimelineForOccurrence(occId);
    expect(rec.comment).toBe('com foto');
    expect(await readBlob(rec.attachments![0].blob!)).toEqual(bytes(64));
    expect(rec.attachments![0].blob!.type).toBe('image/jpeg');
    const tree = await w.occ.getTodayGoalTree('2026-08-19');
    expect(tree.nodes[0].cycleInstance?.completedCount).toBe(3);
  });

  it('A54 — importações inválidas são recusadas e NÃO alteram os dados existentes', async () => {
    const { w } = await seeded();
    const good = JSON.parse(await w.backup.exportToJson());
    const mutate = (fn: (b: typeof good) => void) => {
      const c = JSON.parse(JSON.stringify(good));
      fn(c);
      return JSON.stringify(c);
    };
    const bad: [string, string][] = [
      ['não é JSON', '{ isto não é json'],
      ['outro formato', JSON.stringify({ format: 'outro', backupVersion: 1, data: {} })],
      ['versão futura', mutate((b) => (b.backupVersion = 99))],
      ['coleção ausente', mutate((b) => delete b.data.occurrences)],
      ['meta com pai inexistente', mutate((b) => (b.data.goals[1].parentId = 'fantasma'))],
      ['revisão órfã', mutate((b) => (b.data.revisions[0].goalId = 'fantasma'))],
      ['ocorrência com status inválido', mutate((b) => (b.data.occurrences[0].status = 'quebrado'))],
      ['anexo sem registro', mutate((b) => (b.data.attachments[0].recordId = 'fantasma'))],
      ['ids duplicados', mutate((b) => b.data.goals.push(b.data.goals[0]))],
      ['null', 'null'],
    ];
    for (const [label, json] of bad) {
      await expect(w.backup.importFromJson(json), label).rejects.toBeInstanceOf(BackupValidationError);
    }
    // nada mudou
    expect(await w.goalRepo.listAllDefinitions()).toHaveLength(4);
    expect((await w.occRepo.findByDate('2026-08-19')).filter((o) => o.status === 'completed')).toHaveLength(3);
  });

  it('A54b — falha NO MEIO da gravação desfaz tudo (transação atômica)', async () => {
    const { w } = await seeded();
    const good = JSON.parse(await w.backup.exportToJson());
    // passa a validação, mas não é clonável pelo IndexedDB (função) → erro durante a transação
    good.data.occurrences[1].overrideData = { name: () => 'x' };
    const store = new IndexedDbBackupStore();
    await expect(store.replaceAll(good.data)).rejects.toBeTruthy();
    expect(await w.goalRepo.listAllDefinitions()).toHaveLength(4);
    expect((await w.occRepo.findByDate('2026-08-19')).length).toBe(3);
    expect(await w.journalRepo.countRecordsByOccurrence((await w.occRepo.findByDate('2026-08-19')).map((o) => o.id))).toBeInstanceOf(Map);
  });
});

describe('exclusão definitiva de metas', () => {
  it('apaga a meta, as submetas e todo o histórico ligado (ocorrências, ciclos, registros, anexos, trocas de status) e preserva o resto', async () => {
    const w = realWorld();
    const t = await createTreinar(w as unknown as World);
    const other = (await w.goals.createGoal({ name: 'Ler', schedule: { type: 'daily' }, activePeriod: PERIOD })).definition;
    const [occFut] = await w.occ.getOrGenerateOccurrencesForDate('2026-08-19');
    for (const o of await w.occ.getOrGenerateOccurrencesForDate('2026-08-19')) await w.occ.updateStatus(o.id, 'completed');
    const keep = (await w.occ.getOrGenerateOccurrencesForDate('2026-08-19')).find((o) => o.goalId === other.id)!;
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: occFut.id }, 'anotação da meta que será excluída');
    await w.journal.addRecord({ type: 'occurrence', occurrenceId: keep.id }, 'anotação que deve ficar');

    const ids = await w.goals.deleteGoalPermanently(t.parent.id);
    expect(ids.length).toBe(4); // pai + 3 submetas

    const db = await getDB();
    for (const store of ['goals', 'revisions', 'occurrences', 'cycleInstances', 'statusChanges'] as const) {
      const rows = (await db.getAll(store)) as { goalId?: string; id?: string }[];
      for (const r of rows) {
        const gid = store === 'goals' ? r.id : r.goalId;
        if (gid) expect(ids, `${store} ainda tem dados de meta excluída`).not.toContain(gid);
      }
    }
    expect((await db.getAll('journalRecords')).map((r) => r.comment)).toEqual(['anotação que deve ficar']);
    expect((await db.getAll('goals')).map((g) => g.id)).toEqual([other.id]);
    expect((await db.getAll('occurrences')).every((o) => o.goalId === other.id)).toBe(true);
    expect((await db.getAll('statusChanges')).length).toBeGreaterThan(0); // a meta restante mantém o próprio histórico
  });

  it('excluir uma submeta não apaga a meta mãe nem as irmãs; contagem da subárvore confere', async () => {
    const w = realWorld();
    const t = await createTreinar(w as unknown as World);
    expect(await w.goals.countSubtree(t.parent.id)).toBe(4);
    const ids = await w.goals.deleteGoalPermanently(t.futebol.id);
    expect(ids).toEqual([t.futebol.id]);
    const left = (await (await getDB()).getAll('goals')).map((g) => g.id).sort();
    expect(left).toEqual([t.parent.id, t.corrida.id, t.musculacao.id].sort());
  });

  it('funciona também para metas arquivadas', async () => {
    const w = realWorld();
    const g = (await w.goals.createGoal({ name: 'Velha', schedule: { type: 'daily' }, activePeriod: PERIOD })).definition;
    await w.goals.archiveGoal(g.id);
    await w.goals.deleteGoalPermanently(g.id);
    expect(await (await getDB()).getAll('goals')).toEqual([]);
  });
});
