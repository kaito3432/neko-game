const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../game.js'),'utf8');
function search(){
 const calls=[],game={dogs:[1,2,3],dogAction:[],selectedDog:0,phase:'dogs'},ctx={game,playMode:'onlinePolice',
   board:{},motionStatus:{},E:{DOGS:[{label:'柴',name:'犬'}]},setMessage(){},render(){},
   Skins:{showBoardEffect(){},effectSource(){}},playerAppearance(){},
   A:{animateSniff(...args){calls.push('dog-icon');ctx.done=args.at(-1);}},
   NyanOnline:{getSession:()=>({matchId:'m1'}),isPaused:()=>false,sendGame:payload=>calls.push(payload.type)}};
 ctx.window=ctx;vm.createContext(ctx);
 const start=source.indexOf('  function performSearch(di,bi){'),end=source.indexOf('\n  function afterDogAction()',start);
 vm.runInContext(source.slice(start,end),ctx);ctx.performSearch(0,4);
 return {ctx,calls};
}
test('オンライン探索は犬アイコンの完了後にリクエストし、結果POPの先行を防ぐ',()=>{
 const {ctx,calls}=search();assert.deepEqual(calls,['dog-icon']);assert.equal(ctx.game.actionLocked,true);
 ctx.done();assert.deepEqual(calls,['dog-icon','search']);
});
test('探索演出中の復帰・試合切替・切断後には古いアクションを送らない',()=>{
 for(const change of [c=>c.game={},c=>c.playMode='local',c=>c.NyanOnline.isPaused=()=>true,
   c=>c.NyanOnline.getSession=()=>({matchId:'m2'}),c=>c.game.gameOver=true]){
   const {ctx,calls}=search();change(ctx);ctx.done();assert.deepEqual(calls,['dog-icon']);
 }
});
test('復帰リザルトの猫ルートとスキル答え合わせを盤面へ復元する',()=>{
 const ctx={E:{isValidBox:b=>b>=0&&b<30},ONLINE_BOARD_RULE_ID:'challenge_5x6',
   selectBoardRule:id=>{ctx.rule=id;},cpuCatRoute:[],game:{},saveResultRouteSkills:s=>{ctx.skills=s;}};
 vm.createContext(ctx);
 const start=source.indexOf('  function restoreOnlineResultRoute('),end=source.indexOf('\n  function endGame(',start);
 vm.runInContext(source.slice(start,end),ctx);
 ctx.restoreOnlineResultRoute({route:[{box:9,turn:2},{box:3,turn:1}],routeSkills:{sneakBoxes:[3],fakeTracks:[{box:8,turn:2}]}});
 assert.equal(ctx.rule,'challenge_5x6');assert.equal(ctx.cpuCatRoute[0].box,3);assert.equal(ctx.game.catPos,9);
 assert.equal(ctx.game.catHistory.get(9),2);assert.equal(ctx.game.noTrackBoxes.has(3),true);
 assert.equal(ctx.game.fakeTracks.get(8),2);
});
