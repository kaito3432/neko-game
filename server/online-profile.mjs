// Anonymous bearer credentials are separate from the offline playerId.
// IMPORTANT: first registration imports client claims, NOT verified purchases or wins.
// Never reuse this migration endpoint as an ongoing ownership synchronization API.
export const SKINS = Object.freeze({
  ownedCatSkins: Object.freeze(['default', 'cat_kaitou']),
  ownedDogSkins: Object.freeze(['default', 'dog_detective'])
});
import {applyCpuUnlockClaim} from './cpu-unlock-claims.mjs';
import {normalizeRanked,claimSeasonReward,masterPeriods} from './ranked-progression.mjs';
const KNOWN_REWARD_SKINS=Object.freeze({cat_kaitou:'catSkin',dog_detective:'dogSkin'});

export function initialProfile(input, playerId, now = Date.now()) {
  const profile = {version: 1, playerId, createdAt: now,
    legacyPlayerId: typeof input.playerId === 'string' ? input.playerId.slice(0, 128) : null,
    ownershipSource: 'unverified-local-migration', equippedAppearance: {}};
  for (const [key, allowed] of Object.entries(SKINS)) {
    profile[key] = [...new Set(['default', ...(Array.isArray(input[key]) ? input[key] : [])
      .filter(id => allowed.includes(id))])];
  }
  profile.equippedAppearance = validateAppearance(profile, input.equippedAppearance);
  return normalizeRanked(profile,now,{},KNOWN_REWARD_SKINS);
}

export function validateAppearance(profile, requested = {}) {
  const result = {};
  for (const [field, owned] of [['catSkinId', 'ownedCatSkins'], ['dogSkinId', 'ownedDogSkins']]) {
    const id = requested?.[field];
    result[field] = SKINS[owned].includes(id) && profile[owned]?.includes(id) ? id : 'default';
  }
  return result;
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
  const reply = (data, status = 200) => Response.json(data, {status});
  if (path === '/register' && request.method === 'POST') {
    const input = await request.json();
    // A client-generated 256-bit token allows retry after a lost registration response.
    // Its hash, not the secret, is the persistent lookup key. playerId alone is never auth.
    const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
    if (!/^[a-f0-9]{64}$/.test(token || '')) return reply({error: 'invalid_credential'}, 401);
    const key = `profile:${await digestToken(token)}`;
    let profile = await storage.get(key);
    if (!profile) {
      profile = initialProfile(input, `op_${crypto.randomUUID()}`,now);
      await storage.put(key,profile);
      await storage.put(`profile-key:${profile.playerId}`,key);
    }else{
      const normalized=normalizeRanked(profile,now,periods,KNOWN_REWARD_SKINS),index=await storage.get(`profile-key:${profile.playerId}`);
      if(JSON.stringify(normalized)!==JSON.stringify(profile))await storage.put(key,normalized);
      if(index!==key)await storage.put(`profile-key:${profile.playerId}`,key);
      profile=normalized;
    }
    return reply({profile});
  }
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!/^[a-f0-9]{64}$/.test(token || '')) return reply({error: 'unauthorized'}, 401);
  const key = `profile:${await digestToken(token)}`;
  let profile = await storage.get(key);
  if (!profile) return reply({error: 'unauthorized'}, 401);
  const normalized=normalizeRanked(profile,now,periods,KNOWN_REWARD_SKINS),index=await storage.get(`profile-key:${profile.playerId}`);
  if(JSON.stringify(normalized)!==JSON.stringify(profile))await storage.put(key,normalized);
  if(index!==key)await storage.put(`profile-key:${profile.playerId}`,key);
  profile=normalized;
  if (path === '/profile' && request.method === 'GET') return reply({profile:{...profile,disconnectStats:await storage.get(`disconnectStats:${profile.playerId}`)||{totalDisconnectForfeits:0,recentDisconnects:[]}}});
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
    profile.equippedAppearance = validateAppearance(profile, input.equippedAppearance);
    await storage.put(key, profile);
    return reply({profile});
  }
  if(path==='/profile-frame'&&request.method==='POST'){
    const {frameId}=await request.json();
    if(frameId!=='default'&&!profile.ownedProfileFrames.includes(frameId))return reply({error:'frame_not_owned'},400);
    profile.equippedProfileFrameId=frameId;await storage.put(key,profile);return reply({profile});
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
