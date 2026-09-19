const test=require('node:test');
const assert=require('node:assert/strict');
const modulePromise=import('../server/skill-entitlements.mjs');
const sessionPromise=import('../server/session-events.mjs');
const validationPromise=import('../server/random-game-validation.mjs');

const unlocked=(extra={})=>({skillModeUnlocked:true,ownedSkillIds:[],ownedSkillPackIds:[],purchasedProductIds:[],...extra});

test('無料猫スキルと無料警察スキルはモード解放済みなら許可',async()=>{
  const {validateSkillSelectionForMatch:v}=await modulePromise;
  assert.deepEqual(v({role:'cat',skillId:'CAT_STEALTH',entitlements:unlocked()}),{ok:true,skillId:'CAT_STEALTH',runtimeId:'sneak'});
  assert.deepEqual(v({role:'police',skillId:'POLICE_HOWL',entitlements:unlocked()}),{ok:true,skillId:'POLICE_HOWL',runtimeId:'howl'});
});

test('所有済み有料スキルだけ許可',async()=>{
  const {validateSkillSelectionForMatch:v}=await modulePromise;
  assert.equal(v({role:'police',skillId:'POLICE_DASH',entitlements:unlocked({ownedSkillIds:['POLICE_DASH']})}).ok,true);
  assert.equal(v({role:'police',skillId:'POLICE_DASH',entitlements:unlocked()}).error,'SKILL_NOT_OWNED');
});

test('未知ID・role不一致・複数指定を明確なコードで拒否',async()=>{
  const {validateSkillSelectionForMatch:v}=await modulePromise;
  assert.equal(v({role:'cat',skillId:'UNKNOWN',entitlements:unlocked()}).error,'INVALID_SKILL_ID');
  assert.equal(v({role:'cat',skillId:'POLICE_DASH',entitlements:unlocked({ownedSkillIds:['POLICE_DASH']})}).error,'SKILL_ROLE_MISMATCH');
  assert.equal(v({role:'cat',skillId:['CAT_STEALTH','CAT_FAKE_PAW'],entitlements:unlocked()}).error,'MULTIPLE_SKILLS_NOT_ALLOWED');
});

test('未解放モードでは無料スキルも拒否',async()=>{
  const {validateSkillSelectionForMatch:v}=await modulePromise;
  assert.equal(v({role:'cat',skillId:'CAT_STEALTH',entitlements:{}}).error,'SKILL_MODE_LOCKED');
});

test('PACK 01権利で3スキルを使用可能',async()=>{
  const {validateSkillSelectionForMatch:v}=await modulePromise,rights=unlocked({ownedSkillPackIds:['SKILL_PACK_01']});
  for(const [role,id] of [['cat','CAT_FAKE_PAW'],['police','POLICE_GROUP_SEARCH'],['police','POLICE_DASH']])assert.equal(v({role,skillId:id,entitlements:rights}).ok,true);
});

test('広告削除＋PACK 01商品権利でも3スキルを使用可能',async()=>{
  const {validateSkillSelectionForMatch:v}=await modulePromise,rights=unlocked({purchasedProductIds:['REMOVE_ADS_PLUS_SKILL_PACK_01']});
  for(const [role,id] of [['cat','CAT_FAKE_PAW'],['police','POLICE_GROUP_SEARCH'],['police','POLICE_DASH']])assert.equal(v({role,skillId:id,entitlements:rights}).ok,true);
});

test('登録payloadのローカル権利申告はサーバープロフィールへ取り込まない',async()=>{
  const {initialProfile}=await import('../server/online-profile.mjs');
  const profile=initialProfile({skillEntitlements:unlocked({ownedSkillIds:['POLICE_DASH']})},'P');
  assert.equal(profile.skillEntitlements.skillModeUnlocked,false);
  assert.deepEqual(profile.skillEntitlements.ownedSkillIds,[]);
});

test('サーバー内部の検証済みgrant境界だけが権利を書き込める',async()=>{
  const {applyVerifiedSkillEntitlement}=await modulePromise,profile={playerId:'P',skillEntitlements:{}};
  await assert.rejects(()=>applyVerifiedSkillEntitlement(profile,{type:'product',productId:'SKILL_POLICE_DASH'},null),/entitlement_not_verified/);
  const granted=await applyVerifiedSkillEntitlement(profile,{type:'product',productId:'SKILL_POLICE_DASH'},{transaction:'mock'},async()=>true);
  assert.deepEqual(granted.skillEntitlements.purchasedProductIds,['SKILL_POLICE_DASH']);
  assert.deepEqual(profile.skillEntitlements,{});
});

test('能力選択時にサーバープロフィール権利を検証し承認IDを固定',async()=>{
  const {sessionEvent}=await sessionPromise;
  const room={roles:{host:'cat',guest:'police'},rule:'ability',profiles:{host:{skillEntitlements:unlocked()},guest:{skillEntitlements:unlocked({ownedSkillIds:['POLICE_DASH']})}}};
  assert.deepEqual(sessionEvent(room,'host',{type:'abilityReady',ability:'sneak'}),{type:'abilityReady'});
  assert.equal(room.approvedSkills.cat,'CAT_STEALTH');
  assert.deepEqual(sessionEvent(room,'guest',{type:'abilityReady',ability:'dash'}),{type:'abilityReady'});
  assert.equal(room.approvedSkills.police,'POLICE_DASH');
  assert.deepEqual(sessionEvent(room,'guest',{type:'abilityReveal',ability:'dash'}),{type:'abilityReveal',ability:'dash'});
});

test('未所有選択と同一役割の選択差し替えを拒否',async()=>{
  const {sessionEvent}=await sessionPromise;
  const room={roles:{host:'police'},rule:'ability',profiles:{host:{skillEntitlements:unlocked({ownedSkillIds:['POLICE_DASH','POLICE_GROUP_SEARCH']})}}};
  assert.deepEqual(sessionEvent(room,'host',{type:'abilityReady',ability:'dash'}),{type:'abilityReady'});
  assert.equal(sessionEvent(room,'host',{type:'abilityReady',ability:'doubleSearch'}).skillError,'MULTIPLE_SKILLS_NOT_ALLOWED');
  const denied={roles:{host:'police'},rule:'ability',profiles:{host:{skillEntitlements:unlocked()}}};
  assert.equal(sessionEvent(denied,'host',{type:'abilityReady',ability:'dash'}).skillError,'SKILL_NOT_OWNED');
});

test('承認済みスキル使用は許可し未装備スキルは拒否',async()=>{
  const {validateSkillUseForMatch:v}=await modulePromise,approvedSkills={police:'POLICE_DASH'};
  assert.equal(v({role:'police',skillId:'dash',approvedSkills}).ok,true);
  assert.equal(v({role:'police',skillId:'doubleSearch',approvedSkills}).error,'SKILL_NOT_EQUIPPED');
});

test('試合途中で公開abilityだけを改ざんしても承認スナップショットを使用',async()=>{
  const {validateAbilityUse}=await validationPromise;
  const room={approvedSkills:{cat:'CAT_STEALTH',police:'POLICE_DASH'},abilities:{cat:'fakePaw',police:'doubleSearch'}};
  assert.equal(validateAbilityUse(room,'cat',{type:'catMove',sneakUsed:true}).ok,true);
  assert.equal(validateAbilityUse(room,'cat',{type:'catMove',fakePawUsed:true}).error,'SKILL_NOT_EQUIPPED');
  assert.equal(validateAbilityUse(room,'police',{type:'policeSkillUsed',skill:'doubleSearch'}).error,'SKILL_NOT_EQUIPPED');
});
