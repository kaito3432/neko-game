(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.NyanPassUIState=api;
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  // Phase 5 display fixture only. Phase 6 replaces this one source with the
  // platform Store's localized price; it never authorizes a purchase.
  const PRICE_DISPLAY=Object.freeze({preview:'月額500円予定',source:'phase5-fixture'});
  function fromServer(summary,catalog,storeProduct=null){
    if(!summary||typeof summary!=='object')return null;
    const active=summary.active===true,expired=summary.expired===true;
    const category=summary.currentSkinCategory,id=summary.currentSkinId;
    const item=(category==='catSkin'||category==='dogSkin')&&typeof id==='string'
      ?catalog?.getItem?.(category,id):null;
    const maxLoginCount=Math.max(0,Number(summary.maxLoginRewardCount)||0);
    const loginCount=Math.max(0,Math.min(maxLoginCount,Number(summary.loginRewardCount)||0));
    const productId=typeof summary.productId==='string'?summary.productId:null;
    const subscriptionGroupId=typeof summary.subscriptionGroupId==='string'?summary.subscriptionGroupId:null;
    const validProduct=storeProduct?.productId===productId&&storeProduct?.subscriptionGroupId===subscriptionGroupId&&
      storeProduct?.subscriptionPeriod?.unit==='month'&&storeProduct?.subscriptionPeriod?.value===1&&
      typeof storeProduct?.displayPrice==='string'&&Boolean(storeProduct.displayPrice);
    return {active,expired,expiresAt:Number.isSafeInteger(summary.expiresAt)?summary.expiresAt:null,
      autoRenew:summary.autoRenew===true,periodId:summary.periodId||null,
      productId,subscriptionGroupId,canPurchase:Boolean(validProduct),
      currentMonthKey:summary.currentMonthKey||null,
      currentSkinPreview:summary.currentSkinPreview===true,
      currentSkin:item?{name:item.name,image:item.collectionImage||item.preview||null,
        description:item.passPreviewDescription||'今月だけ出会える、Pass限定の特別なスキン。'}:null,
      skinOwned:Boolean(item&&summary.currentSkinOwned===true),
      eligibleSkillCount:Math.max(0,Number(summary.eligibleSkillCount)||0),
      loginCount,maxLoginCount,
      nextLoginReward:active&&loginCount<maxLoginCount?Number(summary.nextLoginStaminaReward)||null:null,
      giftCount:Math.max(0,Number(summary.unclaimedPassGiftCount)||0),
      giftBadgeCount:Math.max(0,Number(summary.giftBadgeCount)||0),
      price:validProduct?{text:`${storeProduct.displayPrice} / 月`,source:'app-store',currencyCode:storeProduct.currencyCode||null}:
        productId?{text:'価格を取得できませんでした',source:'unavailable'}:
          {text:PRICE_DISPLAY.preview,source:PRICE_DISPLAY.source}};
  }
  return Object.freeze({fromServer,PRICE_DISPLAY});
});
