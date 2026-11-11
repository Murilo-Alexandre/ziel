import React, { useLayoutEffect, useRef } from 'react';
import { ArrowUpCircle, Download, RefreshCw, ShieldCheck } from 'lucide-react';
import { Sheet } from '../../shared/ui/Sheet';
import { useUpdate } from '../../shared/Update';
import { RELEASES_PAGE } from '../../application/services/UpdateService';
import { formatBytes } from '../../shared/ui/AttachmentThumb';
import { gsap, motionOK } from '../../shared/motion';
import { UpdateHero } from './UpdateHero';

/** Aviso de nova versão no topo da Home: perceptível, com "Atualizar" e "Depois" (adia por 24 h). */
export const UpdateBanner: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { update, bannerHidden, dismissBanner, native } = useUpdate();
  if (!native || !update || bannerHidden) return null;
  return (
    <section
      data-reveal
      aria-label="Atualização disponível"
      className="mb-4 rounded-[22px] border border-ziel-accent/40 p-3.5"
      style={{ background: 'linear-gradient(135deg, rgba(242,139,130,0.22), rgba(40,48,70,0.9) 70%)' }}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ziel-accent text-ziel-ink">
          <ArrowUpCircle className="h-5 w-5" aria-hidden />
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

/** Entrada suave (sobe e aparece) sempre que `k` muda: troca de estado sem "pulo". */
const Swap: React.FC<{ k: string; className?: string; children: React.ReactNode }> = ({ k, className, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current || !motionOK()) return;
    const t = gsap.fromTo(ref.current, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out', clearProps: 'transform,opacity' });
    return () => {
      t.kill();
    };
  }, [k]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
};

/**
 * Modal de atualização com todos os estados animados: verificando, atualizado, nova versão, baixando (percentual real),
 * preparando a instalação, instalador aberto e erro. As novidades rolam; as ações ficam num rodapé fixo com
 * folga da borda e da área de gestos do Android.
 */
export const UpdateSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const u = useUpdate();
  const info = u.update;
  const s = u.status;
  const working = s === 'downloading' || s === 'verifying';
  const pct = Math.round(u.progress * 100);
  const installedName = u.installed?.versionName ?? '—';

  let headline = '';
  let sub = '';
  if (s === 'checking') {
    headline = 'Procurando atualizações…';
    sub = 'Conferindo as versões publicadas.';
  } else if (s === 'uptodate' && !info) {
    headline = 'Você está na versão mais recente!';
    sub = `Versão ${installedName} instalada.`;
  } else if (s === 'downloading') {
    headline = 'Baixando atualização';
    sub = `${pct}% concluído`;
  } else if (s === 'verifying') {
    headline = 'Preparando a instalação';
    sub = 'Verificando integridade e assinatura…';
  } else if (s === 'installing') {
    headline = 'Instalador aberto';
    sub = 'Confirme a instalação no Android.';
  } else if (s === 'needs-permission') {
    headline = 'Falta uma permissão';
    sub = 'O Android precisa deixar o Ziel abrir o instalador.';
  } else if (s === 'error') {
    headline = 'Não foi possível atualizar';
    sub = u.error ?? 'Algo deu errado. Tente de novo.';
  } else if (info) {
    headline = `Nova versão ${info.versionName}`;
    sub = `${installedName} → ${info.versionName}`;
  } else {
    headline = 'Atualizações';
    sub = 'Toque em verificar para procurar novidades.';
  }

  const showNotes = Boolean(info) && s !== 'checking' && s !== 'uptodate';

  let footer: React.ReactNode = null;
  if (s === 'checking') footer = null;
  else if (working)
    footer = (
      <button type="button" className="btn-primary w-full !min-h-[46px]" disabled>
        {s === 'downloading' ? `Baixando… ${pct}%` : 'Preparando…'}
      </button>
    );
  else if (s === 'installing')
    footer = (
      <button type="button" className="btn-ghost w-full !min-h-[46px]" onClick={onClose}>
        Fechar
      </button>
    );
  else if (s === 'needs-permission')
    footer = (
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" className="btn-ghost !min-h-[46px]" onClick={() => u.openPermissionSettings()}>
          Abrir configurações
        </button>
        <button type="button" className="btn-primary !min-h-[46px]" onClick={() => u.install()}>
          Já permiti
        </button>
      </div>
    );
  else if (info)
    footer = (
      <div className="grid grid-cols-[1fr_auto] gap-2.5">
        <button type="button" className="btn-primary !min-h-[46px] whitespace-nowrap" onClick={() => u.install()}>
          <Download className="h-[18px] w-[18px]" /> {s === 'error' ? 'Tentar de novo' : 'Instalar atualização'}
        </button>
        <button type="button" className="btn-ghost !min-h-[46px]" onClick={onClose}>
          Depois
        </button>
      </div>
    );
  else
    footer = (
      <div className={`grid gap-2.5 ${s === 'error' ? 'grid-cols-[1fr_auto]' : 'grid-cols-1'}`}>
        {s === 'error' && (
          <button type="button" className="btn-primary !min-h-[46px]" onClick={() => u.check()}>
            <RefreshCw className="h-[18px] w-[18px]" /> Tentar de novo
          </button>
        )}
        <button type="button" className="btn-ghost !min-h-[46px]" onClick={onClose}>
          Fechar
        </button>
      </div>
    );

  return (
    <Sheet open={open} title="Atualização do Ziel" onClose={working ? () => undefined : onClose} tone="#F28B82" footer={footer}>
      <div className="space-y-4 pb-1">
        <div className="flex flex-col items-center pt-1 text-center">
          <UpdateHero status={s} progress={u.progress} />
          <Swap k={s} className="mt-3 max-w-[22rem]">
            <p className="text-[17px] font-extrabold leading-snug text-ziel-text" aria-live="polite">
              {headline}
            </p>
            <p className={`mt-1 break-words text-[13px] ${s === 'error' ? 'text-ziel-danger' : 'text-ziel-sub'}`}>{sub}</p>
          </Swap>
        </div>

        {showNotes && info && (
          <Swap k="notes">
            <div className="rounded-[20px] border border-white/[0.08] p-3.5" style={{ background: 'linear-gradient(135deg, rgba(242,139,130,0.16), rgba(40,48,70,0.9) 70%)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ziel-accent">Novidades · {info.versionName}</p>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] font-medium leading-relaxed text-ziel-text">{info.notes || 'Melhorias e correções. Veja os detalhes na página da versão.'}</p>
            </div>
            <ul className="mt-3 space-y-1.5 text-[12px] text-ziel-sub">
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
            <a href={info.pageUrl || RELEASES_PAGE} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-[40px] items-center text-[13px] font-bold text-ziel-accent underline">
              Ver página da versão
            </a>
          </Swap>
        )}
      </div>
    </Sheet>
  );
};
