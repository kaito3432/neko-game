const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Catalog=require('../collection-catalog.js');

test('KING Debugは全スキンと2000コインだけを仮付与しHome選択はOFF/ONを保持する',async()=>{
  const base={playerId:'ncp_debug0000000001',nyanCoins:0,ownedCatSkins:['default'],ownedDogSkins:['default'],
    equippedAppearance:{catSkinId:'default',dogSkinId:'default'},favoriteCharacter:null,profileCharacter:null};
  const Player={ready:Promise.resolve(base),load:async()=>base,getSnapshot:()=>base,save:async value=>value,
    updateEquipment:async()=>base,updateFavoriteCharacter:async()=>base,updateProfileCharacter:async()=>base};
  const context={NYAN_KING_QA_BUILD:13,navigator:{userAgent:'irrelevant'},NyanCollectionCatalog:Catalog,NyanPlayerData:Player,
    Set,Object,Promise,globalThis:null};context.globalThis=context;
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../debug/king-skin-play-qa-bootstrap-v5.js'),'utf8'),context);
  const qa=context.NyanPlayerData;
  assert.equal(qa.getSnapshot().nyanCoins,2000);
  const ready=item=>item.id==='default'||(item.materialStatus!=='pending'&&item.assetStatus!=='placeholder'&&Boolean(item.profileImage)&&Boolean(item.pieceImage));
  assert.deepEqual([...qa.getSnapshot().ownedCatSkins],Catalog.getItemsByCategory('catSkin').filter(ready).map(item=>item.id));
  assert.deepEqual([...qa.getSnapshot().ownedDogSkins],Catalog.getItemsByCategory('dogSkin').filter(ready).map(item=>item.id));
  assert.deepEqual([...qa.getSnapshot().ownedProfileFrames],Catalog.getItemsByCategory('profileFrame')
    .filter(item=>item.materialStatus!=='pending'&&item.assetStatus!=='placeholder'&&Boolean(item.frameImage)).map(item=>item.id));
  assert.equal(qa.getSnapshot().favoriteCharacter.itemId,'cat_master_s01_king');
  assert.deepEqual({...context.NyanKingQaSelectors.diagnostics()},{qaEnabled:true,qaCoinBalance:2000,renderedCoinBalance:2000,
    ownedCatSkinCount:4,ownedDogSkinCount:3,ownedFrameCount:6,kingOwned:true});
  const sanitized=context.__KING_SKIN_PLAY_QA__.serverSafe(qa.getSnapshot());
  assert.equal(sanitized.nyanCoins,0);assert.deepEqual(Array.from(sanitized.ownedCatSkins),['default']);
  for(let i=0;i<5;i++){
    await qa.updateFavoriteCharacter('catSkin',null);assert.equal(qa.getSnapshot().favoriteCharacter,null);
    assert.equal(qa.getSnapshot().ownedCatSkins.includes('cat_master_s01_king'),true);
    await qa.updateFavoriteCharacter('catSkin','cat_master_s01_king');assert.equal(qa.getSnapshot().favoriteCharacter.itemId,'cat_master_s01_king');
    assert.equal(qa.getSnapshot().ownedCatSkins.includes('cat_master_s01_king'),true);
  }
  for(let i=0;i<5;i++){
    await qa.updateProfileCharacter('catSkin',null);assert.equal(qa.getSnapshot().profileCharacter,null);
    assert.equal(qa.getSnapshot().ownedCatSkins.includes('cat_master_s01_king'),true);
    await qa.updateProfileCharacter('catSkin','cat_master_s01_king');assert.equal(qa.getSnapshot().profileCharacter.itemId,'cat_master_s01_king');
    assert.equal(qa.getSnapshot().ownedCatSkins.includes('cat_master_s01_king'),true);
  }
  await qa.purchaseCollectionItem('cardboard','cardboard_coin_01');assert.equal(qa.getSnapshot().nyanCoins,1970);
  assert.ok(qa.getSnapshot().ownedCardboards.includes('cardboard_coin_01'));
  assert.equal(Player.getSnapshot().nyanCoins,0);assert.deepEqual(Player.getSnapshot().ownedCardboards,undefined);
  const diagnostic=context.NyanKingQaSelectors.diagnostics();
  assert.deepEqual({...diagnostic},{qaEnabled:true,qaCoinBalance:1970,renderedCoinBalance:1970,
    ownedCatSkinCount:4,ownedDogSkinCount:3,ownedFrameCount:6,kingOwned:true});
  assert.equal(context.NyanKingQaSelectors.coinBalance({nyanCoins:999}),1970);
  const payload=context.__KING_SKIN_PLAY_QA__.serverPayload({
    equippedAppearance:{catSkinId:'cat_master_s01_king',dogSkinId:'dog_coin_01'},
    profileCharacter:{category:'catSkin',itemId:'cat_master_s01_king'},
    collectionOwnership:{ownedCatSkins:['default','cat_master_s01_king'],ownedDogSkins:['default','dog_coin_01']}});
  assert.deepEqual(Array.from(payload.collectionOwnership.ownedCatSkins),['default']);
  assert.deepEqual(Array.from(payload.collectionOwnership.ownedDogSkins),['default']);
});

test('KING QA selectorはProduction環境では導入されない',()=>{
  const original={getSnapshot:()=>({nyanCoins:5})};
  const context={NyanCollectionCatalog:Catalog,NyanPlayerData:original,Set,Object,Promise,globalThis:null};context.globalThis=context;
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../debug/king-skin-play-qa-bootstrap-v5.js'),'utf8'),context);
  assert.equal(context.NyanPlayerData,original);
  assert.equal(context.NyanKingQaSelectors,undefined);
});

test('KING QA online wrapperはAPI baseを保持し、QAプロフィールだけを表示へ合成する',async()=>{
  let receivedApi=null;
  const profile={playerId:'server-player',profileCharacter:{category:'catSkin',itemId:'default'},ownedProfileFrames:['rank_bronze'],
    equippedProfileFrameId:'default',ranked:{rank:'bronze',rp:0,seasonWins:0,seasonLosses:0}};
  const identity={prepare:async api=>{receivedApi=api;return {profile,headers:{Authorization:'Bearer server'}};},
    request:async()=>({profile})};
  const listeners=new Map();
  const context={NYAN_KING_QA_BUILD:13,document:{querySelectorAll:()=>[]},NyanOnlineIdentity:identity,
    __KING_SKIN_PLAY_QA__:{selections:{profile:{category:'catSkin',itemId:'cat_master_s01_king'}},allProfileFrames:['rank_bronze','rank_master'],
      serverPayload:value=>value,beginServerRead:()=>{},endServerRead:()=>{},baseCatalog:Catalog},
    addEventListener:(name,handler)=>listeners.set(name,handler),setTimeout,Set,Object,Promise,globalThis:null};
  context.globalThis=context;
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../debug/king-skin-play-qa-runtime-v5.js'),'utf8'),context);
  const result=await context.NyanOnlineIdentity.prepare('https://sandbox.example');
  assert.equal(receivedApi,'https://sandbox.example');
  assert.equal(result.profile.profileCharacter.itemId,'cat_master_s01_king');
  assert.deepEqual(Array.from(result.profile.ownedProfileFrames),['rank_bronze','rank_master']);
  assert.equal(result.headers.Authorization,'Bearer server');
  const equipped=await context.NyanOnlineIdentity.request('https://sandbox.example','profile-frame',{frameId:'rank_master'});
  assert.equal(equipped.profile.equippedProfileFrameId,'rank_master');
  assert.equal(context.__KING_SKIN_PLAY_QA__.selections.frame,'rank_master');
});
