const test=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
globalThis.crypto||=webcrypto;

class Store{
  values=new Map();failRetained=false;failAudit=false;
  async get(key){return structuredClone(this.values.get(key));}
  async put(key,value){
    for(const [k,v] of typeof key==='string'?[[key,value]]:Object.entries(key)){
      if(this.failRetained&&k.startsWith('storekit:')&&v?.state==='deleted')throw Error('snapshot_failed');
      if(this.failAudit&&k.startsWith('admin-delete-audit:'))throw Error('audit_failed');
      this.values.set(k,structuredClone(v));
    }
  }
  async delete(key){this.values.delete(key);}
  async list({prefix=''}={}){return new Map([...this.values].filter(([key])=>key.startsWith(prefix)));}
  async transaction(fn){const before=structuredClone(this.values);try{return await fn(this);}
    catch(error){this.values=before;throw error;}}
}
const now=Date.parse('2026-11-10T12:00:00Z');
const playerId='op_12345678-1234-1234-1234-123456789abc';
const credential='a'.repeat(64),adminSecret='s'.repeat(48);
const env={PROFILE_ADMIN_DELETE_ENABLED:'true',PROFILE_ADMIN_DELETE_SECRET:adminSecret};
const modules=Promise.all([import('../server/admin-profile-deletion.mjs'),
  import('../server/online-profile.mjs')]);
const body={playerId,supportReference:'ticket_1234',reason:'external_verified_request'};
function request(action,input=body,secret=adminSecret,actor='support_01'){
  return new Request(`https://players/internal/admin-profile-deletion/${action}`,{method:'POST',
    headers:{Authorization:`Bearer ${secret}`,'x-nyan-admin-actor':actor,
      'content-type':'application/json'},body:JSON.stringify(input)});
}
async function setup(){
  const [admin]=await modules,storage=new Store(),profileKey='profile:credential-hash';
  const profile={playerId,createdAt:now-1000,serverNyanCoins:300,
    ranked:{rank:'silver',rp:600,lifetimeWins:10,lifetimeLosses:5},
    profileCharacter:{category:'catSkin',itemId:'default'},
    passSkinRewardsClaimed:[{monthKey:'2026-11',skinId:'cat_pass_2026_11_starlight',claimedAt:now-1000}]};
  await storage.put(profileKey,profile);
  await storage.put(`profile-key:${playerId}`,profileKey);
  await storage.put('pass-original:sandbox:200',{playerId,productId:'pass',verifiedAt:now-1000});
  await storage.put(`pass-store:${playerId}`,{originalTransactionId:'200',productId:'pass'});
  await storage.put('storekit:purchase',{playerId,productId:'SKILL_PACK_01',purchaseDate:now-1000});
  const call=(action,input=body,options={})=>admin.adminProfileDeletionRequest(storage,
    request(action,input,options.secret??adminSecret,options.actor??'support_01'),
    {env:options.env??env,now:options.now??now,checkActiveRoom:options.checkActiveRoom??(async()=>false)});
  return {storage,call,profileKey};
}
async function preview(call){
  const response=await call('preview');assert.equal(response.status,200);
  return response.json();
}
const execution=p=>({...body,requestId:p.requestId,confirmationToken:p.confirmationToken,
  confirm:true,confirmPlayerId:playerId});

test('admin gate, Bearer, actor and browser Origin are required',async()=>{
  const {call}=await setup();
  assert.equal((await call('preview',body,{env:{}})).status,404);
  assert.equal((await call('preview',body,{env:{PROFILE_ADMIN_DELETE_ENABLED:'true'}})).status,503);
  assert.equal((await call('preview',body,{secret:''})).status,401);
  assert.equal((await call('preview',body,{secret:'wrong'})).status,401);
  const [admin]=await modules;
  assert.equal((await admin.adminAuthorization(new Request('https://players/internal/admin-profile-deletion/preview'),env)).error.status,401);
  const originRequest=request('preview');originRequest.headers.set('origin','https://example.com');
  assert.equal((await admin.adminAuthorization(originRequest,env)).error.status,403);
});

test('preview is read only and hides credentials, purchase identities and secrets',async()=>{
  const {storage,call,profileKey}=await setup(),result=await preview(call);
  assert.equal((await storage.get(profileKey)).serverNyanCoins,300);
  assert.equal(result.profile.playerId,playerId);
  assert.equal(result.retainedPurchaseCount,2);
  assert.equal(result.acquiredPermanentPassSkin,true);
  const visible=JSON.stringify(result);
  for(const secret of [credential,adminSecret,'storekit:purchase','pass-original:sandbox:200',
    'credential-hash'])assert.equal(visible.includes(secret),false);
  assert.equal((await call('preview',{...body,playerId:'op_00000000-0000-0000-0000-000000000000'})).status,404);
});

test('execute requires a valid fresh matching one-time preview and explicit target',async()=>{
  const {storage,call,profileKey}=await setup();
  assert.equal((await call('execute',execution({requestId:crypto.randomUUID(),
    confirmationToken:'a'.repeat(64)}))).status,409);
  const p=await preview(call);
  assert.equal((await call('execute',{...execution(p),confirmPlayerId:'op_wrong'})).status,400);
  assert.equal((await call('execute',{...execution(p),confirmationToken:'0'.repeat(64)})).status,409);
  assert.equal((await call('execute',execution(p),{actor:'other_admin'})).status,409);
  assert.equal((await call('execute',execution(p),{now:now+300001})).status,409);
  assert.ok(await storage.get(profileKey));
  const fresh=await preview(call);
  const result=await call('execute',execution(fresh),{now:now+1000});
  assert.equal(result.status,200);
  assert.equal((await result.json()).retainedPurchaseCount,2);
  assert.equal(await storage.get(profileKey),undefined);
  assert.equal((await call('execute',execution(fresh),{now:now+600001})).status,409);
});

test('stale profile, active matchmaking and active room reject deletion',async()=>{
  const {storage,call,profileKey}=await setup();
  const p=await preview(call);
  await storage.put(profileKey,{...await storage.get(profileKey),serverNyanCoins:999});
  assert.equal((await call('execute',execution(p))).status,409);
  assert.ok(await storage.get(profileKey));
  await storage.put(`queue:${playerId}`,{status:'waiting'});
  assert.equal((await call('preview')).status,409);
  await storage.delete(`queue:${playerId}`);
  await storage.put(`active:${playerId}`,{roomCode:'123456'});
  assert.equal((await call('preview',body,{checkActiveRoom:async()=>true})).status,409);
  assert.ok(await storage.get(profileKey));
});

test('purchase binding change invalidates preview without deleting the profile',async()=>{
  const {storage,call,profileKey}=await setup(),p=await preview(call);
  await storage.put('storekit:purchase',{...await storage.get('storekit:purchase'),status:'revoked'});
  assert.equal((await call('execute',execution(p))).status,409);
  assert.ok(await storage.get(profileKey));
});

test('snapshot failure rolls back; a new preview can delete while retaining purchase and Pass skin',async()=>{
  const {storage,call,profileKey}=await setup(),first=await preview(call);
  await storage.put(`ranked:match_1:${playerId}`,{rp:600});
  await storage.put(`stamina-consumed:match_1:${playerId}`,{count:1});
  storage.failRetained=true;
  assert.equal((await call('execute',execution(first))).status,503);
  assert.ok(await storage.get(profileKey));
  assert.equal((await storage.get('storekit:purchase')).playerId,playerId);
  storage.failRetained=false;
  const second=await preview(call);
  assert.equal((await call('execute',execution(second))).status,200);
  assert.equal(await storage.get(profileKey),undefined);
  assert.equal(await storage.get(`profile-key:${playerId}`),undefined);
  assert.equal([...await storage.list({prefix:'ranked:'})].length,0);
  assert.equal([...await storage.list({prefix:'stamina-consumed:'})].length,0);
  assert.equal((await storage.get('storekit:purchase')).state,'deleted');
  const retained=await storage.get('pass-original:sandbox:200');
  assert.equal(retained.state,'deleted');
  assert.equal(retained.passSkinRewards[0].skinId,'cat_pass_2026_11_starlight');
  assert.equal(JSON.stringify(retained).includes('serverNyanCoins'),false);
  const audits=[...await storage.list({prefix:'admin-delete-audit:'})].map(([,value])=>value);
  assert.deepEqual(audits.map(a=>a.result),['rejected','deleted']);
  assert.equal(audits[1].retainedPurchaseCount,2);
  const auditText=JSON.stringify(audits);
  for(const secret of [credential,adminSecret,'storekit:purchase','pass-original:sandbox:200',
    first.confirmationToken,second.confirmationToken])assert.equal(auditText.includes(secret),false);
});

test('audit write failure rolls back profile and purchase deletion',async()=>{
  const {storage,call,profileKey}=await setup(),p=await preview(call);
  storage.failAudit=true;
  // The failed audit write also makes the outer failure audit unavailable.
  // Simulate only the in-transaction write failing once.
  const originalPut=storage.put.bind(storage);
  let failed=false;
  storage.put=async(key,value)=>{
    if(!failed&&typeof key==='string'&&key.startsWith('admin-delete-audit:')){
      failed=true;throw Error('audit_failed');
    }
    storage.failAudit=false;
    return originalPut(key,value);
  };
  assert.equal((await call('execute',execution(p))).status,503);
  assert.ok(await storage.get(profileKey));
  assert.equal((await storage.get('storekit:purchase')).playerId,playerId);
  assert.equal((await storage.get('pass-original:sandbox:200')).playerId,playerId);
});

test('separate preview and execute rate limits reject bursts',async()=>{
  const {call}=await setup();
  for(let i=0;i<20;i++)assert.equal((await call('preview')).status,200);
  assert.equal((await call('preview')).status,429);
  for(let i=0;i<5;i++)assert.equal((await call('execute',execution({requestId:crypto.randomUUID(),
    confirmationToken:'a'.repeat(64)}))).status,409);
  assert.equal((await call('execute',execution({requestId:crypto.randomUUID(),
    confirmationToken:'a'.repeat(64)}))).status,429);
});

test('repeated failed authentication is rate limited without revealing profile state',async()=>{
  const {call,storage}=await setup();
  for(let i=0;i<60;i++)assert.equal((await call('preview',body,{secret:'wrong'})).status,401);
  assert.equal((await call('preview',body,{secret:'wrong'})).status,429);
  assert.equal([...await storage.list({prefix:'admin-delete-auth-rate:'})].length,1);
  assert.equal([...await storage.list({prefix:'admin-delete-preview:'})].length,0);
});
