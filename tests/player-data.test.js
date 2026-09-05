"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const PlayerData=require("../player-data.js");

class MemoryStorage{
  constructor(initial={}){
    this.values=new Map(Object.entries(initial));
  }

  getItem(key){
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key,value){
    this.values.set(key,String(value));
  }
}

test("新規プレイヤーIDと初期データを作成する",async()=>{
  const storage=new MemoryStorage();
  const store=PlayerData.createStore({storage});
  const data=await store.load();

  assert.equal(PlayerData.isValidPlayerId(data.playerId),true);
  assert.equal(data.version,PlayerData.CURRENT_VERSION);
  assert.equal(data.nyanCoins,0);
  assert.deepEqual(data.ownedCatSkins,["default"]);
  assert.deepEqual(data.ownedDogSkins,["default"]);
  assert.deepEqual(data.ownedCardboards,["default"]);
  assert.deepEqual(data.ownedPaws,["default"]);
  assert.deepEqual(data.ownedBoardThemes,["default"]);
  assert.deepEqual(data.equippedAppearance,{
    catSkinId:"default",
    dogSkinId:"default",
    cardboardId:"default",
    pawId:"default",
    boardThemeId:"default"
  });
  assert.equal(data.favoriteCharacter,null);
  assert.equal(data.profileCharacter,null);
  assert.equal(storage.getItem(PlayerData.STORAGE_KEYS.playerId),data.playerId);
});

test("所持していない不正な装備IDをdefaultへ復旧する",async()=>{
  const playerId="ncp_badbadbadbadbad1";
  const storage=new MemoryStorage({
    [PlayerData.STORAGE_KEYS.playerId]:playerId,
    [PlayerData.STORAGE_KEYS.playerData]:JSON.stringify({
      ...PlayerData.createDefaultData(playerId),
      ownedCatSkins:["default","known-future"],
      equippedAppearance:{
        catSkinId:"not-owned",
        dogSkinId:"not-owned",
        cardboardId:"not-owned",
        pawId:"not-owned",
        boardThemeId:"not-owned"
      }
    })
  });
  const store=PlayerData.createStore({storage});
  const data=await store.load();

  assert.deepEqual(data.ownedCatSkins,["default","known-future"]);
  assert.deepEqual(data.equippedAppearance,{
    catSkinId:"default",
    dogSkinId:"default",
    cardboardId:"default",
    pawId:"default",
    boardThemeId:"default"
  });
});

test("装備更新は該当カテゴリだけを変更し他データを維持する",async()=>{
  const storage=new MemoryStorage();
  const store=PlayerData.createStore({storage});
  const data=await store.load();
  const prepared={
    ...data,
    nyanCoins:37,
    ownedCatSkins:["default","cat-test"],
    challengeProgress:{safe:true}
  };
  await store.save(prepared);

  const saved=await store.updateEquipment("catSkin","cat-test");

  assert.equal(saved.equippedAppearance.catSkinId,"cat-test");
  assert.equal(saved.equippedAppearance.dogSkinId,"default");
  assert.equal(saved.nyanCoins,37);
  assert.deepEqual(saved.ownedCatSkins,["default","cat-test"]);
  assert.deepEqual(saved.challengeProgress,{safe:true});
});

test("未所持アイテムと別カテゴリ名の装備更新を拒否する",async()=>{
  const store=PlayerData.createStore({storage:new MemoryStorage()});
  await store.load();

  await assert.rejects(
    store.updateEquipment("catSkin","not-owned"),
    /equipment_item_not_owned/
  );
  await assert.rejects(
    store.updateEquipment("specialSkill","default"),
    /invalid_equipment_category/
  );
});

test("保存後の再読み込みでもIDとデータを維持する",async()=>{
  const storage=new MemoryStorage();
  const firstStore=PlayerData.createStore({storage});
  const first=await firstStore.load();

  await firstStore.save({...first,nyanCoins:25,onlineWins:2});

  const secondStore=PlayerData.createStore({storage});
  const restored=await secondStore.load();

  assert.equal(restored.playerId,first.playerId);
  assert.equal(restored.nyanCoins,25);
  assert.equal(restored.onlineWins,2);
});

test("既存のサウンド設定を変更しない",async()=>{
  const storage=new MemoryStorage({
    nyanChaseSfx:"off",
    nyanChaseBgm:"on",
    nyanChaseVibration:"off",
    nyanChaseBgmVolume:"64"
  });
  const store=PlayerData.createStore({storage});
  const data=await store.load();

  await store.save({...data,policeMatches:1});

  assert.equal(storage.getItem("nyanChaseSfx"),"off");
  assert.equal(storage.getItem("nyanChaseBgm"),"on");
  assert.equal(storage.getItem("nyanChaseVibration"),"off");
  assert.equal(storage.getItem("nyanChaseBgmVolume"),"64");
});

test("古いデータと欠損フィールドを現行モデルで補完する",async()=>{
  const playerId="ncp_1234567890abcdef";
  const storage=new MemoryStorage({
    [PlayerData.STORAGE_KEYS.playerId]:playerId,
    [PlayerData.STORAGE_KEYS.playerData]:JSON.stringify({
      version:0,
      nyanCoins:9,
      ownedCatSkins:["calico"]
    })
  });
  const store=PlayerData.createStore({storage});
  const data=await store.load();

  assert.equal(data.version,PlayerData.CURRENT_VERSION);
  assert.equal(data.nyanCoins,9);
  assert.deepEqual(data.ownedCatSkins,["default","calico"]);
  assert.deepEqual(data.ownedDogSkins,["default"]);
  assert.equal(data.currentRank,"bronze");
  assert.equal(data.profileCharacter,null);
  assert.equal(data.playerId,playerId);
});

test("破損した保存データから安全な初期値へ復旧する",async()=>{
  const playerId="ncp_abcdef1234567890";
  const storage=new MemoryStorage({
    [PlayerData.STORAGE_KEYS.playerId]:playerId,
    [PlayerData.STORAGE_KEYS.playerData]:"{broken-json"
  });
  const store=PlayerData.createStore({storage});
  const data=await store.load();

  assert.equal(data.playerId,playerId);
  assert.equal(data.nyanCoins,0);
  assert.equal(store.getStatus().source,"recovered");
  assert.doesNotThrow(()=>JSON.parse(storage.getItem(PlayerData.STORAGE_KEYS.playerData)));
});

test("保存先が利用できなくてもメモリ上で動作を継続する",async()=>{
  const storage={
    getItem(){throw new Error("storage_unavailable");},
    setItem(){throw new Error("storage_unavailable");}
  };
  const store=PlayerData.createStore({storage});
  const data=await store.load();
  const saved=await store.save({...data,catMatches:1});

  assert.equal(PlayerData.isValidPlayerId(saved.playerId),true);
  assert.equal(saved.catMatches,1);
  assert.equal(store.getStatus().source,"memory");
});

test("サーバー接続失敗時はキャッシュを返し、入力値で上書きしない",async()=>{
  const playerId="ncp_0011223344556677";
  const cached=PlayerData.createDefaultData(playerId);
  cached.nyanCoins=10;
  const storage=new MemoryStorage({
    [PlayerData.STORAGE_KEYS.playerId]:playerId,
    [PlayerData.STORAGE_KEYS.playerData]:JSON.stringify(cached)
  });
  const remoteProvider={
    async load(){throw new Error("offline");},
    async save(){throw new Error("offline");}
  };
  const store=PlayerData.createStore({storage,remoteProvider});
  const loaded=await store.load();
  const result=await store.save({...loaded,nyanCoins:999});

  assert.equal(loaded.nyanCoins,10);
  assert.equal(result.nyanCoins,10);
  assert.equal(JSON.parse(storage.getItem(PlayerData.STORAGE_KEYS.playerData)).nyanCoins,10);
  assert.equal(store.getStatus().source,"local-cache");
});

test("サーバー導入時はサーバー応答を正としてキャッシュする",async()=>{
  const storage=new MemoryStorage();
  const remoteProvider={
    async load(playerId){
      return {...PlayerData.createDefaultData(playerId),nyanCoins:50};
    },
    async save(playerId){
      return {...PlayerData.createDefaultData(playerId),nyanCoins:45};
    }
  };
  const store=PlayerData.createStore({storage,remoteProvider});
  const loaded=await store.load();
  const saved=await store.save({...loaded,nyanCoins:999});

  assert.equal(loaded.nyanCoins,50);
  assert.equal(saved.nyanCoins,45);
  assert.equal(JSON.parse(storage.getItem(PlayerData.STORAGE_KEYS.playerData)).nyanCoins,45);
  assert.equal(store.getStatus().source,"server");
});

test("装備更新でもremoteProviderの応答を正とする",async()=>{
  const storage=new MemoryStorage();
  const remoteProvider={
    async load(playerId){
      return {
        ...PlayerData.createDefaultData(playerId),
        nyanCoins:40,
        ownedCatSkins:["default","server-cat"]
      };
    },
    async save(playerId){
      return {
        ...PlayerData.createDefaultData(playerId),
        nyanCoins:41,
        ownedCatSkins:["default","server-cat"],
        equippedAppearance:{
          ...PlayerData.createDefaultData(playerId).equippedAppearance,
          catSkinId:"default"
        }
      };
    }
  };
  const store=PlayerData.createStore({storage,remoteProvider});
  await store.load();
  const saved=await store.updateEquipment("catSkin","server-cat");

  assert.equal(saved.equippedAppearance.catSkinId,"default");
  assert.equal(saved.nyanCoins,41);
  assert.equal(store.getStatus().source,"server");
});

test("ホーム推しキャラは装備と独立して保存・復元する",async()=>{
  const storage=new MemoryStorage();
  const store=PlayerData.createStore({storage});
  const initial=await store.load();
  await store.save({...initial,ownedCatSkins:["default","cat_kaitou"]});
  const saved=await store.updateFavoriteCharacter("catSkin","cat_kaitou");

  assert.deepEqual(saved.favoriteCharacter,{category:"catSkin",itemId:"cat_kaitou"});
  assert.equal(saved.equippedAppearance.catSkinId,"default");
  assert.equal(saved.nyanCoins,0);

  const restored=await PlayerData.createStore({storage}).load();
  assert.deepEqual(restored.favoriteCharacter,{category:"catSkin",itemId:"cat_kaitou"});
});

test("ホーム推しキャラを解除してもコイン・装備・他データを変えない",async()=>{
  const storage=new MemoryStorage();
  const store=PlayerData.createStore({storage});
  const initial=await store.load();
  await store.save({
    ...initial,
    nyanCoins:23,
    ownedCatSkins:["default","cat_kaitou"],
    favoriteCharacter:{category:"catSkin",itemId:"cat_kaitou"},
    challengeProgress:{kept:true}
  });
  const saved=await store.updateFavoriteCharacter("catSkin",null);
  assert.equal(saved.favoriteCharacter,null);
  assert.equal(saved.nyanCoins,23);
  assert.equal(saved.equippedAppearance.catSkinId,"default");
  assert.deepEqual(saved.challengeProgress,{kept:true});
  assert.equal((await PlayerData.createStore({storage}).load()).favoriteCharacter,null);
});

test("未所持・非キャラカテゴリのホーム推し設定を拒否する",async()=>{
  const store=PlayerData.createStore({storage:new MemoryStorage()});
  await store.load();
  await assert.rejects(store.updateFavoriteCharacter("catSkin","cat_kaitou"),/favorite_item_not_owned/);
  await assert.rejects(store.updateFavoriteCharacter("boardTheme","default"),/invalid_favorite_category/);
});

test("古いデータの不正なホーム推し設定を安全に解除する",()=>{
  const playerId="ncp_favoritebad1234";
  const normalized=PlayerData.normalizeData({
    version:1,
    ownedDogSkins:["default"],
    favoriteCharacter:{category:"dogSkin",itemId:"dog_detective"}
  },playerId);
  assert.equal(normalized.favoriteCharacter,null);
  assert.equal(normalized.version,PlayerData.CURRENT_VERSION);
});

test("ホーム推し更新でもremoteProviderの応答を正とする",async()=>{
  const storage=new MemoryStorage();
  const remoteProvider={
    async load(playerId){
      return {...PlayerData.createDefaultData(playerId),ownedDogSkins:["default","dog_detective"]};
    },
    async save(playerId){
      return {...PlayerData.createDefaultData(playerId),ownedDogSkins:["default","dog_detective"],favoriteCharacter:null};
    }
  };
  const store=PlayerData.createStore({storage,remoteProvider});
  await store.load();
  const saved=await store.updateFavoriteCharacter("dogSkin","dog_detective");
  assert.equal(saved.favoriteCharacter,null);
  assert.equal(store.getStatus().source,"server");
});

test("プロフィール設定は装備・ホーム・コインと独立して保存する",async()=>{
  const storage=new MemoryStorage();
  const store=PlayerData.createStore({storage});
  const initial=await store.load();
  await store.save({
    ...initial,
    nyanCoins:17,
    ownedCatSkins:["default","cat_kaitou"],
    favoriteCharacter:{category:"catSkin",itemId:"cat_kaitou"}
  });

  const saved=await store.updateProfileCharacter("catSkin","cat_kaitou");
  assert.deepEqual(saved.profileCharacter,{category:"catSkin",itemId:"cat_kaitou"});
  assert.equal(saved.equippedAppearance.catSkinId,"default");
  assert.deepEqual(saved.favoriteCharacter,{category:"catSkin",itemId:"cat_kaitou"});
  assert.equal(saved.nyanCoins,17);

  const restored=await PlayerData.createStore({storage}).load();
  assert.deepEqual(restored.profileCharacter,{category:"catSkin",itemId:"cat_kaitou"});
});

test("プロフィール設定を解除してもコイン・装備・ホームを変えない",async()=>{
  const storage=new MemoryStorage();
  const store=PlayerData.createStore({storage});
  const initial=await store.load();
  await store.save({
    ...initial,
    nyanCoins:29,
    ownedDogSkins:["default","dog_detective"],
    favoriteCharacter:{category:"dogSkin",itemId:"dog_detective"},
    profileCharacter:{category:"dogSkin",itemId:"dog_detective"}
  });
  const saved=await store.updateProfileCharacter("dogSkin",null);
  assert.equal(saved.profileCharacter,null);
  assert.equal(saved.nyanCoins,29);
  assert.equal(saved.equippedAppearance.dogSkinId,"default");
  assert.deepEqual(saved.favoriteCharacter,{category:"dogSkin",itemId:"dog_detective"});
});

test("未所持・非キャラカテゴリのプロフィール設定を拒否する",async()=>{
  const store=PlayerData.createStore({storage:new MemoryStorage()});
  await store.load();
  await assert.rejects(store.updateProfileCharacter("dogSkin","dog_detective"),/profile_item_not_owned/);
  await assert.rejects(store.updateProfileCharacter("paw","default"),/invalid_profile_category/);
});

test("古いデータの不正なプロフィール設定を安全に解除する",()=>{
  const playerId="ncp_profilebad12345";
  const normalized=PlayerData.normalizeData({
    version:2,
    ownedCatSkins:["default"],
    profileCharacter:{category:"catSkin",itemId:"cat_kaitou"}
  },playerId);
  assert.equal(normalized.profileCharacter,null);
  assert.equal(normalized.version,PlayerData.CURRENT_VERSION);
});

test("プロフィール更新でもremoteProviderの応答を正とする",async()=>{
  const storage=new MemoryStorage();
  const remoteProvider={
    async load(playerId){
      return {...PlayerData.createDefaultData(playerId),ownedDogSkins:["default","dog_detective"]};
    },
    async save(playerId){
      return {
        ...PlayerData.createDefaultData(playerId),
        ownedDogSkins:["default","dog_detective"],
        profileCharacter:null
      };
    }
  };
  const store=PlayerData.createStore({storage,remoteProvider});
  await store.load();
  const saved=await store.updateProfileCharacter("dogSkin","dog_detective");
  assert.equal(saved.profileCharacter,null);
  assert.equal(store.getStatus().source,"server");
});
