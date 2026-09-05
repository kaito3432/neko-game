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

test("本番カタログはdefaultと第1弾スキンだけを持つ",()=>{
  assert.equal(Catalog.ITEMS.length,7);
  assert.deepEqual(
    Catalog.ITEMS.filter(item=>item.id==="default").map(item=>item.category).sort(),
    ["boardTheme","cardboard","catSkin","dogSkin","paw"]
  );
  Catalog.ITEMS.forEach(item=>{
    assert.equal(typeof item.preview,"string");
    ["price","rarity","limited","shop","skill","ability"].forEach(field=>{
      assert.equal(Object.hasOwn(item,field),false);
    });
  });
  assert.equal(Catalog.getItem("catSkin","cat_kaitou").name,"怪盗にゃん");
  assert.equal(Catalog.getItem("dogSkin","dog_detective").name,"探偵しば");
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

test("未所持立ち絵内は中央の疑問符だけを表示する",()=>{
  const collectionSource=fs.readFileSync(path.resolve(__dirname,"..","collection.js"),"utf8");
  const detailSource=fs.readFileSync(path.resolve(__dirname,"..","index.html"),"utf8");
  assert.match(collectionSource,/unownedCover\.appendChild\(question\)/);
  assert.doesNotMatch(collectionSource,/unownedLabel/);
  assert.match(detailSource,/class="collection-lock"[\s\S]*?<strong>\?<\/strong>[\s\S]*?<\/span>/);
  assert.doesNotMatch(detailSource,/collection-lock[\s\S]{0,180}🔒 未所持/);
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
