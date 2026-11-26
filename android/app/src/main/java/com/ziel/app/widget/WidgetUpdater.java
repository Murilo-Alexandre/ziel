package com.ziel.app.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.ziel.app.R;

import java.util.Calendar;

/** Atualiza todos os widgets e agenda a virada do dia (o widget troca de dia sozinho, mesmo com o app fechado). */
public final class WidgetUpdater {
    public static final String ACTION_MIDNIGHT = "com.ziel.app.widget.MIDNIGHT";

    private WidgetUpdater() {}

    /** Depois de marcar ou sincronizar: atualização leve (cabeçalho parcial + lista recarregada). */
    public static void updateAll(Context ctx) {
        updateAll(ctx, false);
    }

    /** full = true na virada do dia/hora/fuso: redesenha tudo. */
    public static void updateAll(Context ctx, boolean full) {
        Context c = ctx.getApplicationContext();
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] goalIds = m.getAppWidgetIds(new ComponentName(c, GoalWidgetProvider.class));
        for (int id : goalIds) GoalWidgetProvider.update(c, m, id);
        int[] dayIds = m.getAppWidgetIds(new ComponentName(c, DayWidgetProvider.class));
        for (int id : dayIds) {
            if (full) DayWidgetProvider.update(c, m, id);
            else DayWidgetProvider.refresh(c, m, id);
        }
        if (dayIds.length > 0) m.notifyAppWidgetViewDataChanged(dayIds, R.id.list);
        if (goalIds.length > 0 || dayIds.length > 0) scheduleMidnight(c);
    }

    /** Alarme (impreciso, sem permissão extra) logo depois da próxima meia-noite local. */
    public static void scheduleMidnight(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_YEAR, 1);
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 5);
        cal.set(Calendar.MILLISECOND, 0);
        Intent i = new Intent(c, WidgetRefreshReceiver.class).setAction(ACTION_MIDNIGHT);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getBroadcast(c, 7001, i, flags);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) am.setAndAllowWhileIdle(AlarmManager.RTC, cal.getTimeInMillis(), pi);
            else am.set(AlarmManager.RTC, cal.getTimeInMillis(), pi);
        } catch (SecurityException ignored) {
            // sem alarme: o widget ainda atualiza pelo intervalo periódico do sistema
        }
    }
}
