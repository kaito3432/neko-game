import {seasonId} from './ranked-progression.mjs';
import {isPassActive} from './pass-subscription.mjs';

// Add only finished, server-allowlisted items here when their formal assets exist.
// Test fixtures supply their own catalog; no placeholder is published by Phase 3.
export const PASS_MONTHLY_SKINS=Object.freeze({
  cat_pass_2026_11_starlight:Object.freeze({category:'catSkin',passMonthlyReward:true})
});
const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;

export function passSkinPeriods(value){
  try{
    const input=typeof value==='string'?JSON.parse(value):value;
    if(!input||typeof input!=='object'||Array.isArray(input))return {};
    return Object.fromEntries(Object.entries(input).filter(([monthKey,skinId])=>
      MONTH.test(monthKey)&&typeof skinId==='string'&&skinId.length>0));
  }catch(_){return {};}
}

export function normalizePassSkinRewardsClaimed(value){
  const seen=new Set();
  return (Array.isArray(value)?value:[]).filter(record=>{
    if(!record||!MONTH.test(record.monthKey)||typeof record.skinId!=='string'||
      !Number.isSafeInteger(record.claimedAt)||record.claimedAt<0||seen.has(record.monthKey))return false;
    seen.add(record.monthKey);return true;
  }).map(({monthKey,skinId,claimedAt})=>({monthKey,skinId,claimedAt,source:'passMonthlyReward'}));
}

export function grantCurrentPassMonthlySkinIfEligible(profile,{now=Date.now(),periods={},
  catalog=PASS_MONTHLY_SKINS,knownSkins={}}={}){
  const monthKey=seasonId(now),skinId=passSkinPeriods(periods)[monthKey]||null;
  const unchanged=reason=>({profile,granted:false,monthKey,skinId,reason});
  if(!isPassActive(profile?.passSubscription,now))return unchanged('inactive');
  if(!skinId)return unchanged('unconfigured');
  const item=catalog?.[skinId],field=item?.category==='catSkin'?'ownedCatSkins':
    item?.category==='dogSkin'?'ownedDogSkins':null;
  if(!field||item.passMonthlyReward!==true||!Array.isArray(knownSkins?.[field])||
    !knownSkins[field].includes(skinId))
    return unchanged('invalid_skin');
  const history=normalizePassSkinRewardsClaimed(profile?.passSkinRewardsClaimed);
  if(history.some(record=>record.monthKey===monthKey))return unchanged('already_claimed');
  const owned=Array.isArray(profile?.[field])?profile[field]:['default'];
  if(owned.includes(skinId))return unchanged('already_owned');
  return {profile:{...profile,[field]:[...new Set([...owned,skinId])],
    passSkinRewardsClaimed:[...history,{monthKey,skinId,claimedAt:now,source:'passMonthlyReward'}]},
    granted:true,monthKey,skinId,reason:null};
}

// Called by authenticated login and, later, by the Store-verified join/renewal
// writer. Read and write inside one DO transaction, so concurrent retries grant once.
export async function applyCurrentPassMonthlySkinReward({storage,profileKey,now=Date.now(),
  periods={},catalog=PASS_MONTHLY_SKINS,knownSkins={}}={}){
  const apply=async tx=>{
    const profile=await tx.get(profileKey);
    if(!profile)return {profile:null,granted:false,monthKey:seasonId(now),skinId:null,reason:'profile_missing'};
    const result=grantCurrentPassMonthlySkinIfEligible(profile,{now,periods,catalog,knownSkins});
    if(result.granted)await tx.put(profileKey,result.profile);
    return result;
  };
  return typeof storage.transaction==='function'?storage.transaction(apply):apply(storage);
}
