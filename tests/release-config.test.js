const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {productionConfig}=require('../scripts/prepare-web-assets.cjs');
const iosEnv={NYAN_ADMOB_IOS_APP_ID:'ca-app-pub-6462457361541481~4217995844',NYAN_ADMOB_IOS_REWARDED_ID:'ca-app-pub-6462457361541481/4339169364',NYAN_AD_CHILD_DIRECTED:'false',NYAN_AD_UNDER_AGE:'false',NYAN_AD_MAX_RATING:'Teen'};
test('Release IDs are mandatory only for the selected OS; both remains strict',()=>{
 const ios=productionConfig(iosEnv,'ios');assert.equal(ios.testing,false);assert.equal(ios.appIds.android,undefined);assert.equal(ios.maxAdContentRating,'Teen');
 assert.throws(()=>productionConfig(iosEnv,'both'),/ANDROID_APP_ID/);
 assert.throws(()=>productionConfig(iosEnv,'android'),/ANDROID_APP_ID/);
 const androidEnv={...iosEnv,NYAN_ADMOB_ANDROID_APP_ID:'ca-app-pub-1111111111111111~1111111111',NYAN_ADMOB_ANDROID_REWARDED_ID:'ca-app-pub-1111111111111111/1111111111'};
 delete androidEnv.NYAN_ADMOB_IOS_APP_ID;delete androidEnv.NYAN_ADMOB_IOS_REWARDED_ID;
 assert.equal(productionConfig(androidEnv,'android').appIds.ios,undefined);
 assert.throws(()=>productionConfig(androidEnv,'both'),/IOS_APP_ID/);
 assert.equal(Object.keys(productionConfig({...iosEnv,...androidEnv},'both').appIds).length,2);
 for(const [os,env,key,value] of [
  ['ios',iosEnv,'NYAN_ADMOB_IOS_APP_ID','ca-app-pub-3940256099942544~1458002511'],
  ['ios',iosEnv,'NYAN_ADMOB_IOS_REWARDED_ID','ca-app-pub-3940256099942544/1712485313'],
  ['android',androidEnv,'NYAN_ADMOB_ANDROID_APP_ID','ca-app-pub-3940256099942544~3347511713'],
  ['android',androidEnv,'NYAN_ADMOB_ANDROID_REWARDED_ID','ca-app-pub-3940256099942544/5224354917'],
 ])assert.throws(()=>productionConfig({...env,[key]:value},os),/non-production/);
});
test('iOS-only generated assets cannot pass the Android Release validator',()=>{
 const os=require('node:os'),{prepare}=require('../scripts/prepare-web-assets.cjs'),{validate}=require('../scripts/validate-generated-web.cjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nyan-release-platform-test-'));
 try{
  fs.writeFileSync(path.join(root,'index.html'),'<html></html>');fs.mkdirSync(path.join(root,'assets'));
  const {output}=prepare({root,release:true,platform:'ios',env:iosEnv});
  validate(root,output,'ios');assert.throws(()=>validate(root,output,'android'),/not prepared for android/);
  const file=path.join(output,'ad-config.js');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('6462457361541481','3940256099942544'));
  assert.throws(()=>validate(root,output,'ios'),/test ID/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('Release integrityは画像・音声などassets以下も対象にする',()=>{
 const {sourceFiles}=require('../scripts/validate-generated-web.cjs');
 const files=sourceFiles(path.resolve(__dirname,'..'));
 assert(files.some(name=>name.startsWith('assets/')&&/\.(png|webp|jpg)$/i.test(name)));
 assert(files.includes('rewarded-ad-provider.js'));
 assert(!files.includes('api-environment.sandbox.js'));
});
test('広告は常にNPA、iOS ATT完了待機、first-party ID off、Android AD_ID removal',()=>{
 const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
 assert.match(read('scripts/prepare-web-assets.cjs'),/result.npa=true/);
 assert.match(read('rewarded-ad-provider.js'),/isTesting:testing,npa:true/);
 const ios=read('ios/App/App/AppDelegate.swift');
 assert.match(ios,/setPublisherFirstPartyIDEnabled\(false\)/);
 assert.match(ios,/publisherPrivacyPersonalizationState = .disabled/);
 assert.match(ios,/await ATTrackingManager.requestTrackingAuthorization\(\)/);
 const provider=read('rewarded-ad-provider.js');
 assert(provider.indexOf('await privacy.prepareAdvertising()')<provider.indexOf('await plugin.initialize('));
 assert.match(read('ios/App/App/Info.plist'),/NSUserTrackingUsageDescription/);
 assert.match(read('android/app/src/main/java/jp/nyanchase/game/MainActivity.java'),/putPublisherFirstPartyIdEnabled\(false\)/);
 assert.match(read('android/app/src/main/AndroidManifest.xml'),/permission.AD_ID" tools:node="remove"/);
});
test('Release HTMLは開発モックUIとQA scriptを含めない',()=>{
 const {releaseHtml}=require('../scripts/prepare-web-assets.cjs');
 const source=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8'),html=releaseHtml(source);
 assert.doesNotMatch(html,/monetizationDevPanel|モック購入|\.\/debug\//);
 assert.match(html,/storeKitRestore/);
});
test('本番ID・広告年齢方針が未確定ならRelease準備を止める',()=>{
 assert.throws(()=>productionConfig({}),/Missing/);
 assert.throws(()=>productionConfig({NYAN_ADMOB_IOS_APP_ID:'ca-app-pub-3940256099942544~1458002511'}),/production/);
});
test('初回ReleaseガードとSDK privacy resource参照が存在する',()=>{
 const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
 assert.match(read('ios/App/App.xcodeproj/project.pbxproj'),/PrivacyInfo.xcprivacy in Resources/);
 assert.match(read('android/app/build.gradle'),/preReleaseBuild/);
 assert.match(read('index.html'),/data-legal-page="support">サポート・お問い合わせ/);
 assert.match(read('support.html'),/不適切な広告の報告/);
 for(const p of ['privacy.html','terms.html','support.html','data-deletion.html'])assert.doesNotMatch(read(p),/公開前の確認事項|TODO|localhost/);
});
