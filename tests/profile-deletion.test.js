const test=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
globalThis.crypto||=webcrypto;

class Store{
  values=new Map();failRetained=false;
  async get(key){return structuredClone(this.values.get(key));}
  async put(key,value){
    for(const [k,v] of typeof key==='string'?[[key,value]]:Object.entries(key)){
      if(this.failRetained&&k.startsWith('storekit:')&&v?.state==='deleted')throw Error('snapshot_failed');
      this.values.set(k,structuredClone(v));
    }
  }
  async delete(key){this.values.delete(key);}
  async list({prefix=''}={}){return new Map([...this.values].filter(([key])=>key.startsWith(prefix)));}
  async transaction(fn){const before=structuredClone(this.values);try{return await fn(this);}
    catch(error){this.values=before;throw error;}}
}
const secret='a'.repeat(64),otherSecret='b'.repeat(64),now=Date.parse('2026-11-10T12:00:00Z');
const modules=Promise.all([import('../server/online-profile.mjs'),import('../server/profile-deletion.mjs')]);
function request(path,token=secret,method='GET',body){return new Request(`https://players${path}`,{
  method,headers:token?{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}:{},
  ...(body?{body:JSON.stringify(body)}:{})});}
async function setup(){const [online]=await modules,storage=new Store();
  const response=await online.profileRequest(storage,request('/register',secret,'POST',{}),{now});
  assert.equal(response.status,200);const {profile}=await response.json();
  return {online,storage,profile};}

test('本人Bearerだけが削除でき、bodyの別playerIdは無視される',async()=>{
  const {online,storage,profile}=await setup();
  assert.equal((await online.profileRequest(storage,request('/profile',null,'DELETE'),{now})).status,401);
  assert.equal((await online.profileRequest(storage,request('/profile',otherSecret,'DELETE'),{now})).status,401);
  const response=await online.profileRequest(storage,request('/profile',secret,'DELETE',{playerId:'op_other'}),{now});
  assert.equal(response.status,200);assert.equal((await response.json()).deleted,true);
  assert.equal(await storage.get(`profile-key:${profile.playerId}`),undefined);
  assert.equal((await online.profileRequest(storage,request('/profile',secret,'DELETE'),{now})).status,200);
  assert.equal((await online.profileRequest(storage,request('/register',secret,'POST',{}),{now})).status,410);
  const fresh=await online.profileRequest(storage,request('/register',otherSecret,'POST',{}),{now});
  assert.equal(fresh.status,200);assert.notEqual((await fresh.json()).profile.playerId,profile.playerId);
});

test('購入snapshot失敗時はプロフィールを残し、成功時は通常進行を消してbindingを保持',async()=>{
  const {online,storage,profile}=await setup();
  const key=await storage.get(`profile-key:${profile.playerId}`);
  await storage.put(key,{...profile,serverNyanCoins:200,ranked:{rp:800},giftBox:{rewards:['gift']}});
  await storage.put('storekit:purchase',{playerId:profile.playerId,productId:'SKILL_PACK_01'});
  storage.failRetained=true;
  assert.equal((await online.profileRequest(storage,request('/profile',secret,'DELETE'),{now})).status,500);
  assert.equal((await storage.get(key)).serverNyanCoins,200);
  storage.failRetained=false;
  assert.equal((await online.profileRequest(storage,request('/profile',secret,'DELETE'),{now})).status,200);
  assert.equal(await storage.get(key),undefined);
  const retained=await storage.get('storekit:purchase');
  assert.equal(retained.state,'deleted');
  assert.equal(retained.productId,'SKILL_PACK_01');
  assert.equal(JSON.stringify(retained).includes(profile.playerId),false);
  assert.equal(JSON.stringify(retained).includes('serverNyanCoins'),false);
});

test('対戦中・待機中は削除を拒否する',async()=>{
  const {online,storage,profile}=await setup();
  await storage.put(`queue:${profile.playerId}`,{status:'waiting'});
  assert.equal((await online.profileRequest(storage,request('/profile',secret,'DELETE'),{now})).status,409);
  assert.ok(await storage.get(`profile-key:${profile.playerId}`));
  await storage.delete(`queue:${profile.playerId}`);
  await storage.put(`active:${profile.playerId}`,{roomCode:'ABCDE'});
  assert.equal((await online.profileRequest(storage,request('/profile',secret,'DELETE'),{
    now,checkActiveRoom:async()=>true})).status,409);
});

test('削除後の新profileへStore再検証時だけ買い切り権利が戻り、進行は戻らない',async()=>{
  const {online,storage,profile}=await setup();
  const oldKey=await storage.get(`profile-key:${profile.playerId}`);
  await storage.put(oldKey,{...profile,serverNyanCoins:500,ranked:{rp:900}});
  await storage.put('storekit:100',{playerId:profile.playerId,productId:'SKILL_PACK_01',purchaseDate:now-1000});
  assert.equal((await online.profileRequest(storage,request('/profile',secret,'DELETE'),{now})).status,200);
  const freshResponse=await online.profileRequest(storage,request('/register',otherSecret,'POST',{}),{now});
  const fresh=(await freshResponse.json()).profile;
  assert.equal(fresh.serverNyanCoins,0);
  assert.equal(fresh.skillEntitlements.purchasedProductIds.length,0);
  const freshKey=await storage.get(`profile-key:${fresh.playerId}`);
  const apple=await import('../server/storekit-verification.mjs');
  const restored=await apple.applyVerifiedStoreTransaction({storage,profileKey:freshKey,profile:fresh,
    signedTransaction:'jws',restore:true,setAccountToken:async()=>true,
    verify:async()=>({transactionId:'100',originalTransactionId:'100',productId:'SKILL_PACK_01',
      purchaseDate:now-1000,environment:'Sandbox',appAccountToken:profile.playerId.slice(3)})});
  assert.ok(restored.profile.skillEntitlements.purchasedProductIds.includes('SKILL_PACK_01'));
  assert.equal(restored.profile.serverNyanCoins,0);
});

test('削除後も取得済みPass月間SkinはStore再検証で戻り、未取得分は増えない',async()=>{
  const {online,storage,profile}=await setup();
  const oldKey=await storage.get(`profile-key:${profile.playerId}`);
  await storage.put(oldKey,{...profile,serverNyanCoins:400,passSkinRewardsClaimed:[
    {monthKey:'2026-11',skinId:'cat_pass_2026_11_starlight',claimedAt:now-500}]});
  await storage.put('pass-original:sandbox:200',{playerId:profile.playerId,productId:'pass',
    verifiedAt:now-1000});
  await storage.put(`pass-store:${profile.playerId}`,{originalTransactionId:'200',productId:'pass'});
  assert.equal((await online.profileRequest(storage,request('/profile',secret,'DELETE'),{now})).status,200);
  const marker=await storage.get('pass-original:sandbox:200');
  assert.equal(marker.state,'deleted');
  assert.deepEqual(marker.passSkinRewards.map(reward=>reward.skinId),['cat_pass_2026_11_starlight']);
  const fresh=(await (await online.profileRequest(storage,request('/register',otherSecret,'POST',{}),{now})).json()).profile;
  assert.equal(fresh.passSkinRewardsClaimed.length,0);
  const freshKey=await storage.get(`profile-key:${fresh.playerId}`);
  const applePass=await import('../server/pass-storekit.mjs');
  const restored=await applePass.applyVerifiedApplePass({storage,profileKey:freshKey,profile:fresh,now,
    receipt:{store:'app_store',environment:'sandbox',productId:'pass',groupId:'group',
      originalTransactionId:'200',transactionId:'201',periodId:'apple:201',
      appAccountToken:profile.playerId.slice(3),startsAt:now-1000,expiresAt:now+86400000,autoRenewing:false},
    restore:true,setAccountToken:async()=>true});
  assert.ok(restored.profile.ownedCatSkins.includes('cat_pass_2026_11_starlight'));
  assert.equal(restored.profile.passSkinRewardsClaimed.length,1);
  assert.equal(restored.profile.serverNyanCoins,0);
});
