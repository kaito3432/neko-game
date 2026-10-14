const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Ads=require('../rewarded-ad-provider.js');
function fixture({error=null,initializeError=null,consent=true,id='ca-app-pub-6462457361541481/4339169364',unlocked=false,completeError=null,prepare=null}={}){
  const listeners={},events={},nodes={};let loads=0,shows=0,attempts=0,completions=0;
  for(const id of ['skillModeUnlockPanel','skillModeUnlockProgress','skillModeUnlockDots','skillModeAdStatus','skillModeAdButton'])nodes[id]={textContent:'',disabled:false,replaceChildren(){},addEventListener(name,fn){this[name]=fn;}};
  const plugin={initialize:async()=>{if(initializeError)throw initializeError;},addListener:async(name,fn)=>{listeners[name]=fn;return {remove(){delete listeners[name];}};},prepareRewardVideoAd:async options=>{loads++;assert.equal(options.npa,true);assert.equal(options.isTesting,false);if(prepare)await prepare();if(error)throw error;},showRewardVideoAd:async()=>{shows++;listeners.onRewardedVideoAdReward?.();}};
  const api={createAttempt:async()=>{attempts++;return {playerId:'p',attemptId:'a'+attempts};},completeAttempt:async()=>{completions++;if(completeError)throw completeError;return {verified:true};}};
  const manager={ensure:async()=>({canRequestAds:consent}),canRequestAds:()=>consent};
  const root={document:{getElementById:id=>nodes[id],createElement:()=>({})},NyanMonetization:{getState:()=>({skillModeUnlocked:unlocked,skillModeUnlockAdViews:unlocked?3:0})},addEventListener:(name,fn)=>{events[name]=fn;}};
  const provider=Ads.createProvider({plugin,api,config:{platform:'ios',testing:false,rewardedAdUnitId:id,consentManager:manager,verificationAttempts:1},onState:detail=>events['nyan-rewarded-ad-state']?.({detail})});
  root.NyanRewardedAds={...Ads,provider};vm.runInNewContext(fs.readFileSync(require.resolve('../rewarded-ad-ui.js'),'utf8'),root);
  return {provider,button:nodes.skillModeAdButton,status:nodes.skillModeAdStatus,panel:nodes.skillModeUnlockPanel,ready:()=>new Promise(r=>setImmediate(r)),counts:()=>({loads,shows,attempts,completions})};
}
for(const message of ['Request Error: No ad to show.','temporary network error','Loading failed'])test('transient load failure allows manual retry: '+message,async()=>{
  const f=fixture({error:Error(message)});await f.ready();await f.button.click();
  assert.equal(f.provider.isBusy(),false);assert.equal(f.provider.getState(),Ads.STATES.RETRYABLE);assert.equal(f.button.disabled,false);assert.match(f.status.textContent,/時間をおいて/);
  assert.deepEqual(f.counts(),{loads:1,shows:0,attempts:1,completions:0});await f.ready();assert.equal(f.counts().loads,1);
  await f.button.click();assert.equal(f.counts().attempts,2);
});
for(const [name,opts] of [['consent denied',{consent:false}],['missing ID',{id:''}],['invalid ID',{id:'invalid'}],['SDK initialize failure',{initializeError:Error('SDK unavailable')}],['production rejects demo ID',{id:Ads.IOS_TEST_REWARDED_ID}]])test(name+' stays disabled',async()=>{
  const f=fixture(opts);await f.ready();assert.equal(f.button.disabled,true);assert.equal(f.provider.canRequestAd(),false);assert.equal(f.counts().loads,0);
});
test('loading blocks repeated requests and success keeps normal show/SSV flow',async()=>{
  let release;const f=fixture({prepare:()=>new Promise(r=>{release=r;})});await f.ready();const pending=f.button.click();await f.ready();
  assert.equal(f.button.disabled,true);assert.equal((await f.provider.showRewardedAd()).reason,'busy');release();await pending;
  assert.deepEqual(f.counts(),{loads:1,shows:1,attempts:1,completions:1});assert.equal(f.provider.isBusy(),false);
});
test('SSV rejection never grants verified progress',async()=>{
  const error=Error('unverified');error.status=403;const f=fixture({completeError:error});await f.ready();
  const result=await f.provider.showRewardedAd();assert.equal(result.rewarded,false);assert.equal(result.verified,undefined);assert.equal(f.provider.canRequestAd(),false);assert.equal(f.provider.isBusy(),false);
});
test('3/3 unlocked stays hidden and disabled',async()=>{const f=fixture({unlocked:true});await f.ready();assert.equal(f.panel.hidden,true);assert.equal(f.button.disabled,true);});
test('Daily load failure still releases busy without claiming reward',async()=>{
  const f=fixture({error:Error('No Fill')});await f.ready();const r=await f.provider.showRewardedAd(Ads.DAILY_REWARD_TYPE);
  assert.equal(r.rewarded,false);assert.equal(f.provider.isBusy(),false);assert.equal(f.counts().completions,0);
});
test('explicit SDK invalid-request error is not classified transient',async()=>{const f=fixture({error:Error('Invalid ad unit ID')});await f.ready();await f.button.click();assert.equal(f.button.disabled,true);assert.equal(f.provider.getState(),Ads.STATES.UNAVAILABLE);});
