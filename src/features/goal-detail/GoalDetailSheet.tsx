import React, { useCallback, useEffect, useState } from 'react';
import { Archive, MessageSquarePlus, Pencil, Plus } from 'lucide-react';
import { GoalDetails } from '../../application/services/GoalQueryService';
import { goalService, queryService } from '../../application/container';
import { describeCompletion, describeCycle, describeSchedule, formatDateBR } from '../../domain/recurrence/scheduleLabels';
import { Sheet } from '../../shared/ui/Sheet';
import { CYCLE_STATUS_META, ProgressBar, StatusPill } from '../../shared/ui/status';
import { iconFor, toneFor } from '../../shared/ui/goalIcons';
import { errorMessage, useAppData } from '../../shared/AppData';
import { useToast } from '../../shared/ui/Toast';

type Props = {
  open: boolean;
  goalId: string | null;
  date: string;
  occurrenceId: string | null;
  onClose: () => void;
  onEdit: () => void;
  onAddSubgoal: () => void;
  onOpenEvidence: (target: { type: 'occurrence'; occurrenceId: string } | { type: 'cycle'; cycleInstanceId: string }, title: string) => void;
};

export const GoalDetailSheet: React.FC<Props> = ({ open, goalId, date, occurrenceId, onClose, onEdit, onAddSubgoal, onOpenEvidence }) => {
  const { version, bump } = useAppData();
  const { notify } = useToast();
  const [details, setDetails] = useState<GoalDetails | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const load = useCallback(async () => {
    if (!goalId) return;
    try {
      setDetails(await queryService.getGoalDetails(goalId, date));
    } catch (e) {
      notify(errorMessage(e), 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId, date]);

  useEffect(() => {
    if (open) {
      setConfirmArchive(false);
      load();
    } else setDetails(null);
  }, [open, load, version]);

  const archive = async () => {
    if (!goalId) return;
    try {
      const ids = await goalService.archiveGoal(goalId);
      notify(ids.length > 1 ? `Meta e ${ids.length - 1} submeta(s) arquivadas. O histórico foi mantido.` : 'Meta arquivada. O histórico foi mantido.', 'success');
      bump();
      onClose();
    } catch (e) {
      notify(errorMessage(e), 'error');
    }
  };

  const rev = details?.revision;
  const Icon = iconFor(rev?.icon);
  const color = toneFor(rev?.colorToken, rev?.goalId).bg;
  const cycleMeta = details?.cycle ? CYCLE_STATUS_META[details.cycle.computedStatus] : null;

  return (
    <Sheet open={open} tall title={rev?.name ?? 'Meta'} subtitle={details?.path.length ? details.path.join(' › ') : undefined} onClose={onClose}>
      {!details || !rev ? (
        <p className="py-10 text-center text-sm text-ziel-muted">Carregando…</p>
      ) : (
        <div className="space-y-5 pb-2">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card" style={{ backgroundColor: `${color}24`, color }}>
              <Icon className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              {rev.description ? <p className="whitespace-pre-wrap break-words text-sm text-ziel-sub">{rev.description}</p> : <p className="text-sm text-ziel-muted">Sem descrição</p>}
              {details.definition.archivedAt && <p className="mt-1 text-xs font-semibold text-ziel-warning">Arquivada</p>}
            </div>
          </div>

          {details.cycle && (
            <section className="card p-4" aria-label="Ciclo atual">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-ziel-sub">Ciclo atual</h3>
                <span className={`text-2xl font-bold tabular-nums ${cycleMeta?.text}`}>{Math.round(details.cycle.computedProgress * 100)}%</span>
              </div>
              <ProgressBar value={details.cycle.computedProgress} barClass={cycleMeta?.bar} className="mt-3" />
              <div className="mt-2 flex justify-between text-xs text-ziel-muted">
                <span className={cycleMeta?.text}>{cycleMeta?.label}</span>
                <span>
                  {formatDateBR(details.cycle.startAt)} – {formatDateBR(details.cycle.endAt)}
                  {details.cycle.expectedCount ? ` · ${details.cycle.completedCount ?? 0} de ${details.cycle.expectedCount}` : ''}
                </span>
              </div>
              <button type="button" className="mt-3 flex min-h-touch items-center gap-2 text-sm font-semibold text-ziel-accent" onClick={() => onOpenEvidence({ type: 'cycle', cycleInstanceId: details.cycle!.id }, `Ciclo · ${rev.name}`)}>
                <MessageSquarePlus className="h-5 w-5" /> Registro do ciclo
              </button>
            </section>
          )}

          <dl className="card divide-y divide-ziel-line-soft text-sm">
            {[
              ['Agenda', describeSchedule(rev.schedule)],
              ['Ciclo', describeCycle(rev.trackingCycle)],
              ['Período', `${formatDateBR(rev.activePeriod.startDate)} → ${rev.activePeriod.endDate ? formatDateBR(rev.activePeriod.endDate) : 'sem fim'}`],
              ['Medição', rev.progressRule.type === 'quantity' ? `${rev.progressRule.target} ${rev.progressRule.unit}` : 'Feito / não feito'],
              ...(details.children.length > 0 || rev.completionRule.type !== 'allRequired' ? [['Conclusão', describeCompletion(rev.completionRule)] as [string, string]] : []),
              ['Obrigatória', rev.isRequired ? 'Sim' : 'Opcional'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-ziel-muted">{k}</dt>
                <dd className="text-right font-medium text-ziel-text">{v}</dd>
              </div>
            ))}
          </dl>

          {details.children.length > 0 && (
            <section aria-label="Submetas">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ziel-muted">Submetas</h3>
              <ul className="card divide-y divide-ziel-line-soft">
                {details.children.map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className={c.archived ? 'text-ziel-muted line-through' : 'text-ziel-text'}>{c.name}</span>
                    {c.archived && <span className="text-xs text-ziel-muted">arquivada</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {details.history.length > 0 && (
            <section aria-label="Histórico">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ziel-muted">Histórico</h3>
              <ul className="card divide-y divide-ziel-line-soft">
                {details.history.slice(0, 12).map(({ occurrence, evidenceCount }) => (
                  <li key={occurrence.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <button type="button" className="min-h-touch min-w-0 flex-1 text-left" onClick={() => onOpenEvidence({ type: 'occurrence', occurrenceId: occurrence.id }, `${rev.name} · ${formatDateBR(occurrence.scheduledDate)}`)}>
                      <span className="text-ziel-text">{formatDateBR(occurrence.scheduledDate)}</span>
                      {evidenceCount > 0 && <span className="ml-2 text-xs text-ziel-muted">{evidenceCount} registro(s)</span>}
                      {occurrence.rescheduledFrom && <span className="ml-2 text-xs text-ziel-muted">remarcada de {formatDateBR(occurrence.rescheduledFrom)}</span>}
                    </button>
                    <StatusPill status={occurrence.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid grid-cols-2 gap-2">
            {occurrenceId && (
              <button type="button" className="btn-ghost col-span-2" onClick={() => onOpenEvidence({ type: 'occurrence', occurrenceId }, rev.name)}>
                <MessageSquarePlus className="h-5 w-5 text-ziel-accent" /> Registrar evidência de hoje
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={onEdit} disabled={Boolean(details.definition.archivedAt)}>
              <Pencil className="h-4 w-4" /> Editar
            </button>
            <button type="button" className="btn-ghost" onClick={onAddSubgoal} disabled={Boolean(details.definition.archivedAt)}>
              <Plus className="h-4 w-4" /> Submeta
            </button>
          </div>

          {!details.definition.archivedAt &&
            (confirmArchive ? (
              <div className="rounded-card border border-ziel-danger/40 bg-ziel-danger-soft p-4 text-sm text-ziel-text">
                <p>
                  Arquivar <strong>{rev.name}</strong>
                  {details.children.length > 0 ? ' e suas submetas' : ''}? Elas deixam de aparecer na Home; o histórico e os registros são mantidos.
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn-ghost flex-1" onClick={() => setConfirmArchive(false)}>
                    Cancelar
                  </button>
                  <button type="button" className="btn-danger flex-1" onClick={archive}>
                    Arquivar
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn-danger w-full" onClick={() => setConfirmArchive(true)}>
                <Archive className="h-4 w-4" /> Arquivar meta
              </button>
            ))}
        </div>
      )}
    </Sheet>
  );
};
