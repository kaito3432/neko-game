const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const AI=require('../police-hard-ai.js');
test('強警察は探索済み・同ターン予約済みの箱を再探索しない',()=>{
  const state={turn:5,dogs:[14,15,20],revealedTracks:[[6,3]],searchedBoxes:[6,7,8],reservedSearchTargets:[12],emptyByTurn:[],lastDogNodes:[null,null,null]};
  for(let dog=0;dog<3;dog++){const action=AI.chooseAction(state,dog);if(action?.type==='search')assert.ok(!new Set([6,7,8,12]).has(action.target));}
});
test('新しい足跡と経過ターンから現在到達可能な箱だけを候補にする',()=>{
  const candidates=AI.inferCandidates({turn:5,revealedTracks:[[12,4]],emptyByTurn:[]});
  assert.deepEqual([...candidates].sort((a,b)=>a-b),[7,11,13,17]);
});
test('3匹は同じ探索先を予約せず、終盤は候補を監視する',()=>{
  const state={turn:10,dogs:[14,15,20],revealedTracks:[[7,8],[8,9]],searchedBoxes:[7,8],reservedSearchTargets:[],emptyByTurn:[],lastDogNodes:[13,16,19]};
  const first=AI.chooseDogAction(state,[0,1,2]);assert.ok(first);
  if(first.action.type==='search')state.reservedSearchTargets=[first.action.target];
  const second=AI.chooseDogAction(state,[0,1,2].filter(i=>i!==first.dogIndex));assert.ok(second);
  if(first.action.type==='search'&&second.action.type==='search')assert.notEqual(first.action.target,second.action.target);
});
test('非公開の猫現在位置を入力しても判断は変化しない',()=>{
  const state={turn:7,dogs:[14,15,20],revealedTracks:[[6,4]],searchedBoxes:[6],reservedSearchTargets:[],emptyByTurn:[],lastDogNodes:[13,16,19]};
  assert.deepEqual(AI.chooseDogAction({...state,catPos:0},[0,1,2]),AI.chooseDogAction({...state,catPos:24},[0,1,2]));
});
test('専用AIはhard選択時だけ呼ばれ、通常・弱CPU分岐を維持する',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
  assert.match(source,/if\(cpuDifficulty==="hard" && window\.NyanPoliceHardAI\)/);
  assert.match(source,/if\(cpuDifficulty!=="hard" && policeDifficulty!=="easy"/);
});
