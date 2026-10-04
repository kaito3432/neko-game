const test=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync}=require('node:crypto');
const passStore=import('../server/pass-storekit.mjs');
const summary=import('../server/pass-summary.mjs');
const online=import('../server/online-profile.mjs');
const provider=require('../pass-storekit-provider.js');
const now=Date.parse('2026-10-03T10:00:00Z');
const playerId='op_00000000-0000-4000-8000-000000000001';
const productId='test.pass.monthly',groupId='12345678';
const pem=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({type:'pkcs8',format:'pem'});
const env={NYAN_ENVIRONMENT:'sandbox',APPLE_PASS_PRODUCT_ID:productId,APPLE_PASS_SUBSCRIPTION_GROUP_ID:groupId,
  APP_STORE_CONNECT_PRIVATE_KEY:pem,APP_STORE_CONNECT_KEY_ID:'TESTKEY',APP_STORE_CONNECT_ISSUER_ID:'TESTISSUER'};
const jws=value=>`e30.${Buffer.from(JSON.stringify(value)).toString('base64url')}.signature`;
const transaction=(changes={})=>({transactionId:'1001',originalTransactionId:'1000',productId,
  bundleId:'jp.nyanchase.game',environment:'Sandbox',appAccountToken:playerId.slice(3),
  purchaseDate:now-1000,expiresDate:now+100000,...changes});
const body=(tx=transaction(),renewal={originalTransactionId:'1000',environment:'Sandbox',productId,autoRenewStatus:1},status=1)=>({
  environment:'Sandbox',bundleId:'jp.nyanchase.game',data:[{subscriptionGroupIdentifier:groupId,
    lastTransactions:[{status,signedTransactionInfo:jws(tx),signedRenewalInfo:jws(renewal)}]}]});
const fetchBody=value=>async(url,options)=>{
  assert.match(url,/api\.storekit-sandbox\.apple\.com\/inApps\/v1\/subscriptions\/1001$/);
  assert.match(options.headers.Authorization,/^Bearer /);
  return {ok:true,json:async()=>value};
};
const storage=()=>{const map=new Map();const api={get:async key=>structuredClone(map.get(key)),
  put:async(key,value)=>{if(typeof key==='object')for(const [k,v] of Object.entries(key))map.set(k,structuredClone(v));
    else map.set(key,structuredClone(value));},transaction:async fn=>fn(api)};return api;};

test('Pass Store config is fail-closed without explicit environment and product',async()=>{
  const {passStoreConfig}=await passStore;
  assert.throws(()=>passStoreConfig({APPLE_PASS_PRODUCT_ID:productId,APPLE_PASS_SUBSCRIPTION_GROUP_ID:groupId}));
  assert.deepEqual(passStoreConfig(env),{environment:'sandbox',productId,groupId,bundleId:'jp.nyanchase.game'});
});

test('Apple subscription status supplies active period and autoRenew OFF remains active',async()=>{
  const {verifyApplePassStatus}=await passStore;
  const receipt=await verifyApplePassStatus({signedTransaction:jws(transaction()),env,now,fetchFn:fetchBody(body())});
  assert.equal(receipt.periodId,'apple:1001');assert.equal(receipt.expiresAt,now+100000);
  assert.equal(receipt.autoRenewing,true);
  const off=await verifyApplePassStatus({signedTransaction:jws(transaction()),env,now,
    fetchFn:fetchBody(body(transaction(),{originalTransactionId:'1000',environment:'Sandbox',productId,autoRenewStatus:0}))});
  assert.equal(off.autoRenewing,false);assert.equal(off.expiresAt,now+100000);
});

test('Apple response rejects wrong product, bundle, environment, group and malformed transaction',async()=>{
  const {verifyApplePassStatus}=await passStore;
  for(const response of [body(transaction({productId:'other'})),body(transaction({bundleId:'other'})),
    {...body(),environment:'Production'}, {...body(),data:[{subscriptionGroupIdentifier:'other',lastTransactions:body().data[0].lastTransactions}]},
    body(transaction({transactionId:'bad'}))]){
    await assert.rejects(()=>verifyApplePassStatus({signedTransaction:jws(transaction()),env,now,fetchFn:fetchBody(response)}));
  }
  await assert.rejects(()=>verifyApplePassStatus({signedTransaction:jws(transaction({productId:'other'})),env,now,
    fetchFn:fetchBody(body())}));
  await assert.rejects(()=>verifyApplePassStatus({signedTransaction:'invalid',env,now,fetchFn:fetchBody(body())}));
});

test('Server verified period, renewal, replay, rollback, account binding and expiration',async()=>{
  const {applyVerifiedApplePass}=await passStore,{initialProfile}=await online,
    {passSummary}=await summary;
  const db=storage(),key='profile:self',profile=initialProfile({},playerId,now);
  await db.put(key,profile);
  const receipt={store:'app_store',environment:'sandbox',productId,groupId,originalTransactionId:'1000',
    transactionId:'1001',periodId:'apple:1001',appAccountToken:playerId.slice(3),startsAt:now-1000,
    expiresAt:now+100000,autoRenewing:false};
  const first=await applyVerifiedApplePass({storage:db,profileKey:key,profile,receipt,now});
  assert.equal(passSummary(first.profile,{now}).active,true);
  assert.equal(first.profile.passSubscription.autoRenewing,false);
  const replay=await applyVerifiedApplePass({storage:db,profileKey:key,profile,receipt,now});
  assert.equal(replay.duplicate,true);
  const renewed={...receipt,transactionId:'1002',periodId:'apple:1002',startsAt:now+100000,expiresAt:now+200000};
  await applyVerifiedApplePass({storage:db,profileKey:key,profile,receipt:renewed,now:now+100001});
  assert.equal((await db.get(key)).passSubscription.period.id,'apple:1002');
  const old=await applyVerifiedApplePass({storage:db,profileKey:key,profile,receipt,now:now+100002});
  assert.equal(old.stale,true);assert.equal((await db.get(key)).passSubscription.period.id,'apple:1002');
  assert.equal(passSummary(await db.get(key),{now:now+200001}).active,false);
  await assert.rejects(()=>applyVerifiedApplePass({storage:db,profileKey:'profile:other',
    profile:{...profile,playerId:'op_11111111-1111-4111-8111-111111111111'},receipt,now}));
  await assert.rejects(()=>applyVerifiedApplePass({storage:db,profileKey:key,profile,
    receipt:{...receipt,appAccountToken:'11111111-1111-4111-8111-111111111111'},now}));
});

test('iOS provider loads monthly localized product; cancel and no entitlement never grant active',async()=>{
  const calls=[];let purchased=0;
  const product={productId,subscriptionGroupId:groupId,subscriptionPeriod:{unit:'month',value:1},
    displayPrice:'¥680',currencyCode:'JPY'};
  const plugin={loadProducts:async()=>({products:[product]}),purchase:async()=>{purchased++;return {status:'cancelled'};},
    restorePurchases:async()=>({transactions:[]}),currentEntitlements:async()=>({transactions:[]}),addListener:()=>{}};
  const api={identity:async()=>({playerId}),verifyTransaction:async()=>{throw Error('unexpected');},
    refresh:async()=>{calls.push('refresh');return {passSummary:{active:false}};}};
  const subject=provider.createProvider({plugin,api});subject.configure({productId,groupId});
  assert.equal((await subject.loadProduct()).product.displayPrice,'¥680');
  assert.equal((await subject.purchase()).reason,'cancelled');assert.equal(purchased,1);
  assert.equal((await subject.restore()).count,0);assert.deepEqual(calls,['refresh']);
  assert.equal((await subject.syncCurrent()).count,0);
});

test('authenticated purchase endpoint alone writes Pass; client claims cannot grant it',async()=>{
  const {profileRequest,initialProfile,digestToken}=await online;
  const db=storage(),token='ab'.repeat(32),key=`profile:${await digestToken(token)}`;
  const profile=initialProfile({},playerId,now);
  await db.put(key,profile);
  const headers={Authorization:`Bearer ${token}`,'content-type':'application/json'};
  const receipt={store:'app_store',environment:'sandbox',productId,groupId,originalTransactionId:'1000',
    transactionId:'1001',periodId:'apple:1001',appAccountToken:playerId.slice(3),startsAt:now-1000,
    expiresAt:now+100000,autoRenewing:true};
  const options={now,passProductId:productId,passGroupId:groupId,
    verifyPassSubscription:async signed=>{assert.equal(signed,'signed');return receipt;},
    refreshPassSubscription:async original=>{assert.equal(original,'1000');return receipt;}};
  const appearance=await (await profileRequest(db,new Request('https://players/appearance',{method:'POST',headers,
    body:JSON.stringify({passActive:true,passSubscription:{period:{expiresAt:now+9999999}}})}),options)).json();
  assert.equal(appearance.passSummary.active,false);
  const purchase=await (await profileRequest(db,new Request('https://players/pass-storekit-transaction',
    {method:'POST',headers,body:JSON.stringify({signedTransaction:'signed',passActive:true})}),options)).json();
  assert.equal(purchase.passSummary.active,true);
  assert.equal(purchase.passSummary.periodId,'apple:1001');
  assert.equal(purchase.passSummary.productId,productId);
  assert.equal((await db.get(key)).skillEntitlements.ownedSkillIds.length,0);
  const refresh=await (await profileRequest(db,new Request('https://players/pass-subscription-refresh',{headers}),options)).json();
  assert.equal(refresh.passSummary.active,true);
  assert.equal(refresh.duplicate,true);
  const unauth=await profileRequest(db,new Request('https://players/pass-storekit-transaction',
    {method:'POST',body:JSON.stringify({signedTransaction:'signed'})}),options);
  assert.equal(unauth.status,401);
});

test('StoreKit purchase finishes only after server verification and blocks double purchase',async()=>{
  const order=[],pending={};
  pending.promise=new Promise(resolve=>{pending.resolve=resolve;});
  const product={productId,subscriptionGroupId:groupId,subscriptionPeriod:{unit:'month',value:1},displayPrice:'¥680'};
  const plugin={loadProducts:async()=>({products:[product]}),
    purchase:async request=>{order.push(`purchase:${request.appAccountToken}`);await pending.promise;
      return {status:'purchased',transaction:{productId,transactionId:'1001',signedTransaction:'signed'}};},
    finishTransaction:async()=>{order.push('finish');},addListener:()=>{}};
  const api={identity:async()=>({playerId}),verifyTransaction:async()=>{order.push('server');return {passSummary:{active:true}};}};
  const subject=provider.createProvider({plugin,api});subject.configure({productId,groupId});await subject.loadProduct();
  const first=subject.purchase();
  assert.equal((await subject.purchase()).reason,'busy');
  pending.resolve();assert.equal((await first).purchased,true);
  assert.deepEqual(order,[`purchase:${playerId.slice(3)}`,'server','finish']);
  const fail=provider.createProvider({plugin:{...plugin,purchase:async()=>({status:'purchased',
    transaction:{productId,transactionId:'1002',signedTransaction:'signed'}})},
    api:{...api,verifyTransaction:async()=>{throw Error('server_reject');}}});
  fail.configure({productId,groupId});await fail.loadProduct();
  assert.equal((await fail.purchase()).purchased,false);
  assert.deepEqual(order,[`purchase:${playerId.slice(3)}`,'server','finish']);
});
