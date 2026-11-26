package com.ziel.app.widget;

import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import com.ziel.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

/** Fornece as linhas do widget do dia (lidas do retrato local: funciona offline e com o app fechado). */
public class DayWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext());
    }

    static final class Factory implements RemoteViewsFactory {
        private static final int COLOR_TEXT = 0xFFF3F5FA;
        private static final int COLOR_MUTED = 0xFFA9B2C8;
        private static final int COLOR_DONE = 0xFF8D98B0;

        private final Context ctx;
        private JSONArray items = new JSONArray();

        Factory(Context c) {
            this.ctx = c;
        }

        @Override
        public void onCreate() {
            load();
        }

        @Override
        public void onDataSetChanged() {
            load();
        }

        private void load() {
            JSONObject day = WidgetModel.day(WidgetStore.get(ctx).loadSnapshot(), WidgetActions.today());
            JSONArray arr = day == null ? null : day.optJSONArray("items");
            items = arr == null ? new JSONArray() : arr;
        }

        @Override
        public void onDestroy() {}

        @Override
        public int getCount() {
            return items.length();
        }

        @Override
        public RemoteViews getViewAt(int position) {
            JSONObject it = items.optJSONObject(position);
            if (it == null) return new RemoteViews(ctx.getPackageName(), R.layout.widget_day_group);
            boolean markable = "o".equals(it.optString("k"));
            int depth = Math.min(3, it.optInt("d", 0));
            float dens = ctx.getResources().getDisplayMetrics().density;
            int color = StatusBitmaps.parse(it.optString("c"), 0xFFF28B82);
            WidgetStore store = WidgetStore.get(ctx);

            RemoteViews row = new RemoteViews(ctx.getPackageName(), markable ? R.layout.widget_day_row : R.layout.widget_day_group);
            row.setViewPadding(R.id.row_root, Math.round((2 + depth * 12) * dens), 0, 0, 0);
            row.setTextViewText(R.id.row_name, it.optString("n"));

            Intent openFill = new Intent().putExtra("goalId", it.optString("id")).putExtra("mode", markable ? "choose" : "open");
            row.setOnClickFillInIntent(R.id.row_body, openFill);

            if (!markable) {
                int pct = (int) Math.round(it.optDouble("p", 0) * 100);
                row.setTextViewText(R.id.row_sub, pct + "%");
                row.setTextColor(R.id.row_name, COLOR_MUTED);
                row.setTextColor(R.id.row_sub, StatusBitmaps.parse(it.optString("c"), COLOR_MUTED));
                return row;
            }

            String status = it.optString("s", WidgetModel.PENDING);
            boolean done = WidgetModel.COMPLETED.equals(status);
            int tileSize = Math.round(30 * dens);
            row.setImageViewBitmap(R.id.row_tile, StatusBitmaps.tile(store.iconFile(it.optString("ic")), tileSize, color));
            row.setTextColor(R.id.row_name, done ? COLOR_DONE : COLOR_TEXT);

            JSONObject q = it.optJSONObject("q");
            String sub = WidgetModel.PENDING.equals(status) ? "" : WidgetModel.label(status);
            if (q != null) {
                double v = q.isNull("v") ? 0 : q.optDouble("v", 0);
                String qs = (v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(v)) + "/" + (long) q.optDouble("t", 0) + " " + q.optString("u", "");
                sub = sub.isEmpty() ? qs : qs + " · " + sub;
            }
            row.setTextViewText(R.id.row_sub, sub);
            row.setViewVisibility(R.id.row_sub, sub.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
            row.setTextColor(R.id.row_sub, COLOR_MUTED);

            row.setImageViewResource(R.id.row_circle, StatusBitmaps.statusRes(status));
            row.setInt(R.id.row_circle, "setColorFilter", StatusBitmaps.statusColor(status, color));
            row.setOnClickFillInIntent(R.id.row_circle, new Intent().putExtra("goalId", it.optString("id")).putExtra("mode", "toggle"));
            return row;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 2;
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }
    }
}
