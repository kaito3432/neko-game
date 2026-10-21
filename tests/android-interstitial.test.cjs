const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {KEY,createController,createAd,install}=require('../android/web/interstitial.js');
const {transform}=require('../scripts/prepare-android-closed-test.cjs');
function storage(){const values=new Map();return{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};}
const flush=()=>new Promise(r=>setImmediate(r));
test('1/2/4/5 no ad; 3/6 show once only after result button, with restart persistence',()=>{
 const store=storage();let shows=0,go=0,close;const ad={show(cb){shows++;close=cb;return true;}};let c=createController({storage:store,ad});
 for(let i=1;i<=6;i++){
  if(i===3)c=createController({storage:store,ad});
  c.begin();assert(c.record('match:'+i));assert.equal(c.state().count,i);assert.equal(shows,Math.floor((i-1)/3));
  c.exit(()=>go++);if(i%3===0){assert.equal(go,i-1);close();close();}
  assert.equal(go,i);assert.equal(shows,Math.floor(i/3));
 }
 assert.equal(JSON.parse(store.getItem(KEY)).count,6);
});
for(const button of ['Home','rematch'])test(button+' waits for dismissal; button races and callbacks navigate once',()=>{
 let cb,shown=0,home=0,again=0;const c=createController({storage:storage(),ad:{show(done){shown++;cb=done;return true;}}});
 for(let i=1;i<=3;i++){c.begin();c.record('m'+i);if(i<3)c.exit(()=>{});}
 c.exit(()=>button==='Home'?home++:again++);c.exit(()=>again++);assert.equal(shown,1);assert.equal(home+again,0);
 cb();cb();c.exit(()=>home++);assert.equal(home+again,1);
});
for(const reason of ['not loaded','show throws'])test(reason+' immediately continues and consumes the opportunity',()=>{
 let go=0,show=0;const c=createController({storage:storage(),ad:{show(){show++;if(reason==='show throws')throw Error('failed');return false;}}});
 for(let i=1;i<=4;i++){c.begin();c.record('m'+i);c.exit(()=>go++);}
 assert.equal(go,4);assert.equal(show,1);
});
test('duplicate completion, result re-entry and unavailable persistence cannot duplicate ads',()=>{
 let shows=0;const store=storage(),c=createController({storage:store,ad:{show(){shows++;return false;}}});
 c.begin();c.record('m');c.record('m');assert.equal(c.state().count,1);c.exit(()=>{});c.exit(()=>{});assert.equal(shows,0);
 const bad=createController({storage:{getItem(){},setItem(){throw Error('full');}},ad:{show(){shows++;}}});assert.equal(bad.record('m'),false);
});
function provider({allowed=true,failLoad=false,failShow=false}={}){
 const callbacks={};let prepares=0,shows=0;const options=[];
 const plugin={addListener:async(n,fn)=>{callbacks[n]=fn;return{remove(){}};},prepareInterstitial:async(o)=>{prepares++;options.push(o);if(failLoad)throw Error('load');},showInterstitial:()=>{shows++;if(failShow)return Promise.reject(Error('show'));return Promise.resolve();}};
 const ad=createAd({plugin,initialize:async()=>({available:true}),consent:{canRequestAds:()=>allowed},adId:'ca-app-pub-6462457361541481/5028330850'});
 return{ad,callbacks,options,counts:()=>({prepares,shows}),deny:()=>allowed=false};
}
test('preload coalesces, uses NPA; show resolution is not dismissal; duplicate callback safe',async()=>{
 const p=provider();await Promise.all([p.ad.preload(),p.ad.preload()]);assert.equal(p.counts().prepares,1);assert.equal(p.options[0].npa,true);assert.equal(p.options[0].isTesting,false);
 let go=0;assert(p.ad.show(()=>go++));assert.equal(p.ad.show(()=>go++),false);await flush();assert.equal(go,0);
 p.callbacks.interstitialAdDismissed();p.callbacks.interstitialAdDismissed();await flush();assert.equal(go,1);assert.equal(p.counts().prepares,2);
});
test('consent prevents load and display; failed load does not retry in a loop',async()=>{
 const denied=provider({allowed:false});await denied.ad.preload();assert.equal(denied.counts().prepares,0);
 const p=provider();await p.ad.preload();p.deny();assert.equal(p.ad.show(()=>assert.fail()),false);
 const failed=provider({failLoad:true});await failed.ad.preload();await flush();assert.equal(failed.counts().prepares,1);assert.equal(failed.ad.show(()=>assert.fail()),false);
});
test('failed show callback/rejection continues once and preloads next',async()=>{
 const p=provider({failShow:true});await p.ad.preload();let go=0;p.ad.show(()=>go++);await flush();p.callbacks.interstitialAdFailedToShow();assert.equal(go,1);
});
test('iOS install is inert; Android normal completion uses endGame gate and ignores invalid/aborted results',()=>{
 assert.equal(install({document:{},Capacitor:{getPlatform:()=> 'ios'}}),null);
 const store=storage(),win={document:{getElementById:()=>({classList:{contains:()=>true}})},Capacitor:{getPlatform:()=> 'android'},NYAN_ANDROID_CLOSED_TEST:{},localStorage:store,crypto:{randomUUID:()=> 'local-id'},addEventListener(){}};
 const api=install(win);api.begin();api.completed({playMode:'cpuCat',alreadyOver:false});api.completed({playMode:'cpuCat',alreadyOver:true});assert.equal(JSON.parse(store.getItem(KEY)).count,1);
 for(const officialResult of [{status:'cancelled',winner:'cat'},{finishReason:'disconnectForfeit',winner:'cat'},null]){api.begin();api.completed({playMode:'onlineCat',officialResult,session:{matchId:'aborted'}});}
 api.begin();api.completed({playMode:'onlineCat',officialResult:{winner:'police',status:'finished'},session:{matchId:'room'}});assert.equal(JSON.parse(store.getItem(KEY)).count,1);api.ended({matchId:'room',matchType:'roomMatch'},{winner:'police',status:'finished'});api.ended({matchId:'room',matchType:'roomMatch'},{winner:'police',status:'finished'});assert.equal(JSON.parse(store.getItem(KEY)).count,2);
 const source=fs.readFileSync('game.js','utf8'),android=transform('game.js',source,'android');new vm.Script(android);
 assert.equal(transform('game.js',source,'ios'),source);assert(android.includes('alreadyOver:game.gameOver'));
 for(const name of ['resultHomeBtn','againBtn'])assert(android.includes('bindPress('+name+',window.NyanAndroidInterstitial.wrap('));
});
