package com.ziel.app.widget;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

/**
 * Atividade transparente aberta pelos widgets (sem abrir o Ziel):
 *  - mode "toggle": conclui/desfaz e fecha na hora (sem tela);
 *  - mode "choose": mostra os quatro status (Pendente, Parcial, Concluído, Não realizado) para marcar ou corrigir;
 *  - mode "open": abre o Ziel.
 */
public class WidgetActionActivity extends Activity {
    private static final int SURFACE = 0xFF1D2433;
    private static final int RAISED = 0xFF283046;
    private static final int TEXT = 0xFFF3F5FA;
    private static final int MUTED = 0xFFA9B2C8;
    private static final int INK = 0xFF0F1320;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        overridePendingTransition(0, 0);
        Intent in = getIntent();
        String goalId = in.getStringExtra("goalId");
        String mode = in.getStringExtra("mode");
        String today = WidgetActions.today();

        if (goalId == null) {
            finish();
            return;
        }
        if ("toggle".equals(mode)) {
            WidgetActions.toggle(this, goalId, today);
            finish();
            return;
        }
        JSONObject snap = WidgetStore.get(this).loadSnapshot();
        JSONObject item = WidgetModel.findItem(WidgetModel.day(snap, today), goalId);
        if ("open".equals(mode) || item == null || !"o".equals(item.optString("k"))) {
            openApp();
            return;
        }
        show(goalId, today, item);
    }

    private void openApp() {
        startActivity(GoalWidgetProvider.openApp(this));
        finish();
    }

    private int dp(float v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private GradientDrawable rounded(int color, float radiusDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(radiusDp));
        return d;
    }

    private void show(final String goalId, final String date, JSONObject item) {
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        getWindow().setDimAmount(0.6f);

        int accent = StatusBitmaps.parse(item.optString("c"), 0xFFF28B82);
        String current = item.optString("s", WidgetModel.PENDING);

        LinearLayout root = new LinearLayout(this);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(20), dp(20), dp(20), dp(20));
        root.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(18), dp(18), dp(14));
        card.setBackground(rounded(SURFACE, 26));
        card.setClickable(true);
        root.addView(card, new LinearLayout.LayoutParams(Math.min(dp(360), getResources().getDisplayMetrics().widthPixels - dp(40)), ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView title = new TextView(this);
        title.setText(item.optString("n"));
        title.setTextColor(TEXT);
        title.setTextSize(18);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setMaxLines(2);
        card.addView(title);

        TextView sub = new TextView(this);
        sub.setText("Como foi hoje?");
        sub.setTextColor(MUTED);
        sub.setTextSize(13);
        sub.setPadding(0, dp(2), 0, dp(12));
        card.addView(sub);

        String[] statuses = { WidgetModel.COMPLETED, WidgetModel.PARTIAL, WidgetModel.NOT_DONE, WidgetModel.PENDING };
        int[] colors = { 0xFF62C48A, 0xFFF5C542, 0xFFF28B82, RAISED };
        for (int i = 0; i < statuses.length; i++) {
            final String st = statuses[i];
            TextView b = new TextView(this);
            boolean selected = st.equals(current);
            b.setText(WidgetModel.label(st) + (selected ? "  ·  atual" : ""));
            b.setGravity(Gravity.CENTER_VERTICAL);
            b.setTextSize(15);
            b.setTypeface(Typeface.DEFAULT_BOLD);
            b.setTextColor(WidgetModel.PENDING.equals(st) ? TEXT : INK);
            b.setPadding(dp(18), 0, dp(18), 0);
            GradientDrawable bg = rounded(colors[i], 22);
            if (selected) bg.setStroke(dp(2), Color.WHITE);
            b.setBackground(bg);
            b.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    WidgetActions.setStatus(WidgetActionActivity.this, goalId, WidgetActions.today(), st);
                    finish();
                }
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48));
            lp.setMargins(0, 0, 0, dp(8));
            card.addView(b, lp);
        }

        TextView open = new TextView(this);
        open.setText("Abrir no Ziel");
        open.setGravity(Gravity.CENTER);
        open.setTextColor(accent);
        open.setTextSize(14);
        open.setTypeface(Typeface.DEFAULT_BOLD);
        open.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openApp();
            }
        });
        card.addView(open, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(44)));

        setContentView(root);
    }

    @Override
    public void finish() {
        super.finish();
        overridePendingTransition(0, 0);
    }
}
