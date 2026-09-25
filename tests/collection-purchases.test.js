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

test("ランク報酬はコイン購入できない",async()=>{
  const data=PlayerData.createDefaultData("ncp_collectiontest1");
  assert.equal(Collection.validatePurchase({...data,nyanCoins:999},"profileFrame","rank_gold").reason,"not_coin_purchasable");
  assert.equal(Collection.validatePurchase({...data,nyanCoins:999},"catSkin","cat_master_reward_pending").reason,"not_coin_purchasable");
});

test("購入確認はreadyかつ十分な残高だけ有効で、確定前は残高を変更しない",async()=>{
  const store=PlayerData.createStore({storage:new MemoryStorage()});
  await store.load();
  await store.addCoins(2000,"test:grant","test:purchase-confirm:grant");
  const before=store.getSnapshot();
  const confirmation=Collection.purchaseConfirmation(before,"catSkin","cat_coin_01");
  assert.deepEqual({ok:confirmation.ok,current:confirmation.current,price:confirmation.price,after:confirmation.after},
    {ok:true,current:2000,price:500,after:1500});
  assert.equal(store.getSnapshot().nyanCoins,2000,"確認表示・キャンセル相当では未減算");
  const short={...before,nyanCoins:499};
  assert.equal(Collection.purchaseConfirmation(short,"catSkin","cat_coin_01").reason,"insufficient_coins");
  const pending={...Catalog.getItem("catSkin","cat_coin_01"),id:"pending",materialStatus:"pending",assetStatus:"placeholder"};
  const fakeCatalog={getCategory:Catalog.getCategory,getItem:()=>pending};
  assert.equal(Collection.purchaseConfirmation(before,"catSkin","pending",fakeCatalog).reason,"material_unavailable");
});

const LOCAL_COSMETIC_CASES=[
  {category:"cardboard",id:"cardboard_coin_01",price:30,ownedField:"ownedCardboards",equippedField:"cardboardId",fallback:"default"},
  {category:"paw",id:"paw_coin_01",price:30,ownedField:"ownedPaws",equippedField:"pawId",fallback:"default"},
  {category:"boardTheme",id:"board_coin_01",price:60,ownedField:"ownedBoardThemes",equippedField:"boardThemeId",fallback:"default"}
];

for(const itemCase of LOCAL_COSMETIC_CASES){
  test(`${itemCase.id}は100コインから正規価格だけ減算し再送・再起動でも一度だけ所有する`,async()=>{
    const storage=new MemoryStorage();
    const store=PlayerData.createStore({storage});
    await store.load();
    await store.addCoins(100,"test:grant",`test:${itemCase.id}:grant`);
    const item=Catalog.getItem(itemCase.category,itemCase.id);
    assert.equal(item.materialStatus,"ready");
    assert.equal(item.assetStatus,"ready");
    assert.equal(item.priceCoins,itemCase.price);
    assert.equal(Collection.validatePurchase(store.getSnapshot(),itemCase.category,itemCase.id).ok,true);

    const purchased=await store.purchaseCollectionItem(itemCase.category,itemCase.id);
    assert.equal(purchased.nyanCoins,100-itemCase.price);
    assert.equal(purchased[itemCase.ownedField].includes(itemCase.id),true);
    const transactionId=`collection:${itemCase.category}:${itemCase.id}`;
    assert.deepEqual(purchased.coinTransactions.filter(id=>id===transactionId),[transactionId]);

    const replay=await store.purchaseCollectionItem(itemCase.category,itemCase.id);
    assert.equal(replay.nyanCoins,100-itemCase.price);
    assert.equal(replay[itemCase.ownedField].filter(id=>id===itemCase.id).length,1);
    for(const other of LOCAL_COSMETIC_CASES.filter(value=>value.category!==itemCase.category)){
      assert.equal(replay[other.ownedField].includes(other.id),false);
    }

    await store.updateEquipment(itemCase.category,itemCase.id);
    assert.equal(store.getSnapshot().equippedAppearance[itemCase.equippedField],itemCase.id);
    await store.updateEquipment(itemCase.category,itemCase.fallback);
    assert.equal(store.getSnapshot().equippedAppearance[itemCase.equippedField],itemCase.fallback);
    await store.updateEquipment(itemCase.category,itemCase.id);

    const restoredStore=PlayerData.createStore({storage});
    const restored=await restoredStore.load();
    assert.equal(restored.nyanCoins,100-itemCase.price);
    assert.equal(restored[itemCase.ownedField].filter(id=>id===itemCase.id).length,1);
    assert.equal(restored.equippedAppearance[itemCase.equippedField],itemCase.id);
  });

  test(`${itemCase.id}は不足コイン時に購入せず指定メッセージと残高を維持する`,async()=>{
    const store=PlayerData.createStore({storage:new MemoryStorage()});
    await store.load();
    const balance=itemCase.price-1;
    await store.addCoins(balance,"test:grant",`test:${itemCase.id}:short-grant`);
    assert.equal(Collection.validatePurchase(store.getSnapshot(),itemCase.category,itemCase.id).reason,"insufficient_coins");
    await assert.rejects(store.purchaseCollectionItem(itemCase.category,itemCase.id),/insufficient_coins/);
    assert.equal(store.getSnapshot().nyanCoins,balance);
    assert.equal(store.getSnapshot()[itemCase.ownedField].includes(itemCase.id),false);

    let message="";
    const controller=Collection.createController({playerData:store,view:{showError(value){message=value;}}});
    await controller.load();
    const result=await controller.purchase(itemCase.category,itemCase.id);
    assert.equal(result.reason,"insufficient_coins");
    assert.equal(message,"にゃんコインが足りません");
    assert.equal(controller.getState().data.nyanCoins,balance);
  });
}

test("侍しばは500コインで一度だけ購入でき、装備・プロフィール・ホームへ設定できる",async()=>{
  const store=PlayerData.createStore({storage:new MemoryStorage()});
  await store.load();
  await store.addCoins(600,"test:grant","test:samurai:grant");
  const item=Catalog.getItem("dogSkin","dog_coin_01");
  assert.equal(item.materialStatus,"ready");
  assert.equal(item.assetStatus,"ready");
  assert.equal(item.priceCoins,500);
  assert.equal(Collection.validatePurchase(store.getSnapshot(),"dogSkin",item.id).ok,true);

  const purchased=await store.purchaseCollectionItem("dogSkin",item.id);
  assert.equal(purchased.nyanCoins,100);
  assert.equal(purchased.ownedDogSkins.includes(item.id),true);
  assert.deepEqual(purchased.coinTransactions.filter(id=>id===`collection:dogSkin:${item.id}`),[`collection:dogSkin:${item.id}`]);

  const replay=await store.purchaseCollectionItem("dogSkin",item.id);
  assert.equal(replay.nyanCoins,100);
  assert.equal(replay.ownedDogSkins.filter(id=>id===item.id).length,1);

  await store.updateEquipment("dogSkin",item.id);
  await store.updateProfileCharacter("dogSkin",item.id);
  await store.updateFavoriteCharacter("dogSkin",item.id);
  const configured=store.getSnapshot();
  assert.equal(configured.equippedAppearance.dogSkinId,item.id);
  assert.deepEqual(configured.profileCharacter,{category:"dogSkin",itemId:item.id});
  assert.deepEqual(configured.favoriteCharacter,{category:"dogSkin",itemId:item.id});
});

test("侍しばは499コイン以下で購入できず残高と所有状態を維持する",async()=>{
  const store=PlayerData.createStore({storage:new MemoryStorage()});
  await store.load();
  await store.addCoins(499,"test:grant","test:samurai:short-grant");
  assert.equal(Collection.validatePurchase(store.getSnapshot(),"dogSkin","dog_coin_01").reason,"insufficient_coins");
  await assert.rejects(store.purchaseCollectionItem("dogSkin","dog_coin_01"),/insufficient_coins/);
  assert.equal(store.getSnapshot().nyanCoins,499);
  assert.equal(store.getSnapshot().ownedDogSkins.includes("dog_coin_01"),false);

  let message="";
  const controller=Collection.createController({
    playerData:store,
    view:{showError(value){message=value;}}
  });
  await controller.load();
  const result=await controller.purchase("dogSkin","dog_coin_01");
  assert.equal(result.reason,"insufficient_coins");
  assert.equal(message,"にゃんコインが足りません");
  assert.equal(controller.getState().data.nyanCoins,499);
});

test("忍者にゃんは500コインで一度だけ購入でき、装備・プロフィール・ホームへ設定できる",async()=>{
  const store=PlayerData.createStore({storage:new MemoryStorage()});
  await store.load();
  await store.addCoins(600,"test:grant","test:ninja:grant");
  const item=Catalog.getItem("catSkin","cat_coin_01");
  assert.equal(item.materialStatus,"ready");
  assert.equal(item.assetStatus,"ready");
  assert.equal(item.priceCoins,500);
  assert.equal(Collection.validatePurchase(store.getSnapshot(),"catSkin",item.id).ok,true);

  const purchased=await store.purchaseCollectionItem("catSkin",item.id);
  assert.equal(purchased.nyanCoins,100);
  assert.equal(purchased.ownedCatSkins.includes(item.id),true);
  assert.deepEqual(purchased.coinTransactions.filter(id=>id===`collection:catSkin:${item.id}`),[`collection:catSkin:${item.id}`]);

  const replay=await store.purchaseCollectionItem("catSkin",item.id);
  assert.equal(replay.nyanCoins,100);
  assert.equal(replay.ownedCatSkins.filter(id=>id===item.id).length,1);

  await store.updateEquipment("catSkin",item.id);
  await store.updateProfileCharacter("catSkin",item.id);
  await store.updateFavoriteCharacter("catSkin",item.id);
  const configured=store.getSnapshot();
  assert.equal(configured.equippedAppearance.catSkinId,item.id);
  assert.deepEqual(configured.profileCharacter,{category:"catSkin",itemId:item.id});
  assert.deepEqual(configured.favoriteCharacter,{category:"catSkin",itemId:item.id});
});

test("忍者にゃんは499コイン以下で購入できず残高と所有状態を維持する",async()=>{
  const store=PlayerData.createStore({storage:new MemoryStorage()});
  await store.load();
  await store.addCoins(499,"test:grant","test:ninja:short-grant");
  assert.equal(Collection.validatePurchase(store.getSnapshot(),"catSkin","cat_coin_01").reason,"insufficient_coins");
  await assert.rejects(store.purchaseCollectionItem("catSkin","cat_coin_01"),/insufficient_coins/);
  assert.equal(store.getSnapshot().nyanCoins,499);
  assert.equal(store.getSnapshot().ownedCatSkins.includes("cat_coin_01"),false);

  let message="";
  const controller=Collection.createController({
    playerData:store,
    view:{showError(value){message=value;}}
  });
  await controller.load();
  const result=await controller.purchase("catSkin","cat_coin_01");
  assert.equal(result.reason,"insufficient_coins");
  assert.equal(message,"にゃんコインが足りません");
  assert.equal(controller.getState().data.nyanCoins,499);
});

test("購入可能素材では購入後に所持へ移り再購入で二重控除しない",async()=>{
  const item={id:"ready_paw",category:"paw",name:"購入可能肉球",preview:"paw.png",acquisitionType:"coins",currency:"nyanCoins",priceCoins:30,rarity:"Common",materialStatus:"ready",assetStatus:"ready"};
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
