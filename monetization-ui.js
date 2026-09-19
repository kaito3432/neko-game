(function(root){
  "use strict";
  if(!root?.document || !root.NyanMonetization || !root.NyanMonetizationProducts || !root.NyanSkillCatalog) return;
  const params=new URLSearchParams(root.location.search);
  if(params.get("monetizationDev")!=="1") return;

  const panel=document.getElementById("monetizationDevPanel");
  const ads=document.getElementById("monetizationAdsState");
  const purchases=document.getElementById("monetizationPurchasedProducts");
  const reward=document.getElementById("monetizationRewardState");
  const skillMode=document.getElementById("monetizationSkillModeState");
  const ownedSkills=document.getElementById("monetizationOwnedSkills");
  const skillPack=document.getElementById("monetizationSkillPackState");
  const purchaseButton=document.getElementById("monetizationPurchaseRemoveAds");
  const rewardButton=document.getElementById("monetizationRewardTest");
  const unlockAdButton=document.getElementById("monetizationSkillUnlockAdTest");
  const fakePawButton=document.getElementById("monetizationPurchaseFakePaw");
  const groupSearchButton=document.getElementById("monetizationPurchaseGroupSearch");
  const dashButton=document.getElementById("monetizationPurchaseDash");
  const skillPackButton=document.getElementById("monetizationPurchaseSkillPack01");
  const restoreButton=document.getElementById("monetizationRestoreTest");
  if(!panel) return;

  function render(message=""){
    const state=root.NyanMonetization.getState();
    panel.hidden=false;
    ads.textContent=state.adsRemoved?"削除済み":"広告あり";
    purchases.textContent=state.purchasedProductIds.length?state.purchasedProductIds.join(", "):"なし";
    reward.textContent=message || (state.lastRewardedAdAt?new Date(state.lastRewardedAdAt).toLocaleString():"未実行");
    skillMode.textContent=state.skillModeUnlocked?"永久解放済み":`未解放 ${state.skillModeUnlockAdViews}/3`;
    ownedSkills.textContent=state.ownedSkillIds.join(", ");
    const status=root.NyanMonetization.getSkillPackOwnershipStatus(root.NyanSkillCatalog.SKILL_PACK_IDS.SKILL_PACK_01);
    skillPack.textContent=root.NyanMonetization.isSkillPackOwned(status.packId)
      ?"所有済み":`所有 ${status.ownedCount} / 未所有 ${status.missingCount}`;
  }

  purchaseButton?.addEventListener("click",async()=>{
    await root.NyanMonetization.purchaseProduct(root.NyanMonetizationProducts.PRODUCT_IDS.REMOVE_ADS);
    render("広告削除をモック購入しました");
  });
  rewardButton?.addEventListener("click",async()=>{
    const result=await root.NyanMonetization.showRewardedAd({reward:{type:"developmentTest"}});
    render(result.rewarded?"モック報酬成功":"モック報酬失敗");
  });
  unlockAdButton?.addEventListener("click",async()=>{
    const result=await root.NyanMonetization.showRewardedAd({reward:{type:"skillModeUnlockView"}});
    if(result.rewarded) root.NyanMonetization.recordSkillModeUnlockAdView();
    render(result.rewarded?"スキル解放広告を視聴しました":"広告を完了できませんでした");
  });
  fakePawButton?.addEventListener("click",async()=>{
    await root.NyanMonetization.purchaseSkillMock(root.NyanSkillCatalog.SKILL_IDS.CAT_FAKE_PAW);render("フェイク肉球をモック購入しました");
  });
  groupSearchButton?.addEventListener("click",async()=>{
    await root.NyanMonetization.purchaseSkillMock(root.NyanSkillCatalog.SKILL_IDS.POLICE_GROUP_SEARCH);render("一斉捜索をモック購入しました");
  });
  dashButton?.addEventListener("click",async()=>{
    await root.NyanMonetization.purchaseSkillMock(root.NyanSkillCatalog.SKILL_IDS.POLICE_DASH);render("ダッシュをモック購入しました");
  });
  skillPackButton?.addEventListener("click",async()=>{
    await root.NyanMonetization.purchaseSkillPackMock(root.NyanSkillCatalog.SKILL_PACK_IDS.SKILL_PACK_01);render("SKILL PACK 01をモック購入しました");
  });
  restoreButton?.addEventListener("click",async()=>{
    await root.NyanMonetization.restorePurchases();
    render("モック復元完了");
  });
  render();
})(typeof globalThis!=="undefined" ? globalThis : this);
