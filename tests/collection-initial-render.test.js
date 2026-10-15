const test=require('node:test'),assert=require('node:assert/strict');
const Collection=require('../collection.js'),PlayerData=require('../player-data.js');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture({cache=true}={}){
 let snapshot=cache?PlayerData.createDefaultData('ncp_1234567890abcdef'):null,t=0,requests=0;
 const initial=PlayerData.createDefaultData('ncp_1234567890abcdef'),sync=deferred(),renders=[],timings=[];
 const playerData={getSnapshot:()=>snapshot,load:async()=>initial,save:async data=>(snapshot=data)};
 const controller=Collection.createController({playerData,view:{render:state=>renders.push(state.data)},
  synchronize:()=>{requests++;return sync.promise;},now:()=>t,onTiming:(stage,ms)=>timings.push({stage,ms})});
 return {controller,initial,sync,renders,timings,requests:()=>requests,advance:ms=>{t=ms;},setSnapshot:value=>{snapshot=value;}};
}
test('cached collection renders synchronously, before a slow server sync',async()=>{
 const f=fixture(),pending=f.controller.load();assert.equal(f.renders.length,1);
 assert.deepEqual(f.timings,[{stage:'open',ms:0},{stage:'local-render',ms:0}]);
 await Promise.resolve();assert.equal(f.requests(),1);
 f.advance(4000);const verified={...f.initial,nyanCoins:12};f.setSnapshot(verified);f.sync.resolve();await pending;
 assert.equal(f.renders.at(-1).nyanCoins,12);assert.deepEqual(f.timings.at(-1),{stage:'sync-complete',ms:4000});
});
test('cold open renders loaded local data without waiting for server',async()=>{
 const f=fixture({cache:false}),pending=f.controller.load();await Promise.resolve();
 assert.equal(f.renders.length,1);assert.equal(f.renders[0],f.initial);assert.equal(f.requests(),1);
 f.sync.resolve();await pending;
});
test('re-entrant updates share one sync and a later reopen can sync again',async()=>{
 const f=fixture(),first=f.controller.load(),second=f.controller.load();assert.equal(first,second);
 await Promise.resolve();assert.equal(f.requests(),1);f.sync.resolve();await first;
 await f.controller.load();assert.equal(f.requests(),2);
});
test('offline sync keeps local display and never grants purchases or coins',async()=>{
 const f=fixture(),pending=f.controller.load();f.sync.reject(Error('offline'));await pending;
 assert.equal(f.controller.getState().data.nyanCoins,0);assert.equal(f.timings.at(-1).stage,'sync-failed');
 assert.deepEqual(f.controller.getState().data.ownedCatSkins,['default']);
});
