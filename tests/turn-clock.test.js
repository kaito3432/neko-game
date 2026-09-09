const test=require('node:test'),assert=require('node:assert/strict');
const modules=Promise.all([import('../server/turn-clock.mjs'),import('../server/reconnection.mjs')]);
const make=()=>({status:'matched',roles:{host:'police',guest:'cat'},matchType:'randomMatch'});
test('ホストルール選択は60秒を超えても時計も勝敗もなし',async()=>{
 const [{syncTurnClock,turnTimeout}]=await modules,r=make();syncTurnClock(r,100);
 assert.equal(r.turnClock,undefined);assert.equal(turnTimeout(r,60099),null);assert.equal(turnTimeout(r,3600000),null);
});
for(const phase of ['dogSetup','catSetup','cat','dogs'])test(`${phase}開始に60秒・操作でリセットしない`,async()=>{
 const [{syncTurnClock}]=await modules,r=make();Object.assign(r,{rule:'normal',ready:{host:true,guest:true},validationState:{phase,turn:1}});
 syncTurnClock(r,1000);const clock=structuredClone(r.turnClock);syncTurnClock(r,59000);assert.deepEqual(r.turnClock,clock);
 const seat=['catSetup','cat'].includes(phase)?'guest':'host';assert.equal(r.turnClock.deadlines[seat],61000);
 r.validationState.turn=2;syncTurnClock(r,70000);assert.equal(r.turnClock.deadlines[seat],130000);
});
test('操作本人切断は残時間を保存し15秒猶予を優先する',async()=>{
 const [{syncTurnClock,turnTimeout},{disconnected,reconnected,deadlineResult}]=await modules,r=make();r.hasStarted=true;syncTurnClock(r,0);
 disconnected(r,'host',55000);assert.equal(turnTimeout(r,61000),null);assert.equal(deadlineResult(r,61000),null);
 reconnected(r,'host',62000);syncTurnClock(r,62000);assert.equal(r.turnClock.deadlines.host,67000);assert.equal(turnTimeout(r,62000),null);assert.equal(turnTimeout(r,67000).loser,'host');
});
for(const phase of ['dogSetup','catSetup','cat','dogs'])test(`${phase}:待機側切断は時計を変えず、操作担当だけ停止`,async()=>{
 const [{syncTurnClock,actorState},{disconnected,reconnected}]=await modules,r=make();
 r.hasStarted=true;r.validationState={phase,turn:1};syncTurnClock(r,0);
 const actor=actorState(r).currentActorSeat,peer=actor==='host'?'guest':'host';
 for(const at of [15000,27000]){disconnected(r,peer,at);assert.equal(r.turnClock.pausedRemainingMs,undefined);reconnected(r,peer,at+10000);assert.equal(r.turnClock.deadlines[actor],60000);}
 disconnected(r,actor,40000);assert.equal(r.turnClock.pausedRemainingMs,20000);reconnected(r,actor,50000);assert.equal(r.turnClock.deadlines[actor],70000);
});
test('操作権が不在者へ移ると60秒を保存し元の15秒期限を維持',async()=>{
 const [{syncTurnClock,actorState},{disconnected,reconnected,deadlineResult}]=await modules,r=make();
 r.hasStarted=true;r.validationState={phase:'dogs',turn:1};syncTurnClock(r,0);disconnected(r,'guest',15000);
 r.validationState={phase:'cat',turn:2};syncTurnClock(r,25000);
 assert.equal(actorState(r).actorDisconnected,true);assert.equal(r.disconnects.guest.deadline,30000);assert.equal(r.turnClock.pausedRemainingMs,60000);
 assert.equal(deadlineResult(r,30000).finishReason,'disconnectForfeit');
 reconnected(r,'guest',29000);assert.equal(r.turnClock.deadlines.guest,89000);
});
test('待機側切断中も操作側turnTimeoutは成立',async()=>{
 const [{syncTurnClock,turnTimeout},{disconnected}]=await modules,r=make();r.hasStarted=true;syncTurnClock(r,0);disconnected(r,'guest',55000);
 assert.equal(turnTimeout(r,60000).finishReason,'turnTimeout');
});
test('終了後にtimeoutを二重生成しない',async()=>{
 const [{syncTurnClock,turnTimeout}]=await modules,r=make();syncTurnClock(r,0);r.status='finished';assert.equal(turnTimeout(r,90000),null);
});
test('準備待ちは両者とも期限なし、旧preGame時計も無効化',async()=>{
 const [{syncTurnClock,turnTimeout}]=await modules,r=make();r.rule='normal';syncTurnClock(r,0);
 r.ready={host:true};syncTurnClock(r,20000);
 assert.equal(r.turnClock,undefined);
 r.turnClock={phase:'ready',deadlines:{guest:1}};assert.equal(turnTimeout(r,60000),null);
 syncTurnClock(r,60000);assert.equal(r.turnClock,undefined);
});
