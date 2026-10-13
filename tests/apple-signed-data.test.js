const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,SignedDataVerifier}=require('./apple-chain-fixture.cjs');
const modulePromise=import('../server/apple-signed-data.mjs');
for(const environment of ['Production','Sandbox'])test(environment+' valid x5c chain verifies with official library',async()=>{
 const f=fixture({environment}),{verifyAppleData}=await modulePromise;
 assert.equal((await verifyAppleData(f.sign(f.claim),{verifier:f.verifier})).environment,environment);
});
test('untrusted root and invalid intermediate or leaf and chain length rejected',async()=>{
 const f=fixture(),other=fixture(),{verifyAppleData}=await modulePromise;
 await assert.rejects(()=>verifyAppleData(f.sign(f.claim)),/signature/); // production trusts only Apple
 for(const chain of [[f.x5c[0],other.x5c[1],f.x5c[2]],[other.x5c[0],f.x5c[1],f.x5c[2]],[f.x5c[0]]])
  await assert.rejects(()=>verifyAppleData(f.sign(f.claim,{x5c:chain}),{verifier:f.verifier}),/signature/);
});
test('expired certificates and missing Apple leaf/intermediate purpose OIDs rejected',async()=>{
 const {verifyAppleData}=await modulePromise;
 for(const options of [{expired:true},{leafOid:false},{intermediateOid:false}]){
  const f=fixture(options);await assert.rejects(()=>verifyAppleData(f.sign(f.claim),{verifier:f.verifier}),/signature/);
 }
});
test('wrong bundle/environment, algorithm and forged signature rejected',async()=>{
 const f=fixture(),{verifyAppleData}=await modulePromise;
 for(const claim of [{...f.claim,bundleId:'wrong.bundle'},{...f.claim,environment:'Sandbox'}])
  await assert.rejects(()=>verifyAppleData(f.sign(claim),{verifier:f.verifier}),/signature/);
 await assert.rejects(()=>verifyAppleData(f.sign(f.claim,{alg:'HS256'}),{verifier:f.verifier}),/algorithm/);
 const parts=f.sign(f.claim).split('.');parts[1]=Buffer.from(JSON.stringify({...f.claim,productId:'SKILL_CAT_FAKE_PAW'})).toString('base64url');
 await assert.rejects(()=>verifyAppleData(parts.join('.'),{verifier:f.verifier}),/signature/);
});
test('OCSP retryable failure maps to temporary unavailable; hard failure stays denied',async()=>{
 const {verifyAppleData}=await modulePromise,f=fixture();
 for(const status of [2,6]){const verifier={verifyAndDecodeTransaction:async()=>{throw Object.assign(Error('verification failed'),{status});}};
  await assert.rejects(()=>verifyAppleData(f.sign(f.claim),{verifier}),status===2?/unavailable/:/signature/);
 }
});
test('bundled Apple G3 trust anchor fingerprint and public identity verified',async()=>{
 const {APPLE_ROOT_G3}=await import('../server/apple-root-certificates.mjs'),cert=new (require('node:crypto').X509Certificate)(Buffer.from(APPLE_ROOT_G3,'base64'));
 assert.match(cert.subject,/Apple Root CA - G3/);
 assert.equal(cert.fingerprint256.replaceAll(':',''),'63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179');
 assert(cert.ca&&cert.verify(cert.publicKey));
});
test('official OCSP network failure is retryable without removing purchase rights',async()=>{
 const f=fixture({online:true,ocspUrl:'http://127.0.0.1:1/ocsp'}),{verifyAppleData}=await modulePromise;
 await assert.rejects(()=>verifyAppleData(f.sign(f.claim),{verifier:f.verifier}),/unavailable/);
});
test('signed transaction fields reject unknown product, malformed IDs/time/token and Family Sharing',async()=>{
 const f=fixture(),{verifyAppleData}=await modulePromise;
 for(const changes of [{productId:'UNKNOWN'},{transactionId:'bad'},{originalTransactionId:'bad'},
  {purchaseDate:f.now+1000},{signedDate:undefined},{appAccountToken:'bad'},
  {inAppOwnershipType:'FAMILY_SHARED'},{revocationReason:8}])
  await assert.rejects(()=>verifyAppleData(f.sign({...f.claim,...changes}),{verifier:f.verifier}));
 const revoked=await verifyAppleData(f.sign({...f.claim,revocationDate:f.now,revocationReason:0}),{verifier:f.verifier});
 assert.equal(revoked.revocationReason,0); // lifecycle consumes revocation; purchases reject it
});
