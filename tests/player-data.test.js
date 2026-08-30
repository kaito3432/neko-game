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
  assert.equal(storage.getItem(PlayerData.STORAGE_KEYS.playerId),data.playerId);
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
