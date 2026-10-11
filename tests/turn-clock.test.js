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
test('操作本人切断中も時間切れ、15秒猶予はターンを延長しない',async()=>{
 const [{syncTurnClock,turnTimeout},{disconnected,lifecycleDeadlineResult}]=await modules,r=make();r.hasStarted=true;syncTurnClock(r,0);
 disconnected(r,'host',50000);assert.equal(turnTimeout(r,60000).loser,'host');
 assert.equal(lifecycleDeadlineResult(r,60000).finishReason,'turnTimeout');
 assert.equal(lifecycleDeadlineResult(r,80000).finishReason,'turnTimeout');
});
for(const phase of ['dogSetup','catSetup','cat','dogs'])test(`${phase}:待機側も操作担当も切断復帰でdeadlineを変えない`,async()=>{
 const [{syncTurnClock,actorState},{disconnected,reconnected}]=await modules,r=make();
 r.hasStarted=true;r.validationState={phase,turn:1};syncTurnClock(r,0);
 const actor=actorState(r).currentActorSeat,peer=actor==='host'?'guest':'host';
 for(const at of [15000,27000]){disconnected(r,peer,at);assert.equal(r.turnClock.pausedRemainingMs,undefined);reconnected(r,peer,at+10000);assert.equal(r.turnClock.deadlines[actor],60000);}
 disconnected(r,actor,40000);assert.equal(r.turnClock.pausedRemainingMs,undefined);reconnected(r,actor,50000);assert.equal(r.turnClock.deadlines[actor],60000);
});
test('操作権が不在者へ移っても60秒deadlineを維持し、元の15秒猶予も維持',async()=>{
 const [{syncTurnClock,actorState},{disconnected,reconnected,deadlineResult}]=await modules,r=make();
 r.hasStarted=true;r.validationState={phase:'dogs',turn:1};syncTurnClock(r,0);disconnected(r,'guest',15000);
 r.validationState={phase:'cat',turn:2};syncTurnClock(r,25000);
 assert.equal(actorState(r).actorDisconnected,true);assert.equal(r.disconnects.guest.deadline,30000);assert.equal(r.turnClock.pausedRemainingMs,undefined);
 assert.equal(deadlineResult(r,30000).finishReason,'disconnectForfeit');
 reconnected(r,'guest',29000);assert.equal(r.turnClock.deadlines.guest,85000);
});
for(const matchType of ['roomMatch','randomMatch'])test(`${matchType}:50秒→10秒切断→40秒、反復切断で延長なし`,async()=>{
 const [{syncTurnClock},{disconnected,reconnected,lifecycleDeadlineResult}]=await modules,r=make();
 r.matchType=matchType;r.hasStarted=true;syncTurnClock(r,0);
 disconnected(r,'host',10000);const grace=r.disconnects.host.deadline;
 disconnected(r,'host',15000);assert.equal(r.disconnects.host.deadline,grace);
 assert.equal(reconnected(r,'host',20000),true);assert.equal(r.turnClock.deadlines.host-20000,40000);
 disconnected(r,'host',22000);reconnected(r,'host',24000);assert.equal(r.turnClock.deadlines.host,60000);
 disconnected(r,'host',50000);assert.equal(lifecycleDeadlineResult(r,60000).finishReason,'turnTimeout');
});
test('ターン期限より先に15秒猶予が切れた場合は既存の切断敗北',async()=>{
 const [{syncTurnClock},{disconnected,reconnected,lifecycleDeadlineResult}]=await modules,r=make();r.hasStarted=true;syncTurnClock(r,0);
 disconnected(r,'host',10000);assert.equal(reconnected(r,'host',25000),false);
 assert.equal(lifecycleDeadlineResult(r,70000).finishReason,'disconnectForfeit');
});
test('旧停止データを再開しても保存済みdeadlineを延長しない',async()=>{
 const [{syncTurnClock}]=await modules,r=make();r.hasStarted=true;syncTurnClock(r,0);
 r.turnClock.pausedRemainingMs=50000;syncTurnClock(r,20000);
 assert.equal(r.turnClock.deadlines.host,60000);assert.equal(r.turnClock.pausedRemainingMs,undefined);
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
