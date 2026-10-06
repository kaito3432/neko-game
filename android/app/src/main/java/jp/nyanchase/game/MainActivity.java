package jp.nyanchase.game;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(NyanGooglePlayPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onBackPressed() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            super.onBackPressed();
            return;
        }
        getBridge().getWebView().evaluateJavascript(
            "Boolean(window.NyanLegalPages && window.NyanLegalPages.closeIfOpen && window.NyanLegalPages.closeIfOpen())",
            handled -> { if (!"true".equals(handled)) MainActivity.super.onBackPressed(); }
        );
    }
}
