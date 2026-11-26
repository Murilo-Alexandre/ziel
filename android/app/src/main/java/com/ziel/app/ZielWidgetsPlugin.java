package com.ziel.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.ziel.app.widget.WidgetStore;
import com.ziel.app.widget.WidgetUpdater;

import org.json.JSONObject;

/** Ponte entre o app (WebView) e os widgets: entrega o retrato dos dados e recebe as marcações feitas nos widgets. */
@CapacitorPlugin(name = "ZielWidgets")
public class ZielWidgetsPlugin extends Plugin {

    @PluginMethod
    public void saveSnapshot(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json ausente");
            return;
        }
        try {
            WidgetStore store = WidgetStore.get(getContext());
            JSObject icons = call.getObject("icons");
            if (icons != null) store.saveIcons(icons);
            store.saveSnapshotFromApp(json);
            WidgetUpdater.updateAll(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("Falha ao salvar o retrato dos widgets: " + e.getMessage());
        }
    }

    @PluginMethod
    public void ackPending(PluginCall call) {
        Long upTo = call.getLong("upTo");
        if (upTo == null) {
            call.reject("upTo ausente");
            return;
        }
        WidgetStore.get(getContext()).ackPending(upTo);
        call.resolve();
    }

    @PluginMethod
    public void drainPending(PluginCall call) {
        try {
            JSArray actions = new JSArray();
            org.json.JSONArray pending = WidgetStore.get(getContext()).readPending();
            for (int i = 0; i < pending.length(); i++) {
                JSONObject o = pending.optJSONObject(i);
                if (o != null) actions.put(o);
            }
            JSObject ret = new JSObject();
            ret.put("actions", actions);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Falha ao ler as marcações dos widgets: " + e.getMessage());
        }
    }
}
