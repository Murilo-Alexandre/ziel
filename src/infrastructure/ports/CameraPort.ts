export type CapturedMedia = {
  /** Referência legada/de exibição. A fonte de verdade durável é `blob`. */
  uri: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number | null;
  /** Conteúdo do arquivo; é copiado para o armazenamento local (sobrevive a reabrir o app). */
  blob?: Blob | null;
};

/** Falha recuperável (permissão negada, sem câmera, etc.). A UI deve mostrar mensagem e permitir continuar. */
export class MediaAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaAccessError';
  }
}

export interface CameraPort {
  capturePhoto(): Promise<CapturedMedia | null>;
  pickImageFromGallery(): Promise<CapturedMedia | null>;
}
