const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const ids=require('../config/admob.android.production.json');
const {productionConfig,prepare}=require('../scripts/prepare-web-assets.cjs');
const {validate}=require('../scripts/validate-generated-web.cjs');
// Test-only policy fixtures, not a decision or environment setting for Release.
const policy={NYAN_AD_CHILD_DIRECTED:'false',NYAN_AD_UNDER_AGE:'false',NYAN_AD_MAX_RATING:'Teen'};
const ios={NYAN_ADMOB_IOS_APP_ID:'ca-app-pub-6462457361541481~4217995844',NYAN_ADMOB_IOS_REWARDED_ID:'ca-app-pub-6462457361541481/4339169364'};
test('Android approved identifiers are exact and cannot accept iOS/test overrides',()=>{
 assert.equal(ids.packageId,'jp.nyanchase.game');
 assert.equal(ids.appId,'ca-app-pub-6462457361541481~9227823521');
 assert.equal(ids.rewardedAdUnitId,'ca-app-pub-6462457361541481/5638651041');
 const android=productionConfig(policy,'android');
 assert.deepEqual(android.appIds,{android:ids.appId});
 assert.deepEqual(android.rewardedAdUnitIds,{android:ids.rewardedAdUnitId});
 assert.equal(android.testing,false);assert.equal(android.npa,true);
 for(const [key,value]of [['NYAN_ADMOB_ANDROID_APP_ID',ios.NYAN_ADMOB_IOS_APP_ID],['NYAN_ADMOB_ANDROID_REWARDED_ID',ios.NYAN_ADMOB_IOS_REWARDED_ID],['NYAN_ADMOB_ANDROID_APP_ID','ca-app-pub-3940256099942544~3347511713']])
  assert.throws(()=>productionConfig({...policy,[key]:value},'android'),/Android production/);
});
test('Confirmed Android IDs do not bypass unresolved age policy or change iOS IDs',()=>{
 assert.throws(()=>productionConfig({},'android'),/Human policy decision required: NYAN_AD_CHILD_DIRECTED/);
 const value=productionConfig({...policy,...ios},'both');
 assert.equal(value.appIds.ios,ios.NYAN_ADMOB_IOS_APP_ID);
 assert.equal(value.rewardedAdUnitIds.ios,ios.NYAN_ADMOB_IOS_REWARDED_ID);
});
test('Generated Android production assets validate, but iOS replacement is rejected',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nyan-android-ad-ids-'));
 try{
  fs.writeFileSync(path.join(root,'index.html'),'<html></html>');fs.mkdirSync(path.join(root,'assets'));
  const {output}=prepare({root,release:true,platform:'android',env:policy});
  validate(root,output,'android');
  const file=path.join(output,'ad-config.js');
  fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(ids.rewardedAdUnitId,ios.NYAN_ADMOB_IOS_REWARDED_ID));
  assert.throws(()=>validate(root,output,'android'),/approved configuration/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('Android runtime sends approved Rewarded ID and keeps the SSV identifiers',async()=>{
 const Ads=require('../rewarded-ad-provider.js');let prepared;
 const plugin={initialize:async()=>{},addListener:async()=>({remove(){}}),prepareRewardVideoAd:async value=>{prepared=value;},showRewardVideoAd:async()=>({})};
 const config=productionConfig(policy,'android');
 const provider=Ads.createProvider({plugin,config:{...config,platform:'android',rewardedAdUnitId:config.rewardedAdUnitIds.android},
  api:{createAttempt:async()=>({playerId:'test-player',attemptId:'test-verification'}),completeAttempt:async()=>{throw Error('no reward callback');}}});
 await provider.showRewardedAd();
 assert.equal(prepared.adId,ids.rewardedAdUnitId);assert.equal(prepared.npa,true);assert.equal(prepared.isTesting,false);
 assert.deepEqual(prepared.ssv,{userId:'test-player',customData:'test-verification'});
});
