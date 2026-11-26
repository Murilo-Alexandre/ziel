package com.ziel.app.widget;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Tela transparente aberta pelos widgets (sem abrir o Ziel):
 *  - "toggle": conclui/desfaz e fecha na hora, sem tela;
 *  - "choose": escolhe o status (Pendente, Parcial, Concluído, Não realizado), registra quantidade e comentário;
 *  - "browse"/metas que agrupam: navega pelas submetas em qualquer nível, registrando cada uma;
 *  - "open": abre o Ziel.
 * Tudo grava no armazenamento local do widget e é aplicado pelo app (com as regras dele) quando ele abrir.
 */
public class WidgetActionActivity extends Activity {
    private static final int SURFACE = 0xFF1D2433;
    private static final int RAISED = 0xFF283046;
    private static final int LINE = 0xFF38425C;
    private static final int TEXT = 0xFFF3F5FA;
    private static final int SUB = 0xFFC8CEDD;
    private static final int MUTED = 0xFFA9B2C8;
    private static final int INK = 0xFF0F1320;
    private static final int ACCENT = 0xFFF28B82;

    private FrameLayout root;
    private View browseCard;
    private View overlay;
    private ScrollView listScroll;
    private final ArrayList<String> stack = new ArrayList<>();
    private String today;
    private int savedScroll = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        overridePendingTransition(0, 0);
        Intent in = getIntent();
        String goalId = in.getStringExtra("goalId");
        String mode = in.getStringExtra("mode");
        today = WidgetActions.today();

        if (goalId == null) {
            finish();
            return;
        }
        if ("toggle".equals(mode)) {
            WidgetActions.toggle(this, goalId, today);
            finish();
            return;
        }
        if ("open".equals(mode)) {
            openApp();
            return;
        }

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        getWindow().setDimAmount(0.6f);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        root = new FrameLayout(this);
        root.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
        setContentView(root);

        JSONObject item = item(goalId);
        if (item == null) {
            openApp();
            return;
        }
        boolean group = !"o".equals(item.optString("k"));
        if ("browse".equals(mode) || group) {
            stack.add(goalId);
            showBrowse();
        } else {
            showChooser(item, true);
        }
    }

    // ------------------------------------------------------------------ dados

    private JSONObject snap() {
        return WidgetStore.get(this).loadSnapshot();
    }

    private JSONObject cachedDay;

    /** Dia atual do retrato, lido do arquivo uma vez por tela desenhada (a lista chama isso muitas vezes). */
    private JSONObject day() {
        if (cachedDay == null) cachedDay = WidgetModel.day(snap(), today);
        return cachedDay;
    }

    private JSONObject item(String id) {
        return WidgetModel.findItem(day(), id);
    }

    private void openApp() {
        startActivity(GoalWidgetProvider.openApp(this));
        finish();
    }

    // ------------------------------------------------------------------ helpers de UI

    private int dp(float v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private GradientDrawable rounded(int color, float radiusDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(radiusDp));
        return d;
    }

    private TextView text(String s, float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private int cardWidth() {
        return Math.min(dp(380), getResources().getDisplayMetrics().widthPixels - dp(32));
    }

    private int maxCardHeight() {
        return Math.round(getResources().getDisplayMetrics().heightPixels * 0.82f);
    }

    private ImageView tile(JSONObject it, int sizeDp) {
        ImageView v = new ImageView(this);
        int color = StatusBitmaps.parse(it.optString("c"), ACCENT);
        v.setImageBitmap(StatusBitmaps.tile(WidgetStore.get(this).iconFile(it.optString("ic")), dp(sizeDp), color));
        return v;
    }

    private String subLine(JSONObject it) {
        boolean marcavel = "o".equals(it.optString("k"));
        double[] gp = WidgetModel.groupProgress(day(), it.optString("id"));
        int children = WidgetModel.childrenOf(day(), it.optString("id")).size();
        StringBuilder sb = new StringBuilder();
        if (marcavel) {
            JSONObject q = it.optJSONObject("q");
            if (q != null) {
                double v = q.isNull("v") ? 0 : q.optDouble("v", 0);
                sb.append(fmt(v)).append(" / ").append(fmt(q.optDouble("t", 0))).append(' ').append(q.optString("u", "")).append(" · ");
            }
            sb.append(WidgetModel.label(it.optString("s", WidgetModel.PENDING)));
        }
        if (children > 0 && gp[2] > 0) {
            if (sb.length() > 0) sb.append("  ·  ");
            sb.append((int) gp[1]).append(" de ").append((int) gp[2]).append(" hoje");
        } else if (!marcavel) {
            sb.append(children).append(children == 1 ? " submeta" : " submetas");
        }
        return sb.toString();
    }

    private static String fmt(double v) {
        return WidgetModel.fmt(v);
    }

    // ------------------------------------------------------------------ navegador de submetas

    private void showBrowse() {
        cachedDay = null; // relê o retrato: acabou de ser alterado por uma marcação
        if (listScroll != null) savedScroll = listScroll.getScrollY();
        if (browseCard != null) root.removeView(browseCard);
        final String id = stack.get(stack.size() - 1);
        JSONObject cur = item(id);
        if (cur == null) {
            finish();
            return;
        }
        int accent = StatusBitmaps.parse(cur.optString("c"), ACCENT);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14), dp(12), dp(14), dp(10));
        card.setBackground(rounded(SURFACE, 26));
        card.setClickable(true);

        // cabeçalho: voltar/fechar, azulejo, nome e resumo
        LinearLayout head = new LinearLayout(this);
        head.setOrientation(LinearLayout.HORIZONTAL);
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView back = text(stack.size() > 1 ? "‹" : "✕", stack.size() > 1 ? 30 : 18, SUB, true);
        back.setGravity(Gravity.CENTER);
        back.setBackground(rounded(RAISED, 20));
        back.setContentDescription(stack.size() > 1 ? "Voltar" : "Fechar");
        back.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                goBack();
            }
        });
        head.addView(back, new LinearLayout.LayoutParams(dp(40), dp(40)));
        head.addView(tile(cur, 36), spaced(36, 36, 10, 0));
        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        TextView title = text(cur.optString("n"), 16, TEXT, true);
        title.setSingleLine(true);
        title.setEllipsize(TextUtils.TruncateAt.END);
        titles.addView(title);
        TextView sub = text(subLine(cur) + progressCycle(cur), 12, MUTED, false);
        sub.setSingleLine(true);
        sub.setEllipsize(TextUtils.TruncateAt.END);
        titles.addView(sub);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        tp.setMargins(dp(10), 0, 0, 0);
        head.addView(titles, tp);
        // se a própria meta é marcável (tem ocorrência e submetas), o círculo dela fica no cabeçalho
        if ("o".equals(cur.optString("k"))) head.addView(statusCircle(cur, 36), spaced(36, 36, 6, 0));
        card.addView(head);

        // barra de progresso de hoje (submetas abaixo deste nível)
        double[] gp = WidgetModel.groupProgress(day(), id);
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        View fill = new View(this);
        fill.setBackground(rounded(accent, 3));
        View rest = new View(this);
        rest.setBackground(rounded(LINE, 3));
        float p = (float) Math.max(0, Math.min(1, gp[0]));
        bar.addView(fill, new LinearLayout.LayoutParams(0, dp(5), Math.max(p, 0.0001f)));
        bar.addView(rest, new LinearLayout.LayoutParams(0, dp(5), Math.max(1 - p, 0.0001f)));
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(5));
        bp.setMargins(0, dp(10), 0, dp(8));
        card.addView(bar, bp);

        // lista de submetas
        listScroll = new ScrollView(this);
        listScroll.setVerticalScrollBarEnabled(false);
        LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        List<JSONObject> kids = WidgetModel.childrenOf(day(), id);
        if (kids.isEmpty()) {
            TextView none = text("Nenhuma submeta para hoje.", 13, MUTED, false);
            none.setPadding(dp(4), dp(12), dp(4), dp(12));
            list.addView(none);
        }
        for (JSONObject k : kids) list.addView(row(k));
        listScroll.addView(list);
        card.addView(listScroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView open = text("Abrir no Ziel", 13, accent, true);
        open.setGravity(Gravity.CENTER);
        open.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openApp();
            }
        });
        card.addView(open, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(40)));

        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(cardWidth(), ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        browseCard = card;
        root.addView(card, 0, lp);
        card.post(new Runnable() {
            @Override
            public void run() {
                int max = maxCardHeight();
                if (browseCard != null && browseCard.getHeight() > max) {
                    int over = browseCard.getHeight() - max;
                    ViewGroup.LayoutParams l = listScroll.getLayoutParams();
                    l.height = Math.max(dp(120), listScroll.getHeight() - over);
                    listScroll.setLayoutParams(l);
                }
                listScroll.scrollTo(0, savedScroll);
            }
        });
    }

    private String progressCycle(JSONObject it) {
        if ("o".equals(it.optString("k"))) return "";
        int pct = (int) Math.round(it.optDouble("p", 0) * 100);
        return "  ·  ciclo " + pct + "%";
    }

    private LinearLayout.LayoutParams spaced(int w, int h, int left, int right) {
        LinearLayout.LayoutParams l = new LinearLayout.LayoutParams(dp(w), dp(h));
        l.setMargins(dp(left), 0, dp(right), 0);
        return l;
    }

    private ImageView statusCircle(final JSONObject it, int sizeDp) {
        int color = StatusBitmaps.parse(it.optString("c"), ACCENT);
        String s = it.optString("s", WidgetModel.PENDING);
        ImageView v = new ImageView(this);
        v.setImageResource(StatusBitmaps.statusRes(s));
        v.setColorFilter(StatusBitmaps.statusColor(s, color));
        v.setPadding(dp(3), dp(3), dp(3), dp(3));
        v.setContentDescription("Alterar status: " + WidgetModel.label(s));
        final String id = it.optString("id");
        v.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View x) {
                WidgetActions.toggle(WidgetActionActivity.this, id, today);
                refresh();
            }
        });
        return v;
    }

    private View row(final JSONObject it) {
        final String id = it.optString("id");
        boolean marcavel = "o".equals(it.optString("k"));
        int children = WidgetModel.childrenOf(day(), id).size();
        int color = StatusBitmaps.parse(it.optString("c"), ACCENT);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(10), dp(6), dp(6), dp(6));
        row.setBackground(rounded(RAISED, 16));
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56));
        rp.setMargins(0, 0, 0, dp(6));
        row.setLayoutParams(rp);

        row.addView(tile(it, 34), spaced(34, 34, 0, 10));
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        TextView name = text(it.optString("n"), 14, TEXT, true);
        name.setSingleLine(true);
        name.setEllipsize(TextUtils.TruncateAt.END);
        col.addView(name);
        String sub = subLine(it);
        if (!sub.isEmpty()) {
            TextView st = text(sub, 11, MUTED, false);
            st.setSingleLine(true);
            st.setEllipsize(TextUtils.TruncateAt.END);
            col.addView(st);
        }
        row.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        row.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                JSONObject cur = item(id);
                if (cur == null) return;
                if ("o".equals(cur.optString("k"))) showChooser(cur, false);
                else navigate(id);
            }
        });

        if (children > 0) {
            TextView chev = text("›", 24, SUB, true);
            chev.setGravity(Gravity.CENTER);
            chev.setContentDescription("Ver submetas de " + it.optString("n"));
            chev.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    navigate(id);
                }
            });
            row.addView(chev, new LinearLayout.LayoutParams(dp(34), dp(44)));
        }
        if (marcavel) {
            row.addView(statusCircle(it, 36), new LinearLayout.LayoutParams(dp(40), dp(40)));
        } else {
            double[] gp = WidgetModel.groupProgress(day(), id);
            ImageView ring = new ImageView(this);
            ring.setImageBitmap(StatusBitmaps.progressRing(dp(36), gp[0], color));
            row.addView(ring, new LinearLayout.LayoutParams(dp(40), dp(40)));
        }
        return row;
    }

    private void navigate(String id) {
        savedScroll = 0;
        stack.add(id);
        showBrowse();
    }

    private void goBack() {
        if (stack.size() > 1) {
            stack.remove(stack.size() - 1);
            savedScroll = 0;
            showBrowse();
        } else {
            finish();
        }
    }

    private void refresh() {
        if (stack.isEmpty()) return;
        showBrowse();
    }

    @Override
    public void onBackPressed() {
        if (overlay != null) {
            dismissOverlay(false);
            return;
        }
        if (stack.size() > 1) {
            goBack();
            return;
        }
        super.onBackPressed();
    }

    // ------------------------------------------------------------------ escolha de status, quantidade e comentário

    private void dismissOverlay(boolean closeIfStandalone) {
        if (overlay != null) {
            root.removeView(overlay);
            overlay = null;
        }
        if (stack.isEmpty() && closeIfStandalone) finish();
        else if (stack.isEmpty()) finish();
    }

    private void showChooser(final JSONObject item, boolean standalone) {
        final String goalId = item.optString("id");
        final int accent = StatusBitmaps.parse(item.optString("c"), ACCENT);
        String current = item.optString("s", WidgetModel.PENDING);
        if (overlay != null) root.removeView(overlay);

        FrameLayout dim = new FrameLayout(this);
        dim.setBackgroundColor(standalone ? Color.TRANSPARENT : 0x99000000);
        dim.setClickable(true);
        dim.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (stack.isEmpty()) finish();
                else dismissOverlay(false);
            }
        });

        ScrollView sv = new ScrollView(this);
        sv.setVerticalScrollBarEnabled(false);
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(18), dp(18), dp(12));
        card.setBackground(rounded(SURFACE, 26));
        card.setClickable(true);
        sv.addView(card);

        TextView title = text(item.optString("n"), 18, TEXT, true);
        title.setMaxLines(2);
        card.addView(title);
        TextView sub = text("Como foi hoje?", 13, MUTED, false);
        sub.setPadding(0, dp(2), 0, dp(12));
        card.addView(sub);

        String[] statuses = { WidgetModel.COMPLETED, WidgetModel.PARTIAL, WidgetModel.NOT_DONE, WidgetModel.PENDING };
        int[] colors = { 0xFF62C48A, 0xFFF5C542, 0xFFF28B82, RAISED };
        for (int i = 0; i < statuses.length; i++) {
            final String st = statuses[i];
            boolean selected = st.equals(current);
            TextView b = text(WidgetModel.label(st) + (selected ? "  ·  atual" : ""), 15, WidgetModel.PENDING.equals(st) ? TEXT : INK, true);
            b.setGravity(Gravity.CENTER_VERTICAL);
            b.setPadding(dp(18), 0, dp(18), 0);
            GradientDrawable bg = rounded(colors[i], 22);
            if (selected) bg.setStroke(dp(2), Color.WHITE);
            b.setBackground(bg);
            b.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    WidgetActions.setStatus(WidgetActionActivity.this, goalId, today, st);
                    afterAction();
                }
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(46));
            lp.setMargins(0, 0, 0, dp(7));
            card.addView(b, lp);
        }

        // quantidade (metas medidas por quantidade)
        final JSONObject q = item.optJSONObject("q");
        if (q != null) {
            TextView lbl = text("Quanto você fez? (meta: " + fmt(q.optDouble("t", 0)) + " " + q.optString("u", "") + ")", 12, SUB, true);
            lbl.setPadding(0, dp(8), 0, dp(4));
            card.addView(lbl);
            LinearLayout qrow = new LinearLayout(this);
            qrow.setOrientation(LinearLayout.HORIZONTAL);
            qrow.setGravity(Gravity.CENTER_VERTICAL);
            final EditText qty = field("0 " + q.optString("u", ""));
            qty.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
            if (!q.isNull("v")) qty.setText(fmt(q.optDouble("v", 0)).replace('.', ','));
            qrow.addView(qty, new LinearLayout.LayoutParams(0, dp(44), 1f));
            TextView save = button("Registrar", accent);
            save.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    String raw = qty.getText().toString().trim().replace(',', '.');
                    double val;
                    try {
                        val = Double.parseDouble(raw);
                    } catch (NumberFormatException e) {
                        Toast.makeText(WidgetActionActivity.this, "Informe um número", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    if (val < 0) {
                        Toast.makeText(WidgetActionActivity.this, "Informe zero ou mais", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    WidgetActions.setQuantity(WidgetActionActivity.this, goalId, today, val);
                    afterAction();
                }
            });
            LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(dp(104), dp(44));
            sp.setMargins(dp(8), 0, 0, 0);
            qrow.addView(save, sp);
            card.addView(qrow);
        }

        // comentário (entra no histórico da ocorrência quando o Ziel abrir)
        TextView clbl = text("Comentário (opcional)", 12, SUB, true);
        clbl.setPadding(0, dp(10), 0, dp(4));
        card.addView(clbl);
        LinearLayout crow = new LinearLayout(this);
        crow.setOrientation(LinearLayout.HORIZONTAL);
        crow.setGravity(Gravity.CENTER_VERTICAL);
        final EditText comment = field("Ex.: tomei depois do almoço");
        comment.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        crow.addView(comment, new LinearLayout.LayoutParams(0, dp(44), 1f));
        TextView csave = button("Salvar", RAISED);
        csave.setTextColor(TEXT);
        csave.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String t = comment.getText().toString();
                if (WidgetActions.addComment(WidgetActionActivity.this, goalId, today, t)) {
                    comment.setText("");
                    Toast.makeText(WidgetActionActivity.this, "Comentário guardado. Entra no histórico quando o Ziel abrir.", Toast.LENGTH_LONG).show();
                } else {
                    Toast.makeText(WidgetActionActivity.this, "Escreva o comentário", Toast.LENGTH_SHORT).show();
                }
            }
        });
        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(dp(84), dp(44));
        cp.setMargins(dp(8), 0, 0, 0);
        crow.addView(csave, cp);
        card.addView(crow);

        // submetas
        final int children = WidgetModel.childrenOf(day(), goalId).size();
        if (children > 0) {
            TextView subs = text("Ver submetas (" + children + ")", 14, accent, true);
            subs.setGravity(Gravity.CENTER);
            subs.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    dismissOverlayOnly();
                    if (stack.isEmpty() || !goalId.equals(stack.get(stack.size() - 1))) {
                        stack.add(goalId);
                        savedScroll = 0;
                    }
                    showBrowse();
                }
            });
            card.addView(subs, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(44)));
        }
        TextView open = text("Abrir no Ziel", 13, MUTED, true);
        open.setGravity(Gravity.CENTER);
        open.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openApp();
            }
        });
        card.addView(open, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(40)));

        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(cardWidth() - (standalone ? 0 : dp(16)), ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        dim.addView(sv, lp);
        overlay = dim;
        root.addView(dim, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void dismissOverlayOnly() {
        if (overlay != null) {
            root.removeView(overlay);
            overlay = null;
        }
    }

    /** Depois de registrar: dentro do navegador volta à lista (atualizada); sozinho, fecha e volta à tela inicial. */
    private void afterAction() {
        dismissOverlayOnly();
        if (stack.isEmpty()) finish();
        else refresh();
    }

    private EditText field(String hint) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setHintTextColor(MUTED);
        e.setTextColor(TEXT);
        e.setTextSize(14);
        e.setSingleLine(true);
        e.setPadding(dp(14), 0, dp(14), 0);
        e.setBackground(rounded(0xFF141926, 16));
        return e;
    }

    private TextView button(String label, int color) {
        TextView b = text(label, 14, INK, true);
        b.setGravity(Gravity.CENTER);
        b.setBackground(rounded(color, 22));
        return b;
    }

    @Override
    public void finish() {
        super.finish();
        overridePendingTransition(0, 0);
    }
}
