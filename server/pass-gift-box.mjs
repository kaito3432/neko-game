import {gameDateKey} from './ranked-progression.mjs';
import {isPassActive,normalizePassSubscription} from './pass-subscription.mjs';
import {withRankedStamina} from './ranked-stamina.mjs';

export const PASS_LOGIN_GIFT_SOURCE='NYAN_CHASE_PASS_LOGIN';
export const PASS_LOGIN_GIFT_DAYS=90;
export const PASS_LOGIN_GIFT_EXPIRY_MS=PASS_LOGIN_GIFT_DAYS*24*60*60*1000;
export const PASS_LOGIN_GIFT_LIMIT=15;
export const passLoginGiftAmount=index=>Number.isInteger(index)&&index>=1&&index<=15?Math.ceil(index/5):null;

export function normalizePassLoginProgress(value){
  return {periodId:typeof value?.periodId==='string'?value.periodId:null,
    issuedCount:Number.isInteger(value?.issuedCount)?Math.max(0,Math.min(PASS_LOGIN_GIFT_LIMIT,value.issuedCount)):0,
    lastDateKey:/^\d{4}-\d{2}-\d{2}$/.test(value?.lastDateKey||'')?value.lastDateKey:null};
}

export function normalizeGiftBox(value){
  const rewards=Array.isArray(value?.rewards)?value.rewards:[];
  return {version:1,rewards:rewards.filter(reward=>
    reward&&typeof reward.rewardId==='string'&&reward.rewardId.length<=240&&
    typeof reward.rewardType==='string'&&Number.isSafeInteger(reward.amount)&&reward.amount>0&&
    typeof reward.source==='string'&&Number.isSafeInteger(reward.createdAt)&&
    Number.isSafeInteger(reward.expiresAt)&&reward.expiresAt>reward.createdAt)
    .map(reward=>({rewardId:reward.rewardId,rewardType:reward.rewardType,amount:reward.amount,source:reward.source,
      createdAt:reward.createdAt,expiresAt:reward.expiresAt,claimed:reward.claimed===true,
      claimedAt:reward.claimed===true&&Number.isSafeInteger(reward.claimedAt)?reward.claimedAt:null,
      metadata:reward.metadata&&typeof reward.metadata==='object'&&!Array.isArray(reward.metadata)?reward.metadata:{}}))};
}

export function publicGiftBox(profile,now=Date.now()){
  const giftBox=normalizeGiftBox(profile?.giftBox);
  return {version:1,rewards:giftBox.rewards.map(reward=>({...reward,
    status:reward.claimed?'claimed':now>=reward.expiresAt?'expired':'claimable'})),
  badgeCount:giftBox.rewards.filter(reward=>!reward.claimed&&now<reward.expiresAt).length};
}

// Pure server-derived login transition; client payload is never consulted.
export function grantPassLoginGiftIfEligible(profile,now=Date.now()){
  const pass=normalizePassSubscription(profile?.passSubscription);
  const previous=normalizePassLoginProgress(profile?.passLoginProgress);
  const progress=previous.periodId===pass.period?.id?previous:
    {periodId:pass.period?.id||null,issuedCount:0,lastDateKey:null};
  const giftBox=normalizeGiftBox(profile?.giftBox);
  const base={...profile,passLoginProgress:progress,giftBox};
  if(!isPassActive(pass,now)||progress.issuedCount>=PASS_LOGIN_GIFT_LIMIT)return {profile:base,granted:false};
  const dateKey=gameDateKey(now);
  if(progress.lastDateKey===dateKey)return {profile:base,granted:false};
  const rewardId=`pass-login:${pass.period.id}:${dateKey}`;
  if(giftBox.rewards.some(reward=>reward.rewardId===rewardId))return {profile:base,granted:false};
  const loginIndex=progress.issuedCount+1,amount=passLoginGiftAmount(loginIndex);
  const reward={rewardId,rewardType:'STAMINA',amount,source:PASS_LOGIN_GIFT_SOURCE,
    createdAt:now,expiresAt:now+PASS_LOGIN_GIFT_EXPIRY_MS,claimed:false,claimedAt:null,
    metadata:{subscriptionPeriodId:pass.period.id,loginIndex,loginDateKey:dateKey}};
  return {profile:{...base,passLoginProgress:{...progress,issuedCount:loginIndex,lastDateKey:dateKey},
    giftBox:{version:1,rewards:[...giftBox.rewards,reward]}},granted:true,reward};
}

export async function applyPassLoginGift({storage,profileKey,now=Date.now()}){
  const apply=async tx=>{
    const profile=await tx.get(profileKey);
    if(!profile)throw new Error('unauthorized');
    const result=grantPassLoginGiftIfEligible(profile,now);
    if(JSON.stringify(result.profile)!==JSON.stringify(profile))await tx.put(profileKey,result.profile);
    return result;
  };
  return typeof storage.transaction==='function'?storage.transaction(apply):apply(storage);
}

export async function claimGiftReward({storage,profileKey,rewardId,now=Date.now()}){
  if(typeof rewardId!=='string'||rewardId.length>240||!rewardId)throw new Error('invalid_reward_id');
  const apply=async tx=>{
    const profile=await tx.get(profileKey);
    if(!profile)throw new Error('unauthorized');
    const box=normalizeGiftBox(profile.giftBox),index=box.rewards.findIndex(item=>item.rewardId===rewardId);
    if(index<0)throw new Error('gift_not_found');
    const gift=box.rewards[index];
    if(gift.claimed)throw new Error('gift_already_claimed');
    if(now>=gift.expiresAt)throw new Error('gift_expired');
    if(gift.rewardType!=='STAMINA'||gift.source!==PASS_LOGIN_GIFT_SOURCE)throw new Error('gift_type_unsupported');
    const current=withRankedStamina(profile,now),sum=current.rankedStamina.stamina+gift.amount;
    if(!Number.isSafeInteger(sum))throw new Error('stamina_overflow');
    box.rewards[index]={...gift,claimed:true,claimedAt:now};
    const next={...current,rankedStamina:{...current.rankedStamina,stamina:sum},giftBox:box};
    await tx.put(profileKey,next);
    return {profile:next,reward:box.rewards[index]};
  };
  return typeof storage.transaction==='function'?storage.transaction(apply):apply(storage);
}
