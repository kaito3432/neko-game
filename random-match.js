/* Matching selects an existing room session; it does not implement gameplay. */
(function(root) {
  'use strict';
  let busy = false, timer = null, entered = false, transitioning = false, launch = null, roomEntry = null;
  const started = new Set();
  root.addEventListener('nyan-online-ended',event=>{
    started.delete(event.detail?.matchId);entered=false;transitioning=false;busy=false;clearTimeout(timer);
  });
  const overlay = document.createElement('div');
  overlay.id = 'matchmakingOverlay'; overlay.className = 'matchmaking-overlay';
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'matchmakingTitle');
  overlay.hidden = true;
  overlay.innerHTML = `<section class="matchmaking-panel"><h2 id="matchmakingTitle">オンライン対戦</h2>
    <p id="matchmakingStatus" role="status">遊び方を選んでね</p>
    <button id="randomMatchStart" type="button">🎲 ランダムマッチ<br><small>すぐに相手を探して対戦</small></button>
    <button id="roomMatchStart" type="button">🏠 部屋対戦<br><small>友達と部屋コードで対戦</small></button>
    <button id="matchmakingCancel" type="button">戻る</button></section>`;
  document.body.append(overlay);
  const status = overlay.querySelector('#matchmakingStatus');
  const start = overlay.querySelector('#randomMatchStart');
  const rooms = overlay.querySelector('#roomMatchStart');
  const cancel = overlay.querySelector('#matchmakingCancel');
  function waiting() {
    start.hidden = rooms.hidden = true;
    cancel.textContent = 'キャンセル';
    status.textContent = '🐱 ↔ 🐕 対戦相手を探しています…';
  }
  async function accept(result) {
    if (result.status === 'waiting') {
      timer = setTimeout(poll, 2500); return;
    }
    if (result.matchId) {
      if (started.has(result.matchId)) return;
      started.add(result.matchId); entered = false; transitioning = true;
      cancel.disabled = true;cancel.hidden=true;
      status.textContent = `対戦相手が見つかりました！ あなたは${result.role === 'cat' ? '🐱 ネコ' : '🐕 警察'}です。`;
      setTimeout(() => {
        root.NyanOnline.useReservation(result);
        overlay.hidden = true;
        transitioning = false;
        launch();
      }, 900);
      return;
    }
    entered = false; show(roomEntry, launch);
  }
  async function poll() {
    if (!entered || busy) return;
    busy = true;
    try { await accept(await root.NyanOnline.matchmaking('status')); }
    catch (_) {
      status.textContent = '接続を確認しています…キャンセルもできます';
      timer = setTimeout(poll, 3000);
    } finally { busy = false; }
  }
  start.onclick = async () => {
    if (busy || entered || transitioning) return;
    busy = true; start.disabled = true; cancel.disabled = true;
    try {
      await root.NyanOnline.prepareIdentity();
      entered = true; waiting();
      await accept(await root.NyanOnline.matchmaking('join'));
    } catch (error) {
      // A lost join response may have reserved a match: resolve via status/cancel.
      status.textContent = error.message==='online_server_update_required'
        ? 'ランダムマッチはサーバー更新後に利用できます。部屋対戦は引き続き利用できます。'
        : '接続できませんでした。もう一度お試しください';
      start.hidden = rooms.hidden = entered;
      start.disabled = false;
    } finally { busy = false; cancel.disabled = transitioning; }
  };
  cancel.onclick = async () => {
    if (busy || transitioning) return;
    clearTimeout(timer);
    if (!entered) { overlay.hidden = true; document.getElementById('onlineModeBtn')?.focus(); return; }
    busy = true; cancel.disabled = true;
    try {
      const result = await root.NyanOnline.matchmaking('cancel');
      if (result.matchId) await accept(result); // server pairing won the race
      else { entered = false; show(roomEntry, launch); }
    } catch (_) { status.textContent = 'キャンセルを確認できませんでした。もう一度押してください'; }
    finally { busy = false; cancel.disabled = transitioning; }
  };
  rooms.onclick = () => { if (!busy) { overlay.hidden = true; roomEntry(); } };
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();cancel.click();}
    if(event.key==='Tab'){
      const buttons=[...overlay.querySelectorAll('button')].filter(b=>!b.hidden&&!b.disabled);
      if(!buttons.length){event.preventDefault();return;}
      if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus();}
      else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus();}
    }
  });
  function show(onRoom, onMatch) {
    cancel.hidden=false;
    roomEntry = onRoom; launch = onMatch;
    if (entered) { overlay.hidden = false; return; }
    start.hidden = rooms.hidden = false;
    start.disabled = cancel.disabled = false;
    cancel.textContent = '戻る'; status.textContent = '遊び方を選んでね';
    overlay.hidden = false; start.focus();
    root.NyanRankedUI?.refresh();
  }
  root.NyanRandomMatch = {show};
})(globalThis);
