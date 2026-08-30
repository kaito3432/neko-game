"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
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

test("本番カタログは5カテゴリのdefaultだけを持つ",()=>{
  assert.equal(Catalog.ITEMS.length,5);
  assert.deepEqual(
    Catalog.ITEMS.map(item=>item.category).sort(),
    ["boardTheme","cardboard","catSkin","dogSkin","paw"]
  );
  Catalog.ITEMS.forEach(item=>{
    assert.equal(item.id,"default");
    assert.equal(typeof item.preview,"string");
    ["price","rarity","limited","shop","skill","ability"].forEach(field=>{
      assert.equal(Object.hasOwn(item,field),false);
    });
  });
});

test("defaultアイテムを全カテゴリで装備中と判定する",()=>{
  const data=createData();
  Catalog.ITEMS.forEach(item=>{
    assert.equal(Collection.getItemState(data,item,Catalog),"equipped");
  });
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
