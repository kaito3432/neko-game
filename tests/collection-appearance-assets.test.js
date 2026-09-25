"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Catalog=require("../collection-catalog.js");
const Collection=require("../collection.js");
const Skins=require("../skin-presentation.js");

function cosmeticCatalog(){
  const items=[
    ...Catalog.ITEMS,
    {id:"test_box",category:"cardboard",name:"テスト箱",preview:"box-preview.png",cardboardImage:"box-game.png",acquisitionType:"coins"},
    {id:"test_paw",category:"paw",name:"テスト肉球",preview:"paw-preview.png",pawImage:"paw-game.png",acquisitionType:"coins"},
    {id:"test_board",category:"boardTheme",name:"テスト盤面",preview:"board-preview.png",boardImage:"board-game.png",acquisitionType:"coins"}
  ];
  return {
    CATEGORIES:Catalog.CATEGORIES,
    getCategory:Catalog.getCategory,
    getItem(category,id){return items.find(item=>item.category===category&&item.id===id)||null;}
  };
}

function appearance(overrides={}){
  return {
    ownedCardboards:["default","test_box"],
    ownedPaws:["default","test_paw"],
    ownedBoardThemes:["default","test_board"],
    equippedAppearance:{
      cardboardId:"test_box",
      pawId:"test_paw",
      boardThemeId:"test_board",
      ...overrides
    }
  };
}

test("条件解放系は専用ロック画像、コイン商品は未購入でも通常画像",()=>{
  const achievement=Catalog.getItem("catSkin","cat_kaitou");
  const coin=Catalog.getItem("catSkin","cat_coin_01");
  assert.equal(Collection.displayImage(achievement,"unowned"),achievement.silhouetteImage);
  assert.equal(Collection.displayImage(achievement,"unowned","profile"),achievement.lockedProfileImage);
  assert.equal(Collection.usesLockedImage(achievement,"unowned"),true);
  assert.equal(Collection.displayImage(coin,"unowned"),coin.collectionImage);
  assert.equal(Collection.displayImage(coin,"unowned","profile"),coin.profileImage);
  assert.equal(Collection.usesLockedImage(coin,"unowned"),false);
  assert.equal(Collection.displayImage(coin,"owned"),coin.collectionImage);
  const source=fs.readFileSync(path.join(__dirname,"..","collection.js"),"utf8");
  assert.match(source,/state==="unowned" && item\.acquisitionType==="coins"/);
  assert.match(source,/collection-price-badge/);
});

test("ダンボール・肉球・盤面テーマは装備IDからカタログ画像を解決",()=>{
  const catalog=cosmeticCatalog(),data=appearance();
  assert.deepEqual(Skins.resolveCardboard(data,{catalog}),{src:"box-game.png",fallback:Skins.DEFAULTS.cardboard,itemId:"test_box"});
  assert.deepEqual(Skins.resolvePaw(data,{catalog}),{src:"paw-game.png",fallback:Skins.DEFAULTS.paw,itemId:"test_paw"});
  assert.deepEqual(Skins.resolveBoardTheme(data,{catalog}),{src:"board-game.png",fallback:Skins.DEFAULTS.board,itemId:"test_board"});
});

test("未所持・不正ID・素材欠落は既存デフォルト画像へfallback",()=>{
  const catalog=cosmeticCatalog();
  const invalid=appearance({cardboardId:"missing",pawId:"missing",boardThemeId:"missing"});
  assert.equal(Skins.resolveCardboard(invalid,{catalog}).src,"./assets/images/box.png");
  assert.equal(Skins.resolvePaw(invalid,{catalog}).src,"./assets/images/paw.png");
  assert.equal(Skins.resolveBoardTheme(invalid,{catalog}).src,"./assets/images/bg_day.png");
  const missingAssetCatalog={...catalog,getItem(category,id){
    if(id==="test_paw")return {id,category,preview:"preview-must-not-be-gameplay.png",acquisitionType:"coins"};
    return catalog.getItem(category,id);
  }};
  assert.equal(Skins.resolvePaw(appearance(),{catalog:missingAssetCatalog}).src,Skins.DEFAULTS.paw);
});

test("盤面・通常足跡・結果軌跡は共通resolverを使用",()=>{
  const source=fs.readFileSync(path.join(__dirname,"..","game.js"),"utf8");
  const css=fs.readFileSync(path.join(__dirname,"..","style.css"),"utf8");
  assert.match(source,/Skins\.resolveCardboard\(playerAppearance\(\)\)/);
  assert.match(source,/function localPawAsset\(\)[\s\S]*?Skins\.resolvePaw/);
  assert.match(source,/applyBoardTheme\(resultRouteBoard\)/);
  assert.doesNotMatch(source,/src="\.\/assets\/images\/paw\.png"/);
  assert.doesNotMatch(source,/class="box-art" src="\.\/assets\/images\/box\.png"/);
  assert.match(css,/--nyan-board-theme-image/);
});

test("デフォルト装備は従来3画像を維持",()=>{
  const data={
    ownedCardboards:["default"],ownedPaws:["default"],ownedBoardThemes:["default"],
    equippedAppearance:{cardboardId:"default",pawId:"default",boardThemeId:"default"}
  };
  assert.equal(Skins.resolveCardboard(data).src,"./assets/images/box.png");
  assert.equal(Skins.resolvePaw(data).src,"./assets/images/paw.png");
  assert.equal(Skins.resolveBoardTheme(data).src,"./assets/images/bg_day.png");
});

test("和風コイン外観3種は通常プレビューとゲーム用画像を共用するready商品",()=>{
  const expected=[
    ["cardboard","cardboard_coin_01","忍者屋敷の木箱","cardboardImage","cardboard_ninja_crate.png",30],
    ["paw","paw_coin_01","墨の足跡","pawImage","paw_sumi.png",30],
    ["boardTheme","board_coin_01","月夜の城下町","boardImage","board_moonlit_castle_town.png",60]
  ];
  for(const [category,id,name,assetField,fileName,price] of expected){
    const item=Catalog.getItem(category,id);
    assert.equal(item.name,name);
    assert.equal(item.acquisitionType,"coins");
    assert.equal(item.priceCoins,price);
    assert.equal(item.materialStatus,"ready");
    assert.equal(item.assetStatus,"ready");
    assert.equal(item.preview,item[assetField]);
    assert.match(item.preview,new RegExp(`/cosmetics/japanese01/${fileName.replace(".","\\.")}$`));
    assert.equal(fs.existsSync(path.resolve(__dirname,"..",item.preview)),true,item.preview);
    assert.equal(Collection.displayImage(item,"unowned"),item.preview);
    assert.equal(Collection.usesLockedImage(item,"unowned"),false);
  }
});

test("和風コイン外観素材は既存表示基準の寸法・透過条件を満たす",()=>{
  const expected=new Map([
    [Catalog.getItem("cardboard","cardboard_coin_01").cardboardImage,[1254,1254,6]],
    [Catalog.getItem("paw","paw_coin_01").pawImage,[1254,1254,6]],
    [Catalog.getItem("boardTheme","board_coin_01").boardImage,[1672,941,2]]
  ]);
  expected.forEach(([width,height,colorType],asset)=>{
    const buffer=fs.readFileSync(path.resolve(__dirname,"..",asset));
    assert.equal(buffer.readUInt32BE(16),width,asset);
    assert.equal(buffer.readUInt32BE(20),height,asset);
    assert.equal(buffer[25],colorType,`${asset} PNG color type`);
  });
});

test("和風コイン外観3種は所有・装備状態で本番resolverへ反映できる",()=>{
  const data={
    ownedCardboards:["default","cardboard_coin_01"],
    ownedPaws:["default","paw_coin_01"],
    ownedBoardThemes:["default","board_coin_01"],
    equippedAppearance:{
      cardboardId:"cardboard_coin_01",
      pawId:"paw_coin_01",
      boardThemeId:"board_coin_01"
    }
  };
  const cardboard=Catalog.getItem("cardboard","cardboard_coin_01");
  const paw=Catalog.getItem("paw","paw_coin_01");
  const board=Catalog.getItem("boardTheme","board_coin_01");
  assert.equal(Skins.resolveCardboard(data).src,cardboard.cardboardImage);
  assert.equal(Skins.resolvePaw(data).src,paw.pawImage);
  assert.equal(Skins.resolveBoardTheme(data).src,board.boardImage);
});

test("装備中の盤面テーマはホーム背景にも同じresolverから反映する",()=>{
  const calls=[];
  const home={
    style:{setProperty(name,value){calls.push([name,value]);}},
    dataset:{}
  };
  const data={
    ownedBoardThemes:["default","board_coin_01"],
    equippedAppearance:{boardThemeId:"board_coin_01"}
  };
  const theme=Skins.renderHomeBoardTheme(data,{
    document:{getElementById(id){return id==="modeOverlay"?home:null;}}
  });
  assert.equal(theme.itemId,"board_coin_01");
  assert.equal(home.dataset.boardThemeId,"board_coin_01");
  assert.deepEqual(calls,[["--nyan-home-theme-image",`url("${theme.src}")`]]);
  const source=fs.readFileSync(path.join(__dirname,"..","skin-presentation.js"),"utf8");
  const css=fs.readFileSync(path.join(__dirname,"..","style.css"),"utf8");
  assert.match(source,/renderHomeFavorite\(data\);[\s\S]*renderHomeBoardTheme\(data/);
  assert.match(css,/--nyan-home-theme-image/);
});

test("忍者にゃんと侍しばはreadyのコイン商品として本番素材パスを保持",()=>{
  const ninja=Catalog.getItem("catSkin","cat_coin_01");
  const samurai=Catalog.getItem("dogSkin","dog_coin_01");
  assert.equal(ninja.name,"忍者にゃん");
  assert.equal(samurai.name,"侍しば（3匹セット）");
  for(const item of [ninja,samurai]){
    assert.equal(item.acquisitionType,"coins");
    assert.equal("silhouetteImage" in item,false);
    assert.equal("lockedProfileImage" in item,false);
  }
  assert.equal(ninja.materialStatus,"ready");
  assert.equal(ninja.assetStatus,"ready");
  assert.equal(samurai.materialStatus,"ready");
  assert.equal(samurai.assetStatus,"ready");
  assert.equal(ninja.plannedAssets.collectionImage,"./assets/images/skins/ninja01/cat_ninja_collection.png");
  assert.equal(ninja.plannedAssets.homeImage,"./assets/images/skins/ninja01/cat_ninja_home.png");
  assert.equal(ninja.collectionImage,ninja.plannedAssets.collectionImage);
  assert.equal(ninja.profileImage,ninja.plannedAssets.profileImage);
  assert.equal(ninja.pieceImage,ninja.plannedAssets.pieceImage);
  assert.equal(ninja.homeImage,ninja.plannedAssets.homeImage);
  Object.values(ninja.plannedAssets).forEach(asset=>{
    assert.equal(fs.existsSync(path.resolve(__dirname,"..",asset)),true,asset);
  });
  assert.deepEqual(samurai.plannedAssets.pieceImage,{
    red:"./assets/images/skins/ninja01/dog_samurai_red_piece.png",
    black:"./assets/images/skins/ninja01/dog_samurai_black_piece.png",
    white:"./assets/images/skins/ninja01/dog_samurai_white_piece.png"
  });
  assert.equal(samurai.plannedAssets.homeImage,"./assets/images/skins/ninja01/dog_samurai_home.png");
  assert.equal(samurai.collectionImage,samurai.plannedAssets.collectionImage);
  assert.equal(samurai.profileImage,samurai.plannedAssets.profileImage);
  assert.deepEqual(samurai.pieceImage,samurai.plannedAssets.pieceImage);
  assert.deepEqual(samurai.cardImage,samurai.plannedAssets.pieceImage);
  assert.equal(samurai.homeImage,samurai.plannedAssets.homeImage);
  const samuraiAssets=[
    samurai.collectionImage,samurai.profileImage,...Object.values(samurai.pieceImage),
    samurai.resultWinImage,samurai.resultLoseImage,samurai.moveEffect,
    samurai.foundFootprintEffect,samurai.homeDecorImage,
    samurai.homeCharacterImage,samurai.homeImage
  ];
  samuraiAssets.forEach(asset=>assert.equal(fs.existsSync(path.resolve(__dirname,"..",asset)),true,asset));
});

test("侍しば12素材は制作仕様の寸法・透過条件を満たす",()=>{
  const samurai=Catalog.getItem("dogSkin","dog_coin_01");
  const expected=new Map([
    [samurai.collectionImage,[1448,1086,6]],
    [samurai.profileImage,[1254,1254,6]],
    [samurai.pieceImage.red,[1254,1254,6]],
    [samurai.pieceImage.black,[1254,1254,6]],
    [samurai.pieceImage.white,[1254,1254,6]],
    [samurai.resultWinImage,[1536,1024,2]],
    [samurai.resultLoseImage,[1536,1024,2]],
    [samurai.moveEffect,[1254,1254,6]],
    [samurai.foundFootprintEffect,[1254,1254,6]],
    [samurai.homeDecorImage,[2172,724,6]],
    [samurai.homeCharacterImage,[2172,724,6]],
    [samurai.homeImage,[1448,1086,6]]
  ]);
  expected.forEach(([width,height,colorType],asset)=>{
    const buffer=fs.readFileSync(path.resolve(__dirname,"..",asset));
    assert.equal(buffer.readUInt32BE(16),width,asset);
    assert.equal(buffer.readUInt32BE(20),height,asset);
    assert.equal(buffer[25],colorType,`${asset} PNG color type`);
  });
});

test("忍者にゃん10素材は制作仕様の寸法・透過条件を満たす",()=>{
  const ninja=Catalog.getItem("catSkin","cat_coin_01");
  const expected={
    collectionImage:[1254,1254,6],profileImage:[1254,1254,2],pieceImage:[1536,1024,6],
    resultWinImage:[1536,1024,2],resultLoseImage:[1536,1024,2],
    moveEffect:[1536,1024,6],foundFootprintEffect:[1254,1254,6],
    homeDecorImage:[2172,724,6],homeCharacterImage:[2172,724,6],homeImage:[1086,1448,6]
  };
  Object.entries(expected).forEach(([field,[width,height,colorType]])=>{
    const buffer=fs.readFileSync(path.resolve(__dirname,"..",ninja[field]));
    assert.equal(buffer.readUInt32BE(16),width,field);
    assert.equal(buffer.readUInt32BE(20),height,field);
    assert.equal(buffer[25],colorType,`${field} PNG color type`);
  });
});

test("和風ホームcharacterは忍者を下端へ、侍しばを左へ配置し450ms反応を維持",()=>{
  const ninja=Skins.HOME_LAYERED_SKINS["catSkin:cat_coin_01"];
  const samurai=Skins.HOME_LAYERED_SKINS["dogSkin:dog_coin_01"];
  assert.equal(ninja.characterLayout.translate,"0 5%");
  assert.equal(samurai.characterLayout.translate,"-14% 0");
  assert.equal(ninja.durationMs,450);assert.equal(samurai.durationMs,450);
  for(const config of [ninja,samurai]){
    assert.match(config.character,/home_character\.png$/);
    assert.match(config.treasure,/home_decor\.png$/);
    assert.equal(config.reaction.at(-1).transform,"translate3d(0,0,0) scale(1) rotate(0deg)");
  }
});
