(function(root,factory){
  const products=typeof module==="object" && module.exports
    ? require("./monetization-products.js")
    : root.NyanMonetizationProducts;
  const skills=typeof module==="object" && module.exports
    ? require("./skill-catalog.js")
    : root.NyanSkillCatalog;
  const api=factory(root,products,skills);
  if(typeof module==="object" && module.exports) module.exports=api;
  if(root) root.NyanMonetization=api;
})(typeof globalThis!=="undefined" ? globalThis : this,(root,Products,Skills)=>{
  "use strict";

  const VERSION=2;
  const STORAGE_KEY="nyanChaseMonetizationV1";

  function defaultState(){
    return {
      version:VERSION,
      adsRemoved:false,
      purchasedProductIds:[],
      skillModeUnlocked:false,
      skillModeUnlockAdViews:0,
      ownedSkillIds:[...Skills.FREE_SKILL_IDS],
      ownedSkillPackIds:[],
      rewardedAdAvailable:true,
      lastRewardedAdAt:null
    };
  }

  function normalizeState(value){
    const source=value && typeof value==="object" && !Array.isArray(value) ? value : {};
    const purchased=Array.isArray(source.purchasedProductIds)
      ? [...new Set(source.purchasedProductIds.filter(Products.isKnownProductId))]
      : [];
    const grantedPackIds=purchased.flatMap(productId=>{
      const packId=Products.PRODUCTS[productId]?.grants?.skillPackId;
      return Skills.isKnownSkillPackId(packId)?[packId]:[];
    });
    const storedPackIds=Array.isArray(source.ownedSkillPackIds)?source.ownedSkillPackIds.filter(Skills.isKnownSkillPackId):[];
    const ownedSkillPackIds=[...new Set([...storedPackIds,...grantedPackIds])];
    const directlyGranted=purchased.flatMap(productId=>{
      const skillId=Products.PRODUCTS[productId]?.grants?.skillId;
      return Skills.isKnownSkillId(skillId)?[skillId]:[];
    });
    const packGranted=ownedSkillPackIds.flatMap(packId=>Skills.SKILL_PACKS[packId].skillIds);
    const storedSkillIds=Array.isArray(source.ownedSkillIds)?source.ownedSkillIds.filter(Skills.isKnownSkillId):[];
    const ownedSkillIds=[...new Set([...Skills.FREE_SKILL_IDS,...storedSkillIds,...directlyGranted,...packGranted])];
    const adsRemoved=source.adsRemoved===true || purchased.some(productId=>Products.PRODUCTS[productId]?.grants?.adsRemoved===true);
    const rawAdViews=Number(source.skillModeUnlockAdViews);
    const skillModeUnlockAdViews=Number.isSafeInteger(rawAdViews)?Math.max(0,Math.min(3,rawAdViews)):0;
    const skillModeUnlocked=source.skillModeUnlocked===true || skillModeUnlockAdViews>=3;
    const timestamp=Number(source.lastRewardedAdAt);
    return {
      version:VERSION,
      adsRemoved,
      purchasedProductIds:purchased,
      skillModeUnlocked,
      skillModeUnlockAdViews,
      ownedSkillIds,
      ownedSkillPackIds,
      rewardedAdAvailable:source.rewardedAdAvailable!==false,
      lastRewardedAdAt:Number.isSafeInteger(timestamp) && timestamp>=0 ? timestamp : null
    };
  }

  function createStorageAdapter(storage){
    return {
      read(){
        if(!storage) return null;
        try{return JSON.parse(storage.getItem(STORAGE_KEY)||"null");}catch(_){return null;}
      },
      write(value){
        if(!storage) return;
        try{storage.setItem(STORAGE_KEY,JSON.stringify(value));}catch(_){}
      }
    };
  }

  function createManager({storage=null,provider=null,now=()=>Date.now(),logger=console}={}){
    const adapter=createStorageAdapter(storage);
    let state=normalizeState(adapter.read());
    let storeProvider=provider;

    function snapshot(){return normalizeState(state);}
    function persist(next){state=normalizeState(next);adapter.write(state);return snapshot();}
    function setProvider(nextProvider){storeProvider=nextProvider||null;}
    function hasRemovedAds(){return state.adsRemoved;}
    function canShowAds(){return !hasRemovedAds();}
    function isProductPurchased(productId){return Products.isKnownProductId(productId) && state.purchasedProductIds.includes(productId);}
    function isSkillModeUnlocked(){return state.skillModeUnlocked;}
    function getSkillModeUnlockAdViewCount(){return state.skillModeUnlockAdViews;}
    function syncServerSkillModeEntitlement(value={}){
      const views=Number.isSafeInteger(Number(value.skillModeUnlockAdViews))?Math.max(0,Math.min(3,Number(value.skillModeUnlockAdViews))):0;
      return persist({...state,skillModeUnlockAdViews:views,skillModeUnlocked:value.skillModeUnlocked===true||views>=3});
    }
    function syncServerPurchaseEntitlements(value={}){return applyAuthoritativePurchases(value.purchasedProductIds||[]);}
    function recordSkillModeUnlockAdView(){
      if(state.skillModeUnlocked) return snapshot();
      const views=Math.min(3,state.skillModeUnlockAdViews+1);
      return persist({...state,skillModeUnlockAdViews:views,skillModeUnlocked:views>=3});
    }
    function isSkillOwned(skillId){return Skills.isKnownSkillId(skillId) && state.ownedSkillIds.includes(skillId);}
    function getOwnedSkillIds(){return [...state.ownedSkillIds];}
    function isSkillPackOwned(packId){return Skills.isKnownSkillPackId(packId) && state.ownedSkillPackIds.includes(packId);}
    function getSkillPackOwnershipStatus(packId){
      const pack=Skills.SKILL_PACKS[packId];
      if(!pack) return null;
      const ownedSkillIds=pack.skillIds.filter(isSkillOwned);
      const missingSkillIds=pack.skillIds.filter(skillId=>!isSkillOwned(skillId));
      return {packId,ownedSkillIds,missingSkillIds,ownedCount:ownedSkillIds.length,missingCount:missingSkillIds.length,
        eligibleForDiscount:ownedSkillIds.length>0 && missingSkillIds.length>0};
    }
    function canEquipSkill(role,skillId){return isSkillModeUnlocked() && Skills.SKILLS[skillId]?.role===role && isSkillOwned(skillId);}
    function getAvailableSkillsForRole(role){return Object.values(Skills.SKILLS).filter(skill=>canEquipSkill(role,skill.id)).map(skill=>skill.id);}
    function selectSkillForMatch(selection,role,skillId){
      if(!canEquipSkill(role,skillId)) return {selected:false,reason:"notEntitled",selection:{...(selection||{})}};
      return {selected:true,selection:{...(selection||{}),[role]:skillId}};
    }

    function applyAuthoritativePurchases(productIds){
      const verified=[...new Set((Array.isArray(productIds)?productIds:[]).filter(Products.isKnownProductId))];
      return persist({...state,purchasedProductIds:verified,adsRemoved:false,ownedSkillIds:[...Skills.FREE_SKILL_IDS],ownedSkillPackIds:[]});
    }

    async function showInterstitialAd(){
      if(!canShowAds()) return {shown:false,reason:"adsRemoved"};
      if(storeProvider?.showInterstitialAd) return storeProvider.showInterstitialAd();
      logger?.info?.("[Monetization mock] interstitial ad shown");
      return {shown:true,mocked:true};
    }

    async function showRewardedAd({reward=null,onReward=null}={}){
      if(!state.rewardedAdAvailable) return {shown:false,rewarded:false,reason:"unavailable"};
      const result=storeProvider?.showRewardedAd
        ? await storeProvider.showRewardedAd()
        : {shown:true,rewarded:true,mocked:true};
      if(!result?.rewarded) return {...result,rewarded:false};
      persist({...state,lastRewardedAdAt:now()});
      if(typeof onReward==="function") await onReward(reward);
      logger?.info?.("[Monetization mock] rewarded ad completed");
      return {...result,rewarded:true,reward};
    }

    async function purchaseProduct(productId){
      if(!Products.isKnownProductId(productId)) return {purchased:false,reason:"unknownProduct"};
      const result=storeProvider?.purchaseProduct
        ? await storeProvider.purchaseProduct(productId)
        : {purchased:true,productId,mocked:true};
      if(!result?.purchased) return {...result,purchased:false};
      persist({...state,purchasedProductIds:[...state.purchasedProductIds,productId]});
      return {...result,purchased:true,productId};
    }

    async function restorePurchases(){
      if(storeProvider?.restorePurchases){
        const result=await storeProvider.restorePurchases();
        const restored=applyAuthoritativePurchases(result?.purchasedProductIds);
        return {restored:true,purchasedProductIds:restored.purchasedProductIds,authoritative:true};
      }
      const restored=snapshot();
      return {restored:true,purchasedProductIds:restored.purchasedProductIds,mocked:true};
    }

    async function purchaseSkillMock(skillId){
      const skill=Skills.SKILLS[skillId];
      if(!skill) return {purchased:false,reason:"unknownSkill"};
      if(skill.free) return {purchased:true,skillId,alreadyOwned:true,mocked:true};
      const result=await purchaseProduct(skill.purchaseProductId);
      return {...result,skillId};
    }

    async function purchaseSkillPackMock(packId){
      const pack=Skills.SKILL_PACKS[packId];
      if(!pack) return {purchased:false,reason:"unknownSkillPack"};
      const result=await purchaseProduct(pack.purchaseProductId);
      return {...result,packId};
    }

    function setRewardedAdAvailable(available){
      return persist({...state,rewardedAdAvailable:available===true});
    }

    return Object.freeze({
      load:snapshot,getState:snapshot,setProvider,
      canShowAds,hasRemovedAds,isProductPurchased,showInterstitialAd,showRewardedAd,
      purchaseProduct,restorePurchases,setRewardedAdAvailable,
      isSkillModeUnlocked,getSkillModeUnlockAdViewCount,recordSkillModeUnlockAdView,
      syncServerSkillModeEntitlement,
      syncServerPurchaseEntitlements,
      isSkillOwned,getOwnedSkillIds,isSkillPackOwned,getSkillPackOwnershipStatus,
      purchaseSkillMock,purchaseSkillPackMock,canEquipSkill,getAvailableSkillsForRole,selectSkillForMatch
    });
  }

  let browserStorage=null;
  try{browserStorage=root?.localStorage||null;}catch(_){browserStorage=null;}
  const manager=createManager({storage:browserStorage});

  return Object.freeze({VERSION,STORAGE_KEY,defaultState,normalizeState,createStorageAdapter,createManager,...manager});
});
