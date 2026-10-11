package jp.nyanchase.game;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;
import android.content.pm.ApplicationInfo;
import android.util.Log;

@CapacitorPlugin(name = "NyanReview")
public class NyanReviewPlugin extends Plugin {
    @PluginMethod
    public void getEnvironment(PluginCall call) {
        JSObject result = new JSObject();
        result.put("debug", isDebuggable());
        call.resolve(result);
    }

    private boolean isDebuggable() {
        return (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    @PluginMethod
    public void requestReview(PluginCall call) {
        if (isDebuggable()) Log.d("NyanReview", "requestReview called");
        ReviewManager manager = ReviewManagerFactory.create(getActivity());
        manager.requestReviewFlow().addOnCompleteListener(request -> {
            if (!request.isSuccessful()) {
                if (isDebuggable()) Log.d("NyanReview", "requestReview failed");
                call.reject("REVIEW_REQUEST_FAILED");
                return;
            }
            // The OS may not display a sheet; advancing our stage depends on the
            // launch request, never on whether the user sees or submits a review.
            manager.launchReviewFlow(getActivity(), request.getResult());
            if (isDebuggable()) Log.d("NyanReview", "requestReview launched");
            call.resolve();
        });
    }
}
