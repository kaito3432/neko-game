import {createAppStoreServerToken,decodeStoreKitJws} from './storekit-verification.mjs';
import {normalizePassSubscription} from './pass-subscription.mjs';

const APPLE_BASE={sandbox:'https://api.storekit-sandbox.apple.com',production:'https://api.storekit.apple.com'};
const numericId=value=>/^[0-9]+$/.test(String(value||''));
const timestamp=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;

export function passStoreConfig(env={}){
  const environment=env.NYAN_ENVIRONMENT;
  const productId=typeof env.APPLE_PASS_PRODUCT_ID==='string'?env.APPLE_PASS_PRODUCT_ID.trim():'';
  const groupId=typeof env.APPLE_PASS_SUBSCRIPTION_GROUP_ID==='string'?env.APPLE_PASS_SUBSCRIPTION_GROUP_ID.trim():'';
  if(!APPLE_BASE[environment]||!productId||!groupId)throw new Error('pass_store_not_configured');
  return {environment,productId,groupId,bundleId:env.APPLE_BUNDLE_ID||'jp.nyanchase.game'};
}

// The client JWS supplies only a lookup key. Entitlement fields are read from
// Apple's authenticated Server API response, never from the client JWS payload.
export async function verifyApplePassStatus({signedTransaction,originalTransactionId,env={},fetchFn=fetch,now=Date.now()}={}){
  const config=passStoreConfig(env),expected=config.environment==='sandbox'?'Sandbox':'Production';
  const claim=signedTransaction?decodeStoreKitJws(signedTransaction):null;
  if(claim&&(claim.productId!==config.productId||claim.environment!==expected||!numericId(claim.transactionId)))
    throw new Error('pass_transaction_mismatch');
  const lookupId=claim?.transactionId||originalTransactionId;
  if(!numericId(lookupId))throw new Error('invalid_pass_transaction');
  const jwt=await createAppStoreServerToken(env,now);
  const response=await fetchFn(`${APPLE_BASE[config.environment]}/inApps/v1/subscriptions/${lookupId}`,
    {headers:{Authorization:`Bearer ${jwt}`}});
  if(!response.ok)throw new Error('apple_pass_status_unavailable');
  const body=await response.json();
  if(body.environment!==expected||body.bundleId!==config.bundleId)throw new Error('pass_environment_or_bundle_mismatch');
  const entries=(Array.isArray(body.data)?body.data:[])
    .filter(group=>String(group.subscriptionGroupIdentifier)===config.groupId)
    .flatMap(group=>Array.isArray(group.lastTransactions)?group.lastTransactions:[]);
  const candidates=[];
  for(const entry of entries){
    try{
      const transaction=decodeStoreKitJws(entry.signedTransactionInfo);
      const renewal=entry.signedRenewalInfo?decodeStoreKitJws(entry.signedRenewalInfo):null;
      const original=String(transaction.originalTransactionId||'');
      if(transaction.productId!==config.productId||transaction.bundleId!==config.bundleId||
          transaction.environment!==expected||!numericId(transaction.transactionId)||!numericId(original)||
          (claim&&String(claim.originalTransactionId)!==original)||
          (originalTransactionId&&String(originalTransactionId)!==original)||
          (renewal&&(String(renewal.originalTransactionId)!==original||renewal.environment!==expected||
            renewal.productId!==config.productId)))continue;
      const startsAt=timestamp(transaction.purchaseDate),appleExpiresAt=timestamp(transaction.expiresDate);
      if(!startsAt||!appleExpiresAt||appleExpiresAt<=startsAt)continue;
      const status=Number(entry.status),revoked=Boolean(transaction.revocationDate);
      const expiresAt=status===1&&!revoked?appleExpiresAt:
        Math.max(startsAt+1,Math.min(appleExpiresAt,timestamp(transaction.revocationDate)||now,now));
      if(expiresAt<=startsAt)continue;
      candidates.push({store:'app_store',environment:config.environment,productId:config.productId,
        groupId:config.groupId,originalTransactionId:original,transactionId:String(transaction.transactionId),
        appAccountToken:transaction.appAccountToken||renewal?.appAccountToken||null,
        startsAt,expiresAt,appleExpiresAt,autoRenewing:status===1&&!revoked&&Number(renewal?.autoRenewStatus)===1,
        status,verifiedAt:now,periodId:`apple:${transaction.transactionId}`});
    }catch(_){/* Malformed Apple status entry is not eligible. */}
  }
  candidates.sort((a,b)=>b.startsAt-a.startsAt||b.appleExpiresAt-a.appleExpiresAt);
  if(!candidates.length)throw new Error('apple_pass_status_not_verified');
  return candidates[0];
}

export async function applyVerifiedApplePass({storage,profileKey,profile,receipt,now=Date.now()}={}){
  if(!receipt||receipt.store!=='app_store'||!numericId(receipt.originalTransactionId)||
      !numericId(receipt.transactionId)||!Number.isSafeInteger(receipt.expiresAt)||
      !Number.isSafeInteger(receipt.startsAt)||receipt.expiresAt<=receipt.startsAt)
    throw new Error('pass_subscription_not_verified');
  const expectedToken=String(profile?.playerId||'').replace(/^op_/,'').toLowerCase();
  if(!expectedToken||String(receipt.appAccountToken||'').toLowerCase()!==expectedToken)
    throw new Error('pass_account_mismatch');
  const bindingKey=`pass-original:${receipt.environment}:${receipt.originalTransactionId}`;
  const sidecarKey=`pass-store:${profile.playerId}`;
  const apply=async tx=>{
    const bound=await tx.get(bindingKey);
    if(bound&&bound.playerId!==profile.playerId)throw new Error('pass_subscription_bound_to_other_player');
    const current=await tx.get(profileKey)||profile,previous=normalizePassSubscription(current.passSubscription);
    const previousSidecar=await tx.get(sidecarKey);
    if(previousSidecar?.originalTransactionId&&previousSidecar.originalTransactionId!==receipt.originalTransactionId)
      throw new Error('pass_account_transfer_requires_review');
    const older=previous.period&&previousSidecar?.environment===receipt.environment&&
      previous.period.startsAt>receipt.startsAt;
    if(older)return {profile:current,receipt,duplicate:true,stale:true};
    const subscription=normalizePassSubscription({store:'app_store',
      period:{id:receipt.periodId,startsAt:receipt.startsAt,expiresAt:receipt.expiresAt},
      verifiedAt:now,autoRenewing:receipt.autoRenewing});
    if(!subscription.period)throw new Error('invalid_pass_period');
    const next={...current,passSubscription:subscription};
    const sidecar={playerId:profile.playerId,environment:receipt.environment,productId:receipt.productId,
      subscriptionGroupId:receipt.groupId,originalTransactionId:receipt.originalTransactionId,
      lastTransactionId:receipt.transactionId,verifiedAt:now};
    await tx.put({[profileKey]:next,[bindingKey]:{playerId:profile.playerId},[sidecarKey]:sidecar});
    return {profile:next,receipt,duplicate:Boolean(bound&&previous.period?.id===receipt.periodId&&
      previous.period.expiresAt===receipt.expiresAt&&previous.autoRenewing===receipt.autoRenewing),stale:false};
  };
  return typeof storage.transaction==='function'?storage.transaction(apply):apply(storage);
}
