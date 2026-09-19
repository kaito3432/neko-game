const test=require('node:test');
const assert=require('node:assert/strict');
class Store{
  values=new Map();
  async get(key){return structuredClone(this.values.get(key));}
  async put(key,value){for(const [k,v] of typeof key==='string'?[[key,value]]:Object.entries(key))this.values.set(k,structuredClone(v));}
  async transaction(callback){return callback(this);}
}
const skillModule=import('../server/skill-entitlements.mjs');
const profileModule=import('../server/online-profile.mjs');
const rewardType='SKILL_MODE_UNLOCK_PROGRESS';

async function fixture(){
  const {initialProfile}=await profileModule,storage=new Store(),profile=initialProfile({},'P'),profileKey='profile:test';
  await storage.put(profileKey,profile);
  return {storage,profile,profileKey};
}
async function complete(f,id,verified=true,type=rewardType){
  const {applyVerifiedRewardedAdCompletion}=await skillModule;
  const result=await applyVerifiedRewardedAdCompletion({...f,profile:await f.storage.get(f.profileKey),rewardType:type,
    verificationId:id,verification:{mock:true},verify:async()=>verified});
  f.profile=result.profile;return result;
}

test('検証済み広告1回・2回・3回で進捗し3回目に永久解放',async()=>{
  const f=await fixture();
  assert.equal((await complete(f,'reward_0001')).profile.skillEntitlements.skillModeUnlockAdViews,1);
  assert.equal((await complete(f,'reward_0002')).profile.skillEntitlements.skillModeUnlockAdViews,2);
  const third=await complete(f,'reward_0003');
  assert.equal(third.profile.skillEntitlements.skillModeUnlockAdViews,3);
  assert.equal(third.profile.skillEntitlements.skillModeUnlocked,true);
});

test('4回目も3のままで永久解放を維持',async()=>{
  const f=await fixture();
  for(let i=1;i<=4;i++)await complete(f,`reward_cap_${i}`);
  assert.equal(f.profile.skillEntitlements.skillModeUnlockAdViews,3);
  assert.equal(f.profile.skillEntitlements.skillModeUnlocked,true);
});

test('同一verificationId再送は二重加算しない',async()=>{
  const f=await fixture(),first=await complete(f,'reward_duplicate');
  const duplicate=await complete(f,'reward_duplicate');
  assert.equal(first.applied,true);assert.equal(duplicate.applied,false);assert.equal(duplicate.duplicate,true);
  assert.equal(duplicate.profile.skillEntitlements.skillModeUnlockAdViews,1);
});

test('未検証イベントと不正rewardTypeは加算しない',async()=>{
  const f=await fixture();
  await assert.rejects(()=>complete(f,'reward_denied',false),/reward_not_verified/);
  await assert.rejects(()=>complete(f,'reward_invalid',true,'OTHER_REWARD'),/invalid_reward_type/);
  assert.equal((await f.storage.get(f.profileKey)).skillEntitlements.skillModeUnlockAdViews,0);
});

test('再取得後も進捗と解放状態を維持',async()=>{
  const f=await fixture();for(let i=1;i<=3;i++)await complete(f,`reward_restart_${i}`);
  const restored=await f.storage.get(f.profileKey);
  assert.equal(restored.skillEntitlements.skillModeUnlockAdViews,3);
  assert.equal(restored.skillEntitlements.skillModeUnlocked,true);
});

test('解放後はPhase 3の無料スキル検証を通り、未解放ではLOCKED',async()=>{
  const {validateSkillSelectionForMatch}=await skillModule,f=await fixture();
  assert.equal(validateSkillSelectionForMatch({role:'cat',skillId:'CAT_STEALTH',entitlements:f.profile.skillEntitlements}).error,'SKILL_MODE_LOCKED');
  for(let i=1;i<=3;i++)await complete(f,`reward_online_${i}`);
  assert.equal(validateSkillSelectionForMatch({role:'cat',skillId:'CAT_STEALTH',entitlements:f.profile.skillEntitlements}).ok,true);
});

test('プロフィールAPIは検証関数なし・自己申告を拒否し、検証済み完了だけ保存',async()=>{
  const {profileRequest}=await profileModule,storage=new Store(),token='ab'.repeat(32),headers={Authorization:`Bearer ${token}`};
  const req=(path,body)=>new Request(`https://players${path}`,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});
  await profileRequest(storage,req('/register',{skillEntitlements:{skillModeUnlocked:true,skillModeUnlockAdViews:3}}));
  let response=await profileRequest(storage,req('/rewarded-ad-completion',{rewardType,verificationId:'reward_api_1',verification:{mock:true}}));
  assert.equal(response.status,503);
  response=await profileRequest(storage,req('/rewarded-ad-completion',{rewardType,verificationId:'reward_api_1',verification:{mock:true}}),{verifyRewardedAd:async()=>true});
  assert.equal(response.status,200);assert.equal((await response.json()).profile.skillEntitlements.skillModeUnlockAdViews,1);
  const profile=(await (await profileRequest(storage,req('/profile'))).json()).profile;
  assert.equal(profile.skillEntitlements.skillModeUnlocked,false);
  assert.equal(profile.skillEntitlements.skillModeUnlockAdViews,1);
});

test('認証済みプロフィールだけが短時間の広告attemptを作成できる',async()=>{
  const {profileRequest}=await profileModule,storage=new Store(),token='cd'.repeat(32),headers={Authorization:`Bearer ${token}`};
  const request=(auth=true)=>new Request('https://players/rewarded-ad-attempt',{method:'POST',headers:auth?headers:{},body:JSON.stringify({rewardType})});
  assert.equal((await profileRequest(storage,request(false))).status,401);
  await profileRequest(storage,new Request('https://players/register',{method:'POST',headers,body:JSON.stringify({})}));
  const response=await profileRequest(storage,request());assert.equal(response.status,200);
  const value=await response.json();assert.match(value.attemptId,/^ra_[0-9a-f-]+$/);assert.equal(value.rewardType,rewardType);
});
