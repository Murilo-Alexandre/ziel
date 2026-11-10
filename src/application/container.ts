import { RepositoryFactory } from '../infrastructure/persistence/RepositoryFactory';
import { BrowserCameraAdapter } from '../infrastructure/platform/camera/BrowserCameraAdapter';
import { BrowserFilePickerAdapter } from '../infrastructure/platform/files/BrowserFilePickerAdapter';
import { GoalService } from './services/GoalService';
import { OccurrenceService } from './services/OccurrenceService';
import { JournalService } from './services/JournalService';
import { BackupService } from './services/BackupService';
import { GoalQueryService } from './services/GoalQueryService';
import { SeedService } from './services/SeedService';

/** Raiz de composição única: toda a UI usa os MESMOS serviços (e a mesma fila de operações). */
const goalRepo = RepositoryFactory.getGoalRepository();
const occRepo = RepositoryFactory.getOccurrenceRepository();
const journalRepo = RepositoryFactory.getJournalRepository();

export const cameraAdapter = new BrowserCameraAdapter();
export const filePickerAdapter = new BrowserFilePickerAdapter();

export const goalService = new GoalService(goalRepo);
export const occurrenceService = new OccurrenceService(goalRepo, occRepo, journalRepo);
export const journalService = new JournalService(journalRepo, cameraAdapter, filePickerAdapter);
export const queryService = new GoalQueryService(goalRepo, occRepo, journalRepo);
export const seedService = new SeedService(goalService);
export const backupService = new BackupService(RepositoryFactory.getBackupStore());
export { goalRepo, occRepo, journalRepo };
