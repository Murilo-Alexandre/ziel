import React from 'react';
import { ArrowUpCircle, Download, ShieldCheck, X } from 'lucide-react';
import { Sheet } from '../../shared/ui/Sheet';
import { useUpdate } from '../../shared/Update';
import { RELEASES_PAGE } from '../../application/services/UpdateService';
import { formatBytes } from '../../shared/ui/AttachmentThumb';

/** Aviso discreto no topo da Home: aparece só quando há versão nova e ainda não foi dispensado. */
export const UpdateBanner: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { update, bannerHidden, dismissBanner, native } = useUpdate();
  if (!native || !update || bannerHidden) return null;
  return (
    <div data-reveal className="mb-4 flex items-center gap-1 rounded-full border border-ziel-accent/50 bg-ziel-accent-soft py-1.5 pl-4 pr-1.5 text-ziel-text">
      <ArrowUpCircle className="h-5 w-5 shrink-0 text-ziel-accent" aria-hidden />
      <button type="button" onClick={onOpen} className="min-h-[44px] min-w-0 flex-1 truncate px-2 text-left text-sm font-extrabold">
        Nova versão {update.versionName}
        <span className="ml-1 font-semibold opacity-70">· novidades</span>
      </button>
      <button type="button" onClick={dismissBanner} aria-label="Dispensar aviso" className="orb !h-10 !w-10 !bg-white/10">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

const PHASE_LABEL: Record<string, string> = {
  downloading: 'Baixando…',
  verifying: 'Verificando integridade e assinatura…',
  installing: 'Instalador aberto. Confirme a instalação no Android.',
};

export const UpdateSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const u = useUpdate();
  const info = u.update;
  const working = u.status === 'downloading' || u.status === 'verifying';

  return (
    <Sheet open={open} title="Atualização do Ziel" subtitle={info ? `${u.installed?.versionName ?? 'instalada'} → ${info.versionName}` : undefined} onClose={working ? () => undefined : onClose} tone="#F28B82">
      {!info ? (
        <p className="py-8 text-center text-sm text-ziel-muted">Nenhuma atualização disponível.</p>
      ) : (
        <div className="space-y-4 pb-2">
          <div className="rounded-[26px] border border-white/[0.08] p-5" style={{ background: 'linear-gradient(135deg, rgba(242,139,130,0.22), rgba(23,26,34,0.96) 65%)' }}>
            <p className="text-xs font-bold uppercase tracking-wider text-ziel-accent">Novidades · {info.versionName}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-[15px] font-semibold leading-relaxed text-ziel-text">
              {info.notes || 'Melhorias e correções. Veja os detalhes na página da versão.'}
            </p>
          </div>

          <ul className="space-y-2 text-sm text-ziel-sub">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ziel-success" />
              O arquivo é conferido por SHA-256 e pela assinatura digital antes de instalar.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ziel-success" />
              Suas metas e registros ficam no aparelho e são mantidos na atualização.
            </li>
            {info.size > 0 && <li className="pl-6 text-ziel-muted">Tamanho: {formatBytes(info.size)}</li>}
          </ul>

          {working && (
            <div aria-live="polite">
              <div className="h-3 overflow-hidden rounded-full bg-ziel-ink" role="progressbar" aria-valuenow={Math.round(u.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do download">
                <div className="h-full rounded-full bg-ziel-accent transition-[width] duration-200" style={{ width: `${Math.round(u.progress * 100)}%` }} />
              </div>
              <p className="mt-2 text-sm text-ziel-sub">
                {PHASE_LABEL[u.status]} {u.status === 'downloading' && `${Math.round(u.progress * 100)}%`}
              </p>
            </div>
          )}

          {u.status === 'installing' && <p className="rounded-[22px] bg-ziel-success-soft px-4 py-3 text-sm text-ziel-success">{PHASE_LABEL.installing}</p>}

          {u.status === 'needs-permission' && (
            <div className="space-y-3 rounded-[22px] border border-ziel-warning/40 bg-ziel-warning-soft p-4 text-sm text-ziel-text">
              <p>O Android precisa da sua permissão para o Ziel abrir o instalador. Toque em “Abrir configurações”, ative “Permitir desta fonte” e volte.</p>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost flex-1" onClick={() => u.openPermissionSettings()}>
                  Abrir configurações
                </button>
                <button type="button" className="btn-primary flex-1" onClick={() => u.install()}>
                  Já permiti
                </button>
              </div>
            </div>
          )}

          {u.status === 'error' && u.error && (
            <p role="alert" className="rounded-[22px] border border-ziel-danger/40 bg-ziel-danger-soft px-4 py-3 text-sm text-ziel-danger">
              {u.error}
            </p>
          )}

          {!working && u.status !== 'needs-permission' && u.status !== 'installing' && (
            <div className="space-y-2">
              <button type="button" className="btn-primary w-full !min-h-[56px] text-base" onClick={() => u.install()}>
                <Download className="h-5 w-5" /> Instalar atualização
              </button>
              <a href={info.pageUrl || RELEASES_PAGE} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full">
                Ver página da versão
              </a>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
};
