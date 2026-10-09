import {isPassActive} from './pass-subscription.mjs';

export const SKILL_ERROR_CODES=Object.freeze({
  INVALID_SKILL_ID:'INVALID_SKILL_ID',
  SKILL_ROLE_MISMATCH:'SKILL_ROLE_MISMATCH',
  SKILL_MODE_LOCKED:'SKILL_MODE_LOCKED',
  SKILL_NOT_OWNED:'SKILL_NOT_OWNED',
  MULTIPLE_SKILLS_NOT_ALLOWED:'MULTIPLE_SKILLS_NOT_ALLOWED',
  SKILL_NOT_EQUIPPED:'SKILL_NOT_EQUIPPED'
});

export const SERVER_SKILLS=Object.freeze({
  CAT_STEALTH:Object.freeze({id:'CAT_STEALTH',role:'cat',runtimeId:'sneak',free:true,passEligible:true}),
  CAT_FAKE_PAW:Object.freeze({id:'CAT_FAKE_PAW',role:'cat',runtimeId:'fakePaw',free:false,passEligible:true}),
  POLICE_HOWL:Object.freeze({id:'POLICE_HOWL',role:'police',runtimeId:'howl',free:true,passEligible:true}),
  POLICE_GROUP_SEARCH:Object.freeze({id:'POLICE_GROUP_SEARCH',role:'police',runtimeId:'doubleSearch',free:false,passEligible:true}),
  POLICE_DASH:Object.freeze({id:'POLICE_DASH',role:'police',runtimeId:'dash',free:false,passEligible:true})
});

export const SERVER_SKILL_PACKS=Object.freeze({
  SKILL_PACK_01:Object.freeze(['CAT_FAKE_PAW','POLICE_GROUP_SEARCH','POLICE_DASH'])
});

export const REWARDED_AD_REWARD_TYPES=Object.freeze({
  SKILL_MODE_UNLOCK_PROGRESS:'SKILL_MODE_UNLOCK_PROGRESS',
  RANKED_STAMINA_RECOVERY:'RANKED_STAMINA_RECOVERY',
  DAILY_COIN_REWARD:'DAILY_COIN_REWARD'
});

const PRODUCT_GRANTS=Object.freeze({
  REMOVE_ADS:Object.freeze({adsRemoved:true}),
  SKILL_CAT_FAKE_PAW:Object.freeze({skillId:'CAT_FAKE_PAW'}),
  SKILL_POLICE_GROUP_SEARCH:Object.freeze({skillId:'POLICE_GROUP_SEARCH'}),
  SKILL_POLICE_DASH:Object.freeze({skillId:'POLICE_DASH'}),
  SKILL_PACK_01:Object.freeze({packId:'SKILL_PACK_01'}),
  REMOVE_ADS_PLUS_SKILL_PACK_01:Object.freeze({packId:'SKILL_PACK_01',adsRemoved:true})
});

const BY_RUNTIME=Object.freeze(Object.fromEntries(Object.values(SERVER_SKILLS).map(skill=>[skill.runtimeId,skill])));
const uniqueKnown=(values,known)=>[...new Set(Array.isArray(values)?values:[])].filter(value=>known.includes(value));

// Server-owned entitlement snapshot. Registration payload claims are deliberately
// ignored; a future receipt/reward verifier should be the only writer.
export function normalizeServerSkillEntitlements(value={}){
  const knownSkills=Object.keys(SERVER_SKILLS),knownPacks=Object.keys(SERVER_SKILL_PACKS),knownProducts=Object.keys(PRODUCT_GRANTS);
  return {
    version:1,
    skillModeUnlockAdViews:Number.isSafeInteger(Number(value?.skillModeUnlockAdViews))
      ?Math.max(0,Math.min(3,Number(value.skillModeUnlockAdViews))):0,
    skillModeUnlocked:value?.skillModeUnlocked===true||Number(value?.skillModeUnlockAdViews)>=3,
    ownedSkillIds:uniqueKnown(value?.ownedSkillIds,knownSkills).filter(id=>!SERVER_SKILLS[id].free),
    ownedSkillPackIds:uniqueKnown(value?.ownedSkillPackIds,knownPacks),
    purchasedProductIds:uniqueKnown(value?.purchasedProductIds,knownProducts),
    adsRemoved:value?.adsRemoved===true||uniqueKnown(value?.purchasedProductIds,knownProducts).some(id=>PRODUCT_GRANTS[id]?.adsRemoved===true)
  };
}

export async function applyVerifiedRewardedAdCompletion({storage,profileKey,profile,rewardType,verificationId,verification,verify}={}){
  if(rewardType!==REWARDED_AD_REWARD_TYPES.SKILL_MODE_UNLOCK_PROGRESS)throw new Error('invalid_reward_type');
  if(typeof verificationId!=='string'||!/^[A-Za-z0-9:_-]{8,200}$/.test(verificationId))throw new Error('invalid_verification_id');
  if(!storage||!profileKey||!profile?.playerId)throw new Error('invalid_reward_context');
  const marker=`rewarded-ad:${profile.playerId}:${verificationId}`;
  if(await storage.get(marker)){
    const current=await storage.get(profileKey)||profile;
    return {profile:{...current,skillEntitlements:normalizeServerSkillEntitlements(current.skillEntitlements)},applied:false,duplicate:true};
  }
  if(typeof verify!=='function')throw new Error('reward_verification_unavailable');
  if(await verify({playerId:profile.playerId,rewardType,verificationId,verification})!==true)throw new Error('reward_not_verified');
  const apply=async tx=>{
    if(await tx.get(marker)){
      const current=await tx.get(profileKey)||profile;
      return {profile:{...current,skillEntitlements:normalizeServerSkillEntitlements(current.skillEntitlements)},applied:false,duplicate:true};
    }
    const current=await tx.get(profileKey)||profile,entitlements=normalizeServerSkillEntitlements(current.skillEntitlements);
    const views=Math.min(3,entitlements.skillModeUnlockAdViews+1);
    let next={...current,skillEntitlements:{...entitlements,skillModeUnlockAdViews:views}};
    if(views>=3&&!entitlements.skillModeUnlocked){
      next=await applyVerifiedSkillEntitlement(next,{type:'skillModeUnlock'},verification,async()=>true);
      next.skillEntitlements.skillModeUnlockAdViews=3;
    }
    await tx.put({[profileKey]:next,[marker]:{rewardType,processedAt:Date.now()}});
    return {profile:next,applied:true,duplicate:false};
  };
  return typeof storage.transaction==='function'?storage.transaction(apply):apply(storage);
}

// Internal grant boundary. It is intentionally not wired to a client-controlled
// route; native store/reward verification can supply `verify` in a later phase.
export async function applyVerifiedSkillEntitlement(profile,grant,evidence,verify){
  if(typeof verify!=='function'||await verify({playerId:profile.playerId,grant,evidence})!==true)throw new Error('entitlement_not_verified');
  const current=normalizeServerSkillEntitlements(profile.skillEntitlements),next={...current};
  if(grant?.type==='skillModeUnlock')next.skillModeUnlocked=true;
  else if(grant?.type==='product'&&PRODUCT_GRANTS[grant.productId]){next.purchasedProductIds=[...new Set([...next.purchasedProductIds,grant.productId])];if(PRODUCT_GRANTS[grant.productId].adsRemoved)next.adsRemoved=true;}
  else if(grant?.type==='skill'&&SERVER_SKILLS[grant.skillId]&&!SERVER_SKILLS[grant.skillId].free)next.ownedSkillIds=[...new Set([...next.ownedSkillIds,grant.skillId])];
  else if(grant?.type==='pack'&&SERVER_SKILL_PACKS[grant.packId])next.ownedSkillPackIds=[...new Set([...next.ownedSkillPackIds,grant.packId])];
  else throw new Error('invalid_entitlement_grant');
  return {...profile,skillEntitlements:normalizeServerSkillEntitlements(next)};
}

export function resolveServerOwnedSkillIds(value={}){
  const entitlements=normalizeServerSkillEntitlements(value),owned=new Set(entitlements.ownedSkillIds);
  for(const packId of entitlements.ownedSkillPackIds)for(const skillId of SERVER_SKILL_PACKS[packId]||[])owned.add(skillId);
  for(const productId of entitlements.purchasedProductIds){
    const grant=PRODUCT_GRANTS[productId];
    if(grant?.skillId)owned.add(grant.skillId);
    if(grant?.packId)for(const skillId of SERVER_SKILL_PACKS[grant.packId]||[])owned.add(skillId);
  }
  return [...owned];
}

export function skillDefinition(skillId){return SERVER_SKILLS[skillId]||BY_RUNTIME[skillId]||null;}
export function runtimeSkillId(skillId){return skillDefinition(skillId)?.runtimeId||null;}

// Only authenticated server profile snapshots enter this boundary. A future pass
// grant belongs in the personal resolver; room sharing then needs no pass branch.
function personalSkillAccess(profile,now=Date.now()){
  const entitlements=normalizeServerSkillEntitlements(profile?.skillEntitlements);
  const owned=new Set(resolveServerOwnedSkillIds(entitlements));
  const passActive=isPassActive(profile?.passSubscription,now);
  const skillModeUnlocked=entitlements.skillModeUnlocked;
  return {skillModeUnlocked,
    availableSkillIds:skillModeUnlocked?Object.values(SERVER_SKILLS)
      .filter(skill=>skill.free||owned.has(skill.id)||(passActive&&skill.passEligible)).map(skill=>skill.id):[]};
}

export function resolvePersonalEffectiveSkillEntitlements(profile,now=Date.now()){
  return {...personalSkillAccess(profile,now),borrowedSkillIds:[]};
}

export function captureMatchSkillEntitlements(room,now=Date.now()){
  const matchType=room?.matchType==='roomMatch'?'roomMatch':'randomMatch';
  const host=personalSkillAccess(room?.profiles?.host,now),guest=personalSkillAccess(room?.profiles?.guest,now);
  return {matchType,host,guest,
    roomSharedSkillIds:matchType==='roomMatch'?[...new Set([...host.availableSkillIds,...guest.availableSkillIds])]:[]};
}

function matchSkillSnapshot(room){return room?.skillEntitlementSnapshot||captureMatchSkillEntitlements(room);}

export function resolveEffectiveSkillEntitlements(room,seat){
  const snapshot=matchSkillSnapshot(room),personal=snapshot[seat]||{skillModeUnlocked:false,availableSkillIds:[]};
  if(snapshot.matchType!=='roomMatch')return {...personal,borrowedSkillIds:[]};
  if(!room?.profiles?.host||!room?.profiles?.guest)return {skillModeUnlocked:false,availableSkillIds:[],borrowedSkillIds:[]};
  const availableSkillIds=snapshot.roomSharedSkillIds||[];
  return {skillModeUnlocked:snapshot.host.skillModeUnlocked&&snapshot.guest.skillModeUnlocked,
    availableSkillIds:[...availableSkillIds],
    borrowedSkillIds:availableSkillIds.filter(id=>!personal.availableSkillIds.includes(id))};
}

// Room shares skill entitlements, but both players must unlock Skill Mode themselves.
export function canUseOnlineSkillMode(room){
  if(!room?.profiles?.host||!room?.profiles?.guest)return false;
  const snapshot=matchSkillSnapshot(room);
  return snapshot.host.skillModeUnlocked&&snapshot.guest.skillModeUnlocked;
}

export function validateSkillSelectionForMatch({role,skillId,entitlements,effectiveEntitlements}={}){
  if(Array.isArray(skillId))return {ok:false,error:SKILL_ERROR_CODES.MULTIPLE_SKILLS_NOT_ALLOWED};
  const skill=skillDefinition(skillId);
  if(!skill)return {ok:false,error:SKILL_ERROR_CODES.INVALID_SKILL_ID};
  if(skill.role!==role)return {ok:false,error:SKILL_ERROR_CODES.SKILL_ROLE_MISMATCH};
  const access=effectiveEntitlements||personalSkillAccess({skillEntitlements:entitlements});
  if(!access.skillModeUnlocked)return {ok:false,error:SKILL_ERROR_CODES.SKILL_MODE_LOCKED};
  if(!access.availableSkillIds.includes(skill.id))return {ok:false,error:SKILL_ERROR_CODES.SKILL_NOT_OWNED};
  return {ok:true,skillId:skill.id,runtimeId:skill.runtimeId};
}

export function validateSkillUseForMatch({role,skillId,approvedSkills}={}){
  const skill=skillDefinition(skillId);
  if(!skill)return {ok:false,error:SKILL_ERROR_CODES.INVALID_SKILL_ID};
  if(skill.role!==role)return {ok:false,error:SKILL_ERROR_CODES.SKILL_ROLE_MISMATCH};
  return approvedSkills?.[role]===skill.id
    ?{ok:true,skillId:skill.id,runtimeId:skill.runtimeId}
    :{ok:false,error:SKILL_ERROR_CODES.SKILL_NOT_EQUIPPED};
}
