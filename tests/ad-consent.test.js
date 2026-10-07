const test=require('node:test');
const assert=require('node:assert/strict');
const {createManager,STATES}=require('../ad-consent.js');
const Ads=require('../rewarded-ad-provider.js');

test('UMPが不要なら広告を許可する',async()=>{
  const manager=createManager();
  const value=await manager.ensure({requestConsentInfo:async()=>({status:'NOT_REQUIRED',canRequestAds:true})});
  assert.equal(value.state,STATES.NOT_REQUIRED);
  assert.equal(manager.canRequestAds(),true);
});

test('同意が必要なときはフォーム完了まで広告を許可しない',async()=>{
  const manager=createManager();
  let resolveForm;
  const plugin={requestConsentInfo:async()=>({status:'REQUIRED',canRequestAds:false,isConsentFormAvailable:true,privacyOptionsRequirementStatus:'REQUIRED'}),showConsentForm:()=>new Promise(resolve=>{resolveForm=resolve;})};
  const pending=manager.ensure(plugin);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(manager.canRequestAds(),false);
  resolveForm({status:'OBTAINED',canRequestAds:true,privacyOptionsRequirementStatus:'REQUIRED'});
  const value=await pending;
  assert.equal(value.state,STATES.OBTAINED);
  assert.equal(value.privacyOptionsRequired,true);
  assert.equal(manager.canRequestAds(),true);
});

test('UMPエラーでは広告をロードしない',async()=>{
  const manager=createManager();
  let initialized=false,loaded=false,attempted=false;
  const plugin={initialize:async()=>{initialized=true;},requestConsentInfo:async()=>{throw Error('network');},prepareRewardVideoAd:async()=>{loaded=true;}};
  const provider=Ads.createProvider({plugin,config:{testing:true,consentManager:manager},api:{createAttempt:async()=>{attempted=true;}}});
  const result=await provider.showRewardedAd();
  assert.equal(result.rewarded,false);
  assert.equal(manager.getState().state,STATES.ERROR);
  assert.equal(initialized,false);
  assert.equal(loaded,false);
  assert.equal(attempted,false);
});

test('同意確認がSDK初期化と広告ロードに先行する',async()=>{
  const manager=createManager(),calls=[];
  const plugin={requestConsentInfo:async()=>{calls.push('consent');return {status:'NOT_REQUIRED',canRequestAds:true};},initialize:async()=>{calls.push('initialize');},addListener:async()=>({remove:async()=>{}}),prepareRewardVideoAd:async()=>{calls.push('prepare');},showRewardVideoAd:async()=>{calls.push('show');return {};}};
  const provider=Ads.createProvider({plugin,config:{testing:true,consentManager:manager},api:{createAttempt:async()=>({attemptId:'a',playerId:'p'}),completeAttempt:async()=>({})}});
  await provider.showRewardedAd();
  assert.deepEqual(calls.slice(0,3),['consent','initialize','prepare']);
});

test('プライバシー設定の再表示後に同意状態を再取得する',async()=>{
  const manager=createManager();
  let requests=0,options=0;
  const plugin={requestConsentInfo:async()=>({status:'OBTAINED',canRequestAds:++requests>1,privacyOptionsRequirementStatus:'REQUIRED'}),showPrivacyOptionsForm:async()=>{options++;}};
  await manager.ensure(plugin);
  assert.equal(manager.canRequestAds(),false);
  assert.equal(await manager.showPrivacyOptions(plugin),true);
  assert.equal(options,1);
  assert.equal(manager.canRequestAds(),true);
});
