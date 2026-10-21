const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {transform,FILES,CSS}=require('../scripts/prepare-android-closed-test.cjs');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
class Element{
 constructor(){this.hidden=false;this.textContent='';this.children=[];this.dataset={};this.listeners={};this.style={};this.classList={toggle(){},add(){},remove(){}};}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}
 addEventListener(type,fn){this.listeners[type]=fn;}setAttribute(){}removeAttribute(){}querySelector(){return {scrollTop:0};}
}
async function shop(platform){
 const nodes={},get=id=>nodes[id]??=new Element();const roles=['cat','police'].map(role=>{const e=new Element();e.dataset.shopRole=role;return e;});
 const skills=require('../skill-catalog.js'),definitions=require('../store-ui-model.js').DEFINITIONS;let loads=0,purchases=0,restores=0;
 const views=definitions.filter(v=>require('../store-product-ids.js').initial.includes(v.productId)).map(v=>({...v,displayName:v.name,available:true,displayPrice:'¥100'}));
 const scope={document:{getElementById:get,createElement:()=>new Element(),querySelectorAll:s=>s==='[data-shop-role]'?roles:[]},addEventListener(){},
  NyanPurchases:{nativePlugin:()=>({}),provider:{loadProducts:async()=>{loads++;return {products:views};},purchaseProduct:async()=>{purchases++;return{};},restorePurchases:async()=>{restores++;return{restored:true};}}},
  NyanStoreProductIds:require('../store-product-ids.js'),NyanMonetizationProducts:require('../monetization-products.js'),NyanMonetization:{isSkillOwned:()=>false},NyanSkillCatalog:skills,
  NyanStoreUIModel:{DEFINITIONS:definitions,build:()=>views,packSavings:()=>null,packPurchaseReason:()=>null}};
 vm.runInNewContext(transform('storekit-ui.js',read('storekit-ui.js'),platform),scope);await new Promise(r=>setImmediate(r));
 const names=()=>get('shopSkillList').children.map(c=>c.children[1].children[0].textContent);
 return{scope,get,names,roles,counts:()=>({loads,purchases,restores})};
}
test('iOS and Web packaging is byte-identical for every transformed file',()=>{
 for(const platform of ['ios','web','both'])for(const file of FILES)assert.equal(transform(file,read(file),platform),read(file));
 assert.equal(transform('release-features.js',read('release-features.js'),'android'),read('release-features.js'));
});
test('Android Shop shows only free skills, no pack and no paid detail/restore route',async()=>{
 const s=await shop('android');assert.deepEqual(s.names(),['忍び足']);assert.equal(s.get('shopPackProducts').children.length,0);
 s.roles[1].listeners.click();assert.deepEqual(s.names(),['遠吠え']);
 for(const id of ['CAT_FAKE_PAW','POLICE_GROUP_SEARCH','POLICE_DASH'])assert.equal(s.scope.NyanShopOpenSkillDetail(id),false);
 await s.get('storeKitRestore').listeners.click();assert.deepEqual(s.counts(),{loads:0,purchases:0,restores:0});
});
test('iOS keeps all five skill descriptions, the pack, four native products and paid detail routes',async()=>{
 const s=await shop('ios');assert.deepEqual(s.names(),['忍び足','フェイク肉球']);assert.equal(s.get('shopPackProducts').children.length,1);
 s.roles[1].listeners.click();assert.deepEqual(s.names(),['遠吠え','ダッシュ','一斉捜索']);
 for(const id of ['CAT_FAKE_PAW','POLICE_GROUP_SEARCH','POLICE_DASH'])assert.equal(s.scope.NyanShopOpenSkillDetail(id),true);
 assert.equal(s.counts().loads,1);
});
test('Android mode entry handlers return without exposing Skill Mode or ad unlock',()=>{
 const source=transform('game.js',read('game.js'),'android');new vm.Script(source);
 for(const name of ['startLocalAbilityMode','startOnlineAbilityRule']){
  const body=source.match(new RegExp('function '+name+'\\(\\)\\{([^\\n]*)'))[1];
  assert.doesNotThrow(()=>vm.runInNewContext('(function(){'+body.split('//')[0]+'throw Error("entry escaped");})()'));
 }
 for(const selector of ['#localAbilityRuleBtn','#onlineAbilityRuleBtn','#localSkillUnlockOpen','#skillUnlockOverlay','#shopPreviewPack','#storeKitRestore'])assert(CSS.includes(selector));
 const html=transform('index.html',read('index.html'),'android');assert.match(html,/NYAN_ANDROID_CLOSED_TEST/);assert.match(html,/skillMode:false,paidSkills:false/);
});
test('Android rejects guest Skill Mode rules using existing reset and leaves normal Room rules unchanged',()=>{
 const source=transform('game.js',read('game.js'),'android');assert.equal(source.split('if(rule==="ability"){rejectAndroidSkillRoom();return;}').length-1,2);
 let reset=0,localReset=0;const scope={window:{NyanOnline:{reset(){reset++;}}},resetOnlineState(){localReset++;},onlineRuleOverlay:{classList:{remove(){}}},onlineOverlay:{classList:{add(){}}},onlineStatus:{textContent:''}};
 const block=source.match(/function rejectAndroidSkillRoom\(\)\{[\s\S]*?\n\}/)[0];vm.runInNewContext(block+';rejectAndroidSkillRoom()',scope);
 assert.equal(reset,1);assert.equal(localReset,1);assert.match(scope.onlineStatus.textContent,/通常戦/);
 for(const rule of ['normal','ability']){
  let rejected=false,continued=false;vm.runInNewContext('(function(){if(rule==="ability"){rejectAndroidSkillRoom();return;}proceed();})()',{rule,rejectAndroidSkillRoom(){rejected=true;},proceed(){continued=true;}});
  assert.equal(rejected,rule==='ability');assert.equal(continued,rule==='normal');
 }
});
test('Android packaging fails closed if shared UI anchors change',()=>{
 assert.throws(()=>transform('storekit-ui.js','upstream changed','android'),/anchor changed/);
 assert.throws(()=>transform('game.js','upstream changed','android'),/anchor changed|receivers changed/);
});
test('Android Release guard rejects ordinary assets and stale UI packaging',()=>{
 const os=require('node:os'),{generate,check}=require('../scripts/prepare-android-closed-test.cjs');
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'nyan-android-policy-'));
 try{
  fs.mkdirSync(path.join(fixture,'assets'));
  fs.mkdirSync(path.join(fixture,'android/web'),{recursive:true});fs.copyFileSync(path.join(root,'android/web/interstitial.js'),path.join(fixture,'android/web/interstitial.js'));
  fs.writeFileSync(path.join(fixture,'unchanged.js'),'// preserved');
  for(const file of FILES)fs.writeFileSync(path.join(fixture,file),read(file));
  const output=generate({root:fixture,env:{}});assert.equal(check(fixture,output),true);
  const manifestFile=path.join(output,'web-source-manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestFile));
  delete manifest.androidClosedTest;fs.writeFileSync(manifestFile,JSON.stringify(manifest));
  assert.throws(()=>check(fixture,output),/closed-test v3 assets/);
  generate({root:fixture,env:{}});fs.appendFileSync(path.join(output,'storekit-ui.js'),'\n// stale');
  assert.throws(()=>check(fixture,output),/Stale or modified Web asset/);
  generate({root:fixture,env:{}});
  fs.writeFileSync(path.join(output,'unchanged.js'),'// modified');
  const forged=JSON.parse(fs.readFileSync(manifestFile));
  forged.files['unchanged.js'].bundled=require('node:crypto').createHash('sha256').update('// modified').digest('hex');
  fs.writeFileSync(manifestFile,JSON.stringify(forged));
  assert.throws(()=>check(fixture,output),/Unexpected Android asset transformation/);
 }finally{fs.rmSync(fixture,{recursive:true,force:true});}
});
test('Android hides all Shop routes while iOS keeps the original Home opener',()=>{
 const source=transform('game.js',read('game.js'),'android');
 for(const id of ['#shopOpenBtn','#shopOverlay','#shopSkillPreview','#resultOpponentSkillShop'])assert(CSS.includes(id));
 assert(source.includes('bindPress(shopOpenBtn,()=>{});'));
 assert(source.includes('bindPress(resultOpponentSkillShop,()=>{ return;'));
 assert(transform('index.html',read('index.html'),'android').includes('shop:false'));
 assert(transform('game.js',read('game.js'),'ios').includes('bindPress(shopOpenBtn,()=>{shopOverlay.hidden=false;'));
 assert(transform('service-worker.js',read('service-worker.js'),'android').includes('closed-test-v3-interstitial'));
});
