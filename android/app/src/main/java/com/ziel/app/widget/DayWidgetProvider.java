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

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Widget das metas do dia: progresso do dia + lista (com submetas) em que cada meta pode ser marcada. */
public class DayWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
        manager.notifyAppWidgetViewDataChanged(ids, R.id.list);
        WidgetUpdater.scheduleMidnight(context);
    }

    @Override
    public void onEnabled(Context context) {
        WidgetUpdater.scheduleMidnight(context);
    }

    /** Cabeçalho (dia + progresso): só ações de texto/progresso, para poder ser enviado como atualização parcial. */
    static RemoteViews header(Context c) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.widget_day);
        JSONObject snap = WidgetStore.get(c).loadSnapshot();
        JSONObject day = WidgetModel.day(snap, WidgetActions.today());
        String date = new SimpleDateFormat("EEE, d 'de' MMM", new Locale("pt", "BR")).format(new Date());
        rv.setTextViewText(R.id.date, capitalize(date.replace(".", "")));
        int pct = day == null ? 0 : (int) Math.round(day.optDouble("progress", 0) * 100);
        rv.setProgressBar(R.id.progress, 100, pct, false);
        rv.setTextViewText(R.id.pct, day == null ? "—" : pct + "%");
        rv.setTextViewText(R.id.count, day == null ? "Abra o Ziel" : day.optInt("completed", 0) + " de " + day.optInt("total", 0));
        rv.setTextViewText(R.id.empty, snap == null ? "Abra o Ziel uma vez para sincronizar" : day == null ? "Abra o Ziel para atualizar o dia" : "Nenhuma meta para hoje");
        return rv;
    }

    /** Atualização completa (colocação do widget, redimensionar, virada do dia): cabeçalho + lista + toques. */
    public static void update(Context c, AppWidgetManager manager, int widgetId) {
        RemoteViews rv = header(c);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);

        Intent svc = new Intent(c, DayWidgetService.class);
        svc.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        svc.setData(Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME)));
        rv.setRemoteAdapter(R.id.list, svc);
        rv.setEmptyView(R.id.list, R.id.empty);

        // toques nas linhas: atividade transparente (concluir/desfazer ou escolher o status), sem abrir o Ziel
        Intent template = new Intent(c, WidgetActionActivity.class)
                .setData(Uri.parse("ziel://widget/day/" + widgetId))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
        rv.setPendingIntentTemplate(R.id.list, PendingIntent.getActivity(c, widgetId, template, flags));

        PendingIntent open = PendingIntent.getActivity(c, 2, GoalWidgetProvider.openApp(c), GoalWidgetProvider.flags());
        rv.setOnClickPendingIntent(R.id.header, open);
        manager.updateAppWidget(widgetId, rv);
    }

    /** Atualização leve (depois de marcar/sincronizar): só o cabeçalho, por atualização parcial, e a lista é recarregada. */
    public static void refresh(Context c, AppWidgetManager manager, int widgetId) {
        manager.partiallyUpdateAppWidget(widgetId, header(c));
    }

    private static String capitalize(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
