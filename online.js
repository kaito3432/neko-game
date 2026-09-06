/* にゃんチェイス Online β
   開発用Cloudflare Worker。
   本番公開前は API_BASE だけ差し替えればOK。
*/

window.NyanOnline = (() => {
  const API_BASE =
    "https://nyan-chase-online.honda19990602.workers.dev";

  let socket = null;
  let roomCode = "";
  let token = "";
  let player = "";
  let reserved = null;
  let appearanceSnapshot = null;
  let matchType = 'roomMatch';
  let matchId = null;
  let role = null;
  let credentialHeaders = null;
  let profileSupport = null;
  let verifiedProfile = null;
  let sessionProfile = null;
  let visualState = null;
  function clearMatchVisuals(){
    appearanceSnapshot=null;visualState=null;role=null;matchId=null;matchType='roomMatch';
    window.dispatchEvent(new CustomEvent('nyan-online-appearance-changed'));
  }

  async function identity() {
    // Probe without Authorization: the old Worker's CORS policy does not allow
    // that header, so an authenticated probe cannot reliably detect its 404.
    if(profileSupport===null){
      const response=await fetch(api('/api/online/profile'));
      if(response.status===404) profileSupport=false;
      else if(response.status===401 || response.ok) profileSupport=true;
      else throw new Error('online_server_unavailable');
    }
    if(!profileSupport) return {headers:{},legacy:true};
    let identity;
    try { identity = await window.NyanOnlineIdentity.prepare(API_BASE); }
    catch(error) {
      // Rollout compatibility only: the old Worker has no profile route. Keep its
      // existing default-only room matches usable; never enable random rewards.
      if(error.message==='online_profile_404') return {headers:{},legacy:true};
      throw error;
    }
    credentialHeaders = identity.headers;
    verifiedProfile = identity.profile;
    // Recover a result missed while closing the app before the WS notification.
    try {
      const latest=await matchmaking('status');
      if(latest.completedReceipt) window.NyanDailyMissions.recordOnline(latest.completedReceipt);
    } catch (_) { /* The durable result and local outbox remain retryable. */ }
    return identity;
  }
  async function matchmaking(action, body = {}) {
    if (!credentialHeaders && (await identity()).legacy) throw new Error('online_server_update_required');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),15000);
    try{return await readJson(await fetch(api(`/api/matchmaking/${action}`), {
      method: 'POST', headers: credentialHeaders, body: JSON.stringify(body),signal:controller.signal
    }));}finally{clearTimeout(timeout);}
  }
  function useReservation(value) {
    if (!value?.matchId || !value?.token) throw new Error('invalid_match');
    reserved = value;
  }



  function api(path) {
    return API_BASE.replace(/\/+$/, "") + path;
  }

  async function readJson(response) {
    let data = null;

    try {
      data = await response.json();
    } catch (_) {}

    if (!response.ok) {
      const error = new Error(
        data?.error || `HTTP_${response.status}`
      );

      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  }

  async function createRoom() {
    disconnect();clearMatchVisuals();
    if (reserved) {
      const value = reserved; reserved = null;
      sessionProfile=JSON.parse(JSON.stringify(verifiedProfile));
      roomCode = value.roomCode; token = value.token; player = value.player;
      matchType = 'randomMatch'; matchId = value.matchId;
      return value;
    }
    const identityData = await identity();
    sessionProfile=identityData.profile?JSON.parse(JSON.stringify(identityData.profile)):null;
    const response = await fetch(api("/api/rooms"), {
      method: "POST",
      headers: {
        ...identityData.headers, Accept: "application/json"
      }
    });

    const data = await readJson(response);

    roomCode = data.roomCode;
    token = data.token;
    player = data.player || "host";

    return {
      roomCode,
      token,
      player
    };
  }

  async function joinRoom(code) {
    disconnect();clearMatchVisuals();
    const identityData = await identity();
    sessionProfile=identityData.profile?JSON.parse(JSON.stringify(identityData.profile)):null;
    const normalizedCode = String(code || "")
      .trim()
      .replace(/\D/g, "");

    if (!/^\d{6}$/.test(normalizedCode)) {
      throw new Error("invalid_room_code");
    }

    const response = await fetch(
      api(`/api/rooms/${normalizedCode}/join`),
      {
        method: "POST",
        headers: {
          ...identityData.headers, Accept: "application/json"
        }
      }
    );

    const data = await readJson(response);

    roomCode = normalizedCode;
    token = data.token;
    player = data.player || "guest";

    return {
      roomCode,
      token,
      player
    };
  }

  async function getStatus(code = roomCode) {
    if (!code) {
      throw new Error("room_code_missing");
    }

    const response = await fetch(
      api(`/api/rooms/${code}/status`)
    );

    return readJson(response);
  }

  function makeWebSocketUrl(code, authToken) {
    const url = new URL(
      api(`/api/rooms/${code}/ws`)
    );

    url.protocol =
      url.protocol === "https:" ? "wss:" : "ws:";

    url.searchParams.set("token", authToken);

    return url.toString();
  }

function connect({
  onOpen,
  onPresence,
  onRole,
  onGame,
  onClose,
  onError,
  onPeerDisconnected
} = {}) {
    disconnect();

    if (!roomCode || !token) {
      throw new Error("room_not_ready");
    }

    socket = new WebSocket(
      makeWebSocketUrl(roomCode, token)
    );
    const connectedSocket=socket;

    socket.addEventListener("open", () => {
      if(socket!==connectedSocket)return;
      if (onOpen) onOpen();

      try {
        socket.send(
          JSON.stringify({
            type: "ping"
          })
        );
      } catch (_) {}
    });

socket.addEventListener("message", event => {
  if(socket!==connectedSocket)return;
  let data;

  try {
    data = JSON.parse(event.data);
  } catch (_) {
    return;
  }
  if (data.type === 'role') {
    role = data.role;
    if(!visualState){
      visualState=window.NyanOnlineAppearance.accept(data,{myPlayerId:sessionProfile?.playerId,profile:sessionProfile,player,roomCode});
      appearanceSnapshot=visualState?.snapshot||null;
      window.dispatchEvent(new CustomEvent('nyan-online-appearance-changed'));
    }
    matchType = data.matchType || 'roomMatch';
    matchId = data.matchId || null;
  }
  if (data.type === 'matchFinished' && matchType === 'randomMatch' && data.matchId === matchId) {
    // Server result is durable before UI/ad presentation. Retryable local journal uses this ID.
    window.NyanDailyMissions.recordOnline({battleId:matchId,source:'randomMatch',side:role,
      won:data.winner===role,completed:true,completedAt:data.completedAt});
  }
  if (data.type === 'game') window.dispatchEvent(new CustomEvent('nyan-online-visual-event', {detail: data.payload}));

  if (
    data.type === "presence" &&
    onPresence
  ) {
    onPresence(data);
  }

  if (
    data.type === "role" &&
    onRole
  ) {
    onRole(data);
  }

  if (
    data.type === "game" &&
    onGame
  ) {
    onGame(data);
  }

  if (
    data.type === "peerDisconnected" &&
    onPeerDisconnected
  ) {
    onPeerDisconnected(data);
  }
});

    socket.addEventListener("close", event => {
      if(socket!==connectedSocket)return;
      if (onClose) onClose(event);
    });

    socket.addEventListener("error", event => {
      if(socket!==connectedSocket)return;
      if (onError) onError(event);
    });

    return socket;
  }

  function sendGame(payload) {
    if (
      !socket ||
      socket.readyState !== WebSocket.OPEN
    ) {
      return false;
    }

    socket.send(
      JSON.stringify({
        type: "game",
        payload
      })
    );

    return true;
  }

  function disconnect() {
    if (!socket) return;

    try {
      socket.close(1000, "Leaving room");
    } catch (_) {}

    socket = null;
  }

  function reset() {
    disconnect();

    roomCode = "";
    token = "";
    player = "";
    appearanceSnapshot = null;
    visualState=null;sessionProfile=null;
    window.dispatchEvent(new CustomEvent('nyan-online-appearance-changed'));
    matchType = 'roomMatch'; matchId = null; reserved = null; role = null;
  }

  function getSession() {
    return {
      roomCode,
      token,
      player,
      matchType, matchId, role,
      playerId:sessionProfile?.playerId||null,
      connected:
        socket?.readyState === WebSocket.OPEN
    };
  }

  // The daily module is loaded earlier than this transport. Retry after the
  // authenticated result verifier becomes available, without blocking startup.
  queueMicrotask(()=>window.NyanPlayerData?.retryPendingBattles?.()
    .then(()=>window.dispatchEvent(new CustomEvent('nyan-player-progress-changed'))).catch(()=>{}));

  return {
    API_BASE,
    createRoom,
    joinRoom,
    getStatus,
    connect,
    sendGame,
    disconnect,
    reset,
    getSession
    ,prepareIdentity: async()=>{const value=await identity();if(value.legacy)throw new Error('online_server_update_required');return value;}
    ,matchmaking
    ,useReservation
    ,getAppearanceSnapshot: () => appearanceSnapshot ? JSON.parse(JSON.stringify(appearanceSnapshot)) : null
    ,resolveAppearance: category=>window.NyanOnlineAppearance.resolve(visualState,category)
    ,verifyResult: event => matchmaking('result', {matchId: event.battleId})
    ,syncCpuUnlocks: ()=>window.NyanOnlineIdentity.hasCredential()?identity():Promise.resolve(null)
  };
})();
