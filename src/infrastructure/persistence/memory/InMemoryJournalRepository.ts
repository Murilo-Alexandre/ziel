import { JournalRepository } from '../../ports/JournalRepository';
import { Attachment, JournalRecord, JournalTarget, StatusChange } from '../../../domain/types';

export function sameTarget(a: JournalTarget, b: JournalTarget): boolean {
  if (a.type === 'occurrence' && b.type === 'occurrence') return a.occurrenceId === b.occurrenceId;
  if (a.type === 'cycle' && b.type === 'cycle') return a.cycleInstanceId === b.cycleInstanceId;
  return false;
}

export class InMemoryJournalRepository implements JournalRepository {
  records = new Map<string, JournalRecord>();
  attachments = new Map<string, Attachment[]>();
  statusChanges: StatusChange[] = [];

  async addRecord(record: JournalRecord, attachments: Attachment[] = []) {
    this.records.set(record.id, record);
    this.attachments.set(record.id, attachments);
    return { ...record, attachments };
  }
  async listRecordsForTarget(target: JournalTarget) {
    return [...this.records.values()]
      .filter((r) => sameTarget(r.target, target))
      .map((r) => ({ ...r, attachments: this.attachments.get(r.id) ?? [] }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async countRecordsByOccurrence(ids: string[]) {
    const wanted = new Set(ids);
    const out = new Map<string, number>();
    for (const r of this.records.values()) {
      if (r.target.type === 'occurrence' && wanted.has(r.target.occurrenceId)) {
        out.set(r.target.occurrenceId, (out.get(r.target.occurrenceId) ?? 0) + 1);
      }
    }
    return out;
  }
  async recordStatusChange(change: StatusChange) {
    this.statusChanges.push(change);
  }
  async listStatusChangesForOccurrence(id: string) {
    return this.statusChanges.filter((s) => s.occurrenceId === id);
  }
}
