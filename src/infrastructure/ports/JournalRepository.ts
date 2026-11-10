import { Attachment, JournalRecord, JournalTarget, StatusChange } from '../../domain/types';

export interface JournalRepository {
  addRecord(record: JournalRecord, attachments?: Attachment[]): Promise<JournalRecord>;
  listRecordsForTarget(target: JournalTarget): Promise<JournalRecord[]>;
  /** Quantidade de registros por ocorrência (para indicadores compactos na Home). */
  countRecordsByOccurrence(occurrenceIds: string[]): Promise<Map<string, number>>;
  recordStatusChange(change: StatusChange): Promise<void>;
  listStatusChangesForOccurrence(occurrenceId: string): Promise<StatusChange[]>;
}
