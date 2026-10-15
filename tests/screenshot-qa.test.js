const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const QA=require('../debug/screenshot-qa.js'),M=require('../monetization.js'),Skills=require('../skill-catalog.js');
test('screenshot requires native iOS DEBUG and explicit process environment opt-in',()=>{
 for(const platform of ['web','android','ios'])for(const debug of [false,true])for(const screenshotMode of [false,true])
  assert.equal(QA.allowed({getPlatform:()=>platform},{debug,screenshotMode}),platform==='ios'&&debug&&screenshotMode);
 assert.equal(QA.allowed(null,null),false);
 const swift=fs.readFileSync(path.join(__dirname,'../ios/App/App/NyanStoreKitPlugin.swift'),'utf8');
 assert.match(swift,/#if DEBUG\s+call.resolve\([\s\S]*?NYAN_SCREENSHOT_MODE[\s\S]*?#else\s+call.resolve\(\["debug": false\]\)/);
});
test('local preview equips all three without ownership, storage or profile mutation',()=>{
 let writes=0;const original=M.createManager({storage:{getItem:()=>null,setItem:()=>writes++}});
 const before=JSON.stringify(original.getState()),initialWrites=writes,preview=QA.previewManager(original,Skills);
 assert.equal(preview.isSkillModeUnlocked(),true);
 for(const [id,skill] of Object.entries(QA.skills)){
  assert.equal(preview.canEquipSkill(skill.role,id),true);assert.equal(preview.isSkillOwned(id),false);
  assert.equal(preview.canEquipSkill(skill.role==='cat'?'police':'cat',id),false);
  assert(fs.existsSync(path.join(__dirname,'..',skill.image)));
 }
 assert.equal(preview.canEquipSkill('cat','unknown'),false);
 assert.equal(JSON.stringify(original.getState()),before);assert.equal(writes,initialWrites);
 assert.equal(original.isSkillModeUnlocked(),false);
 for(const key of ['purchaseProduct','restorePurchases','syncServerPurchaseEntitlements','getState','isProductPurchased'])assert.equal(preview[key],original[key]);
});
test('Release generation strips helper and guard rejects even unreferenced QA files',()=>{
 const {prepare,releaseHtml}=require('../scripts/prepare-web-assets.cjs'),{validate}=require('../scripts/validate-generated-web.cjs');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.match(html,/debug\/screenshot-qa/);assert.doesNotMatch(releaseHtml(html),/debug\/screenshot-qa/);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nyan-shot-release-'));
 try{
  fs.mkdirSync(path.join(root,'assets'));fs.mkdirSync(path.join(root,'debug'));fs.writeFileSync(path.join(root,'index.html'),html);
  fs.writeFileSync(path.join(root,'debug/screenshot-qa.js'),'/* QA */');
  const env={NYAN_ADMOB_IOS_APP_ID:'ca-app-pub-6462457361541481~4217995844',NYAN_ADMOB_IOS_REWARDED_ID:'ca-app-pub-6462457361541481/4339169364',NYAN_AD_CHILD_DIRECTED:'false',NYAN_AD_UNDER_AGE:'false',NYAN_AD_MAX_RATING:'Teen'};
  const {output}=prepare({root,release:true,platform:'ios',env});validate(root,output,'ios');assert(!fs.existsSync(path.join(output,'debug')));
  fs.mkdirSync(path.join(output,'debug'));assert.throws(()=>validate(root,output,'ios'),/QA directory/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('native-gated panel opens all details and holds all three cut-ins without purchases',async()=>{
 const vm=require('node:vm'),nodes={},listeners={},classes=()=>({values:new Set(),add(...v){v.forEach(x=>this.values.add(x));},remove(...v){v.forEach(x=>this.values.delete(x));}});
 function element(){return {children:[],classList:classes(),append(...v){this.children.push(...v);},setAttribute(k,v){this[k]=v;},addEventListener(k,v){this[k]=v;},remove(){}};}
 for(const id of ['skillCutin','skillCutinKicker','skillCutinName','skillCutinDesc','skillCutinImage','shopOpenBtn'])nodes[id]=element();
 let details=[],shopOpens=0;nodes.shopOpenBtn.click=()=>shopOpens++;
 const body=element(),head=element(),original=M.createManager({storage:null});
 const context={__nyanScreenshotIsolated:true,NyanScreenshotIsolation:{active:true,counts:()=>({})},document:{readyState:'complete',body,head,createElement:element,getElementById:id=>nodes[id],addEventListener:(k,fn)=>listeners[k]=fn},NyanMonetization:original,NyanSkillCatalog:Skills,
  Capacitor:{getPlatform:()=> 'ios',Plugins:{NyanReview:{getEnvironment:async()=>({debug:true,screenshotMode:true})}}},
  NyanShopOpenSkillDetail:id=>details.push(id),dispatchEvent(){},Event:class{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../debug/screenshot-qa.js'),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 const panel=body.children[0];assert.equal(panel.id,'nyanScreenshotPanel');
 for(const [id,skill] of Object.entries(QA.skills)){
  panel.children.find(x=>x.textContent===skill.name+' 詳細').click();assert.equal(details.at(-1),id);
  panel.children.find(x=>x.textContent===skill.name+' 演出固定').click();
  assert.equal(nodes.skillCutinName.textContent,skill.name);assert(nodes.skillCutin.classList.values.has('show'));assert.equal(nodes.skillCutin['aria-hidden'],'false');
 }
 assert.equal(shopOpens,3);assert.equal(original.isSkillModeUnlocked(),false);
 let prevented=0;listeners.click({target:{closest:()=>true},preventDefault(){prevented++;},stopImmediatePropagation(){prevented++;}});assert.equal(prevented,2);
 panel.children.find(x=>x.textContent==='撮影モード終了（再起動までOFF）').click();assert.equal(context.NyanMonetization,original);assert(!nodes.skillCutin.classList.values.has('show'));
});
test('document-start isolation blocks Web and native writes/ads before app startup',async()=>{
 const vm=require('node:vm'),source=fs.readFileSync(path.join(__dirname,'../debug/screenshot-isolation.js'),'utf8');
 let calls=0;const fetch=()=>{calls++;},nativePromise=async()=>{calls++;return {debug:true,screenshotMode:true};};
 const root={__nyanScreenshotIsolated:true,Capacitor:{getPlatform:()=> 'ios',nativePromise,nativeCallback:()=>calls++},fetch,
  XMLHttpRequest:class{send(){calls++;}},WebSocket:class{},EventSource:class{},navigator:{sendBeacon:()=>calls++},document:{createElement:()=>({}),head:{append(){}}}};
 vm.runInNewContext(source,root);
 await assert.rejects(root.fetch('https://example.com'),/Offline/);assert.throws(()=>new root.XMLHttpRequest().send(),/Offline/);
 assert.throws(()=>new root.WebSocket('wss://example.com'),/Offline/);assert.equal(root.navigator.sendBeacon(),false);
 for(const [plugin,method] of [['AdMob','initialize'],['AdMob','prepareRewardVideoAd'],['CapacitorHttp','request'],['NyanStoreKit','purchase'],['NyanReview','requestReview']])await assert.rejects(root.Capacitor.nativePromise(plugin,method),/Offline/);
 assert.equal(calls,0);assert.equal((await root.Capacitor.nativePromise('NyanReview','getEnvironment')).debug,true);
 const normal={fetch,Capacitor:{getPlatform:()=> 'ios',nativePromise}};vm.runInNewContext(source,normal);assert.equal(normal.fetch,fetch);assert.equal(normal.Capacitor.nativePromise,nativePromise);
 const swift=fs.readFileSync(path.join(__dirname,'../ios/App/App/NyanStoreKitPlugin.swift'),'utf8');
 assert.match(swift,/#if DEBUG[\s\S]*configuration.websiteDataStore = .nonPersistent\(\)/);
});
