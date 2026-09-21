"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const Catalog=require("../collection-catalog.js");
const Collection=require("../collection.js");
const Progress=require("../progression-model.js");
const PlayerData=require("../player-data.js");

class MemoryStorage{
  constructor(){this.values=new Map();}
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){this.values.set(key,String(value));}
}

test("カテゴリごとの同期範囲と入手表示を一元定義する",()=>{
  for(const category of ["catSkin","dogSkin","profileFrame"]){
    assert.equal(Catalog.isOpponentVisible(category),true);
    assert.equal(Catalog.isLocalOnly(category),false);
  }
  for(const category of ["cardboard","paw","boardTheme"]){
    assert.equal(Catalog.isOpponentVisible(category),false);
    assert.equal(Catalog.isLocalOnly(category),true);
  }
  assert.equal(Catalog.acquisitionLabel(Catalog.getItem("profileFrame","rank_gold")),"ランク報酬");
  assert.equal(Catalog.acquisitionLabel(Catalog.getItem("catSkin","cat_master_reward_pending")),"ランク報酬（マスター限定）");
  assert.equal(Catalog.acquisitionLabel(Catalog.getItem("dogSkin","dog_master_reward_pending")),"ランク報酬（マスター限定）");
});

test("コイン支出は残高不足を拒否し同一requestIdを二重控除しない",()=>{
  const base={nyanCoins:60,coinTransactions:[]};
  assert.equal(Progress.canSpendCoins(base,60),true);
  assert.equal(Progress.canSpendCoins(base,61),false);
  const spent=Progress.spendCoins(base,{amount:30,reason:"collection:paw",requestId:"collection:paw:item1"});
  assert.equal(spent.nyanCoins,30);
  const replay=Progress.spendCoins(spent,{amount:30,reason:"collection:paw",requestId:"collection:paw:item1"});
  assert.equal(replay.nyanCoins,30);
  assert.deepEqual(replay.coinTransactions,["collection:paw:item1"]);
  assert.throws(()=>Progress.spendCoins(replay,{amount:31,reason:"collection:paw",requestId:"collection:paw:item2"}),/insufficient_coins/);
});

test("コイン追加も同一requestIdで冪等になる",()=>{
  const added=Progress.addCoins({nyanCoins:10,coinTransactions:[]},{amount:20,reason:"future:stamina",requestId:"reward:future:1"});
  const replay=Progress.addCoins(added,{amount:20,reason:"future:stamina",requestId:"reward:future:1"});
  assert.equal(replay.nyanCoins,30);
});

test("素材未設定品とランク報酬は購入・装備できない",async()=>{
  const data=PlayerData.createDefaultData("ncp_collectiontest1");
  assert.equal(Collection.validatePurchase({...data,nyanCoins:999},"catSkin","cat_coin_01").reason,"material_unavailable");
  assert.equal(Collection.validatePurchase({...data,nyanCoins:999},"profileFrame","rank_gold").reason,"not_coin_purchasable");
  assert.equal(Collection.validatePurchase({...data,nyanCoins:999},"catSkin","cat_master_reward_pending").reason,"not_coin_purchasable");
  const store=PlayerData.createStore({storage:new MemoryStorage()});
  await store.load();
  await store.addCoins(999,"test:grant","test:grant:coins");
  await assert.rejects(store.purchaseCollectionItem("catSkin","cat_coin_01"),/collection_material_unavailable/);
  assert.equal(store.getSnapshot().nyanCoins,999);
  assert.deepEqual(store.getSnapshot().ownedCatSkins,["default"]);
});

test("購入可能素材では購入後に所持へ移り再購入で二重控除しない",async()=>{
  const item={id:"ready_paw",category:"paw",name:"購入可能肉球",preview:"paw.png",acquisitionType:"coins",currency:"nyanCoins",priceCoins:30,rarity:"Common"};
  const items=[...Catalog.ITEMS,item];
  const catalog={...Catalog,ITEMS:items,getItem:(category,id)=>items.find(value=>value.category===category&&value.id===id)||null,isKnownItem:(category,id)=>items.some(value=>value.category===category&&value.id===id)};
  let data={...PlayerData.createDefaultData("ncp_collectiontest2"),nyanCoins:60};
  const playerData={
    async load(){return data;},
    async save(next){data=next;return data;},
    getSnapshot(){return data;},
    async purchaseCollectionItem(category,id){
      if(data.ownedPaws.includes(id))return data;
      data={...Progress.spendCoins(data,{amount:item.priceCoins,reason:`collection:${category}`,requestId:`collection:${category}:${id}`}),ownedPaws:[...data.ownedPaws,id]};
      return data;
    },
    async updateEquipment(category,id){
      const field=Catalog.getCategory(category).equippedField;
      data={...data,equippedAppearance:{...data.equippedAppearance,[field]:id}};
      return data;
    }
  };
  const controller=Collection.createController({playerData,catalog});
  await controller.load();
  assert.equal((await controller.purchase("paw","ready_paw")).ok,true);
  assert.equal(controller.getState().data.nyanCoins,30);
  assert.equal(controller.getState().data.ownedPaws.includes("ready_paw"),true);
  assert.equal((await controller.purchase("paw","ready_paw")).reason,"already_owned");
  assert.equal(controller.getState().data.nyanCoins,30);
  assert.equal((await controller.equip("paw","ready_paw")).ok,true);
  assert.equal(controller.getState().data.equippedAppearance.pawId,"ready_paw");
});
