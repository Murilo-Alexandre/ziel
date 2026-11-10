import { CapturedMedia, MediaAccessError } from '../../ports/CameraPort';

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/**
 * Abre o seletor nativo (arquivo/galeria/câmera) e devolve o conteúdo como Blob.
 * Resolve `null` se o usuário cancelar; rejeita com MediaAccessError em falhas recuperáveis.
 */
export function pickWithInput(options: {
  accept?: string;
  capture?: 'environment' | 'user';
  fallbackName: string;
  fallbackMime: string;
}): Promise<CapturedMedia | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (options.accept) input.accept = options.accept;
    if (options.capture) input.setAttribute('capture', options.capture);
    input.style.position = 'fixed';
    input.style.left = '-9999px';

    let settled = false;
    const cleanup = () => {
      settled = true;
      input.remove();
    };

    input.addEventListener('change', () => {
      if (settled) return;
      const file = input.files?.[0];
      cleanup();
      if (!file) return resolve(null);
      if (file.size > MAX_ATTACHMENT_BYTES) {
        return reject(new MediaAccessError('O arquivo é maior que 25 MB. Escolha um arquivo menor.'));
      }
      resolve({
        uri: '',
        displayName: file.name || options.fallbackName,
        mimeType: file.type || options.fallbackMime,
        sizeBytes: file.size,
        blob: file,
      });
    });
    input.addEventListener('cancel', () => {
      if (settled) return;
      cleanup();
      resolve(null);
    });
    input.addEventListener('error', () => {
      if (settled) return;
      cleanup();
      reject(new MediaAccessError('Não foi possível acessar o arquivo. Verifique as permissões do aplicativo.'));
    });

    document.body.appendChild(input);
    try {
      input.click();
    } catch {
      cleanup();
      reject(new MediaAccessError('Não foi possível abrir o seletor. Verifique as permissões do aplicativo.'));
    }
  });
}
