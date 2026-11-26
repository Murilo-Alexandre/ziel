package com.ziel.app.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationManagerCompat;

import com.capacitorjs.plugins.localnotifications.NotificationStorage;
import com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.TimeZone;

/** Ações dos widgets: marcar/corrigir status, cancelar lembretes do dia e atualizar as telas. Rodam com o app fechado. */
public final class WidgetActions {
    private WidgetActions() {}

    /** Toque no círculo: concluir (ou voltar a pendente se já estava concluída). */
    public static void toggle(Context c, String goalId, String date) {
        JSONObject snap = WidgetStore.get(c).loadSnapshot();
        JSONObject item = WidgetModel.findItem(WidgetModel.day(snap, date), goalId);
        if (item == null) return;
        setStatus(c, goalId, date, WidgetModel.nextOnTap(item.optString("s", WidgetModel.PENDING)));
    }

    public static void setStatus(Context c, String goalId, String date, String status) {
        JSONObject item = WidgetStore.get(c).applyUserAction(goalId, date, status);
        if (item == null) return;
        // meta registrada hoje => os lembretes pendentes dela deixam de tocar (o app reconcilia ao abrir)
        if (!WidgetModel.PENDING.equals(status)) cancelReminders(c, item.optJSONArray("r"));
        WidgetUpdater.updateAll(c);
    }

    /** O dia que os widgets mostram agora (relógio do aparelho). */
    public static String today() {
        return WidgetModel.todayKey(System.currentTimeMillis(), TimeZone.getDefault());
    }

    /** Cancela alarmes/avisos do Capacitor pelos mesmos ids (código de requisição = id do lembrete). */
    static void cancelReminders(Context c, JSONArray ids) {
        if (ids == null || ids.length() == 0) return;
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        NotificationStorage storage = new NotificationStorage(c);
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        int flags = PendingIntent.FLAG_NO_CREATE | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
        for (int i = 0; i < ids.length(); i++) {
            int id = ids.optInt(i, 0);
            if (id == 0) continue;
            try {
                Intent intent = new Intent(c, TimedNotificationPublisher.class);
                PendingIntent pi = PendingIntent.getBroadcast(c, id, intent, flags);
                if (pi != null && am != null) {
                    am.cancel(pi);
                    pi.cancel();
                }
                storage.deleteNotification(Integer.toString(id));
                nm.cancel(id);
            } catch (Exception ignored) {
                // um lembrete que não deu para cancelar não impede os outros
            }
        }
    }
}
