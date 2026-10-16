const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../game.js'),'utf8');
function setup({active,connected=false}={}){
 const calls=[],classes=new Set(),listeners={};
 const classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(){}};
 const ctx={AbortController,console,setTimeout:()=>1,clearTimeout(){},
   onlineOverlay:{classList},createOnlineRoomBtn:{disabled:true,click(){throw Error('recovery must not dispatch a click');}},
   onlineStatus:{},onlineIsHost:false,onlineRoomMatched:true,
   resetOnlineState(){calls.push('reset');ctx.onlineRoomMatched=false;},
   document:{documentElement:{classList},body:{classList},visibilityState:'visible',addEventListener:(name,fn)=>listeners[name]=fn},
   NyanOnlineRecoveryState:{hasCandidate:()=>true},
   NyanOnline:{getSession:()=>({connected,matchType:'roomMatch'}),activeMatch:async()=>active,
     useReservation:value=>calls.push(['reserve',value.matchId]),
     createRoom:async()=>{calls.push('connect');return {roomCode:'123456',player:'guest'};},
     connect:callbacks=>{calls.push('socket');ctx.callbacks=callbacks;}},
   addEventListener:(name,fn)=>listeners[name]=fn};
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('async function connectOnlineRoom(){'),source.indexOf('bindPress(createOnlineRoomBtn,()=>{')),ctx);
 vm.runInContext(source.slice(source.indexOf('let bootRecoveryRunning=false;'),source.indexOf('queueMicrotask(resumeOnLaunch);')),ctx);
 return {ctx,calls,listeners};
}
test('クリック禁止中・作成ボタン無効でも、進行中の試合へ直接再接続する',async()=>{
 const {ctx,calls}=setup({active:{matchId:'m1',ticket:'resume-ticket'}});
 await ctx.resumeOnLaunch();
 assert.deepEqual(calls,['reset',['reserve','m1'],'connect','socket']);
 assert.equal(ctx.onlineIsHost,false);assert.ok(ctx.callbacks.onGame);
});
test('回線復帰イベントから、画面を開き直さず再接続する',async()=>{
 const {calls,listeners}=setup({active:{matchId:'m2'}});
 await listeners.online();assert.ok(calls.includes('socket'));
});
test('決着済み結果が処理された場合、新規部屋やsocketを作らない',async()=>{
 const {ctx,calls}=setup({active:{status:'finished',handled:true}});
 await ctx.resumeOnLaunch();assert.deepEqual(calls,[]);
 assert.match(source,/d\.recoveredResult&&d\.status==='finished'/);
});
test('接続中の通常画面では二重接続しない',async()=>{
 const {ctx,calls}=setup({connected:true});await ctx.resumeOnLaunch();assert.deepEqual(calls,[]);
});
