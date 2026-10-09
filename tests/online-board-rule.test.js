const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,name),'utf8');
const context={window:{}};
vm.runInNewContext(source('engine.js'),context);
const client=context.window.NyanEngine.createForRule('challenge_5x6');

test('Online client and Worker use the same 5×6・13T rule',async()=>{
  const {ONLINE_BOARD_RULE_ID,ONLINE_ENGINE:server}=await import('../server/online-board-rule.mjs');
  assert.equal(ONLINE_BOARD_RULE_ID,'challenge_5x6');
  assert.deepEqual(
    [client.BOX_ROWS,client.BOX_COLS,client.BOX_COUNT,client.NODE_COUNT,client.MAX_TURNS,client.RULE.policeCount,client.BLOCKED_BOXES.length],
    [server.BOX_ROWS,server.BOX_COLS,server.BOX_COUNT,server.NODE_COUNT,server.MAX_TURNS,server.RULE.policeCount,server.BLOCKED_BOXES.length]
  );
  assert.deepEqual([server.BOX_ROWS,server.BOX_COLS,server.BOX_COUNT,server.NODE_COUNT,server.MAX_TURNS,server.RULE.policeCount,server.BLOCKED_BOXES.length],[6,5,30,42,13,3,0]);
  assert.equal(server.isValidBox(29),true);
  assert.equal(server.isValidBox(30),false);
  assert.equal(server.isActiveDogNode(34),true);
  assert.equal(server.isActiveDogNode(42),false);
});

test('Online entry, start, and recovery select the fixed rule without a board picker',()=>{
  const game=source('game.js'),html=source('index.html');
  assert.match(game,/const ONLINE_BOARD_RULE_ID="challenge_5x6"/);
  assert.match(game,/bindPress\(onlineModeBtn,\(\)=>\{\s*selectBoardRule\(ONLINE_BOARD_RULE_ID\)/);
  assert.match(game,/function startOnlineGame\(\)\{[\s\S]*?selectBoardRule\(ONLINE_BOARD_RULE_ID\)/);
  assert.match(game,/window\.addEventListener\('nyan-online-recovery',[\s\S]*?selectBoardRule\(ONLINE_BOARD_RULE_ID\);\s*onlineGameStarted=true/);
  assert.doesNotMatch(html,/id="online(?:Standard|Challenge)BoardBtn"/);
  assert.match(game,/currentTurn>=E\.MAX_TURNS-2/);
  assert.equal(client.MAX_TURNS-2,11);
});

test('Room, Random, validation and recovery retain the Online rule ID',async()=>{
  const worker=source('server/worker.mjs'),validation=source('server/random-game-validation.mjs');
  const lifecycle=source('server/match-lifecycle.mjs');
  assert.match(worker,/matchType: 'randomMatch', boardRuleId:ONLINE_BOARD_RULE_ID/);
  assert.match(worker,/matchType: 'roomMatch',boardRuleId:ONLINE_BOARD_RULE_ID/);
  assert.match(worker,/E\.isActiveDogNode\(n\)/);
  assert.match(worker,/node >= E\.NODE_COUNT/);
  assert.match(worker,/E\.getBoxesAroundNode\(node\)/);
  assert.match(validation,/const E=ONLINE_ENGINE/);
  assert.match(lifecycle,/room\.validationState=ONLINE_ENGINE\.createState\(\)/);
  const {publicRecovery}=await import('../server/reconnection.mjs');
  const recovery=publicRecovery({matchType:'roomMatch',roles:{host:'police',guest:'cat'},profiles:{},ready:{}},'host');
  assert.equal(recovery.boardRuleId,'challenge_5x6');
});

test('Online validation accepts edge box 29 and rejects out-of-range box/node/turn',async()=>{
  const {acceptRandomAction:accept}=await import('../server/random-game-validation.mjs');
  const room={};
  assert.equal(accept(room,'police',{type:'dogSetup',dogs:[31,32,42]}),false);
  assert.equal(accept(room,'police',{type:'dogSetup',dogs:[31,32,34]}),true);
  assert.equal(accept(room,'cat',{type:'catSetup',catPos:30}),false);
  assert.equal(accept(room,'cat',{type:'catSetup',catPos:29}),true);
  assert.equal(accept(room,'police',{type:'dogMove',dogIndex:0,node:42}),false);
  assert.equal(accept(room,'police',{type:'search',dogIndex:2,box:30}),false);
  assert.equal(accept(room,'police',{type:'search',dogIndex:2,box:29}),true);
  assert.equal(accept(room,'police',{type:'search',dogIndex:0,box:25}),true);
  assert.equal(accept(room,'police',{type:'search',dogIndex:1,box:26}),true);
  assert.equal(accept(room,'police',{type:'dogTurnEnd'}),true);
  assert.equal(accept(room,'cat',{type:'catMove',turn:14,catPos:28}),false);
});
