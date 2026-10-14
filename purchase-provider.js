(function(root){
  'use strict';
  const platform=root.Capacitor?.getPlatform?.()||'web';
  const selected=platform==='android'?root.NyanGooglePlay:root.NyanStoreKit;
  if(!selected)return;
  // UI consumes one provider contract; native billing remains platform-specific.
  const provider=Object.freeze({...selected.provider,async purchaseProduct(productId){
    if(productId==='SKILL_PACK_01'){
      const reason=root.NyanStoreUIModel?.packPurchaseReason(root.NyanMonetization)||
        (!root.NyanStoreUIModel?'ownershipUnavailable':null);
      if(reason)return {purchased:false,reason};
    }
    return selected.provider.purchaseProduct(productId);
  }});
  root.NyanPurchases=Object.freeze({platform,PRODUCT_IDS:selected.PRODUCT_IDS,nativePlugin:selected.nativePlugin,provider});
})(typeof globalThis!=='undefined'?globalThis:this);
