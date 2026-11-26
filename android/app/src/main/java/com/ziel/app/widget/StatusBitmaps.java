package com.ziel.app.widget;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;

import java.io.File;

/** Desenha, com Canvas, os círculos de status e o azulejo da meta (RemoteViews não desenha formas customizadas). */
public final class StatusBitmaps {
    private static final int INK = Color.parseColor("#0F1320");
    private static final int DANGER = Color.parseColor("#F2706A");
    private static final int TRACK = Color.argb(46, 255, 255, 255);

    private StatusBitmaps() {}

    public static int parse(String hex, int fallback) {
        try {
            return Color.parseColor(hex);
        } catch (Exception e) {
            return fallback;
        }
    }

    private static Paint stroke(int color, float w) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(w);
        p.setColor(color);
        p.setStrokeCap(Paint.Cap.ROUND);
        p.setStrokeJoin(Paint.Join.ROUND);
        return p;
    }

    private static Paint fill(int color) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.FILL);
        p.setColor(color);
        return p;
    }

    /** Desenho vetorial do status (pintado com a cor da meta por setColorFilter). */
    public static int statusRes(String status) {
        if (WidgetModel.COMPLETED.equals(status)) return com.ziel.app.R.drawable.ic_status_done;
        if (WidgetModel.PARTIAL.equals(status)) return com.ziel.app.R.drawable.ic_status_partial;
        if (WidgetModel.NOT_DONE.equals(status)) return com.ziel.app.R.drawable.ic_status_notdone;
        return com.ziel.app.R.drawable.ic_status_pending;
    }

    /** Cor do círculo: não realizado é sempre vermelho; os demais usam a cor da meta. */
    public static int statusColor(String status, int goalColor) {
        return WidgetModel.NOT_DONE.equals(status) ? DANGER : goalColor;
    }

    /** Círculo de status (bitmap; mantido para testes/uso futuro): vazio = pendente · cheio com check = concluído · meio = parcial · X vermelho = não realizado. */
    public static Bitmap status(int size, String status, int color) {
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        float w = size * 0.09f;
        float pad = w / 2f + size * 0.02f;
        RectF r = new RectF(pad, pad, size - pad, size - pad);
        float cx = size / 2f;
        float cy = size / 2f;
        if (WidgetModel.COMPLETED.equals(status)) {
            c.drawOval(r, fill(color));
            Path check = new Path();
            check.moveTo(size * 0.29f, size * 0.52f);
            check.lineTo(size * 0.44f, size * 0.66f);
            check.lineTo(size * 0.72f, size * 0.36f);
            c.drawPath(check, stroke(INK, size * 0.1f));
        } else if (WidgetModel.PARTIAL.equals(status)) {
            c.drawOval(r, stroke(color, w));
            // metade preenchida (esquerda): "parcial"
            Path half = new Path();
            half.addArc(new RectF(pad + w, pad + w, size - pad - w, size - pad - w), 90, 180);
            half.close();
            c.drawPath(half, fill(color));
        } else if (WidgetModel.NOT_DONE.equals(status)) {
            c.drawOval(r, stroke(DANGER, w));
            float d = size * 0.17f;
            Paint x = stroke(DANGER, size * 0.09f);
            c.drawLine(cx - d, cy - d, cx + d, cy + d, x);
            c.drawLine(cx + d, cy - d, cx - d, cy + d, x);
        } else {
            c.drawOval(r, stroke(color, w));
        }
        return bmp;
    }

    /** Anel de progresso (metas que só agrupam): trilho + arco na cor da meta e o percentual no centro. */
    public static Bitmap progressRing(int size, double pct, int color) {
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        float w = size * 0.1f;
        float pad = w / 2f + size * 0.02f;
        RectF r = new RectF(pad, pad, size - pad, size - pad);
        c.drawOval(r, stroke(TRACK, w));
        float sweep = (float) (360.0 * Math.max(0, Math.min(1, pct)));
        if (sweep > 0) c.drawArc(r, -90, sweep, false, stroke(color, w));
        Paint t = new Paint(Paint.ANTI_ALIAS_FLAG);
        t.setColor(Color.parseColor("#F3F5FA"));
        t.setTextAlign(Paint.Align.CENTER);
        t.setFakeBoldText(true);
        t.setTextSize(size * 0.27f);
        c.drawText(Math.round(pct * 100) + "%", size / 2f, size / 2f + size * 0.095f, t);
        return bmp;
    }

    /** Círculo tracejado: não há ocorrência desta meta hoje. */
    public static Bitmap none(int size) {
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        float w = size * 0.07f;
        Paint p = stroke(Color.argb(90, 200, 206, 221), w);
        p.setPathEffect(new android.graphics.DashPathEffect(new float[] { size * 0.1f, size * 0.09f }, 0));
        float pad = w / 2f + size * 0.04f;
        c.drawOval(new RectF(pad, pad, size - pad, size - pad), p);
        return bmp;
    }

    /** Azulejo da meta: imagem gerada pelo app (cor + ícone) ou, se faltar, um quadrado arredondado na cor da meta. */
    public static Bitmap tile(File imageFile, int size, int color) {
        if (imageFile != null && imageFile.exists()) {
            Bitmap src = BitmapFactory.decodeFile(imageFile.getAbsolutePath());
            if (src != null) {
                if (src.getWidth() == size) return src;
                Bitmap scaled = Bitmap.createScaledBitmap(src, size, size, true);
                if (scaled != src) src.recycle();
                return scaled;
            }
        }
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        c.drawRoundRect(new RectF(0, 0, size, size), size * 0.28f, size * 0.28f, fill(color));
        return bmp;
    }
}
