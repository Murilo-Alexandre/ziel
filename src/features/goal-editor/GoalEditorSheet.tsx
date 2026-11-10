import React, { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronDown, ChevronRight, ChevronUp, CalendarDays } from 'lucide-react';
import { Weekday } from '../../domain/types';
import { goalService, occurrenceService, queryService, goalRepo, reminderService, notificationPort } from '../../application/container';
import { listDescendantIds } from '../../domain/goals/goalTree';
import { formatDateBR } from '../../domain/recurrence/scheduleLabels';
import { parseLocalDate } from '../../domain/dates';
import { Sheet } from '../../shared/ui/Sheet';
import { iconFor, iconLabel } from '../../shared/ui/goalIcons';
import { IconPickerScreen } from '../icons/IconPickerScreen';
import { Switch } from '../../shared/ui/Switch';
import { Select } from '../../shared/ui/Select';
import { describeReminderTimes, validateNotify } from '../../domain/notifications/reminderPlanner';
import { errorMessage, useAppData } from '../../shared/AppData';
import { useToast } from '../../shared/ui/Toast';
import {
  GoalFormState,
  ScheduleKind,
  emptyForm,
  formFromRevision,
  previewDates,
  suggestedCycle,
  toDraft,
  validateForm,
} from './goalForm';

export type EditorMode =
  | { kind: 'create'; parentId: string | null }
  | { kind: 'edit'; goalId: string; date: string; occurrenceId: string | null };

type Props = { open: boolean; mode: EditorMode; onClose: () => void; onSaved: () => void };

const WEEKDAYS: { key: Weekday; short: string; long: string }[] = [
  { key: 1, short: 'S', long: 'Segunda' },
  { key: 2, short: 'T', long: 'Terça' },
  { key: 3, short: 'Q', long: 'Quarta' },
  { key: 4, short: 'Q', long: 'Quinta' },
  { key: 5, short: 'S', long: 'Sexta' },
  { key: 6, short: 'S', long: 'Sábado' },
  { key: 0, short: 'D', long: 'Domingo' },
];

const KIND_LABEL: Record<ScheduleKind, string> = {
  weekdays: 'Dias da semana',
  daily: 'Todos os dias',
  once: 'Data única',
  quota: 'Frequência (ex.: 3x/semana)',
  interval: 'A cada N dias/semanas/meses',
  monthlyDate: 'Dia fixo do mês',
  container: 'Só agrupar submetas',
};

type ParentOption = { id: string; label: string };

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="space-y-3 rounded-card border border-ziel-line-soft bg-ziel-bg/40 p-4">
    <div>
      <h3 className="text-sm font-semibold text-ziel-text">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-ziel-muted">{hint}</p>}
    </div>
    {children}
  </section>
);

const Label: React.FC<{ htmlFor: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-ziel-sub">
    {children}
  </label>
);

export const GoalEditorSheet: React.FC<Props> = ({ open, mode, onClose, onSaved }) => {
  const { bump } = useAppData();
  const { notify } = useToast();
  const isEdit = mode.kind === 'edit';
  const [form, setForm] = useState<GoalFormState>(() => emptyForm(null));
  const [cycleTouched, setCycleTouched] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [parents, setParents] = useState<ParentOption[]>([]);
  const [childNames, setChildNames] = useState<{ id: string; name: string }[]>([]);
  const [scope, setScope] = useState<'future' | 'occurrence'>('future');
  const [originalOnceDate, setOriginalOnceDate] = useState<string | null>(null);
  const [siblingDays, setSiblingDays] = useState<Record<number, string[]>>({});

  const set = <K extends keyof GoalFormState>(key: K, value: GoalFormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Carrega valores iniciais cada vez que a folha abre.
  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setCycleTouched(false);
    setShowAdvanced(false);
    setScope('future');
    (async () => {
      try {
        const library = await queryService.listLibrary();
        const active = library.filter((l) => !l.archived);
        let blocked = new Set<string>();
        if (mode.kind === 'edit') {
          const all = await goalRepo.listAllDefinitions();
          blocked = new Set([mode.goalId, ...listDescendantIds(mode.goalId, all)]);
        }
        setParents(active.filter((l) => !blocked.has(l.definition.id)).map((l) => ({ id: l.definition.id, label: `${'  '.repeat(Math.min(l.depth, 3))}${l.depth > 0 ? '└ ' : ''}${l.revision.name}` })));

        if (mode.kind === 'create') {
          setForm(emptyForm(mode.parentId));
          setChildNames([]);
          setOriginalOnceDate(null);
        } else {
          const details = await queryService.getGoalDetails(mode.goalId, mode.date);
          if (!details) throw new Error('Meta não encontrada.');
          const f = formFromRevision(details.revision);
          setForm(f);
          setCycleTouched(true);
          setChildNames(details.children.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name })));
          setOriginalOnceDate(details.revision.schedule.type === 'once' ? details.revision.schedule.date : null);
        }
      } catch (e) {
        notify(errorMessage(e), 'error');
        onClose();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Irmãs do mesmo pai alimentam a prévia semanal (mesma engine do app).
  useEffect(() => {
    if (!open || !form.parentId) {
      setSiblingDays({});
      return;
    }
    (async () => {
      const kids = (await queryService.listLibrary()).filter((l) => l.definition.parentId === form.parentId && !l.archived && (mode.kind !== 'edit' || l.definition.id !== mode.goalId));
      const map: Record<number, string[]> = {};
      for (const k of kids) {
        if (k.revision.schedule.type !== 'weekdays') continue;
        for (const d of k.revision.schedule.weekdays) map[d] = [...(map[d] ?? []), k.revision.name];
      }
      setSiblingDays(map);
    })();
  }, [open, form.parentId, mode]);

  const errors = useMemo(() => validateForm(form), [form]);
  const SelectedIcon = iconFor(form.icon);
  const canRemind = form.scheduleKind !== 'quota' && form.scheduleKind !== 'container';
  const reminderTimes = useMemo(() => (form.notify.enabled && validateNotify(form.notify).length === 0 ? describeReminderTimes(form.notify) : []), [form.notify]);
  const setNotify = (patch: Partial<typeof form.notify>) => setForm((f) => ({ ...f, notify: { ...f.notify, ...patch } }));
  const preview = useMemo(() => previewDates(form), [form]);
  const isRecurring = form.scheduleKind !== 'once';
  const canScopeOccurrence = isEdit && mode.occurrenceId !== null && isRecurring;
  const isParent = childNames.length > 0 || form.scheduleKind === 'container';
  const needsCompletion = isParent || form.scheduleKind === 'quota' || form.cycleType !== 'daily';

  const changeKind = (kind: ScheduleKind) =>
    setForm((f) => ({
      ...f,
      scheduleKind: kind,
      cycleType: cycleTouched ? f.cycleType : suggestedCycle(kind, f.quotaPer),
    }));

  const toggleDay = (d: Weekday) =>
    set('weekdays', form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d]);

  const save = async () => {
    setSubmitted(true);
    if (scope === 'future' && errors.length > 0) return;
    if (scope === 'occurrence' && !form.name.trim()) return;
    setSaving(true);
    try {
      const d = toDraft(form);
      if (mode.kind === 'create') {
        await goalService.createGoal({
          name: d.name,
          description: d.description,
          parentId: d.parentId,
          icon: d.icon,
          colorToken: d.colorToken,
          activePeriod: d.activePeriod,
          schedule: d.schedule,
          trackingCycle: d.trackingCycle,
          progressRule: d.progressRule,
          completionRule: d.completionRule,
          aggregationRule: d.aggregationRule,
          isRequired: d.isRequired,
          showParentOnHome: d.showParentOnHome,
          notify: d.notify,
        });
        notify('Meta criada', 'success');
      } else if (scope === 'occurrence' && mode.occurrenceId) {
        await occurrenceService.overrideOccurrence(mode.occurrenceId, { name: d.name, description: d.description });
        notify('Alterado somente para este dia', 'success');
      } else {
        const onceMoved = d.schedule.type === 'once' && originalOnceDate !== null && d.schedule.date !== originalOnceDate && mode.occurrenceId;
        await goalService.editGoalThisAndFuture(mode.goalId, mode.date, {
          name: d.name,
          description: d.description ?? null,
          parentId: d.parentId,
          icon: d.icon,
          colorToken: d.colorToken,
          // meta única remarcada: o serviço ajusta agenda e ocorrência juntos (abaixo)
          ...(onceMoved ? {} : { schedule: d.schedule, activePeriod: d.activePeriod }),
          trackingCycle: d.trackingCycle,
          progressRule: d.progressRule,
          completionRule: d.completionRule,
          aggregationRule: d.aggregationRule,
          isRequired: d.isRequired,
          showParentOnHome: d.showParentOnHome,
          notify: d.notify,
        });
        if (onceMoved && d.schedule.type === 'once') {
          await occurrenceService.rescheduleOneTimeGoal(mode.occurrenceId!, d.schedule.date);
        }
        notify(`Meta atualizada a partir de ${formatDateBR(mode.date)}`, 'success');
      }
      bump();
      onSaved();
      onClose();
      // lembretes: pede a permissão do Android no momento em que fazem sentido (uma vez)
      if (scope === 'future' && d.notify?.enabled && notificationPort.isSupported()) {
        const perm = await reminderService.requestPermission();
        if (perm !== 'granted') notify('Para receber os lembretes, permita as notificações do Ziel nas configurações do Android.', 'error');
        else bump();
      }
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeThisDay = async () => {
    if (mode.kind !== 'edit' || !mode.occurrenceId) return;
    setSaving(true);
    try {
      await occurrenceService.overrideOccurrence(mode.occurrenceId, { isRemovedFromDate: true });
      notify('Removida somente deste dia', 'success');
      bump();
      onSaved();
      onClose();
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const showErrors = submitted && scope === 'future' && errors.length > 0;
  const title = mode.kind === 'create' ? (mode.parentId ? 'Nova submeta' : 'Nova meta') : 'Editar meta';

  return (
    <Sheet
      open={open}
      tall
      title={title}
      subtitle={isEdit ? `Vigente a partir de ${formatDateBR((mode as { date: string }).date)}` : undefined}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          {showErrors && (
            <ul role="alert" className="space-y-0.5 rounded-chip border border-ziel-danger/40 bg-ziel-danger-soft px-3 py-2 text-sm text-ziel-danger">
              {errors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn-primary flex-[2]" disabled={saving} onClick={save}>
              {saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar meta'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        {canScopeOccurrence && (
          <div role="radiogroup" aria-label="Aplicar alteração a" className="grid grid-cols-2 gap-1 rounded-chip border border-ziel-line bg-ziel-bg p-1">
            {(
              [
                ['future', 'Esta e as próximas'],
                ['occurrence', 'Somente este dia'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={scope === k}
                onClick={() => setScope(k)}
                className={`min-h-touch rounded-[8px] px-2 text-sm font-semibold ${scope === k ? 'bg-ziel-accent-soft text-ziel-accent' : 'text-ziel-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <Section title="O que é">
          <div>
            <Label htmlFor="g-name">Nome *</Label>
            <input
              id="g-name"
              className={`field ${submitted && !form.name.trim() ? '!border-ziel-danger' : ''}`}
              placeholder="Ex.: Ler livro"
              value={form.name}
              maxLength={120}
              onChange={(e) => set('name', e.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="g-desc">Descrição</Label>
            <textarea id="g-desc" rows={2} className="field !py-2.5" placeholder="Opcional" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          {scope === 'future' && (
            <>
              <div>
                <Label htmlFor="g-parent">Faz parte de</Label>
                <Select id="g-parent" className="field" value={form.parentId ?? ''} onChange={(e) => set('parentId', e.target.value || null)}>
                  <option value="">Nenhuma (meta principal)</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-ziel-sub">Ícone e cor</span>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  aria-label={`Ícone ${iconLabel(form.icon)} e cor. Personalizar`}
                  className="flex min-h-[65px] w-full items-center gap-4 rounded-[20px] border border-ziel-line bg-ziel-bg p-3 text-left"
                >
                  <span className="flex h-[47px] w-[38px] shrink-0 items-center justify-center rounded-[14px]" style={{ backgroundColor: form.color, color: '#0F1320' }} aria-hidden>
                    <SelectedIcon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold">{iconLabel(form.icon)}</span>
                    <span className="block text-xs text-ziel-muted">Toque para escolher ícone e cor</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ziel-muted" />
                </button>
              </div>
            </>
          )}
        </Section>

        {scope === 'future' && (
          <>
            <Section title="Quando acontece">
              <div>
                <Label htmlFor="g-kind">Repetição</Label>
                <Select id="g-kind" className="field" value={form.scheduleKind} onChange={(e) => changeKind(e.target.value as ScheduleKind)}>
                  {(Object.keys(KIND_LABEL) as ScheduleKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </div>

              {form.scheduleKind === 'weekdays' && (
                <div role="group" aria-label="Dias da semana" className="grid grid-cols-7 gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const on = form.weekdays.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        aria-pressed={on}
                        aria-label={d.long}
                        onClick={() => toggleDay(d.key)}
                        className={`min-h-[43px] rounded-chip border text-sm font-bold ${
                          on ? 'border-ziel-accent bg-ziel-accent-soft text-ziel-accent' : 'border-ziel-line bg-ziel-raised text-ziel-muted'
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              )}

              {form.scheduleKind === 'once' && (
                <div>
                  <Label htmlFor="g-once">Dia</Label>
                  <input id="g-once" type="date" className="field" value={form.onceDate} onChange={(e) => set('onceDate', e.target.value)} />
                  {isEdit && originalOnceDate && form.onceDate !== originalOnceDate && (
                    <p className="mt-1.5 text-xs text-ziel-muted">Será remarcada de {formatDateBR(originalOnceDate)} para {formatDateBR(form.onceDate)} (o histórico é mantido).</p>
                  )}
                </div>
              )}

              {form.scheduleKind === 'quota' && (
                <div className="flex items-center gap-2">
                  <input aria-label="Quantas vezes" inputMode="numeric" className="field !w-16 shrink-0 text-center" value={form.quotaCount} onChange={(e) => set('quotaCount', e.target.value)} />
                  <span className="text-sm text-ziel-sub">vez(es) por</span>
                  <Select
                    aria-label="Período da frequência"
                    className="field flex-1"
                    value={form.quotaPer}
                    onChange={(e) => {
                      const per = e.target.value as GoalFormState['quotaPer'];
                      setForm((f) => ({ ...f, quotaPer: per, cycleType: cycleTouched ? f.cycleType : suggestedCycle('quota', per) }));
                    }}
                  >
                    <option value="day">dia</option>
                    <option value="week">semana</option>
                    <option value="month">mês</option>
                  </Select>
                </div>
              )}
              {form.scheduleKind === 'quota' && <p className="text-xs text-ziel-muted">Você escolhe em quais dias fazer; o progresso conta quantas vezes foram feitas no período (não cria dias fixos).</p>}

              {form.scheduleKind === 'interval' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ziel-sub">A cada</span>
                  <input aria-label="Intervalo" inputMode="numeric" className="field !w-20 text-center" value={form.intervalEvery} onChange={(e) => set('intervalEvery', e.target.value)} />
                  <Select aria-label="Unidade do intervalo" className="field flex-1" value={form.intervalUnit} onChange={(e) => set('intervalUnit', e.target.value as GoalFormState['intervalUnit'])}>
                    <option value="day">dia(s)</option>
                    <option value="week">semana(s)</option>
                    <option value="month">mês(es)</option>
                  </Select>
                </div>
              )}
              {form.scheduleKind === 'interval' && <p className="text-xs text-ziel-muted">A contagem parte da data de início ({formatDateBR(form.startDate)}) e se mantém fixa.</p>}

              {form.scheduleKind === 'monthlyDate' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ziel-sub">Todo dia</span>
                  <input aria-label="Dia do mês" inputMode="numeric" className="field !w-20 text-center" value={form.monthlyDay} onChange={(e) => set('monthlyDay', e.target.value)} />
                  <span className="text-sm text-ziel-sub">do mês</span>
                </div>
              )}
              {form.scheduleKind === 'monthlyDate' && Number(form.monthlyDay) > 28 && <p className="text-xs text-ziel-muted">Em meses sem esse dia, a meta é pulada.</p>}

              {/* Prévia: mesma engine de recorrência do app */}
              <div aria-label="Prévia da programação" className="rounded-chip border border-ziel-line-soft bg-ziel-surface p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ziel-sub">
                  <CalendarDays className="h-4 w-4" /> Prévia
                </div>
                {form.scheduleKind === 'weekdays' || (form.parentId && Object.keys(siblingDays).length > 0) ? (
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-ziel-muted">
                    {WEEKDAYS.map((d) => {
                      const mine = form.scheduleKind === 'weekdays' && form.weekdays.includes(d.key);
                      const others = siblingDays[d.key]?.length ?? 0;
                      return (
                        <div key={d.key} className="flex flex-col items-center gap-1">
                          <span>{d.long.slice(0, 3)}</span>
                          <span className={`flex h-7 w-full items-center justify-center rounded-md text-xs font-bold ${mine ? 'bg-ziel-accent-soft text-ziel-accent' : 'bg-ziel-raised text-ziel-muted'}`}>
                            {mine ? '●' : '·'}
                          </span>
                          <span className="min-h-[14px]">{others > 0 ? `+${others}` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {form.scheduleKind === 'quota' ? (
                  <p className="mt-2 text-sm text-ziel-sub">Qualquer dia do período · {form.quotaCount || '?'}x por {form.quotaPer === 'day' ? 'dia' : form.quotaPer === 'week' ? 'semana' : 'mês'}</p>
                ) : form.scheduleKind === 'container' ? (
                  <p className="mt-2 text-sm text-ziel-sub">Aparece nos dias em que alguma submeta vence.</p>
                ) : preview.length === 0 ? (
                  <p className="mt-2 text-sm text-ziel-muted">Nenhuma data nos próximos 4 meses.</p>
                ) : (
                  <p className="mt-2 text-sm text-ziel-sub">
                    Próximas:{' '}
                    {preview
                      .map((d) => parseLocalDate(d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', ''))
                      .join(' · ')}
                  </p>
                )}
                {form.parentId && Object.keys(siblingDays).length > 0 && <p className="mt-1 text-[11px] text-ziel-muted">“+n” = outras submetas do mesmo pai naquele dia.</p>}
              </div>
            </Section>

            <Section title="Lembretes" hint="Avisos no horário estimado, antes e depois dele. Se você registrar a meta, os avisos pendentes daquele dia são cancelados.">
              {!canRemind ? (
                <p className="text-sm text-ziel-muted">Lembretes precisam de dias definidos (dias da semana, todo dia, data única, intervalo ou dia do mês).</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[14px] font-bold">
                      <Bell className="h-4 w-4 text-ziel-accent" /> Avisar neste horário
                    </span>
                    <Switch checked={form.notify.enabled} onChange={(v) => setNotify({ enabled: v })} label="Ativar lembretes desta meta" />
                  </div>
                  {form.notify.enabled && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="n-time">Horário estimado</Label>
                          <input id="n-time" type="time" className="field" value={form.notify.time} onChange={(e) => setNotify({ time: e.target.value })} />
                        </div>
                        <div>
                          <Label htmlFor="n-every">Repetir a cada</Label>
                          <Select id="n-every" className="field" value={form.notify.everyMin} onChange={(e) => setNotify({ everyMin: Number(e.target.value) })}>
                            {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                              <option key={m} value={m}>
                                {m < 60 ? `${m} min` : `${m / 60} h${m % 60 ? ' 30' : ''}`}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="n-before">Começar antes</Label>
                          <Select id="n-before" className="field" value={form.notify.beforeMin} onChange={(e) => setNotify({ beforeMin: Number(e.target.value) })}>
                            {[0, 5, 10, 15, 30, 45, 60, 90, 120, 180].map((m) => (
                              <option key={m} value={m}>
                                {m === 0 ? 'No horário' : m < 60 ? `${m} min antes` : `${m / 60} h antes`.replace('.5', ' h 30')}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="n-after">Terminar depois</Label>
                          <Select id="n-after" className="field" value={form.notify.afterMin} onChange={(e) => setNotify({ afterMin: Number(e.target.value) })}>
                            {[0, 5, 10, 15, 30, 45, 60, 90, 120, 180].map((m) => (
                              <option key={m} value={m}>
                                {m === 0 ? 'No horário' : m < 60 ? `${m} min depois` : `${m / 60} h depois`.replace('.5', ' h 30')}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>
                      <div aria-label="Prévia dos lembretes" className="rounded-[17px] border border-ziel-line-soft bg-ziel-surface p-3">
                        <p className="mb-2 text-xs font-semibold text-ziel-sub">Vai avisar às</p>
                        {reminderTimes.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {reminderTimes.map((t, i) => (
                              <span key={`${t}-${i}`} className="rounded-full bg-ziel-accent-soft px-3 py-1.5 text-sm font-bold tabular-nums text-ziel-accent">
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-ziel-danger">{validateNotify(form.notify)[0]}</p>
                        )}
                        <p className="mt-2 text-[11px] text-ziel-muted">Só dispara com o app fechado no Android. Quanto menos avisos, melhor: o padrão é um aviso só, no horário.</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Section>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              className="flex min-h-touch w-full items-center justify-between rounded-card border border-ziel-line-soft px-4 text-sm font-semibold text-ziel-sub"
            >
              Opções avançadas
              {showAdvanced ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>

            {showAdvanced && (
              <div className="space-y-4">
                <Section title="Período e ciclo" hint="O ciclo é a janela em que o progresso é medido e reiniciado.">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="g-start">Início</Label>
                      <input id="g-start" type="date" className="field" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="g-end">Término</Label>
                      <input id="g-end" type="date" className="field" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="g-cycle">Ciclo</Label>
                      <Select
                        id="g-cycle"
                        className="field"
                        value={form.cycleType}
                        onChange={(e) => {
                          setCycleTouched(true);
                          set('cycleType', e.target.value as GoalFormState['cycleType']);
                        }}
                      >
                        <option value="daily">Diário</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                        <option value="annual">Anual</option>
                      </Select>
                    </div>
                    {form.cycleType === 'weekly' && (
                      <div>
                        <Label htmlFor="g-wk">Semana começa</Label>
                        <Select id="g-wk" className="field" value={form.weekStartsOn} onChange={(e) => set('weekStartsOn', Number(e.target.value) as Weekday)}>
                          <option value={1}>Segunda</option>
                          <option value={0}>Domingo</option>
                          <option value={6}>Sábado</option>
                        </Select>
                      </div>
                    )}
                  </div>
                </Section>

                <Section title="Como medir">
                  <div role="radiogroup" aria-label="Tipo de medição" className="grid grid-cols-2 gap-1 rounded-chip border border-ziel-line bg-ziel-bg p-1">
                    {(
                      [
                        ['binary', 'Feito / não feito'],
                        ['quantity', 'Por quantidade'],
                      ] as const
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={form.progressType === k}
                        onClick={() => set('progressType', k)}
                        className={`min-h-touch rounded-[8px] px-2 text-sm font-semibold ${form.progressType === k ? 'bg-ziel-accent-soft text-ziel-accent' : 'text-ziel-muted'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {form.progressType === 'quantity' && (
                    <div className="flex items-center gap-2">
                      <input aria-label="Quantidade-alvo" inputMode="decimal" className="field !w-24 text-center" value={form.quantityTarget} onChange={(e) => set('quantityTarget', e.target.value)} />
                      <input aria-label="Unidade" className="field flex-1" placeholder="Unidade (L, km, páginas…)" value={form.quantityUnit} onChange={(e) => set('quantityUnit', e.target.value)} />
                    </div>
                  )}
                  <label className="flex min-h-touch items-center justify-between gap-3 text-sm text-ziel-sub">
                    <span>Obrigatória (bloqueia a conclusão do pai)</span>
                    <input type="checkbox" className="h-6 w-6 accent-[#F6C85F]" checked={form.isRequired} onChange={(e) => set('isRequired', e.target.checked)} />
                  </label>
                </Section>

                {(needsCompletion || isParent) && (
                  <Section title="Conclusão e agregação" hint="Vale para o ciclo desta meta e das submetas que ela agrega.">
                    <div>
                      <Label htmlFor="g-comp">Considerar concluída quando</Label>
                      <Select id="g-comp" className="field" value={form.completionType} onChange={(e) => set('completionType', e.target.value as GoalFormState['completionType'])}>
                        <option value="allRequired">Todas as obrigatórias forem concluídas</option>
                        <option value="minimumCount">Um mínimo de execuções for concluído</option>
                        <option value="minimumPercentage">O progresso atingir uma porcentagem</option>
                      </Select>
                    </div>
                    {form.completionType === 'minimumCount' && (
                      <div className="flex items-center gap-2 text-sm text-ziel-sub">
                        <span>Mínimo de</span>
                        <input aria-label="Mínimo de execuções" inputMode="numeric" className="field !w-20 text-center" value={form.minCount} onChange={(e) => set('minCount', e.target.value)} />
                        <span>concluídas</span>
                      </div>
                    )}
                    {form.completionType === 'minimumPercentage' && (
                      <div className="flex items-center gap-2 text-sm text-ziel-sub">
                        <span>Mínimo de</span>
                        <input aria-label="Porcentagem mínima" inputMode="numeric" className="field !w-20 text-center" value={form.minPct} onChange={(e) => set('minPct', e.target.value)} />
                        <span>%</span>
                      </div>
                    )}
                    {isParent && (
                      <>
                        <div>
                          <Label htmlFor="g-agg">Como calcular o progresso</Label>
                          <Select id="g-agg" className="field" value={form.aggregationType} onChange={(e) => set('aggregationType', e.target.value as GoalFormState['aggregationType'])}>
                            <option value="scheduledOccurrences">Pelas execuções agendadas (cada execução conta)</option>
                            <option value="directChildren">Pelas submetas (cada submeta conta uma vez, com peso)</option>
                          </Select>
                        </div>
                        {form.aggregationType === 'directChildren' && childNames.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs font-semibold text-ziel-sub">Peso de cada submeta (vazio = 1)</span>
                            {childNames.map((c) => (
                              <div key={c.id} className="flex items-center gap-3">
                                <span className="min-w-0 flex-1 truncate text-sm text-ziel-text">{c.name}</span>
                                <input
                                  aria-label={`Peso de ${c.name}`}
                                  inputMode="decimal"
                                  className="field !w-20 text-center"
                                  value={form.childWeights[c.id] ?? ''}
                                  onChange={(e) => setForm((f) => ({ ...f, childWeights: { ...f.childWeights, [c.id]: e.target.value } }))}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        <label className="flex min-h-touch items-center justify-between gap-3 text-sm text-ziel-sub">
                          <span>Mostrar agrupada na Home</span>
                          <input type="checkbox" className="h-6 w-6 accent-[#F6C85F]" checked={form.showParentOnHome} onChange={(e) => set('showParentOnHome', e.target.checked)} />
                        </label>
                      </>
                    )}
                  </Section>
                )}
              </div>
            )}
          </>
        )}

        {isEdit && mode.occurrenceId && (
          <button type="button" className="btn-danger w-full" onClick={removeThisDay} disabled={saving}>
            Remover somente deste dia
          </button>
        )}
      </div>
      <IconPickerScreen
        open={pickerOpen}
        value={form.icon}
        color={form.color}
        onClose={() => setPickerOpen(false)}
        onSelect={(id, c) => {
          set('icon', id);
          set('color', c);
          setPickerOpen(false);
        }}
      />
    </Sheet>
  );
};
