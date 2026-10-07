const test=require('node:test');
const assert=require('node:assert/strict');
class Store{
  values=new Map();
  async get(key){return structuredClone(this.values.get(key));}
  async put(key,value){for(const [k,v] of typeof key==='string'?[[key,value]]:Object.entries(key))
    this.values.set(k,structuredClone(v));}
  async list({prefix=''}){return new Map([...this.values].filter(([key])=>key.startsWith(prefix)));}
  async delete(key){this.values.delete(key);}
  async transaction(fn){return fn(this);}
}
const load=()=>Promise.all([import('../server/purchase-lifecycle.mjs'),
  import('../server/skill-entitlements.mjs'),import('../server/pass-subscription.mjs')]);
const id='op_11111111-1111-4111-8111-111111111111',t=1_800_000_000_000;
test('verified Apple refund removes only the revoked product source and retries are idempotent',async()=>{
  const [life,skills]=await load(),db=new Store(),key='profile';
  await db.put(`profile-key:${id}`,key);
  await db.put(key,{playerId:id,skillEntitlements:{purchasedProductIds:['SKILL_CAT_FAKE_PAW','SKILL_PACK_01'],ownedSkillIds:[]}});
  await db.put('storekit:123',{playerId:id,productId:'SKILL_CAT_FAKE_PAW'});
  const verify=async()=>({status:'revoked',productId:'SKILL_CAT_FAKE_PAW',verifiedAt:t,reason:'refund'});
  assert.equal((await life.reconcileVerifiedPurchase({storage:db,markerKey:'storekit:123',verify,now:t})).changed,true);
  assert.equal((await life.reconcileVerifiedPurchase({storage:db,markerKey:'storekit:123',verify,now:t})).changed,false);
  const profile=await db.get(key);
  assert.deepEqual(profile.skillEntitlements.purchasedProductIds,['SKILL_PACK_01']);
  assert.ok(skills.resolveServerOwnedSkillIds(profile.skillEntitlements).includes('CAT_FAKE_PAW'));
  assert.equal((await db.get('storekit:123')).revokeReason,'refund');
});
test('Google revoke preserves a second valid purchase of the same product',async()=>{
  const [life]=await load(),db=new Store();
  await db.put(`profile-key:${id}`,'profile');
  await db.put('profile',{playerId:id,skillEntitlements:{purchasedProductIds:['SKILL_PACK_01']}});
  await db.put('googleplay:a',{playerId:id,productId:'SKILL_PACK_01'});
  await db.put('googleplay:b',{playerId:id,productId:'SKILL_PACK_01'});
  await life.reconcileVerifiedPurchase({storage:db,markerKey:'googleplay:a',
    verify:async()=>({status:'revoked',productId:'SKILL_PACK_01',verifiedAt:t}),now:t});
  assert.ok((await db.get('profile')).skillEntitlements.purchasedProductIds.includes('SKILL_PACK_01'));
});
test('verified Pass revoke disables access but keeps claimed Skin and Gift',async()=>{
  const [life,,pass]=await load(),db=new Store(),periodId='google:hash:1800000010000';
  await db.put(`profile-key:${id}`,'profile');
  await db.put('profile',{playerId:id,passSubscription:{store:'google_play',period:{id:periodId,startsAt:t-1000,expiresAt:t+10000},verifiedAt:t-1000},
    ownedCatSkins:['default','cat_pass_2026_11_starlight'],passSkinRewardsClaimed:[{skinId:'cat_pass_2026_11_starlight',monthKey:'2026-11',claimedAt:t-500,purchaseIdentity:periodId}],giftBox:{claimed:1}});
  await db.put('pass-google-token:hash',{playerId:id,productId:'pass',periodIds:[periodId]});
  await life.reconcileVerifiedPurchase({storage:db,markerKey:'pass-google-token:hash',
    verify:async()=>({status:'revoked',productId:'pass',verifiedAt:t}),now:t});
  const profile=await db.get('profile');
  assert.equal(pass.isPassActive(profile.passSubscription,t),false);
  assert.equal(profile.ownedCatSkins.includes('cat_pass_2026_11_starlight'),true);
  assert.equal(profile.giftBox.claimed,1);
});
test('unverified body, Store outage and stale event never mutate rights',async()=>{
  const [life]=await load(),db=new Store();
  await db.put('storekit:5',{productId:'REMOVE_ADS',status:'active',lastVerifiedAt:t});
  await assert.rejects(life.reconcileVerifiedPurchase({storage:db,markerKey:'storekit:5',
    verify:async()=>{throw Error('store_unavailable');}}),/store_unavailable/);
  await assert.rejects(life.reconcileVerifiedPurchase({storage:db,markerKey:'storekit:5',
    verify:async()=>({notificationType:'REFUND'})}),/not_verified/);
  assert.equal((await life.reconcileVerifiedPurchase({storage:db,markerKey:'storekit:5',
    verify:async()=>({status:'revoked',productId:'REMOVE_ADS',verifiedAt:t-1})})).stale,true);
  assert.equal((await db.get('storekit:5')).status,'active');
});
test('retention protects active and permanent records; configured revoked and temporary records expire',async()=>{
  const [life]=await load(),db=new Store();
  await db.put('storekit:a',{retentionClass:'ACTIVE_ENTITLEMENT'});
  await db.put('pass-original:b',{retentionClass:'PERMANENT_RESTORE',passSkinRewards:[{skinId:'x'}]});
  await db.put('googleplay:c',{status:'revoked',retentionClass:'FRAUD_PREVENTION',revokedAt:t});
  await db.put('googleplay:d',{status:'revoked',retentionClass:'FRAUD_PREVENTION',revokedAt:t-4*86400000});
  await db.put('storekit:e',{retentionClass:'TEMPORARY_OPERATIONAL',expiresAt:t-1});
  const env={PURCHASE_REVOKE_RETENTION_DAYS:'3'};
  assert.deepEqual(await life.cleanupPurchaseRecords(db,{now:t,env}),['storekit:e','googleplay:d']);
  assert.equal((await db.get('googleplay:d')).status,'revoked');
  await life.cleanupPurchaseRecords(db,{now:t,env,dryRun:false});
  assert.equal(await db.get('googleplay:d'),undefined);
  assert.ok(await db.get('pass-original:b'));
});
test('失効記録は確認時刻から365日未満を保持し、境界到達でcleanup候補になる',async()=>{
  const [life]=await load(),db=new Store(),day=86400000,revokedAt=Date.UTC(2025,0,1);
  const key='googleplay:revoked';
  await db.put(key,{state:'deleted',status:'revoked',retentionClass:'FRAUD_PREVENTION',revokedAt});
  const env={PURCHASE_REVOKE_RETENTION_DAYS:'365'};
  assert.deepEqual(await life.cleanupPurchaseRecords(db,{now:revokedAt+365*day-1,env}),[]);
  assert.deepEqual(await life.cleanupPurchaseRecords(db,{now:revokedAt+365*day,env}),[key]);
  assert.deepEqual(await life.cleanupPurchaseRecords(db,{now:revokedAt+365*day+1,env}),[key]);
  assert.ok(await db.get(key)); // dry-run is the default
});
test('365日後も有効な永続権利と取得済みPass Skinを保護する',async()=>{
  const [life]=await load(),db=new Store(),now=t+400*86400000;
  await db.put('storekit:skill',{state:'deleted',status:'active',retentionClass:'ACTIVE_ENTITLEMENT',revokedAt:t});
  await db.put('storekit:pack',{state:'bound',status:'active',retentionClass:'ACTIVE_ENTITLEMENT'});
  await db.put('pass-original:skin',{state:'deleted',status:'expired',retentionClass:'PERMANENT_RESTORE',
    passSkinRewards:[{skinId:'cat_pass_2026_11_starlight'}]});
  await db.put('pass-google-token:uncertain',{state:'deleted',status:'revoked',
    retentionClass:'FRAUD_PREVENTION',revokedAt:t,
    passSkinRewards:[{skinId:'cat_pass_2026_11_starlight'}]});
  assert.deepEqual(await life.cleanupPurchaseRecords(db,{now,
    env:{PURCHASE_REVOKE_RETENTION_DAYS:'365'}}),[]);
});
test('未設定・不正な保持日数では失効記録を自動削除しない',async()=>{
  const [life]=await load(),record={status:'revoked',retentionClass:'FRAUD_PREVENTION',revokedAt:t};
  for(const value of [undefined,'0','-1','NaN','Infinity','365days','0x16d','',true,0,-1]){
    const env=value===undefined?{}:{PURCHASE_REVOKE_RETENTION_DAYS:value};
    assert.equal(life.revokeRetentionDays(env),null,String(value));
    assert.equal(life.retentionDecision(record,{now:t+400*86400000,env}).deletable,false,String(value));
  }
  assert.equal(life.retentionDecision({...record,revokedAt:0},{now:t+400*86400000,
    env:{PURCHASE_REVOKE_RETENTION_DAYS:'365'}}).deletable,false);
  assert.equal(life.retentionDecision({...record,revokedAt:undefined},{now:t+400*86400000,
    env:{PURCHASE_REVOKE_RETENTION_DAYS:'365'}}).deletable,false);
});
test('revoked deleted marker cannot restore a refunded Apple purchase',async()=>{
  const apple=await import('../server/storekit-verification.mjs'),db=new Store();
  const marker='storekit:100';
  await db.put(marker,{state:'deleted',status:'revoked',store:'app_store',productId:'SKILL_PACK_01',
    revokedAt:t,lastVerifiedAt:t});
  await assert.rejects(apple.applyVerifiedStoreTransaction({storage:db,profileKey:'profile',
    profile:{playerId:id},signedTransaction:'proof',restore:true,
    verify:async()=>({transactionId:'100',productId:'SKILL_PACK_01',appAccountToken:id.slice(3)}),
    setAccountToken:async()=>true}),/purchase_revoked/);
  assert.equal((await db.get(marker)).state,'deleted');
});
test('Store再照会間隔は設定可能で期限前の連続profile取得を抑制',async()=>{
  const [life]=await load(),env={STORE_REVERIFY_INTERVAL_SECONDS:'120'};
  assert.equal(life.shouldReverify({lastVerifiedAt:t-119000},{now:t,env}),false);
  assert.equal(life.shouldReverify({lastVerifiedAt:t-120000},{now:t,env}),true);
  assert.equal(life.shouldReverify({}, {now:t,env}),true);
});
test('Pass返金は同一課金periodのSkinだけ失効し返金取消で復元',async()=>{
  const [life]=await load(),db=new Store(),period={id:'apple:100',startsAt:t-1000,expiresAt:t+10000};
  await db.put(`profile-key:${id}`,'profile');
  await db.put('profile',{playerId:id,passSubscription:{store:'app_store',period,verifiedAt:t-1000},
    ownedCatSkins:['default','cat_pass_2026_11_starlight'],
    passSkinRewardsClaimed:[{monthKey:'2026-11',skinId:'cat_pass_2026_11_starlight',
      claimedAt:t-500,purchaseIdentity:period.id}]});
  await db.put('pass-original:sandbox:100',{playerId:id,productId:'pass',periodIds:[period.id]});
  await life.reconcileVerifiedPurchase({storage:db,markerKey:'pass-original:sandbox:100',now:t,
    verify:async()=>({status:'revoked',productId:'pass',verifiedAt:t,period})});
  assert.equal((await db.get('profile')).ownedCatSkins.includes('cat_pass_2026_11_starlight'),false);
  assert.equal((await db.get('profile')).passSkinRewardsClaimed[0].revokedAt,t);
  await life.reconcileVerifiedPurchase({storage:db,markerKey:'pass-original:sandbox:100',now:t+1,
    verify:async()=>({status:'active',productId:'pass',verifiedAt:t+1,period,
      allowReactivation:true})});
  assert.equal((await db.get('profile')).ownedCatSkins.includes('cat_pass_2026_11_starlight'),true);
  assert.equal((await db.get('profile')).passSkinRewardsClaimed[0].revokedAt,undefined);
});
