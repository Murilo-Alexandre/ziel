package com.ziel.app.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Escolha da meta que o widget individual acompanha. A hierarquia aparece em árvore (recuo + guias), qualquer nível
 * pode ser escolhido, grupos expandem/recolhem e a busca localiza metas (mostrando o caminho até elas).
 */
public class GoalWidgetConfigActivity extends Activity {
    private static final int BG = 0xFF141926;
    private static final int SURFACE = 0xFF1D2433;
    private static final int RAISED = 0xFF283046;
    private static final int LINE = 0xFF38425C;
    private static final int TEXT = 0xFFF3F5FA;
    private static final int MUTED = 0xFFA9B2C8;

    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private final List<JSONObject> goals = new ArrayList<>();
    private final Map<String, List<JSONObject>> kids = new HashMap<>();
    private final Map<String, JSONObject> byId = new HashMap<>();
    private final Set<String> expanded = new HashSet<>();
    private String query = "";
    private LinearLayout listBox;
    private ScrollView scroll;

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
        load();
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

    private void load() {
        JSONObject snap = WidgetStore.get(this).loadSnapshot();
        JSONArray arr = snap == null ? null : snap.optJSONArray("goals");
        if (arr == null) return;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject g = arr.optJSONObject(i);
            if (g == null) continue;
            goals.add(g);
            byId.put(g.optString("id"), g);
            String pid = g.isNull("pid") ? "" : g.optString("pid", "");
            List<JSONObject> l = kids.get(pid);
            if (l == null) {
                l = new ArrayList<>();
                kids.put(pid, l);
            }
            l.add(g);
            if (g.optInt("dp", 0) == 0) expanded.add(g.optString("id")); // raízes abertas: a estrutura já aparece
        }
    }

    private static String norm(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).trim();
    }

    private void build() {
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setBackgroundColor(BG);
        col.setPadding(dp(18), dp(20), dp(18), 0);
        // margens laterais fixas; topo e base acompanham a barra de status e a de gestos
        col.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public android.view.WindowInsets onApplyWindowInsets(View v, android.view.WindowInsets insets) {
                v.setPadding(dp(18), insets.getSystemWindowInsetTop() + dp(16), dp(18), insets.getSystemWindowInsetBottom());
                return insets;
            }
        });

        TextView title = new TextView(this);
        title.setText("Qual meta este widget acompanha?");
        title.setTextColor(TEXT);
        title.setTextSize(20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        col.addView(title);

        TextView sub = new TextView(this);
        sub.setText("Qualquer meta ou submeta pode ser escolhida. Metas com submetas abrem a lista delas no widget.");
        sub.setTextColor(MUTED);
        sub.setTextSize(13);
        sub.setPadding(0, dp(4), 0, dp(12));
        col.addView(sub);

        if (goals.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText(WidgetStore.get(this).loadSnapshot() == null
                    ? "Abra o Ziel uma vez para carregar suas metas e depois adicione o widget de novo."
                    : "Você ainda não tem metas ativas. Crie uma no Ziel e volte aqui.");
            empty.setTextColor(MUTED);
            empty.setTextSize(14);
            col.addView(empty);
            setContentView(col);
            return;
        }

        EditText search = new EditText(this);
        search.setHint("Buscar meta…");
        search.setHintTextColor(MUTED);
        search.setTextColor(TEXT);
        search.setTextSize(15);
        search.setSingleLine(true);
        search.setPadding(dp(16), 0, dp(16), 0);
        search.setBackground(rounded(SURFACE, 22));
        search.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int a, int b, int c) {}

            @Override
            public void onTextChanged(CharSequence s, int a, int b, int c) {}

            @Override
            public void afterTextChanged(Editable e) {
                query = norm(e.toString());
                render();
            }
        });
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(46));
        sp.setMargins(0, 0, 0, dp(10));
        col.addView(search, sp);

        scroll = new ScrollView(this);
        scroll.setVerticalScrollBarEnabled(false);
        listBox = new LinearLayout(this);
        listBox.setOrientation(LinearLayout.VERTICAL);
        listBox.setPadding(0, 0, 0, dp(24));
        scroll.addView(listBox);
        col.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(col);
        render();
    }

    /** Metas visíveis: com busca, as que casam + todos os ancestrais (caminho); sem busca, as que têm todos os ancestrais abertos. */
    private List<JSONObject> visible() {
        List<JSONObject> out = new ArrayList<>();
        if (!query.isEmpty()) {
            Set<String> keep = new HashSet<>();
            for (JSONObject g : goals) {
                if (norm(g.optString("n")).contains(query)) {
                    String id = g.optString("id");
                    while (id != null && !id.isEmpty() && keep.add(id)) {
                        JSONObject cur = byId.get(id);
                        id = cur == null || cur.isNull("pid") ? null : cur.optString("pid", null);
                    }
                }
            }
            for (JSONObject g : goals) if (keep.contains(g.optString("id"))) out.add(g);
            return out;
        }
        for (JSONObject g : goals) {
            boolean ok = true;
            String pid = g.isNull("pid") ? null : g.optString("pid", null);
            while (pid != null && !pid.isEmpty()) {
                if (!expanded.contains(pid)) {
                    ok = false;
                    break;
                }
                JSONObject p = byId.get(pid);
                pid = p == null || p.isNull("pid") ? null : p.optString("pid", null);
            }
            if (ok) out.add(g);
        }
        return out;
    }

    private void render() {
        listBox.removeAllViews();
        List<JSONObject> list = visible();
        if (list.isEmpty()) {
            TextView none = new TextView(this);
            none.setText("Nenhuma meta encontrada.");
            none.setTextColor(MUTED);
            none.setPadding(dp(4), dp(16), 0, 0);
            listBox.addView(none);
            return;
        }
        for (JSONObject g : list) listBox.addView(row(g));
    }

    private View row(final JSONObject g) {
        final String id = g.optString("id");
        int depth = Math.min(g.optInt("dp", 0), 6);
        int color = StatusBitmaps.parse(g.optString("c"), 0xFFF28B82);
        boolean hasKids = kids.containsKey(id);
        boolean searching = !query.isEmpty();

        LinearLayout wrap = new LinearLayout(this);
        wrap.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams wp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        wp.setMargins(0, 0, 0, dp(6));
        wrap.setLayoutParams(wp);

        // recuo com guia vertical colorida (liga o filho ao pai)
        if (depth > 0) {
            View guide = new View(this);
            guide.setBackgroundColor(LINE);
            LinearLayout.LayoutParams gp = new LinearLayout.LayoutParams(dp(2), ViewGroup.LayoutParams.MATCH_PARENT);
            gp.setMargins(dp(8 + (depth - 1) * 16), 0, dp(8), 0);
            wrap.addView(guide, gp);
        }

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(10), dp(8), dp(6), dp(8));
        row.setBackground(rounded(depth == 0 ? SURFACE : RAISED, 16));
        ImageView tile = new ImageView(this);
        tile.setImageBitmap(StatusBitmaps.tile(WidgetStore.get(this).iconFile(g.optString("ic")), dp(depth == 0 ? 40 : 34), color));
        row.addView(tile, new LinearLayout.LayoutParams(dp(depth == 0 ? 40 : 34), dp(depth == 0 ? 40 : 34)));

        LinearLayout text = new LinearLayout(this);
        text.setOrientation(LinearLayout.VERTICAL);
        text.setPadding(dp(12), 0, dp(6), 0);
        TextView name = new TextView(this);
        name.setText(g.optString("n"));
        name.setTextColor(TEXT);
        name.setTextSize(depth == 0 ? 15 : 14);
        name.setTypeface(Typeface.DEFAULT_BOLD);
        name.setSingleLine(true);
        name.setEllipsize(TextUtils.TruncateAt.END);
        text.addView(name);
        if (depth > 0 && !g.isNull("pn") && !g.optString("pn").isEmpty()) {
            TextView parent = new TextView(this);
            parent.setText("em " + g.optString("pn"));
            parent.setTextColor(MUTED);
            parent.setTextSize(11);
            parent.setSingleLine(true);
            parent.setEllipsize(TextUtils.TruncateAt.END);
            text.addView(parent);
        }
        row.addView(text, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        row.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                choose(id);
            }
        });

        if (hasKids && !searching) {
            final boolean open = expanded.contains(id);
            TextView chev = new TextView(this);
            chev.setText(open ? "⌄" : "›");
            chev.setTextColor(MUTED);
            chev.setTextSize(open ? 22 : 24);
            chev.setTypeface(Typeface.DEFAULT_BOLD);
            chev.setGravity(Gravity.CENTER);
            chev.setContentDescription(open ? "Recolher submetas" : "Mostrar submetas");
            chev.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    if (open) expanded.remove(id);
                    else expanded.add(id);
                    int y = scroll.getScrollY();
                    render();
                    scroll.scrollTo(0, y);
                }
            });
            row.addView(chev, new LinearLayout.LayoutParams(dp(38), dp(40)));
        }
        wrap.addView(row, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        return wrap;
    }

    private void choose(String goalId) {
        WidgetStore.get(this).setWidgetGoal(widgetId, goalId);
        GoalWidgetProvider.update(this, AppWidgetManager.getInstance(this), widgetId);
        setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
        finish();
    }
}
