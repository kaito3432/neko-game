const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'engine.js'),'utf8'),context);
const standard=context.window.NyanEngine;
const challenge=standard.createForRule('challenge_5x6');

test('サクッと対戦は5×5・9T、じっくり対戦は5×6・13T',()=>{
  assert.equal(standard.RULE.id,'standard_5x5');
  assert.deepEqual([standard.BOX_ROWS,standard.BOX_COLS,standard.BOX_COUNT,standard.NODE_COUNT,standard.MAX_TURNS],[5,5,25,36,9]);
  assert.deepEqual([...standard.BLOCKED_BOXES],[0,24]);
  assert.deepEqual([challenge.BOX_ROWS,challenge.BOX_COLS,challenge.BOX_COUNT,challenge.NODE_COUNT,challenge.MAX_TURNS],[6,5,30,42,13]);
  assert.equal(challenge.RULE.policeCount,3);
  assert.equal(challenge.ACTIVE_BOXES.length,30);
  assert.equal(challenge.BLOCKED_BOXES.length,0);
  assert.equal(challenge.createState().dogs.length,3);
  assert.equal(standard.MAX_TURNS-2,7);
  assert.equal(challenge.MAX_TURNS-2,11);
});

test('5×6の端と交差点、猫の移動・再訪禁止・13T到達可能性',()=>{
  assert.deepEqual([...challenge.getBoxNeighbors(0)],[5,1]);
  assert.deepEqual([...challenge.getBoxNeighbors(29)],[24,28]);
  assert.deepEqual([...challenge.getBoxesAroundNode(41)],[29]);
  assert.equal(challenge.isActiveDogNode(31),true);
  assert.equal(challenge.isActiveDogNode(41),false);
  const state=challenge.createState();
  state.catPos=0;state.catHistory.set(0,1);state.turn=2;
  assert.deepEqual([...challenge.getCatLegalMoves(state)],[5,1]);
  assert.equal(challenge.canCatFinishFrom(state,1),true);
  state.catHistory.set(1,2);
  assert.equal(challenge.getCatLegalMoves(state).includes(1),false);
  state.dogs=[7,8,9];
  assert.ok(challenge.getDogLegalMoves(state,0).every(challenge.isActiveDogNode));
  assert.ok(challenge.getDogDashMoves(state,1).every(challenge.isActiveDogNode));
});

test('強警察AIは5×6・42ノードを使用し、通常AIを変更しない',()=>{
  const AI=require('../police-hard-ai.js').createForEngine(challenge);
  const possible=AI.inferCandidates({turn:1,revealedTracks:[]});
  assert.equal(possible.size,30);
  assert.equal(possible.has(29),true);
  const state={turn:1,dogs:[7,8,9],revealedTracks:[],searchedBoxes:[],reservedSearchTargets:[],emptyByTurn:[],lastDogNodes:[null,null,null]};
  const action=AI.chooseDogAction(state,[0,1,2]);
  assert.ok(action);
  assert.ok(action.action.type==='search'?challenge.isValidBox(action.action.target):challenge.isActiveDogNode(action.action.target));
});

test('5×6はCPU選択だけ、結果・軌跡は選択ルールの行数を参照',()=>{
  const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/id="cpuChallengeBoardBtn"/);
  assert.match(html,/id="cpuStandardBoardBtn"/);
  assert.match(html,/id="localChallengeBoardBtn"/);
  assert.match(game,/bindPress\(\$\("cpuChallengeBoardBtn"\),\(\)=>selectBoardRule\("challenge_5x6"\)\)/);
  assert.match(game,/bindPress\(\$\("localChallengeBoardBtn"\),\(\)=>selectBoardRule\("challenge_5x6"\)\)/);
  assert.match(game,/if\(showMode && selectedBoardRule!=="standard_5x5"\)selectBoardRule\("standard_5x5"\)/);
  assert.match(game,/const routeY=r=>\(r\+\.5\)\*100\/E\.BOX_ROWS/);
  assert.match(game,/n\.style\.top=`\$\{nodeTop\(r\)\}%`/);
});
