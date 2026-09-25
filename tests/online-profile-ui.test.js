const test=require('node:test');
const assert=require('node:assert/strict');
const UI=require('../online-profile-ui.js');
const Catalog=require('../collection-catalog.js');
test('プロフィール画像は設定だけから解決し、未設定・未知IDはデフォルト猫',()=>{
  const fallback=Catalog.getItem('catSkin','default').profileImage;
  for(const value of [null,{}, {category:'dogSkin',itemId:'unknown'}, {category:'paw',itemId:'default'}])
    assert.equal(UI.imageSource(value),fallback);
  for(const [category,itemId] of [['catSkin','cat_kaitou'],['dogSkin','dog_detective'],['catSkin','cat_coin_01'],['dogSkin','dog_coin_01']])
    assert.equal(UI.imageSource({category,itemId}),Catalog.getItem(category,itemId).profileImage);
  const image={};UI.setImage(image,{category:'dogSkin',itemId:'dog_detective'});image.onerror();
  assert.equal(image.src,fallback);assert.equal(image.onerror,null);
});
test('プロフィールフレームは共通定義だけを許可し、不正・未設定はdefault',()=>{
  for(const id of Object.keys(UI.frames))assert.equal(UI.frameId(id),id);
  for(const id of [null,undefined,'rank_unknown','gold'])assert.equal(UI.frameId(id),'default');
  const element={dataset:{}};UI.setFrame(element,'rank_gold');assert.equal(element.dataset.frameId,'rank_gold');
  UI.setFrame(element,'bad');assert.equal(element.dataset.frameId,'default');
});
test('相手表示はplayerId照合、viewer所持状態に非依存、旧試合は明示クリア',()=>{
  const peer={playerId:'b',profileCharacter:{category:'dogSkin',itemId:'dog_detective'},equippedProfileFrameId:'rank_gold'};
  const data={matchType:'randomMatch',matchId:'rm_test',player:'host',playerId:'a',participants:{host:'a',guest:'b'},playerProfiles:{guest:peer}};
  assert.deepEqual(UI.opponentProfile(data),peer);
  assert.equal(UI.opponentProfile({...data,playerId:'b'}),null);
  assert.equal(UI.opponentProfile({...data,participants:{host:'a',guest:'c'}}),null);
  assert.equal(UI.opponentProfile(null),null);
});
test('復帰データは検証済みプロフィールを再配信し、相手の非公開データは含めない',async()=>{
  const {publicRecovery}=await import('../server/reconnection.mjs');
  const {initialProfile}=await import('../server/online-profile.mjs');
  const room={matchId:'rm_recovery',matchType:'randomMatch',roles:{host:'police',guest:'cat'},profiles:{
    host:initialProfile({},'viewer'),guest:initialProfile({ownedCatSkins:['cat_kaitou'],
      profileCharacter:{category:'catSkin',itemId:'cat_kaitou'}},'peer')}};
  const message=publicRecovery(room,'host');
  assert.equal(UI.opponentProfile(message).profileCharacter.itemId,'cat_kaitou');
  assert.equal(message.playerProfiles.guest.ownedCatSkins,undefined);
  assert.equal(message.playerProfiles.guest.ranked,undefined);
  assert.equal('catPos' in message.state,false);
});
test('サーバーは所有者だけを検証し、認証更新・旧クライアント互換・公開情報制限',async()=>{
  const {profileRequest,publicPlayerProfiles}=await import('../server/online-profile.mjs');
  const values=new Map();const storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v))};
  const call=async(path,body,token='ab'.repeat(32))=>profileRequest(storage,new Request('https://test/'+path,{
    method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token},body:body===undefined?undefined:JSON.stringify(body)}));
  const result=async(path,body)=>(await (await call(path,body)).json()).profile;
  let profile=await result('register',{ownedCatSkins:['cat_kaitou'],ownedDogSkins:['dog_detective']});
  assert.deepEqual(profile.profileCharacter,{category:'catSkin',itemId:'default'});
  for(const [category,itemId] of [['catSkin','cat_kaitou'],['dogSkin','dog_detective']]){
    profile=await result('appearance',{profileCharacter:{category,itemId}});
    assert.deepEqual(profile.profileCharacter,{category,itemId});
    assert.deepEqual((await result('profile')).profileCharacter,{category,itemId});
  }
  assert.deepEqual((await result('appearance',{})).profileCharacter,profile.profileCharacter);
  assert.equal((await call('appearance',{profileCharacter:null},'cd'.repeat(32))).status,401);
  for(const selection of [{category:'dogSkin',itemId:'cat_kaitou'}, {category:'catSkin',itemId:'bad'},null]){
    profile=await result('appearance',{profileCharacter:selection});
    assert.equal(profile.profileCharacter.itemId,'default');
  }
  const publicData=publicPlayerProfiles({host:profile}).host;
  assert.deepEqual(Object.keys(publicData).sort(),['equippedProfileFrameId','playerId','profileCharacter']);
  profile.ownedProfileFrames.push('rank_gold');profile.equippedProfileFrameId='rank_gold';
  assert.equal(publicPlayerProfiles({host:profile}).host.equippedProfileFrameId,'rank_gold');
  profile.ownedProfileFrames.push('rank_unknown');profile.equippedProfileFrameId='rank_unknown';
  assert.equal(publicPlayerProfiles({host:profile}).host.equippedProfileFrameId,'default');
  const token='ef'.repeat(32);await call('register',{},token);
  const unowned=await (await call('appearance',{profileCharacter:{category:'dogSkin',itemId:'dog_detective'}},token)).json();
  assert.equal(unowned.profile.profileCharacter.itemId,'default');
});

test('コイン購入スキンは固定allowlistだけ同期しプロフィール画像を相手へ公開する',async()=>{
  const {profileRequest,publicPlayerProfiles}=await import('../server/online-profile.mjs');
  const values=new Map(),storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v))};
  const headers={Authorization:'Bearer '+('ac'.repeat(32))};
  const call=(path,body)=>profileRequest(storage,new Request('https://test/'+path,{method:'POST',headers,body:JSON.stringify(body)}));
  await call('register',{});
  const response=await call('appearance',{collectionOwnership:{ownedCatSkins:['cat_coin_01','forged'],ownedDogSkins:['dog_coin_01','dog_detective']},
    equippedAppearance:{catSkinId:'cat_coin_01',dogSkinId:'dog_coin_01'},profileCharacter:{category:'dogSkin',itemId:'dog_coin_01'}});
  const {profile}=await response.json();
  assert.deepEqual(profile.ownedCatSkins,['default','cat_coin_01']);
  assert.deepEqual(profile.ownedDogSkins,['default','dog_coin_01']);
  assert.deepEqual(profile.equippedAppearance,{catSkinId:'cat_coin_01',dogSkinId:'dog_coin_01'});
  assert.deepEqual(publicPlayerProfiles({guest:profile}).guest.profileCharacter,{category:'dogSkin',itemId:'dog_coin_01'});
  assert.equal(UI.imageSource({category:'dogSkin',itemId:'dog_coin_01'}),Catalog.getItem('dogSkin','dog_coin_01').profileImage);
});
