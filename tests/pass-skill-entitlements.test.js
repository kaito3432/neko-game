const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const catalog=require('../skill-catalog.js');
const shopDefinitions=require('../store-ui-model.js').DEFINITIONS;
const products=require('../monetization-products.js');
const {opponentShopSkill}=require('../match-skill-info.js');
const skills=import('../server/skill-entitlements.mjs');
const events=import('../server/session-events.mjs');
const recovery=import('../server/reconnection.mjs');
const online=import('../server/online-profile.mjs');

const verifiedPass={store:'app_store',period:{id:'period-1',startsAt:1000,expiresAt:2000},
  verifiedAt:1000,autoRenewing:false};
const self=(playerId,passSubscription=null,entitlements={})=>({playerId,
  passSubscription,skillEntitlements:{skillModeUnlocked:true,...entitlements},
  ownedCatSkins:['default'],ownedDogSkins:['default'],ownedProfileFrames:['rank_bronze']});
const room=(matchType,host,guest)=>({matchId:'match-pass-1',matchType,profiles:{host,guest},
  roles:{host:'police',guest:'cat'},status:'matched',requiresRuleSelection:true});
const cta=(personalSkillEntitlements,permanentSkillEntitlements={ownedSkillIds:[]})=>
  opponentShopSkill({playMode:'onlineCat',game:{abilitiesEnabled:true,selectedAbilities:{police:'dash'}},
    catalog,shopDefinitions,products,permanentSkillEntitlements,personalSkillEntitlements});

test('Pass対象はserver catalog metadataから解決し、認証済み本人viewを購入扱いしない',async()=>{
  const {SERVER_SKILLS,resolvePersonalEffectiveSkillEntitlements:resolve}=await skills;
  const player=self('holder',verifiedPass,{skillModeUnlocked:false});
  const active=resolve(player,1500),inactive=resolve(player,2000);
  assert.equal(active.skillModeUnlocked,false);
  assert.deepEqual(active.availableSkillIds,[]);
  assert.deepEqual(inactive,{skillModeUnlocked:false,availableSkillIds:[],borrowedSkillIds:[]});
  assert.deepEqual(player.skillEntitlements,{skillModeUnlocked:false});
  const worker=fs.readFileSync(path.join(__dirname,'../server/worker.mjs'),'utf8');
  assert.match(worker,/effectiveSkillEntitlements:resolvePersonalEffectiveSkillEntitlements\(result\.profile\)/);
  const shop=fs.readFileSync(path.join(__dirname,'../storekit-ui.js'),'utf8');
  assert.match(shop,/オンラインで利用可能/);
  assert.match(shop,/NyanMonetization\.isSkillOwned\(skill\.id\)\?'所持済み'/);
});

test('期限切れ後も無料・単品・Pack権利を維持し、Pass中購入も永続化',async()=>{
  const {resolvePersonalEffectiveSkillEntitlements:resolve,applyVerifiedSkillEntitlement:grant}=await skills;
  let holder=self('holder',verifiedPass);
  holder=await grant(holder,{type:'product',productId:'SKILL_CAT_FAKE_PAW'},null,async()=>true);
  holder=await grant(holder,{type:'pack',packId:'SKILL_PACK_01'},null,async()=>true);
  const after=resolve(holder,2000);
  for(const id of ['CAT_STEALTH','POLICE_HOWL','CAT_FAKE_PAW','POLICE_GROUP_SEARCH','POLICE_DASH'])
    assert.ok(after.availableSkillIds.includes(id),id);
  assert.deepEqual(holder.skillEntitlements.purchasedProductIds,['SKILL_CAT_FAKE_PAW']);
  assert.deepEqual(holder.skillEntitlements.ownedSkillPackIds,['SKILL_PACK_01']);
  const freeOnly=resolve(self('free',null),2000);
  assert.deepEqual(freeOnly.availableSkillIds,['CAT_STEALTH','POLICE_HOWL']);
});

test('Pass holderのRoom Skillは相手へ一時共有され、次のRandomでは本人以外に付かない',async()=>{
  const {captureMatchSkillEntitlements:capture,resolveEffectiveSkillEntitlements:effective}=await skills;
  const {sessionEvent}=await events;
  const host=self('pass',verifiedPass),guest=self('free');
  const shared=room('roomMatch',host,guest),before=structuredClone(guest);
  shared.skillEntitlementSnapshot=capture(shared,1500);
  assert.ok(effective(shared,'guest').borrowedSkillIds.includes('CAT_FAKE_PAW'));
  assert.deepEqual(sessionEvent(shared,'host',{type:'ruleSelect',rule:'ability'}),{type:'ruleSelect',rule:'ability'});
  assert.deepEqual(sessionEvent(shared,'guest',{type:'abilityReady',ability:'fakePaw'}),{type:'abilityReady'});
  assert.equal(shared.approvedSkills.cat,'CAT_FAKE_PAW');
  assert.deepEqual(guest,before);
  const ranked=room('randomMatch',host,guest);
  ranked.skillEntitlementSnapshot=capture(ranked,1500);
  assert.ok(effective(ranked,'host').availableSkillIds.includes('POLICE_DASH'));
  assert.equal(effective(ranked,'guest').availableSkillIds.includes('CAT_FAKE_PAW'),false);
  assert.deepEqual(sessionEvent(ranked,'host',{type:'ruleSelect',rule:'ability'}),{type:'ruleSelect',rule:'ability'});
  assert.deepEqual(sessionEvent(ranked,'host',{type:'abilityReady',ability:'dash'}),{type:'abilityReady'});
});

test('Pass加入はRoom Skill Modeの両者unlock条件を突破しない',async()=>{
  const {captureMatchSkillEntitlements:capture,canUseOnlineSkillMode:canUse,
    resolveEffectiveSkillEntitlements:effective}=await skills;
  const {sessionEvent}=await events;
  for(const [hostUnlocked,guestUnlocked] of [[false,true],[true,false]]){
    const host=self('pass',verifiedPass,{skillModeUnlocked:hostUnlocked});
    const guest=self('guest',null,{skillModeUnlocked:guestUnlocked});
    const match=room('roomMatch',host,guest);
    match.skillEntitlementSnapshot=capture(match,1500);
    assert.equal(canUse(match),false);
    assert.equal(effective(match,'guest').skillModeUnlocked,false);
    assert.equal(sessionEvent(match,'host',{type:'ruleSelect',rule:'ability'}).skillError,'SKILL_MODE_LOCKED');
  }
});

test('Result CTAはPass本人権利で非表示、失効とRoom共有のみなら表示',async()=>{
  const {resolvePersonalEffectiveSkillEntitlements:resolve}=await skills;
  const active=self('pass',verifiedPass);
  assert.equal(cta(resolve(active,1500)),null);
  assert.equal(cta(resolve(active,2000))?.id,'POLICE_DASH');
  const borrowed={skillModeUnlocked:true,availableSkillIds:['POLICE_DASH'],borrowedSkillIds:['POLICE_DASH']};
  assert.equal(cta(resolve(self('guest'),1500))?.id,'POLICE_DASH');
  assert.ok(borrowed.borrowedSkillIds.includes('POLICE_DASH'));
  let purchased=self('owner');
  purchased.skillEntitlements.ownedSkillIds=['POLICE_DASH'];
  assert.equal(cta(resolve(purchased,2000),purchased.skillEntitlements),null);
});

test('期限内に固定したMatchは失効後のreconnectでもSkillを維持し、新Matchは再判定',async()=>{
  const {captureMatchSkillEntitlements:capture,resolveEffectiveSkillEntitlements:effective}=await skills;
  const {sessionEvent}=await events,{publicRecovery}=await recovery;
  const host=self('pass',verifiedPass),guest=self('free');
  const ongoing=room('roomMatch',host,guest);
  ongoing.skillEntitlementSnapshot=capture(ongoing,1500);
  sessionEvent(ongoing,'host',{type:'ruleSelect',rule:'ability'});
  sessionEvent(ongoing,'host',{type:'abilityReady',ability:'dash'});
  ongoing.privateAbilities={police:'dash'};
  const restored=publicRecovery(ongoing,'host');
  assert.equal(restored.ownAbility,'dash');
  assert.ok(restored.effectiveSkillEntitlements.availableSkillIds.includes('POLICE_DASH'));
  assert.equal(restored.skillModeAvailable,true);
  const next=room('roomMatch',host,guest);
  next.skillEntitlementSnapshot=capture(next,2000);
  assert.equal(effective(next,'host').availableSkillIds.includes('POLICE_DASH'),false);
  assert.equal(sessionEvent(next,'host',{type:'ruleSelect',rule:'ability'}).type,'ruleSelect');
  assert.equal(sessionEvent(next,'host',{type:'abilityReady',ability:'dash'}).skillError,'SKILL_NOT_OWNED');
});

test('登録・appearance更新のPass自己申告は拒否し、旧profileはinactiveへ正規化',async()=>{
  const {initialProfile,profileRequest,digestToken}=await online;
  const token='ab'.repeat(32),key=`profile:${await digestToken(token)}`;
  const values=new Map(),storage={get:async name=>values.get(name),put:async(name,value)=>values.set(name,value)};
  const claimed={passActive:true,subscription:true,expiresAt:9999999999999,passSubscription:verifiedPass};
  const make=(route,body)=>new Request(`https://players/${route}`,{method:body?'POST':'GET',
    headers:{Authorization:`Bearer ${token}`},body:body?JSON.stringify(body):undefined});
  const registered=await (await profileRequest(storage,make('register',claimed),{now:1500})).json();
  assert.equal(registered.profile.passSubscription.period,null);
  const updated=await (await profileRequest(storage,make('appearance',claimed),{now:1500})).json();
  assert.equal(updated.profile.passSubscription.period,null);
  const old=initialProfile({},'old',1500);delete old.passSubscription;
  await storage.put(key,old);
  const normalized=await (await profileRequest(storage,make('profile'),{now:1500})).json();
  assert.equal(normalized.profile.passSubscription.period,null);
  assert.equal(normalized.profile.skillEntitlements.skillModeUnlocked,false);
});
