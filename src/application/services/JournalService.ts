import { JournalRepository } from '../../infrastructure/ports/JournalRepository';
import { CameraPort, CapturedMedia } from '../../infrastructure/ports/CameraPort';
import { FilePickerPort } from '../../infrastructure/ports/FilePickerPort';
import { newId } from '../ids';
import { Attachment, JournalRecord, JournalTarget } from '../../domain/types';

export class JournalService {
  constructor(
    private journalRepo: JournalRepository,
    private cameraPort?: CameraPort,
    private filePickerPort?: FilePickerPort
  ) {}

  async addRecord(
    target: JournalTarget,
    comment: string | null,
    capturedMediaList: CapturedMedia[] = []
  ): Promise<JournalRecord> {
    if (!comment?.trim() && capturedMediaList.length === 0) {
      throw new Error('Um registro de histórico não pode ser completamente vazio.');
    }

    const recordId = newId('rec');
    const now = new Date().toISOString();

    const record: JournalRecord = {
      id: recordId,
      target,
      comment: comment?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };

    const attachments: Attachment[] = capturedMediaList.map((media) => ({
      id: newId('att'),
      recordId,
      kind: media.mimeType.startsWith('image/') ? 'image' : 'file',
      uri: media.uri,
      blob: media.blob ?? null,
      displayName: media.displayName,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
      createdAt: now,
    }));

    return this.journalRepo.addRecord(record, attachments);
  }

  async getTimelineForOccurrence(occurrenceId: string): Promise<JournalRecord[]> {
    return this.journalRepo.listRecordsForTarget({ type: 'occurrence', occurrenceId });
  }

  async getTimelineForCycle(cycleInstanceId: string): Promise<JournalRecord[]> {
    return this.journalRepo.listRecordsForTarget({ type: 'cycle', cycleInstanceId });
  }
}
