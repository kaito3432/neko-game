const test=require('node:test');
const assert=require('node:assert/strict');

const subscription=import('../server/pass-subscription.mjs');
const monthly=import('../server/pass-monthly-skins.mjs');
const skills=import('../server/skill-entitlements.mjs');

const at=value=>Date.parse(value);
const period=(startsAt,expiresAt)=>({store:'app_store',period:{id:'verified-period',startsAt,expiresAt},
  verifiedAt:startsAt,autoRenewing:false});
const entitlements=skillModeUnlocked=>({skillModeUnlocked,ownedSkillIds:[],ownedSkillPackIds:[],purchasedProductIds:[]});

test('verified period is active only inside its Store-supplied interval',async()=>{
  const {isPassActive,normalizePassSubscription}=await subscription;
  const state=period(1000,2000);
  assert.equal(isPassActive(state,999),false);
  assert.equal(isPassActive(state,1000),true);
  assert.equal(isPassActive(state,1999),true);
  assert.equal(isPassActive(state,2000),false);
  assert.equal(isPassActive({...state,store:'unknown'},1500),false);
  assert.equal(normalizePassSubscription(null).period,null);
});

test('Pass grants skill availability but never unlocks Skill Mode',async()=>{
  const {resolvePersonalEffectiveSkillEntitlements:resolve}=await skills;
  const locked={skillEntitlements:entitlements(false),passSubscription:period(1000,2000)};
  assert.deepEqual(resolve(locked,1500).availableSkillIds,[]);
  assert.equal(resolve(locked,1500).skillModeUnlocked,false);
  const unlocked={...locked,skillEntitlements:entitlements(true)};
  assert.deepEqual(new Set(resolve(unlocked,1500).availableSkillIds),new Set([
    'CAT_STEALTH','CAT_FAKE_PAW','POLICE_HOWL','POLICE_GROUP_SEARCH','POLICE_DASH']));
  assert.deepEqual(resolve(unlocked,2000).availableSkillIds,['CAT_STEALTH','POLICE_HOWL']);
});

test('Room unions personal skills only after both players unlock Skill Mode',async()=>{
  const {captureMatchSkillEntitlements:capture,canUseOnlineSkillMode:canUse,
    resolveEffectiveSkillEntitlements:effective}=await skills;
  const host={skillEntitlements:entitlements(true),passSubscription:period(1000,2000)};
  const guest={skillEntitlements:entitlements(true)};
  const room={matchType:'roomMatch',profiles:{host,guest}};
  room.skillEntitlementSnapshot=capture(room,1500);
  assert.equal(canUse(room),true);
  assert.ok(effective(room,'guest').borrowedSkillIds.includes('CAT_FAKE_PAW'));
  const ranked={matchType:'randomMatch',profiles:{host,guest}};
  ranked.skillEntitlementSnapshot=capture(ranked,1500);
  assert.equal(effective(ranked,'guest').availableSkillIds.includes('CAT_FAKE_PAW'),false);
  const lockedRoom={matchType:'roomMatch',profiles:{host,guest:{skillEntitlements:entitlements(false)}}};
  lockedRoom.skillEntitlementSnapshot=capture(lockedRoom,1500);
  assert.equal(canUse(lockedRoom),false);
});

test('monthly Skin grants once in JST current month, never backfills, and ownership survives expiry',async()=>{
  const {grantCurrentPassMonthlySkinIfEligible:grant}=await monthly;
  const now=at('2026-11-15T12:00:00+09:00');
  const skinId='cat_pass_2026_11_starlight';
  const profile={ownedCatSkins:['default'],passSkinRewardsClaimed:[],
    passSubscription:period(now-1000,now+1000)};
  const options={now,periods:{'2026-10':skinId,'2026-11':skinId},
    knownSkins:{ownedCatSkins:['default',skinId]}};
  const first=grant(profile,options);
  assert.equal(first.granted,true);
  assert.equal(first.monthKey,'2026-11');
  assert.deepEqual(first.profile.ownedCatSkins,['default',skinId]);
  assert.deepEqual(first.profile.passSkinRewardsClaimed.map(item=>item.monthKey),['2026-11']);
  assert.equal(grant(first.profile,options).granted,false);
  assert.equal(grant(profile,{...options,now:at('2026-10-15T12:00:00+09:00')}).granted,false);
  assert.deepEqual(first.profile.ownedCatSkins,['default',skinId]);
});
