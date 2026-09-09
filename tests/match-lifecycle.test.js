const test=require('node:test'),assert=require('node:assert/strict');
const mods=Promise.all([import('../server/match-lifecycle.mjs'),import('../server/reconnection.mjs'),import('../server/turn-clock.mjs')]);
const room=()=>({hasStarted:false,status:'matched',roles:{host:'police',guest:'cat'},rule:'normal',ready:{host:true,guest:true}});
test('双方接続・ルール・ready完了時、初期配置からplayingを一度だけ作成',async()=>{
 const [{startIfReady},,{syncTurnClock}]=await mods,r=room();
 assert.equal(startIfReady(r,['host'],100),false);assert.equal(startIfReady(r,['host','guest'],200),true);
 assert.equal(r.matchStartedAt,200);assert.equal(r.validationState.phase,'dogSetup');
 syncTurnClock(r,200);assert.equal(r.turnClock.deadlines.host,60200);
 r.validationState.dogs[0]=14;assert.equal(startIfReady(r,['host','guest'],500),false);assert.equal(r.validationState.dogs[0],14);
});
for(const seat of ['host','guest'])test(`preGame ${seat}切断は直ちに中止・勝敗なし`,async()=>{
 const [, {disconnected,deadlineResult}]=await mods,r=room();
 disconnected(r,seat,100);const result=deadlineResult(r,100);
 assert.equal(result.status,'cancelled');assert.equal(result.finishReason,'abortedBeforeStart');
 assert.equal(result.winner,undefined);assert.equal(result.loser,undefined);
});
test('役割未定の接続確認中も中止できる',async()=>{
 const [, {disconnected,deadlineResult}]=await mods,r={hasStarted:false,status:'waiting'};
 disconnected(r,'host',0);assert.equal(deadlineResult(r,0).status,'cancelled');
});
test('明示hasStarted=falseを古いstarted/readyで上書きしない',async()=>{
 const [{hasStarted}]=await mods,r=room();r.started=true;assert.equal(hasStarted(r),false);
 delete r.hasStarted;assert.equal(hasStarted(r),true);
});
test('特殊ルールは両能力の準備完了まで開始しない',async()=>{
 const [{startIfReady}]=await mods,r=room();r.rule='ability';assert.equal(startIfReady(r,['host','guest']),false);
 r.abilities={cat:'sneak',police:'dash'};assert.equal(startIfReady(r,['host','guest']),true);
});
