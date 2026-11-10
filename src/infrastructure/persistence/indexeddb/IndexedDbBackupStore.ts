import { AttachmentSnapshot, BackupStore, ZielSnapshot } from '../../ports/BackupStore';
import { Attachment, JournalRecord } from '../../../domain/types';
import { getDB, journalTargetKey } from './database';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

export class IndexedDbBackupStore implements BackupStore {
  async readAll(): Promise<ZielSnapshot> {
    const db = await getDB();
    const tx = db.transaction(
      ['goals', 'revisions', 'occurrences', 'cycleInstances', 'journalRecords', 'attachments', 'statusChanges'],
      'readonly'
    );
    const [goals, revisions, occurrences, cycleInstances, rawRecords, rawAttachments, statusChanges] = await Promise.all([
      tx.objectStore('goals').getAll(),
      tx.objectStore('revisions').getAll(),
      tx.objectStore('occurrences').getAll(),
      tx.objectStore('cycleInstances').getAll(),
      tx.objectStore('journalRecords').getAll(),
      tx.objectStore('attachments').getAll(),
      tx.objectStore('statusChanges').getAll(),
    ]);
    await tx.done;

    const journalRecords = rawRecords.map((r) => {
      const { targetKey: _t, ...rest } = r as JournalRecord & { targetKey?: string };
      void _t;
      return rest as JournalRecord;
    });
    const attachments: AttachmentSnapshot[] = [];
    for (const a of rawAttachments) {
      const { blob, ...rest } = a;
      attachments.push({ ...rest, dataBase64: blob ? await blobToBase64(blob) : null });
    }
    return { goals, revisions, occurrences, cycleInstances, journalRecords, attachments, statusChanges };
  }

  async replaceAll(snapshot: ZielSnapshot): Promise<void> {
    // Decodifica tudo ANTES de abrir a transação (qualquer falha aqui não toca nos dados atuais).
    const attachments: Attachment[] = snapshot.attachments.map((a) => {
      const { dataBase64, ...rest } = a;
      const blob = dataBase64 ? new Blob([base64ToBytes(dataBase64) as BlobPart], { type: a.mimeType ?? undefined }) : null;
      return { ...rest, blob };
    });
    const db = await getDB();
    const tx = db.transaction(
      ['goals', 'revisions', 'occurrences', 'cycleInstances', 'journalRecords', 'attachments', 'statusChanges'],
      'readwrite'
    );
    const done = tx.done;
    done.catch(() => undefined); // a rejeição é tratada abaixo; evita "unhandled rejection" no abort
    try {
      await Promise.all([
        tx.objectStore('goals').clear(),
        tx.objectStore('revisions').clear(),
        tx.objectStore('occurrences').clear(),
        tx.objectStore('cycleInstances').clear(),
        tx.objectStore('journalRecords').clear(),
        tx.objectStore('attachments').clear(),
        tx.objectStore('statusChanges').clear(),
      ]);
      for (const g of snapshot.goals) await tx.objectStore('goals').put(g);
      for (const r of snapshot.revisions) await tx.objectStore('revisions').put(r);
      for (const o of snapshot.occurrences) await tx.objectStore('occurrences').put(o);
      for (const c of snapshot.cycleInstances) await tx.objectStore('cycleInstances').put(c);
      for (const j of snapshot.journalRecords) {
        await tx.objectStore('journalRecords').put({ ...j, targetKey: journalTargetKey(j.target) } as JournalRecord);
      }
      for (const a of attachments) await tx.objectStore('attachments').put(a);
      for (const s of snapshot.statusChanges) await tx.objectStore('statusChanges').put(s);
      await done;
    } catch (err) {
      try {
        tx.abort(); // desfaz tudo: os dados anteriores permanecem intactos
      } catch {
        /* transação já finalizada */
      }
      throw err;
    }
  }
}
