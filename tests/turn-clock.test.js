const test=require('node:test'),assert=require('node:assert/strict');
const modules=Promise.all([import('../server/turn-clock.mjs'),import('../server/reconnection.mjs')]);
const make=()=>({status:'matched',roles:{host:'police',guest:'cat'},matchType:'randomMatch'});
test('ホストルール選択はサーバー時刻から60秒',async()=>{
 const [{syncTurnClock,turnTimeout}]=await modules,r=make();syncTurnClock(r,100);
 assert.equal(r.turnClock.deadlines.host,60100);assert.equal(turnTimeout(r,60099),null);
 assert.equal(turnTimeout(r,60100).finishReason,'turnTimeout');assert.equal(turnTimeout(r,60100).winner,'cat');
});
for(const phase of ['dogSetup','catSetup','cat','dogs'])test(`${phase}開始に60秒・操作でリセットしない`,async()=>{
 const [{syncTurnClock}]=await modules,r=make();Object.assign(r,{rule:'normal',ready:{host:true,guest:true},validationState:{phase,turn:1}});
 syncTurnClock(r,1000);const clock=structuredClone(r.turnClock);syncTurnClock(r,59000);assert.deepEqual(r.turnClock,clock);
 const seat=['catSetup','cat'].includes(phase)?'guest':'host';assert.equal(r.turnClock.deadlines[seat],61000);
 r.validationState.turn=2;syncTurnClock(r,70000);assert.equal(r.turnClock.deadlines[seat],130000);
});
test('15秒猶予を優先し、復帰しても60秒期限は変えない',async()=>{
 const [{syncTurnClock,turnTimeout},{disconnected,reconnected,deadlineResult}]=await modules,r=make();syncTurnClock(r,0);
 disconnected(r,'host',55000);assert.equal(turnTimeout(r,61000),null);assert.equal(deadlineResult(r,61000),null);
 reconnected(r,'host',62000);syncTurnClock(r,62000);assert.equal(r.turnClock.deadlines.host,60000);assert.equal(turnTimeout(r,62000).loser,'host');
});
test('終了後にtimeoutを二重生成しない',async()=>{
 const [{syncTurnClock,turnTimeout}]=await modules,r=make();syncTurnClock(r,0);r.status='finished';assert.equal(turnTimeout(r,90000),null);
});
test('準備済み側の表示期限を消し、相手の期限は延長しない',async()=>{
 const [{syncTurnClock,turnTimeout}]=await modules,r=make();r.rule='normal';syncTurnClock(r,0);
 r.ready={host:true};syncTurnClock(r,20000);
 assert.deepEqual(r.turnClock.deadlines,{guest:60000});
 assert.equal(turnTimeout(r,60000).loser,'guest');
});
