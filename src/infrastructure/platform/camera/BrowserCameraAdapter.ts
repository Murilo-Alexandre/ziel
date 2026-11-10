import { CameraPort, CapturedMedia } from '../../ports/CameraPort';
import { pickWithInput } from '../files/filePicker';

export class BrowserCameraAdapter implements CameraPort {
  capturePhoto(): Promise<CapturedMedia | null> {
    return pickWithInput({ accept: 'image/*', capture: 'environment', fallbackName: 'foto.jpg', fallbackMime: 'image/jpeg' });
  }

  pickImageFromGallery(): Promise<CapturedMedia | null> {
    return pickWithInput({ accept: 'image/*', fallbackName: 'imagem.jpg', fallbackMime: 'image/jpeg' });
  }
}
