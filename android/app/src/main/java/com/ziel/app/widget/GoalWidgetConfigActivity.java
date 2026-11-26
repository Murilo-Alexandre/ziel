package com.ziel.app.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

/** Escolha da meta que o widget individual acompanha (abre ao adicionar o widget e ao tocar em um widget sem meta). */
public class GoalWidgetConfigActivity extends Activity {
    private static final int BG = 0xFF141926;
    private static final int SURFACE = 0xFF1D2433;
    private static final int TEXT = 0xFFF3F5FA;
    private static final int MUTED = 0xFFA9B2C8;

    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent in = getIntent();
        widgetId = in.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        setResult(RESULT_CANCELED, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        build();
    }

    private int dp(float v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private GradientDrawable rounded(int color, float r) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(r));
        return d;
    }

    private void build() {
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(BG);
        scroll.setFitsSystemWindows(true);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(20), dp(24), dp(20), dp(24));
        scroll.addView(col);

        TextView title = new TextView(this);
        title.setText("Qual meta este widget acompanha?");
        title.setTextColor(TEXT);
        title.setTextSize(20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        col.addView(title);

        TextView sub = new TextView(this);
        sub.setText("Você poderá marcá-la como concluída direto da tela inicial.");
        sub.setTextColor(MUTED);
        sub.setTextSize(13);
        sub.setPadding(0, dp(4), 0, dp(16));
        col.addView(sub);

        JSONObject snap = WidgetStore.get(this).loadSnapshot();
        JSONArray goals = snap == null ? null : snap.optJSONArray("goals");
        if (goals == null || goals.length() == 0) {
            TextView empty = new TextView(this);
            empty.setText(snap == null
                    ? "Abra o Ziel uma vez para carregar suas metas e depois adicione o widget de novo."
                    : "Você ainda não tem metas ativas. Crie uma no Ziel e volte aqui.");
            empty.setTextColor(MUTED);
            empty.setTextSize(14);
            col.addView(empty);
        } else {
            for (int i = 0; i < goals.length(); i++) {
                final JSONObject g = goals.optJSONObject(i);
                if (g != null) col.addView(row(g));
            }
        }
        setContentView(scroll);
    }

    private View row(final JSONObject g) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(12), dp(10), dp(12), dp(10));
        row.setBackground(rounded(SURFACE, 18));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, dp(8));
        row.setLayoutParams(lp);

        int color = StatusBitmaps.parse(g.optString("c"), 0xFFF28B82);
        ImageView tile = new ImageView(this);
        tile.setImageBitmap(StatusBitmaps.tile(WidgetStore.get(this).iconFile(g.optString("ic")), dp(40), color));
        row.addView(tile, new LinearLayout.LayoutParams(dp(40), dp(40)));

        LinearLayout text = new LinearLayout(this);
        text.setOrientation(LinearLayout.VERTICAL);
        text.setPadding(dp(12), 0, 0, 0);
        TextView name = new TextView(this);
        name.setText(g.optString("n"));
        name.setTextColor(TEXT);
        name.setTextSize(15);
        name.setTypeface(Typeface.DEFAULT_BOLD);
        text.addView(name);
        if (!g.isNull("pn") && !g.optString("pn").isEmpty()) {
            TextView parent = new TextView(this);
            parent.setText("em " + g.optString("pn"));
            parent.setTextColor(MUTED);
            parent.setTextSize(12);
            text.addView(parent);
        }
        row.addView(text, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        row.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                choose(g.optString("id"));
            }
        });
        return row;
    }

    private void choose(String goalId) {
        WidgetStore.get(this).setWidgetGoal(widgetId, goalId);
        GoalWidgetProvider.update(this, AppWidgetManager.getInstance(this), widgetId);
        setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
        finish();
    }
}
