package com.ziel.app.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Toque no círculo do widget individual: concluir / desfazer, sem abrir o app. */
public class WidgetActionReceiver extends BroadcastReceiver {
    public static final String ACTION_TOGGLE = "com.ziel.app.widget.TOGGLE";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_TOGGLE.equals(intent.getAction())) return;
        String goalId = intent.getStringExtra("goalId");
        if (goalId == null) return;
        // o dia vale no MOMENTO do toque (o widget pode ter sido desenhado ontem)
        WidgetActions.toggle(context, goalId, WidgetActions.today());
    }
}
