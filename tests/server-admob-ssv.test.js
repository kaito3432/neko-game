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
  const query=new URLSearchParams({ad_network:'5450213213286189855',ad_unit:'unit-1',custom_data:'ra_attempt',reward_amount:'1',reward_item:'skill',timestamp:String(Date.now()),transaction_id:'tx-1',user_id:'P1',...overrides}).toString();
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
  await assert.rejects(()=>acceptVerifiedAdMobSsv(store,signed.url.replace('reward_amount=1','reward_amount=2'),{fetchFn:signed.fetchFn,now}),/invalid_ssv_signature/);
  await assert.rejects(()=>acceptVerifiedAdMobSsv(store,signed.url,{fetchFn:signed.fetchFn,allowedAdUnitId:'other',now}),/invalid_ad_unit/);
  const wrong=await signedUrl({user_id:'P2'});await assert.rejects(()=>acceptVerifiedAdMobSsv(store,wrong.url,{fetchFn:wrong.fetchFn,now}),/reward_player_mismatch/);
});
