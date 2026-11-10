package com.ziel.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ZielUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        configureWebViewScale();
    }

    /**
     * Comportamento de app nativo: sem zoom por pinça/duplo toque e sem controles de zoom.
     * A acessibilidade é preservada: o WebView continua seguindo o tamanho de fonte escolhido no sistema
     * (textZoom não é fixado), então quem usa fonte grande continua lendo em tamanho confortável.
     */
    private void configureWebViewScale() {
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        WebSettings settings = webView.getSettings();
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
    }
}
