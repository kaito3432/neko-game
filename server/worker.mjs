import { DurableObject } from "cloudflare:workers";
import { profileRequest, appearanceSnapshot, publicPlayerProfiles } from './online-profile.mjs';
import { matchmaking, ensureMatchRoom } from './matchmaking.mjs';
import { acceptRandomAction } from './random-game-validation.mjs';
import { sessionEvent } from './session-events.mjs';
import {disconnected,reconnected,deadlineResult,publicRecovery,terminal,serverInvalid} from './reconnection.mjs';
import {syncTurnClock,turnTimeout,actorState} from './turn-clock.mjs';
import {hasStarted,startIfReady} from './match-lifecycle.mjs';
import {applyRankedResult,eligibleRankedResult,masterPeriods,publicRankedProfile} from './ranked-progression.mjs';

const RANK_REWARD_SKINS=Object.freeze({cat_kaitou:'catSkin',dog_detective:'dogSkin'});

export class OnlinePlayers extends DurableObject {
  profileOptions(){return {masterRewardPeriods:this.env.MASTER_REWARD_PERIODS};}
  async applyRankedMatch(match,input){
    if(!eligibleRankedResult(match,input))return match;
    match.rankedResults||={};const periods=masterPeriods(this.env.MASTER_REWARD_PERIODS);
    for(const seat of ['host','guest']){
      if(match.rankedResults[seat])continue;
      const playerId=match[seat]?.playerId,key=await this.ctx.storage.get(`profile-key:${playerId}`);
      if(!key)continue;
      const marker=`ranked:${match.matchId}:${playerId}`;
      const apply=async storage=>{
        const existing=await storage.get(marker);if(existing)return existing;
        const profile=await storage.get(key);if(!profile)return null;
        // completedAt is produced by GameRoom at formal result finalization. Client
        // clocks never choose the season that receives this result.
        const completedAt=Number(input.result.completedAt)||Date.now();
        const applied=applyRankedResult(profile,{matchId:match.matchId,won:match.roles[seat]===input.result.winner,completedAt},periods,RANK_REWARD_SKINS);
        await storage.put(key,applied.profile);await storage.put(marker,applied.receipt);
        return applied.receipt;
      };
      const receipt=typeof this.ctx.storage.transaction==='function'
        ?await this.ctx.storage.transaction(apply):await apply(this.ctx.storage);
      if(receipt)match.rankedResults[seat]=receipt;
    }
    return match;
  }
  async fetch(request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      try {
        const path = new URL(request.url).pathname;
        if(path==='/internal/active'){
          const {playerId,roomCode}=await request.json();
          await this.ctx.storage.put(`active:${playerId}`,{roomCode});return Response.json({ok:true});
        }
        if(path==='/active'){
          const auth=await profileRequest(this.ctx.storage,new Request('https://players/profile',{headers:request.headers}),this.profileOptions());
          if(!auth.ok)return auth;
          const {profile}=await auth.json();
          return Response.json(await this.ctx.storage.get(`active:${profile.playerId}`)||{});
        }
        if (path === '/internal/match-state') {
          const input = await request.json();
          const match = await this.ctx.storage.get(`match:${input.matchId}`);
          if (match && !['finished','cancelled','invalid'].includes(match.status)) {
            match.status = input.status;
            match.hasStarted=input.hasStarted===true;
            if (input.status === 'finished') match.result = input.result;
            await this.applyRankedMatch(match,input);
            await this.ctx.storage.put(`match:${input.matchId}`, match);
          }
          if(input.hasStarted===true && input.result?.finishReason==='disconnectForfeit' && input.loserId){
            const marker=`forfeit:${input.matchId}`;
            if(!await this.ctx.storage.get(marker)){
              const key=`disconnectStats:${input.loserId}`;
              const stats=await this.ctx.storage.get(key)||{totalDisconnectForfeits:0,recentDisconnects:[]};
              stats.totalDisconnectForfeits++;stats.recentDisconnects.push({matchId:input.matchId,at:input.result.completedAt});
              stats.recentDisconnects=stats.recentDisconnects.slice(-100);
              await this.ctx.storage.put({[key]:stats,[marker]:true});
            }
          }
          return Response.json({ok: true});
        }
        if (['/join', '/status', '/cancel'].includes(path)) {
          await request.text();
          const auth = await profileRequest(this.ctx.storage, new Request('https://players/profile', {headers: request.headers}),this.profileOptions());
          if (!auth.ok) return auth;
          const {profile} = await auth.json();
          const result = await matchmaking(this.ctx.storage, this.env.GAME_ROOMS, profile, path.slice(1));
          return Response.json(await ensureMatchRoom(this.ctx.storage, this.env.GAME_ROOMS, result));
        }
        if (path === '/result') {
          const auth = await profileRequest(this.ctx.storage, new Request('https://players/profile', {headers: request.headers}),this.profileOptions());
          if (!auth.ok) return auth;
          const {profile} = await auth.json();
          const {matchId} = await request.json();
          let match = await this.ctx.storage.get(`match:${matchId}`);
          const seat = match?.host.playerId === profile.playerId ? 'host' : match?.guest.playerId === profile.playerId ? 'guest' : null;
          if (!seat) return Response.json({error: 'not_found'}, {status: 404});
          if (match.status !== 'finished'||match.hasStarted!==true) return Response.json({error: 'not_finished'}, {status: 409});
          match=await this.applyRankedMatch(match,{status:match.status,hasStarted:match.hasStarted,result:match.result});
          await this.ctx.storage.put(`match:${matchId}`,match);
          const profileKey=await this.ctx.storage.get(`profile-key:${profile.playerId}`),rankedProfile=profileKey&&await this.ctx.storage.get(profileKey);
          return Response.json({battleId: matchId, source: 'randomMatch', side: match.roles[seat],
            won: match.result.winner === match.roles[seat], completed: true, completedAt: match.result.completedAt,
            ranked:match.rankedResults?.[seat]||null,rankedProfile:rankedProfile?publicRankedProfile(rankedProfile):null});
        }
        return await profileRequest(this.ctx.storage, request,this.profileOptions());
      }
      catch (_) { return Response.json({error: 'invalid_request'}, {status: 400}); }
    });
  }
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=UTF-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function makeRoomCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, "0");
}

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.pending=Promise.resolve();
  }

  serialize(fn){const task=this.pending.then(fn);this.pending=task.catch(()=>{});return task;}
  fetch(request){return this.serialize(()=>this.handleRequest(request));}
  async handleRequest(request) {
    const url = new URL(request.url);
    if(url.pathname==='/internal/server-failure'){
      const room=await this.ctx.storage.get('room');
      if(room)await this.completeLifecycle(room,serverInvalid(room,Date.now()));
      return json({error:'server_unavailable'},503);
    }
    if(url.pathname==='/internal/cancel'){
      const room=await this.ctx.storage.get('room');
      if(!room)return json({ok:true});
      if(hasStarted(room))return json({error:'already_playing'},409);
      room.status='cancelled';await this.ctx.storage.put('room',room);
      for(const ws of this.ctx.getWebSockets())try{ws.send(JSON.stringify({type:'matchCancelled',matchId:room.matchId}));}catch(_){}
      return json({ok:true});
    }
    if(url.pathname==='/internal/resume'){
      const room=await this.ctx.storage.get('room');
      const {playerId}=await request.json();
      const seat=['host','guest'].find(p=>room?.profiles?.[p]?.playerId===playerId);
      if(!seat)return json({error:'unauthorized'},401);
      await this.checkDeadline(room);
      room.resumeTickets||={};const ticket=crypto.randomUUID();
      room.resumeTickets[seat]={ticket,expires:Date.now()+20000};
      await this.ctx.storage.put('room',room);
      return json({roomCode:room.roomCode,token:room[`${seat}Token`],ticket,...publicRecovery(room,seat)});
    }

    if (url.pathname === '/internal/random-init' && request.method === 'POST') {
      const match = await request.json();
      if (await this.ctx.storage.get('room')) return json({ok: true});
      const profiles = {host: match.host, guest: match.guest};
      await this.ctx.storage.put('room', {
        roomCode:match.matchId,createdAt: match.createdAt, hostToken: match.hostToken, guestToken: match.guestToken,
        roles: match.roles, profiles, matchId: match.matchId, matchType: 'randomMatch', status: 'matched', hasStarted:false, requiresRuleSelection:true,
        appearanceSnapshot: appearanceSnapshot(profiles[match.roles.host === 'cat' ? 'host' : 'guest'], profiles[match.roles.host === 'police' ? 'host' : 'guest']),
        secretCat: {pos: null, history: [], turn: 0, noTrackBoxes: [], fakeTracks: []}, publicFoundTracks: []
      });
      await this.ctx.storage.setAlarm(Date.now()+3000);
      return json({ok: true});
    }

    // 部屋作成
    if (url.pathname === "/internal/init" && request.method === "POST") {
      const room = await this.ctx.storage.get("room");

      if (room) {
        return json({ ok: false, error: "room_exists" }, 409);
      }

      const hostToken = crypto.randomUUID();
      const matchId=`room_${crypto.randomUUID()}`;
      const registration = await request.json().catch(() => ({}));

await this.ctx.storage.put("room", {
  createdAt: Date.now(),
  hostToken,
  guestToken: null,
  roles: null,
  profiles: {host: registration.profile || null, guest: null},
  matchType: 'roomMatch',
  roomCode:registration.roomCode,matchId,status:'waiting',hasStarted:false,

secretCat: {
  pos: null,
  history: [],
  turn: 0,

  // 忍び足で足跡を残さない箱
  noTrackBoxes: [],

  // フェイク肉球
  fakeTracks: [],
},

  publicFoundTracks: [],
});

      return json({
        ok: true,
        player: "host",
        matchId,
        token: hostToken,
      });
    }

    // 2人目が参加
    if (url.pathname === "/internal/join" && request.method === "POST") {
      const room = await this.ctx.storage.get("room");

      if (!room) {
        return json({ ok: false, error: "room_not_found" }, 404);
      }

      if (room.guestToken) {
        return json({ ok: false, error: "room_full" }, 409);
      }

      const guestToken = crypto.randomUUID();

      room.guestToken = guestToken;
      room.joinedAt=Date.now();
      const registration = await request.json().catch(() => ({}));
      room.profiles ||= {host: null, guest: null};
      room.profiles.guest = registration.profile || null;
      await this.ctx.storage.put("room", room);

      return json({
        ok: true,
        player: "guest",
        matchId:room.matchId,
        token: guestToken,
      });
    }

    // WebSocket接続
    if (url.pathname === "/internal/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }

      const room = await this.ctx.storage.get("room");
      const token = url.searchParams.get("token");
      if (room?.matchType === 'randomMatch' && ['finished','cancelled'].includes(room.status)) {
        return new Response('Match closed', {status: 409});
      }

      if (!room || !token) {
        return new Response("Unauthorized", { status: 401 });
      }

      let player = null;

      if (token === room.hostToken) {
        player = "host";
      } else if (token === room.guestToken) {
        player = "guest";
      }

      if (!player) {
        return new Response("Unauthorized", { status: 401 });
      }
      await this.checkDeadline(room);
      if(terminal(room))return json({error:'match_closed'},409);
      room.generations||={};
      if(room.generations[player]){
        const t=room.resumeTickets?.[player];
        if(!t||t.ticket!==url.searchParams.get('ticket')||t.expires<Date.now())return json({error:'resume_auth_required'},401);
      }
      if(!reconnected(room,player,Date.now()))return json({error:'resume_expired'},409);
      const generation=crypto.randomUUID();room.generations[player]=generation;
      room.lastSeen||={};room.lastSeen[player]=Date.now();
      await this.ctx.storage.put('room',room);

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      // 同じプレイヤーの古い接続があれば閉じる
      for (const socket of this.ctx.getWebSockets()) {
        const info = socket.deserializeAttachment();

        if (info?.player === player) {
          try {
            socket.close(1000, "Reconnected");
          } catch (_) {}
        }
      }

      server.serializeAttachment({ player,generation });

      // Hibernation対応WebSocket
      this.ctx.acceptWebSocket(server, [player]);

      await this.broadcastPresence();
      if(url.searchParams.has('ticket'))server.send(JSON.stringify({type:'recovery',...publicRecovery(await this.ctx.storage.get('room'),player)}));
      await this.notifyConnection();
      await this.ctx.storage.setAlarm(Date.now()+3000);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // 状態確認
    if (url.pathname === "/internal/status") {
      const room = await this.ctx.storage.get("room");

      if (!room) {
        return json({ ok: false, error: "room_not_found" }, 404);
      }

      return json({
        ok: true,
        guestJoined: Boolean(room.guestToken),
        connectedPlayers: this.connectedPlayers(),
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  connectedPlayers() {
    const players = new Set();

    for (const socket of this.ctx.getWebSockets()) {
      const info = socket.deserializeAttachment();

      if (info?.player && socket.readyState===1) {
        players.add(info.player);
      }
    }

    return [...players];
  }

  async markMatch(room, status, winner) {
    if (terminal(room)) return;
    room.status = status;
    const result = winner ? {winner, completedAt: Date.now()} : null;
    if (result) room.result = result;
    await this.ctx.storage.put('room', room);
    // Persist a retry alarm before cross-object I/O. A directory outage must not
    // interrupt the room's final gameplay message or erase a completed result.
    await this.ctx.storage.setAlarm(Date.now()+5000);
    try { await this.publishMatchState(room); } catch (_) {}
    if (result) {
      for (const socket of this.ctx.getWebSockets()) {
        try { socket.send(JSON.stringify({type: 'matchFinished', matchId: room.matchId, ...result})); } catch (_) {}
      }
    }
  }

  async publishMatchState(room) {
    const response=await this.env.ONLINE_PLAYERS.get(this.env.ONLINE_PLAYERS.idFromName('profiles-v1')).fetch(
      new Request('https://players/internal/match-state', {method:'POST',body:JSON.stringify({matchId:room.matchId,status:room.status,hasStarted:hasStarted(room),result:room.result || null,loserId:room.profiles?.[room.result?.loser]?.playerId})})
    );
    if(!response.ok) throw new Error('match_state_pending');
    if(terminal(room))await this.ctx.storage.deleteAlarm();
  }

  alarm(){return this.serialize(()=>this.handleAlarm());}
  async handleAlarm() {
    const room=await this.ctx.storage.get('room');
    if(!room)return;
    if(terminal(room)){await this.publishMatchState(room);return;}
    // Conservative outage handling: a long missing server alarm must not become
    // a player's forfeit. This is not perfect attribution of network failures.
    if(room.lastAlarmAt && Date.now()-room.lastAlarmAt>10000 && room.roles){
      await this.completeLifecycle(room,serverInvalid(room,Date.now()));return;
    }
    room.lastAlarmAt=Date.now();
    for(const seat of ['host','guest'])if(room.generations?.[seat]&&Date.now()-(room.lastSeen?.[seat]||0)>9000)disconnected(room,seat,Date.now());
    // A reserved participant who never opens a socket must not strand the peer.
    if(!hasStarted(room)&&room.guestToken&&Date.now()-(room.joinedAt||room.createdAt)>15000)
      for(const seat of ['host','guest'])if(!room.generations?.[seat])disconnected(room,seat,Date.now());
    await this.checkDeadline(room);
    await this.ctx.storage.put('room',room);
    await this.notifyConnection();
    if(!terminal(room))await this.ctx.storage.setAlarm(Date.now()+1000);
  }

  async checkDeadline(room){
    const result=deadlineResult(room,Date.now())||turnTimeout(room,Date.now());if(!result)return;
    await this.completeLifecycle(room,result);
  }
  async completeLifecycle(room,result){
    if(!result)return;
    room.status=result.status;room.result=result;
    await this.ctx.storage.put('room',room);
    await this.ctx.storage.setAlarm(Date.now()+5000);
    try{await this.publishMatchState(room);}catch(_){}
    for(const ws of this.ctx.getWebSockets())try{ws.send(JSON.stringify({type:'matchFinished',matchId:room.matchId,...result}));}catch(_){}
  }
  async notifyConnection(){
    const room=await this.ctx.storage.get('room');
    for(const ws of this.ctx.getWebSockets())try{ws.send(JSON.stringify({type:'connectionState',matchId:room.matchId,disconnects:room.disconnects||{},serverTime:Date.now(),status:room.status,hasStarted:hasStarted(room),...actorState(room),turnClock:hasStarted(room)?room.turnClock:null,result:room.result||null}));}catch(_){}
  }

async broadcastPresence() {
  const players = this.connectedPlayers();

  const ready =
    players.includes("host") &&
    players.includes("guest");

  const message = JSON.stringify({
    type: "presence",
    players,
    count: players.length,
    ready,
  });

  for (const socket of this.ctx.getWebSockets()) {
    try {
      socket.send(message);
    } catch (_) {}
  }

  // 2人そろったら役割を決定・通知
  if (ready) {
    await this.assignRoles();
  }
}

  async assignRoles() {
  const room = await this.ctx.storage.get("room");

  if (!room||terminal(room)) return;

  // まだ役割が決まっていなければ1度だけ抽選
  if (!room.roles) {
    const hostIsCat =
      crypto.getRandomValues(new Uint32Array(1))[0] % 2 === 0;

    room.roles = {
      host: hostIsCat ? "cat" : "police",
      guest: hostIsCat ? "police" : "cat",
    };
    const fallback = {playerId: null, ownedCatSkins: ['default'], ownedDogSkins: ['default'], equippedAppearance: {}};
    room.appearanceSnapshot = appearanceSnapshot(
      room.profiles?.[hostIsCat ? 'host' : 'guest'] || fallback,
      room.profiles?.[hostIsCat ? 'guest' : 'host'] || fallback
    );

    await this.ctx.storage.put("room", room);
  }

  // 各プレイヤーへ自分の役割だけ通知
  syncTurnClock(room);await this.ctx.storage.put('room',room);
  for (const socket of this.ctx.getWebSockets()) {
    const info = socket.deserializeAttachment();
    const player = info?.player;

    if (!player) continue;

    const role = room.roles[player];

    try {
      socket.send(
        JSON.stringify({
          type: "role",
          player,
          role,
          playerId: room.profiles?.[player]?.playerId || null,
          profile:room.profiles?.[player]||null,
          playerProfiles:publicPlayerProfiles(room.profiles),
          participants: {host:room.profiles?.host?.playerId||null,guest:room.profiles?.guest?.playerId||null},
          appearanceSnapshot: room.appearanceSnapshot,
          matchType: room.matchType || 'roomMatch',
          matchId: room.matchId || null,
          opponentRole:
            role === "cat" ? "police" : "cat",
        })
      );
    } catch (_) {}
  }
}

  sendToRole(role, data) {
  const message = JSON.stringify(data);

  for (const socket of this.ctx.getWebSockets()) {
    const info = socket.deserializeAttachment();

    if (info?.player !== role) continue;

    try {
      socket.send(message);
    } catch (_) {}
  }
}

  playerForRole(room, wantedRole) {
  if (!room?.roles) return null;

  if (room.roles.host === wantedRole) {
    return "host";
  }

  if (room.roles.guest === wantedRole) {
    return "guest";
  }

  return null;
}

 webSocketMessage(ws,message){return this.serialize(async()=>{
   try{return await this.handleMessage(ws,message);}catch(error){
     // Unexpected server processing failure: fail neutral, never award a forfeit.
     const room=await this.ctx.storage.get('room');
     if(room)await this.completeLifecycle(room,serverInvalid(room,Date.now()));
   }
 });}
 async handleMessage(ws, message) {
  let data;

  try {
    data = JSON.parse(message);
  } catch (_) {
    return;
  }

  const sender = ws.deserializeAttachment()?.player;

  if (!sender) return;
  const current=await this.ctx.storage.get('room');
  if(current?.generations?.[sender]!==ws.deserializeAttachment()?.generation)return;

  // 接続確認
  if (data.type === "ping") {
    if(current.disconnects?.[sender]){try{ws.close(4001,'Resume required');}catch(_){}return;}
    current.lastSeen||={};current.lastSeen[sender]=Date.now();
    await this.ctx.storage.put('room',current);
    ws.send(
      JSON.stringify({
        type: "pong",
        player: sender,
        time: Date.now(),
      })
    );

    return;
  }

  if (data.type !== "game") {
    return;
  }

  const payload = data.payload ?? {};
  const room = await this.ctx.storage.get("room");

  if (!room || !room.roles) {
    return;
  }

  const senderRole = room.roles[sender];
  await this.checkDeadline(room);
  if (terminal(room)||room.disconnects?.[sender]||
      (hasStarted(room)?actorState(room).actorDisconnected:Object.keys(room.disconnects||{}).length)) return;
  if(payload.type==='setupProgress'){
    const dogs=payload.dogs;
    if(senderRole!=='police'||!hasStarted(room)||room.publicPhase!=='dogSetup'||!Array.isArray(dogs)||dogs.length!==3)return;
    const chosen=dogs.filter(n=>n!==null);
    if(new Set(chosen).size!==chosen.length||!chosen.every(n=>Number.isInteger(n)&&n>=7&&n<=28&&n%6>=1&&n%6<=4))return;
    room.partialDogs=dogs;await this.ctx.storage.put('room',room);return;
  }
  const control=sessionEvent(room,sender,payload);
  if(control!==null){
    if(control===false)return;
    if(control.type==='policeSelection')room.selectedDog=control.dogIndex;
    const justStarted=startIfReady(room,this.connectedPlayers());
    syncTurnClock(room);
    await this.ctx.storage.put('room',room);
    if(justStarted)try{await this.publishMatchState(room);}catch(_){}
    for(const other of this.ctx.getWebSockets())if(other!==ws){try{other.send(JSON.stringify({type:'game',from:sender,payload:control}));}catch(_){}}
    await this.notifyConnection();
    return;
  }
  if (room.matchType === 'randomMatch' || room.profiles?.host && room.profiles?.guest) {
    if(!hasStarted(room))return;
    if (!acceptRandomAction(room, senderRole, payload)) return;
    await this.ctx.storage.put('room', room);
  }
  if(payload.type==='dogSetup'&&senderRole==='police'){room.started=true;room.publicPhase='catSetup';}
  if(['catSetup','catMove'].includes(payload.type)&&senderRole==='cat')room.publicPhase='dogs';
  if(payload.type==='dogTurnEnd'&&senderRole==='police')room.publicPhase='cat';
  syncTurnClock(room);
  if(['dogMove','search','doubleSearch','howl','dogTurnEnd'].includes(payload.type)&&senderRole==='police'){
    room.selectedDog=null;
    const peer=this.playerForRole(room,'cat');
    if(peer)this.sendToRole(peer,{type:'game',from:'server',payload:{type:'policeSelection',dogIndex:null}});
  }
  await this.ctx.storage.put('room',room);

  /*
   * ==========================================
   * ネコ：初期位置
   * ==========================================
   *
   * catPosはCloudflareだけが保存。
   * 警察には位置番号を送らない。
   */
  if (payload.type === "catSetup") {
    if (senderRole !== "cat") return;

    const catPos = Number(payload.catPos);

    if (
      !Number.isInteger(catPos) ||
      catPos < 0 ||
      catPos >= 25
    ) {
      return;
    }

room.secretCat = {
  pos: catPos,
  turn: 1,

  history: [
    {
      box: catPos,
      turn: 1,
    },
  ],

  // 忍び足で消した足跡
  noTrackBoxes: [],

  // フェイク肉球
  fakeTracks: [],
};

    await this.ctx.storage.put("room", room);
    await this.markMatch(room, 'playing');

    const policePlayer =
      this.playerForRole(room, "police");

    if (policePlayer) {
      this.sendToRole(policePlayer, {
        type: "game",
        from: "server",
        payload: {
          type: "catSetupDone",
          turn: 1,
        },
      });
    }

    // ネコ本人へ保存完了通知
    ws.send(
      JSON.stringify({
        type: "game",
        from: "server",
        payload: {
          type: "catSetupAccepted",
          turn: 1,
        },
      })
    );

    return;
  }

  /*
   * ==========================================
   * ネコ：通常移動
   * ==========================================
   *
   * 移動先もCloudflareだけが保持。
   */
  if (payload.type === "catMove") {
    if (senderRole !== "cat") return;

    const catPos = Number(payload.catPos);
    const turn = Number(payload.turn);

    const sneakUsed = payload.sneakUsed === true;
const noTrackBox = Number(payload.noTrackBox);

    const fakePawUsed =
  payload.fakePawUsed === true;

const fakePawBox =
  Number(payload.fakePawBox);

    console.log("=== FAKE PAW RECEIVE ===", {
  fakePawUsed,
  fakePawBox,
  rawFakePawUsed: payload.fakePawUsed,
  rawFakePawBox: payload.fakePawBox,
  catPos,
  turn
});

    if (
      !Number.isInteger(catPos) ||
      catPos < 0 ||
      catPos >= 25 ||
      !Number.isInteger(turn) ||
      turn < 1 ||
      turn > 11
    ) {
      return;
    }

if (!room.secretCat) {
  room.secretCat = {
    pos: null,
    history: [],
    turn: 0,
    noTrackBoxes: [],
    fakeTracks: [],
  };
}

    if (!Array.isArray(room.secretCat.noTrackBoxes)) {
  room.secretCat.noTrackBoxes = [];
}

if (
  sneakUsed &&
  Number.isInteger(noTrackBox) &&
  noTrackBox >= 0 &&
  noTrackBox < 25 &&
  !room.secretCat.noTrackBoxes.includes(noTrackBox)
) {
  room.secretCat.noTrackBoxes.push(noTrackBox);
}

    // ==============================
// フェイク肉球を記録
// ==============================
if (!Array.isArray(room.secretCat.fakeTracks)) {
  room.secretCat.fakeTracks = [];
}

if (
  fakePawUsed &&
  Number.isInteger(fakePawBox) &&
  fakePawBox >= 0 &&
  fakePawBox < 25
) {
  room.secretCat.fakeTracks.push({
    box: fakePawBox,
    turn
  });
}

    console.log(
  "=== FAKE TRACKS SAVED ===",
  room.secretCat.fakeTracks
);
    room.secretCat.pos = catPos;
    room.secretCat.turn = turn;

    if (!Array.isArray(room.secretCat.history)) {
      room.secretCat.history = [];
    }

    room.secretCat.history.push({
      box: catPos,
      turn,
    });

    await this.ctx.storage.put("room", room);

    const policePlayer =
      this.playerForRole(room, "police");

    if (policePlayer) {
      this.sendToRole(policePlayer, {
        type: "game",
        from: "server",
        payload: {
          type: "catMoveDone",
          turn,
        },
      });
    }

    return;
  }

   if (payload.type === "howl") {
  if (senderRole !== "police") return;

  const node = Number(payload.node);

  if (
    !Number.isInteger(node) ||
    node < 0 ||
    node >= 36
  ) {
    return;
  }

  const secretCat = room.secretCat;

  if (!secretCat || secretCat.pos === null) {
    return;
  }


// =====================================
// 遠吠え開始を両プレイヤーへ通知
// =====================================
const howlStartedMessage = JSON.stringify({
  type: "game",
  from: "server",
  payload: {
    type: "howlStarted"
  }
});

for (const socket of this.ctx.getWebSockets()) {
  try {
    socket.send(howlStartedMessage);
  } catch (_) {}
}

  // 6×6交差点 → 周囲の5×5箱を算出
  const r = Math.floor(node / 6);
  const c = node % 6;

  const boxes = [];

  if (r > 0 && c > 0) {
    boxes.push((r - 1) * 5 + (c - 1));
  }

  if (r > 0 && c < 5) {
    boxes.push((r - 1) * 5 + c);
  }

  if (r < 5 && c > 0) {
    boxes.push(r * 5 + (c - 1));
  }

  if (r < 5 && c < 5) {
    boxes.push(r * 5 + c);
  }

  const catInside =
    boxes.includes(secretCat.pos);

const howlResultMessage = JSON.stringify({
  type:"game",
  from:"server",
  payload:{
    type:"howlResult",
    inside:catInside
  }
});

// 警察・ネコ両方へ遠吠え結果を通知
for(const socket of this.ctx.getWebSockets()){
  try{
    socket.send(howlResultMessage);
  }catch(_){}
}

return;
}

   // =====================================
// しろ柴・一斉捜索
// =====================================
if (payload.type === "doubleSearch") {
  if (senderRole !== "police") return;

  const targets = Array.isArray(payload.targets)
    ? payload.targets.map(Number)
    : [];

  if (
    targets.length !== 2 ||
    !targets.every(box =>
      Number.isInteger(box) &&
      box >= 0 &&
      box < 25
    )
  ) {
    return;
  }

  const secretCat = room.secretCat;

  if (!secretCat || secretCat.pos === null) {
    return;
  }

  // ---------------------------------
  // 両プレイヤーへ一斉捜索開始を通知
  // ---------------------------------
  const startedMessage = JSON.stringify({
    type: "game",
    from: "server",
    payload: {
      type: "doubleSearchStarted",
      targets
    }
  });

  for (const socket of this.ctx.getWebSockets()) {
    try {
      socket.send(startedMessage);
    } catch (_) {}
  }

  // ---------------------------------
  // 2箱を判定
  // ---------------------------------
  const results = [];

  for (const box of targets) {

    let result = "empty";
    let trackTurn = null;

    // 現在地なら捕獲
    if (box === secretCat.pos) {
      result = "capture";
    } else {

      // 忍び足
      const noTrack =
        Array.isArray(secretCat.noTrackBoxes) &&
        secretCat.noTrackBoxes.includes(box);

      // 本物の足跡
      const realTrack =
        !noTrack &&
        Array.isArray(secretCat.history)
          ? secretCat.history.find(h => h.box === box)
          : null;

      // フェイク肉球
      const fakeTrack =
        Array.isArray(secretCat.fakeTracks)
          ? secretCat.fakeTracks.find(h => h.box === box)
          : null;

      const foundTrack =
        realTrack || fakeTrack;

      if (foundTrack) {
        result = "track";
        trackTurn = foundTrack.turn;
      }
    }

    results.push({
      box,
      result,
      trackTurn
    });

    // 足跡なら公開済みに追加
    if (result === "track") {
      if (!Array.isArray(room.publicFoundTracks)) {
        room.publicFoundTracks = [];
      }

      if (!room.publicFoundTracks.includes(box)) {
        room.publicFoundTracks.push(box);
        room.revealedTracks||=[];room.revealedTracks.push([box,trackTurn]);
      }
    }
  }

  await this.ctx.storage.put("room", room);

  // 捕獲された箱
  const capturedResult =
    results.find(r => r.result === "capture");
  if (capturedResult) await this.markMatch(room, 'finished', 'police');

  // 捕獲時の移動履歴
  const route =
    capturedResult && Array.isArray(secretCat.history)
      ? secretCat.history
          .map(step => ({
            box: Number(step.box),
            turn: Number(step.turn)
          }))
          .filter(step =>
            Number.isInteger(step.box) &&
            step.box >= 0 &&
            step.box < 25 &&
            Number.isInteger(step.turn)
          )
          .sort((a,b)=>a.turn-b.turn)
      : null;

  // =====================================
// 一斉捜索捕獲時のネコ特殊スキル答え合わせ
// =====================================
const routeSkills =
  capturedResult
    ? {
        sneakBoxes:
          Array.isArray(secretCat.noTrackBoxes)
            ? secretCat.noTrackBoxes.map(Number)
            : [],

        fakeTracks:
          Array.isArray(secretCat.fakeTracks)
            ? secretCat.fakeTracks.map(step => ({
                box: Number(step.box),
                turn: Number(step.turn)
              }))
            : []
      }
    : null;

  // ---------------------------------
  // 警察側へ2箱分の結果
  // ---------------------------------
  ws.send(JSON.stringify({
    type: "game",
    from: "server",
payload: {
  type: "doubleSearchResult",
  results,
  route,
  routeSkills
}
  }));

  // ---------------------------------
  // ネコ側にも一斉捜索結果を通知
  // ---------------------------------
  const catPlayer =
    this.playerForRole(room, "cat");

  if (catPlayer) {
    this.sendToRole(catPlayer, {
      type: "game",
      from: "server",
payload: {
  type: "doubleSearchResult",
  results,
  route,
  routeSkills
}
    });
  }

  return;
}

   if (payload.type === "search") {
  if (senderRole !== "police") return;

  const box = Number(payload.box);
  const dogIndex = Number(payload.dogIndex);

  if (
    !Number.isInteger(box) ||
    box < 0 ||
    box >= 25 ||
    !Number.isInteger(dogIndex) ||
    dogIndex < 0 ||
    dogIndex >= 3
  ) {
    return;
  }
     const catPlayer = this.playerForRole(room, "cat");

if (catPlayer) {
  this.sendToRole(catPlayer, {
    type: "game",
    from: "server",
    payload: {
      type: "policeSearch",
      dogIndex,
      box,
    },
  });
}

  const secretCat = room.secretCat;

  if (!secretCat || secretCat.pos === null) {
    return;
  }

let result = "empty";
let trackTurn = null;

if (box === secretCat.pos) {

  // 現在ネコがいる箱なら捕獲
  result = "capture";

} else {

  // =========================
  // 本物の足跡
  // =========================
  const noTrack =
    Array.isArray(secretCat.noTrackBoxes) &&
    secretCat.noTrackBoxes.includes(box);

  const realTrack =
    !noTrack &&
    Array.isArray(secretCat.history)
      ? secretCat.history.find(h => h.box === box)
      : null;

  // =========================
  // フェイク肉球
  // =========================
  const fakeTrack =
    Array.isArray(secretCat.fakeTracks)
      ? secretCat.fakeTracks.find(h => h.box === box)
      : null;

  console.log("=== FAKE PAW SEARCH ===", {
  searchedBox: box,
  fakeTracks: secretCat.fakeTracks,
  fakeTrack
});

  // 本物でも偽物でも警察には同じ「足跡」として返す
  const foundTrack =
    realTrack || fakeTrack;

  if (foundTrack) {
    result = "track";
    trackTurn = foundTrack.turn;
  }
}

let foundTrackCount = Array.isArray(room.publicFoundTracks)
  ? room.publicFoundTracks.length
  : 0;

if (result === "track") {
  if (!Array.isArray(room.publicFoundTracks)) {
    room.publicFoundTracks = [];
  }

  if (!room.publicFoundTracks.includes(box)) {
    room.publicFoundTracks.push(box);
    room.revealedTracks||=[];room.revealedTracks.push([box,trackTurn]);
    await this.ctx.storage.put("room", room);
  }

  foundTrackCount = room.publicFoundTracks.length;

  const catPlayer = this.playerForRole(room, "cat");

if (catPlayer) {
  this.sendToRole(catPlayer, {
    type: "game",
    from: "server",
payload: {
  type: "trackCount",
  count: foundTrackCount,
  box,
  trackTurn,
},
  });
}
}
     const route =
  result === "capture" && Array.isArray(secretCat.history)
    ? secretCat.history
        .map(step => ({
          box: Number(step.box),
          turn: Number(step.turn),
        }))
        .filter(step =>
          Number.isInteger(step.box) &&
          step.box >= 0 &&
          step.box < 25 &&
          Number.isInteger(step.turn)
        )
        .sort((a,b)=>a.turn-b.turn)
    : null;

     // =====================================
// ゲーム終了時のネコ特殊スキル答え合わせ
// =====================================
const routeSkills =
  result === "capture"
    ? {
        // 忍び足で足跡を消した箱
        sneakBoxes:
          Array.isArray(secretCat.noTrackBoxes)
            ? secretCat.noTrackBoxes.map(Number)
            : [],

        // フェイク肉球を置いた箱
        fakeTracks:
          Array.isArray(secretCat.fakeTracks)
            ? secretCat.fakeTracks.map(step => ({
                box: Number(step.box),
                turn: Number(step.turn)
              }))
            : []
      }
    : null;

 // 警察側へ探索結果を返す
ws.send(
  JSON.stringify({
    type: "game",
    from: "server",
payload: {
  type: "searchResult",
  dogIndex,
  box,
  result,
  trackTurn,
  route,
  routeSkills,
},
  })
);

// ネコを捕獲した場合は、ネコ側にもゲーム終了を通知
if (result === "capture") {
  await this.markMatch(room, 'finished', 'police');
  const catPlayer = this.playerForRole(room, "cat");

  if (catPlayer) {
    this.sendToRole(catPlayer, {
      type: "game",
      from: "server",
      payload: {
        type: "captured",
        dogIndex,
        box,
      },
    });
  }
}

return;
}
   if (payload.type === "catNoEscape") {
  if (senderRole !== "cat") return;
  await this.markMatch(room, 'finished', 'police');

  const route = Array.isArray(room.secretCat?.history)
    ? room.secretCat.history
        .map(step => ({
          box: Number(step.box),
          turn: Number(step.turn),
        }))
        .filter(step =>
          Number.isInteger(step.box) &&
          step.box >= 0 &&
          step.box < 25 &&
          Number.isInteger(step.turn)
        )
        .sort((a,b)=>a.turn-b.turn)
    : [];

     // =====================================
// 行き止まり時のネコ特殊スキル答え合わせ
// =====================================
const routeSkills = {
  sneakBoxes:
    Array.isArray(room.secretCat?.noTrackBoxes)
      ? room.secretCat.noTrackBoxes.map(Number)
      : [],

  fakeTracks:
    Array.isArray(room.secretCat?.fakeTracks)
      ? room.secretCat.fakeTracks.map(step => ({
          box: Number(step.box),
          turn: Number(step.turn)
        }))
      : []
};

  const policePlayer =
    this.playerForRole(room, "police");

  if (policePlayer) {
    this.sendToRole(policePlayer, {
      type: "game",
      from: "server",
payload: {
  type: "catNoEscape",
  turn: Number(payload.turn),
  route,
  routeSkills,
},
    });
  }

  return;
}
   if (payload.type === "catEscaped") {
  if (senderRole !== "cat") return;
  if (room.matchType === 'randomMatch' && room.secretCat?.turn < 11) return;
  await this.markMatch(room, 'finished', 'cat');

  const route = Array.isArray(room.secretCat?.history)
    ? room.secretCat.history
        .map(step => ({
          box: Number(step.box),
          turn: Number(step.turn),
        }))
        .filter(step =>
          Number.isInteger(step.box) &&
          step.box >= 0 &&
          step.box < 25 &&
          Number.isInteger(step.turn)
        )
        .sort((a,b)=>a.turn-b.turn)
    : [];

     // =====================================
// 逃げ切り時のネコ特殊スキル答え合わせ
// =====================================
const routeSkills = {
  sneakBoxes:
    Array.isArray(room.secretCat?.noTrackBoxes)
      ? room.secretCat.noTrackBoxes.map(Number)
      : [],

  fakeTracks:
    Array.isArray(room.secretCat?.fakeTracks)
      ? room.secretCat.fakeTracks.map(step => ({
          box: Number(step.box),
          turn: Number(step.turn)
        }))
      : []
};

  const policePlayer =
    this.playerForRole(room, "police");

  if (policePlayer) {
    this.sendToRole(policePlayer, {
      type: "game",
      from: "server",
payload: {
  type: "catEscaped",
  turn: Number(payload.turn),
  route,
  routeSkills,
},
    });
  }

  return;
}

  /*
   * ==========================================
   * その他のゲーム情報
   * ==========================================
   *
   * dogSetup / dogMove / ready などは
   * 今までどおり相手へ中継。
   */
  const outgoing = JSON.stringify({
    type: "game",
    from: sender,
    payload,
  });

  for (const socket of this.ctx.getWebSockets()) {
    if (socket === ws) continue;

    try {
      socket.send(outgoing);
    } catch (_) {}
  }
}

webSocketClose(ws){return this.serialize(()=>this.handleClose(ws));}
async handleClose(ws) {
  const disconnectedPlayer =
    ws.deserializeAttachment()?.player;
  const replacement=this.ctx.getWebSockets().some(socket=>socket!==ws && socket.deserializeAttachment()?.player===disconnectedPlayer && socket.readyState===1);
  if(!replacement){
    const room=await this.ctx.storage.get('room');
    if(room && room.generations?.[disconnectedPlayer]===ws.deserializeAttachment()?.generation){
      disconnected(room,disconnectedPlayer,Date.now());
      await this.checkDeadline(room);
      await this.ctx.storage.put('room',room);
      if(!terminal(room))await this.ctx.storage.setAlarm(Date.now()+1000);
      await this.notifyConnection();
    }
  }

  try{
    ws.close(1000, "Closed");
  }catch(_){}

  await this.broadcastPresence();
}
  async webSocketError(ws) {
    try {
      ws.close(1011, "WebSocket error");
    } catch (_) {}

    await this.webSocketClose(ws);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: JSON_HEADERS,
      });
    }

    const players = () => env.ONLINE_PLAYERS.get(env.ONLINE_PLAYERS.idFromName('profiles-v1'));
    const profileRoute = url.pathname.match(/^\/api\/online\/(register|profile|appearance|cpu-unlock|active|profile-frame|season-reward)$/);
    if (profileRoute) {
      const body=['GET','HEAD'].includes(request.method)?undefined:await request.text();
      const response = await players().fetch(new Request(`https://players/${profileRoute[1]}`, {method:request.method,headers:request.headers,body}));
      return new Response(response.body, {status: response.status, headers: JSON_HEADERS});
    }
    const queueRoute = url.pathname.match(/^\/api\/matchmaking\/(join|status|cancel|result)$/);
    if (queueRoute && request.method === 'POST') {
      const body=await request.text();
      const response = await players().fetch(new Request(`https://players/${queueRoute[1]}`, {method:'POST',headers:request.headers,body}));
      return new Response(response.body, {status: response.status, headers: JSON_HEADERS});
    }
    async function authenticatedProfile() {
      // Legacy room clients may join with default cosmetics. A presented invalid
      // credential fails closed instead of silently importing client ownership.
      if (!request.headers.has('Authorization')) return null;
      let response;
      try{response = await players().fetch(new Request('https://players/profile', {
        headers: {Authorization: request.headers.get('Authorization')}
      }));}catch(_){throw new Error('service_unavailable');}
      if(response.status>=500)throw new Error('service_unavailable');
      if (!response.ok) throw new Error('unauthorized');
      return (await response.json()).profile;
    }

    // サーバー稼働確認
    if (url.pathname === "/") {
      return json({
        ok: true,
        service: "Nyan Chase Online",
        version: "beta-1",
      });
    }

    // 部屋作成
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      let profile;
      try { profile = await authenticatedProfile(); }
      catch (_) { return json({error: 'unauthorized'}, 401); }
      // 6桁コードの衝突時は最大10回まで再生成
      for (let i = 0; i < 10; i++) {
        const roomCode = makeRoomCode();
        const id = env.GAME_ROOMS.idFromName(roomCode);
        const stub = env.GAME_ROOMS.get(id);

        const response = await stub.fetch(
          new Request("https://room/internal/init", {
            method: "POST",
            body: JSON.stringify({profile,roomCode}),
          })
        );

        if (response.ok) {
          const result = await response.json();
          if(profile)await players().fetch(new Request('https://players/internal/active',{method:'POST',body:JSON.stringify({playerId:profile.playerId,roomCode})}));

          return json({
            ok: true,
            roomCode,
            player: result.player,
            matchId:result.matchId,
            token: result.token,
          });
        }
      }

      return json(
        {
          ok: false,
          error: "could_not_create_room",
        },
        503
      );
    }

    const match = url.pathname.match(
      /^\/api\/rooms\/([0-9]{6}|rm_[a-f0-9-]{36})\/(join|status|ws|resume)$/
    );

    if (match) {
      const roomCode = match[1];
      const action = match[2];

      const id = env.GAME_ROOMS.idFromName(roomCode);
      const stub = env.GAME_ROOMS.get(id);
      if(action==='resume' && request.method==='POST'){
        let profile;try{profile=await authenticatedProfile();}catch(error){
          if(error.message==='service_unavailable'){
            await stub.fetch(new Request('https://room/internal/server-failure',{method:'POST'}));
            return json({error:'server_unavailable'},503);
          }
          return json({error:'unauthorized'},401);
        }
        if(!profile)return json({error:'unauthorized'},401);
        const response=await stub.fetch(new Request('https://room/internal/resume',{method:'POST',body:JSON.stringify({playerId:profile.playerId})}));
        return new Response(response.body,{status:response.status,headers:JSON_HEADERS});
      }

      if (action === "join" && request.method === "POST") {
        if (roomCode.startsWith('rm_')) return json({error: 'private_match'}, 403);
        let profile;
        try { profile = await authenticatedProfile(); }
        catch (_) { return json({error: 'unauthorized'}, 401); }
        const response = await stub.fetch(
          new Request("https://room/internal/join", {
            method: "POST",
            body: JSON.stringify({profile}),
          })
        );

        if(response.ok&&profile)await players().fetch(new Request('https://players/internal/active',{method:'POST',body:JSON.stringify({playerId:profile.playerId,roomCode})}));

        return new Response(response.body, {
          status: response.status,
          headers: JSON_HEADERS,
        });
      }

      if (action === "status" && request.method === "GET") {
        const response = await stub.fetch(
          new Request("https://room/internal/status")
        );

        return new Response(response.body, {
          status: response.status,
          headers: JSON_HEADERS,
        });
      }

      if (action === "ws") {
        const token = url.searchParams.get("token") || "";

        return stub.fetch(
          new Request(
            `https://room/internal/ws?token=${encodeURIComponent(token)}${url.searchParams.has('ticket')?'&ticket='+encodeURIComponent(url.searchParams.get('ticket')):''}`,
            request
          )
        );
      }
    }

    return json(
      {
        ok: false,
        error: "not_found",
      },
      404
    );
  },
};
