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

   function disconnect(){
  if(socket){
    try{
      socket.close(1000,"client_disconnect");
    }catch(_){}
  }

  socket=null;
  roomCode="";
  token="";
  player="";
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
    const response = await fetch(api("/api/rooms"), {
      method: "POST",
      headers: {
        Accept: "application/json"
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
          Accept: "application/json"
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
    onError
  } = {}) {
    disconnect();

    if (!roomCode || !token) {
      throw new Error("room_not_ready");
    }

    socket = new WebSocket(
      makeWebSocketUrl(roomCode, token)
    );

    socket.addEventListener("open", () => {
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
      let data;

      try {
        data = JSON.parse(event.data);
      } catch (_) {
        return;
      }

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
    });

    socket.addEventListener("close", event => {
      if (onClose) onClose(event);
    });

    socket.addEventListener("error", event => {
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
  }

  function getSession() {
    return {
      roomCode,
      token,
      player,
      connected:
        socket?.readyState === WebSocket.OPEN
    };
  }

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
  };
})();
