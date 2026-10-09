const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const base=path.resolve(__dirname,'..');
const skills=import('../server/skill-entitlements.mjs');
const profile=(skillModeUnlocked=false,ownedSkillIds=[])=>({playerId:'server-verified',
  skillEntitlements:{skillModeUnlocked,ownedSkillIds}});

test('authenticated personal view contains only formal skill rights and does not mutate ownership',async()=>{
  const {resolvePersonalEffectiveSkillEntitlements:effective}=await skills;
  const locked=profile(),unlocked=profile(true,['CAT_FAKE_PAW']);
  const before=[structuredClone(locked),structuredClone(unlocked)];
  assert.deepEqual(effective(locked),{skillModeUnlocked:false,availableSkillIds:[],borrowedSkillIds:[]});
  assert.deepEqual(effective(unlocked),{skillModeUnlocked:true,
    availableSkillIds:['CAT_STEALTH','CAT_FAKE_PAW','POLICE_HOWL'],borrowedSkillIds:[]});
  assert.deepEqual([locked,unlocked],before);
});

test('Sandbox and Production have no QA entitlement variables or player allowlist',()=>{
  for(const config of ['wrangler.sandbox.jsonc','wrangler.jsonc']){
    const value=fs.readFileSync(path.join(base,'server',config),'utf8');
    assert.doesNotMatch(value,/QA_SKILL_ENTITLEMENTS|SKILL_MODE_QA_PLAYER_IDS|QA_PROFILE_OVERRIDES/);
  }
  for(const file of ['skill-entitlements.mjs','worker.mjs']){
    const source=fs.readFileSync(path.join(base,'server',file),'utf8');
    assert.doesNotMatch(source,/QA_SKILL_ENTITLEMENTS|SKILL_MODE_QA_PLAYER_IDS|QA_PROFILE_OVERRIDES/);
  }
});

test('profile response and online skill UI use server-derived view without calling it purchased',()=>{
  const worker=fs.readFileSync(path.join(base,'server/worker.mjs'),'utf8');
  const identity=fs.readFileSync(path.join(base,'online-identity.js'),'utf8');
  const game=fs.readFileSync(path.join(base,'game.js'),'utf8');
  const shop=fs.readFileSync(path.join(base,'storekit-ui.js'),'utf8');
  const ranked=fs.readFileSync(path.join(base,'ranked-ui.js'),'utf8');
  assert.match(worker,/effectiveSkillEntitlements:resolvePersonalEffectiveSkillEntitlements\(result\.profile\)/);
  assert.match(identity,/new root\.CustomEvent\('nyan-online-profile',\{detail:\{profile,effectiveSkillEntitlements,passSummary\}\}\)/);
  assert.match(game,/onlineEffectiveSkillEntitlements\.availableSkillIds\?\.includes\(skillId\)/);
  assert.match(game,/borrowed\?"この部屋で利用可能"/);
  assert.match(shop,/オンラインで利用可能/);
  assert.match(shop,/root\.NyanMonetization\.isSkillOwned\(skill\.id\)\?'所持済み'/);
  assert.match(ranked,/getAuthenticatedSkillView\?\.\(\)/);
  assert.match(ranked,/skillView\?\.playerId&&skillView\.playerId===profile\.playerId&&skillView\.apiBase===root\.NyanOnline\.API_BASE/);
  assert.match(ranked,/Skill Mode：オンライン利用可能/);
});
