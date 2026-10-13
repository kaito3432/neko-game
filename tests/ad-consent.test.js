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
  assert.equal(initialized,true);
  assert.equal(loaded,false);
  assert.equal(attempted,false);
});

test('SDK初期化後に同意確認し、許可後に広告をロードする',async()=>{
  const manager=createManager(),calls=[];
  const plugin={requestConsentInfo:async()=>{calls.push('consent');return {status:'NOT_REQUIRED',canRequestAds:true};},initialize:async()=>{calls.push('initialize');},addListener:async()=>({remove:async()=>{}}),prepareRewardVideoAd:async()=>{calls.push('prepare');},showRewardVideoAd:async()=>{calls.push('show');return {};}};
  const provider=Ads.createProvider({plugin,config:{testing:true,consentManager:manager},api:{createAttempt:async()=>({attemptId:'a',playerId:'p'}),completeAttempt:async()=>({})}});
  await provider.showRewardedAd();
  assert.deepEqual(calls.slice(0,3),['initialize','consent','prepare']);
});

test('iOS presenterをinitializeで準備し、required form完了後だけloadする',async()=>{
 const manager=createManager(),calls=[];let ready=false,finish;
 const plugin={initialize:async()=>{ready=true;calls.push('initialize');},requestConsentInfo:async()=>{assert(ready);calls.push('consent');return {status:'REQUIRED',canRequestAds:false,isConsentFormAvailable:true,privacyOptionsRequirementStatus:'REQUIRED'};},showConsentForm:async()=>{assert(ready);calls.push('form');return new Promise(r=>{finish=r;});},addListener:async()=>({remove:async()=>{}}),prepareRewardVideoAd:async()=>{assert(manager.canRequestAds());calls.push('load');},showRewardVideoAd:async()=>({})};
 const provider=Ads.createProvider({plugin,config:{testing:true,consentManager:manager},api:{createAttempt:async()=>({playerId:'p',attemptId:'a'}),completeAttempt:async()=>({})}});
 const pending=provider.showRewardedAd();await new Promise(r=>setImmediate(r));
 assert.deepEqual(calls,['initialize','consent','form']);
 finish({status:'OBTAINED',canRequestAds:true,privacyOptionsRequirementStatus:'REQUIRED'});await pending;
 assert.deepEqual(calls,['initialize','consent','form','load']);assert.equal(manager.getState().privacyOptionsRequired,true);
});

test('consent拒否ではattempt/loadなし、再試行でSDKを二重初期化しない',async()=>{
 const manager=createManager();let initialized=0,requests=0,loaded=0;
 const plugin={initialize:async()=>{initialized++;},requestConsentInfo:async()=>({status:'OBTAINED',canRequestAds:++requests>1,privacyOptionsRequirementStatus:'NOT_REQUIRED'}),addListener:async()=>({remove:async()=>{}}),prepareRewardVideoAd:async()=>{loaded++;},showRewardVideoAd:async()=>({})};
 let attempts=0;const provider=Ads.createProvider({plugin,config:{testing:true,consentManager:manager},api:{createAttempt:async()=>{attempts++;return {playerId:'p',attemptId:'a'};},completeAttempt:async()=>({})}});
 await provider.showRewardedAd();assert.equal(loaded,0);assert.equal(attempts,0);assert.equal(manager.canRequestAds(),false);
 await provider.showRewardedAd();assert.equal(initialized,1);assert.equal(loaded,1);assert.equal(manager.getState().privacyOptionsRequired,false);
 assert.equal(await manager.showPrivacyOptions(plugin),false);
});

test('initialize失敗時にconsent/form/loadを呼ばない',async()=>{
 let consent=0;const manager=createManager();
 const provider=Ads.createProvider({plugin:{initialize:async()=>{throw Error('SDK');},requestConsentInfo:async()=>{consent++;}},config:{testing:true,consentManager:manager}});
 assert.equal((await provider.initialize()).available,false);assert.equal(consent,0);
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
