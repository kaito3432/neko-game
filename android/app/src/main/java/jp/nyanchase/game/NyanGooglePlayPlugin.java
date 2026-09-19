package jp.nyanchase.game;

import android.app.Activity;
import com.android.billingclient.api.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.*;

@CapacitorPlugin(name = "NyanGooglePlay")
public class NyanGooglePlayPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billingClient;
    private final Map<String, ProductDetails> products = new HashMap<>();
    private PluginCall pendingPurchase;

    @Override public void load() {
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    private void ready(PluginCall call, Runnable action) {
        if (billingClient.isReady()) { action.run(); return; }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) action.run();
                else call.reject("billing_unavailable", String.valueOf(result.getResponseCode()));
            }
            @Override public void onBillingServiceDisconnected() { }
        });
    }

    @PluginMethod public void loadProducts(PluginCall call) {
        JSArray ids = call.getArray("productIds", new JSArray());
        List<QueryProductDetailsParams.Product> requested = new ArrayList<>();
        for (Object value : ids.toList()) requested.add(QueryProductDetailsParams.Product.newBuilder()
            .setProductId(String.valueOf(value)).setProductType(BillingClient.ProductType.INAPP).build());
        ready(call, () -> billingClient.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(requested).build(), (result, detailsResult) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject("product_query_failed", String.valueOf(result.getResponseCode())); return; }
            JSArray list = new JSArray(); products.clear();
            for (ProductDetails detail : detailsResult.getProductDetailsList()) {
                products.put(detail.getProductId(), detail);
                ProductDetails.OneTimePurchaseOfferDetails offer = detail.getOneTimePurchaseOfferDetails();
                JSObject item = new JSObject(); item.put("productId", detail.getProductId()); item.put("displayName", detail.getName());
                item.put("description", detail.getDescription()); item.put("displayPrice", offer == null ? "" : offer.getFormattedPrice()); item.put("productType", "nonConsumable"); list.put(item);
            }
            JSObject response = new JSObject(); response.put("products", list); call.resolve(response);
        }));
    }

    @PluginMethod public void purchase(PluginCall call) {
        String id = call.getString("productId", ""), account = call.getString("obfuscatedAccountId", "");
        if (pendingPurchase != null) { call.reject("purchase_busy"); return; }
        ProductDetails detail = products.get(id); if (detail == null) { call.reject("product_not_loaded"); return; }
        BillingFlowParams.ProductDetailsParams.Builder product = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(detail);
        ProductDetails.OneTimePurchaseOfferDetails offer = detail.getOneTimePurchaseOfferDetails();
        if (offer != null && offer.getOfferToken() != null && !offer.getOfferToken().isEmpty()) product.setOfferToken(offer.getOfferToken());
        BillingFlowParams.Builder flow = BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(product.build()));
        if (!account.isEmpty()) flow.setObfuscatedAccountId(account);
        pendingPurchase = call;
        BillingResult result = billingClient.launchBillingFlow(getActivity(), flow.build());
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { pendingPurchase = null; call.reject("purchase_launch_failed", String.valueOf(result.getResponseCode())); }
    }

    @Override public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        PluginCall call = pendingPurchase; pendingPurchase = null; if (call == null) return;
        if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) { JSObject value=new JSObject();value.put("status","cancelled");call.resolve(value);return; }
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) { call.reject("purchase_failed", String.valueOf(result.getResponseCode())); return; }
        call.resolve(purchaseValue(purchases.get(0)));
    }

    private JSObject purchaseValue(Purchase purchase) {
        JSObject value=new JSObject(); value.put("status", purchase.getPurchaseState()==Purchase.PurchaseState.PENDING?"pending":"purchased");
        value.put("purchaseToken", purchase.getPurchaseToken()); value.put("orderId", purchase.getOrderId()); value.put("purchaseTime", purchase.getPurchaseTime()); value.put("acknowledged", purchase.isAcknowledged());
        value.put("productId", purchase.getProducts().isEmpty()?"":purchase.getProducts().get(0));
        if (purchase.getAccountIdentifiers()!=null) value.put("obfuscatedAccountId", purchase.getAccountIdentifiers().getObfuscatedAccountId());
        return value;
    }

    @PluginMethod public void restorePurchases(PluginCall call) {
        ready(call, () -> billingClient.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (result, purchases) -> {
            if (result.getResponseCode()!=BillingClient.BillingResponseCode.OK){call.reject("restore_failed",String.valueOf(result.getResponseCode()));return;}
            JSArray list=new JSArray();for(Purchase purchase:purchases)if(purchase.getPurchaseState()==Purchase.PurchaseState.PURCHASED)list.put(purchaseValue(purchase));
            JSObject value=new JSObject();value.put("purchases",list);call.resolve(value);
        }));
    }

    @PluginMethod public void acknowledgePurchase(PluginCall call) {
        String token=call.getString("purchaseToken","");
        billingClient.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build(), result->{
            if(result.getResponseCode()==BillingClient.BillingResponseCode.OK)call.resolve();else call.reject("acknowledge_failed",String.valueOf(result.getResponseCode()));
        });
    }
}
