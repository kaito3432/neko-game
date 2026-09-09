const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Visual=require('../online-appearance.js');
const own=(dog='default')=>({playerId:'A',ownedCatSkins:['default'],ownedDogSkins:['default','dog_detective'],equippedAppearance:{catSkinId:'default',dogSkinId:dog}});
async function transport(){
 const events=[];
 class Socket{static OPEN=1;constructor(){this.readyState=1;this.events={};Socket.last=this;}addEventListener(k,fn){this.events[k]=fn;}close(){}send(){}emit(data){this.events.message({data:JSON.stringify(data)});}}
 const ctx={WebSocket:Socket,URL,AbortController,console,JSON,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask:()=>{},
  localStorage:{setItem(){}},dispatchEvent:e=>events.push(e),
  NyanOnlineAppearance:Visual,NyanOnlineIdentity:{prepare:async()=>({profile:own(),headers:{}})},
  fetch:async url=>({ok:!url.endsWith('/profile'),status:url.endsWith('/profile')?401:200,json:async()=>({status:'cancelled'})})};
 ctx.window=ctx;vm.runInNewContext(fs.readFileSync(require.resolve('../online.js'),'utf8'),ctx);
 await ctx.NyanOnline.prepareIdentity();
 return {api:ctx.NyanOnline,Socket,events};
}
const role=(matchId='m1',dog='dog_detective')=>({type:'role',matchId,matchType:'randomMatch',player:'host',role:'police',playerId:'A',participants:{host:'A',guest:'B'},profile:own(dog),
 appearanceSnapshot:{catPlayer:{playerId:'B',catSkinId:'cat_kaitou'},policePlayer:{playerId:'A',dogSkinId:dog}}});
async function enter(t,id){t.api.useReservation({matchId:id,roomCode:id,token:'ticket',player:'host'});await t.api.createRoom();t.api.connect();}
test('古いdefaultキャッシュでも試合のサーバープロフィールで探偵しばと相手猫を表示',async()=>{
 const t=await transport();await enter(t,'m1');t.Socket.last.emit(role());
 assert.equal(t.api.resolveAppearance('dogSkin').id,'dog_detective');assert.equal(t.api.resolveAppearance('catSkin').id,'cat_kaitou');
});
test('snapshot未取得はpending、後から届いたsnapshotで再描画通知',async()=>{
 const t=await transport();await enter(t,'m1');t.Socket.last.emit({...role(),appearanceSnapshot:null});
 assert.equal(t.api.resolveAppearance('dogSkin').status,'pending');const before=t.events.length;
 t.Socket.last.emit(role());assert.equal(t.api.resolveAppearance('dogSkin').id,'dog_detective');
 assert.ok(t.events.slice(before).some(e=>e.type==='nyan-online-appearance-changed'));
});
test('探偵しば→次試合default、旧socket通知では上書きしない',async()=>{
 const t=await transport();await enter(t,'m1');const old=t.Socket.last;old.emit(role());
 await enter(t,'m2');assert.equal(t.api.resolveAppearance('dogSkin').status,'pending');
 t.Socket.last.emit(role('m2','default'));old.emit(role());
 assert.equal(t.api.resolveAppearance('dogSkin').id,'default');
});
