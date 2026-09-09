// Local test identities only; no live Worker or user save data.
const assert=require('node:assert/strict');
const API=process.env.NYAN_LOCAL_API||'http://127.0.0.1:8810';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(API))throw Error('Local only');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function actor(){
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')};
 const call=async(path,body,expected=200)=>{const response=await fetch(API+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});assert.equal(response.status,expected,await response.clone().text());return response.json();};
 await call('/api/online/register',{});return {call};
}
async function connect(s){
 const ws=new WebSocket(`${API.replace('http','ws')}/api/rooms/${s.roomCode}/ws?token=${s.token}`),messages=[];
 ws.onmessage=e=>messages.push(JSON.parse(e.data));await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 const timer=setInterval(()=>{if(ws.readyState===1)ws.send('{"type":"ping"}');},2000);ws.addEventListener('close',()=>clearInterval(timer));
 const wait=async pred=>{for(let i=0;i<220;i++){const m=messages.find(pred);if(m)return m;await pause(100);}throw Error('timeout '+JSON.stringify(messages.slice(-3)));};
 return {ws,wait};
}
(async()=>{
 for(const mode of ['room','random'])for(const leave of ['host','guest','connecting']){
  const a=await actor(),b=await actor();let as,bs;
  if(mode==='random'){await a.call('/api/matchmaking/join',{});bs=await b.call('/api/matchmaking/join',{});as=await a.call('/api/matchmaking/status',{});}
  else{as=await a.call('/api/rooms',{});bs={...await b.call(`/api/rooms/${as.roomCode}/join`,{}),roomCode:as.roomCode};}
  const aw=await connect(as),bw=leave==='connecting'?null:await connect(bs);
  try{
   if(bw){await aw.wait(m=>m.type==='role');await bw.wait(m=>m.type==='role');(leave==='host'?aw:bw).ws.close();}
   else aw.ws.close();
   const waitActor=leave==='host'?b:a;
   let result;
   for(let i=0;i<50;i++){result=await waitActor.call(`/api/rooms/${as.roomCode}/resume`,{});if(result.status==='cancelled')break;await pause(100);}
   assert.equal(result.status,'cancelled');assert.equal(result.result.finishReason,'abortedBeforeStart');assert.equal(result.hasStarted,false);
   assert.equal(result.result.winner,undefined);assert.equal(result.result.loser,undefined);
   for(const p of [a,b])assert.equal((await p.call('/api/online/profile')).profile.disconnectStats.totalDisconnectForfeits,0);
   if(mode==='random'){
    await a.call('/api/matchmaking/result',{matchId:as.matchId},409);
    assert.equal((await a.call('/api/matchmaking/status',{})).completedReceipt,undefined);
    assert.equal((await a.call('/api/matchmaking/join',{})).status,'waiting');await a.call('/api/matchmaking/cancel',{});
   }
  }finally{aw.ws.close();bw?.ws.close();}
 }
 console.log('PASS preGame Worker: room/random × host/guest/connecting cancellation, no winner/history/result receipt, queue reusable');
})().catch(e=>{console.error(e);process.exitCode=1;});
