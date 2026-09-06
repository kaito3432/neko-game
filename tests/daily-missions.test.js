"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Model=require("../progression-model.js");
const Player=require("../player-data.js");
const Daily=require("../daily-missions.js");
const Collection=require("../collection.js");
const Catalog=require("../collection-catalog.js");
const TODAY=Date.parse("2026-09-06T12:00:00+09:00");
class Storage{
  values=new Map(); failKey=null;
  getItem(key){return this.values.get(key) ?? null;}
  setItem(key,value){if(key===this.failKey) throw new Error("disk_full");this.values.set(key,String(value));}
}
const battle=(id,overrides={})=>({battleId:`battle_test_${id}`,source:"cpu",side:"cat",won:true,completed:true,completedAt:TODAY,difficulty:"hard",...overrides});
const mission=(data,id)=>data.dailyMissionProgress.missions.find(m=>m.id===id);
async function setup(options={}){
  const storage=new Storage();
  const store=Player.createStore({storage,now:()=>TODAY,...options});
  await store.load();
  return {storage,store};
}
test("CPU完了で対戦1/1、猫勝利だけ加算し、報酬は自動付与しない",async()=>{
  const {store}=await setup();
  const data=await store.recordDailyMissionBattle(battle(1));
  assert.equal(mission(data,"playOneBattle").progress,1);
  assert.equal(mission(data,"winAsCat").progress,1);
  assert.equal(mission(data,"winAsPolice").progress,0);
  assert.equal(data.nyanCoins,0);
});
test("警察勝利は警察進捗、敗北は対戦数だけを加算",async()=>{
  const {store}=await setup();
  await store.recordDailyMissionBattle(battle(1,{side:"police"}));
  const data=await store.recordDailyMissionBattle(battle(2,{side:"police",won:false}));
  assert.equal(mission(data,"winAsPolice").progress,1);
  assert.equal(mission(data,"winAsCat").progress,0);
});
test("local/roomMatchと未完了試合は対象外、randomMatchはサーバー検証が必須",async()=>{
  const {store}=await setup();
  for(const source of ["local","roomMatch"]) await store.recordDailyMissionBattle(battle(source,{source}));
  await assert.rejects(store.recordDailyMissionBattle(battle('random',{source:'randomMatch'})),/online_result_verifier_unavailable/);
  await assert.rejects(store.recordDailyMissionBattle(battle(2,{completed:false})),/battle_not_completed/);
  assert.deepEqual(store.getSnapshot().battleReceipts,[]);
  assert.equal(mission(store.getSnapshot(),"playOneBattle").progress,0);
});
test("同じ試合IDの連打・再起動後の再送を一回にする",async()=>{
  const {store,storage}=await setup();
  await Promise.all([store.recordDailyMissionBattle(battle(1)),store.recordDailyMissionBattle(battle(1))]);
  const restored=Player.createStore({storage,now:()=>TODAY});await restored.load();
  const data=await restored.recordDailyMissionBattle(battle(1));
  assert.equal(mission(data,"winAsCat").progress,1);
  assert.equal(data.skinUnlockProgress.cat_kaitou,1);
});
test("報酬10/20/20は手動受取、同時連打も合計50だけ",async()=>{
  const {store}=await setup();
  for(let n=0;n<6;n++) await store.recordDailyMissionBattle(battle(n,{side:n<3 ? "cat" : "police"}));
  assert.equal(store.getSnapshot().nyanCoins,0);
  await Promise.all(Model.MISSIONS.flatMap(m=>[store.claimDailyReward("2026-09-06",m.id),store.claimDailyReward("2026-09-06",m.id)]));
  assert.equal(store.getSnapshot().nyanCoins,50);
  assert.ok(store.getSnapshot().dailyMissionProgress.missions.every(m=>m.claimed));
});
test("未達成と日付の違う受取を拒否",async()=>{
  const {store}=await setup();
  await assert.rejects(store.claimDailyReward("2026-09-06","winAsCat"),/mission_not_completed/);
  await store.recordDailyMissionBattle(battle(1));
  await assert.rejects(store.claimDailyReward("2026-09-05","playOneBattle"),/daily_date_changed/);
  assert.equal(store.getSnapshot().nyanCoins,0);
});
test("JST0時リセット、翌日は再受取可能、時計を戻して再受取できない",async()=>{
  let clock=Date.parse("2026-09-06T23:59:59+09:00");
  const {store}=await setup({now:()=>clock});
  await store.recordDailyMissionBattle(battle(1,{completedAt:clock}));
  await store.claimDailyReward("2026-09-06","playOneBattle");
  clock+=1000;
  const next=await store.refreshDailyMissions();
  assert.equal(next.dailyMissionProgress.date,"2026-09-07");
  assert.ok(next.dailyMissionProgress.missions.every(m=>m.progress===0 && !m.claimed));
  await store.recordDailyMissionBattle(battle(2,{completedAt:clock}));
  await store.claimDailyReward("2026-09-07","playOneBattle");
  assert.equal(store.getSnapshot().nyanCoins,20);
  clock-=86400000;
  assert.equal((await store.refreshDailyMissions()).dailyMissionProgress.date,"2026-09-07");
  await assert.rejects(store.claimDailyReward("2026-09-06","playOneBattle"),/daily_date_changed/);
});
test("再送が翌日にずれても前日の勝利を当日のデイリーに加算しない",async()=>{
  const {store}=await setup({now:()=>TODAY+86400000});
  const data=await store.recordDailyMissionBattle(battle(1));
  assert.equal(data.dailyMissionProgress.date,"2026-09-07");
  assert.equal(mission(data,"playOneBattle").progress,0);
  assert.equal(data.skinUnlockProgress.cat_kaitou,1);
});
for(const [side,id,field] of [["cat","cat_kaitou","ownedCatSkins"],["police","dog_detective","ownedDogSkins"]]){
  test(`${side}・つよい10勝で${id}開放、再起動しても一度だけ所持`,async()=>{
    const {store,storage}=await setup();
    for(let i=0;i<9;i++) await store.recordDailyMissionBattle(battle(i,{side}));
    assert.equal(store.getSnapshot()[field].includes(id),false);
    for(let i=9;i<12;i++) await store.recordDailyMissionBattle(battle(i,{side}));
    const data=await Player.createStore({storage}).load();
    assert.equal(data.skinUnlockProgress[id],10);
    assert.equal(data[field].filter(item=>item===id).length,1);
    const reset=await store.save({...data,skinUnlockProgress:{}});
    assert.ok(reset[field].includes(id));
  });
}
test("やさしい/ふつう/敗北は開放進捗に加算しない",async()=>{
  const {store}=await setup();
  await store.recordDailyMissionBattle(battle(1,{difficulty:"easy"}));
  await store.recordDailyMissionBattle(battle(2,{difficulty:"normal"}));
  const data=await store.recordDailyMissionBattle(battle(3,{won:false}));
  assert.equal(data.skinUnlockProgress.cat_kaitou,0);
  assert.equal(mission(data,"winAsCat").progress,2);
});
test("報酬保存失敗でコインを付与せず、再試行で一度だけ受取",async()=>{
  const {store,storage}=await setup();
  await store.recordDailyMissionBattle(battle(1));
  storage.failKey=Player.STORAGE_KEYS.playerData;
  await assert.rejects(store.claimDailyReward("2026-09-06","playOneBattle"),/disk_full/);
  assert.equal(store.getSnapshot().nyanCoins,0);
  assert.equal(mission(store.getSnapshot(),"playOneBattle").claimed,false);
  storage.failKey=null;
  await store.claimDailyReward("2026-09-06","playOneBattle");
  assert.equal(store.getSnapshot().nyanCoins,10);
});
test("進捗保存失敗後も完了試合が再送キューに残り、再起動後に復旧",async()=>{
  const {store,storage}=await setup();
  storage.failKey=Player.STORAGE_KEYS.playerData;
  await assert.rejects(store.recordDailyMissionBattle(battle(1)),/disk_full/);
  assert.equal(JSON.parse(storage.getItem(Player.STORAGE_KEYS.pendingBattles)).length,1);
  storage.failKey=null;
  const restored=Player.createStore({storage,now:()=>TODAY});await restored.load();await restored.retryPendingBattles();
  assert.equal(mission(restored.getSnapshot(),"winAsCat").progress,1);
  assert.deepEqual(JSON.parse(storage.getItem(Player.STORAGE_KEYS.pendingBattles)),[]);
});
test("サーバー利用時は意図だけ送信し、応答を正とする。クライアント計算で付与しない",async()=>{
  const commands=[];
  const server=Player.createDefaultData("ncp_server0000000001");
  server.nyanCoins=77;
  const provider={async load(){return server;},
    async recordDailyMissionBattle(id,payload){commands.push(payload);return {...server,battleReceipts:[payload.battleId]};},
    async claimDailyReward(id,payload){commands.push(payload);return {...server,nyanCoins:88};}
  };
  const {store}=await setup({remoteProvider:provider});
  await store.recordDailyMissionBattle(battle(1));
  assert.equal(store.getSnapshot().skinUnlockProgress.cat_kaitou,0);
  await store.claimDailyReward("2026-09-06","playOneBattle");
  assert.equal(store.getSnapshot().nyanCoins,88);
  assert.equal(commands[1].requestId,"daily:2026-09-06:playOneBattle");
  assert.equal("nyanCoins" in commands[1],false);
});
test("remote未対応・通信失敗でもlocal報酬へフォールバックしない",async()=>{
  const {store}=await setup({remoteProvider:{async load(id){return Player.createDefaultData(id);}}});
  await assert.rejects(store.claimDailyReward("2026-09-06","playOneBattle"),/progress_provider_unavailable/);
  await assert.rejects(store.recordDailyMissionBattle(battle(1)),/progress_provider_unavailable/);
  assert.equal(store.getSnapshot().nyanCoins,0);
});
test("報酬受取と装備保存が競合してもコイン・装備を両方保存",async()=>{
  const {store}=await setup();await store.recordDailyMissionBattle(battle(1));
  await Promise.all([store.claimDailyReward("2026-09-06","playOneBattle"),store.updateEquipment("catSkin","default")]);
  assert.equal(store.getSnapshot().nyanCoins,10);
  assert.equal(store.getSnapshot().equippedAppearance.catSkinId,"default");
});
test("v3移行で既存資産・進捗・選択・統計を保持し不足項目を補う",()=>{
  const old={...Player.createDefaultData("ncp_old000000000001"),version:3,nyanCoins:55,ownedCatSkins:["default","future-cat"],favoriteCharacter:{category:"catSkin",itemId:"future-cat"},onlineWins:9,disconnectCount:4,challengeProgress:{kept:true}};
  delete old.skinUnlockProgress;delete old.battleReceipts;
  old.dailyMissionProgress={date:null,missions:[]};
  const migrated=Player.migrateData(old,old.playerId);
  assert.equal(migrated.version,Player.CURRENT_VERSION);
  for(const key of ["nyanCoins","ownedCatSkins","favoriteCharacter","onlineWins","disconnectCount","challengeProgress"]) assert.deepEqual(migrated[key],old[key]);
  assert.equal(migrated.dailyMissionProgress.missions.length,3);
});
test("勝敗確定で保存開始、広告の成功/在庫/SDK/結果画面呼出しは不要",async()=>{
  const {store,storage}=await setup();
  const tracker=Daily.createTracker(store,{now:()=>TODAY});
  const session=tracker.beginBattle("cpuPolice","hard");
  const saving=tracker.finishBattle(session,"cat");
  assert.equal(JSON.parse(storage.getItem(Player.STORAGE_KEYS.pendingBattles)).length,1,"journal precedes any ad callback");
  // No result/ad callback ever arrives (no fill, SDK error, app closed after outcome).
  await saving;await tracker.finishBattle(session,"cat");
  const restored=await Player.createStore({storage}).load();
  assert.equal(mission(restored,"winAsCat").progress,1);
  assert.equal(tracker.result(session.battleId).status,"saved");
});
test("途中離脱は保存せず、CPU側の名称をプレイヤー側と取り違えない",async()=>{
  const {store}=await setup();const tracker=Daily.createTracker(store,{now:()=>TODAY});
  tracker.beginBattle("cpuCat","hard");
  assert.deepEqual(store.getSnapshot().battleReceipts,[]);
  await tracker.finishBattle(tracker.beginBattle("cpuCat","hard"),"dogs");
  assert.equal(mission(store.getSnapshot(),"winAsPolice").progress,1);
  for(const mode of ["local","onlineCat","onlinePolice"]) await tracker.finishBattle(tracker.beginBattle(mode,"hard"),"dogs");
  assert.equal(store.getSnapshot().battleReceipts.length,1);
});
test("未所持一覧/詳細/プロフィールはlockedだけを選び、素材が無くても元画像へ戻さない",()=>{
  for(const item of Catalog.ITEMS.filter(i=>i.id!=="default")){
    assert.match(Collection.displayImage(item,"unowned"),/_collection_locked\.png$/);
    assert.match(Collection.displayImage(item,"unowned","profile"),/_profile_locked\.png$/);
    assert.equal(Collection.displayImage(item,"owned"),item.collectionImage);
    assert.equal(Collection.displayImage({...item,silhouetteImage:null},"unowned"),"");
    assert.equal(Collection.displayImage({...item,lockedProfileImage:null},"unowned","profile"),"");
  }
});
