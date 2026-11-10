import { Attachment, Category, CycleInstance, GoalDefinition, GoalRevision, JournalRecord, Occurrence, StatusChange } from '../../domain/types';

export type AttachmentSnapshot = Omit<Attachment, 'blob'> & {
  /** Conteúdo em base64 (sem prefixo data:). */
  dataBase64?: string | null;
};

export type ZielSnapshot = {
  goals: GoalDefinition[];
  revisions: GoalRevision[];
  occurrences: Occurrence[];
  cycleInstances: CycleInstance[];
  journalRecords: JournalRecord[];
  attachments: AttachmentSnapshot[];
  statusChanges: StatusChange[];
  categories?: Category[];
};

export interface BackupStore {
  readAll(): Promise<ZielSnapshot>;
  /** Substitui TODOS os dados numa única transação: ou aplica tudo ou nada. */
  replaceAll(snapshot: ZielSnapshot): Promise<void>;
}
