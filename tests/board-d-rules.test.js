const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const engineSource=fs.readFileSync(path.join(root,'engine.js'),'utf8');
function loadEngine(maxTurns){
  const source=maxTurns===undefined?engineSource:engineSource.replace(
    /maxTurns:9/,`maxTurns:${maxTurns}`);
  const context={window:{}};
  vm.runInNewContext(source,context);
  return context.window.NyanEngine;
}

test('D盤面は1・25を全経路から除外し、5×5の配置を保つ',()=>{
  const E=loadEngine();
  assert.equal(E.BOX_COUNT,25);
  assert.equal(E.ACTIVE_BOXES.length,23);
  assert.deepEqual([...E.BLOCKED_BOXES],[0,24]);
  for(const blocked of E.BLOCKED_BOXES){
    assert.equal(E.isValidBox(blocked),false);
    assert.deepEqual([...E.getBoxNeighbors(blocked)],[]);
    assert.equal(E.ACTIVE_BOXES.includes(blocked),false);
  }
  for(let box=0;box<E.BOX_COUNT;box++){
    assert.ok(E.getBoxNeighbors(box).every(E.isValidBox));
  }
  for(let node=0;node<E.NODE_COUNT;node++){
    assert.ok(E.getBoxesAroundNode(node).every(E.isValidBox));
  }
  const state=E.createState();state.catPos=1;
  assert.equal(E.getCatLegalMoves(state).includes(0),false);
  state.catPos=23;
  assert.equal(E.getCatLegalMoves(state).includes(24),false);
});

test('9T正式値と10T切替は同じ完走・行き止まり計算を使う',()=>{
  const route=[20,21,22,23,18,17,16,15,10,5];
  for(const maxTurns of [9,10]){
    const E=loadEngine(maxTurns);
    assert.equal(E.MAX_TURNS,maxTurns);
    const state=E.createState();
    state.catPos=route[maxTurns-2];
    state.turn=maxTurns;
    state.catHistory=new Map(route.slice(0,maxTurns-1).map((box,i)=>[box,i+1]));
    assert.ok(E.getCatLegalMoves(state).includes(route[maxTurns-1]));
    assert.equal(E.canCatFinishFrom(state,route[maxTurns-1]),true);
    assert.equal(E.isCatDeadEnd(state,route[maxTurns-1]),false);
    assert.equal(E.canCatFinishFrom(state,0),false);
    assert.equal(E.canCatFinishFrom(state,24),false);
  }
});

test('強警察と通常CPUの探索候補に封鎖箱を含めない',()=>{
  const AI=require('../police-hard-ai.js');
  const possible=AI.inferCandidates({turn:1,revealedTracks:[]});
  const probabilities=AI.probabilityMap({turn:1,revealedTracks:[],searchedBoxes:[]});
  for(const blocked of [0,24]){
    assert.equal(possible.has(blocked),false);
    assert.equal(probabilities.has(blocked),false);
  }
  const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
  assert.match(game,/for\(const b of E\.ACTIVE_BOXES\)/);
  assert.match(game,/function cpuChooseStartBox\(\)[\s\S]*?for\(const b of E\.ACTIVE_BOXES\)/);
  assert.match(game,/if\(game\.gameOver\|\|game\.actionLocked\|\|!E\.isValidBox\(i\)\)return/);
});

test('オンライン検証は5×6全30箱を使い、13Tで逃走を確定する',async()=>{
  const {acceptRandomAction:accept}=await import('../server/random-game-validation.mjs');
  const {ONLINE_ENGINE:E}=await import('../server/online-board-rule.mjs');
  const room={};
  assert.deepEqual([E.BOX_COUNT,E.NODE_COUNT,E.MAX_TURNS,E.BLOCKED_BOXES.length],[30,42,13,0]);
  assert.equal(accept(room,'police',{type:'dogSetup',dogs:[7,8,9]}),true);
  assert.equal(accept(room,'cat',{type:'catSetup',catPos:30}),false);
  assert.equal(accept(room,'cat',{type:'catSetup',catPos:-1}),false);
  assert.equal(accept(room,'cat',{type:'catSetup',catPos:0}),true);
  assert.equal(accept(room,'police',{type:'search',dogIndex:0,box:30}),false);
  assert.equal(accept(room,'cat',{type:'catEscaped'}),false);
  const route=[0,1,2,3,4,9,8,7,6,5,10,11,12];
  for(let turn=1;turn<=E.MAX_TURNS;turn++){
    const state=room.validationState;
    for(let dogIndex=0;dogIndex<3;dogIndex++){
      const node=E.getDogLegalMoves(state,dogIndex)[0];
      assert.ok(Number.isInteger(node));
      assert.equal(accept(room,'police',{type:'dogMove',dogIndex,node}),true);
    }
    assert.equal(accept(room,'police',{type:'dogTurnEnd'}),true);
    if(turn<E.MAX_TURNS){
      assert.equal(accept(room,'cat',{type:'catMove',turn:turn+1,catPos:30}),false);
      assert.equal(accept(room,'cat',{type:'catMove',turn:turn+1,catPos:route[turn]}),true);
    }
  }
  assert.equal(room.validationState.phase,'escaped');
  assert.equal(accept(room,'cat',{type:'catEscaped'}),true);
});

test('表示用封鎖セルはボタンでなく、ターン文言はengine設定に追従する',()=>{
  const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const worker=fs.readFileSync(path.join(root,'server/worker.mjs'),'utf8');
  assert.match(game,/document\.createElement\(active\?"button":"div"\)/);
  assert.match(game,/b\.dataset\.blockedBox=String\(i\+1\)/);
  assert.match(game,/document\.querySelectorAll\('\[data-max-turns\]'\)/);
  assert.match(html,/data-max-turns/);
  assert.doesNotMatch(game,/11ターン/);
  assert.match(worker,/room\.secretCat\?\.turn < E\.MAX_TURNS/);
  assert.doesNotMatch(worker,/turn > 11|catPos >= 25|box >= 25/);
});
