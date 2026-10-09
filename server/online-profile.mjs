// Anonymous bearer credentials are separate from the offline playerId.
// IMPORTANT: first registration imports client claims, NOT verified purchases or wins.
// Never reuse this migration endpoint as an ongoing ownership synchronization API.
export const SKINS = Object.freeze({
  ownedCatSkins: Object.freeze(['default', 'cat_kaitou', 'cat_coin_01', 'cat_master_s01_king', 'cat_pass_2026_11_starlight']),
  ownedDogSkins: Object.freeze(['default', 'dog_detective', 'dog_coin_01'])
});
const CLIENT_REGISTER_SKINS=Object.freeze({
  ownedCatSkins:Object.freeze(['default','cat_kaitou','cat_coin_01']),
  ownedDogSkins:Object.freeze(['default','dog_detective','dog_coin_01'])
});
const CLIENT_COIN_SKINS=Object.freeze({
  ownedCatSkins:Object.freeze(['cat_coin_01']),
  ownedDogSkins:Object.freeze(['dog_coin_01'])
});
import {applyCpuUnlockClaim} from './cpu-unlock-claims.mjs';
import {normalizeRanked,claimSeasonReward,masterPeriods,validateProfileFrame,rankForRp} from './ranked-progression.mjs';
import {applyVerifiedRewardedAdCompletion,normalizeServerSkillEntitlements} from './skill-entitlements.mjs';
import {normalizePassSubscription} from './pass-subscription.mjs';
import {PASS_MONTHLY_SKINS,passSkinPeriods,normalizePassSkinRewardsClaimed,
  applyCurrentPassMonthlySkinReward} from './pass-monthly-skins.mjs';
import {normalizePassLoginProgress,normalizeGiftBox,publicGiftBox,applyPassLoginGift,claimGiftReward} from './pass-gift-box.mjs';
import {passSummary} from './pass-summary.mjs';
import {applyVerifiedApplePass} from './pass-storekit.mjs';
import {applyVerifiedGooglePass} from './pass-google-play.mjs';
import {createRewardedAdAttempt} from './rewarded-ad-verification.mjs';
import {applyVerifiedStoreTransaction} from './storekit-verification.mjs';
import {applyVerifiedGooglePlayPurchase} from './google-play-verification.mjs';
import {restoreExpiredApplePassSkins,restoreExpiredGooglePassSkins} from './purchase-restore.mjs';
import {deleteOnlineProfile} from './profile-deletion.mjs';
import {STAMINA_REWARD_TYPE,applyVerifiedStaminaAd,withRankedStamina,publicRankedStamina} from './ranked-stamina.mjs';
import {DAILY_REWARD_TYPE,applyVerifiedDailyAd} from './daily-ad-reward.mjs';
const KNOWN_REWARD_SKINS=Object.freeze({cat_kaitou:'catSkin',dog_detective:'dogSkin',cat_master_s01_king:'catSkin'});

export function initialProfile(input, playerId, now = Date.now()) {
  const profile = {version: 1, playerId, createdAt: now,
    legacyPlayerId: typeof input.playerId === 'string' ? input.playerId.slice(0, 128) : null,
    ownershipSource: 'unverified-local-migration', equippedAppearance: {}};
  for (const [key, allowed] of Object.entries(CLIENT_REGISTER_SKINS)) {
    profile[key] = [...new Set(['default', ...(Array.isArray(input[key]) ? input[key] : [])
      .filter(id => allowed.includes(id))])];
  }
  profile.equippedAppearance = validateAppearance(profile, input.equippedAppearance);
  profile.profileCharacter = validateProfileCharacter(profile, input.profileCharacter);
  profile.skillEntitlements=normalizeServerSkillEntitlements();
  profile.passSubscription=normalizePassSubscription();
  profile.passSkinRewardsClaimed=[];
  profile.passLoginProgress=normalizePassLoginProgress();
  profile.giftBox=normalizeGiftBox();
  return withRankedStamina(normalizeRanked(profile,now,{},KNOWN_REWARD_SKINS),now);
}

function normalizeOnlineProfile(profile,now,periods){
  const normalized=normalizeRanked(profile,now,periods,KNOWN_REWARD_SKINS);
  return withRankedStamina({...normalized,skillEntitlements:normalizeServerSkillEntitlements(normalized.skillEntitlements),
    passSubscription:normalizePassSubscription(normalized.passSubscription),
    passSkinRewardsClaimed:normalizePassSkinRewardsClaimed(normalized.passSkinRewardsClaimed),
    passLoginProgress:normalizePassLoginProgress(normalized.passLoginProgress),
    giftBox:normalizeGiftBox(normalized.giftBox)},now);
}

export function validateAppearance(profile, requested = {}) {
  const result = {};
  for (const [field, owned] of [['catSkinId', 'ownedCatSkins'], ['dogSkinId', 'ownedDogSkins']]) {
    const id = requested?.[field];
    result[field] = SKINS[owned].includes(id) && profile[owned]?.includes(id) ? id : 'default';
  }
  return result;
}

export function validateProfileCharacter(profile, selection) {
  const owned = selection?.category === 'catSkin' ? 'ownedCatSkins' :
    selection?.category === 'dogSkin' ? 'ownedDogSkins' : null;
  return owned && SKINS[owned].includes(selection.itemId) && profile[owned]?.includes(selection.itemId)
    ? {category: selection.category, itemId: selection.itemId}
    : {category: 'catSkin', itemId: 'default'};
}

export function mergeClientCoinSkinOwnership(profile,claims={}){
  const next={...profile};
  for(const [field,allowed] of Object.entries(CLIENT_COIN_SKINS)){
    const claimed=Array.isArray(claims?.[field])?claims[field]:[];
    next[field]=[...new Set([...(Array.isArray(profile?.[field])?profile[field]:['default']),...claimed.filter(id=>allowed.includes(id))])];
  }
  return next;
}

// Public presentation only. Never expose another player's credentials, inventory or stats.
export function publicPlayerProfiles(profiles = {}) {
  return Object.fromEntries(Object.entries(profiles).filter(([, p]) => p?.playerId).map(([seat, p]) =>
    [seat, {playerId: p.playerId, profileCharacter: validateProfileCharacter(p, p.profileCharacter),
      equippedProfileFrameId:validateProfileFrame(p),ranked:{rank:rankForRp(Math.max(0,Number(p.ranked?.rp)||0)).id},
      ...(typeof p.displayName==='string'&&p.displayName.trim()?{displayName:p.displayName.slice(0,40)}:{})}]));
}

export function appearanceSnapshot(cat, police) {
  return {
    catPlayer: {playerId: cat.playerId, catSkinId: validateAppearance(cat, cat.equippedAppearance).catSkinId},
    policePlayer: {playerId: police.playerId, dogSkinId: validateAppearance(police, police.equippedAppearance).dogSkinId}
  };
}

export async function digestToken(token) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Server-internal extension point, intentionally not exposed by the HTTP router.
// A future authoritative CPU/unlock/purchase service supplies the verifier.
export async function applyVerifiedUnlock(profile, category, skinId, evidence, verify) {
  const field=category==='catSkin'?'ownedCatSkins':category==='dogSkin'?'ownedDogSkins':null;
  if(!field || !SKINS[field].includes(skinId) || typeof verify!=='function' ||
      await verify({playerId:profile.playerId,category,skinId,evidence})!==true) throw new Error('unlock_not_verified');
  return {...profile,[field]:[...new Set([...profile[field],skinId])]};
}

// Framework independent handler, serialized by its Durable Object caller.
export async function profileRequest(storage, request, options={}) {
  const path = new URL(request.url).pathname;
  const now=options.now??Date.now(),periods=masterPeriods(options.masterRewardPeriods);
  const passPeriods=passSkinPeriods(options.passSkinPeriods);
  const summarize=profile=>passSummary(profile,{now,periods:passPeriods,
    catalog:options.passSkinCatalog||PASS_MONTHLY_SKINS,knownSkins:options.passSkinKnownSkins||SKINS,
    passProductId:options.passProductId,passGroupId:options.passGroupId,
    googleProductId:options.googleProductId,googleBasePlanId:options.googleBasePlanId});
  const passReward=async key=>{
    if(!Object.keys(passPeriods).length)return null;
    const args={storage,profileKey:key,now,periods:passPeriods,
      catalog:options.passSkinCatalog||PASS_MONTHLY_SKINS,knownSkins:options.passSkinKnownSkins||SKINS};
    return applyCurrentPassMonthlySkinReward(args);
  };
  const reply = (data, status = 200) => Response.json(data, {status});
  if (path === '/register' && request.method === 'POST') {
    const input = await request.json();
    // A client-generated 256-bit token allows retry after a lost registration response.
    // Its hash, not the secret, is the persistent lookup key. playerId alone is never auth.
    const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
    if (!/^[a-f0-9]{64}$/.test(token || '')) return reply({error: 'invalid_credential'}, 401);
    const key = `profile:${await digestToken(token)}`;
    const deleted=await storage.get(`profile-deleted:${key.slice('profile:'.length)}`);
    if(deleted?.expiresAt>now)return reply({error:'profile_deleted'},410);
    let profile = await storage.get(key);
    if (!profile) {
      profile = initialProfile(input, `op_${crypto.randomUUID()}`,now);
      await storage.put(key,profile);
      await storage.put(`profile-key:${profile.playerId}`,key);
    }else{
      const normalized=normalizeOnlineProfile(profile,now,periods),index=await storage.get(`profile-key:${profile.playerId}`);
      if(JSON.stringify(normalized)!==JSON.stringify(profile))await storage.put(key,normalized);
      if(index!==key)await storage.put(`profile-key:${profile.playerId}`,key);
      profile=normalized;
    }
    try{await options.reverifyPassProfile?.(profile);profile=await storage.get(key)||profile;}
    catch(_){/* Store outage never removes current ownership. */}
    const reward=await passReward(key),gift=await applyPassLoginGift({storage,profileKey:key,now});
    return reply({profile:gift.profile,passSummary:summarize(gift.profile),...(gift.granted?{passLoginGift:gift.reward}:{}),...(reward?.granted?{passSkinReward:{granted:true,
      skinId:reward.skinId,monthKey:reward.monthKey}}:{})});
  }
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!/^[a-f0-9]{64}$/.test(token || '')) return reply({error: 'unauthorized'}, 401);
  const key = `profile:${await digestToken(token)}`;
  let profile = await storage.get(key);
  if(path==='/profile'&&request.method==='DELETE'&&!profile){
    const deleted=await storage.get(`profile-deleted:${key.slice('profile:'.length)}`);
    if(deleted?.expiresAt>now)return reply({deleted:true,duplicate:true});
  }
  if (!profile) return reply({error: 'unauthorized'}, 401);
  const normalized=normalizeOnlineProfile(profile,now,periods),index=await storage.get(`profile-key:${profile.playerId}`);
  if(JSON.stringify(normalized)!==JSON.stringify(profile))await storage.put(key,normalized);
  if(index!==key)await storage.put(`profile-key:${profile.playerId}`,key);
  profile=normalized;
  if(path==='/profile'&&request.method==='DELETE'){
    const rateKey=`profile-delete-rate:${key.slice('profile:'.length)}`;
    const previous=await storage.get(rateKey),rate=previous?.until>now
      ?previous:{until:now+600000,count:0};
    if(rate.count>=3)return reply({error:'delete_rate_limited'},429);
    await storage.put(rateKey,{until:rate.until,count:rate.count+1});
    try{return reply(await deleteOnlineProfile({storage,profileKey:key,profile,now,
      checkActiveRoom:options.checkActiveRoom,googlePassProductId:options.googleProductId}));}
    catch(error){const code=error?.message||'profile_delete_failed';
      return reply({error:code},code==='active_match'?409:
        code==='active_room_check_unavailable'?503:500);}
  }
  const isRestore=['/storekit-restore','/google-play-restore','/pass-storekit-restore',
    '/pass-google-play-restore'].includes(path);
  if(isRestore){
    if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
    const rateKey=`purchase-restore-rate:${profile.playerId}`,previous=await storage.get(rateKey);
    const rate=previous?.until>now?previous:{until:now+60000,count:0};
    if(rate.count>=10)return reply({error:'restore_rate_limited'},429);
    await storage.put(rateKey,{until:rate.until,count:rate.count+1});
  }
  if (path === '/profile' && request.method === 'GET') {
    try{await options.reverifyPassProfile?.(profile);profile=await storage.get(key)||profile;}
    catch(_){/* Store outage never removes current ownership. */}
    const reward=await passReward(key),gift=await applyPassLoginGift({storage,profileKey:key,now});profile=gift.profile;
    return reply({profile:{...profile,rankedStamina:publicRankedStamina(profile,now),disconnectStats:await storage.get(`disconnectStats:${profile.playerId}`)||{totalDisconnectForfeits:0,recentDisconnects:[]}},passSummary:summarize(profile),
      ...(gift.granted?{passLoginGift:gift.reward}:{}),
      ...(reward?.granted?{passSkinReward:{granted:true,skinId:reward.skinId,monthKey:reward.monthKey}}:{})});
  }
  if(path==='/gifts'&&request.method==='GET')return reply({giftBox:publicGiftBox(profile,now),passSummary:summarize(profile),
    passLoginProgress:profile.passLoginProgress});
  if(path==='/gift-claim'&&request.method==='POST'){
    try{
      const {rewardId}=await request.json(),result=await claimGiftReward({storage,profileKey:key,rewardId,now});
      return reply({reward:result.reward,giftBox:publicGiftBox(result.profile,now),passSummary:summarize(result.profile),
        profile:{...result.profile,rankedStamina:publicRankedStamina(result.profile,now)}});
    }catch(error){const code=error?.message||'gift_claim_failed';
      return reply({error:code},code==='gift_not_found'?404:code==='gift_already_claimed'||code==='gift_expired'?409:400);}
  }
  if((['/pass-storekit-transaction','/pass-storekit-restore'].includes(path)&&request.method==='POST')||
      (path==='/pass-subscription-refresh'&&request.method==='GET')){
    try{
      const receipt=path!=='/pass-subscription-refresh'
        ?await options.verifyPassSubscription?.((await request.json()).signedTransaction,
          {restore:path==='/pass-storekit-restore'})
        :await (async()=>{
          const sidecar=await storage.get(`pass-store:${profile.playerId}`);
          return sidecar?.originalTransactionId
            ?options.refreshPassSubscription?.(sidecar.originalTransactionId):null;
        })();
      if(!receipt){
        if(path!=='/pass-subscription-refresh')throw new Error('pass_verification_unavailable');
        return reply({profile,passSummary:summarize(profile),refreshed:false});
      }
      if(path==='/pass-storekit-restore'&&receipt.expiresAt<=now){
        const restored=await restoreExpiredApplePassSkins({storage,profileKey:key,profile,receipt,now,
          setAccountToken:options.setAppleAppAccountToken});
        return reply({profile:restored.profile,passSummary:summarize(restored.profile),
          restoredSkins:restored.restoredSkins,active:false});
      }
      const applied=await applyVerifiedApplePass({storage,profileKey:key,profile,receipt,now,
        restore:path==='/pass-storekit-restore',setAccountToken:options.setAppleAppAccountToken});
      const skin=await passReward(key),gift=await applyPassLoginGift({storage,profileKey:key,now});
      const current=gift.profile;
      return reply({profile:current,passSummary:summarize(current),receipt:{productId:receipt.productId,
        periodId:receipt.periodId,environment:receipt.environment},duplicate:applied.duplicate,
        ...(skin?.granted?{passSkinReward:{granted:true,skinId:skin.skinId,monthKey:skin.monthKey}}:{}),
        ...(gift.granted?{passLoginGift:gift.reward}:{})});
    }catch(error){const code=error?.message||'pass_verification_failed';
      return reply({error:code},code.includes('unavailable')||code.includes('not_configured')?503:403);}
  }
  if(['/pass-google-play-purchase','/pass-google-play-restore'].includes(path)&&request.method==='POST'){
    try{
      const {purchaseToken}=await request.json();
      if(typeof options.verifyGooglePass!=='function')throw new Error('google_pass_verification_unavailable');
      const rateKey=`pass-google-verify-rate:${profile.playerId}`;
      const previousRate=await storage.get(rateKey);
      const rate=previousRate?.until>now?previousRate:{until:now+60000,count:0};
      if(rate.count>=30)return reply({error:'google_pass_rate_limited'},429);
      await storage.put(rateKey,{until:rate.until,count:rate.count+1});
      let receipt;
      try{receipt=await options.verifyGooglePass(purchaseToken);}
      catch(error){
        if(path!=='/pass-google-play-restore'||error?.message!=='google_pass_status_not_verified'||
            typeof options.verifyGoogleExpiredPass!=='function')throw error;
        receipt=await options.verifyGoogleExpiredPass(purchaseToken);
      }
      if(receipt.expired===true){
        const restored=await restoreExpiredGooglePassSkins({storage,profileKey:key,profile,receipt,now});
        return reply({profile:restored.profile,passSummary:summarize(restored.profile),
          restoredSkins:restored.restoredSkins,active:false});
      }
      const applied=await applyVerifiedGooglePass({storage,profileKey:key,profile,receipt,now,
        restore:path==='/pass-google-play-restore'});
      const skin=await passReward(key),gift=await applyPassLoginGift({storage,profileKey:key,now});
      const current=gift.profile;
      return reply({profile:current,passSummary:summarize(current),
        receipt:{productId:receipt.productId,periodId:receipt.periodId},duplicate:applied.duplicate,
        ...(skin?.granted?{passSkinReward:{granted:true,skinId:skin.skinId,monthKey:skin.monthKey}}:{}),
        ...(gift.granted?{passLoginGift:gift.reward}:{})});
    }catch(error){const code=error?.message||'google_pass_verification_failed';
      return reply({error:code},code.includes('unavailable')||code.includes('not_configured')?503:403);}
  }
  if(path==='/cpu-unlock' && request.method==='POST'){
    try{
      const input=await request.json();
      const next=applyCpuUnlockClaim(profile,input);
      if(next!==profile)await storage.put(key,next);
      return reply({achievement:input.achievement,profile:next});
    }catch(_){return reply({error:'invalid_achievement'},400);}
  }
  if (path === '/appearance' && request.method === 'POST') {
    const input = await request.json();
    // Coin cosmetics currently use the local progression ledger. Only the fixed,
    // catalog-backed coin skin IDs cross this authenticated migration boundary;
    // arbitrary IDs and achievement/rank rewards are never imported here.
    profile = mergeClientCoinSkinOwnership(profile,input.collectionOwnership);
    profile.equippedAppearance = validateAppearance(profile, input.equippedAppearance);
    // Old clients that omit the field must not erase an existing profile selection.
    if (Object.hasOwn(input, 'profileCharacter'))
      profile.profileCharacter = validateProfileCharacter(profile, input.profileCharacter);
    await storage.put(key, profile);
    return reply({profile,passSummary:summarize(profile)});
  }
  if(path==='/rewarded-ad-completion'&&request.method==='POST'){
    try{
      const input=await request.json();
      const result=input.rewardType===DAILY_REWARD_TYPE
        ?await applyVerifiedDailyAd({storage,profileKey:key,profile,verificationId:input.verificationId,
          verification:input.verification,verify:options.verifyRewardedAd,now})
        :input.rewardType===STAMINA_REWARD_TYPE
        ?await applyVerifiedStaminaAd({storage,profileKey:key,profile,verificationId:input.verificationId,
          verification:input.verification,verify:options.verifyRewardedAd,now})
        :await applyVerifiedRewardedAdCompletion({storage,profileKey:key,profile,
          rewardType:input.rewardType,verificationId:input.verificationId,verification:input.verification,
          verify:options.verifyRewardedAd});
      return reply({profile:result.profile,applied:result.applied,duplicate:result.duplicate});
    }catch(error){
      const code=error?.message||'invalid_reward_completion';
      const status=code==='reward_verification_unavailable'?503:code==='reward_not_verified'?403:400;
      return reply({error:code},status);
    }
  }
  if(path==='/rewarded-ad-attempt'&&request.method==='POST'){
    try{return reply(await createRewardedAdAttempt(storage,profile,(await request.json()).rewardType,now));}
    catch(error){return reply({error:error?.message||'invalid_reward_attempt'},400);}
  }
  if(['/storekit-transaction','/storekit-restore'].includes(path)&&request.method==='POST'){
    try{const result=await applyVerifiedStoreTransaction({storage,profileKey:key,profile,signedTransaction:(await request.json()).signedTransaction,
      verify:signed=>options.verifyStoreTransaction?.(signed,{restore:path==='/storekit-restore'}),
      restore:path==='/storekit-restore',
      setAccountToken:options.setAppleAppAccountToken});
      return reply({profile:result.profile,transaction:result.receipt,duplicate:result.duplicate});}
    catch(error){const code=error?.message||'invalid_store_transaction';return reply({error:code},code.includes('unavailable')?503:403);}
  }
  if(['/google-play-purchase','/google-play-restore'].includes(path)&&request.method==='POST'){
    try{const input=await request.json(),result=await applyVerifiedGooglePlayPurchase({storage,profileKey:key,profile,purchaseToken:input.purchaseToken,productId:input.productId,
      verify:options.verifyGooglePlayPurchase,acknowledge:options.acknowledgeGooglePlayPurchase,
      restore:path==='/google-play-restore'});
      return reply({profile:result.profile,purchase:result.receipt,duplicate:result.duplicate});}
    catch(error){const code=error?.message||'invalid_google_play_purchase';return reply({error:code},code.includes('unavailable')?503:403);}
  }
  if(path==='/profile-frame'&&request.method==='POST'){
    const {frameId}=await request.json();
    if(frameId!=='rank_bronze'&&!profile.ownedProfileFrames.includes(frameId))return reply({error:'frame_not_owned'},400);
    profile.equippedProfileFrameId=validateProfileFrame(profile,frameId);
    if(profile.equippedProfileFrameId!==frameId)return reply({error:'invalid_frame'},400);
    await storage.put(key,profile);return reply({profile});
  }
  if(path==='/season-reward'&&request.method==='POST'){
    const {seasonId}=await request.json();const claimed=claimSeasonReward(profile,seasonId,now,periods,KNOWN_REWARD_SKINS);
    if(claimed.error)return reply({error:claimed.error,reward:claimed.reward,profile:claimed.profile},claimed.error==='pending_configuration'?409:400);
    await storage.put(key,claimed.profile);return reply({profile:claimed.profile,reward:claimed.reward});
  }
  // No arbitrary skin grant/import-again endpoint. cpu-unlock is the explicit
  // temporary two-achievement exception, not verified CPU match evidence.
  return reply({error: 'not_found'}, 404);
}
