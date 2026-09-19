import {STORE_PRODUCT_IDS} from './storekit-verification.mjs';
import {applyVerifiedSkillEntitlement} from './skill-entitlements.mjs';

const enc=value=>new TextEncoder().encode(value);
const b64url=value=>{const bytes=value instanceof Uint8Array?value:new Uint8Array(value);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');};
const pemBytes=value=>Uint8Array.from(atob(String(value).replace(/-----[^-]+-----/g,'').replace(/\\n/g,'\n').replace(/\s/g,'')),c=>c.charCodeAt(0));

export async function createGoogleServiceAccountToken(env,{fetchFn=fetch,now=Date.now()}={}){
  if(!env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL||!env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY)throw new Error('google_play_verifier_unavailable');
  const header=b64url(enc(JSON.stringify({alg:'RS256',typ:'JWT'}))),issued=Math.floor(now/1000);
  const claim=b64url(enc(JSON.stringify({iss:env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL,scope:'https://www.googleapis.com/auth/androidpublisher',aud:'https://oauth2.googleapis.com/token',iat:issued,exp:issued+3600})));
  const key=await crypto.subtle.importKey('pkcs8',pemBytes(env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc(`${header}.${claim}`)));
  const response=await fetchFn('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${header}.${claim}.${signature}`})});
  if(!response.ok)throw new Error('google_play_auth_failed');const value=await response.json();if(!value.access_token)throw new Error('google_play_auth_failed');return value.access_token;
}

export async function verifyGooglePlayPurchase({purchaseToken,productId},{env={},fetchFn=fetch,now=Date.now()}={}){
  const packageName=env.GOOGLE_PLAY_PACKAGE_NAME||'jp.nyanchase.game';
  if(!STORE_PRODUCT_IDS.includes(productId)||typeof purchaseToken!=='string'||purchaseToken.length<8)throw new Error('invalid_google_play_purchase');
  const accessToken=await createGoogleServiceAccountToken(env,{fetchFn,now});
  const base=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}`;
  const response=await fetchFn(`${base}/purchases/productsv2/tokens/${encodeURIComponent(purchaseToken)}`,{headers:{Authorization:`Bearer ${accessToken}`}});
  if(!response.ok)throw new Error('google_play_purchase_not_verified');const purchase=await response.json();
  const ids=(purchase.productLineItem||[]).map(item=>item.productId);
  if(purchase.purchaseStateContext?.purchaseState!=='PURCHASED'||!ids.includes(productId))throw new Error('google_play_purchase_mismatch');
  return {purchaseToken,productId,orderId:purchase.orderId||null,purchaseDate:Date.parse(purchase.purchaseCompletionTime)||now,
    acknowledgementState:purchase.acknowledgementState||null,obfuscatedExternalAccountId:purchase.obfuscatedExternalAccountId||null,packageName,accessToken};
}

async function tokenHash(token){return b64url(await crypto.subtle.digest('SHA-256',enc(token)));}
export async function applyVerifiedGooglePlayPurchase({storage,profileKey,profile,purchaseToken,productId,verify,acknowledge}={}){
  if(typeof verify!=='function')throw new Error('google_play_verification_unavailable');
  const receipt=await verify({purchaseToken,productId});if(!receipt||receipt.productId!==productId||!STORE_PRODUCT_IDS.includes(productId))throw new Error('google_play_purchase_not_verified');
  if(receipt.obfuscatedExternalAccountId&&receipt.obfuscatedExternalAccountId!==profile.playerId)throw new Error('google_play_account_mismatch');
  const marker=`googleplay:${await tokenHash(receipt.purchaseToken)}`;
  const apply=async tx=>{const existing=await tx.get(marker);if(existing){if(existing.playerId!==profile.playerId)throw new Error('google_play_purchase_already_claimed');return {profile:await tx.get(profileKey)||profile,receipt:existing,duplicate:true};}
    const current=await tx.get(profileKey)||profile,next=await applyVerifiedSkillEntitlement(current,{type:'product',productId},receipt,async()=>true);
    const stored={playerId:profile.playerId,purchaseToken:receipt.purchaseToken,productId,orderId:receipt.orderId,purchaseDate:receipt.purchaseDate,verification:'verified',verifiedAt:Date.now()};
    await tx.put({[profileKey]:next,[marker]:stored});return {profile:next,receipt:stored,duplicate:false};};
  const result=typeof storage.transaction==='function'?await storage.transaction(apply):await apply(storage);
  // Acknowledge is idempotent and is retried even when entitlement storage was
  // already committed, so a transient Google API failure cannot strand it.
  if(typeof acknowledge==='function')await acknowledge(receipt);
  return result;
}

export async function acknowledgeGooglePlayPurchase(receipt,{fetchFn=fetch}={}){
  if(receipt.acknowledgementState==='ACKNOWLEDGED')return true;
  const base=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(receipt.packageName)}`;
  const response=await fetchFn(`${base}/purchases/products/${encodeURIComponent(receipt.productId)}/tokens/${encodeURIComponent(receipt.purchaseToken)}:acknowledge`,{method:'POST',headers:{Authorization:`Bearer ${receipt.accessToken}`,'content-type':'application/json'},body:'{}'});
  if(!response.ok)throw new Error('google_play_acknowledge_failed');return true;
}
