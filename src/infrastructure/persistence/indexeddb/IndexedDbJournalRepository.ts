import { JournalRepository } from '../../ports/JournalRepository';
import { Attachment, JournalRecord, JournalTarget, StatusChange } from '../../../domain/types';
import { getDB, journalTargetKey } from './database';

export class IndexedDbJournalRepository implements JournalRepository {
  /** Registro + anexos numa única transação: nunca fica um registro sem seus anexos. */
  async addRecord(record: JournalRecord, attachments: Attachment[] = []): Promise<JournalRecord> {
    const db = await getDB();
    const tx = db.transaction(['journalRecords', 'attachments'], 'readwrite');
    const stored = { ...record, targetKey: journalTargetKey(record.target) };
    delete (stored as Partial<JournalRecord>).attachments;
    await tx.objectStore('journalRecords').put(stored as JournalRecord);
    for (const attachment of attachments) {
      await tx.objectStore('attachments').put(attachment);
    }
    await tx.done;
    return { ...record, attachments };
  }

  async listRecordsForTarget(target: JournalTarget): Promise<JournalRecord[]> {
    const db = await getDB();
    const records = await db.getAllFromIndex('journalRecords', 'by-targetKey', journalTargetKey(target));
    const populated: JournalRecord[] = [];
    for (const rec of records) {
      const attachments = await db.getAllFromIndex('attachments', 'by-recordId', rec.id);
      const { targetKey: _ignored, ...clean } = rec as JournalRecord & { targetKey?: string };
      void _ignored;
      populated.push({ ...clean, attachments });
    }
    return populated.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async countRecordsByOccurrence(occurrenceIds: string[]): Promise<Map<string, number>> {
    const db = await getDB();
    const out = new Map<string, number>();
    for (const id of occurrenceIds) {
      const n = await db.countFromIndex('journalRecords', 'by-targetKey', `occ:${id}`);
      if (n > 0) out.set(id, n);
    }
    return out;
  }

  async recordStatusChange(change: StatusChange): Promise<void> {
    const db = await getDB();
    await db.put('statusChanges', change);
  }

  async listStatusChangesForOccurrence(occurrenceId: string): Promise<StatusChange[]> {
    const db = await getDB();
    const list = await db.getAllFromIndex('statusChanges', 'by-occurrenceId', occurrenceId);
    return list.sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  }
}
