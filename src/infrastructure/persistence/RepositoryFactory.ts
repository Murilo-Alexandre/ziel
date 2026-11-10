import { GoalRepository } from '../ports/GoalRepository';
import { OccurrenceRepository } from '../ports/OccurrenceRepository';
import { JournalRepository } from '../ports/JournalRepository';
import { BackupStore } from '../ports/BackupStore';
import { IndexedDbGoalRepository } from './indexeddb/IndexedDbGoalRepository';
import { IndexedDbOccurrenceRepository } from './indexeddb/IndexedDbOccurrenceRepository';
import { IndexedDbJournalRepository } from './indexeddb/IndexedDbJournalRepository';
import { IndexedDbBackupStore } from './indexeddb/IndexedDbBackupStore';

/**
 * Seleção de armazenamento.
 *
 * Decisão (documentada em docs/AUDITORIA-HOMOLOGACAO.md): a V1 usa IndexedDB na Web/PWA **e** dentro do
 * WebView do Android (Capacitor). O IndexedDB do WebView é persistente em disco e sobrevive ao encerramento
 * do app. Um adaptador SQLite nativo (@capacitor-community/sqlite) continua sendo possível atrás das mesmas
 * portas, mas NÃO existe mais um "SQLite" de mentira em memória: nenhuma plataforma cai silenciosamente
 * em armazenamento temporário. Falhas de abertura do banco propagam para a UI.
 */
export class RepositoryFactory {
  private static goalRepo: GoalRepository | null = null;
  private static occRepo: OccurrenceRepository | null = null;
  private static journalRepo: JournalRepository | null = null;
  private static backupStore: BackupStore | null = null;

  static getGoalRepository(): GoalRepository {
    return (this.goalRepo ??= new IndexedDbGoalRepository());
  }
  static getOccurrenceRepository(): OccurrenceRepository {
    return (this.occRepo ??= new IndexedDbOccurrenceRepository());
  }
  static getJournalRepository(): JournalRepository {
    return (this.journalRepo ??= new IndexedDbJournalRepository());
  }
  static getBackupStore(): BackupStore {
    return (this.backupStore ??= new IndexedDbBackupStore());
  }
}
