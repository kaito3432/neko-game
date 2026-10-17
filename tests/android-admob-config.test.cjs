const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const ids=require('../config/admob.android.production.json');
const {productionConfig,prepare}=require('../scripts/prepare-web-assets.cjs');
const {validate}=require('../scripts/validate-generated-web.cjs');
// Test-only policy fixtures, not a decision or environment setting for Release.
const policy={NYAN_AD_MAX_RATING:'G'};
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
test('Android uses approved unknown-age policy without changing iOS policy inputs',()=>{
 assert.deepEqual(productionConfig({},'android').androidPolicy,{ageRestrictedTreatment:'UNSPECIFIED',maxAdContentRating:'G'});
 const value=productionConfig({...ios,NYAN_AD_CHILD_DIRECTED:'false',NYAN_AD_UNDER_AGE:'false',NYAN_AD_MAX_RATING:'Teen'},'both');
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
  const approved=fs.readFileSync(file,'utf8');
  fs.writeFileSync(file,approved.replace('UNSPECIFIED','TEEN'));
  assert.throws(()=>validate(root,output,'android'),/ad policy/);
  fs.writeFileSync(file,approved);
  fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(ids.rewardedAdUnitId,ios.NYAN_ADMOB_IOS_REWARDED_ID));
  assert.throws(()=>validate(root,output,'android'),/approved configuration/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('Android runtime sends approved Rewarded ID and keeps the SSV identifiers',async()=>{
 const Ads=require('../rewarded-ad-provider.js');let prepared;
 const plugin={initialize:async()=>{},addListener:async()=>({remove(){}}),prepareRewardVideoAd:async value=>{prepared=value;},showRewardVideoAd:async()=>({})};
 const config=productionConfig(policy,'android');
 const provider=Ads.createProvider({plugin,config:{...config,platform:'android',privacyPlugin:{configureAdvertising:async()=>{}},rewardedAdUnitId:config.rewardedAdUnitIds.android},
  api:{createAttempt:async()=>({playerId:'test-player',attemptId:'test-verification'}),completeAttempt:async()=>{throw Error('no reward callback');}}});
 await provider.showRewardedAd();
 assert.equal(prepared.adId,ids.rewardedAdUnitId);assert.equal(prepared.npa,true);assert.equal(prepared.isTesting,false);
 assert.deepEqual(prepared.ssv,{userId:'test-player',customData:'test-verification'});
});

test('Android ignores legacy age booleans and rejects a weaker modern policy',()=>{
 const config=productionConfig({NYAN_AD_CHILD_DIRECTED:'true',NYAN_AD_UNDER_AGE:'true',NYAN_AD_MAX_RATING:'G'},'android');
 assert.deepEqual(config.androidPolicy,{ageRestrictedTreatment:'UNSPECIFIED',maxAdContentRating:'G'});
 assert.equal(Object.hasOwn(config,'tagForChildDirectedTreatment'),false);
 assert.equal(Object.hasOwn(config,'tagForUnderAgeOfConsent'),false);
 for(const age of ['CHILD','TEEN'])assert.throws(()=>productionConfig({NYAN_AD_AGE_RESTRICTED_TREATMENT:age},'android'),/UNSPECIFIED/);
 for(const rating of ['Teen','T','MA'])assert.throws(()=>productionConfig({NYAN_AD_MAX_RATING:rating},'android'),/G ad content/);
 assert.throws(()=>productionConfig({NYAN_AD_NPA:'false'},'android'),/non-personalized/);
});

test('Android policy is applied before UMP, without forwarding legacy adult assertions',async()=>{
 const Ads=require('../rewarded-ad-provider.js'),calls=[];
 const plugin={initialize:async options=>{calls.push('sdk');assert.equal(options.maxAdContentRating,'General');assert.equal(Object.hasOwn(options,'tagForUnderAgeOfConsent'),false);assert.equal(Object.hasOwn(options,'tagForChildDirectedTreatment'),false);}};
 const config=productionConfig({},'android');
 const provider=Ads.createProvider({plugin,config:{...config,platform:'android',tagForUnderAgeOfConsent:false,tagForChildDirectedTreatment:false,rewardedAdUnitId:ids.rewardedAdUnitId,
  privacyPlugin:{configureAdvertising:async policy=>{calls.push('policy');assert.deepEqual(policy,config.androidPolicy);}},
  consentManager:{ensure:async()=>{calls.push('ump');return {canRequestAds:false};},canRequestAds:()=>false}}});
 assert.equal((await provider.initialize()).available,false);
 assert.deepEqual(calls,['sdk','policy','ump']);assert.equal(provider.canRequestAd(),false);
});

test('Android policy native failure stops consent continuation and ad loading',async()=>{
 const Ads=require('../rewarded-ad-provider.js');let consent=0,load=0;
 const provider=Ads.createProvider({plugin:{initialize:async()=>{},prepareRewardVideoAd:async()=>{load++;}},config:{platform:'android',testing:true,
  privacyPlugin:{configureAdvertising:async()=>{throw Error('native failed');}},
  consentManager:{ensure:async()=>{consent++;return {canRequestAds:true};},canRequestAds:()=>true}}});
 assert.equal((await provider.showRewardedAd()).shown,false);assert.equal(consent,0);assert.equal(load,0);
});
