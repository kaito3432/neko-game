(function(root){
  'use strict';
  const platform=root.Capacitor?.getPlatform?.()||'web';
  const selected=platform==='android'?root.NyanGooglePlay:root.NyanStoreKit;
  if(!selected)return;
  // UI consumes one provider contract; native billing remains platform-specific.
  root.NyanPurchases=Object.freeze({platform,PRODUCT_IDS:selected.PRODUCT_IDS,nativePlugin:selected.nativePlugin,provider:selected.provider});
})(typeof globalThis!=='undefined'?globalThis:this);
