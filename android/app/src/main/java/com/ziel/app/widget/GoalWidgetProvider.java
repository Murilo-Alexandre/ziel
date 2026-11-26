package com.ziel.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

import com.ziel.app.R;

import org.json.JSONObject;

/** Widget de uma meta: nome, ícone, cor e status de hoje; o círculo conclui/desfaz sem abrir o Ziel. */
public class GoalWidgetProvider extends AppWidgetProvider {
    private static final int COLOR_TEXT = 0xFFF3F5FA;
    private static final int COLOR_MUTED = 0xFFA9B2C8;
    private static final int COLOR_SUCCESS = 0xFF62C48A;
    private static final int COLOR_WARNING = 0xFFF5C542;
    private static final int COLOR_DANGER = 0xFFF2706A;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
        WidgetUpdater.scheduleMidnight(context);
    }

    @Override
    public void onEnabled(Context context) {
        WidgetUpdater.scheduleMidnight(context);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        WidgetStore store = WidgetStore.get(context);
        for (int id : ids) store.removeWidget(id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, android.os.Bundle options) {
        update(context, manager, id);
    }

    static int flags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
    }

    static Intent openApp(Context c) {
        Intent i = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (i == null) i = new Intent();
        return i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
    }

    public static void update(Context c, AppWidgetManager manager, int widgetId) {
        manager.updateAppWidget(widgetId, build(c, widgetId));
    }

    static RemoteViews build(Context c, int widgetId) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.widget_goal);
        WidgetStore store = WidgetStore.get(c);
        String goalId = store.getWidgetGoal(widgetId);
        JSONObject snap = store.loadSnapshot();
        String today = WidgetActions.today();

        Intent config = new Intent(c, GoalWidgetConfigActivity.class)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
                .setData(Uri.parse("ziel://widget/config/" + widgetId))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent configPi = PendingIntent.getActivity(c, widgetId, config, flags());
        PendingIntent openPi = PendingIntent.getActivity(c, 1, openApp(c), flags());

        int size = Math.round(44 * c.getResources().getDisplayMetrics().density);

        if (goalId == null) {
            text(rv, "Escolha uma meta", "Toque para configurar", COLOR_TEXT, COLOR_MUTED);
            rv.setImageViewBitmap(R.id.tile, StatusBitmaps.tile(null, size, 0xFF283046));
            rv.setImageViewBitmap(R.id.circle, StatusBitmaps.none(size));
            rv.setOnClickPendingIntent(R.id.root, configPi);
            return rv;
        }
        if (snap == null) {
            text(rv, "Ziel", "Abra o Ziel uma vez para sincronizar", COLOR_TEXT, COLOR_MUTED);
            rv.setImageViewBitmap(R.id.tile, StatusBitmaps.tile(null, size, 0xFF283046));
            rv.setImageViewBitmap(R.id.circle, StatusBitmaps.none(size));
            rv.setOnClickPendingIntent(R.id.root, openPi);
            return rv;
        }
        JSONObject goal = WidgetModel.goalInfo(snap, goalId);
        if (goal == null) {
            // meta excluída ou arquivada: o widget avisa e deixa trocar a meta
            text(rv, "Meta removida", "Toque para escolher outra", COLOR_MUTED, COLOR_MUTED);
            rv.setImageViewBitmap(R.id.tile, StatusBitmaps.tile(null, size, 0xFF283046));
            rv.setImageViewBitmap(R.id.circle, StatusBitmaps.none(size));
            rv.setOnClickPendingIntent(R.id.root, configPi);
            return rv;
        }

        int color = StatusBitmaps.parse(goal.optString("c"), 0xFFF28B82);
        rv.setImageViewBitmap(R.id.tile, StatusBitmaps.tile(store.iconFile(goal.optString("ic")), size, color));

        JSONObject day = WidgetModel.day(snap, today);
        JSONObject item = WidgetModel.findItem(day, goalId);
        String name = item != null ? item.optString("n", goal.optString("n")) : goal.optString("n");

        Intent choose = new Intent(c, WidgetActionActivity.class)
                .putExtra("goalId", goalId)
                .putExtra("mode", "choose")
                .setData(Uri.parse("ziel://widget/choose/" + widgetId))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
        PendingIntent choosePi = PendingIntent.getActivity(c, widgetId, choose, flags());
        rv.setOnClickPendingIntent(R.id.body, choosePi);
        rv.setOnClickPendingIntent(R.id.tile, choosePi);

        if (day == null) {
            text(rv, name, "Abra o Ziel para atualizar o dia", COLOR_TEXT, COLOR_MUTED);
            rv.setImageViewBitmap(R.id.circle, StatusBitmaps.none(size));
            rv.setOnClickPendingIntent(R.id.circle, openPi);
        } else if (item == null) {
            text(rv, name, "Sem ocorrência hoje", COLOR_TEXT, COLOR_MUTED);
            rv.setImageViewBitmap(R.id.circle, StatusBitmaps.none(size));
            rv.setOnClickPendingIntent(R.id.circle, openPi);
        } else if (!"o".equals(item.optString("k"))) {
            int pct = (int) Math.round(item.optDouble("p", 0) * 100);
            text(rv, name, pct + "% do ciclo · toque para abrir", COLOR_TEXT, COLOR_MUTED);
            rv.setImageViewBitmap(R.id.circle, StatusBitmaps.progressRing(size, item.optDouble("p", 0), color));
            rv.setOnClickPendingIntent(R.id.circle, openPi);
        } else {
            String status = item.optString("s", WidgetModel.PENDING);
            JSONObject q = item.optJSONObject("q");
            String sub = WidgetModel.label(status);
            if (q != null) {
                double v = q.isNull("v") ? 0 : q.optDouble("v", 0);
                sub = fmt(v) + " / " + fmt(q.optDouble("t", 0)) + " " + q.optString("u", "") + " · " + sub;
            }
            int subColor = WidgetModel.COMPLETED.equals(status) ? COLOR_SUCCESS
                    : WidgetModel.PARTIAL.equals(status) ? COLOR_WARNING
                    : WidgetModel.NOT_DONE.equals(status) ? COLOR_DANGER : COLOR_MUTED;
            text(rv, name, sub, COLOR_TEXT, subColor);
            rv.setImageViewResource(R.id.circle, StatusBitmaps.statusRes(status));
            rv.setInt(R.id.circle, "setColorFilter", StatusBitmaps.statusColor(status, color));
            Intent toggle = new Intent(c, WidgetActionReceiver.class)
                    .setAction(WidgetActionReceiver.ACTION_TOGGLE)
                    .putExtra("goalId", goalId)
                    .setData(Uri.parse("ziel://widget/toggle/" + widgetId));
            rv.setOnClickPendingIntent(R.id.circle, PendingIntent.getBroadcast(c, widgetId, toggle, flags()));
        }
        return rv;
    }

    private static String fmt(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.format(java.util.Locale.forLanguageTag("pt-BR"), "%.1f", v);
    }

    private static void text(RemoteViews rv, String name, String sub, int nameColor, int subColor) {
        rv.setTextViewText(R.id.name, name);
        rv.setTextColor(R.id.name, nameColor);
        rv.setTextViewText(R.id.status, sub);
        rv.setTextColor(R.id.status, subColor);
    }
}
