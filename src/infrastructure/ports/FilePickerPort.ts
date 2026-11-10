import { CapturedMedia } from './CameraPort';

export interface FilePickerPort {
  pickFile(): Promise<CapturedMedia | null>;
}
