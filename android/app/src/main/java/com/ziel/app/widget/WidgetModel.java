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

    /** Reaplica marcações pendentes (ainda não entregues ao app) sobre um retrato novo, na ordem em que ocorreram. */
    public static void applyPending(JSONObject snap, JSONArray pending) {
        if (pending == null) return;
        for (int i = 0; i < pending.length(); i++) {
            JSONObject a = pending.optJSONObject(i);
            if (a == null) continue;
            setStatus(snap, a.optString("date"), a.optString("goalId"), a.optString("status"));
        }
    }

    /** Itens que o widget do dia mostra (na ordem da Home), ou lista vazia. */
    public static int itemCount(JSONObject day) {
        JSONArray items = day == null ? null : day.optJSONArray("items");
        return items == null ? 0 : items.length();
    }
}
