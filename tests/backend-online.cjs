/* Defaults to isolated Wrangler. Production requires explicit operator opt-in. */
const assert=require('node:assert/strict');
const API=process.env.NYAN_PRODUCTION_SMOKE==='yes'?'https://nyan-chase-online.honda19990602.workers.dev':'http://127.0.0.1:8798';
const sockets=[];
async function checkDaily(actor,receipt){
  const Player=require('../player-data.js');const data=new Map();
  const store=Player.createStore({storage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}});await store.load();
  global.NyanOnline={verifyResult:()=>actor.call('/api/matchmaking/result',{matchId:receipt.battleId})};
  try{
    await store.recordDailyMissionBattle(receipt);await store.recordDailyMissionBattle(receipt);
    const saved=store.getSnapshot(),progress=id=>saved.dailyMissionProgress.missions.find(m=>m.id===id).progress;
    assert.equal(progress('playOneBattle'),1);
    assert.equal(progress('winAsCat'),receipt.won&&receipt.side==='cat'?1:0);
    assert.equal(progress('winAsPolice'),receipt.won&&receipt.side==='police'?1:0);
    assert.equal(saved.battleReceipts.length,1);assert.equal(saved.nyanCoins,0);
  }finally{delete global.NyanOnline;}
}
async function actor(cat,dog){
  const secret=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const headers={'Content-Type':'application/json',Authorization:`Bearer ${secret}`};
  const call=async(path,body={})=>{
    const response=await fetch(API+path,{method:'POST',headers,body:JSON.stringify(body)});
    assert.equal(response.status,200,`${path}: ${await response.clone().text()}`);return response.json();
  };
  await call('/api/online/register',{ownedCatSkins:cat?['cat_kaitou']:[],ownedDogSkins:dog?['dog_detective']:[],equippedAppearance:{catSkinId:cat?'cat_kaitou':'default',dogSkinId:dog?'dog_detective':'default'}});
  return {call,headers};
}
async function connect(session){
  const ws=new WebSocket(`${API.replace('http','ws')}/api/rooms/${session.roomCode}/ws?token=${session.token}`);
  const messages=[];ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));sockets.push(ws);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  const wait=async predicate=>{for(let i=0;i<100;i++){const value=messages.find(predicate);if(value)return value;await new Promise(r=>setTimeout(r,30));}throw Error('message timeout '+JSON.stringify(messages));};
  return {ws,messages,wait,send:payload=>ws.send(JSON.stringify({type:'game',payload}))};
}
(async()=>{
  try{
    const a=await actor(true,true),b=await actor(true,true);
    assert.equal((await a.call('/api/matchmaking/join')).status,'waiting');
    const bs=await b.call('/api/matchmaking/join');const as=await a.call('/api/matchmaking/status');
    assert.equal(as.matchId,bs.matchId);assert.notEqual(as.role,bs.role);
    const ac=await connect(as),bc=await connect(bs);
    const ar=await ac.wait(m=>m.type==='role'),br=await bc.wait(m=>m.type==='role');
    const host=as.player==='host'?ac:bc,guest=host===ac?bc:ac;
    guest.send({type:'ruleSelect',rule:'ability'});
    host.send({type:'ruleSelect',rule:'normal'});await guest.wait(m=>m.payload?.type==='ruleSelect'&&m.payload.rule==='normal');
    ac.send({type:'ready'});bc.send({type:'ready'});await ac.wait(m=>m.payload?.type==='ready');await bc.wait(m=>m.payload?.type==='ready');
    assert.deepEqual(ar.appearanceSnapshot,br.appearanceSnapshot);
    assert.equal(ar.appearanceSnapshot.catPlayer.catSkinId,'cat_kaitou');
    assert.equal(ar.appearanceSnapshot.policePlayer.dogSkinId,'dog_detective');
    await a.call('/api/online/appearance',{equippedAppearance:{catSkinId:'default',dogSkinId:'default'}});
    assert.equal((await a.call('/api/matchmaking/cancel')).matchId,as.matchId);
    const cat=as.role==='cat'?ac:bc,police=as.role==='police'?ac:bc;
    police.send({type:'dogSetup',dogs:[14,15,21]});await cat.wait(m=>m.payload?.type==='dogSetup');
    cat.send({type:'catSetup',catPos:12});await cat.wait(m=>m.payload?.type==='catSetupAccepted');
    assert.equal((await a.call('/api/matchmaking/status')).status,'playing');
    police.send({type:'search',box:12,dogIndex:0});
    await cat.wait(m=>m.type==='matchFinished');await police.wait(m=>m.type==='matchFinished');
    const ra=await a.call('/api/matchmaking/result',{matchId:as.matchId});
    const rb=await b.call('/api/matchmaking/result',{matchId:as.matchId});
    assert.notEqual(ra.won,rb.won);assert.equal(ra.side,as.role);
    await checkDaily(a,ra);await checkDaily(b,rb);
    assert.equal((await a.call('/api/matchmaking/join')).status,'waiting');
    await a.call('/api/matchmaking/cancel');
    // Complete all 11 turns using the existing normal rules, not a client win claim.
    await a.call('/api/matchmaking/join');const nextB=await b.call('/api/matchmaking/join');const nextA=await a.call('/api/matchmaking/status');
    const na=await connect(nextA),nb=await connect(nextB);
    await na.wait(m=>m.type==='role');await nb.wait(m=>m.type==='role');
    const nh=nextA.player==='host'?na:nb,ng=nh===na?nb:na;
    nh.send({type:'ruleSelect',rule:'normal'});await ng.wait(m=>m.payload?.type==='ruleSelect');
    na.send({type:'ready'});nb.send({type:'ready'});await na.wait(m=>m.payload?.type==='ready');await nb.wait(m=>m.payload?.type==='ready');
    const nc=nextA.role==='cat'?na:nb,np=nextA.role==='police'?na:nb;
    np.send({type:'dogSetup',dogs:[7,8,9]});await nc.wait(m=>m.payload?.type==='dogSetup');
    nc.send({type:'catSetup',catPos:20});await nc.wait(m=>m.payload?.type==='catSetupAccepted');
    nc.send({type:'catEscaped',turn:11});
    assert.equal((await a.call('/api/matchmaking/status')).status,'playing','early victory rejected');
    const route=[20,21,22,23,24,19,18,17,16,15,10];
    for(let turn=1;turn<=11;turn++){
      for(let dogIndex=0;dogIndex<3;dogIndex++)np.send({type:'search',dogIndex,box:dogIndex});
      np.send({type:'dogTurnEnd',turn});await nc.wait(m=>m.payload?.type==='dogTurnEnd'&&m.payload.turn===turn);
      if(turn<11){nc.send({type:'catMove',catPos:route[turn],turn:turn+1});await np.wait(m=>m.payload?.type==='catMoveDone'&&m.payload.turn===turn+1);}
    }
    nc.send({type:'catEscaped',turn:11});await nc.wait(m=>m.type==='matchFinished');
    assert.equal((await a.call('/api/matchmaking/result',{matchId:nextA.matchId})).won,nextA.role==='cat');
    await checkDaily(a,await a.call('/api/matchmaking/result',{matchId:nextA.matchId}));
    await checkDaily(b,await b.call('/api/matchmaking/result',{matchId:nextA.matchId}));
    const c=await actor(true,false),d=await actor(false,true);
    const room=await c.call('/api/rooms');const joined=await d.call(`/api/rooms/${room.roomCode}/join`);
    const cc=await connect(room),dc=await connect({...joined,roomCode:room.roomCode});
    const cr=await cc.wait(m=>m.type==='role'),dr=await dc.wait(m=>m.type==='role');
    assert.equal(cr.matchType,'roomMatch');assert.deepEqual(cr.appearanceSnapshot,dr.appearanceSnapshot);
    assert.equal(cr.appearanceSnapshot.catPlayer.catSkinId,cr.role==='cat'?'cat_kaitou':'default');
    assert.equal(cr.appearanceSnapshot.policePlayer.dogSkinId,dr.role==='police'?'dog_detective':'default');
    console.log('PASS: authenticated profiles, matching, roles, snapshots, live WebSocket capture and 11-turn escape, forged early win rejected, finished receipts, repeat queue, existing rooms');
  }finally{for(const ws of sockets)ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
