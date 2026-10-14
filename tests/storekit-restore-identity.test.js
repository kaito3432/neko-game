const test=require('node:test'),assert=require('node:assert/strict');
const {webcrypto,generateKeyPairSync}=require('node:crypto');globalThis.crypto||=webcrypto;
const modulePromise=import('../server/storekit-verification.mjs');
const privateKey=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({type:'pkcs8',format:'pem'});
const env={NYAN_ENVIRONMENT:'production',APP_STORE_CONNECT_PRIVATE_KEY:privateKey,
 APP_STORE_CONNECT_KEY_ID:'TEST',APP_STORE_CONNECT_ISSUER_ID:'TEST'};
const fixtures=new Map(['Sandbox','Production'].map(environment=>[environment,
 require('./apple-chain-fixture.cjs').fixture({environment})]));
async function verify(environment='Sandbox',patch={},clientPatch={}){
 const f=fixtures.get(environment),{verifyStoreKitTransaction}=await modulePromise;
 const claim={...f.claim,originalPurchaseDate:f.claim.purchaseDate,...clientPatch};
 const authoritative={...claim,signedDate:claim.signedDate+1,...patch};
 const proof=f.sign(claim),serverProof=f.sign(authoritative);assert.notEqual(proof,serverProof);
 return verifyStoreKitTransaction(proof,{env,verifier:f.verifier,restoreProof:true,
  playerId:'op_'+f.claim.appAccountToken,
  fetchFn:async()=>({ok:true,json:async()=>({signedTransactionInfo:serverProof})})});
}
for(const environment of ['Sandbox','Production'])test(`restore accepts distinct verified JWS for same ${environment} transaction`,async()=>{
 assert.equal((await verify(environment)).environment,environment);
});
for(const [field,value] of Object.entries({transactionId:'1002',originalTransactionId:'1002',
 productId:'SKILL_CAT_FAKE_PAW',bundleId:'wrong.bundle',environment:'Production',
 type:'Consumable',purchaseDate:1,appAccountToken:'22222222-2222-4222-8222-222222222222',
 inAppOwnershipType:'FAMILY_SHARED',originalPurchaseDate:1}))test(`restore rejects ${field} mismatch`,async()=>{
 await assert.rejects(()=>verify('Sandbox',{[field]:value}));
});
test('restore normalizes UUID case',async()=>{
 const token='abcdefab-abcd-4abc-8abc-abcdefabcdef';
 assert.equal((await verify('Production',{appAccountToken:token.toUpperCase()},{appAccountToken:token})).appAccountToken,token.toUpperCase());
});
test('optional originalPurchaseDate may be absent in one payload',async()=>{
 await verify('Sandbox',{originalPurchaseDate:undefined});
 await verify('Sandbox',{originalPurchaseDate:fixtures.get('Sandbox').claim.purchaseDate},{originalPurchaseDate:undefined});
});
for(const value of ['1',-1,1.5])test(`invalid originalPurchaseDate ${JSON.stringify(value)} rejected`,async()=>{
 await assert.rejects(()=>verify('Sandbox',{originalPurchaseDate:value}));
});
for(const patch of [{revocationDate:1,revocationReason:0},{revocationDate:0},{revocationReason:1}])test(`latest API revocation ${JSON.stringify(patch)} rejected`,async()=>{
 await assert.rejects(()=>verify('Sandbox',patch),/apple_transaction_mismatch/);
});
test('restore still rejects invalid Apple API signature and failed lookup',async()=>{
 const f=fixtures.get('Production'),{verifyStoreKitTransaction}=await modulePromise;
 const options={env,verifier:f.verifier,restoreProof:true};
 await assert.rejects(()=>verifyStoreKitTransaction(f.sign(f.claim),{...options,
  fetchFn:async()=>({ok:true,json:async()=>({signedTransactionInfo:'forged'})})}));
 await assert.rejects(()=>verifyStoreKitTransaction(f.sign(f.claim),{...options,
  fetchFn:async()=>({ok:false})}),/apple_transaction_not_verified/);
});
test('duplicate verified restore gives no additional rights; mixed profile environment rejected',async()=>{
 const {applyVerifiedStoreTransaction:apply}=await modulePromise,receipt=await verify();
 const values=new Map(),storage={get:async k=>structuredClone(values.get(k)),
  put:async(k,v)=>{for(const [key,value] of typeof k==='string'?[[k,v]]:Object.entries(k))values.set(key,structuredClone(value));},
  transaction:async fn=>fn(storage)};
 const profile={playerId:'op_'+receipt.appAccountToken,skillEntitlements:{purchasedProductIds:[]}};
 const context={storage,profileKey:'profile',profile,restore:true,verify:async()=>receipt};
 const first=await apply(context),second=await apply(context);
 assert.equal(first.duplicate,false);assert.equal(second.duplicate,true);
 assert.deepEqual(second.profile,first.profile);
 await storage.put('profile',{...first.profile,purchaseEnvironment:'Production'});
 await assert.rejects(()=>apply(context),/store_profile_environment_conflict/);
});
