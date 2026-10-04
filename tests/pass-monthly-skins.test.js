const test=require('node:test');
const assert=require('node:assert/strict');

const monthly=import('../server/pass-monthly-skins.mjs');
const online=import('../server/online-profile.mjs');
const at=value=>Date.parse(value);
const pass=(startsAt,expiresAt,id='period-1')=>({store:'app_store',period:{id,startsAt,expiresAt},
  verifiedAt:startsAt,autoRenewing:true});
const fixtureCatalog=Object.freeze({
  cat_master_s01_king:Object.freeze({category:'catSkin',passMonthlyReward:true}),
  dog_detective:Object.freeze({category:'dogSkin',passMonthlyReward:true})
});
const knownSkins={ownedCatSkins:['default','cat_master_s01_king'],ownedDogSkins:['default','dog_detective']};
const options={catalog:fixtureCatalog,knownSkins};

class Store{
  values=new Map();pending=Promise.resolve();
  async get(key){return structuredClone(this.values.get(key));}
  async put(key,value){this.values.set(key,structuredClone(value));}
  transaction(fn){const task=this.pending.then(()=>fn(this));this.pending=task.catch(()=>{});return task;}
}

test('JSTの1/31加入→2/1ログインで各月1Skinを永久付与し再送は冪等',async()=>{
  const {applyCurrentPassMonthlySkinReward:apply}=await monthly;
  const {initialProfile,validateAppearance,validateProfileCharacter}=await online;
  const jan=at('2027-01-31T23:30:00+09:00'),feb=at('2027-02-01T00:30:00+09:00');
  const storage=new Store(),profileKey='profile:jan',profile=initialProfile({},'P',jan);
  profile.passSubscription=pass(jan-1000,at('2027-03-05T00:00:00+09:00'));
  await storage.put(profileKey,profile);
  const periods={'2027-01':'cat_master_s01_king','2027-02':'dog_detective'};
  const joined=await apply({storage,profileKey,now:jan,periods,...options});
  assert.deepEqual([joined.granted,joined.monthKey,joined.skinId],[true,'2027-01','cat_master_s01_king']);
  const login=await apply({storage,profileKey,now:feb,periods,...options});
  assert.deepEqual([login.granted,login.monthKey,login.skinId],[true,'2027-02','dog_detective']);
  const retry=await apply({storage,profileKey,now:feb,periods,...options});
  assert.equal(retry.granted,false);assert.equal(retry.reason,'already_claimed');
  const saved=await storage.get(profileKey);
  assert.deepEqual(saved.passSkinRewardsClaimed.map(record=>record.monthKey),['2027-01','2027-02']);
  assert.ok(saved.ownedCatSkins.includes('cat_master_s01_king'));
  assert.ok(saved.ownedDogSkins.includes('dog_detective'));
  const expired={...saved,passSubscription:pass(jan-1000,feb)};
  assert.equal(validateAppearance(expired,{catSkinId:'cat_master_s01_king'}).catSkinId,'cat_master_s01_king');
  assert.deepEqual(validateProfileCharacter(expired,{category:'catSkin',itemId:'cat_master_s01_king'}),
    {category:'catSkin',itemId:'cat_master_s01_king'});
});

test('inactive・mappingなし・invalid catalog・既所有は無付与で状態不変',async()=>{
  const {grantCurrentPassMonthlySkinIfEligible:grant,passSkinPeriods}=await monthly;
  const {initialProfile}=await online;
  const now=at('2027-01-10T12:00:00+09:00'),base=initialProfile({},'P',now);
  const periods={'2027-01':'cat_master_s01_king'};
  assert.equal(grant(base,{now,periods,...options}).reason,'inactive');
  const active={...base,passSubscription:pass(now-1000,now+100000)};
  assert.equal(grant(active,{now,...options}).reason,'unconfigured');
  assert.equal(grant(active,{now,periods,catalog:{},knownSkins}).reason,'invalid_skin');
  assert.equal(grant(active,{now,periods,catalog:{cat_master_s01_king:{category:'catSkin'}},knownSkins}).reason,'invalid_skin');
  assert.equal(grant(active,{now,periods,catalog:fixtureCatalog,knownSkins:{ownedCatSkins:['default']}}).reason,'invalid_skin');
  assert.equal(grant({...active,ownedCatSkins:['default','cat_master_s01_king']},{now,periods,...options}).reason,'already_owned');
  assert.equal(active.ownedCatSkins.includes('cat_master_s01_king'),false);
  assert.deepEqual(passSkinPeriods('{bad-json'),{});
  assert.deepEqual(passSkinPeriods({'2027-13':'cat_master_s01_king','2027-01':'cat_master_s01_king'}),periods);
});

test('再加入は現在月だけを付与し、同月再加入は二重付与しない',async()=>{
  const {grantCurrentPassMonthlySkinIfEligible:grant}=await monthly;
  const {initialProfile}=await online;
  const october=at('2026-10-01T12:00:00+09:00'),april=at('2027-04-01T12:00:00+09:00');
  const periods={'2026-10':'cat_master_s01_king','2026-11':'dog_detective',
    '2027-04':'dog_detective'};
  let profile={...initialProfile({},'P',october),passSubscription:pass(october-1000,october+1000)};
  const first=grant(profile,{now:october,periods,...options});assert.equal(first.granted,true);
  profile={...first.profile,passSubscription:pass(october+2000,october+5000,'period-rejoin')};
  const same=grant(profile,{now:october+3000,periods,...options});
  assert.equal(same.granted,false);assert.equal(same.reason,'already_claimed');
  profile={...same.profile,passSubscription:pass(april-1000,april+1000,'period-april')};
  const rejoined=grant(profile,{now:april,periods,...options});
  assert.equal(rejoined.granted,true);assert.equal(rejoined.monthKey,'2027-04');
  assert.deepEqual(rejoined.profile.passSkinRewardsClaimed.map(record=>record.monthKey),['2026-10','2027-04']);
  assert.equal(rejoined.profile.passSkinRewardsClaimed.some(record=>record.monthKey==='2026-11'),false);
});

test('同時Login再送もatomic transactionで同月1回だけ',async()=>{
  const {applyCurrentPassMonthlySkinReward:apply}=await monthly;
  const {initialProfile}=await online;
  const now=at('2027-01-15T10:00:00+09:00'),storage=new Store(),profileKey='profile:race';
  await storage.put(profileKey,{...initialProfile({},'P',now),passSubscription:pass(now-1000,now+100000)});
  const input={storage,profileKey,now,periods:{'2027-01':'cat_master_s01_king'},...options};
  const results=await Promise.all([apply(input),apply(input),apply(input)]);
  assert.equal(results.filter(result=>result.granted).length,1);
  const saved=await storage.get(profileKey);
  assert.equal(saved.passSkinRewardsClaimed.length,1);
  assert.equal(saved.ownedCatSkins.filter(id=>id==='cat_master_s01_king').length,1);
});

test('登録自己申告を無視し、再登録・認証済みprofile GETを共通Skin helperのtriggerにする',async()=>{
  const {profileRequest,digestToken}=await online;
  const jan=at('2027-01-31T23:30:00+09:00'),feb=at('2027-02-01T00:30:00+09:00');
  const token='ab'.repeat(32),profileKey=`profile:${await digestToken(token)}`,storage=new Store();
  const headers={Authorization:`Bearer ${token}`};
  const request=(path,body)=>new Request(`https://players${path}`,{method:body?'POST':'GET',headers,
    body:body?JSON.stringify(body):undefined});
  const config={passSkinPeriods:{'2027-01':'cat_master_s01_king','2027-02':'dog_detective'},
    passSkinCatalog:fixtureCatalog,passSkinKnownSkins:knownSkins};
  const forged={passActive:true,rewardMonth:'2027-01',skinId:'cat_master_s01_king',
    ownedCatSkins:['cat_master_s01_king'],passSkinRewardsClaimed:[{monthKey:'2027-01',skinId:'cat_master_s01_king',claimedAt:1}]};
  const created=await (await profileRequest(storage,request('/register',forged),{...config,now:jan})).json();
  assert.equal(created.profile.ownedCatSkins.includes('cat_master_s01_king'),false);
  assert.deepEqual(created.profile.passSkinRewardsClaimed,[]);
  let verified=await storage.get(profileKey);
  verified.passSubscription=pass(jan-1000,at('2027-03-05T00:00:00+09:00'));
  await storage.put(profileKey,verified); // Internal mock verified subscription writer, never an HTTP payload.
  const joined=await (await profileRequest(storage,request('/register',forged),{...config,now:jan})).json();
  assert.equal(joined.passSkinReward.monthKey,'2027-01');
  const login=await (await profileRequest(storage,request('/profile'),{...config,now:feb})).json();
  assert.equal(login.passSkinReward.monthKey,'2027-02');
  assert.deepEqual(login.profile.passSkinRewardsClaimed.map(record=>record.monthKey),['2027-01','2027-02']);
  const again=await (await profileRequest(storage,request('/profile'),{...config,now:feb})).json();
  assert.equal(again.passSkinReward,undefined);
});

test('旧profileのhistory欠損・不正記録を正規化し、有効な月は保持',async()=>{
  const {normalizePassSkinRewardsClaimed:normalize}=await monthly;
  const {initialProfile,profileRequest,digestToken}=await online;
  assert.deepEqual(normalize(undefined),[]);
  assert.deepEqual(normalize([{monthKey:'2027-01',skinId:'cat_master_s01_king',claimedAt:10},
    {monthKey:'2027-01',skinId:'cat_master_s01_king',claimedAt:11},
    {monthKey:'2027-13',skinId:'bad',claimedAt:12},null]),
  [{monthKey:'2027-01',skinId:'cat_master_s01_king',claimedAt:10,source:'passMonthlyReward'}]);
  const token='cd'.repeat(32),storage=new Store(),profileKey=`profile:${await digestToken(token)}`;
  const old=initialProfile({},'old',1000);delete old.passSkinRewardsClaimed;
  await storage.put(profileKey,old);
  const response=await profileRequest(storage,new Request('https://players/profile',
    {headers:{Authorization:`Bearer ${token}`}}),{now:1000});
  assert.deepEqual((await response.json()).profile.passSkinRewardsClaimed,[]);
});
