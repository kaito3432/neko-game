package jp.nyanchase.game;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(NyanGooglePlayPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
