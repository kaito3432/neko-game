import {createGoogleServiceAccountToken} from './google-play-verification.mjs';
import {normalizePassSubscription} from './pass-subscription.mjs';
import {restoreRetainedPassSkins} from './purchase-restore.mjs';

const STATES=new Set(['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED']);
const milliseconds=value=>{const time=Date.parse(value||'');return Number.isSafeInteger(time)&&time>0?time:null;};
async function hash(value){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  return [...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function googlePassConfig(env={}){
  const packageName=env.GOOGLE_PLAY_PACKAGE_NAME,productId=env.GOOGLE_PASS_PRODUCT_ID;
  const basePlanId=env.GOOGLE_PASS_BASE_PLAN_ID;
  if(!packageName||!productId||!basePlanId)throw new Error('google_pass_not_configured');
  return {packageName,productId,basePlanId};
}

// The token is only a lookup key. All entitlement fields come from Google's API.
export async function verifyGooglePassSubscription({purchaseToken,env={},fetchFn=fetch,now=Date.now()}={}){
  if(typeof purchaseToken!=='string'||purchaseToken.length<8||purchaseToken.length>4096)
    throw new Error('invalid_google_pass_token');
  const config=googlePassConfig(env);
  const accessToken=await createGoogleServiceAccountToken(env,{fetchFn,now});
  const url=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const response=await fetchFn(url,{headers:{Authorization:`Bearer ${accessToken}`}});
  if(!response.ok)throw new Error('google_pass_status_unavailable');
  const body=await response.json();
  const line=(body.lineItems||[]).find(item=>item.productId===config.productId&&
    item.offerDetails?.basePlanId===config.basePlanId);
  if(!line||!STATES.has(body.subscriptionState)||
      !['ACKNOWLEDGEMENT_STATE_PENDING','ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED']
        .includes(body.acknowledgementState))
    throw new Error('google_pass_status_not_verified');
  const startsAt=milliseconds(body.startTime),expiresAt=milliseconds(line.expiryTime);
  if(!startsAt||!expiresAt||expiresAt<=startsAt)throw new Error('google_pass_invalid_period');
  const tokenId=await hash(purchaseToken);
  return {store:'google_play',packageName:config.packageName,productId:config.productId,
    basePlanId:config.basePlanId,tokenId,
    linkedTokenId:body.linkedPurchaseToken?await hash(body.linkedPurchaseToken):null,
    periodId:`google:${tokenId}:${expiresAt}`,
    startsAt,expiresAt,autoRenewing:line.autoRenewingPlan?.autoRenewEnabled===true,
    acknowledgementState:body.acknowledgementState,
    accountId:body.externalAccountIdentifiers?.obfuscatedExternalAccountId||null,
    testPurchase:body.testPurchase!==undefined,subscriptionState:body.subscriptionState,verifiedAt:now};
}

// Lifecycle check accepts inactive Store states but never grants a period.
export async function verifyGooglePassLifecycle({purchaseToken,env={},fetchFn=fetch,now=Date.now()}={}){
  if(typeof purchaseToken!=='string'||purchaseToken.length<8||purchaseToken.length>4096)
    throw new Error('invalid_google_pass_token');
  const config=googlePassConfig(env),accessToken=await createGoogleServiceAccountToken(env,{fetchFn,now});
  const url=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const response=await fetchFn(url,{headers:{Authorization:`Bearer ${accessToken}`}});
  if(!response.ok)throw new Error('google_pass_status_unavailable');
  const body=await response.json(),line=(body.lineItems||[]).find(item=>
    item.productId===config.productId&&item.offerDetails?.basePlanId===config.basePlanId);
  if(!line||typeof body.subscriptionState!=='string')throw new Error('google_pass_status_not_verified');
  const tokenId=await hash(purchaseToken),expiresAt=milliseconds(line.expiryTime);
  // An EXPIRED or PAUSED state alone is not proof of a refund.
  const status=expiresAt&&expiresAt<=now?'expired':
    STATES.has(body.subscriptionState)?'active':'expired';
  return {status,productId:config.productId,identity:tokenId,verifiedAt:now,
    reason:null,expiresAt,orderId:body.latestOrderId||null,
    period:{id:`google:${tokenId}:${expiresAt}`,startsAt:milliseconds(body.startTime),expiresAt},
    autoRenewing:line.autoRenewingPlan?.autoRenewEnabled===true};
}

// Separate evidence path for an expired purchase. It can restore only skins
// recorded as already acquired; it never creates a subscription period.
export async function verifyGoogleExpiredPassOwnership({purchaseToken,env={},fetchFn=fetch,now=Date.now()}={}){
  if(typeof purchaseToken!=='string'||purchaseToken.length<8||purchaseToken.length>4096)
    throw new Error('invalid_google_pass_token');
  const config=googlePassConfig(env);
  const accessToken=await createGoogleServiceAccountToken(env,{fetchFn,now});
  const url=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const response=await fetchFn(url,{headers:{Authorization:`Bearer ${accessToken}`}});
  if(!response.ok)throw new Error('google_pass_status_unavailable');
  const body=await response.json(),line=(body.lineItems||[]).find(item=>
    item.productId===config.productId&&item.offerDetails?.basePlanId===config.basePlanId);
  const expiresAt=milliseconds(line?.expiryTime);
  if(body.subscriptionState!=='SUBSCRIPTION_STATE_EXPIRED'||!expiresAt||expiresAt>now)
    throw new Error('google_expired_pass_not_verified');
  return {store:'google_play',productId:config.productId,tokenId:await hash(purchaseToken),
    linkedTokenId:body.linkedPurchaseToken?await hash(body.linkedPurchaseToken):null,
    accountId:body.externalAccountIdentifiers?.obfuscatedExternalAccountId||null,
    expired:true};
}

export async function applyVerifiedGooglePass({storage,profileKey,profile,receipt,now=Date.now(),restore=false}={}){
  if(receipt?.store!=='google_play'||!/^[a-f0-9]{64}$/.test(receipt.tokenId||'')||
    receipt.periodId!==`google:${receipt.tokenId}:${receipt.expiresAt}`||
    !Number.isSafeInteger(receipt.startsAt)||!Number.isSafeInteger(receipt.expiresAt)||
    receipt.expiresAt<=receipt.startsAt)throw new Error('google_pass_not_verified');
  const marker=`pass-google-token:${receipt.tokenId}`;
  const apply=async tx=>{
    const bound=await tx.get(marker);
    if(bound?.status==='revoked')throw new Error('google_pass_revoked');
    const linked=receipt.linkedTokenId?await tx.get(`pass-google-token:${receipt.linkedTokenId}`):null;
    const deleted=bound?.state==='deleted'?bound:!bound&&linked?.state==='deleted'?linked:null;
    if(!receipt.accountId||receipt.accountId!==profile.playerId&&!deleted)
      throw new Error('google_pass_account_mismatch');
    if(deleted&&(!restore||deleted.store!=='google_play'||deleted.productId!==receipt.productId||
        receipt.expiresAt<=now))throw new Error('google_pass_restore_not_allowed');
    if(bound&&bound.playerId!==profile.playerId&&bound.state!=='deleted')
      throw new Error('google_pass_bound_to_other_player');
    const current=await tx.get(profileKey)||profile,previous=normalizePassSubscription(current.passSubscription);
    const sidecarKey=`pass-google-store:${profile.playerId}`,sidecar=await tx.get(sidecarKey);
    if(sidecar?.tokenId&&sidecar.tokenId!==receipt.tokenId&&
        sidecar.tokenId!==receipt.linkedTokenId&&!bound)
      throw new Error('google_pass_account_transfer_requires_review');
    if(previous.period&&(previous.period.expiresAt>receipt.expiresAt||
        (previous.period.expiresAt===receipt.expiresAt&&previous.period.startsAt>receipt.startsAt))){
      if(!bound)await tx.put(marker,{playerId:profile.playerId,store:'google_play',productId:receipt.productId});
      return {profile:current,receipt,duplicate:true,stale:true};
    }
    const subscription=normalizePassSubscription({store:'google_play',
      period:{id:receipt.periodId,startsAt:receipt.startsAt,expiresAt:receipt.expiresAt},
      verifiedAt:now,autoRenewing:receipt.autoRenewing});
    if(!subscription.period)throw new Error('google_pass_invalid_period');
    const duplicate=previous.period?.id===subscription.period.id&&
      previous.autoRenewing===subscription.autoRenewing;
    if(!duplicate||!bound){
      const next=deleted?restoreRetainedPassSkins({...current,passSubscription:subscription},
        {...deleted,state:'bound'},now):{...current,passSubscription:subscription};
      await tx.put({[profileKey]:next,[marker]:deleted
        ?{...deleted,state:'bound',playerId:profile.playerId,updatedAt:now,
          periodIds:[...new Set([...(deleted.periodIds||[]),receipt.periodId])]}
        :{playerId:profile.playerId,store:'google_play',productId:receipt.productId,
          periodIds:[...new Set([...(bound?.periodIds||[]),
            ...(linked?.playerId===profile.playerId?linked.periodIds||[]:[]),receipt.periodId])]},
        [sidecarKey]:{playerId:profile.playerId,tokenId:receipt.tokenId,verifiedAt:now}});
      if(deleted&&receipt.linkedTokenId&&linked?.state==='deleted')
        await tx.put(`pass-google-token:${receipt.linkedTokenId}`,
          {...linked,state:'bound',playerId:profile.playerId,updatedAt:now});
      return {profile:next,receipt,duplicate:false,stale:false};
    }
    if(bound?.playerId===profile.playerId&&!bound.productId)
      await tx.put(marker,{...bound,store:'google_play',productId:receipt.productId,
        periodIds:[...new Set([...(bound.periodIds||[]),receipt.periodId])]});
    return {profile:current,receipt,duplicate:true,stale:false};
  };
  return typeof storage.transaction==='function'?storage.transaction(apply):apply(storage);
}
