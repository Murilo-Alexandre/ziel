import React, { useCallback, useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { notificationPort, reminderService } from '../../application/container';
import { NotificationSettings, PlannedReminder } from '../../domain/notifications/reminderPlanner';
import { NotificationPermission } from '../../infrastructure/ports/NotificationPort';
import { Switch } from '../../shared/ui/Switch';
import { Select } from '../../shared/ui/Select';
import { useAppData } from '../../shared/AppData';
import { useToast } from '../../shared/ui/Toast';

const LIMITS = [3, 6, 10, 12, 20, 30];

/** Configurações globais de notificação (o controle fino de cada meta fica no editor da meta). */
export const NotificationsSection: React.FC = () => {
  const { version } = useAppData();
  const { notify } = useToast();
  const supported = notificationPort.isSupported();
  const [settings, setSettings] = useState<NotificationSettings>(() => reminderService.getSettings());
  const [perm, setPerm] = useState<NotificationPermission>('prompt');
  const [exact, setExact] = useState(true);
  const [upcoming, setUpcoming] = useState<PlannedReminder[]>([]);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setUpcoming((await reminderService.plan()).slice(0, 5));
    if (supported) {
      setPerm(await reminderService.permission());
      setExact(await notificationPort.canScheduleExact());
      setPendingCount((await notificationPort.getPendingIds()).length);
    }
  }, [supported]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh, version]);

  const apply = async (patch: Partial<NotificationSettings>) => {
    const next = reminderService.updateSettings(patch);
    setSettings(next);
    try {
      if (patch.enabled && supported && (await reminderService.permission()) === 'prompt') {
        const p = await reminderService.requestPermission();
        if (p !== 'granted') notify('Sem a permissão do Android os lembretes não aparecem. Você pode permitir nas configurações do sistema.', 'error');
      }
      await reminderService.sync();
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Não foi possível atualizar os lembretes.', 'error');
    }
  };

  const fmtWhen = (ms: number) => {
    const d = new Date(ms);
    return `${d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <section data-reveal className="card space-y-4 p-5" aria-label="Notificações">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <BellRing className="h-5 w-5 text-ziel-accent" /> Notificações
          </h2>
          <p className="mt-1 text-sm text-ziel-muted">Lembretes locais, sem internet e com o app fechado. Cada meta define o próprio horário no editor.</p>
        </div>
        <Switch checked={settings.enabled} onChange={(v) => apply({ enabled: v })} label="Receber lembretes" />
      </div>

      {!supported && (
        <p className="rounded-[18px] bg-ziel-raised px-4 py-3 text-sm text-ziel-sub">
          Os avisos funcionam no app Android. Aqui na web você pode configurar os horários, mas eles só disparam no celular.
        </p>
      )}

      {supported && settings.enabled && perm !== 'granted' && (
        <div className="space-y-2 rounded-[18px] border border-ziel-warning/40 bg-ziel-warning-soft p-4 text-sm">
          <p>{perm === 'denied' ? 'As notificações do Ziel estão bloqueadas. Ative em Configurações do Android → Apps → Ziel → Notificações.' : 'O Ziel ainda não tem permissão para notificar.'}</p>
          {perm !== 'denied' && (
            <button type="button" className="btn-primary" onClick={() => apply({ enabled: true })}>
              Permitir notificações
            </button>
          )}
        </div>
      )}

      {supported && settings.enabled && perm === 'granted' && !exact && (
        <div className="space-y-2 rounded-[18px] border border-ziel-warning/40 bg-ziel-warning-soft p-4 text-sm">
          <p>Os alarmes exatos estão desligados: os avisos podem atrasar alguns minutos.</p>
          <button type="button" className="btn-ghost" onClick={() => notificationPort.openExactAlarmSettings()}>
            Abrir configuração
          </button>
        </div>
      )}

      {settings.enabled && (
        <>
          <div className="flex items-center justify-between gap-3 border-t border-ziel-line-soft pt-4">
            <div className="min-w-0">
              <p className="text-[15px] font-bold">Silêncio à noite</p>
              <p className="text-xs text-ziel-muted">Não avisa dentro deste intervalo</p>
            </div>
            <Switch checked={settings.quietHours.enabled} onChange={(v) => apply({ quietHours: { ...settings.quietHours, enabled: v } })} label="Ativar silêncio à noite" />
          </div>
          {settings.quietHours.enabled && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-ziel-sub">
                De
                <input type="time" className="field mt-1.5" value={settings.quietHours.start} onChange={(e) => apply({ quietHours: { ...settings.quietHours, start: e.target.value } })} />
              </label>
              <label className="text-xs font-semibold text-ziel-sub">
                Até
                <input type="time" className="field mt-1.5" value={settings.quietHours.end} onChange={(e) => apply({ quietHours: { ...settings.quietHours, end: e.target.value } })} />
              </label>
            </div>
          )}

          <label className="flex items-center justify-between gap-3 text-[15px] font-bold">
            <span>
              Máximo por dia
              <span className="block text-xs font-normal text-ziel-muted">Evita excesso de avisos</span>
            </span>
            <Select aria-label="Máximo de notificações por dia" className="field !w-24" value={settings.maxPerDay} onChange={(e) => apply({ maxPerDay: Number(e.target.value) })}>
              {LIMITS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>

          <div className="border-t border-ziel-line-soft pt-4">
            <p className="text-sm font-bold">Próximos lembretes</p>
            {upcoming.length === 0 ? (
              <p className="mt-1 text-sm text-ziel-muted">Nenhum agendado. Ative “Avisar neste horário” ao criar ou editar uma meta.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {upcoming.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-ziel-raised px-3.5 py-2.5 text-sm">
                    <span className="min-w-0 truncate font-semibold">{r.title}</span>
                    <span className="shrink-0 tabular-nums text-ziel-sub">{fmtWhen(r.fireAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            {supported && pendingCount !== null && <p className="mt-2 text-xs text-ziel-muted">{pendingCount} agendado(s) no sistema (janela de {settings.horizonDays} dias, renovada quando você abre o app).</p>}
          </div>

          {supported && (
            <button
              type="button"
              className="btn-ghost w-full"
              onClick={async () => {
                if ((await reminderService.permission()) !== 'granted') await reminderService.requestPermission();
                await notificationPort.notifyNow('Ziel', 'Notificação de teste: tudo certo por aqui.');
                notify('Notificação de teste enviada', 'success');
              }}
            >
              Enviar notificação de teste
            </button>
          )}
        </>
      )}
    </section>
  );
};
