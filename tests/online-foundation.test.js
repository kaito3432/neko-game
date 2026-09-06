const test=require('node:test');
const assert=require('node:assert/strict');
const Player=require('../player-data.js');
const Skins=require('../skin-presentation.js');
class Store {
  values=new Map();
  async get(key){return structuredClone(this.values.get(key));}
  async put(key,value){for(const [k,v] of typeof key==='string'?[[key,value]]:Object.entries(key)) this.values.set(k,structuredClone(v));}
}
const modules=Promise.all([import('../server/online-profile.mjs'),import('../server/matchmaking.mjs')]);
const token='ab'.repeat(32);
function request(path,body,credential=token){return new Request(`https://players${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${credential}`},body:body===undefined?undefined:JSON.stringify(body)});}
test('匿名登録は再送可能でplayerIdだけでは認証できない',async()=>{
  const [{profileRequest}]=await modules; const storage=new Store();
  const first=await (await profileRequest(storage,request('/register',{playerId:'local-id'}))).json();
  const second=await (await profileRequest(storage,request('/register',{ownedCatSkins:['cat_kaitou']}))).json();
  assert.equal(first.profile.playerId,second.profile.playerId);
  assert.deepEqual(second.profile.ownedCatSkins,['default']);
  assert.equal((await profileRequest(storage,request('/profile',undefined,'local-id'))).status,401);
  assert.equal((await profileRequest(storage,request('/profile',undefined,'cd'.repeat(32)))).status,401);
});
test('初回移行だけ所持を取り込み、不明IDは除外、装備更新では所持追加不可',async()=>{
  const [{profileRequest}]=await modules;const storage=new Store();
  await profileRequest(storage,request('/register',{ownedCatSkins:['cat_kaitou','fake'],equippedAppearance:{catSkinId:'cat_kaitou'}}));
  const {profile}=await (await profileRequest(storage,request('/appearance',{ownedDogSkins:['dog_detective'],equippedAppearance:{catSkinId:'cat_kaitou',dogSkinId:'dog_detective'}}))).json();
  assert.deepEqual(profile.ownedCatSkins,['default','cat_kaitou']);
  assert.equal(profile.equippedAppearance.catSkinId,'cat_kaitou');
  assert.equal(profile.equippedAppearance.dogSkinId,'default');
});
test('snapshotはコピーで固定しカテゴリ違いと不正IDはdefault',async()=>{
  const [{initialProfile,appearanceSnapshot,validateAppearance}]=await modules;
  const a=initialProfile({ownedCatSkins:['cat_kaitou'],equippedAppearance:{catSkinId:'cat_kaitou'}},'a');
  const b=initialProfile({ownedDogSkins:['dog_detective'],equippedAppearance:{dogSkinId:'dog_detective'}},'b');
  const snap=appearanceSnapshot(a,b);a.equippedAppearance.catSkinId='default';
  assert.equal(snap.catPlayer.catSkinId,'cat_kaitou');assert.equal(snap.policePlayer.dogSkinId,'dog_detective');
  assert.deepEqual(validateAppearance(a,{catSkinId:'dog_detective',dogSkinId:'unknown'}),{catSkinId:'default',dogSkinId:'default'});
});
test('先着2人を1試合に、自己重複・成立後キャンセル・再参加を防止',async()=>{
  const [{initialProfile},{matchmaking}]=await modules;const storage=new Store();
  const a=initialProfile({},'a'),b=initialProfile({},'b');
  assert.equal((await matchmaking(storage,null,a,'join')).status,'waiting');
  assert.equal((await matchmaking(storage,null,a,'join')).status,'waiting');
  const second=await matchmaking(storage,null,b,'join');const first=await matchmaking(storage,null,a,'status');
  assert.equal(first.matchId,second.matchId);assert.notEqual(first.role,second.role);
  assert.match(first.matchId,/^rm_/);
  assert.equal((await matchmaking(storage,null,a,'cancel')).matchId,first.matchId);
  assert.equal((await matchmaking(storage,null,a,'join')).matchId,first.matchId);
});
test('キャンセル済み・期限切れ待機はペアから除外',async()=>{
  const [{initialProfile},{matchmaking}]=await modules;const storage=new Store();
  const a=initialProfile({},'a'),b=initialProfile({},'b'),c=initialProfile({},'c');
  await matchmaking(storage,null,a,'join',1);await matchmaking(storage,null,a,'cancel',2);
  assert.equal((await matchmaking(storage,null,b,'join',3)).status,'waiting');
  assert.equal((await matchmaking(storage,null,c,'join',120004)).status,'waiting');
});
test('終了済みのmatchは再利用せず次の待機へ',async()=>{
  const [{initialProfile},{matchmaking}]=await modules;const storage=new Store();const a=initialProfile({},'a'),b=initialProfile({},'b');
  await matchmaking(storage,null,a,'join');const found=await matchmaking(storage,null,b,'join');
  const match=await storage.get(`match:${found.matchId}`);match.status='finished';await storage.put(`match:${found.matchId}`,match);
  assert.equal((await matchmaking(storage,null,a,'join')).status,'waiting');
});
test('相手スキンは閲覧者の所持に関係なくサーバーsnapshotで解決',()=>{
  global.NyanOnline={resolveAppearance:category=>({id:category==='catSkin'?'cat_kaitou':'dog_detective',status:'ready'})};
  try {
    const data=Player.createDefaultData();
    assert.equal(Skins.resolveCatPiece(data,{playMode:'onlinePolice'}).itemId,'cat_kaitou');
    assert.equal(Skins.resolveDogPiece(data,0,{playMode:'onlineCat'}).itemId,'dog_detective');
    assert.ok(Skins.effectSource(data,'catSkin','move',{playMode:'onlineCat'}));
    assert.ok(Skins.effectSource(data,'dogSkin','found',{playMode:'onlineCat'}));
  } finally {delete global.NyanOnline;}
});
test('randomMatchはサーバー結果を正として一回加算し、CPU開放やコインは増やさない',async()=>{
  const memory=new Map();const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
  const now=Date.now();const result={battleId:'rm_test_verified',source:'randomMatch',side:'police',won:true,completed:true,completedAt:now};
  global.NyanOnline={verifyResult:async()=>result};
  try{
    const store=Player.createStore({storage,now:()=>now});await store.load();
    await store.recordDailyMissionBattle({...result,side:'cat',difficulty:'hard'});
    const data=await store.recordDailyMissionBattle(result);
    assert.equal(data.dailyMissionProgress.missions.find(m=>m.id==='winAsPolice').progress,1);
    assert.equal(data.dailyMissionProgress.missions.find(m=>m.id==='winAsCat').progress,0);
    assert.equal(data.nyanCoins,0);assert.equal(data.skinUnlockProgress.dog_detective,0);
  } finally {delete global.NyanOnline;}
});
test('将来の開放境界は検証サービス無し・検証失敗を拒否する',async()=>{
  const [{initialProfile,applyVerifiedUnlock}]=await modules;const profile=initialProfile({},'player');
  await assert.rejects(applyVerifiedUnlock(profile,'catSkin','cat_kaitou',{}),/unlock_not_verified/);
  await assert.rejects(applyVerifiedUnlock(profile,'catSkin','cat_kaitou',{},async()=>false),/unlock_not_verified/);
  const granted=await applyVerifiedUnlock(profile,'catSkin','cat_kaitou',{},async()=>true);
  assert.deepEqual(granted.ownedCatSkins,['default','cat_kaitou']);assert.deepEqual(profile.ownedCatSkins,['default']);
});
test('random通常戦検証は役割偽装・ターン飛ばし・同じ犬の二重操作を拒否',async()=>{
  const {acceptRandomAction:accept}=await import('../server/random-game-validation.mjs');const room={};
  assert.equal(accept(room,'cat',{type:'dogSetup',dogs:[14,15,21]}),false);
  assert.equal(accept(room,'police',{type:'dogSetup',dogs:[14,15,21]}),true);
  assert.equal(accept(room,'cat',{type:'catSetup',catPos:12}),true);
  assert.equal(accept(room,'cat',{type:'catEscaped',turn:11}),false);
  assert.equal(accept(room,'cat',{type:'catMove',turn:11,catPos:13}),false);
  assert.equal(accept(room,'police',{type:'dogMove',dogIndex:0,node:8}),true);
  assert.equal(accept(room,'police',{type:'dogMove',dogIndex:0,node:7}),false);
  assert.equal(accept(room,'police',{type:'dogTurnEnd',turn:1}),false);
});
