const test=require('node:test');
const assert=require('node:assert/strict');

const pass=import('../server/pass-subscription.mjs');
const skills=import('../server/skill-entitlements.mjs');
const online=import('../server/online-profile.mjs');
const active={store:'app_store',period:{id:'period-jan',startsAt:1000,expiresAt:2000},
  verifiedAt:900,autoRenewing:false};
const profile=(skillEntitlements={},other={})=>({playerId:'op_test',skillEntitlements,
  passSubscription:active,ownedCatSkins:['default','cat_pass_jan'],rankedStamina:{current:8},...other});

test('Storeの期間開始・満了を正とし、更新OFFでも満了までは有効',async()=>{
  const {normalizePassSubscription,isPassActive}=await pass;
  const normalized=normalizePassSubscription(active);
  assert.equal(normalized.autoRenewing,false);
  assert.equal(isPassActive(normalized,999),false);
  assert.equal(isPassActive(normalized,1000),true);
  assert.equal(isPassActive(normalized,1999),true);
  assert.equal(isPassActive(normalized,2000),false);
  assert.equal(isPassActive(normalized,2001),false);
});

test('期間データの不正値はinactiveへ正規化しクライアントの日数計算をしない',async()=>{
  const {normalizePassSubscription,isPassActive}=await pass;
  for(const value of [{...active,store:'unknown'},
    {...active,period:{...active.period,expiresAt:1000}},
    {...active,period:{...active.period,id:'bad id'}},
    {...active,verifiedAt:'900'},null]){
    assert.deepEqual(normalizePassSubscription(value),
      {version:1,store:null,period:null,verifiedAt:null,autoRenewing:false});
    assert.equal(isPassActive(value,1500),false);
  }
});

test('加入前・加入中の単品購入とPackは失効後も本人所有のまま',async()=>{
  const {resolvePersonalEffectiveSkillEntitlements:resolve,resolveServerOwnedSkillIds,
    applyVerifiedSkillEntitlement:grant}=await skills;
  const before=profile({skillModeUnlocked:true,ownedSkillIds:['CAT_FAKE_PAW']});
  let during=profile({skillModeUnlocked:true,ownedSkillIds:['CAT_FAKE_PAW']});
  during=await grant(during,{type:'product',productId:'SKILL_POLICE_DASH'},null,async()=>true);
  during=await grant(during,{type:'pack',packId:'SKILL_PACK_01'},null,async()=>true);
  assert.ok(resolve(before,1500).availableSkillIds.includes('CAT_FAKE_PAW'));
  const after=resolve(during,2000);
  assert.deepEqual(new Set(resolveServerOwnedSkillIds(during.skillEntitlements)),
    new Set(['CAT_FAKE_PAW','POLICE_GROUP_SEARCH','POLICE_DASH']));
  assert.ok(after.availableSkillIds.includes('CAT_FAKE_PAW'));
  assert.ok(after.availableSkillIds.includes('POLICE_DASH'));
  assert.ok(after.availableSkillIds.includes('POLICE_GROUP_SEARCH'));
  assert.deepEqual(during.skillEntitlements.ownedSkillIds,['CAT_FAKE_PAW']);
  assert.deepEqual(during.skillEntitlements.purchasedProductIds,['SKILL_POLICE_DASH']);
});

test('PassはSkill Modeを解放せず、広告で解放済みなら対象Skillを期間中利用できる',async()=>{
  const {resolvePersonalEffectiveSkillEntitlements:resolve,SERVER_SKILLS}=await skills;
  const self=profile({skillModeUnlocked:false,ownedSkillIds:[]});
  const current=resolve(self,1500),expired=resolve(self,2000);
  assert.equal(current.skillModeUnlocked,false);
  assert.deepEqual(current.availableSkillIds,[]);
  const unlocked=profile({skillModeUnlocked:true,ownedSkillIds:[]});
  assert.deepEqual(new Set(resolve(unlocked,1500).availableSkillIds),
    new Set(Object.values(SERVER_SKILLS).filter(skill=>skill.passEligible).map(skill=>skill.id)));
  assert.equal(expired.skillModeUnlocked,false);
  assert.deepEqual(expired.availableSkillIds,[]);
  assert.equal(self.skillEntitlements.skillModeUnlocked,false);
  assert.equal(resolve(unlocked,2000).skillModeUnlocked,true);
  assert.deepEqual(resolve(unlocked,2000).availableSkillIds,['CAT_STEALTH','POLICE_HOWL']);
});

test('Pass失効は獲得済みSkinやStaminaを変更しない',async()=>{
  const {resolvePersonalEffectiveSkillEntitlements:resolve}=await skills;
  const self=profile(),before=structuredClone(self);
  resolve(self,2000);
  assert.deepEqual(self,before);
  assert.deepEqual(self.ownedCatSkins,['default','cat_pass_jan']);
  assert.equal(self.rankedStamina.current,8);
});

test('登録payloadのPass自己申告を拒否し、新規profileはinactive',async()=>{
  const {initialProfile}=await online;
  const created=initialProfile({passSubscription:active,skillEntitlements:{skillModeUnlocked:true}},'op_new',1500);
  assert.deepEqual(created.passSubscription,
    {version:1,store:null,period:null,verifiedAt:null,autoRenewing:false});
  assert.equal(created.skillEntitlements.skillModeUnlocked,false);
});

test('Room共有とRandom本人権利、CTA本人権利はPass personal resolverを再利用',async()=>{
  const {captureMatchSkillEntitlements,resolveEffectiveSkillEntitlements,
    resolvePersonalEffectiveSkillEntitlements:personal}=await skills;
  const {opponentShopSkill}=require('../match-skill-info.js');
  const catalog=require('../skill-catalog.js'),shopDefinitions=require('../store-ui-model.js').DEFINITIONS;
  const products=require('../monetization-products.js');
  const now=Date.now(),owner=profile({skillModeUnlocked:true}, {passSubscription:{...active,
    period:{id:'period-live',startsAt:now-1000,expiresAt:now+1000},verifiedAt:now-1000}});
  const guest={playerId:'op_guest',skillEntitlements:{skillModeUnlocked:true}};
  const room={matchType:'roomMatch',profiles:{host:owner,guest}};
  room.skillEntitlementSnapshot=captureMatchSkillEntitlements(room);
  const borrowed=resolveEffectiveSkillEntitlements(room,'guest');
  assert.ok(borrowed.borrowedSkillIds.includes('CAT_FAKE_PAW'));
  const ranked=resolveEffectiveSkillEntitlements({...room,matchType:'randomMatch',
    skillEntitlementSnapshot:captureMatchSkillEntitlements({...room,matchType:'randomMatch'})},'guest');
  assert.equal(ranked.availableSkillIds.includes('CAT_FAKE_PAW'),false);
  const ctaFor=view=>opponentShopSkill({playMode:'onlinePolice',
    game:{abilitiesEnabled:true,selectedAbilities:{cat:'fakePaw'}},catalog,shopDefinitions,
    permanentSkillEntitlements:guest.skillEntitlements,personalSkillEntitlements:view,products});
  assert.equal(ctaFor(personal(owner,now)),null);
  assert.equal(ctaFor(personal(owner,now+1000))?.id,'CAT_FAKE_PAW');
  // Guest can borrow in Room but CTA consumes its authenticated personal view.
  assert.equal(ctaFor(personal(guest,now))?.id,'CAT_FAKE_PAW');
});
