const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {productionConfig}=require('../scripts/prepare-web-assets.cjs');
test('Release integrityは画像・音声などassets以下も対象にする',()=>{
 const {sourceFiles}=require('../scripts/validate-generated-web.cjs');
 const files=sourceFiles(path.resolve(__dirname,'..'));
 assert(files.some(name=>name.startsWith('assets/')&&/\.(png|webp|jpg)$/i.test(name)));
 assert(files.includes('rewarded-ad-provider.js'));
 assert(!files.includes('api-environment.sandbox.js'));
});
test('広告は常にNPA、ATT requestなし、first-party ID off、Android AD_ID removal',()=>{
 const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
 assert.match(read('scripts/prepare-web-assets.cjs'),/result.npa=true/);
 assert.match(read('rewarded-ad-provider.js'),/isTesting:testing,npa:true/);
 const ios=read('ios/App/App/AppDelegate.swift');
 assert.match(ios,/setPublisherFirstPartyIDEnabled\(false\)/);
 assert.match(ios,/publisherPrivacyPersonalizationState = .disabled/);
 assert.doesNotMatch(ios,/requestTrackingAuthorization\(/);
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
 assert.match(read('index.html'),/不適切な広告を報告する/);
 for(const p of ['privacy.html','terms.html','support.html','data-deletion.html'])assert.doesNotMatch(read(p),/公開前の確認事項|TODO|localhost/);
});
