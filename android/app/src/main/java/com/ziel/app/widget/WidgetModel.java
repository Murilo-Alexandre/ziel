package com.ziel.app.widget;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Regras puras (sem Android) dos widgets: escolha do dia, próximo status ao tocar, recálculo do progresso
 * e aplicação das marcações pendentes sobre o retrato que o app entrega. Tudo testável por JUnit.
 *
 * Retrato (JSON): { v, today, days: { "yyyy-MM-dd": { progress, total, completed, items: [ item ] } }, goals: [...] }
 * item: { id, n, c, ic, d, k:'o'|'g', s, p, w, pw, q, r }
 */
public final class WidgetModel {
    public static final String PENDING = "pending";
    public static final String PARTIAL = "partial";
    public static final String COMPLETED = "completed";
    public static final String NOT_DONE = "not_done";

    private WidgetModel() {}

    /** Dia local (yyyy-MM-dd) de um instante, no fuso informado: é o dia que o widget mostra, com o app fechado. */
    public static String todayKey(long nowMs, TimeZone tz) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        f.setTimeZone(tz);
        return f.format(new Date(nowMs));
    }

    public static boolean isValidStatus(String s) {
        return PENDING.equals(s) || PARTIAL.equals(s) || COMPLETED.equals(s) || NOT_DONE.equals(s);
    }

    /** Toque no círculo: concluir; se já está concluída, volta a pendente (corrigir). Parcial/Não realizado → concluir. */
    public static String nextOnTap(String status) {
        return COMPLETED.equals(status) ? PENDING : COMPLETED;
    }

    /** Número em pt-BR: inteiro sem casas, senão uma casa com vírgula (1,5). */
    public static String fmt(double v) {
        if (v == Math.rint(v)) return String.valueOf((long) v);
        return String.format(java.util.Locale.forLanguageTag("pt-BR"), "%.1f", v);
    }

    public static String label(String status) {
        if (COMPLETED.equals(status)) return "Concluído";
        if (PARTIAL.equals(status)) return "Parcial";
        if (NOT_DONE.equals(status)) return "Não realizado";
        return "Pendente";
    }

    public static JSONObject day(JSONObject snap, String date) {
        if (snap == null) return null;
        JSONObject days = snap.optJSONObject("days");
        return days == null ? null : days.optJSONObject(date);
    }

    public static JSONObject findItem(JSONObject day, String goalId) {
        if (day == null || goalId == null) return null;
        JSONArray items = day.optJSONArray("items");
        if (items == null) return null;
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i);
            if (it != null && goalId.equals(it.optString("id"))) return it;
        }
        return null;
    }

    public static JSONObject goalInfo(JSONObject snap, String goalId) {
        if (snap == null || goalId == null) return null;
        JSONArray goals = snap.optJSONArray("goals");
        if (goals == null) return null;
        for (int i = 0; i < goals.length(); i++) {
            JSONObject g = goals.optJSONObject(i);
            if (g != null && goalId.equals(g.optString("id"))) return g;
        }
        return null;
    }

    /** Muda o status de uma ocorrência marcável e recalcula o progresso do dia. false se não existe ou não é marcável. */
    public static boolean setStatus(JSONObject snap, String date, String goalId, String status) {
        if (!isValidStatus(status)) return false;
        JSONObject day = day(snap, date);
        JSONObject item = findItem(day, goalId);
        if (item == null || !"o".equals(item.optString("k"))) return false;
        try {
            item.put("s", status);
            recomputeProgress(day);
        } catch (JSONException e) {
            return false;
        }
        return true;
    }

    /** Mesma conta da Home: concluído = 1, parcial = peso do app, demais 0; só itens que contam no progresso. */
    public static void recomputeProgress(JSONObject day) throws JSONException {
        JSONArray items = day.optJSONArray("items");
        int total = 0;
        int completed = 0;
        double score = 0;
        if (items != null) {
            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.optJSONObject(i);
                if (it == null || !"o".equals(it.optString("k")) || it.optInt("w", 0) != 1) continue;
                total++;
                String s = it.optString("s", PENDING);
                if (COMPLETED.equals(s)) {
                    completed++;
                    score += 1;
                } else if (PARTIAL.equals(s)) {
                    score += it.optDouble("pw", 0.5);
                }
            }
        }
        day.put("total", total);
        day.put("completed", completed);
        day.put("progress", total > 0 ? score / total : 0);
    }

    /** Metas filhas diretas (na ordem da Home) de `parentId` no dia; parentId null = raiz. */
    public static java.util.List<JSONObject> childrenOf(JSONObject day, String parentId) {
        java.util.List<JSONObject> out = new java.util.ArrayList<>();
        JSONArray items = day == null ? null : day.optJSONArray("items");
        if (items == null) return out;
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i);
            if (it == null) continue;
            String pid = it.isNull("pid") ? null : it.optString("pid", null);
            if (parentId == null ? pid == null : parentId.equals(pid)) out.add(it);
        }
        return out;
    }

    /**
     * Progresso de HOJE de uma meta que agrupa: média dos registros de todas as submetas marcáveis abaixo dela
     * (concluído = 1, parcial = peso do app). Atualiza na hora quando uma submeta muda, em qualquer nível.
     * Devolve { progresso 0..1, concluídas, total }.
     */
    public static double[] groupProgress(JSONObject day, String goalId) {
        double score = 0;
        int total = 0;
        int done = 0;
        java.util.ArrayDeque<String> queue = new java.util.ArrayDeque<>();
        queue.add(goalId);
        while (!queue.isEmpty()) {
            for (JSONObject c : childrenOf(day, queue.poll())) {
                if ("o".equals(c.optString("k"))) {
                    total++;
                    String s = c.optString("s", PENDING);
                    if (COMPLETED.equals(s)) {
                        done++;
                        score += 1;
                    } else if (PARTIAL.equals(s)) {
                        score += c.optDouble("pw", 0.5);
                    }
                }
                queue.add(c.optString("id"));
            }
        }
        return new double[] { total > 0 ? score / total : 0, done, total };
    }

    /** Registra a quantidade realizada; o status acompanha como no app (alvo = concluído, algo = parcial, zero = pendente). */
    public static boolean setQuantity(JSONObject snap, String date, String goalId, double qty) {
        if (Double.isNaN(qty) || qty < 0) return false;
        JSONObject day = day(snap, date);
        JSONObject item = findItem(day, goalId);
        if (item == null || !"o".equals(item.optString("k"))) return false;
        JSONObject q = item.optJSONObject("q");
        if (q == null) return false;
        try {
            q.put("v", qty);
            double target = q.optDouble("t", 0);
            String status = target > 0 && qty >= target ? COMPLETED : qty > 0 ? PARTIAL : PENDING;
            item.put("s", status);
            recomputeProgress(day);
        } catch (JSONException e) {
            return false;
        }
        return true;
    }

    /** Reaplica marcações pendentes (ainda não entregues ao app) sobre um retrato novo, na ordem em que ocorreram. */
    public static void applyPending(JSONObject snap, JSONArray pending) {
        if (pending == null) return;
        for (int i = 0; i < pending.length(); i++) {
            JSONObject a = pending.optJSONObject(i);
            if (a == null) continue;
            if (a.has("qty")) setQuantity(snap, a.optString("date"), a.optString("goalId"), a.optDouble("qty", -1));
            else if (a.has("status")) setStatus(snap, a.optString("date"), a.optString("goalId"), a.optString("status"));
        }
    }

    /** Itens que o widget do dia mostra (na ordem da Home), ou lista vazia. */
    public static int itemCount(JSONObject day) {
        JSONArray items = day == null ? null : day.optJSONArray("items");
        return items == null ? 0 : items.length();
    }
}
