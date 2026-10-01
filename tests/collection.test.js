"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Catalog=require("../collection-catalog.js");
const Collection=require("../collection.js");

function createData(){
  return {
    version:1,
    playerId:"ncp_1234567890abcdef",
    nyanCoins:0,
    ownedCatSkins:["default"],
    ownedDogSkins:["default"],
    ownedCardboards:["default"],
    ownedPaws:["default"],
    ownedBoardThemes:["default"],
    equippedAppearance:{
      catSkinId:"default",
      dogSkinId:"default",
      cardboardId:"default",
      pawId:"default",
      boardThemeId:"default"
    },
    challengeProgress:{kept:true}
  };
}

function createFutureCatalog(){
  const items=[
    ...Catalog.ITEMS,
    {id:"future-cat",category:"catSkin",name:"テスト用",preview:"test.png"},
    {id:"future-dog",category:"dogSkin",name:"テスト用",preview:"test.png"}
  ];
  return {
    CATEGORIES:Catalog.CATEGORIES,
    ITEMS:items,
    getCategory:Catalog.getCategory,
    getItemsByCategory(categoryId){return items.filter(item=>item.category===categoryId);},
    getItem(categoryId,itemId){
      return items.find(item=>item.category===categoryId && item.id===itemId) || null;
    },
    isKnownItem(categoryId,itemId){return this.getItem(categoryId,itemId)!==null;}
  };
}

test("本番カタログは既存品とコイン・ランク報酬の土台を持つ",()=>{
  assert.deepEqual(
    Catalog.ITEMS.filter(item=>item.id==="default").map(item=>item.category).sort(),
    ["boardTheme","cardboard","catSkin","dogSkin","paw"]
  );
  assert.equal(Catalog.getItem("catSkin","cat_kaitou").name,"怪盗にゃん");
  assert.equal(Catalog.getItem("dogSkin","dog_detective").name,"探偵しば");
  assert.equal(Catalog.getItem("catSkin","cat_coin_01").priceCoins,500);
  assert.equal(Catalog.getItem("dogSkin","dog_coin_01").priceCoins,500);
  assert.equal(Catalog.getItem("cardboard","cardboard_coin_01").priceCoins,30);
  assert.equal(Catalog.getItem("paw","paw_coin_01").priceCoins,30);
  assert.equal(Catalog.getItem("boardTheme","board_coin_01").priceCoins,60);
  assert.equal(Catalog.getItem("profileFrame","rank_master").acquisitionType,"rankReward");
  assert.deepEqual(Catalog.getItemsByCategory("profileFrame").map(item=>item.id),[
    "rank_bronze","rank_silver","rank_gold","rank_platinum","rank_diamond","rank_master"
  ]);
  for(const item of Catalog.getItemsByCategory("profileFrame")){
    assert.match(item.frameImage,/assets\/images\/rank\/profile-frames\/rank_.+_frame\.png$/);
    assert.equal(item.materialStatus,"ready");
  }
  assert.equal(Catalog.getItem("catSkin","cat_master_s01_king").acquisitionType,"masterRankReward");
  assert.equal(Catalog.getItem("dogSkin","dog_master_reward_pending").acquisitionType,"masterRankReward");
  assert.deepEqual(Collection.SECTION_CATEGORIES.rank,["profileFrame"]);
  assert.equal(Catalog.getItemsByCategory("profileFrame").some(item=>item.acquisitionType==="masterRankReward"),false);
});

test("未獲得ランクフレームも正式PNGを見せるが装備権限は付与しない",()=>{
  const silver=Catalog.getItem("profileFrame","rank_silver");
  assert.equal(Collection.displayImage(silver,"unowned"),silver.collectionImage);
  assert.equal(Collection.displayImage(silver,"owned"),silver.collectionImage);
  assert.equal(Collection.usesLockedImage(silver,"unowned"),false);
  assert.equal(Collection.canEquipItem({...createData(),ownedProfileFrames:[]},silver,Catalog),false);
  assert.equal(Collection.canEquipItem({...createData(),ownedProfileFrames:[silver.id]},silver,Catalog),true);
  assert.equal(silver.unlockCondition.text,"Silverランク到達で永久解放");
});

test("王様ネコは未所持時だけ疑問符入り専用locked画像を使う",()=>{
  const king=Catalog.getItem("catSkin","cat_master_s01_king");
  assert.match(Collection.displayImage(king,"unowned"),/cat_master_king_collection_locked\.png$/);
  assert.equal(Collection.usesLockedImage(king,"unowned"),true);
  assert.equal(Collection.displayImage(king,"owned"),king.collectionImage);
  assert.match(Collection.displayImage(king,"unowned","profile"),/cat_master_king_profile_locked\.png$/);
});

test("pendingまたはplaceholder素材はCollection一覧から除外する",()=>{
  const pending=Catalog.getItem("dogSkin","dog_master_reward_pending");
  assert.equal(Collection.isCollectionVisible(pending),false);
  assert.equal(Collection.isCollectionVisible({materialStatus:"ready",assetStatus:"placeholder"}),false);
  assert.equal(Collection.isCollectionVisible({materialStatus:"ready",assetStatus:"ready"}),true);
  const source=fs.readFileSync(path.resolve(__dirname,"..","collection.js"),"utf8");
  assert.match(source,/if\(!item \|\| !isCollectionVisible\(item\)\)/);
});

test("デフォルト猫は立ち絵と盤面駒の画像を分離する",()=>{
  const defaultCat=Catalog.getItem("catSkin","default");
  assert.equal(defaultCat.preview,"./assets/images/cpu_select_cat.png");
  assert.equal(defaultCat.collectionImage,"./assets/images/cpu_select_cat.png");
  assert.equal(defaultCat.pieceImage,"./assets/images/cat_play_normal.png");
  assert.equal(defaultCat.profileImage,defaultCat.pieceImage);
});

test("デフォルト柴犬は3匹セットのプロフィール画像を使う",()=>{
  const defaultDog=Catalog.getItem("dogSkin","default");
  assert.equal(defaultDog.profileImage,"./assets/images/dog_default_profile.png");
  assert.equal(fs.existsSync(path.resolve(__dirname,"..",defaultDog.profileImage)),true);
});

test("コレクション操作ラベルは状態と用途を明示する",()=>{
  assert.equal(Collection.getEquipLabel("catSkin","owned"),"スキンを装備する");
  assert.equal(Collection.getEquipLabel("dogSkin","equipped"),"スキン装備中");
  assert.equal(Collection.getEquipLabel("cardboard","owned"),"装備する");
  assert.equal(Collection.getEquipLabel("catSkin","unowned"),"🔒 未所持");
});

test("未所持の疑問符は専用locked画像だけに含めDOMでは重ねない",()=>{
  const collectionSource=fs.readFileSync(path.resolve(__dirname,"..","collection.js"),"utf8");
  const detailSource=fs.readFileSync(path.resolve(__dirname,"..","index.html"),"utf8");
  assert.doesNotMatch(collectionSource,/collection-unowned-cover|unownedCover|question\.textContent/);
  assert.doesNotMatch(detailSource,/class="collection-lock"/);
});

test("非プロフィールカテゴリは詳細だけを維持しプロフィールプレビューを隠す",()=>{
  const source=fs.readFileSync(path.resolve(__dirname,"..","collection.js"),"utf8");
  const html=fs.readFileSync(path.resolve(__dirname,"..","index.html"),"utf8");
  const css=fs.readFileSync(path.resolve(__dirname,"..","style.css"),"utf8");
  for(const category of ["cardboard","paw","boardTheme"]){
    assert.ok(Catalog.getItem(category,"default"));
    assert.equal(Collection.supportsProfilePreview(category),false);
  }
  for(const category of ["catSkin","dogSkin","profileFrame"]){
    assert.equal(Collection.supportsProfilePreview(category),true);
  }
  assert.match(source,/showProfilePreview=supportsProfilePreview\(item\.category\)/);
  assert.match(source,/profilePreview\.hidden=!showProfilePreview/);
  assert.match(source,/else if\(profileImage\)\{\s*profileImage\.onerror=null;\s*profileImage\.removeAttribute\("src"\)/);
  assert.match(html,/data-detail-profile-preview/);
  assert.match(html,/id="collectionDetail"[\s\S]*?data-detail-collection-image/);
  assert.match(css,/\.collection-profile-preview\[hidden\]\{display:none\}/);
});

test("defaultアイテムを全カテゴリで装備中と判定する",()=>{
  const data=createData();
  Catalog.ITEMS.filter(item=>item.id==="default").forEach(item=>{
    assert.equal(Collection.getItemState(data,item,Catalog),"equipped");
  });
});

test("第1弾スキンは初期所持にならず猫と犬を混同しない",()=>{
  const data=createData();
  assert.equal(Collection.getItemState(data,Catalog.getItem("catSkin","cat_kaitou"),Catalog),"unowned");
  assert.equal(Collection.getItemState(data,Catalog.getItem("dogSkin","dog_detective"),Catalog),"unowned");
  assert.equal(Collection.validateEquip(data,"dogSkin","cat_kaitou",Catalog).reason,"unknown_item");
});

test("ホーム推しキャラは所持済みキャラスキンだけを許可する",()=>{
  const data=createData();
  assert.equal(Collection.validateFavorite(data,"catSkin","cat_kaitou",Catalog).reason,"not_owned");
  data.ownedCatSkins.push("cat_kaitou");
  assert.equal(Collection.validateFavorite(data,"catSkin","cat_kaitou",Catalog).ok,true);
  assert.equal(Collection.validateFavorite(data,"cardboard","default",Catalog).reason,"invalid_category");
});

test("プロフィール設定は所持済みキャラスキンだけを許可する",()=>{
  const data=createData();
  assert.equal(Collection.validateProfile(data,"dogSkin","dog_detective",Catalog).reason,"not_owned");
  data.ownedDogSkins.push("dog_detective");
  assert.equal(Collection.validateProfile(data,"dogSkin","dog_detective",Catalog).ok,true);
  assert.equal(Collection.validateProfile(data,"boardTheme","default",Catalog).reason,"invalid_category");
});

test("所持・未所持・装備中を保存フラグなしで算出する",()=>{
  const catalog=createFutureCatalog();
  const data=createData();
  data.ownedCatSkins.push("future-cat");

  assert.equal(
    Collection.getItemState(data,catalog.getItem("catSkin","future-cat"),catalog),
    "owned"
  );
  assert.equal(
    Collection.getItemState(data,catalog.getItem("dogSkin","future-dog"),catalog),
    "unowned"
  );
  data.equippedAppearance.catSkinId="future-cat";
  assert.equal(
    Collection.getItemState(data,catalog.getItem("catSkin","future-cat"),catalog),
    "equipped"
  );
});

test("不明な装備IDをdefaultへ戻し、不明なowned IDは保持する",()=>{
  const data=createData();
  data.ownedCatSkins.push("unknown-future-id");
  data.equippedAppearance.catSkinId="unknown-future-id";

  const repaired=Collection.sanitizeCatalogEquipment(data,Catalog);

  assert.equal(repaired.changed,true);
  assert.equal(repaired.data.equippedAppearance.catSkinId,"default");
  assert.deepEqual(repaired.data.ownedCatSkins,["default","unknown-future-id"]);
  assert.equal(repaired.data.nyanCoins,0);
});

test("未所持・別カテゴリ・カタログ外の装備を拒否する",()=>{
  const catalog=createFutureCatalog();
  const data=createData();

  assert.equal(Collection.validateEquip(data,"catSkin","future-cat",catalog).reason,"not_owned");
  assert.equal(Collection.validateEquip(data,"dogSkin","future-cat",catalog).reason,"unknown_item");
  assert.equal(Collection.validateEquip(data,"specialSkill","default",catalog).reason,"invalid_category");
});

test("保存結果を正として再描画し、コインや他データをUI側で変更しない",async()=>{
  const catalog=createFutureCatalog();
  const initial=createData();
  initial.ownedCatSkins.push("future-cat");
  const authoritative={
    ...initial,
    nyanCoins:12,
    equippedAppearance:{...initial.equippedAppearance,catSkinId:"future-cat"}
  };
  const renders=[];
  const playerData={
    async load(){return initial;},
    async updateEquipment(category,itemId){
      assert.equal(category,"catSkin");
      assert.equal(itemId,"future-cat");
      return authoritative;
    },
    getSnapshot(){return authoritative;}
  };
  const controller=Collection.createController({
    playerData,
    catalog,
    view:{render(state){renders.push(state);}}
  });
  await controller.load();
  const result=await controller.equip("catSkin","future-cat");

  assert.equal(result.ok,true);
  assert.equal(controller.getState().data,authoritative);
  assert.equal(controller.getState().data.nyanCoins,12);
  assert.deepEqual(controller.getState().data.challengeProgress,{kept:true});
  assert.equal(renders.at(-1).data.equippedAppearance.catSkinId,"future-cat");
});

test("連打中は二重保存しない",async()=>{
  const catalog=createFutureCatalog();
  const initial=createData();
  initial.ownedCatSkins.push("future-cat");
  let saveCount=0;
  let finishSave;
  const pending=new Promise(resolve=>{finishSave=resolve;});
  const playerData={
    async load(){return initial;},
    async updateEquipment(){
      saveCount+=1;
      await pending;
      return {...initial,equippedAppearance:{...initial.equippedAppearance,catSkinId:"future-cat"}};
    },
    getSnapshot(){return initial;}
  };
  const controller=Collection.createController({playerData,catalog});
  await controller.load();

  const first=controller.equip("catSkin","future-cat");
  const second=await controller.equip("catSkin","future-cat");
  assert.equal(second.reason,"busy");
  assert.equal(saveCount,1);
  finishSave();
  await first;
  assert.equal(saveCount,1);
});

test("保存失敗時も直前のスナップショットで継続する",async()=>{
  const catalog=createFutureCatalog();
  const initial=createData();
  initial.ownedCatSkins.push("future-cat");
  let errorMessage="";
  const playerData={
    async load(){return initial;},
    async updateEquipment(){throw new Error("storage_failed");},
    getSnapshot(){return initial;}
  };
  const controller=Collection.createController({
    playerData,
    catalog,
    view:{showError(message){errorMessage=message;}}
  });
  await controller.load();
  const result=await controller.equip("catSkin","future-cat");

  assert.equal(result.ok,false);
  assert.equal(result.reason,"save_failed");
  assert.equal(controller.getState().saving,false);
  assert.equal(controller.getState().data,initial);
  assert.equal(errorMessage,"装備を保存できませんでした");
});

test("カタログ外装備の復旧結果を保存して描画する",async()=>{
  const initial=createData();
  initial.ownedCatSkins.push("unknown-future-id");
  initial.equippedAppearance.catSkinId="unknown-future-id";
  let savedCandidate=null;
  const playerData={
    async load(){return initial;},
    async save(candidate){savedCandidate=candidate;return candidate;},
    getSnapshot(){return savedCandidate;}
  };
  const controller=Collection.createController({playerData,catalog:Catalog});
  const loaded=await controller.load();

  assert.equal(savedCandidate.equippedAppearance.catSkinId,"default");
  assert.deepEqual(savedCandidate.ownedCatSkins,["default","unknown-future-id"]);
  assert.equal(loaded.equippedAppearance.catSkinId,"default");
});

test("ホーム推し変更も保存結果を正とし、装備やコインを変えない",async()=>{
  const initial=createData();
  initial.ownedDogSkins.push("dog_detective");
  const authoritative={...initial,nyanCoins:8,favoriteCharacter:{category:"dogSkin",itemId:"dog_detective"}};
  const playerData={
    async load(){return initial;},
    async updateFavoriteCharacter(category,itemId){
      assert.equal(category,"dogSkin");
      assert.equal(itemId,"dog_detective");
      return authoritative;
    },
    getSnapshot(){return authoritative;}
  };
  const controller=Collection.createController({playerData,catalog:Catalog});
  await controller.load();
  const result=await controller.setFavorite("dogSkin","dog_detective");
  assert.equal(result.ok,true);
  assert.deepEqual(result.data.favoriteCharacter,{category:"dogSkin",itemId:"dog_detective"});
  assert.equal(result.data.equippedAppearance.dogSkinId,"default");
  assert.equal(result.data.nyanCoins,8);
});

test("プロフィール変更も保存結果を正とし、装備・ホーム・コインを変えない",async()=>{
  const initial=createData();
  initial.ownedCatSkins.push("cat_kaitou");
  initial.favoriteCharacter={category:"dogSkin",itemId:"default"};
  const authoritative={
    ...initial,
    nyanCoins:11,
    profileCharacter:{category:"catSkin",itemId:"cat_kaitou"}
  };
  const playerData={
    async load(){return initial;},
    async updateProfileCharacter(category,itemId){
      assert.equal(category,"catSkin");
      assert.equal(itemId,"cat_kaitou");
      return authoritative;
    },
    getSnapshot(){return authoritative;}
  };
  const controller=Collection.createController({playerData,catalog:Catalog});
  await controller.load();
  const result=await controller.setProfile("catSkin","cat_kaitou");
  assert.equal(result.ok,true);
  assert.deepEqual(result.data.profileCharacter,{category:"catSkin",itemId:"cat_kaitou"});
  assert.equal(result.data.equippedAppearance.catSkinId,"default");
  assert.deepEqual(result.data.favoriteCharacter,{category:"dogSkin",itemId:"default"});
  assert.equal(result.data.nyanCoins,11);
});

test("選択中のホーム推しを再タップするとデフォルト表示へ戻す",async()=>{
  const initial=createData();
  initial.ownedCatSkins.push("cat_kaitou");
  initial.favoriteCharacter={category:"catSkin",itemId:"cat_kaitou"};
  let received="not-called";
  const cleared={...initial,favoriteCharacter:null};
  const playerData={
    async load(){return initial;},
    async updateFavoriteCharacter(category,itemId){
      assert.equal(category,"catSkin");
      received=itemId;
      return cleared;
    },
    getSnapshot(){return cleared;}
  };
  const controller=Collection.createController({playerData,catalog:Catalog});
  await controller.load();
  const result=await controller.setFavorite("catSkin","cat_kaitou");
  assert.equal(received,null);
  assert.equal(result.data.favoriteCharacter,null);
});

test("選択中のプロフィールを再タップするとデフォルト画像へ戻す",async()=>{
  const initial=createData();
  initial.ownedDogSkins.push("dog_detective");
  initial.profileCharacter={category:"dogSkin",itemId:"dog_detective"};
  let received="not-called";
  const cleared={...initial,profileCharacter:null};
  const playerData={
    async load(){return initial;},
    async updateProfileCharacter(category,itemId){
      assert.equal(category,"dogSkin");
      received=itemId;
      return cleared;
    },
    getSnapshot(){return cleared;}
  };
  const controller=Collection.createController({playerData,catalog:Catalog});
  await controller.load();
  const result=await controller.setProfile("dogSkin","dog_detective");
  assert.equal(received,null);
  assert.equal(result.data.profileCharacter,null);
});

test("詳細用途カードは操作ボタンで、バイブ設定は表示しない",()=>{
  const html=fs.readFileSync(path.resolve(__dirname,"..","index.html"),"utf8");
  assert.match(html,/<button class="collection-usage-item" data-detail-usage-home type="button">/);
  assert.match(html,/<button class="collection-usage-item" data-detail-usage-profile type="button">/);
  assert.match(html,/id="vibrationToggleBtn" type="button" hidden aria-hidden="true"/);
});

test("Home/Profile切替を各5回繰り返しても表示用ownershipを失わない",async()=>{
  const item=Catalog.getItem("catSkin","cat_master_s01_king");
  const initial={...createData(),ownedCatSkins:["default",item.id],favoriteCharacter:null,profileCharacter:null};
  let favorite=null,profile=null;
  const official=()=>({...createData(),favoriteCharacter:favorite,profileCharacter:profile});
  const playerData={
    async load(){return initial;},getSnapshot:official,
    async updateFavoriteCharacter(category,itemId){favorite=itemId?{category,itemId}:null;return official();},
    async updateProfileCharacter(category,itemId){profile=itemId?{category,itemId}:null;return official();}
  };
  const controller=Collection.createController({playerData,catalog:Catalog});
  await controller.load();
  for(let i=0;i<5;i++){
    await controller.setFavorite("catSkin",item.id);
    assert.notEqual(Collection.getItemState(controller.getState().data,item,Catalog),"unowned");
    await controller.setFavorite("catSkin",item.id);
    assert.equal(Collection.getItemState(controller.getState().data,item,Catalog),"owned");
  }
  for(let i=0;i<5;i++){
    await controller.setProfile("catSkin",item.id);
    assert.notEqual(Collection.getItemState(controller.getState().data,item,Catalog),"unowned");
    await controller.setProfile("catSkin",item.id);
    assert.equal(Collection.getItemState(controller.getState().data,item,Catalog),"owned");
  }
});

test("QA最終ownershipでは6フレームすべてが装備可能",()=>{
  const frames=Catalog.getItemsByCategory("profileFrame");
  const base={...createData(),ownedProfileFrames:["rank_bronze"],equippedProfileFrameId:"default"};
  const ranked={ownedProfileFrames:["rank_bronze"],equippedProfileFrameId:"default"};
  const selectors={collectionState:data=>({...data,ownedProfileFrames:frames.map(item=>item.id)})};
  const presented=Collection.presentedCollectionData(base,ranked,selectors);
  assert.equal(frames.length,6);
  assert.equal(presented.equippedProfileFrameId,'rank_bronze');
  for(const frame of frames){
    assert.equal(Collection.getItemState(presented,frame,Catalog),frame.id==='rank_bronze'?'equipped':'owned');
    assert.equal(Collection.canEquipItem(presented,frame,Catalog),frame.id!=='rank_bronze');
  }
});
