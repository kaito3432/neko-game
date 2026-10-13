const test=require('node:test'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
globalThis.crypto||=webcrypto;
async function fixture(environment='Production'){
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const env={NYAN_ENVIRONMENT:'production',
  APP_STORE_CONNECT_PRIVATE_KEY:`-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64')}\n-----END PRIVATE KEY-----`,
  APP_STORE_CONNECT_KEY_ID:'test',APP_STORE_CONNECT_ISSUER_ID:'test'};
 const chain=require('./apple-chain-fixture.cjs').fixture({environment}),sign=async data=>chain.sign(data);
 const claim=chain.claim;
 const proof=await sign(claim),fetchFn=async()=>({ok:true,json:async()=>({signedTransactionInfo:proof})});
 return {env,sign,claim,proof,fetchFn,verifier:chain.verifier};
}
test('Apple Production購入はApple署名とServer APIの両方で検証',async()=>{
 const {verifyStoreKitTransaction:verify}=await import('../server/storekit-verification.mjs'),f=await fixture();
 assert.equal((await verify(f.proof,{...f,playerId:'op_user'})).environment,'Production');
});
test('Sandbox署名偽造とwrong bundleをServer API呼び出し前に拒否',async()=>{
 const {verifyStoreKitTransaction:verify}=await import('../server/storekit-verification.mjs'),f=await fixture('Sandbox');
 const options={...f,playerId:'op_11111111-1111-4111-8111-111111111111',fetchFn:()=>{throw Error('must not fetch');}};
 const pieces=f.proof.split('.');pieces[1]=Buffer.from(JSON.stringify({...f.claim,purchaseDate:99})).toString('base64url');
 await assert.rejects(()=>verify(pieces.join('.'),options),/signature/);
 const wrong=await f.sign({...f.claim,bundleId:'wrong.bundle'});
 await assert.rejects(()=>verify(wrong,options),/mismatch|signature_or_claims/);
});
test('Sandbox権利の冪等付与、Production混在拒否、refund/revokeと通知重複防止',async()=>{
 const {applyVerifiedStoreTransaction:apply}=await import('../server/storekit-verification.mjs');
 const {processAppleNotification}=await import('../server/store-notifications.mjs');
 const values=new Map(),storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>{
  for(const [key,value] of typeof k==='string'?[[k,v]]:Object.entries(k))values.set(key,structuredClone(value));
 },list:async({prefix=''})=>new Map([...values].filter(([key])=>key.startsWith(prefix))),transaction:async fn=>fn(storage)};
 const f=await fixture('Sandbox'),playerId='op_'+f.claim.appAccountToken,profile={playerId,skillEntitlements:{purchasedProductIds:[]}};
 const context={storage,profileKey:'profile',profile,signedTransaction:f.proof,verify:async()=>({...f.claim,appAccountToken:f.claim.appAccountToken})};
 await storage.put('profile-key:'+playerId,'profile');
 const first=await apply(context);assert.equal(first.profile.purchaseEnvironment,'Sandbox');
 assert.equal((await apply(context)).duplicate,true);
 await assert.rejects(()=>apply({...context,verify:async()=>({...f.claim,transactionId:'1002',environment:'Production'})}),/profile_environment_conflict/);
 for(const type of ['REFUND','REVOKE']){
  const payload={notificationUUID:type,notificationType:type,data:{environment:'Sandbox',signedTransactionInfo:f.proof}};
  const options={storage,payload,env:f.env,verifyOneTime:async()=>({status:'revoked',productId:f.claim.productId,identity:'1001',verifiedAt:Date.now()})};
  await processAppleNotification(options);
  assert.deepEqual((await storage.get('profile')).skillEntitlements.purchasedProductIds,[]);
  assert.equal((await processAppleNotification(options)).duplicate,true);
 }
 await assert.rejects(()=>apply(context),/revoked/);
 const old={playerId,skillEntitlements:{purchasedProductIds:['SKILL_CAT_FAKE_PAW']}};
 await storage.put('legacy',old);
 await assert.rejects(()=>apply({...context,profileKey:'legacy',profile:old,verify:async()=>({...f.claim,transactionId:'1003'})}),/profile_environment_conflict/);
 await storage.put('production',{...profile,purchaseEnvironment:'Production'});
 await assert.rejects(()=>apply({...context,profileKey:'production',verify:async()=>({...f.claim,transactionId:'1004'})}),/profile_environment_conflict/);
});
test('Apple署名済みSandboxは事前allowlistなしで新しい匿名アカウントへ導入、tokenなしや別アカウント拒否',async()=>{
 const {verifyStoreKitTransaction:verify}=await import('../server/storekit-verification.mjs'),f=await fixture('Sandbox');
 assert.equal((await verify(f.proof,{...f,playerId:'op_11111111-1111-4111-8111-111111111111'})).environment,'Sandbox');
 await assert.rejects(()=>verify(f.proof,{...f,playerId:'op_user'}),/sandbox_account_required/);
 const proof=await f.sign({...f.claim,appAccountToken:null});
 await assert.rejects(()=>verify(proof,{...f,playerId:'op_11111111-1111-4111-8111-111111111111',fetchFn:async()=>({ok:true,json:async()=>({signedTransactionInfo:proof})})}),/sandbox_account_required|signature_or_claims/);
});
test('偽署名、未知商品、失効、Apple応答の環境偽装を拒否',async()=>{
 const {verifyStoreKitTransaction:verify}=await import('../server/storekit-verification.mjs'),f=await fixture();
 const pieces=f.proof.split('.');pieces[2]=(pieces[2][0]==='A'?'B':'A')+pieces[2].slice(1);
 await assert.rejects(()=>verify(pieces.join('.'),{...f,playerId:'op_user'}),/signature/);
 await assert.rejects(()=>verify(awaitable(),{}));
 function awaitable(){return 'invalid';}
 const unknown=await f.sign({...f.claim,productId:'BAD'});
 await assert.rejects(()=>verify(unknown,{...f,playerId:'op_user'}),/invalid_store_product/);
 for(const claim of [{...f.claim,revocationDate:2},{...f.claim,environment:'Sandbox'},{...f.claim,bundleId:'wrong.bundle'}]){
  const official=await f.sign(claim);
  await assert.rejects(()=>verify(f.proof,{...f,playerId:'op_user',fetchFn:async()=>({ok:true,json:async()=>({signedTransactionInfo:official})})}),/mismatch|signature_or_claims/);
 }
});
