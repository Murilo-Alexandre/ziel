package com.ziel.app.widget;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;

/**
 * Armazenamento local dos widgets (funciona offline e com o app fechado):
 *  - widget_state.json: retrato entregue pelo app (hoje + próximos dias) com as marcações do widget já aplicadas;
 *  - widget_pending.json: fila das marcações feitas nos widgets, entregue ao app (que a aplica pelas regras dele);
 *  - widget_icons/: imagens dos ícones das metas;
 *  - preferências: qual meta cada widget individual acompanha.
 */
public final class WidgetStore {
    private static final Object LOCK = new Object();
    private static final String PREFS = "ziel_widgets";

    private final Context ctx;
    private final File stateFile;
    private final File pendingFile;
    private final File iconDir;

    private WidgetStore(Context c) {
        this.ctx = c.getApplicationContext();
        File dir = ctx.getFilesDir();
        stateFile = new File(dir, "widget_state.json");
        pendingFile = new File(dir, "widget_pending.json");
        iconDir = new File(dir, "widget_icons");
    }

    public static WidgetStore get(Context c) {
        return new WidgetStore(c);
    }

    // ------------------------------------------------------------------ arquivos

    private static String read(File f) {
        if (!f.exists()) return null;
        try (FileInputStream in = new FileInputStream(f); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return null;
        }
    }

    /** Escrita atômica: arquivo temporário + renomear (um corte de energia nunca deixa o JSON pela metade). */
    private static void write(File f, String content) throws IOException {
        File tmp = new File(f.getParentFile(), f.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(content.getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        }
        if (!tmp.renameTo(f)) {
            if (f.exists() && !f.delete()) throw new IOException("não foi possível substituir " + f.getName());
            if (!tmp.renameTo(f)) throw new IOException("não foi possível gravar " + f.getName());
        }
    }

    public JSONObject loadSnapshot() {
        synchronized (LOCK) {
            String s = read(stateFile);
            if (s == null) return null;
            try {
                return new JSONObject(s);
            } catch (JSONException e) {
                return null;
            }
        }
    }

    private JSONArray loadPendingLocked() {
        String s = read(pendingFile);
        if (s == null) return new JSONArray();
        try {
            return new JSONArray(s);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    // ------------------------------------------------------------------ app -> widget

    /** Guarda o retrato novo, preservando marcações do widget que o app ainda não leu. */
    public void saveSnapshotFromApp(String json) throws JSONException, IOException {
        synchronized (LOCK) {
            JSONObject snap = new JSONObject(json);
            WidgetModel.applyPending(snap, loadPendingLocked());
            write(stateFile, snap.toString());
        }
    }

    public void saveIcons(JSONObject icons) throws IOException {
        if (icons == null) return;
        if (!iconDir.exists() && !iconDir.mkdirs()) throw new IOException("sem pasta de ícones");
        Iterator<String> keys = icons.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            if (!key.matches("[A-Za-z0-9_]+")) continue;
            byte[] bytes = Base64.decode(icons.optString(key), Base64.DEFAULT);
            File f = new File(iconDir, key + ".png");
            try (FileOutputStream out = new FileOutputStream(f)) {
                out.write(bytes);
            }
        }
    }

    public File iconFile(String key) {
        return new File(iconDir, key + ".png");
    }

    // ------------------------------------------------------------------ widget -> app

    /** Marca pelo widget: atualiza o retrato na hora e enfileira para o app. Devolve o item (com ids de lembretes) ou null. */
    public JSONObject applyUserAction(String goalId, String date, String status) {
        synchronized (LOCK) {
            String s = read(stateFile);
            if (s == null) return null;
            try {
                JSONObject snap = new JSONObject(s);
                if (!WidgetModel.setStatus(snap, date, goalId, status)) return null;
                JSONArray pending = loadPendingLocked();
                pending.put(new JSONObject().put("goalId", goalId).put("date", date).put("status", status).put("ts", System.currentTimeMillis()));
                write(pendingFile, pending.toString());
                write(stateFile, snap.toString());
                return WidgetModel.findItem(WidgetModel.day(snap, date), goalId);
            } catch (JSONException | IOException e) {
                return null;
            }
        }
    }

    /** Lê as marcações feitas nos widgets SEM apagá-las: só saem da fila quando o app confirma (ackPending). */
    public JSONArray readPending() {
        synchronized (LOCK) {
            return loadPendingLocked();
        }
    }

    /** O app já aplicou as marcações até `upToTs` (inclusive): remove-as da fila. As mais novas continuam. */
    public void ackPending(long upToTs) {
        synchronized (LOCK) {
            JSONArray pending = loadPendingLocked();
            JSONArray keep = new JSONArray();
            for (int i = 0; i < pending.length(); i++) {
                JSONObject a = pending.optJSONObject(i);
                if (a != null && a.optLong("ts", 0) > upToTs) keep.put(a);
            }
            try {
                write(pendingFile, keep.toString());
            } catch (IOException ignored) {
                // se não gravar, a próxima leitura entrega de novo (aplicar de novo não muda nada)
            }
        }
    }

    // ------------------------------------------------------------------ configuração dos widgets individuais

    private SharedPreferences prefs() {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public String getWidgetGoal(int appWidgetId) {
        return prefs().getString("goal_" + appWidgetId, null);
    }

    public void setWidgetGoal(int appWidgetId, String goalId) {
        prefs().edit().putString("goal_" + appWidgetId, goalId).apply();
    }

    public void removeWidget(int appWidgetId) {
        prefs().edit().remove("goal_" + appWidgetId).apply();
    }
}
