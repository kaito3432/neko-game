const test=require('node:test'),assert=require('node:assert/strict');
const mod=import('../server/reconnection.mjs');
const room=()=>({status:'playing',started:true,matchId:'rm_test',roles:{host:'police',guest:'cat'},profiles:{host:{playerId:'A'},guest:{playerId:'B'}},appearanceSnapshot:{catPlayer:{playerId:'B',catSkinId:'cat_kaitou'}},secretCat:{pos:9,history:[{box:9,turn:1}],noTrackBoxes:[3],fakeTracks:[]},selectedDog:1});
for(const delay of [5000,10000,14000])test(`${delay}ms復帰は同じ試合・スキンを維持`,async()=>{
 const {disconnected,reconnected,deadlineResult}=await mod,r=room(),before=structuredClone(r.appearanceSnapshot);
 disconnected(r,'host',100);assert.equal(r.status,'reconnecting');assert.equal(deadlineResult(r,100+delay),null);
 assert.ok(reconnected(r,'host',100+delay));assert.equal(r.status,'playing');assert.equal(r.matchId,'rm_test');assert.deepEqual(r.appearanceSnapshot,before);
});
test('15秒ちょうどで敗北・再接続で延長不可',async()=>{
 const {disconnected,reconnected,deadlineResult}=await mod,r=room();disconnected(r,'host',100);disconnected(r,'host',9000);
 assert.equal(r.disconnects.host.deadline,15100);assert.equal(reconnected(r,'host',15100),false);
 assert.deepEqual(deadlineResult(r,15100),{status:'finished',finishReason:'disconnectForfeit',loser:'host',winner:'cat',completedAt:15100});
});
test('双方切断→双方復帰',async()=>{
 const {disconnected,reconnected,deadlineResult}=await mod,r=room();disconnected(r,'host',0);disconnected(r,'guest',100);
 assert.ok(reconnected(r,'host',5000));assert.equal(r.status,'reconnecting');assert.ok(reconnected(r,'guest',6000));assert.equal(deadlineResult(r,16000),null);
});
test('双方切断→片方復帰、他方の期限まで待つ',async()=>{
 const {disconnected,reconnected,deadlineResult}=await mod,r=room();disconnected(r,'host',0);disconnected(r,'guest',1000);reconnected(r,'host',14000);
 assert.equal(deadlineResult(r,15000),null);assert.equal(deadlineResult(r,16000).loser,'guest');
});
test('双方復帰なしは無効・勝者も敗者もなし',async()=>{
 const {disconnected,deadlineResult}=await mod,r=room();disconnected(r,'host',0);disconnected(r,'guest',1000);
 assert.equal(deadlineResult(r,15000),null);const result=deadlineResult(r,16000);assert.equal(result.finishReason,'serverInvalid');assert.equal(result.winner,undefined);assert.equal(result.loser,undefined);
});
test('警察復元snapshotは秘密情報をallowlistで除外、選択犬は復元',async()=>{
 const {publicRecovery}=await mod,r=room();r.validationState={catPos:9,catHistory:new Map([[9,1]]),secretCandidate:8};
 const police=publicRecovery(r,'host'),cat=publicRecovery(r,'guest');
 for(const k of ['catPos','catHistory','fakeTracks','noTrackBoxes','secretCandidate'])assert.equal(k in police.state,false);
 assert.equal(cat.state.catPos,9);assert.equal(police.state.selectedDog,1);
});
test('正常終了後のcloseでは切断記録を開始しない',async()=>{
 const {disconnected}=await mod,r=room();r.status='finished';disconnected(r,'host',0);assert.equal(r.disconnects,undefined);
});
test('サーバー障害は勝敗・切断敗者を生成しない',async()=>{
 const {serverInvalid}=await mod,r=room();const result=serverInvalid(r,100);
 assert.equal(result.status,'invalid');assert.equal(result.winner,undefined);assert.equal(result.loser,undefined);
 r.status='finished';assert.equal(serverInvalid(r,200),null);
});
