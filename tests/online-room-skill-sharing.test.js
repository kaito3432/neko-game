const test=require('node:test');
const assert=require('node:assert/strict');

const skill=import('../server/skill-entitlements.mjs');
const events=import('../server/session-events.mjs');
const recovery=import('../server/reconnection.mjs');
const profile=(unlocked=false,ownedSkillIds=[])=>({skillEntitlements:{skillModeUnlocked:unlocked,ownedSkillIds}});
const match=(matchType,host,guest,roles={host:'police',guest:'cat'})=>({
  matchType,profiles:{host,guest},roles,requiresRuleSelection:true,status:'matched'
});

test('room shares host cat purchase and unlock with locked guest without persisting rights',async()=>{
  const {sessionEvent}=await events,{resolveEffectiveSkillEntitlements:effective}=await skill;
  const host=profile(true,['CAT_FAKE_PAW']),guest=profile(false),before=structuredClone(guest);
  const room=match('roomMatch',host,guest,{host:'police',guest:'cat'});
  assert.deepEqual(sessionEvent(room,'host',{type:'ruleSelect',rule:'ability'}),{type:'ruleSelect',rule:'ability'});
  assert.equal(effective(room,'guest').skillModeUnlocked,true);
  assert.ok(effective(room,'guest').borrowedSkillIds.includes('CAT_FAKE_PAW'));
  assert.deepEqual(sessionEvent(room,'guest',{type:'abilityReady',ability:'fakePaw'}),{type:'abilityReady'});
  assert.equal(room.approvedSkills.cat,'CAT_FAKE_PAW');
  assert.deepEqual(guest,before);
  assert.equal(guest.skillEntitlements.skillModeUnlocked,false);
});

test('room shares police dash in the opposite direction and unions separate grants',async()=>{
  const {sessionEvent}=await events,{captureMatchSkillEntitlements:capture,resolveEffectiveSkillEntitlements:effective}=await skill;
  const room=match('roomMatch',profile(true,['CAT_FAKE_PAW']),profile(true,['POLICE_DASH']));
  room.skillEntitlementSnapshot=capture(room);
  for(const seat of ['host','guest']){
    assert.ok(effective(room,seat).availableSkillIds.includes('CAT_FAKE_PAW'));
    assert.ok(effective(room,seat).availableSkillIds.includes('POLICE_DASH'));
  }
  assert.ok(effective(room,'host').borrowedSkillIds.includes('POLICE_DASH'));
  assert.ok(effective(room,'guest').borrowedSkillIds.includes('CAT_FAKE_PAW'));
  assert.deepEqual(sessionEvent(room,'host',{type:'ruleSelect',rule:'ability'}),{type:'ruleSelect',rule:'ability'});
  assert.deepEqual(sessionEvent(room,'host',{type:'abilityReady',ability:'dash'}),{type:'abilityReady'});
  assert.equal(room.approvedSkills.police,'POLICE_DASH');
});

test('room with neither player unlocked stays locked; missing guest cannot unlock it',async()=>{
  const {sessionEvent}=await events;
  for(const guest of [profile(false),null]){
    const room=match('roomMatch',profile(false),guest);
    assert.equal(sessionEvent(room,'host',{type:'ruleSelect',rule:'ability'}).skillError,'SKILL_MODE_LOCKED');
  }
});

test('random/ranked keeps each player personal; opponent purchase and unlock cannot be borrowed',async()=>{
  const {sessionEvent}=await events,{resolveEffectiveSkillEntitlements:effective}=await skill;
  const room=match('randomMatch',profile(true,['CAT_FAKE_PAW']),profile(true));
  assert.deepEqual(sessionEvent(room,'host',{type:'ruleSelect',rule:'ability'}),{type:'ruleSelect',rule:'ability'});
  assert.ok(effective(room,'host').availableSkillIds.includes('CAT_FAKE_PAW'));
  assert.equal(effective(room,'guest').availableSkillIds.includes('CAT_FAKE_PAW'),false);
  assert.equal(sessionEvent(room,'guest',{type:'abilityReady',ability:'fakePaw'}).skillError,'SKILL_NOT_OWNED');
  assert.equal(sessionEvent(room,'guest',{type:'abilityReady',ability:'dash'}).skillError,'SKILL_ROLE_MISMATCH');
  const locked=match('randomMatch',profile(true,['CAT_FAKE_PAW']),profile(false));
  assert.equal(sessionEvent(locked,'host',{type:'ruleSelect',rule:'ability'}).skillError,'SKILL_MODE_LOCKED');
  assert.equal(effective(locked,'guest').skillModeUnlocked,false);
});

test('room snapshot keeps borrowed selection and recovery stable after source profile changes',async()=>{
  const {sessionEvent}=await events,{publicRecovery}=await recovery;
  const room=match('roomMatch',profile(true,['CAT_FAKE_PAW']),profile(false));
  room.profiles.host.playerId='A';room.profiles.guest.playerId='B';
  sessionEvent(room,'host',{type:'ruleSelect',rule:'ability'});
  sessionEvent(room,'guest',{type:'abilityReady',ability:'fakePaw'});
  room.privateAbilities={cat:'fakePaw'};
  room.profiles.host.skillEntitlements=profile(false).skillEntitlements;
  const state=publicRecovery(room,'guest');
  assert.equal(state.skillModeAvailable,true);
  assert.equal(state.ownAbility,'fakePaw');
  assert.ok(state.effectiveSkillEntitlements.availableSkillIds.includes('CAT_FAKE_PAW'));
  assert.deepEqual(room.profiles.guest.skillEntitlements,{skillModeUnlocked:false,ownedSkillIds:[]});
});
