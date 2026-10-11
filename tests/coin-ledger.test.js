const test=require('node:test');
const assert=require('node:assert/strict');
const {initialProfile}=require('../server/online-profile.mjs');
const {migrateLegacyCoins,purchaseCoinItem,recordCoinBattle,claimCoinDaily,coinDay}=require('../server/coin-ledger.mjs');
const {applyVerifiedDailyAd:grantVerifiedDailyAd}=require('../server/daily-ad-reward.mjs');
class Store{
  values=new Map();
  async get(key){return structuredClone(this.values.get(key));}
  async put(key,value){for(const [k,v] of typeof key==='string'?[[key,value]]:Object.entries(key))this.values.set(k,structuredClone(v));}
  async transaction(fn){
    const before=structuredClone(this.values);
    try{return await fn(this);}catch(error){this.values=before;throw error;}
  }
}
const key='profile:test';
const migrationId='legacy:test:0001';
const claims={ownedCatSkins:['default','cat_coin_01'],ownedDogSkins:['default'],ownedBoardThemes:['default'],ownedCardboards:['default'],ownedPaws:['default']};
async function setup(coins=100,ownership=claims){const storage=new Store();await storage.put(key,initialProfile({},'op_test',Date.UTC(2026,8,6)));await migrateLegacyCoins({storage,profileKey:key,input:{migrationId,localCoins:coins,ownership},now:Date.UTC(2026,8,6)});return storage;}
test('migration imports once, survives response loss, rejects other ID and unknown ownership',async()=>{
  const storage=await setup(20),input={migrationId,localCoins:20,ownership:claims};
  assert.equal((await migrateLegacyCoins({storage,profileKey:key,input})).duplicate,true);
  assert.equal((await storage.get(key)).serverNyanCoins,20);
  await assert.rejects(migrateLegacyCoins({storage,profileKey:key,input:{...input,migrationId:'legacy:test:0002'}}),/migration_already_completed/);
  await assert.rejects(migrateLegacyCoins({storage:new Store(),profileKey:key,input:{...input,ownership:{...claims,ownedPaws:['evil']}}}),/invalid_migration_item/);
});
test('purchase is atomic and idempotent across all categories',async()=>{
  const items=[['catSkin','cat_coin_01',500],['dogSkin','dog_coin_01',500],['boardTheme','board_coin_01',60],['cardboard','cardboard_coin_01',30],['paw','paw_coin_01',30]];
  for(const [categoryId,itemId,price] of items){
    const storage=await setup(1000,{...claims,ownedCatSkins:['default']}),input={categoryId,itemId,requestId:`buy:${itemId}:0001`};
    {
      const first=await purchaseCoinItem({storage,profileKey:key,input});
      assert.equal(first.profile.serverNyanCoins,1000-price);
      const replay=await purchaseCoinItem({storage,profileKey:key,input});
      assert.equal(replay.duplicate,true);assert.equal(replay.profile.serverNyanCoins,1000-price);
      assert.equal((await storage.get(key)).serverNyanCoins,1000-price);
      await assert.rejects(purchaseCoinItem({storage,profileKey:key,input:{...input,requestId:`again:${itemId}:0001`}}),/already_owned/);
    }
  }
});
test('insufficient balance and request ID conflict never deduct',async()=>{
  const storage=await setup(20),input={categoryId:'cardboard',itemId:'cardboard_coin_01',requestId:'buy:box:0001'};
  await assert.rejects(purchaseCoinItem({storage,profileKey:key,input}),/insufficient_coins/);
  assert.equal((await storage.get(key)).serverNyanCoins,20);
  const funded=await storage.get(key);funded.serverNyanCoins=100;await storage.put(key,funded);
  await purchaseCoinItem({storage,profileKey:key,input});
  await assert.rejects(purchaseCoinItem({storage,profileKey:key,input:{...input,categoryId:'paw',itemId:'paw_coin_01'}}),/request_id_conflict/);
  assert.equal((await storage.get(key)).serverNyanCoins,70);
});
test('legacy local 20 plus existing Worker 80 becomes one spendable balance',async()=>{
  const storage=new Store(),base=initialProfile({},'op_test',Date.UTC(2026,8,6));
  base.serverNyanCoins=80;await storage.put(key,base);
  const migrated=await migrateLegacyCoins({storage,profileKey:key,
    input:{migrationId,localCoins:20,ownership:{...claims,ownedCatSkins:['default']}},now:Date.UTC(2026,8,6)});
  assert.equal(migrated.profile.serverNyanCoins,100);
  const purchase=await purchaseCoinItem({storage,profileKey:key,
    input:{categoryId:'cardboard',itemId:'cardboard_coin_01',requestId:'buy:box:mixed:001'}});
  assert.equal(purchase.profile.serverNyanCoins,70);
});
test('daily progress and rewards are server-owned and replay-safe',async()=>{
  const now=Date.UTC(2026,8,6,12),storage=await setup(0),date=coinDay(now);
  for(let n=0;n<6;n++){
    const input={battleId:`battle_${n}_0001`,source:'cpu',side:n<3?'cat':'police',won:true,completed:true,completedAt:now};
    await recordCoinBattle({storage,profileKey:key,input,now});
    assert.equal((await recordCoinBattle({storage,profileKey:key,input,now})).duplicate,true);
  }
  for(const missionId of ['playOneBattle','winAsCat','winAsPolice','allClear']){
    const result=await claimCoinDaily({storage,profileKey:key,input:{date,missionId},now});
    assert.equal(result.duplicate,false);
    assert.equal((await claimCoinDaily({storage,profileKey:key,input:{date,missionId},now})).duplicate,true);
  }
  assert.equal((await storage.get(key)).serverNyanCoins,80);
  const current=await storage.get(key);
  await grantVerifiedDailyAd({storage,profileKey:key,profile:current,verificationId:'daily:reward:001',verify:async()=>true,now});
  assert.equal((await storage.get(key)).serverNyanCoins,130);
});
test('no non-atomic fallback',async()=>{
  await assert.rejects(purchaseCoinItem({storage:{},profileKey:key,input:{requestId:'buy:box:0001',categoryId:'cardboard',itemId:'cardboard_coin_01'}}),/atomic_storage_unavailable/);
});
test('verified daily ad grants only once, failed verification grants nothing, next day resets',async()=>{
  const storage=await setup(0),now=Date.UTC(2026,8,6,12),profile=await storage.get(key);
  const input={storage,profileKey:key,profile,verificationId:'attempt:test:001',verification:{},now};
  await assert.rejects(grantVerifiedDailyAd({...input,verify:async()=>false}),/reward_not_verified/);
  assert.equal((await storage.get(key)).serverNyanCoins,0);
  assert.equal((await grantVerifiedDailyAd({...input,verify:async()=>true})).applied,true);
  assert.equal((await grantVerifiedDailyAd({...input,verify:async()=>true})).duplicate,true);
  assert.equal((await storage.get(key)).serverNyanCoins,50);
  assert.equal((await grantVerifiedDailyAd({...input,verificationId:'attempt:test:002',now:now+86400000,verify:async()=>true})).applied,true);
  assert.equal((await storage.get(key)).serverNyanCoins,100);
});
test('authenticated purchase API uses one Worker transaction and rejects unverified random battle',async()=>{
  const {profileRequest}=require('../server/online-profile.mjs');
  const storage=new Store(),token='ab'.repeat(32),headers={Authorization:`Bearer ${token}`};
  const call=(path,body)=>profileRequest(storage,new Request(`https://players/${path}`,{method:'POST',headers,body:JSON.stringify(body)}));
  await call('register',{playerId:'ncp_1234567890abcdef'});
  const migrated=await call('coin-migration',{migrationId,localCoins:100,
    ownership:{...claims,ownedCatSkins:['default']}});
  assert.equal(migrated.status,200);
  const input={categoryId:'boardTheme',itemId:'board_coin_01',requestId:'buy:board:0001'};
  assert.equal((await call('coin-purchase',input)).status,200);
  const replay=await (await call('coin-purchase',input)).json();
  assert.equal(replay.duplicate,true);assert.equal(replay.profile.serverNyanCoins,40);
  const oldClient=await (await call('appearance',{collectionOwnership:{ownedDogSkins:['dog_coin_01']}})).json();
  assert.equal(oldClient.profile.ownedDogSkins.includes('dog_coin_01'),false);
  const invalid=await call('coin-battle',{battleId:'rm_unverified_0001',source:'randomMatch',side:'cat',won:true,completed:true,completedAt:Date.now()});
  assert.equal(invalid.status,409);
});
