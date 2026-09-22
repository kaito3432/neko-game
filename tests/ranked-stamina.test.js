const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const mod=import('../server/ranked-stamina.mjs');
class Store{values=new Map();async get(k){return structuredClone(this.values.get(k));}async put(k,v){for(const [key,value] of typeof k==='string'?[[k,v]]:Object.entries(k))this.values.set(key,structuredClone(value));}async transaction(fn){return fn(this);}}
const base=(stamina,lastRecoveryAt=0,extra={})=>({playerId:'P',serverNyanCoins:30,rankedStamina:{stamina,lastRecoveryAt,adRecoveryCount:0,adRecoveryDateKey:'2026-09-21',...extra}});

test('60分で1、120分で2回復し最大5で停止',async()=>{
  const {normalizeRankedStamina}=await mod,hour=3600000;
  assert.equal(normalizeRankedStamina(base(2,1000).rankedStamina,1000+hour).stamina,3);
  assert.equal(normalizeRankedStamina(base(2,1000).rankedStamina,1000+2*hour).stamina,4);
  assert.equal(normalizeRankedStamina(base(4,1000).rankedStamina,1000+8*hour).stamina,5);
});

test('保存時刻から再起動・復帰後の自然回復を再計算する',async()=>{
  const {withRankedStamina}=await mod,p=withRankedStamina(base(1,1000),1000+3*3600000);
  assert.equal(p.rankedStamina.stamina,4);assert.equal(p.rankedStamina.lastRecoveryAt,1000+3*3600000);
});

test('正式開始の消費は1、0ならSTAMINA_EMPTY',async()=>{
  const {consumeRankedStamina}=await mod;
  assert.equal(consumeRankedStamina(base(1,1000),2000).rankedStamina.stamina,0);
  assert.throws(()=>consumeRankedStamina(base(0,1000),2000),/STAMINA_EMPTY/);
});

test('スタミナ0はランダム参加不可、待機・キャンセルでは消費しない',async()=>{
  const {matchmaking}=await import('../server/matchmaking.mjs'),storage=new Store(),rooms={};
  const empty=await matchmaking(storage,rooms,base(0,1000),'join',2000);
  assert.deepEqual(empty,{status:'blocked',error:'STAMINA_EMPTY'});
  const profile=base(1,1000),waiting=await matchmaking(storage,rooms,profile,'join',2000);
  assert.equal(waiting.status,'waiting');assert.equal(profile.rankedStamina.stamina,1);
  const cancelled=await matchmaking(storage,rooms,profile,'cancel',3000);
  assert.equal(cancelled.status,'cancelled');assert.equal(profile.rankedStamina.stamina,1);
});

test('コイン15枚で1回復し、14枚・満タンは拒否、自然回復基準は維持',async()=>{
  const {recoverStaminaWithCoins}=await mod;
  const recovered=recoverStaminaWithCoins(base(2,1000),2000);
  assert.equal(recovered.serverNyanCoins,15);assert.equal(recovered.rankedStamina.stamina,3);assert.equal(recovered.rankedStamina.lastRecoveryAt,1000);
  assert.throws(()=>recoverStaminaWithCoins({...base(2,1000),serverNyanCoins:14},2000),/insufficient_coins/);
  assert.throws(()=>recoverStaminaWithCoins(base(5,1000),2000),/STAMINA_FULL/);
});

test('検証済み広告だけ1回復し同一IDは二重回復しない',async()=>{
  const {applyVerifiedStaminaAd}=await mod,storage=new Store(),profileKey='profile:p';await storage.put(profileKey,base(1,1000));
  const args={storage,profileKey,profile:base(1,1000),verificationId:'stamina_ad_001',verification:{mock:true},verify:async()=>true,now:2000};
  const first=await applyVerifiedStaminaAd(args),again=await applyVerifiedStaminaAd({...args,profile:first.profile});
  assert.equal(first.profile.rankedStamina.stamina,2);assert.equal(first.profile.rankedStamina.adRecoveryCount,1);
  assert.equal(again.duplicate,true);assert.equal(again.profile.rankedStamina.stamina,2);
  await assert.rejects(()=>applyVerifiedStaminaAd({...args,verificationId:'stamina_ad_002',verify:async()=>false}),/reward_not_verified/);
});

test('広告は1日5回まで、日付変更後にリセット、満タン時は不可',async()=>{
  const {applyVerifiedStaminaAd}=await mod,storage=new Store(),profileKey='profile:p',now=Date.parse('2026-09-21T12:00:00Z');
  let profile=base(0,now,{adRecoveryCount:0,adRecoveryDateKey:'2026-09-21'});await storage.put(profileKey,profile);
  for(let i=0;i<5;i++){const result=await applyVerifiedStaminaAd({storage,profileKey,profile,verificationId:`stamina_day_${i}`,verification:{},verify:async()=>true,now});profile=result.profile;}
  assert.equal(profile.rankedStamina.adRecoveryCount,5);assert.equal(profile.rankedStamina.stamina,5);
  await assert.rejects(()=>applyVerifiedStaminaAd({storage,profileKey,profile,verificationId:'stamina_day_6',verification:{},verify:async()=>true,now}),/STAMINA_FULL/);
  profile={...profile,rankedStamina:{...profile.rankedStamina,stamina:3}};await storage.put(profileKey,profile);
  await assert.rejects(()=>applyVerifiedStaminaAd({storage,profileKey,profile,verificationId:'stamina_day_7',verification:{},verify:async()=>true,now}),/STAMINA_AD_DAILY_LIMIT/);
  profile={...profile,rankedStamina:{...profile.rankedStamina,lastRecoveryAt:now+86400000}};await storage.put(profileKey,profile);
  const next=await applyVerifiedStaminaAd({storage,profileKey,profile,verificationId:'stamina_next_day',verification:{},verify:async()=>true,now:now+86400000});
  assert.equal(next.profile.rankedStamina.adRecoveryCount,1);
});

test('ランダム正式開始だけサーバーmarkerで冪等消費し部屋・CPU経路を変更しない',()=>{
  const root=path.join(__dirname,'..'),worker=fs.readFileSync(path.join(root,'server/worker.mjs'),'utf8');
  assert.match(worker,/stamina-consumed:\$\{matchId\}:\$\{playerId\}/);
  assert.match(worker,/if\(room\.matchType!==['"]randomMatch['"]\)return \{ok:true\}/);
  assert.match(worker,/authorizeRankedStart\(room\)/);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'game.js'),'utf8'),/consumeRankedStamina/);
});

test('クライアントUIは初期選択画面限定・不足時モーダル・別広告用途を使う',()=>{
  const root=path.join(__dirname,'..'),ui=fs.readFileSync(path.join(root,'ranked-stamina-ui.js'),'utf8'),match=fs.readFileSync(path.join(root,'random-match.js'),'utf8');
  assert.match(ui,/STAMINA_REWARD_TYPE/);assert.match(ui,/15 で1回復/);assert.match(ui,/本日の広告回復/);
  assert.match(match,/setSelectionVisible\?\.\(visible\)/);assert.match(match,/スタミナが足りません/);
});
