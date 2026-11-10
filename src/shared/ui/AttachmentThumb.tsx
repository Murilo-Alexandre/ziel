import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';

/** Cria uma URL de objeto para um Blob e a revoga ao desmontar (sem vazar memória). */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

type Props = {
  blob?: Blob | null;
  kind: 'image' | 'file';
  name: string;
  sizeBytes?: number | null;
  size?: 'sm' | 'md';
  onRemove?: () => void;
};

export const AttachmentThumb: React.FC<Props> = ({ blob, kind, name, sizeBytes, size = 'md', onRemove }) => {
  const url = useObjectUrl(kind === 'image' ? blob : null);
  const dim = size === 'sm' ? 'h-14 w-14' : 'h-20 w-20';

  const open = () => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    window.open(u, '_blank', 'noopener');
    window.setTimeout(() => URL.revokeObjectURL(u), 60_000);
  };

  return (
    <div className="relative">
      {kind === 'image' && url ? (
        <button type="button" onClick={open} aria-label={`Abrir imagem ${name}`} className={`${dim} overflow-hidden rounded-chip border border-ziel-line`}>
          <img src={url} alt={name} className="h-full w-full object-cover" />
        </button>
      ) : (
        <button
          type="button"
          onClick={open}
          aria-label={`Abrir arquivo ${name}`}
          className={`flex ${dim} flex-col items-center justify-center gap-1 rounded-chip border border-ziel-line bg-ziel-raised px-1 text-ziel-accent`}
        >
          <FileText className="h-5 w-5" />
          <span className="w-full truncate text-center text-[10px] text-ziel-sub">{name}</span>
          {sizeBytes != null && <span className="text-[10px] text-ziel-muted">{formatBytes(sizeBytes)}</span>}
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover ${name}`}
          className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-ziel-line bg-ziel-bg text-ziel-sub"
        >
          ×
        </button>
      )}
    </div>
  );
};
