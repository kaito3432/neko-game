const test=require('node:test');
const assert=require('node:assert/strict');
const gifts=import('../server/pass-gift-box.mjs');
const online=import('../server/online-profile.mjs');
const stamina=import('../server/ranked-stamina.mjs');
const at=value=>Date.parse(value);
const pass=(startsAt,expiresAt,id='period-1')=>({store:'app_store',period:{id,startsAt,expiresAt},verifiedAt:startsAt,autoRenewing:false});
class Store{
  values=new Map();pending=Promise.resolve();
  async get(key){return structuredClone(this.values.get(key));}
  async put(key,value){this.values.set(key,structuredClone(value));}
  transaction(fn){const task=this.pending.then(()=>fn(this));this.pending=task.catch(()=>{});return task;}
}

test('JST日付で同日1回、非連続15回まで1/2/3を各5回・合計30を発行',async()=>{
  const {grantPassLoginGiftIfEligible:grant}=await gifts;
  const {initialProfile}=await online;
  const start=at('2027-01-01T00:00:00+09:00');
  let profile={...initialProfile({},'op_test',start),passSubscription:pass(start-1000,start+100*86400000)};
  const amounts=[];
  for(let day=0;day<16;day++){
    const now=start+day*2*86400000+1000,result=grant(profile,now);
    profile=result.profile;
    if(day<15){assert.equal(result.granted,true);amounts.push(result.reward.amount);}
    else assert.equal(result.granted,false);
    assert.equal(grant(profile,now+1000).granted,false);
  }
  assert.deepEqual(amounts,[...Array(5).fill(1),...Array(5).fill(2),...Array(5).fill(3)]);
  assert.equal(amounts.reduce((a,b)=>a+b),30);
  assert.equal(profile.passLoginProgress.issuedCount,15);
});

test('JST日付境界・期間更新・旧Gift保持・期限切れPassは新規発行なし',async()=>{
  const {grantPassLoginGiftIfEligible:grant}=await gifts;
  const {initialProfile}=await online;
  const before=at('2027-01-31T23:59:59+09:00'),after=before+1000;
  let profile={...initialProfile({},'op_test',before),passSubscription:pass(before-1000,after+86400000)};
  const first=grant(profile,before);assert.equal(first.granted,true);
  const second=grant(first.profile,after);assert.equal(second.granted,true);
  assert.equal(second.profile.giftBox.rewards.length,2);
  assert.equal(grant(second.profile,after+86400000).granted,false);
  profile={...second.profile,passSubscription:pass(after+86400000,after+10*86400000,'period-2')};
  const renewed=grant(profile,after+86400000);
  assert.equal(renewed.granted,true);assert.equal(renewed.profile.passLoginProgress.issuedCount,1);
  assert.equal(renewed.profile.giftBox.rewards.length,3);
});

test('Gift claimは90日境界と重複を検証し、スタミナ5超を保持',async()=>{
  const {applyPassLoginGift,claimGiftReward,PASS_LOGIN_GIFT_EXPIRY_MS,publicGiftBox}=await gifts;
  const {initialProfile}=await online;
  const {normalizeRankedStamina,consumeRankedStamina}=await stamina;
  const now=at('2027-01-01T00:00:00+09:00'),store=new Store(),key='profile:test';
  await store.put(key,{...initialProfile({},'op_test',now),passSubscription:pass(now-1000,now+86400000)});
  const [first,second]=await Promise.all([applyPassLoginGift({storage:store,profileKey:key,now}),applyPassLoginGift({storage:store,profileKey:key,now})]);
  assert.equal([first,second].filter(r=>r.granted).length,1);
  const rewardId=first.granted?first.reward.rewardId:second.reward.rewardId;
  const result=await claimGiftReward({storage:store,profileKey:key,rewardId,now:now+1});
  assert.equal(result.profile.rankedStamina.stamina,6);
  assert.equal(normalizeRankedStamina(result.profile.rankedStamina,now+2).stamina,6);
  assert.equal(consumeRankedStamina(result.profile,now+2).rankedStamina.stamina,5);
  assert.equal(publicGiftBox(result.profile,now+2).badgeCount,0);
  await assert.rejects(claimGiftReward({storage:store,profileKey:key,rewardId,now:now+2}),/gift_already_claimed/);
  const other=new Store(),otherKey='profile:expired';
  await other.put(otherKey,{...initialProfile({},'op_other',now),passSubscription:pass(now-1000,now+86400000)});
  const issued=await applyPassLoginGift({storage:other,profileKey:otherKey,now});
  assert.equal(publicGiftBox(issued.profile,now+PASS_LOGIN_GIFT_EXPIRY_MS).rewards[0].status,'expired');
  await assert.rejects(claimGiftReward({storage:other,profileKey:otherKey,rewardId:issued.reward.rewardId,now:now+PASS_LOGIN_GIFT_EXPIRY_MS}),/gift_expired/);
});

test('未認証claim不可・登録payloadのPass/Gift自己申告は無視',async()=>{
  const {profileRequest,digestToken}=await online;
  const now=at('2027-01-01T00:00:00+09:00'),token='ab'.repeat(32),key=`profile:${await digestToken(token)}`,store=new Store();
  const forged={passSubscription:pass(now-1000,now+86400000),passLoginProgress:{issuedCount:15},
    giftBox:{rewards:[{rewardId:'forged',rewardType:'STAMINA',amount:999,createdAt:now,expiresAt:now+1000,source:'NYAN_CHASE_PASS_LOGIN'}]}};
  const request=(path,method='GET',body)=>new Request(`https://players${path}`,{method,
    headers:{Authorization:`Bearer ${token}`},body:body?JSON.stringify(body):undefined});
  const created=await (await profileRequest(store,request('/register','POST',forged),{now})).json();
  assert.equal(created.profile.passSubscription.period,null);
  assert.deepEqual(created.profile.giftBox.rewards,[]);
  assert.equal((await (await profileRequest(store,request('/gift-claim','POST',{rewardId:'forged'}),{now})).json()).error,'gift_not_found');
  const saved=await store.get(key);assert.equal(saved.rankedStamina.stamina,5);
  const unauth=await profileRequest(store,new Request('https://players/gifts'),{now});assert.equal(unauth.status,401);
});

test('10+3 overflow、失効後claim、89日末の受取は保持',async()=>{
  const {applyPassLoginGift,claimGiftReward,PASS_LOGIN_GIFT_EXPIRY_MS}=await gifts;
  const {initialProfile}=await online;
  const now=at('2027-01-01T00:00:00+09:00'),store=new Store(),key='profile:bonus';
  const profile=initialProfile({},'op_bonus',now);
  profile.passSubscription=pass(now-1000,now+86400000);
  profile.passLoginProgress={periodId:'period-1',issuedCount:10,lastDateKey:'2026-12-31'};
  profile.rankedStamina={stamina:10,lastRecoveryAt:now,adRecoveryCount:0,adRecoveryDateKey:'2027-01-01'};
  await store.put(key,profile);
  const issued=await applyPassLoginGift({storage:store,profileKey:key,now});
  assert.equal(issued.reward.amount,3);
  assert.equal(issued.profile.rankedStamina.stamina,10);
  const end=now+PASS_LOGIN_GIFT_EXPIRY_MS-1;
  const claimed=await claimGiftReward({storage:store,profileKey:key,rewardId:issued.reward.rewardId,now:end});
  assert.equal(claimed.profile.rankedStamina.stamina,13);
  assert.equal(claimed.profile.giftBox.rewards[0].claimedAt,end);
  assert.equal((await store.get(key)).rankedStamina.stamina,13);
});

test('並行二重claimは1件だけ成功、clientのamount上書きは無視',async()=>{
  const {applyPassLoginGift}=await gifts;
  const {profileRequest,digestToken,initialProfile}=await online;
  const now=at('2027-01-01T00:00:00+09:00'),store=new Store(),token='cd'.repeat(32);
  const key=`profile:${await digestToken(token)}`;
  await store.put(key,{...initialProfile({},'op_race',now),passSubscription:pass(now-1000,now+86400000)});
  const issued=await applyPassLoginGift({storage:store,profileKey:key,now});
  const req=()=>new Request('https://players/gift-claim',{method:'POST',headers:{Authorization:`Bearer ${token}`},
    body:JSON.stringify({rewardId:issued.reward.rewardId,amount:999,expiresAt:Date.UTC(2099,0),claimed:false,loginIndex:999})});
  const results=await Promise.all([profileRequest(store,req(),{now:now+1}),profileRequest(store,req(),{now:now+1})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const saved=await store.get(key);
  assert.equal(saved.rankedStamina.stamina,6);
  assert.equal(saved.giftBox.rewards[0].amount,1);
  assert.equal(saved.giftBox.rewards[0].expiresAt,issued.reward.expiresAt);
});

test('Phase3 Skin mapping未設定でもGiftを発行し、旧profile欠損を補完',async()=>{
  const {profileRequest,digestToken,initialProfile}=await online;
  const now=at('2027-01-01T00:00:00+09:00'),store=new Store(),token='ef'.repeat(32);
  const key=`profile:${await digestToken(token)}`,old=initialProfile({},'op_old',now);
  delete old.giftBox;delete old.passLoginProgress;old.passSubscription=pass(now-1000,now+86400000);
  await store.put(key,old);
  const request=new Request('https://players/profile',{headers:{Authorization:`Bearer ${token}`}});
  const response=await (await profileRequest(store,request,{now,passSkinPeriods:{}})).json();
  assert.equal(response.passSkinReward,undefined);
  assert.equal(response.passLoginGift.amount,1);
  assert.equal(response.profile.giftBox.rewards.length,1);
  assert.equal(response.profile.passLoginProgress.issuedCount,1);
});
