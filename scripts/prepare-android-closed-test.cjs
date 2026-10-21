'use strict';
// Android-only packaging entrypoint. Shared/iOS source and outputs are never edited.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {prepare}=require('./prepare-web-assets.cjs');
const {validate}=require('./validate-generated-web.cjs');
const ROOT=path.resolve(__dirname,'..');
const EXTRA='android/web/interstitial.js';
const INTERSTITIAL_ID='ca-app-pub-6462457361541481/5028330850';
const FILES=['index.html','style.css','game.js','storekit-ui.js','service-worker.js'];
const CSS=`
/* Android closed-test presentation policy; absent from every iOS bundle. */
.android-closed-test #shopOpenBtn,
.android-closed-test #shopOverlay,
.android-closed-test #shopSkillPreview,
.android-closed-test #localAbilityRuleBtn,
.android-closed-test #onlineAbilityRuleBtn,
.android-closed-test #localSkillUnlockOpen,
.android-closed-test #skillUnlockOverlay,
.android-closed-test #onlineSkillModeNotice,
.android-closed-test #shopPreviewPack,
.android-closed-test #storeKitProducts,
.android-closed-test #storeKitRestore,
.android-closed-test #storeKitStatus,
.android-closed-test .shop-pack-section,
.android-closed-test .shop-skill-usage-summary,
.android-closed-test .shop-skill-usage-rules,
.android-closed-test .howto-page[data-howto-page="3"],
.android-closed-test #resultOpponentSkillShop,
.android-closed-test #policeAbilityOverlay,
.android-closed-test #catAbilityOverlay,
.android-closed-test #abilityRevealOverlay,
.android-closed-test #matchSkillHud{display:none!important}
`;
function once(source,before,after){
 if(source.split(before).length!==2)throw new Error('Android UI packaging anchor changed: '+before.slice(0,80));
 return source.replace(before,after);
}
function transform(file,input,platform){
 if(platform!=='android')return input;
 let s=input.replace(/\r\n/g,'\n');
 if(file==='index.html'){s=once(s,'<script src="./game.js?v=3.4.battle-style-13t"></script>','<script>globalThis.NYAN_ANDROID_INTERSTITIAL_ID="'+INTERSTITIAL_ID+'";</script>\n<script src="./'+EXTRA+'"></script>\n<script src="./game.js?v=3.4.battle-style-13t"></script>');return once(s,'<head>','<head>\n<script>globalThis.NYAN_ANDROID_CLOSED_TEST=Object.freeze({skillMode:false,paidSkills:false,shop:false});document.documentElement.classList.add("android-closed-test");</script>');}
 if(file==='style.css')return s+CSS;
 if(file==='service-worker.js')return once(s,'nyan-chase-v88-release-assets-20261018','nyan-chase-v88-android-closed-test-v3-interstitial');
 if(file==='storekit-ui.js'){
  s=once(s,'async function buy(productId){','async function buy(productId){ return; // Android closed-test: no paid UI actions');
  s=once(s,'packs?.replaceChildren(...views.filter(view=>Boolean(view.packId)).map(card));','packs?.replaceChildren();');
  s=once(s,'skill=>skill.role===role','skill=>skill.role===role&&skill.free');
  s=once(s,'const skill=skills[skillId];if(!skill||!preview)return;','const skill=skills[skillId];if(!skill||!skill.free||!preview)return;');
  s=once(s,'function showPackPreview(){','function showPackPreview(){ return; // Android closed-test');
  s=once(s,'async function load(){',"async function load(){ products=[];status.textContent='';render();return; // Android closed-test: no purchase UI loading");
  s=once(s,'root.NyanShopOpenSkillDetail=skillId=>{','root.NyanShopOpenSkillDetail=skillId=>{ return false; // Android closed-test');
  s=once(s,"restore.addEventListener('click',async()=>{","restore.addEventListener('click',async()=>{ return; // Android closed-test");
  return s;
 }
 if(file==='game.js'){
  s=once(s,'    dailyBattle=showMode ? null : window.NyanDailyMissions?.beginBattle(playMode,cpuDifficulty);','    dailyBattle=showMode ? null : window.NyanDailyMissions?.beginBattle(playMode,cpuDifficulty);\n    if(!showMode)window.NyanAndroidInterstitial.begin();');
  s=once(s,'  function endGame(winner,reason,officialResult=null){','  function endGame(winner,reason,officialResult=null){\n    window.NyanAndroidInterstitial.completed({playMode,alreadyOver:game.gameOver});');
  s=once(s,'bindPress(resultHomeBtn,()=>{','bindPress(resultHomeBtn,window.NyanAndroidInterstitial.wrap(()=>{');
  s=once(s,'if(reviewAfterHome)requestAnimationFrame(()=>window.NyanRoomReview?.resultClosed());\n});','if(reviewAfterHome)requestAnimationFrame(()=>window.NyanRoomReview?.resultClosed());\n}));');
  s=once(s,'bindPress(againBtn,()=>{','bindPress(againBtn,window.NyanAndroidInterstitial.wrap(()=>{');
  s=once(s,'   }); \n\nlet bootRecoveryRunning=false;','   })); \n\nlet bootRecoveryRunning=false;');
  s=once(s,'bindPress(shopOpenBtn,()=>{shopOverlay.hidden=false;shopOverlay.setAttribute("aria-hidden","false");window.NyanShopRefresh?.();});','bindPress(shopOpenBtn,()=>{}); // Android closed-test: Shop unavailable');
  s=once(s,'bindPress(resultOpponentSkillShop,()=>{','bindPress(resultOpponentSkillShop,()=>{ return; // Android closed-test: Shop unavailable');
  const ruleAnchor='  const rule=data.payload.rule;';
  if(s.split(ruleAnchor).length!==3)throw new Error('Room rule receivers changed');
  s=s.split(ruleAnchor).join(ruleAnchor+'\n  if(rule==="ability"){rejectAndroidSkillRoom();return;}');
  s=once(s,'function startOnlineAbilityRule(){',`function rejectAndroidSkillRoom(){
  window.NyanOnline?.reset();
  resetOnlineState();
  onlineRuleOverlay?.classList.remove("show");
  onlineOverlay.classList.add("show");
  onlineStatus.textContent="Android版は通常戦のみ利用できます。通常戦の部屋を作り直してください。";
}
function startOnlineAbilityRule(){`);
  s=once(s,'function startLocalAbilityMode(){','function startLocalAbilityMode(){ return; // Android closed-test');
  s=once(s,'function startOnlineAbilityRule(){','function startOnlineAbilityRule(){ return; // Android closed-test');
  s=once(s,'function showHowToPage(page){','function showHowToPage(page){\n  if(page===3)page=howToPage<3?4:2; // Skip unavailable Skill Mode help');
  s=once(s,'  skillUnlockOverlay.hidden=false;','  return; // Android closed-test: Skill Mode ad entry unavailable');
  return s;
 }
 return input;
}
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function check(root=ROOT,output=path.join(root,'android/app/src/main/assets/public')){
 validate(root,output,'android');
 const manifest=JSON.parse(fs.readFileSync(path.join(output,'web-source-manifest.json'),'utf8'));
 if(manifest.androidClosedTest?.skillMode!==false||manifest.androidClosedTest?.paidSkills!==false||manifest.androidClosedTest?.shop!==false||manifest.androidClosedTest?.versionCode!==3)
  throw new Error('Prepare Android closed-test v3 assets explicitly');
 for(const [file,hashes] of Object.entries(manifest.files)){
  if(!FILES.includes(file)&&hashes.source!==hashes.bundled)throw new Error('Unexpected Android asset transformation: '+file);
 }
 for(const file of FILES){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const input=file==='index.html'?require('./prepare-web-assets.cjs').releaseHtml(source):source;
  if(fs.readFileSync(path.join(output,file),'utf8')!==transform(file,input,'android'))throw new Error('Android UI policy missing/stale: '+file);
 }
 if(!manifest.files[EXTRA]||fs.readFileSync(path.join(output,EXTRA),'utf8')!==fs.readFileSync(path.join(root,EXTRA),'utf8'))throw new Error('Android Interstitial runtime missing/stale');
 return true;
}
function generate({root=ROOT,env=process.env}={}){
 const {output}=prepare({root,release:true,platform:'android',env});
 fs.mkdirSync(path.join(output,'android/web'),{recursive:true});fs.copyFileSync(path.join(root,EXTRA),path.join(output,EXTRA));
 const manifestPath=path.join(output,'web-source-manifest.json');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 for(const file of FILES){
  const target=path.join(output,file),input=fs.readFileSync(target,'utf8');
  const value=transform(file,input,'android');fs.writeFileSync(target,value);
  manifest.files[file].bundled=digest(value);
 }
 manifest.files[EXTRA]={source:digest(fs.readFileSync(path.join(root,EXTRA))),bundled:digest(fs.readFileSync(path.join(output,EXTRA)))};
 manifest.androidClosedTest={skillMode:false,paidSkills:false,shop:false,versionCode:3};
 fs.writeFileSync(manifestPath,JSON.stringify(manifest));check(root,output);return output;
}
if(require.main===module){try{
 if(process.argv.includes('--check')){check(ROOT,path.resolve(process.argv[process.argv.indexOf('--check')+1]));console.log('Android closed-test UI assets: PASS');}
 else{if(process.argv.length>2)throw new Error('Android-only packaging; no iOS option');console.log('Android closed-test assets ready: '+generate());}
}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={transform,check,generate,FILES,CSS};