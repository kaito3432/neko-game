package jp.nyanchase.game;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AgeRestrictedTreatment;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;

@CapacitorPlugin(name = "NyanAdPrivacy")
public class NyanAdPrivacyPlugin extends Plugin {
    // Safe before SDK initialization. Unknown age does not assert adulthood.
    static void applyRequestConfiguration() {
        MobileAds.setRequestConfiguration(MobileAds.getRequestConfiguration().toBuilder()
            .setAgeRestrictedTreatment(AgeRestrictedTreatment.UNSPECIFIED)
            .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G)
            .build());
    }

    @PluginMethod
    public void configureAdvertising(PluginCall call) {
        if (!"UNSPECIFIED".equals(call.getString("ageRestrictedTreatment")) ||
            !"G".equals(call.getString("maxAdContentRating"))) {
            call.reject("unsupported_android_ad_policy");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                // Reapply after the community plugin initializes its configuration.
                applyRequestConfiguration();
                if (!MobileAds.putPublisherFirstPartyIdEnabled(false)) {
                    call.reject("publisher_first_party_id_disable_failed");
                    return;
                }
                RequestConfiguration current = MobileAds.getRequestConfiguration();
                JSObject result = new JSObject();
                result.put("ageRestrictedTreatment", current.getAgeRestrictedTreatment().name());
                result.put("maxAdContentRating", current.getMaxAdContentRating());
                call.resolve(result);
            } catch (Exception error) {
                call.reject("android_ad_policy_failed", error);
            }
        });
    }
}
