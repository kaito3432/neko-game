const test=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
globalThis.crypto||=webcrypto;
class Store{values=new Map();async get(key){return structuredClone(this.values.get(key));}async put(key,value){for(const [k,v] of typeof key==='string'?[[key,value]]:Object.entries(key))this.values.set(k,structuredClone(v));}}
const modulePromise=import('../server/rewarded-ad-verification.mjs');
const toB64Url=bytes=>Buffer.from(bytes).toString('base64url');
const pem=bytes=>`-----BEGIN PUBLIC KEY-----\n${Buffer.from(bytes).toString('base64').match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;
function rawToDer(raw){
  const integer=part=>{let value=Buffer.from(part);while(value.length>1&&value[0]===0)value=value.subarray(1);if(value[0]&0x80)value=Buffer.concat([Buffer.from([0]),value]);return Buffer.concat([Buffer.from([2,value.length]),value]);};
  const body=Buffer.concat([integer(raw.subarray(0,32)),integer(raw.subarray(32))]);return Buffer.concat([Buffer.from([0x30,body.length]),body]);
}
async function signedUrl(overrides={}){
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const query=new URLSearchParams({ad_network:'5450213213286189855',ad_unit:'unit-1',custom_data:'ra_attempt',reward_amount:'1',reward_item:'skill_mode_unlock',timestamp:String(Date.now()),transaction_id:'tx-1',user_id:'P1',...overrides}).toString();
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(query));
  const spki=await crypto.subtle.exportKey('spki',keys.publicKey),der=rawToDer(new Uint8Array(signature));
  return {url:`https://example.test/api/ads/admob/ssv?${query}&signature=${encodeURIComponent(toB64Url(der))}&key_id=7`,fetchFn:async()=>Response.json({keys:[{keyId:7,pem:pem(spki)}]})};
}

test('署名済みAdMob SSVだけをattemptへ関連付け、重複transactionを冪等処理',async()=>{
  const {acceptVerifiedAdMobSsv,verifyStoredRewardedAd}=await modulePromise,store=new Store(),now=Date.now();
  await store.put('rewarded-ad-attempt:ra_attempt',{attemptId:'ra_attempt',playerId:'P1',rewardType:'SKILL_MODE_UNLOCK_PROGRESS',createdAt:now,expiresAt:now+10000});
  const signed=await signedUrl(),first=await acceptVerifiedAdMobSsv(store,signed.url,{fetchFn:signed.fetchFn,allowedAdUnitId:'unit-1',now});
  assert.deepEqual(first,{accepted:true,duplicate:false});
  assert.equal(await verifyStoredRewardedAd(store,{playerId:'P1',rewardType:'SKILL_MODE_UNLOCK_PROGRESS',verificationId:'ra_attempt'}),true);
  assert.equal((await acceptVerifiedAdMobSsv(store,signed.url,{fetchFn:signed.fetchFn,allowedAdUnitId:'unit-1',now})).duplicate,true);
});

test('改ざん署名・不一致player・不一致広告unitを拒否',async()=>{
  const {acceptVerifiedAdMobSsv}=await modulePromise,store=new Store(),now=Date.now();
  await store.put('rewarded-ad-attempt:ra_attempt',{attemptId:'ra_attempt',playerId:'P1',rewardType:'SKILL_MODE_UNLOCK_PROGRESS',expiresAt:now+10000});
  const signed=await signedUrl();
  await assert.rejects(()=>acceptVerifiedAdMobSsv(store,signed.url.replace('transaction_id=tx-1','transaction_id=tx-2'),{fetchFn:signed.fetchFn,now}),/invalid_ssv_signature/);
  await assert.rejects(()=>acceptVerifiedAdMobSsv(store,signed.url,{fetchFn:signed.fetchFn,allowedAdUnitId:'other',now}),/invalid_ad_unit/);
  const wrong=await signedUrl({user_id:'P2'});await assert.rejects(()=>acceptVerifiedAdMobSsv(store,wrong.url,{fetchFn:wrong.fetchFn,now}),/reward_player_mismatch/);
});

test('Console verification returns HTTP 200 without any storage reads or writes',async()=>{
  const {acceptVerifiedAdMobSsv,ADMOB_SSV_VERIFICATION_DATA,ADMOB_SSV_VERIFICATION_USER}=await modulePromise;
  const signed=await signedUrl({custom_data:ADMOB_SSV_VERIFICATION_DATA,user_id:ADMOB_SSV_VERIFICATION_USER});
  const store={get(){throw new Error('verification must not read player/reward state');},put(){throw new Error('verification must not write progress, entitlement, coin or receipt');}};
  const result=await acceptVerifiedAdMobSsv(store,signed.url,{fetchFn:signed.fetchFn,allowedAdUnitIds:['unit-1'],expectedRewardItem:'skill_mode_unlock'});
  assert.deepEqual(result,{accepted:true,verificationOnly:true});
  assert.equal(Response.json(result).status,200);
});

for(const [name,overrides,error] of [
  ['wrong ad unit',{ad_unit:'other'},'invalid_ad_unit'],
  ['wrong reward item',{reward_item:'coins'},'invalid_reward_item'],
  ['wrong amount',{reward_amount:'2'},'invalid_reward_amount'],
  ['expired timestamp',{timestamp:'1'},'invalid_ssv_timestamp'],
  ['missing timestamp',{timestamp:''},'invalid_ssv_timestamp'],
  ['wrong verification user',{user_id:'P1'},'invalid_verification_user'],
  ['random custom data',{custom_data:'random'},'reward_attempt_expired'],
])test(`Console verification rejects ${name}`,async()=>{
  const {acceptVerifiedAdMobSsv,ADMOB_SSV_VERIFICATION_DATA,ADMOB_SSV_VERIFICATION_USER}=await modulePromise;
  const signed=await signedUrl({custom_data:ADMOB_SSV_VERIFICATION_DATA,user_id:ADMOB_SSV_VERIFICATION_USER,...overrides}),store=new Store();
  await assert.rejects(()=>acceptVerifiedAdMobSsv(store,signed.url,{fetchFn:signed.fetchFn,allowedAdUnitIds:['unit-1'],expectedRewardItem:'skill_mode_unlock'}),new RegExp(error));
  assert.equal(store.values.size,0);
});

test('Console verification cannot bypass a forged signature or unknown key',async()=>{
  const {acceptVerifiedAdMobSsv,ADMOB_SSV_VERIFICATION_DATA,ADMOB_SSV_VERIFICATION_USER}=await modulePromise;
  const signed=await signedUrl({custom_data:ADMOB_SSV_VERIFICATION_DATA,user_id:ADMOB_SSV_VERIFICATION_USER}),store=new Store();
  const options={fetchFn:signed.fetchFn,allowedAdUnitIds:['unit-1'],expectedRewardItem:'skill_mode_unlock'};
  await assert.rejects(()=>acceptVerifiedAdMobSsv(store,signed.url.replace('transaction_id=tx-1','transaction_id=tx-2'),options),/invalid_ssv_signature/);
  await assert.rejects(()=>acceptVerifiedAdMobSsv(store,signed.url.replace('key_id=7','key_id=8'),options),/unknown_ssv_key/);
  await assert.rejects(()=>acceptVerifiedAdMobSsv(store,'https://example.test/api/ads/admob/ssv',options),/invalid_ssv_payload/);
  assert.equal(store.values.size,0);
});

test('iOS/Androidの許可広告unitだけSSVを受け入れる',async()=>{
  const {verifyAdMobSsvUrl}=await modulePromise;
  for(const ad_unit of ['unit-ios','unit-android']){
    const signed=await signedUrl({ad_unit});
    await verifyAdMobSsvUrl(signed.url,{fetchFn:signed.fetchFn,allowedAdUnitIds:['unit-ios','unit-android']});
    await assert.rejects(()=>verifyAdMobSsvUrl(signed.url,{fetchFn:signed.fetchFn,allowedAdUnitIds:['foreign-unit']}),/invalid_ad_unit/);
  }
});

test('Production SSV does not emit diagnostic identifiers',async()=>{
  const {verifyAdMobSsvUrl}=await modulePromise,signed=await signedUrl();
  let called=false;
  await verifyAdMobSsvUrl(signed.url,{fetchFn:signed.fetchFn,onDiagnostic(){called=true;}});
  assert.equal(called,false);
});

test('Fixed Console ad unit is signed-only, reward-free and never a normal allowlist entry',async()=>{
  const {acceptVerifiedAdMobSsv}=await modulePromise;
  const identity={ad_unit:'1234567890',custom_data:'admob_ssv_verification',user_id:'admob_ssv_verification'};
  const store={get(){throw Error('no verification storage reads');},put(){throw Error('no verification rewards or storage writes');}};
  const options={allowedAdUnitIds:['ca-app-pub-6462457361541481/4339169364'],expectedRewardItem:'skill_mode_unlock'};
  const signed=await signedUrl(identity);
  const result=await acceptVerifiedAdMobSsv(store,signed.url,{...options,fetchFn:signed.fetchFn});
  assert.deepEqual(result,{accepted:true,verificationOnly:true});assert.equal(Response.json(result).status,200);
  for(const [overrides,error] of [
    [{custom_data:'ra_attempt',user_id:'P1'},'invalid_ad_unit'],
    [{user_id:'P1'},'invalid_ad_unit'],
    [{custom_data:'wrong'},'invalid_ad_unit'],
    [{reward_item:'coins'},'invalid_reward_item'],
    [{reward_amount:'2'},'invalid_reward_amount'],
    [{timestamp:'1'},'invalid_ssv_timestamp'],
    [{transaction_id:''},'invalid_ssv_payload'],
  ]){
    const bad=await signedUrl({...identity,...overrides});
    await assert.rejects(()=>acceptVerifiedAdMobSsv(store,bad.url,{...options,fetchFn:bad.fetchFn}),new RegExp(error));
  }
  await assert.rejects(()=>acceptVerifiedAdMobSsv(store,signed.url.replace('transaction_id=tx-1','transaction_id=tx-2'),{...options,fetchFn:signed.fetchFn}),/invalid_ssv_signature/);
  await assert.rejects(()=>acceptVerifiedAdMobSsv(store,signed.url.split('&signature=')[0],options),/invalid_ssv_payload/);
});

test('Real production unit normal SSV remains verified and transaction-idempotent',async()=>{
  const {acceptVerifiedAdMobSsv,verifyStoredRewardedAd}=await modulePromise,store=new Store(),now=Date.now();
  await store.put('rewarded-ad-attempt:ra_attempt',{attemptId:'ra_attempt',playerId:'P1',rewardType:'SKILL_MODE_UNLOCK_PROGRESS',expiresAt:now+1800000});
  const signed=await signedUrl({ad_unit:'ca-app-pub-6462457361541481/4339169364'});
  const options={fetchFn:signed.fetchFn,allowedAdUnitIds:['ca-app-pub-6462457361541481/4339169364'],expectedRewardItem:'skill_mode_unlock',now};
  assert.equal((await acceptVerifiedAdMobSsv(store,signed.url,options)).duplicate,false);
  assert.equal(await verifyStoredRewardedAd(store,{playerId:'P1',rewardType:'SKILL_MODE_UNLOCK_PROGRESS',verificationId:'ra_attempt'}),true);
  assert.equal((await acceptVerifiedAdMobSsv(store,signed.url,options)).duplicate,true);
});
