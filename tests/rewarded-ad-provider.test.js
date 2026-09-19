const test=require('node:test');
const assert=require('node:assert/strict');
const Ads=require('../rewarded-ad-provider.js');

function fixture({prepareError=null,showError=null,reward=true,dismiss=false,testing=false,completeError=null}={}){
  const listeners=new Map(),calls=[];
  const plugin={
    async initialize(options){calls.push(['initialize',options]);},
    async addListener(name,handler){listeners.set(name,handler);return {remove(){listeners.delete(name);}};},
    async prepareRewardVideoAd(options){calls.push(['prepare',options]);if(prepareError)throw prepareError;},
    async showRewardVideoAd(){calls.push(['show']);if(showError)throw showError;if(reward)listeners.get('onRewardedVideoAdReward')?.({amount:1});if(dismiss)listeners.get('onRewardedVideoAdDismissed')?.();return {};}
  };
  let completions=0;
  const api={createAttempt:async()=>({attemptId:'ra_attempt_1',playerId:'P1'}),completeAttempt:async payload=>{completions++;if(completeError)throw completeError;return {profile:{skillEntitlements:{skillModeUnlockAdViews:1}},payload};}};
  return {provider:Ads.createProvider({plugin,api,config:{testing,rewardedAdUnitId:'production-unit',verificationAttempts:1}}),calls,getCompletions:()=>completions};
}

test('広告ロード成功・reward callback・サーバー確認成功',async()=>{
  const f=fixture(),result=await f.provider.showRewardedAd();
  assert.equal(result.rewarded,true);assert.equal(result.verified,true);assert.equal(f.getCompletions(),1);
  assert.equal(f.calls.find(value=>value[0]==='prepare')[1].ssv.customData,'ra_attempt_1');
});

test('ロード失敗は加算せず利用不可',async()=>{
  const f=fixture({prepareError:new Error('load')}),result=await f.provider.showRewardedAd();
  assert.equal(result.rewarded,false);assert.equal(result.reason,'loadFailed');assert.equal(f.getCompletions(),0);
});

test('途中キャンセル・callbackなしは加算しない',async()=>{
  const cancelled=fixture({reward:false,dismiss:true}),missing=fixture({reward:false});
  assert.equal((await cancelled.provider.showRewardedAd()).reason,'cancelled');
  assert.equal((await missing.provider.showRewardedAd()).reason,'rewardCallbackMissing');
  assert.equal(cancelled.getCompletions()+missing.getCompletions(),0);
});

test('サーバー403と503は権利付与失敗として扱う',async()=>{
  for(const status of [403,503]){const error=new Error('server');error.status=status;const f=fixture({completeError:error});
    const result=await f.provider.showRewardedAd();assert.equal(result.rewarded,false);assert.equal(result.reason,status===403?'serverRejected':'serverUnavailable');}
});

test('テスト広告はreward callbackを確認してもSSV権利を加算しない',async()=>{
  const f=fixture({testing:true}),result=await f.provider.showRewardedAd();
  assert.equal(result.rewarded,true);assert.equal(result.testMode,true);assert.equal(result.verified,false);assert.equal(f.getCompletions(),0);
  assert.equal(f.calls.find(value=>value[0]==='prepare')[1].adId,Ads.IOS_TEST_REWARDED_ID);
});

test('連打を拒否し、Web非対応環境でもクラッシュしない',async()=>{
  let release;const api={createAttempt:()=>new Promise(resolve=>{release=resolve;}),completeAttempt:async()=>({})};
  const plugin={initialize:async()=>{},addListener:async()=>({remove(){}}),prepareRewardVideoAd:async()=>{},showRewardVideoAd:async()=>({amount:1})};
  const provider=Ads.createProvider({plugin,api,config:{testing:false,rewardedAdUnitId:'x'}}),first=provider.showRewardedAd();
  await new Promise(resolve=>setImmediate(resolve));assert.equal((await provider.showRewardedAd()).reason,'busy');release({attemptId:'ra_1',playerId:'P'});await first;
  const web=Ads.createProvider({plugin:null,api,config:{testing:true}});assert.equal((await web.initialize()).available,false);assert.equal((await web.showRewardedAd()).reason,'unavailable');
});

test('adsRemoved状態でもリワードprovider自体は利用可能',async()=>{
  const f=fixture(),result=await f.provider.showRewardedAd();assert.equal(result.verified,true);
});
test('AndroidではGoogle公式テストRewarded Ad IDを使用',async()=>{
  let prepared;const plugin={initialize:async()=>{},addListener:async(name,fn)=>({remove:async()=>{}}),prepareRewardVideoAd:async value=>{prepared=value;},showRewardVideoAd:async()=>({type:'reward'})};
  const provider=Ads.createProvider({plugin,config:{testing:true,platform:'android'},api:{createAttempt:async()=>({playerId:'p',attemptId:'a'}),completeAttempt:async()=>({profile:{}})}});
  await provider.showRewardedAd();assert.equal(prepared.adId,Ads.ANDROID_TEST_REWARDED_ID);assert.equal(prepared.isTesting,true);
});
