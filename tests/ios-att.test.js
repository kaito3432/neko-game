const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Ads=require('../rewarded-ad-provider.js');

function fixture(prepareAdvertising,platform='ios'){
  const calls=[];
  const plugin={initialize:async()=>calls.push('sdk'),addListener:async()=>({remove(){}}),
    prepareRewardVideoAd:async options=>{assert.equal(options.npa,true);calls.push('load');},showRewardVideoAd:async()=>({})};
  const provider=Ads.createProvider({plugin,config:{platform,testing:true,
    privacyPlugin:{prepareAdvertising:async()=>{calls.push('att');return prepareAdvertising();}},
    consentManager:{ensure:async()=>{calls.push('ump');return {canRequestAds:true};},canRequestAds:()=>true}},
    api:{createAttempt:async()=>{calls.push('attempt');return {playerId:'p',attemptId:'a'};},completeAttempt:async()=>({})}});
  return {provider,calls};
}
for(const status of ['authorized','denied','restricted'])test('ATT '+status+' resolves before SDK; ads remain NPA',async()=>{
  const f=fixture(()=>({status,trackingAuthorized:status==='authorized'}));
  await f.provider.showRewardedAd();
  assert.deepEqual(f.calls,['att','sdk','ump','attempt','load']);
});
test('No SDK initialization or attempt before ATT completes',async()=>{
  let resolve;const f=fixture(()=>new Promise(r=>{resolve=r;}));
  const pending=f.provider.initialize();await new Promise(r=>setImmediate(r));
  assert.deepEqual(f.calls,['att']);resolve({status:'denied'});await pending;
  assert.deepEqual(f.calls,['att','sdk','ump']);
});
for(const result of [undefined,{status:'notDetermined'},{status:'unknown'}])test('Unresolved ATT fails closed '+JSON.stringify(result),async()=>{
  const f=fixture(()=>result);assert.equal((await f.provider.initialize()).available,false);assert.deepEqual(f.calls,['att']);
});
test('ATT bridge rejection fails closed and may retry',async()=>{
  let count=0;const f=fixture(()=>{if(!count++)throw Error('inactive');return {status:'denied'};});
  assert.equal((await f.provider.initialize()).available,false);
  assert.deepEqual(f.calls,['att']);assert.equal((await f.provider.initialize()).available,true);
});
test('Android never requests ATT',async()=>{
  const f=fixture(()=>{throw Error('must not call');},'android');
  assert.equal((await f.provider.initialize()).available,true);assert.deepEqual(f.calls,['sdk','ump']);
});
test('Native ATT integration is registered and preserves privacy defaults',()=>{
  const read=name=>fs.readFileSync(require('node:path').join(__dirname,'../ios/App/App',name),'utf8');
  assert.match(read('Info.plist'),/NSUserTrackingUsageDescription/);
  assert.match(read('NyanStoreKitPlugin.swift'),/registerPluginInstance\(NyanAdPrivacyPlugin\(\)\)/);
  const native=read('AppDelegate.swift');
  assert.match(native,/applicationState == \.active/);
  assert.match(native,/setPublisherFirstPartyIDEnabled\(false\)/);
  assert.match(native,/publisherPrivacyPersonalizationState = \.disabled/);
  assert.match(native,/ATTrackingManager.requestTrackingAuthorization/);
  assert.doesNotMatch(native,/ASIdentifierManager/);
});
