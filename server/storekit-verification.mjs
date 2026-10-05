import {applyVerifiedSkillEntitlement} from './skill-entitlements.mjs';

export const STORE_PRODUCT_IDS=Object.freeze([
  'SKILL_CAT_FAKE_PAW','SKILL_POLICE_GROUP_SEARCH','SKILL_POLICE_DASH','SKILL_PACK_01','REMOVE_ADS','REMOVE_ADS_PLUS_SKILL_PACK_01'
]);
const enc=value=>new TextEncoder().encode(value);
const b64url=value=>{const bytes=value instanceof Uint8Array?value:new Uint8Array(value);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');};
const decodePart=value=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((value.length+3)%4)),c=>c.charCodeAt(0))));
export function decodeStoreKitJws(jws){const parts=String(jws||'').split('.');if(parts.length!==3)throw new Error('invalid_storekit_jws');return decodePart(parts[1]);}
const pemBytes=value=>Uint8Array.from(atob(String(value).replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));

export async function createAppStoreServerToken(env,now=Date.now()){
  if(!env.APP_STORE_CONNECT_PRIVATE_KEY||!env.APP_STORE_CONNECT_KEY_ID||!env.APP_STORE_CONNECT_ISSUER_ID)throw new Error('app_store_verifier_unavailable');
  const header=b64url(enc(JSON.stringify({alg:'ES256',kid:env.APP_STORE_CONNECT_KEY_ID,typ:'JWT'})));
  const payload=b64url(enc(JSON.stringify({iss:env.APP_STORE_CONNECT_ISSUER_ID,iat:Math.floor(now/1000),exp:Math.floor(now/1000)+300,aud:'appstoreconnect-v1',bid:env.APPLE_BUNDLE_ID||'jp.nyanchase.game'})));
  const key=await crypto.subtle.importKey('pkcs8',pemBytes(env.APP_STORE_CONNECT_PRIVATE_KEY),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(signature)}`;
}

export async function verifyStoreKitTransaction(signedTransaction,{env={},fetchFn=fetch,now=Date.now(),restoreProof=false}={}){
  const claim=decodeStoreKitJws(signedTransaction);
  if(!STORE_PRODUCT_IDS.includes(claim.productId)||!/^[0-9]+$/.test(String(claim.transactionId||'')))throw new Error('invalid_store_product');
  const environment=claim.environment==='Production'?'Production':claim.environment==='Sandbox'?'Sandbox':null;
  if(!environment)throw new Error('unsupported_store_environment');
  if(env.NYAN_ENVIRONMENT&&environment.toLowerCase()!==env.NYAN_ENVIRONMENT)
    throw new Error('store_environment_mismatch');
  const base=environment==='Production'?'https://api.storekit.apple.com':'https://api.storekit-sandbox.apple.com';
  const token=await createAppStoreServerToken(env,now),response=await fetchFn(`${base}/inApps/v1/transactions/${claim.transactionId}`,{headers:{Authorization:`Bearer ${token}`}});
  if(!response.ok)throw new Error('apple_transaction_not_verified');
  const signedFromStore=(await response.json()).signedTransactionInfo;
  if(restoreProof&&signedTransaction!==signedFromStore)throw new Error('store_restore_proof_mismatch');
  const authoritative=decodeStoreKitJws(signedFromStore);
  const bundleId=env.APPLE_BUNDLE_ID||'jp.nyanchase.game';
  if(String(authoritative.transactionId)!==String(claim.transactionId)||authoritative.productId!==claim.productId||authoritative.bundleId!==bundleId||authoritative.revocationDate||authoritative.inAppOwnershipType==='FAMILY_SHARED')throw new Error('apple_transaction_mismatch');
  return {transactionId:String(authoritative.transactionId),originalTransactionId:String(authoritative.originalTransactionId||authoritative.transactionId),
    productId:authoritative.productId,purchaseDate:Number(authoritative.purchaseDate)||now,environment,appAccountToken:authoritative.appAccountToken||null,signedTransaction};
}

// Rechecks an already known transaction. No notification field is authoritative.
export async function verifyApplePurchaseLifecycle(transactionId,environment,{env={},fetchFn=fetch,now=Date.now()}={}){
  if(!/^[0-9]+$/.test(String(transactionId))||!['Sandbox','Production'].includes(environment))
    throw new Error('invalid_apple_transaction');
  if(env.NYAN_ENVIRONMENT&&env.NYAN_ENVIRONMENT!==environment.toLowerCase())
    throw new Error('store_environment_mismatch');
  const base=environment==='Production'?'https://api.storekit.apple.com':'https://api.storekit-sandbox.apple.com';
  const token=await createAppStoreServerToken(env,now);
  const response=await fetchFn(`${base}/inApps/v1/transactions/${transactionId}`,
    {headers:{Authorization:`Bearer ${token}`}});
  if(!response.ok)throw new Error('apple_transaction_status_unavailable');
  const signed=(await response.json()).signedTransactionInfo;
  const claim=decodeStoreKitJws(signed);
  if(String(claim.transactionId)!==String(transactionId)||
      !STORE_PRODUCT_IDS.includes(claim.productId)||
      claim.environment!==environment||claim.bundleId!==(env.APPLE_BUNDLE_ID||'jp.nyanchase.game'))
    throw new Error('apple_transaction_status_mismatch');
  return {status:claim.revocationDate?'revoked':'active',productId:claim.productId,
    identity:String(transactionId),verifiedAt:now,revokedAt:Number(claim.revocationDate)||null,
    reason:claim.revocationReason||null};
}

export async function setAppleAppAccountToken(receipt,playerId,{env={},fetchFn=fetch,now=Date.now()}={}){
  const accountToken=String(playerId||'').replace(/^op_/,'').toLowerCase();
  if(!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(accountToken)||
      !/^[0-9]+$/.test(String(receipt?.originalTransactionId||''))||
      !['Sandbox','Production','sandbox','production'].includes(receipt?.environment))
    throw new Error('invalid_apple_rebind');
  const base=String(receipt.environment).toLowerCase()==='production'
    ?'https://api.storekit.apple.com':'https://api.storekit-sandbox.apple.com';
  const token=await createAppStoreServerToken(env,now);
  const response=await fetchFn(`${base}/inApps/v1/transactions/${receipt.originalTransactionId}/appAccountToken`,{
    method:'PUT',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify({appAccountToken:accountToken})});
  if(!response.ok)throw new Error('apple_app_account_token_update_failed');
  return true;
}

export async function applyVerifiedStoreTransaction({storage,profileKey,profile,signedTransaction,verify,
  restore=false,setAccountToken}={}){
  if(typeof verify!=='function')throw new Error('store_verification_unavailable');
  const receipt=await verify(signedTransaction);if(!receipt||!STORE_PRODUCT_IDS.includes(receipt.productId))throw new Error('store_transaction_not_verified');
  const playerAccountToken=String(profile.playerId||'').replace(/^op_/,'').toLowerCase();
  // OnlinePlayers is a single named Durable Object, so this marker is global
  // across profiles and prevents one verified JWS being claimed by two users.
  const marker=`storekit:${receipt.transactionId}`;
  const prior=await storage.get(marker),deleted=prior?.state==='deleted';
  if(prior?.status==='revoked')throw new Error('store_purchase_revoked');
  const pending=prior?.state==='pending'&&prior.pendingPlayerId===profile.playerId;
  if(receipt.appAccountToken&&String(receipt.appAccountToken).toLowerCase()!==playerAccountToken&&!deleted&&!pending)
    throw new Error('store_account_mismatch');
  if(deleted||pending){
    if(!restore||typeof setAccountToken!=='function'||prior.store!=='app_store'||
        prior.productId!==receipt.productId)throw new Error('store_restore_not_allowed');
    if(deleted)await storage.put(marker,{...prior,state:'pending',pendingPlayerId:profile.playerId});
    try{await setAccountToken(receipt,profile.playerId);}
    catch(error){if(deleted)await storage.put(marker,prior);throw error;}
  }
  const apply=async tx=>{
    const existing=await tx.get(marker);
    if(existing?.state==='pending'&&existing.pendingPlayerId!==profile.playerId)
      throw new Error('store_restore_conflict');
    if(existing&&existing.state!=='pending'){
      if(existing.playerId!==profile.playerId)throw new Error('store_transaction_already_claimed');
      const current=await tx.get(profileKey)||profile;return {profile:current,receipt:existing,duplicate:true};
    }
    const current=await tx.get(profileKey)||profile,next=await applyVerifiedSkillEntitlement(current,{type:'product',productId:receipt.productId},receipt,async()=>true);
    const stored={playerId:profile.playerId,transactionId:receipt.transactionId,originalTransactionId:receipt.originalTransactionId,productId:receipt.productId,purchaseDate:receipt.purchaseDate,environment:receipt.environment,verification:'verified',verifiedAt:Date.now()};
    await tx.put({[profileKey]:next,[marker]:stored});return {profile:next,receipt:stored,duplicate:false};
  };
  return typeof storage.transaction==='function'?storage.transaction(apply):apply(storage);
}
