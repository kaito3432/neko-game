// Local only. Uses real WebSockets and server wall-clock deadlines.
const assert=require('node:assert/strict');
const API='http://127.0.0.1:8808',pause=ms=>new Promise(r=>setTimeout(r,ms));
const sockets=[];
async function actor(){
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')};
 const call=async(path,body)=>{const r=await fetch(API+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,200,await r.clone().text());return r.json();};
 await call('/api/online/register',{});return {headers,call};
}
async function socket(s){
 const ws=new WebSocket(`${API.replace('http','ws')}/api/rooms/${s.roomCode}/ws?token=${s.token}${s.ticket?'&ticket='+s.ticket:''}`),messages=[];
 ws.onmessage=e=>messages.push(JSON.parse(e.data));sockets.push(ws);
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 const interval=setInterval(()=>{if(ws.readyState===1)ws.send('{"type":"ping"}');},2000);ws.addEventListener('close',()=>clearInterval(interval));
 const wait=async fn=>{for(let n=0;n<600;n++){const m=messages.find(fn);if(m)return m;await pause(40);}throw Error('timeout '+JSON.stringify(messages));};
 return {ws,messages,wait,send:p=>ws.send(JSON.stringify({type:'game',payload:p}))};
}
async function pair(random=false){
 const a=await actor(),b=await actor();let as,bs;
 if(random){await a.call('/api/matchmaking/join',{});bs=await b.call('/api/matchmaking/join',{});as=await a.call('/api/matchmaking/status',{});}
 else{as=await a.call('/api/rooms',{});bs={...await b.call(`/api/rooms/${as.roomCode}/join`,{}),roomCode:as.roomCode};}
 const ac=await socket(as),bc=await socket(bs);const ar=await ac.wait(m=>m.type==='role');await bc.wait(m=>m.type==='role');
 ac.send({type:'ruleSelect',rule:'normal'});await bc.wait(m=>m.payload?.type==='ruleSelect');ac.send({type:'ready'});bc.send({type:'ready'});await ac.wait(m=>m.payload?.type==='ready');
 return {a,b,as,bs,ac,bc,ar};
}
(async()=>{try{
 for(const delay of [4500,10000]){
  const p=await pair();p.ac.ws.close();await p.bc.wait(m=>m.type==='connectionState'&&m.status==='reconnecting');
  await pause(delay);const restored=await p.a.call(`/api/rooms/${p.as.roomCode}/resume`,{});assert.equal(restored.matchId,p.ar.matchId);
  const fresh=await socket(restored);const recovery=await fresh.wait(m=>m.type==='recovery');assert.equal(recovery.matchId,p.ar.matchId);assert.equal(recovery.status,'matched');
  assert.deepEqual(recovery.appearanceSnapshot,p.ar.appearanceSnapshot);
  fresh.ws.close();p.bc.ws.close();
 }
 const p=await pair();p.ac.ws.close();const ended=await p.bc.wait(m=>m.type==='matchFinished');assert.equal(ended.finishReason,'disconnectForfeit');assert.equal(ended.loser,'host');
 const profile=await p.a.call('/api/online/profile');assert.equal(profile.profile.disconnectStats.totalDisconnectForfeits,1);
 const wrong=await fetch(API+`/api/rooms/${p.as.roomCode}/resume`,{method:'POST',headers:p.b.headers,body:'{}'});assert.equal(wrong.status,200); // own seat only
 const outsider=await actor();const rejected=await fetch(API+`/api/rooms/${p.as.roomCode}/resume`,{method:'POST',headers:outsider.headers,body:'{}'});assert.equal(rejected.status,401);
 const both=await pair();both.ac.ws.close();both.bc.ws.close();await pause(16500);const invalid=await both.a.call(`/api/rooms/${both.as.roomCode}/resume`,{});assert.equal(invalid.status,'invalid');
 assert.equal((await both.a.call('/api/online/profile')).profile.disconnectStats.totalDisconnectForfeits,0);
 const random=await pair(true);random.ac.ws.close();await random.bc.wait(m=>m.type==='matchFinished');
 const receipt=await random.b.call('/api/matchmaking/result',{matchId:random.ar.matchId});assert.equal(receipt.won,true);
 const Player=require('../player-data.js'),values=new Map(),store=Player.createStore({storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}});await store.load();
 global.NyanOnline={verifyResult:()=>random.b.call('/api/matchmaking/result',{matchId:random.ar.matchId})};
 await store.recordDailyMissionBattle(receipt);await store.recordDailyMissionBattle(receipt);
 assert.equal(store.getSnapshot().dailyMissionProgress.missions.find(m=>m.id==='playOneBattle').progress,1);
 assert.equal(store.getSnapshot().battleReceipts.length,1);assert.equal(store.getSnapshot().nyanCoins,0);
 assert.equal((await random.a.call('/api/online/profile')).profile.disconnectStats.totalDisconnectForfeits,1);
 console.log('PASS local WS: 5s/10s resume, frozen snapshot, 15s forfeit/stats, outsider rejected, both absent invalid');
}finally{for(const ws of sockets)ws.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
