import {normalizeServerSkillEntitlements,applyVerifiedSkillEntitlement} from './skill-entitlements.mjs';
import {normalizePassSubscription} from './pass-subscription.mjs';
import {normalizePassSkinRewardsClaimed,PASS_MONTHLY_SKINS} from './pass-monthly-skins.mjs';

export const RETENTION_CLASS=Object.freeze({
  ACTIVE_ENTITLEMENT:'ACTIVE_ENTITLEMENT',PERMANENT_RESTORE:'PERMANENT_RESTORE',
  FRAUD_PREVENTION:'FRAUD_PREVENTION',TEMPORARY_OPERATIONAL:'TEMPORARY_OPERATIONAL'
});
export function reverifyIntervalMs(env={}){
  const seconds=Number(env.STORE_REVERIFY_INTERVAL_SECONDS);
  return Number.isSafeInteger(seconds)&&seconds>0?seconds*1000:6*3600000;
}
export function shouldReverify(record,{now=Date.now(),env={}}={}){
  return !Number.isSafeInteger(record?.lastVerifiedAt)||
    now-record.lastVerifiedAt>=reverifyIntervalMs(env);
}
const PREFIXES=['storekit:','googleplay:','pass-original:','pass-google-token:'];
const isPassKey=key=>key.startsWith('pass-original:')||key.startsWith('pass-google-token:');
const identityOf=key=>key.slice(key.indexOf(':')+1);

// The caller must obtain `status` from an authenticated Store API response.
// Notification bodies and client claims are never accepted as Store status.
export async function reconcileVerifiedPurchase({storage,markerKey,verify,now=Date.now()}={}){
  if(!PREFIXES.some(prefix=>markerKey?.startsWith(prefix))||typeof verify!=='function')
    throw new Error('purchase_reverification_required');
  const state=await verify(markerKey);
  if(!state||!['active','expired','revoked'].includes(state.status)||
      !Number.isSafeInteger(state.verifiedAt)||state.verifiedAt<0)
    throw new Error('purchase_state_not_verified');
  const apply=async tx=>{
    const marker=await tx.get(markerKey);
    if(!marker)throw new Error('purchase_marker_missing');
    if(marker.productId!==state.productId||
        (state.identity&&state.identity!==identityOf(markerKey)))
      throw new Error('purchase_identity_mismatch');
    if(Number.isSafeInteger(marker.lastVerifiedAt)&&state.verifiedAt<marker.lastVerifiedAt)
      return {changed:false,stale:true,status:marker.status||'active'};
    if(marker.status==='revoked'&&state.status!=='revoked'&&state.allowReactivation!==true)
      return {changed:false,stale:true,status:'revoked'};
    const revoked=state.status==='revoked',wasRevoked=marker.status==='revoked';
    const updated={...marker,status:state.status,lastVerifiedAt:state.verifiedAt,
      ...(revoked?{revokedAt:marker.revokedAt||state.revokedAt||now,
        revokeReason:String(state.reason||'store_revoked').slice(0,100),
        retentionClass:RETENTION_CLASS.FRAUD_PREVENTION}:
        wasRevoked?{revokedAt:null,revokeReason:null,retentionClass:RETENTION_CLASS.ACTIVE_ENTITLEMENT}:{})};
    if(isPassKey(markerKey)&&state.status==='active'&&state.period?.id)
      updated.periodIds=[...new Set([...(marker.periodIds||[]),state.period.id])];
    const profileKey=marker.playerId?await tx.get(`profile-key:${marker.playerId}`):null;
    const profile=profileKey?await tx.get(profileKey):null;
    if(profile&&profile.playerId===marker.playerId){
      if(isPassKey(markerKey)){
        const pass=normalizePassSubscription(profile.passSubscription);
        const matches=pass.store===(markerKey.startsWith('pass-original:')?'app_store':'google_play')&&
          Array.isArray(marker.periodIds)&&marker.periodIds.includes(pass.period?.id);
        if(matches&&(revoked||state.status==='expired')){
          const next={...pass,autoRenewing:false,
            ...(revoked?{revokedAt:updated.revokedAt}:{period:{...pass.period,
              expiresAt:Math.min(pass.period.expiresAt,Math.max(pass.period.startsAt+1,now))}})};
          await tx.put(profileKey,{...profile,passSubscription:next});
        }else if(state.status==='active'&&state.period&&
            Number.isSafeInteger(state.period.startsAt)&&Number.isSafeInteger(state.period.expiresAt)&&
            state.period.expiresAt>now&&
            (!pass.period||state.period.startsAt>=pass.period.startsAt)){
          await tx.put(profileKey,{...profile,passSubscription:normalizePassSubscription({
            store:markerKey.startsWith('pass-original:')?'app_store':'google_play',
            period:state.period,verifiedAt:state.verifiedAt,
            autoRenewing:state.autoRenewing===true})});
        }
        if(state.period?.id&&(revoked||wasRevoked&&state.allowReactivation===true&&
            state.status==='active')){
          const current=await tx.get(profileKey)||profile;
          const history=normalizePassSkinRewardsClaimed(current.passSkinRewardsClaimed);
          const affected=history.filter(row=>row.purchaseIdentity===state.period.id&&
            PASS_MONTHLY_SKINS[row.skinId]?.passMonthlyReward===true);
          if(affected.length){
            const updatedHistory=history.map(row=>affected.includes(row)
              ?revoked?{...row,revokedAt:updated.revokedAt}:
                (({revokedAt,...rest})=>rest)(row):row);
            const ownedCatSkins=[...(current.ownedCatSkins||[])];
            const ownedDogSkins=[...(current.ownedDogSkins||[])];
            for(const row of affected){
              const field=PASS_MONTHLY_SKINS[row.skinId].category==='catSkin'
                ?ownedCatSkins:ownedDogSkins;
              if(revoked){
                if(!updatedHistory.some(other=>other.skinId===row.skinId&&!other.revokedAt))
                  field.splice(field.indexOf(row.skinId),field.includes(row.skinId)?1:0);
              }else if(!field.includes(row.skinId))field.push(row.skinId);
            }
            await tx.put(profileKey,{...current,passSkinRewardsClaimed:updatedHistory,
              ownedCatSkins,ownedDogSkins});
          }
        }
        if(Array.isArray(marker.passSkinRewards)&&state.period?.id){
          updated.passSkinRewards=marker.passSkinRewards.map(row=>
            row.sourcePeriodId===state.period.id?revoked?{...row,revokedAt:updated.revokedAt}:
              wasRevoked&&state.allowReactivation===true
                ?(({revokedAt,...rest})=>rest)(row):row:row);
        }
      }else if(revoked&&!wasRevoked){
        const otherPrefix=markerKey.startsWith('storekit:')?'storekit:':'googleplay:';
        let another=false;
        for(const prefix of ['storekit:','googleplay:'])for(const [key,row] of await tx.list({prefix}))
          if(key!==markerKey&&row?.playerId===marker.playerId&&row.productId===marker.productId&&
            row.status!=='revoked'&&row.state!=='deleted')another=true;
        if(!another){
          const ent=normalizeServerSkillEntitlements(profile.skillEntitlements);
          const products=ent.purchasedProductIds.filter(id=>id!==marker.productId);
          await tx.put(profileKey,{...profile,skillEntitlements:normalizeServerSkillEntitlements({
            ...ent,purchasedProductIds:products,
            adsRemoved:products.includes('REMOVE_ADS')||
              products.includes('REMOVE_ADS_PLUS_SKILL_PACK_01')})});
        }
      }else if(state.status==='active'&&wasRevoked&&state.allowReactivation===true){
        await tx.put(profileKey,await applyVerifiedSkillEntitlement(profile,
          {type:'product',productId:marker.productId},state,async()=>true));
      }
    }
    await tx.put(markerKey,updated);
    return {changed:marker.status!==state.status,stale:false,status:state.status};
  };
  return storage.transaction?storage.transaction(apply):apply(storage);
}

// No default legal retention term is inferred. Operators must configure a
// positive technical retention window before deleting fraud-prevention records.
export function revokeRetentionDays(env={}){
  const days=Number(env.PURCHASE_REVOKE_RETENTION_DAYS);
  return Number.isSafeInteger(days)&&days>0?days:null;
}
export function retentionDecision(record,{now=Date.now(),env={}}={}){
  if(record?.retentionClass===RETENTION_CLASS.ACTIVE_ENTITLEMENT||
      record?.retentionClass===RETENTION_CLASS.PERMANENT_RESTORE||
      Array.isArray(record?.passSkinRewards)&&record.passSkinRewards.some(row=>!row.revokedAt))
    return {deletable:false,reason:'active_or_permanent_restore'};
  if(record?.retentionClass===RETENTION_CLASS.TEMPORARY_OPERATIONAL)
    return {deletable:Number.isSafeInteger(record.expiresAt)&&record.expiresAt<=now,
      reason:'temporary_operational'};
  if(record?.status==='revoked'||record?.retentionClass===RETENTION_CLASS.FRAUD_PREVENTION){
    const days=revokeRetentionDays(env);
    return {deletable:Boolean(days&&Number.isSafeInteger(record.revokedAt)&&
      record.revokedAt+days*86400000<=now),reason:'fraud_prevention'};
  }
  return {deletable:false,reason:'unclassified'};
}
export async function cleanupPurchaseRecords(storage,{now=Date.now(),env={},dryRun=true}={}){
  const candidates=[];
  for(const prefix of PREFIXES)for(const [key,record] of await storage.list({prefix}))
    if(retentionDecision(record,{now,env}).deletable)candidates.push(key);
  if(!dryRun)for(const key of candidates)await storage.delete(key);
  return candidates;
}
