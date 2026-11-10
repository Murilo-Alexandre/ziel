import { FilePickerPort } from '../../ports/FilePickerPort';
import { CapturedMedia } from '../../ports/CameraPort';
import { pickWithInput } from './filePicker';

export class BrowserFilePickerAdapter implements FilePickerPort {
  pickFile(): Promise<CapturedMedia | null> {
    return pickWithInput({ fallbackName: 'documento', fallbackMime: 'application/octet-stream' });
  }
}
