const test=require('node:test');
const assert=require('node:assert/strict');
const daily=import('../server/daily-ad-reward.mjs');
class Storage{
  values=new Map();
  async get(key){return structuredClone(this.values.get(key));}
  async put(key,value){for(const [k,v] of typeof key==='string'?[[key,value]]:Object.entries(key))this.values.set(k,structuredClone(v));}
  async transaction(callback){return callback(this);}
}
test('検証済み広告だけ50、同日二重callback・別試行を拒否し翌日再受取',async()=>{
  const {applyVerifiedDailyAd}=await daily,storage=new Storage(),profileKey='profile:p';
  await storage.put(profileKey,{playerId:'p',serverNyanCoins:0});
  const date=Date.parse('2026-10-09T12:00:00+09:00');
  const claim=(id,now=date,verified=true)=>applyVerifiedDailyAd({storage,profileKey,profile:{playerId:'p'},verificationId:id,now,verify:async()=>verified});
  await assert.rejects(claim('attempt_failed',date,false),/reward_not_verified/);
  assert.equal((await storage.get(profileKey)).serverNyanCoins,0);
  assert.equal((await claim('attempt_first')).profile.serverNyanCoins,50);
  assert.equal((await claim('attempt_first')).duplicate,true);
  await assert.rejects(claim('attempt_second'),/daily_ad_already_claimed/);
  assert.equal((await storage.get(profileKey)).serverNyanCoins,50);
  assert.equal((await claim('attempt_next',date+86400000)).profile.serverNyanCoins,100);
});
test('個別50＋全クリア30＋広告50でデイリー最大130',async()=>{
  const {applyVerifiedDailyAd}=await daily,storage=new Storage(),profileKey='profile:p';
  await storage.put(profileKey,{playerId:'p',serverNyanCoins:0});
  const result=await applyVerifiedDailyAd({storage,profileKey,profile:{playerId:'p'},verificationId:'attempt_total',
    now:Date.parse('2026-10-09T12:00:00+09:00'),verify:async()=>true});
  assert.equal(10+20+20+30+result.profile.serverNyanCoins,130);
});
test('プロフィールAPIは未検証を拒否し検証済みのデイリー報酬だけ反映',async()=>{
  const {profileRequest}=await import('../server/online-profile.mjs'),storage=new Storage(),token='cd'.repeat(32);
  const request=(path,body)=>new Request(`https://players${path}`,{method:body?'POST':'GET',
    headers:{Authorization:`Bearer ${token}`},body:body?JSON.stringify(body):undefined});
  await profileRequest(storage,request('/register',{}));
  const payload={rewardType:'DAILY_COIN_REWARD',verificationId:'attempt_profile',verification:{}};
  const denied=await profileRequest(storage,request('/rewarded-ad-completion',payload));
  assert.equal(denied.status,503);
  const accepted=await profileRequest(storage,request('/rewarded-ad-completion',payload),{
    now:Date.parse('2026-10-09T12:00:00+09:00'),verifyRewardedAd:async()=>true});
  assert.equal(accepted.status,200);
  const profile=(await accepted.json()).profile;
  assert.equal(profile.serverNyanCoins,50);
  assert.equal(profile.dailyAdRewardDate,'2026-10-09');
});
