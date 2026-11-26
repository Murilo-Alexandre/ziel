package com.ziel.app.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Virada do dia, mudança de hora/fuso e reinício do aparelho: redesenha os widgets com o dia certo. */
public class WidgetRefreshReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        WidgetUpdater.updateAll(context, true);
    }
}
