import {normalizePassSkinRewardsClaimed,PASS_MONTHLY_SKINS} from './pass-monthly-skins.mjs';
import {seasonId,gameDateKey} from './ranked-progression.mjs';
import {PASS_LOGIN_GIFT_LIMIT} from './pass-gift-box.mjs';
import {RETENTION_CLASS} from './purchase-lifecycle.mjs';

export const RETAINED_REASON='store_entitlement_restore_and_replay_prevention';
const PURCHASE_PREFIXES=['storekit:','googleplay:','pass-original:','pass-google-token:'];
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(value)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');

// Called only by the future authenticated profile deletion operation. It never
// deletes a profile itself and never copies ordinary game progress.
export async function retainedPurchaseRecords(storage,profile,now=Date.now(),
  {googlePassProductId=null}={}){
  if(!profile?.playerId)throw new Error('invalid_profile');
  const previousBindingHash=await hash(profile.playerId);
  const applePass=await storage.get(`pass-store:${profile.playerId}`);
  const googlePass=await storage.get(`pass-google-store:${profile.playerId}`);
  const rewards=normalizePassSkinRewardsClaimed(profile.passSkinRewardsClaimed).filter(record=>
    PASS_MONTHLY_SKINS[record.skinId]?.passMonthlyReward===true);
  const passBindings=[];
  for(const prefix of ['pass-original:','pass-google-token:']){
    for(const [key,value] of await storage.list({prefix}))
      if(value?.playerId===profile.playerId)passBindings.push(key);
  }
  const records=[];
  for(const prefix of PURCHASE_PREFIXES){
    const entries=await storage.list({prefix});
    for(const [key,value] of entries){
      if(value?.playerId!==profile.playerId)continue;
      const isApplePass=prefix==='pass-original:',isGooglePass=prefix==='pass-google-token:';
      const store=prefix.startsWith('google')||isGooglePass?'google_play':'app_store';
      const linked=isApplePass&&applePass?.originalTransactionId===key.split(':').at(-1)||
        isGooglePass&&googlePass?.tokenId===key.slice(prefix.length);
      const matchingRewards=rewards.filter(reward=>reward.purchaseIdentity
        ?value.periodIds?.includes(reward.purchaseIdentity)
        :passBindings.length===1&&linked);
      records.push({key,record:{version:1,state:'deleted',status:value.status||'active',
        revokedAt:value.revokedAt||null,revokeReason:value.revokeReason||null,
        lastVerifiedAt:value.lastVerifiedAt||value.verifiedAt||null,
        retentionClass:value.status==='revoked'?RETENTION_CLASS.FRAUD_PREVENTION:
          isApplePass||isGooglePass?RETENTION_CLASS.PERMANENT_RESTORE:
            RETENTION_CLASS.ACTIVE_ENTITLEMENT,
        store,productId:value.productId||
        (isApplePass?applePass?.productId:isGooglePass?googlePassProductId:null),
        identity:key.slice(prefix.length),
        previousBindingHash,createdAt:value.purchaseDate||value.verifiedAt||now,updatedAt:now,
        retentionReason:RETAINED_REASON,
        periodIds:Array.isArray(value.periodIds)?value.periodIds:[],
        passSkinRewards:(linked||isApplePass&&matchingRewards.some(reward=>reward.purchaseIdentity))
          ?matchingRewards.map(({monthKey,skinId,claimedAt,purchaseIdentity,revokedAt})=>({
          rewardType:'passMonthlySkin',skinId,monthKey,acquiredAt:claimedAt,
          source:'Pass',purchaseIdentity:key.slice(prefix.length),sourcePeriodId:purchaseIdentity||null,
          ...(revokedAt?{revokedAt}:{})})):[]}});
    }
  }
  return records;
}

// Future deletion flow calls this only after removing profile and profile-key
// in the same OnlinePlayers transaction. It is not an HTTP endpoint.
export async function markDeletedPurchaseBindings(storage,profile,records){
  if(!profile?.playerId||await storage.get(`profile-key:${profile.playerId}`))
    throw new Error('profile_not_deleted');
  for(const {key,record} of records){
    if(!PURCHASE_PREFIXES.some(prefix=>key.startsWith(prefix))||record?.state!=='deleted'||
        typeof record.productId!=='string'||!record.productId)
      throw new Error('invalid_retained_purchase');
    const current=await storage.get(key);
    if(current?.playerId!==profile.playerId)throw new Error('purchase_binding_changed');
  }
  await storage.put(Object.fromEntries(records.map(({key,record})=>[key,record])));
  return records.length;
}

export function restoreRetainedPassSkins(profile,record,now=Date.now(),{skinOnly=false}={}){
  if(record?.state!=='bound'||record.status==='revoked'||!Array.isArray(record.passSkinRewards))return profile;
  const history=normalizePassSkinRewardsClaimed(profile.passSkinRewardsClaimed);
  const month=seasonId(now),claimedThisMonth=record.passSkinRewards.some(reward=>
    reward?.monthKey===month&&reward?.rewardType==='passMonthlySkin');
  const next={...profile,...(skinOnly?{}:{passRestoreBlockedMonths:claimedThisMonth?[]:[month],
    // A restored period must not issue its login gifts a second time.
    passLoginProgress:{periodId:profile.passSubscription?.period?.id||null,
      issuedCount:PASS_LOGIN_GIFT_LIMIT,lastDateKey:gameDateKey(now)}}),
    ownedCatSkins:[...(profile.ownedCatSkins||['default'])],
    ownedDogSkins:[...(profile.ownedDogSkins||['default'])],passSkinRewardsClaimed:[...history]};
  for(const reward of record.passSkinRewards){
    if(reward?.rewardType!=='passMonthlySkin'||reward.source!=='Pass'||
      reward.revokedAt||
      reward.purchaseIdentity!==record.identity||!Number.isSafeInteger(reward.acquiredAt)||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(reward.monthKey))continue;
    const item=PASS_MONTHLY_SKINS[reward.skinId];
    if(!item?.passMonthlyReward||history.some(row=>row.monthKey===reward.monthKey))continue;
    const field=item.category==='catSkin'?'ownedCatSkins':item.category==='dogSkin'?'ownedDogSkins':null;
    if(!field)continue;
    next[field]=[...new Set([...next[field],reward.skinId])];
    next.passSkinRewardsClaimed.push({monthKey:reward.monthKey,skinId:reward.skinId,
      claimedAt:reward.acquiredAt,source:'passMonthlyReward',
      purchaseIdentity:reward.sourcePeriodId||profile.passSubscription?.period?.id});
  }
  return next;
}

// Expired subscriptions are evidence for previously granted permanent skins,
// never a source of renewed Pass access or login gifts.
export async function restoreExpiredApplePassSkins({storage,profileKey,profile,receipt,
  setAccountToken,now=Date.now()}={}){
  if(receipt?.store!=='app_store'||receipt.expiresAt>now||
      !/^[0-9]+$/.test(String(receipt.originalTransactionId||''))||
      typeof setAccountToken!=='function')throw new Error('expired_pass_restore_invalid');
  const key=`pass-original:${receipt.environment}:${receipt.originalTransactionId}`;
  const record=await storage.get(key);
  if(record?.state!=='deleted'||record.status==='revoked'||record.store!=='app_store'||record.productId!==receipt.productId)
    throw new Error('expired_pass_restore_not_allowed');
  await storage.put(key,{...record,state:'pending',pendingPlayerId:profile.playerId});
  try{await setAccountToken(receipt,profile.playerId);}
  catch(error){await storage.put(key,record);throw error;}
  const apply=async tx=>{
    const pending=await tx.get(key);
    if(pending?.state!=='pending'||pending.pendingPlayerId!==profile.playerId)
      throw new Error('expired_pass_restore_conflict');
    const current=await tx.get(profileKey)||profile;
    const next=restoreRetainedPassSkins(current,{...pending,state:'bound'},now,{skinOnly:true});
    await tx.put({[profileKey]:next,[key]:{...pending,state:'bound',pendingPlayerId:null,
      playerId:profile.playerId,updatedAt:now}});
    return {profile:next,restoredSkins:next.passSkinRewardsClaimed.length-
      (current.passSkinRewardsClaimed||[]).length};
  };
  return storage.transaction?storage.transaction(apply):apply(storage);
}

export async function restoreExpiredGooglePassSkins({storage,profileKey,profile,receipt,now=Date.now()}={}){
  if(receipt?.store!=='google_play'||receipt.expired!==true||
      !/^[a-f0-9]{64}$/.test(receipt.tokenId||''))
    throw new Error('expired_google_pass_restore_invalid');
  const key=`pass-google-token:${receipt.tokenId}`;
  const bound=await storage.get(key),linkedKey=receipt.linkedTokenId
    ?`pass-google-token:${receipt.linkedTokenId}`:null;
  const linked=linkedKey?await storage.get(linkedKey):null;
  const record=bound?.state==='deleted'?bound:!bound&&linked?.state==='deleted'?linked:null;
  if(!record||record.status==='revoked'||record.store!=='google_play'||record.productId!==receipt.productId)
    throw new Error('expired_google_pass_restore_not_allowed');
  const apply=async tx=>{
    const current=await tx.get(profileKey)||profile;
    const next=restoreRetainedPassSkins(current,{...record,state:'bound'},now,{skinOnly:true});
    const linkedUpdate=linkedKey&&linked?.state==='deleted'
      ?{[linkedKey]:{...linked,state:'bound',playerId:profile.playerId,updatedAt:now}}:{};
    await tx.put({[profileKey]:next,[key]:{...record,state:'bound',playerId:profile.playerId,
      updatedAt:now},...linkedUpdate});
    return {profile:next,restoredSkins:next.passSkinRewardsClaimed.length-
      (current.passSkinRewardsClaimed||[]).length};
  };
  return storage.transaction?storage.transaction(apply):apply(storage);
}
