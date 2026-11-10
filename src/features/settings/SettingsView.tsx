import React, { useRef, useState } from 'react';
import { Download, HardDrive, Upload } from 'lucide-react';
import { backupService } from '../../application/container';
import { BackupFile } from '../../application/services/BackupService';
import { todayLocal } from '../../domain/dates';
import { Sheet } from '../../shared/ui/Sheet';
import { errorMessage, useAppData } from '../../shared/AppData';
import { useToast } from '../../shared/ui/Toast';

export const SettingsView: React.FC<{ storagePersisted: boolean | null }> = ({ storagePersisted }) => {
  const { bump } = useAppData();
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ json: string; file: BackupFile; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const exportBackup = async () => {
    setBusy(true);
    try {
      const json = await backupService.exportToJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ziel-backup-${todayLocal()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      notify('Backup gerado', 'success');
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const json = await f.text();
      const file = backupService.parse(json); // só valida; nada é alterado ainda
      setPending({ json, file, name: f.name });
    } catch (err) {
      notify(errorMessage(err), 'error');
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await backupService.importFromJson(pending.json);
      setPending(null);
      bump();
      notify('Backup restaurado', 'success');
    } catch (err) {
      notify(`${errorMessage(err)} Seus dados atuais foram mantidos.`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const c = pending?.file.counts;

  return (
    <div className="pb-nav mx-auto w-full max-w-lg px-4 pt-safe">
      <header className="pb-4 pt-5">
        <p className="text-sm text-ziel-muted">Ziel · versão 1.0.0</p>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Ajustes</h1>
      </header>

      <div className="space-y-4">
        <section className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <HardDrive className="h-5 w-5 text-ziel-accent" /> Seus dados
          </h2>
          <p className="text-sm text-ziel-muted">
            Tudo fica guardado neste aparelho, sem conta e sem internet. Faça backups de vez em quando — se desinstalar o app, os dados locais são apagados.
          </p>
          <p className="text-xs text-ziel-muted">
            Armazenamento persistente: {storagePersisted === null ? 'verificando…' : storagePersisted ? 'garantido pelo sistema' : 'não garantido (o sistema pode limpar em falta de espaço)'}
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={exportBackup} disabled={busy}>
              <Download className="h-4 w-4" /> Exportar
            </button>
            <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload className="h-4 w-4" /> Importar
            </button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onPick} aria-label="Escolher arquivo de backup" />
        </section>
      </div>

      <Sheet
        open={pending !== null}
        title="Restaurar backup?"
        subtitle={pending?.name}
        onClose={() => setPending(null)}
        footer={
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={() => setPending(null)}>
              Cancelar
            </button>
            <button type="button" className="btn-danger flex-[2]" onClick={confirmImport} disabled={busy}>
              Substituir meus dados
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-ziel-sub">
          <p>O arquivo é válido e foi gerado em {pending ? new Date(pending.file.exportedAt).toLocaleString('pt-BR') : ''}. Ele contém:</p>
          <ul className="card divide-y divide-ziel-line-soft">
            {[
              ['Metas', c?.goals],
              ['Ocorrências', c?.occurrences],
              ['Registros', c?.journalRecords],
              ['Anexos', c?.attachments],
            ].map(([k, v]) => (
              <li key={String(k)} className="flex justify-between px-4 py-2.5">
                <span>{k}</span>
                <span className="font-semibold text-ziel-text">{v ?? 0}</span>
              </li>
            ))}
          </ul>
          <p className="text-ziel-warning">Importar SUBSTITUI tudo o que está neste aparelho. Exporte um backup atual antes, se quiser guardá-lo.</p>
        </div>
      </Sheet>
    </div>
  );
};
