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
test('プロフィールフレームは共通定義だけを許可し、不正・未設定はBronze',()=>{
  for(const id of Object.keys(UI.frames))assert.equal(UI.frameId(id),id);
  for(const id of [null,undefined,'rank_unknown','gold','default'])assert.equal(UI.frameId(id),'rank_bronze');
  const element={dataset:{}};UI.setFrame(element,'rank_gold');assert.equal(element.dataset.frameId,'rank_gold');
  UI.setFrame(element,'bad');assert.equal(element.dataset.frameId,'rank_bronze');
});
test('正式6ランクはカタログPNGを解決しdefaultと未知IDはCSS fallback',()=>{
  for(const id of ['rank_bronze','rank_silver','rank_gold','rank_platinum','rank_diamond','rank_master']){
    assert.equal(UI.frameSource(id),Catalog.getItem('profileFrame',id).frameImage);
  }
  assert.equal(UI.frameSource('default'),Catalog.getItem('profileFrame','rank_bronze').frameImage);
  assert.equal(UI.frameSource('forged'),Catalog.getItem('profileFrame','rank_bronze').frameImage);
});
test('相手表示はplayerId照合、viewer所持状態に非依存、旧試合は明示クリア',()=>{
  const peer={playerId:'b',profileCharacter:{category:'dogSkin',itemId:'dog_detective'},equippedProfileFrameId:'rank_gold'};
  const own={playerId:'a',profileCharacter:{category:'catSkin',itemId:'cat_kaitou'},equippedProfileFrameId:'rank_bronze'};
  const data={matchType:'randomMatch',matchId:'rm_test',player:'host',playerId:'a',participants:{host:'a',guest:'b'},profile:own,playerProfiles:{host:own,guest:peer}};
  assert.deepEqual(UI.opponentProfile(data),peer);
  assert.deepEqual(UI.ownProfile(data),own);
  assert.equal(UI.opponentProfile({...data,playerId:'b'}),null);
  assert.equal(UI.ownProfile({...data,playerId:'b'}),null);
  assert.equal(UI.opponentProfile({...data,participants:{host:'a',guest:'c'}}),null);
  assert.equal(UI.opponentProfile(null),null);
  assert.equal(UI.ownProfile(null),null);
  assert.deepEqual(UI.opponentProfile({...data,matchType:'roomMatch'}),peer);
  assert.deepEqual(UI.ownProfile({...data,matchType:'roomMatch'}),own);
});

test('match found後はselfだけ表示用overrideを適用しopponentはserver profileを維持',()=>{
  const self={playerId:'self',profileCharacter:{category:'catSkin',itemId:'default'},equippedProfileFrameId:'rank_bronze',
    ranked:{rank:'silver'},displayName:'自分'};
  const opponent={playerId:'peer',profileCharacter:{category:'dogSkin',itemId:'dog_coin_01'},
    equippedProfileFrameId:'rank_gold',ranked:{rank:'gold'},displayName:'相手'};
  const data={matchType:'randomMatch',matchId:'rm_profile',player:'host',playerId:'self',
    participants:{host:'self',guest:'peer'},profile:self,playerProfiles:{host:self,guest:opponent}};
  const profiles=UI.matchProfiles(data,profile=>({...profile,
    profileCharacter:{category:'catSkin',itemId:'cat_master_s01_king'},equippedProfileFrameId:'rank_master'}));
  assert.equal(UI.imageSource(profiles.own.profileCharacter),Catalog.getItem('catSkin','cat_master_s01_king').profileImage);
  assert.equal(profiles.own.equippedProfileFrameId,'rank_master');
  assert.equal(UI.imageSource(profiles.opponent.profileCharacter),Catalog.getItem('dogSkin','dog_coin_01').profileImage);
  assert.equal(profiles.opponent.equippedProfileFrameId,'rank_gold');
  assert.equal(profiles.opponent,opponent);
});
test('自分のローカル表示補正は相手のserver-verified状態へ漏れない',async()=>{
  const {initialProfile,publicPlayerProfiles}=await import('../server/online-profile.mjs');
  const serverSelf=initialProfile({},'iphone');
  const web=initialProfile({ownedCatSkins:['cat_kaitou'],profileCharacter:{category:'catSkin',itemId:'cat_kaitou'}},'web');
  const verified=publicPlayerProfiles({host:serverSelf,guest:web});
  const webView={matchType:'randomMatch',matchId:'m1',player:'guest',playerId:'web',
    participants:{host:'iphone',guest:'web'},playerProfiles:verified,profile:verified.guest};
  const shown=UI.matchProfiles(webView,own=>({...own,profileCharacter:{category:'catSkin',itemId:'cat_master_s01_king'}}));
  assert.equal(shown.own.profileCharacter.itemId,'cat_master_s01_king');
  assert.equal(shown.opponent.profileCharacter.itemId,'default');
  assert.equal(shown.opponent.equippedProfileFrameId,'rank_bronze');
  assert.deepEqual(shown.opponent.ranked,{rank:'bronze'});
  assert.equal(UI.opponentProfile({...webView,matchId:'m2'}).profileCharacter.itemId,'default');
});
test('フレーム選択UIからフレームなしを削除しBronzeを保証する',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const ranked=fs.readFileSync(path.resolve(__dirname,'../ranked-ui.js'),'utf8');
  assert.doesNotMatch(ranked,/フレームなし|\['default',\.\.\.owned\]/);
  assert.match(ranked,/new Set\(\['rank_bronze',/);
});

test('待機プロフィールは自分・VS・相手を共通frame DOMで表示する',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const source=fs.readFileSync(path.resolve(__dirname,'../online-profile-ui.js'),'utf8');
  const css=fs.readFileSync(path.resolve(__dirname,'../style.css'),'utf8');
  assert.match(source,/profileSide\('self','あなた'\)/);
  assert.match(source,/profileSide\('opponent','対戦相手'\)/);
  assert.match(source,/className='online-profile-vs'/);
  assert.match(source,/className='online-profile-rank'/);
  assert.match(source,/className='ranked-frame ranked-frame-preview online-profile-frame'/);
  assert.match(css,/\.online-opponent-profile \.online-profile-frame\{[^}]*clamp\(88px,24vw,96px\)/);
  assert.match(css,/\.online-opponent-profile \.online-profile-frame:not\(\.has-frame-image\) \.ranked-avatar-clip\{[^}]*clamp\(62px,17vw,68px\)/);
  assert.match(css,/\.online-profile-name\{[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/);
});

test('オンライン入口は既存の共有identity経路を使い、表示後もmatch listenerを維持する',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const ranked=fs.readFileSync(path.resolve(__dirname,'../ranked-ui.js'),'utf8');
  const match=fs.readFileSync(path.resolve(__dirname,'../random-match.js'),'utf8');
  assert.match(ranked,/await root\.NyanOnline\.prepareIdentity\(\)/);
  assert.doesNotMatch(ranked,/NyanOnlineIdentity\?\.prepare/);
  assert.match(ranked,/if\(selectionVisible&&!profile\?\.ranked\)update\(fallbackProfile\(\)\)/);
  assert.match(match,/start\.onclick = async \(\) =>/);
  assert.match(match,/root\.dispatchEvent\(new CustomEvent\('nyan-online-selection-opened'\)\)/);
  assert.match(match,/root\.NyanRankedUI\?\.refresh\(\)/);
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
  assert.deepEqual(message.playerProfiles.guest.ranked,{rank:'bronze'});
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
  assert.deepEqual(Object.keys(publicData).sort(),['equippedProfileFrameId','playerId','profileCharacter','ranked']);
  profile.ownedProfileFrames.push('rank_gold');profile.equippedProfileFrameId='rank_gold';
  assert.equal(publicPlayerProfiles({host:profile}).host.equippedProfileFrameId,'rank_gold');
  profile.ownedProfileFrames.push('rank_unknown');profile.equippedProfileFrameId='rank_unknown';
  assert.equal(publicPlayerProfiles({host:profile}).host.equippedProfileFrameId,'rank_bronze');
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

test('王様ネコはクライアント自己申告を拒否し、サーバー付与後だけprofileとappearanceを許可する',async()=>{
  const {initialProfile,validateAppearance,validateProfileCharacter,appearanceSnapshot}=await import('../server/online-profile.mjs');
  const forged=initialProfile({ownedCatSkins:['cat_master_s01_king'],equippedAppearance:{catSkinId:'cat_master_s01_king'},
    profileCharacter:{category:'catSkin',itemId:'cat_master_s01_king'}},'forged');
  assert.deepEqual(forged.ownedCatSkins,['default']);
  assert.equal(forged.equippedAppearance.catSkinId,'default');
  assert.equal(forged.profileCharacter.itemId,'default');
  const granted={...forged,ownedCatSkins:['default','cat_master_s01_king']};
  granted.equippedAppearance=validateAppearance(granted,{catSkinId:'cat_master_s01_king'});
  granted.profileCharacter=validateProfileCharacter(granted,{category:'catSkin',itemId:'cat_master_s01_king'});
  assert.equal(granted.equippedAppearance.catSkinId,'cat_master_s01_king');
  assert.equal(granted.profileCharacter.itemId,'cat_master_s01_king');
  assert.equal(appearanceSnapshot(granted,initialProfile({},'dog')).catPlayer.catSkinId,'cat_master_s01_king');
  assert.equal(UI.imageSource(granted.profileCharacter),Catalog.getItem('catSkin','cat_master_s01_king').profileImage);
});
