const test=require('node:test');
const assert=require('node:assert/strict');
const Products=require('../monetization-products.js');
const Monetization=require('../monetization.js');

function storage(initial={}){
  const values=new Map(Object.entries(initial));
  return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),values};
}
function manager(options={}){
  return Monetization.createManager({storage:options.storage||storage(),provider:options.provider,now:options.now||(()=>1234),logger:{info(){}}});
}

test('adsRemovedを保存・復元する',async()=>{
  const store=storage();
  const first=manager({storage:store});
  await first.purchaseProduct(Products.PRODUCT_IDS.REMOVE_ADS);
  const restored=manager({storage:store});
  assert.equal(restored.hasRemovedAds(),true);
  assert.equal(restored.canShowAds(),false);
});

test('商品購入状態を重複なしで保存する',async()=>{
  const store=storage(),api=manager({storage:store});
  await api.purchaseProduct(Products.PRODUCT_IDS.SKIN_PACK_01);
  await api.purchaseProduct(Products.PRODUCT_IDS.SKIN_PACK_01);
  assert.equal(api.isProductPurchased(Products.PRODUCT_IDS.SKIN_PACK_01),true);
  assert.deepEqual(api.getState().purchasedProductIds,[Products.PRODUCT_IDS.SKIN_PACK_01]);
  assert.equal((await api.purchaseProduct('UNKNOWN')).reason,'unknownProduct');
});

test('restorePurchasesモックは現在の購入状態を維持する',async()=>{
  const api=manager();
  await api.purchaseProduct(Products.PRODUCT_IDS.SKIN_PACK_02);
  const result=await api.restorePurchases();
  assert.equal(result.mocked,true);
  assert.deepEqual(result.purchasedProductIds,[Products.PRODUCT_IDS.SKIN_PACK_02]);
});

test('将来のStore復元結果はローカル購入状態を正として上書きする',async()=>{
  const api=manager({provider:{restorePurchases:async()=>({purchasedProductIds:[Products.PRODUCT_IDS.REMOVE_ADS]})}});
  await api.purchaseProduct(Products.PRODUCT_IDS.SKIN_PACK_01);
  const result=await api.restorePurchases();
  assert.equal(result.authoritative,true);
  assert.deepEqual(api.getState().purchasedProductIds,[Products.PRODUCT_IDS.REMOVE_ADS]);
  assert.equal(api.hasRemovedAds(),true);
});

test('rewardedAd成功時に報酬を1回付与し日時を保存する',async()=>{
  let calls=0,received=null;
  const api=manager({now:()=>9876});
  const reward={type:'testReward'};
  const result=await api.showRewardedAd({reward,onReward:value=>{calls++;received=value;}});
  assert.equal(result.rewarded,true);
  assert.equal(calls,1);
  assert.equal(received,reward);
  assert.equal(api.getState().lastRewardedAdAt,9876);
});

test('広告削除時はインタースティシャルAPIを抑止する',async()=>{
  let providerCalls=0;
  const api=manager({provider:{showInterstitialAd:async()=>{providerCalls++;return {shown:true};}}});
  await api.purchaseProduct(Products.PRODUCT_IDS.REMOVE_ADS);
  const result=await api.showInterstitialAd();
  assert.deepEqual(result,{shown:false,reason:'adsRemoved'});
  assert.equal(providerCalls,0);
});

test('オンラインプロフィールのサーバー広告進捗をクライアント表示へ同期',()=>{
  const api=manager();api.recordSkillModeUnlockAdView();api.recordSkillModeUnlockAdView();api.recordSkillModeUnlockAdView();
  api.syncServerSkillModeEntitlement({skillModeUnlockAdViews:1,skillModeUnlocked:false});
  assert.equal(api.getSkillModeUnlockAdViewCount(),1);assert.equal(api.isSkillModeUnlocked(),false);
  api.syncServerSkillModeEntitlement({skillModeUnlockAdViews:3,skillModeUnlocked:true});
  assert.equal(api.getSkillModeUnlockAdViewCount(),3);assert.equal(api.isSkillModeUnlocked(),true);
});
