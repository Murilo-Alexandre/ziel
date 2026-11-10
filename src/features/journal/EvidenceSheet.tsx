import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Image as ImageIcon, Paperclip, Send, Clock } from 'lucide-react';
import { JournalRecord, JournalTarget } from '../../domain/types';
import { CapturedMedia, MediaAccessError } from '../../infrastructure/ports/CameraPort';
import { cameraAdapter, filePickerAdapter, journalService } from '../../application/container';
import { Sheet } from '../../shared/ui/Sheet';
import { AttachmentThumb } from '../../shared/ui/AttachmentThumb';
import { errorMessage, useAppData } from '../../shared/AppData';
import { useToast } from '../../shared/ui/Toast';

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  target: JournalTarget | null;
  onClose: () => void;
};

export const EvidenceSheet: React.FC<Props> = ({ open, title, subtitle, target, onClose }) => {
  const { bump } = useAppData();
  const { notify } = useToast();
  const [comment, setComment] = useState('');
  const [media, setMedia] = useState<CapturedMedia[]>([]);
  const [timeline, setTimeline] = useState<JournalRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const targetKey = target ? (target.type === 'occurrence' ? `o:${target.occurrenceId}` : `c:${target.cycleInstanceId}`) : null;

  const load = useCallback(async () => {
    if (!target) return;
    try {
      setTimeline(
        target.type === 'occurrence'
          ? await journalService.getTimelineForOccurrence(target.occurrenceId)
          : await journalService.getTimelineForCycle(target.cycleInstanceId)
      );
    } catch (e) {
      notify(errorMessage(e), 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  useEffect(() => {
    if (open) {
      setComment('');
      setMedia([]);
      setMediaError(null);
      load();
    }
  }, [open, load]);

  const add = async (picker: () => Promise<CapturedMedia | null>) => {
    setMediaError(null);
    try {
      const m = await picker();
      if (m) setMedia((prev) => [...prev, m]);
    } catch (e) {
      setMediaError(
        e instanceof MediaAccessError
          ? e.message
          : 'Não foi possível acessar câmera/arquivos. Você ainda pode salvar só o comentário.'
      );
    }
  };

  const canSave = (comment.trim().length > 0 || media.length > 0) && !saving;

  const save = async () => {
    if (!target || !canSave) return;
    setSaving(true);
    try {
      await journalService.addRecord(target, comment, media);
      setComment('');
      setMedia([]);
      await load();
      bump();
      notify('Registro salvo', 'success');
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      tall
      title="Registro e evidências"
      subtitle={subtitle ?? title}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button type="button" className="btn-ghost !px-3" onClick={() => add(() => cameraAdapter.capturePhoto())} aria-label="Tirar foto">
              <Camera className="h-5 w-5 text-ziel-accent" />
            </button>
            <button type="button" className="btn-ghost !px-3" onClick={() => add(() => cameraAdapter.pickImageFromGallery())} aria-label="Escolher imagem da galeria">
              <ImageIcon className="h-5 w-5 text-ziel-success" />
            </button>
            <button type="button" className="btn-ghost !px-3" onClick={() => add(() => filePickerAdapter.pickFile())} aria-label="Anexar arquivo">
              <Paperclip className="h-5 w-5 text-ziel-warning" />
            </button>
            <button type="button" className="btn-primary ml-auto" disabled={!canSave} onClick={save}>
              <Send className="h-4 w-4" />
              Registrar
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <textarea
          rows={3}
          className="field !py-3"
          placeholder="Escreva um comentário (opcional se houver anexo)…"
          aria-label="Comentário"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {mediaError && (
          <p role="alert" className="rounded-chip border border-ziel-warning/40 bg-ziel-warning-soft px-3 py-2 text-sm text-ziel-warning">
            {mediaError}
          </p>
        )}
        {media.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {media.map((m, i) => (
              <AttachmentThumb
                key={i}
                blob={m.blob}
                kind={m.mimeType.startsWith('image/') ? 'image' : 'file'}
                name={m.displayName}
                sizeBytes={m.sizeBytes}
                size="sm"
                onRemove={() => setMedia((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
        )}
      </div>

      <h3 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-ziel-muted">Linha do tempo</h3>
      {timeline.length === 0 ? (
        <p className="rounded-card border border-dashed border-ziel-line py-8 text-center text-sm text-ziel-muted">Nenhum registro ainda.</p>
      ) : (
        <ol className="space-y-3">
          {timeline.map((rec) => (
            <li key={rec.id} className="rounded-card border border-ziel-line-soft bg-ziel-bg p-3.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-ziel-muted">
                <Clock className="h-3.5 w-3.5" />
                {new Date(rec.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
              {rec.comment && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ziel-text">{rec.comment}</p>}
              {rec.attachments && rec.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {rec.attachments.map((a) => (
                    <AttachmentThumb key={a.id} blob={a.blob} kind={a.kind} name={a.displayName} sizeBytes={a.sizeBytes} />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
};
