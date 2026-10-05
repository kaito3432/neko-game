const test=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
globalThis.crypto||=webcrypto;
class Store{
  values=new Map();
  async get(k){return structuredClone(this.values.get(k));}
  async put(k,v){for(const [key,val] of typeof k==='string'?[[k,v]]:Object.entries(k))
    this.values.set(key,structuredClone(val));}
  async list({prefix=''}){return new Map([...this.values].filter(([key])=>key.startsWith(prefix)));}
  async delete(k){this.values.delete(k);}
  async transaction(fn){return fn(this);}
}
const b64=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
const claim=(id='100')=>`e30.${b64({transactionId:id,originalTransactionId:id})}.sig`;
const now=1_800_000_000_000,id='op_11111111-1111-4111-8111-111111111111';
const env={NYAN_ENVIRONMENT:'sandbox',APPLE_BUNDLE_ID:'jp.nyanchase.game',
  GOOGLE_PLAY_PACKAGE_NAME:'jp.nyanchase.game'};
const profile={playerId:id,skillEntitlements:{purchasedProductIds:['SKILL_CAT_FAKE_PAW']}};
async function setup(marker='storekit:100',productId='SKILL_CAT_FAKE_PAW'){
  const db=new Store();await db.put(`profile-key:${id}`,'profile');await db.put('profile',profile);
  await db.put(marker,{playerId:id,productId,periodIds:[]});return db;
}
test('Apple V2 ES256 signature verifies pinned key and forged payload fails',async()=>{
  const auth=await import('../server/store-notification-auth.mjs');
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const pin=Buffer.from(await crypto.subtle.exportKey('spki',pair.publicKey)).toString('base64url');
  const payload={notificationUUID:'u1',notificationType:'REFUND',signedDate:now,
    data:{bundleId:'jp.nyanchase.game',environment:'Sandbox',signedTransactionInfo:claim()}};
  const head=b64({alg:'ES256'}),body=b64(payload),input=`${head}.${body}`;
  const sig=Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,
    Buffer.from(input))).toString('base64url');
  const signed=`${input}.${sig}`,settings={...env,APPLE_NOTIFICATION_PUBLIC_KEY_SPKI:pin};
  assert.equal((await auth.verifyAppleSignedPayload(signed,{env:settings,now})).notificationUUID,'u1');
  await assert.rejects(auth.verifyAppleSignedPayload(`${head}.${b64({...payload,notificationType:'DID_RENEW'})}.${sig}`,
    {env:settings,now}),/signature/);
  await assert.rejects(auth.verifyAppleSignedPayload(signed,{env,now}),/unavailable/);
  const rotatingHead=b64({alg:'ES256',kid:'apple-key-new'}),rotatingInput=
    `${rotatingHead}.${body}`;
  const rotatingSig=Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},
    pair.privateKey,Buffer.from(rotatingInput))).toString('base64url');
  const rotatingEnv={...env,APPLE_NOTIFICATION_PUBLIC_KEYS:JSON.stringify({
    'apple-key-old':pin,'apple-key-new':pin})};
  assert.equal((await auth.verifyAppleSignedPayload(`${rotatingInput}.${rotatingSig}`,
    {env:rotatingEnv,now})).notificationUUID,'u1');
  await assert.rejects(auth.verifyAppleSignedPayload(`${rotatingInput}.${rotatingSig}`,
    {env:{...env,APPLE_NOTIFICATION_PUBLIC_KEYS:JSON.stringify({'apple-key-old':pin})},now}),
    /key_unknown/);
});
test('Apple refund, duplicate and verified REFUND_REVERSED reconcile one purchase',async()=>{
  const {processAppleNotification}=await import('../server/store-notifications.mjs'),db=await setup();
  const payload={notificationUUID:'refund-1',notificationType:'REFUND',
    data:{environment:'Sandbox',signedTransactionInfo:claim()}};
  const verifyOneTime=async()=>({status:'revoked',productId:'SKILL_CAT_FAKE_PAW',
    identity:'100',verifiedAt:now});
  await processAppleNotification({storage:db,payload,env,now,verifyOneTime});
  assert.deepEqual((await db.get('profile')).skillEntitlements.purchasedProductIds,[]);
  assert.equal((await processAppleNotification({storage:db,payload,env,now,verifyOneTime})).duplicate,true);
  await processAppleNotification({storage:db,payload:{...payload,notificationUUID:'reverse-2',
    notificationType:'REFUND_REVERSED'},env,now:now+1,
    verifyOneTime:async()=>({status:'active',productId:'SKILL_CAT_FAKE_PAW',
      identity:'100',verifiedAt:now+1})});
  assert.deepEqual((await db.get('profile')).skillEntitlements.purchasedProductIds,['SKILL_CAT_FAKE_PAW']);
});
test('Apple API unavailable leaves rights and notification retryable',async()=>{
  const {processAppleNotification}=await import('../server/store-notifications.mjs'),db=await setup();
  const payload={notificationUUID:'failed',notificationType:'REFUND',
    data:{environment:'Sandbox',signedTransactionInfo:claim()}};
  await assert.rejects(processAppleNotification({storage:db,payload,env,now,
    verifyOneTime:async()=>{throw Error('apple_unavailable');}}),/unavailable/);
  assert.deepEqual((await db.get('profile')).skillEntitlements.purchasedProductIds,['SKILL_CAT_FAKE_PAW']);
  assert.equal(await db.get('store-notification:apple:failed'),undefined);
});
test('Pub/Sub auth checks signed Google token claims and rejects unauthenticated request',async()=>{
  const {verifyPubSubPush}=await import('../server/store-notification-auth.mjs');
  const settings={GOOGLE_PUBSUB_PUSH_EMAIL:'push@example.test',
    GOOGLE_PUBSUB_PUSH_AUDIENCE:'https://example.test/rtdn'};
  await assert.rejects(verifyPubSubPush(new Request('https://example.test'),
    {env:settings,now}),/unauthorized/);
  const request=new Request('https://example.test',{headers:{Authorization:'Bearer jwt.token.sig'}});
  const fetchFn=async()=>Response.json({aud:settings.GOOGLE_PUBSUB_PUSH_AUDIENCE,
    email:settings.GOOGLE_PUBSUB_PUSH_EMAIL,email_verified:'true',
    iss:'https://accounts.google.com',exp:String(Math.floor(now/1000)+60)});
  assert.equal((await verifyPubSubPush(request,{env:settings,fetchFn,now})).email,
    settings.GOOGLE_PUBSUB_PUSH_EMAIL);
});
test('Google RTDN verified Store revoke and duplicate message',async()=>{
  const {processGoogleNotification}=await import('../server/store-notifications.mjs');
  const token='valid-purchase-token';
  const key=`googleplay:${Buffer.from(await crypto.subtle.digest('SHA-256',
    Buffer.from(token))).toString('base64url')}`;
  const db=await setup(key),message={messageId:'g1',data:Buffer.from(JSON.stringify({
    packageName:'jp.nyanchase.game',oneTimeProductNotification:{purchaseToken:token}})).toString('base64')};
  const verifyOneTime=async()=>({status:'revoked',productId:'SKILL_CAT_FAKE_PAW',
    identity:key.slice('googleplay:'.length),verifiedAt:now});
  await processGoogleNotification({storage:db,message,env,now,verifyOneTime});
  assert.deepEqual((await db.get('profile')).skillEntitlements.purchasedProductIds,[]);
  assert.equal((await processGoogleNotification({storage:db,message,env,now,verifyOneTime})).duplicate,true);
});
test('Voided Purchases scan matches recorded token and keeps cursor on API failure',async()=>{
  const {scanGoogleVoidedPurchases}=await import('../server/store-notifications.mjs');
  const token='valid-purchase-token';
  const key=`googleplay:${Buffer.from(await crypto.subtle.digest('SHA-256',
    Buffer.from(token))).toString('base64url')}`;
  const db=await setup(key);
  await assert.rejects(scanGoogleVoidedPurchases({storage:db,env,now,
    listVoided:async()=>{throw Error('api_unavailable');}}),/unavailable/);
  assert.equal(await db.get('store-voided-scan:cursor'),undefined);
  await scanGoogleVoidedPurchases({storage:db,env,now,
    listVoided:async()=>[{purchaseToken:token,orderId:'order',voidedReason:7}],
    verifyOneTime:async()=>({status:'active',productId:'SKILL_CAT_FAKE_PAW',
      identity:key.slice('googleplay:'.length),verifiedAt:now})});
  assert.equal((await db.get(key)).status,'revoked');
  assert.equal((await db.get(key)).revokeReason,'google_voided_7');
  assert.equal(await db.get('store-voided-scan:cursor'),now);
});
test('Apple EXPIRED deactivates Pass and DID_RENEW applies newer verified period',async()=>{
  const {processAppleNotification}=await import('../server/store-notifications.mjs');
  const db=new Store(),old={id:'apple:100',startsAt:now-10000,expiresAt:now+10000};
  await db.put(`profile-key:${id}`,'profile');
  await db.put('profile',{playerId:id,passSubscription:{store:'app_store',period:old,
    verifiedAt:now-1000,autoRenewing:true},ownedCatSkins:['default','cat_pass_2026_11_starlight']});
  await db.put('pass-original:sandbox:100',{playerId:id,productId:'pass',periodIds:[old.id]});
  const payload={notificationUUID:'expired',notificationType:'EXPIRED',
    data:{environment:'Sandbox',signedTransactionInfo:claim()}};
  await processAppleNotification({storage:db,payload,env,now,
    verifyPass:async()=>({productId:'pass',periodId:old.id,startsAt:old.startsAt,
      expiresAt:now-1,revoked:false,autoRenewing:false})});
  assert.ok((await db.get('profile')).passSubscription.period.expiresAt<=now);
  assert.ok((await db.get('profile')).ownedCatSkins.includes('cat_pass_2026_11_starlight'));
  const next={id:'apple:101',startsAt:now,expiresAt:now+100000};
  await processAppleNotification({storage:db,payload:{...payload,notificationUUID:'renewed',
    notificationType:'DID_RENEW'},env,now:now+1,
    verifyPass:async()=>({productId:'pass',periodId:next.id,startsAt:next.startsAt,
      expiresAt:next.expiresAt,revoked:false,autoRenewing:true})});
  assert.equal((await db.get('profile')).passSubscription.period.id,next.id);
});
test('Google SUBSCRIPTION_REVOKED requires matching voided order and API recheck',async()=>{
  const {processGoogleNotification}=await import('../server/store-notifications.mjs');
  const token='subscription-token',tokenId=Buffer.from(await crypto.subtle.digest('SHA-256',
    Buffer.from(token))).toString('hex');
  const key=`pass-google-token:${tokenId}`,period={id:`google:${tokenId}:${now+10000}`,
    startsAt:now-10000,expiresAt:now+10000};
  const db=new Store();await db.put(`profile-key:${id}`,'profile');
  await db.put('profile',{playerId:id,passSubscription:{store:'google_play',period,
    verifiedAt:now-1000,autoRenewing:true}});
  await db.put(key,{playerId:id,productId:'pass',periodIds:[period.id]});
  const message={messageId:'revoke-sub',data:Buffer.from(JSON.stringify({
    packageName:'jp.nyanchase.game',subscriptionNotification:{purchaseToken:token,
      notificationType:12}})).toString('base64')};
  await processGoogleNotification({storage:db,message,env,now,
    verifyPass:async()=>({status:'expired',productId:'pass',identity:tokenId,
      verifiedAt:now,orderId:'order-1',period}),
    listVoided:async()=>[{purchaseToken:token,orderId:'order-1'}]});
  assert.equal((await db.get(key)).status,'revoked');
  assert.ok((await db.get('profile')).passSubscription.revokedAt);
});
test('older notification cannot roll back a newer verified Store state',async()=>{
  const {processAppleNotification}=await import('../server/store-notifications.mjs'),db=await setup();
  await db.put('storekit:100',{playerId:id,productId:'SKILL_CAT_FAKE_PAW',
    status:'active',lastVerifiedAt:now+1000});
  const result=await processAppleNotification({storage:db,env,now,payload:{
    notificationUUID:'old',notificationType:'REFUND',
    data:{environment:'Sandbox',signedTransactionInfo:claim()}},
    verifyOneTime:async()=>({status:'revoked',productId:'SKILL_CAT_FAKE_PAW',
      identity:'100',verifiedAt:now})});
  assert.equal(result.stale,true);
  assert.equal((await db.get('storekit:100')).status,'active');
});
test('notification dedupe records expire without touching purchase ownership',async()=>{
  const {cleanupNotificationDedupe}=await import('../server/store-notifications.mjs');
  const db=await setup();
  await db.put('store-notification:apple:old',{processedAt:now-100,expiresAt:now-1});
  await db.put('store-notification:google:new',{processedAt:now-100,expiresAt:now+1000});
  assert.equal(await cleanupNotificationDedupe(db,now),1);
  assert.ok(await db.get('storekit:100'));
  assert.ok(await db.get('store-notification:google:new'));
});
test('Google renewal updates only the verified newer Pass period',async()=>{
  const {processGoogleNotification}=await import('../server/store-notifications.mjs');
  const token='subscription-token',tokenId=Buffer.from(await crypto.subtle.digest('SHA-256',
    Buffer.from(token))).toString('hex');
  const key=`pass-google-token:${tokenId}`,old={id:`google:${tokenId}:${now-1}`,
    startsAt:now-10000,expiresAt:now-1},next={id:`google:${tokenId}:${now+10000}`,
    startsAt:now,expiresAt:now+10000};
  const db=new Store();await db.put(`profile-key:${id}`,'profile');
  await db.put('profile',{playerId:id,passSubscription:{store:'google_play',period:old,
    verifiedAt:now-1000,autoRenewing:false}});
  await db.put(key,{playerId:id,productId:'pass',periodIds:[old.id]});
  const message={messageId:'renew-1',data:Buffer.from(JSON.stringify({
    packageName:'jp.nyanchase.game',subscriptionNotification:{purchaseToken:token,
      notificationType:2}})).toString('base64')};
  await processGoogleNotification({storage:db,message,env,now,
    verifyPass:async()=>({status:'active',productId:'pass',identity:tokenId,
      verifiedAt:now,period:next,autoRenewing:true})});
  assert.equal((await db.get('profile')).passSubscription.period.id,next.id);
  assert.ok((await db.get(key)).periodIds.includes(next.id));
});
