import React from 'react';
import { ArrowUpCircle, Download, ShieldCheck } from 'lucide-react';
import { Sheet } from '../../shared/ui/Sheet';
import { useUpdate } from '../../shared/Update';
import { RELEASES_PAGE } from '../../application/services/UpdateService';
import { formatBytes } from '../../shared/ui/AttachmentThumb';

/** Aviso de nova versão no topo da Home: perceptível, com "Atualizar" e "Depois" (adia por 24 h). */
export const UpdateBanner: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { update, bannerHidden, dismissBanner, native } = useUpdate();
  if (!native || !update || bannerHidden) return null;
  return (
    <section
      data-reveal
      aria-label="Atualização disponível"
      className="mb-4 rounded-[22px] border border-ziel-accent/40 p-4"
      style={{ background: 'linear-gradient(135deg, rgba(242,139,130,0.24), rgba(40,48,70,0.9) 70%)' }}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ziel-accent text-ziel-ink">
          <ArrowUpCircle className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold leading-tight">Nova versão {update.versionName}</p>
          <p className="mt-0.5 text-[12px] text-ziel-sub">Melhorias prontas para instalar. Suas metas ficam como estão.</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={dismissBanner} className="btn-ghost">
          Depois
        </button>
        <button type="button" onClick={onOpen} className="btn-primary">
          Atualizar
        </button>
      </div>
    </section>
  );
};

const PHASE_LABEL: Record<string, string> = {
  downloading: 'Baixando…',
  verifying: 'Verificando integridade e assinatura…',
  installing: 'Instalador aberto. Confirme a instalação no Android.',
};

/**
 * Modal de atualização. As novidades rolam; o botão de instalar fica FIXO no rodapé (sempre alcançável,
 * respeitando a safe area), então nenhum texto longo bloqueia a ação principal.
 */
export const UpdateSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const u = useUpdate();
  const info = u.update;
  const working = u.status === 'downloading' || u.status === 'verifying';
  const pct = Math.round(u.progress * 100);

  const footer = !info ? null : (
    <div className="space-y-2.5">
      {working && (
        <div aria-live="polite">
          <div className="h-3 overflow-hidden rounded-full bg-ziel-bg" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do download">
            <div className="h-full rounded-full bg-ziel-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-sm text-ziel-sub">
            {PHASE_LABEL[u.status]} {u.status === 'downloading' && `${pct}%`}
          </p>
        </div>
      )}
      {u.status === 'installing' && <p className="rounded-[15px] bg-ziel-success-soft px-4 py-2.5 text-sm text-ziel-success">{PHASE_LABEL.installing}</p>}
      {u.status === 'needs-permission' && (
        <div className="space-y-2 rounded-[15px] border border-ziel-warning/40 bg-ziel-warning-soft p-3.5 text-sm text-ziel-text">
          <p>O Android precisa da sua permissão para o Ziel abrir o instalador. Toque em “Abrir configurações”, ative “Permitir desta fonte” e volte.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost" onClick={() => u.openPermissionSettings()}>
              Abrir configurações
            </button>
            <button type="button" className="btn-primary" onClick={() => u.install()}>
              Já permiti
            </button>
          </div>
        </div>
      )}
      {u.status === 'error' && u.error && (
        <p role="alert" className="rounded-[15px] border border-ziel-danger/40 bg-ziel-danger-soft px-4 py-2.5 text-sm text-ziel-danger">
          {u.error}
        </p>
      )}
      {!working && u.status !== 'needs-permission' && u.status !== 'installing' && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button type="button" className="btn-primary !min-h-[49px] whitespace-nowrap !px-3 text-[14px]" onClick={() => u.install()}>
            <Download className="h-5 w-5" /> {u.status === 'error' ? 'Tentar de novo' : 'Instalar atualização'}
          </button>
          <button type="button" className="btn-ghost !min-h-[49px]" onClick={onClose}>
            Depois
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Sheet open={open} title="Atualização do Ziel" subtitle={info ? `${u.installed?.versionName ?? 'instalada'} → ${info.versionName}` : undefined} onClose={working ? () => undefined : onClose} tone="#F28B82" footer={footer}>
      {!info ? (
        <p className="py-8 text-center text-sm text-ziel-muted">Nenhuma atualização disponível.</p>
      ) : (
        <div className="space-y-4 pb-2">
          <div className="rounded-[20px] border border-white/[0.08] p-4" style={{ background: 'linear-gradient(135deg, rgba(242,139,130,0.2), rgba(40,48,70,0.9) 70%)' }}>
            <p className="text-xs font-bold uppercase tracking-wider text-ziel-accent">Novidades · {info.versionName}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-[13px] font-medium leading-relaxed text-ziel-text">{info.notes || 'Melhorias e correções. Veja os detalhes na página da versão.'}</p>
          </div>
          <ul className="space-y-2 text-[12px] text-ziel-sub">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ziel-success" />
              Conferido por SHA-256 e pela assinatura digital antes de instalar.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ziel-success" />
              Suas metas e registros ficam no aparelho e são mantidos.
            </li>
            {info.size > 0 && <li className="pl-6 text-ziel-muted">Tamanho: {formatBytes(info.size)}</li>}
          </ul>
          <a href={info.pageUrl || RELEASES_PAGE} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center text-sm font-bold text-ziel-accent underline">
            Ver página da versão
          </a>
        </div>
      )}
    </Sheet>
  );
};
