import React, { useMemo } from 'react';
import { ArrowDown, ArrowUp, Bell, BellRing, Plus, Sun, Trash2, X } from 'lucide-react';
import { NotifyConfig, ReminderWindow } from '../../domain/types';
import { describeReminderTimes, newWindowId, validateNotify } from '../../domain/notifications/reminderPlanner';
import { Switch } from '../../shared/ui/Switch';
import { Select } from '../../shared/ui/Select';

const EVERY = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360];
const everyLabel = (m: number) => (m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`);

type Props = {
  value: NotifyConfig;
  onChange: (patch: Partial<NotifyConfig>) => void;
};

/**
 * Lembretes por meta: o horário PREVISTO da atividade (opcional) é separado das JANELAS de aviso.
 * Cada janela tem início, fim e frequência próprios; é possível ter várias no mesmo dia.
 */
export const ReminderWindowsEditor: React.FC<Props> = ({ value, onChange }) => {
  const windows = value.windows ?? [];
  const errors = useMemo(() => (value.enabled ? validateNotify(value) : []), [value]);
  const times = useMemo(() => (value.enabled && errors.length === 0 ? describeReminderTimes(value) : []), [value, errors]);

  const setWindows = (next: ReminderWindow[]) => onChange({ windows: next });
  const patchWindow = (id: string, patch: Partial<ReminderWindow>) => setWindows(windows.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= windows.length) return;
    const next = [...windows];
    [next[i], next[j]] = [next[j], next[i]];
    setWindows(next);
  };
  const addWindow = () => {
    const last = windows[windows.length - 1];
    const startMin = last ? Math.min(23 * 60, Number(last.end.slice(0, 2)) * 60 + Number(last.end.slice(3)) + 60) : 9 * 60;
    const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    setWindows([...windows, { id: newWindowId(), start: hh(startMin), end: hh(Math.min(23 * 60 + 59, startMin + 120)), everyMin: 30 }]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[14px] font-bold">
          <Bell className="h-4 w-4 text-ziel-accent" /> Lembrar desta meta
        </span>
        <Switch
          checked={value.enabled}
          onChange={(v) => onChange({ enabled: v, windows: v && windows.length === 0 ? [{ id: newWindowId(), start: value.plannedStart ?? '09:00', end: value.plannedStart ?? '09:00', everyMin: 30 }] : windows })}
          label="Ativar lembretes desta meta"
        />
      </div>

      {value.enabled && (
        <>
          <div className="rounded-[16px] border border-ziel-line-soft bg-ziel-bg p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-ziel-sub">Quando você costuma fazer (opcional)</p>
              {(value.plannedStart || value.plannedEnd) && (
                <button type="button" onClick={() => onChange({ plannedStart: null, plannedEnd: null })} className="flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold text-ziel-muted">
                  <X className="h-3.5 w-3.5" /> Limpar
                </button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <label className="text-[11px] font-semibold text-ziel-muted">
                Das
                <input type="time" aria-label="Horário previsto: início" className="field mt-1" value={value.plannedStart ?? ''} onChange={(e) => onChange({ plannedStart: e.target.value || null, time: e.target.value || value.time })} />
              </label>
              <label className="text-[11px] font-semibold text-ziel-muted">
                Às
                <input type="time" aria-label="Horário previsto: fim" className="field mt-1" value={value.plannedEnd ?? ''} onChange={(e) => onChange({ plannedEnd: e.target.value || null })} />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-ziel-muted">Só informa o aviso (“era para 05:00”). Os avisos de verdade vêm das janelas abaixo.</p>
          </div>

          <div className="space-y-2" role="list" aria-label="Janelas de lembrete">
            {windows.map((w, i) => {
              const single = w.start === w.end;
              return (
                <div key={w.id} role="listitem" className="rounded-[16px] border border-ziel-line-soft bg-ziel-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-extrabold text-ziel-sub">
                      <BellRing className="h-3.5 w-3.5 text-ziel-accent" /> {windows.length > 1 ? `Janela ${i + 1}` : 'Avisos'}
                    </p>
                    <div className="flex items-center">
                      <button type="button" aria-label={`Subir janela ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)} className="flex h-8 w-8 items-center justify-center rounded-full text-ziel-muted disabled:opacity-30">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label={`Descer janela ${i + 1}`} disabled={i === windows.length - 1} onClick={() => move(i, 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-ziel-muted disabled:opacity-30">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label={`Remover janela ${i + 1}`} onClick={() => setWindows(windows.filter((x) => x.id !== w.id))} className="flex h-8 w-8 items-center justify-center rounded-full text-ziel-danger">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2.5">
                    <label className="text-[11px] font-semibold text-ziel-muted">
                      De
                      <input type="time" aria-label={`Janela ${i + 1}: início`} className="field mt-1" value={w.start} onChange={(e) => patchWindow(w.id, { start: e.target.value, ...(single ? { end: e.target.value } : {}) })} />
                    </label>
                    <label className="text-[11px] font-semibold text-ziel-muted">
                      Até
                      <input type="time" aria-label={`Janela ${i + 1}: fim`} className="field mt-1" value={w.end} onChange={(e) => patchWindow(w.id, { end: e.target.value })} />
                    </label>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold text-ziel-muted">{single ? 'Um aviso só, neste horário' : 'Repetir a cada'}</span>
                    {!single && (
                      <Select aria-label={`Janela ${i + 1}: frequência`} className="field !w-32" value={w.everyMin} onChange={(e) => patchWindow(w.id, { everyMin: Number(e.target.value) })}>
                        {(EVERY.includes(w.everyMin) ? EVERY : [...EVERY, w.everyMin].sort((a, b) => a - b)).map((m) => (
                          <option key={m} value={m}>
                            {everyLabel(m)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost" onClick={addWindow}>
              <Plus className="h-4 w-4" /> Nova janela
            </button>
            <button type="button" className="btn-ghost" onClick={() => setWindows([{ id: newWindowId(), start: '07:00', end: '22:00', everyMin: 120 }])} aria-label="Avisar ao longo do dia inteiro">
              <Sun className="h-4 w-4" /> Dia inteiro
            </button>
          </div>

          <div aria-label="Prévia dos lembretes" className="rounded-[16px] border border-ziel-line-soft bg-ziel-surface p-3">
            <p className="mb-2 text-xs font-semibold text-ziel-sub">{times.length ? `Vai avisar às (${times.length} por dia, só se estiver pendente)` : 'Vai avisar às'}</p>
            {times.length ? (
              <div className="flex flex-wrap gap-1.5">
                {times.map((t, i) => (
                  <span key={`${t}-${i}`} className="rounded-full bg-ziel-accent-soft px-2.5 py-1 text-xs font-bold tabular-nums text-ziel-accent">
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${errors.length ? 'text-ziel-danger' : 'text-ziel-muted'}`}>{errors[0] ?? 'Adicione uma janela para escolher os horários.'}</p>
            )}
            <p className="mt-2 text-[11px] text-ziel-muted">Os avisos tocam mesmo com o app fechado e param assim que você registra a meta no dia. Fora das janelas, nenhum aviso.</p>
          </div>
        </>
      )}
    </div>
  );
};
