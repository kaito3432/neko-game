/* にゃんチェイス - UI / ゲーム進行
   Ver1.5.2 開発基盤版
   修正: 探索開始直後に actionLocked=true にして二重行動を防止。
*/
(() => {
  const E=NyanEngine;
  const A=NyanAnimation;
  const Audio=NyanAudio;
   // 盤面で頻繁に使う画像を先に読み込んでおく
[
  "./assets/images/paw.png",
  "./assets/images/start.png",
  "./assets/images/box.png",
  "./assets/images/dog_red.png",
  "./assets/images/dog_green.png",
  "./assets/images/dog_blue.png"
].forEach(src=>{
  const img=new Image();
  img.src=src;
  img.decode?.().catch(()=>{});
});
  let game;
  let toastTimer=null;
  let victoryCutinTimer=null;
  let playMode="local"; // local | cpuPolice | cpuCat
  let cpuTimer=null;
  let cpuDifficulty="normal"; // easy | normal | hard
  let pendingCpuSide="cat"; // cat => player cat, police => player police

  let cpuMemory={
    lastDogNodes:[null,null,null],
    discoveredTrackBoxes:[],
    emptyBoxes:new Map(),
     emptyByTurn:new Map(),
    recentTargets:[],
    thoughtText:""
  };
  let cpuCatRoute=[];

  const $=id=>document.getElementById(id);
  const board=$("board");
  const modeOverlay=$("modeOverlay"),localModeBtn=$("localModeBtn"),cpuModeBtn=$("cpuModeBtn");
   const policeAbilityOverlay=$("policeAbilityOverlay");
const catAbilityOverlay=$("catAbilityOverlay");
const abilityRevealOverlay=$("abilityRevealOverlay");
   const abilityCancelBtn=$("abilityCancelBtn");

const selectHowlBtn=$("selectHowlBtn");
const selectDashBtn=$("selectDashBtn");
const selectDoubleSearchBtn=$("selectDoubleSearchBtn");

const selectSneakBtn=$("selectSneakBtn");
const selectFakePawBtn=$("selectFakePawBtn");

   const dashBtn=$("dashBtn");
   const howlBtn=$("howlBtn");

const abilityRevealText=$("abilityRevealText");
const abilityStartBtn=$("abilityStartBtn");
  const onlineModeBtn=$("onlineModeBtn"),onlineOverlay=$("onlineOverlay"),onlineBackBtn=$("onlineBackBtn");
   const onlineStartGameBtn=$("onlineStartGameBtn");
const createOnlineRoomBtn=$("createOnlineRoomBtn"),joinOnlineRoomBtn=$("joinOnlineRoomBtn");
const onlineRoomCodeInput=$("onlineRoomCodeInput"),onlineStatus=$("onlineStatus"); 
   let onlineAssignedRole=null;
   let onlineSelfReady=false;
let onlinePeerReady=false;
let onlineGameStarted=false;
   let onlinePeerDisconnected = false;
   let onlineFoundTrackCount=0;

   function resetOnlineState(){
  onlineAssignedRole=null;
  onlineSelfReady=false;
  onlinePeerReady=false;
  onlineGameStarted=false;
  onlineFoundTrackCount=0;
onlinePeerDisconnected=false;

  if(onlineStartGameBtn){
    onlineStartGameBtn.hidden=true;
    onlineStartGameBtn.disabled=false;
    onlineStartGameBtn.textContent="🎮 ゲーム開始";
  }

  if(onlineStatus){
    onlineStatus.textContent="";
  }

  if(onlineRoomCodeInput){
    onlineRoomCodeInput.value="";
  }

  if(createOnlineRoomBtn){
    createOnlineRoomBtn.disabled=false;
  }

  if(joinOnlineRoomBtn){
    joinOnlineRoomBtn.disabled=false;
  }
}
   
  const cpuSideOverlay=$("cpuSideOverlay"),playCatSideBtn=$("playCatSideBtn"),playPoliceSideBtn=$("playPoliceSideBtn"),cpuSideBackBtn=$("cpuSideBackBtn");
  const difficultyOverlay=$("difficultyOverlay"),cpuEasyBtn=$("cpuEasyBtn"),cpuNormalBtn=$("cpuNormalBtn"),
        cpuHardBtn=$("cpuHardBtn"),difficultyBackBtn=$("difficultyBackBtn");
  const titleSettingsBtn=$("titleSettingsBtn"),howToBtn=$("howToBtn"),soundQuickBtn=$("soundQuickBtn");
  const turnDisplay=$("turnDisplay");
  const phaseDisplay=$("phaseDisplay"),guideDisplay=$("guideDisplay");
  const dogCards=[$("dogCard0"),$("dogCard1"),$("dogCard2")];
  const dogRow=$("dogRow"),tracksSummary=$("tracksSummary"),tracksFoundCount=$("tracksFoundCount");
  const routeRevealPanel=$("routeRevealPanel"),routeRevealSub=$("routeRevealSub");
  const message=$("message");
const catViewBtn=$("catViewBtn"),
      sneakBtn=$("sneakBtn"),
      fakePawBtn=$("fakePawBtn"),
      settingsBtn=$("settingsBtn");
   const sneakBanner=$("sneakBanner");
   const fakePawBanner=$("fakePawBanner");
const fakePawBannerTitle=$("fakePawBannerTitle");
const fakePawBannerText=$("fakePawBannerText");
   const finishDogTurnBtn=$("finishDogTurnBtn");
  const privacyOverlay=$("privacyOverlay"),privacyIcon=$("privacyIcon");
  const privacyTitle=$("privacyTitle"),privacyText=$("privacyText"),privacyBtn=$("privacyBtn");
  const victoryCutin=$("victoryCutin"),victoryCutinImage=$("victoryCutinImage");
  const resultOverlay=$("resultOverlay"),resultIcon=$("resultIcon");
  const resultTitle=$("resultTitle"),resultText=$("resultText"),againBtn=$("againBtn");
  const resultRoute=$("resultRoute"),resultRouteBoard=$("resultRouteBoard"),resultRouteNote=$("resultRouteNote");
  const settingsOverlay=$("settingsOverlay"),sfxToggleBtn=$("sfxToggleBtn"),bgmToggleBtn=$("bgmToggleBtn");
  const vibrationToggleBtn=$("vibrationToggleBtn"),sfxState=$("sfxState"),bgmState=$("bgmState");
  const vibrationState=$("vibrationState"),settingsCloseBtn=$("settingsCloseBtn");
  const bgmVolumeSlider=$("bgmVolumeSlider"),bgmVolumeValue=$("bgmVolumeValue");
const backToTitleBtn=$("backToTitleBtn");
   const toast=$("toast"),toastIcon=$("toastIcon"),toastTitle=$("toastTitle"),toastText=$("toastText");
  const lastTurnBanner=$("lastTurnBanner"),phaseCue=$("phaseCue"),phaseCueIcon=$("phaseCueIcon"),phaseCueText=$("phaseCueText");
  let lastRenderedPhase=null;
  let lastTurnStingerPlayed=false;
  const motionStatus=$("motionStatus"),confettiLayer=$("confettiLayer");

   function tryStartOnlineGame(){
  if(onlineGameStarted)return;

  if(onlineSelfReady && onlinePeerReady){
    onlineGameStarted=true;
    startOnlineGame();
  }
}

function bindPress(el, fn){
  if(!el) return;

  let lastFire = 0;

  const fire = (e)=>{
    if(el.disabled) return;

    const now = Date.now();
    if(now - lastFire < 350) return;
    lastFire = now;

    if(e){
      e.preventDefault();
      e.stopPropagation();
    }

    try{
      const unlock = Audio.unlockAudio();

      if(unlock && typeof unlock.then === "function"){
        unlock
          .then(()=>Audio.startBgm())
          .catch(()=>{});
      }else{
        Audio.startBgm();
      }
    }catch(err){
      // Audio must never block UI navigation.
    }

    fn(e);
  };

  /* clickだけに統一してタップ貫通を防ぐ */
  el.addEventListener("click", fire, { passive:false });
}

  function initGame(showMode=false){
    game=E.createState();
     game.abilitiesEnabled=
  playMode==="local" ||
  playMode==="onlineCat" ||
  playMode==="onlinePolice";
    clearTimeout(cpuTimer);
    clearTimeout(victoryCutinTimer);
    if(victoryCutin){
      victoryCutin.classList.remove("show","closing");
      victoryCutin.setAttribute("aria-hidden","true");
    }
    cpuMemory={
      lastDogNodes:[null,null,null],
      discoveredTrackBoxes:[],
      emptyBoxes:new Map(),
       emptyByTurn:new Map(),
      recentTargets:[],
      thoughtText:""
    };
    cpuCatRoute=[];
    lastTurnStingerPlayed=false;
    privacyOverlay.classList.remove("show");
    resultOverlay.classList.remove("show");
    if(resultRoute) resultRoute.classList.remove("show");
    if(resultRouteBoard) if(resultRouteBoard) resultRouteBoard.innerHTML="";
    if(resultRouteNote) resultRouteNote.textContent="";
    settingsOverlay.classList.remove("show");
    hideToast();
    if(routeRevealPanel) routeRevealPanel.classList.remove("show");
    clearRouteReveal();
    setMessage("🐕 0ターン目。まず柴犬警察3匹を配置してください。");
    if(showMode){
      modeOverlay.classList.add("show");
      Audio.setBgmMode("home");
    }
    render();
  }
   function startOnlineGame(){
  if(!onlineAssignedRole)return;

  playMode=
    onlineAssignedRole==="cat"
      ? "onlineCat"
      : "onlinePolice";

  onlineOverlay.classList.remove("show");
  modeOverlay.classList.remove("show");

  Audio.setBgmMode("normal");
  Audio.play("gamestart");

  initGame(false);

  if(onlineAssignedRole==="police"){
    // 自分が柴犬警察
    game.phase="dogSetup";
    game.turn=0;

    showPrivacy(
      "🐕",
      "あなたは柴犬警察！",
      "まず柴犬警察3匹を中央16交差点に配置してください。ネコは配置が終わるまで待機しています。"
    );

    setMessage(
      "🐕 柴犬警察3匹を配置しよう。"
    );

  }else{
    // 自分がネコ
    game.phase="onlineWaitingDogSetup";
    game.turn=0;

    showPrivacy(
      "🐱",
      "あなたはネコ！",
      "柴犬警察が配置を決めています。少し待ってね。"
    );

    setMessage(
      "🐱 柴犬警察が配置中です…"
    );
  }

  render();
}
function startLocalMode(){
  playMode="local";

  modeOverlay.classList.remove("show");

  // ゲーム状態だけ作る
  initGame(false);

  // 能力選択を初期化
  game.selectedAbilities.cat=null;
  game.selectedAbilities.police=null;

  // まず警察側の特殊スキル選択へ
  policeAbilityOverlay.classList.add("show");

  Audio.setBgmMode("normal");

  render();
}
   function selectPoliceAbility(ability){
  if(playMode!=="local") return;

  game.selectedAbilities.police=ability;

  policeAbilityOverlay.classList.remove("show");

  // 猫プレイヤーへ端末を渡す
  showPrivacy(
    "🐱",
    "ネコプレイヤーに渡してください",
    "次はネコ側の特殊スキルを選びます。警察プレイヤーは画面を見ないでください。"
  );

  privacyBtn.dataset.nextAction="openCatAbility";
}

   function selectCatAbility(ability){
  if(playMode!=="local") return;

  game.selectedAbilities.cat=ability;

  catAbilityOverlay.classList.remove("show");

  // 表示用の名前
  const catNames={
    sneak:"🐾 忍び足",
    fakePaw:"🐾 フェイク肉球"
  };

  const policeNames={
    howl:"🔴 赤柴・遠吠え",
    dash:"⚫ 黒柴・ダッシュ",
    doubleSearch:"⚪ 白柴・一斉捜索"
  };

  abilityRevealText.innerHTML=`
    <div class="ability-reveal-side">
      <strong>🐱 ネコ</strong><br>
      ${catNames[game.selectedAbilities.cat]}
    </div>

    <div class="ability-reveal-vs">
      VS
    </div>

    <div class="ability-reveal-side">
      <strong>🐕 柴犬警察</strong><br>
      ${policeNames[game.selectedAbilities.police]}
    </div>
  `;

  abilityRevealOverlay.classList.add("show");
}

   function startLocalAfterAbilitySelect(){
  if(playMode!=="local") return;

  if(
    !game.selectedAbilities.cat ||
    !game.selectedAbilities.police
  ){
    return;
  }

  abilityRevealOverlay.classList.remove("show");

  Audio.play("gamestart");

  showPrivacy(
    "🐕",
    "0ターン目・警察配置",
    "まず柴犬警察3匹を中央16交差点に配置してください。配置後にネコがスタート地点を選びます。"
  );

  render();
}

  function startCpuPoliceMode(){
    modeOverlay.classList.remove("show");
    cpuSideOverlay.classList.add("show");
  }

  function chooseCpuSide(side){
    pendingCpuSide=side;
    cpuSideOverlay.classList.remove("show");
    difficultyOverlay.classList.add("show");
  }

  function closeCpuSidePicker(){
    cpuSideOverlay.classList.remove("show");
    modeOverlay.classList.add("show");
    Audio.setBgmMode("home");
  }

  function beginCpuPoliceGame(difficulty){
    cpuDifficulty=difficulty;
    difficultyOverlay.classList.remove("show");
    Audio.setBgmMode("normal");
    Audio.play("gamestart");

    if(pendingCpuSide==="cat"){
      playMode="cpuPolice";
      initGame(false);
      cpuSetupDogs();
      game.phase="catSetup";
      game.turn=1;

      const label={easy:"やさしい",normal:"ふつう",hard:"つよい"}[cpuDifficulty];
      showPrivacy("🐱","逃走1ターン目・ネコの番",
        `CPU柴犬警察（${label}）の配置が完了しました。配置を見て、スタート地点にする箱を1つ選んでください。`);
      setMessage("🐱 柴犬の配置を見て、好きな箱に隠れよう。");
      render();
      return;
    }

    // Player = police / CPU = cat
    playMode="cpuCat";
    initGame(false);
    game.phase="dogSetup";
    game.turn=0;

    const label={easy:"やさしい",normal:"ふつう",hard:"つよい"}[cpuDifficulty];
    showPrivacy("🐕","0ターン目・警察配置",
      `CPUネコ（${label}）と対戦します。まず柴犬警察3匹を中央16交差点に配置してください。`);
    setMessage("🐕 柴犬警察3匹を配置しよう。配置後、CPUネコが隠れます。");
    render();
  }

  function closeDifficultyPicker(){
    difficultyOverlay.classList.remove("show");
    cpuSideOverlay.classList.add("show");
  }

  function render(){
    renderBoard();

    // A complete board has 25 boxes + 36 intersections.
    // Rebuild once if Safari restored a stale/incomplete DOM snapshot.
    if(board.querySelectorAll(".box").length!==E.BOX_COUNT ||
       board.querySelectorAll(".node").length!==E.NODE_COUNT){
      board.innerHTML="";
      renderBoard();
    }

    renderStatus();
    renderDogCards();
    renderControls();
  }
   function renderTrackLayer(){
  let layer=board.querySelector(".track-layer");

  if(!layer){
    layer=document.createElement("div");
    layer.className="track-layer";
  }

  const existing=new Map();

  layer.querySelectorAll("[data-track-index]").forEach(el=>{
    existing.set(
      Number(el.dataset.trackIndex),
      el
    );
  });

  game.revealedTracks.forEach((turn,i)=>{
    if(existing.has(i)){
      existing.delete(i);
      return;
    }

    const r=E.boxRow(i);
    const c=E.boxCol(i);

    const mark=document.createElement("div");
    mark.className="persistent-track";
    mark.dataset.trackIndex=String(i);

    mark.style.left=`${5 + c*19}%`;
    mark.style.top=`${5 + r*19}%`;
    mark.style.width="14%";
    mark.style.height="14%";

    const turnBadge=shouldShowTrackTurn(turn)
      ? `<b class="track-turn">${turn}</b>`
      : "";

    if(game.catHistory.get(i)===1){
      mark.innerHTML=`
        <span class="track-badge">
          <img
            class="start-art"
            src="./assets/images/start.png"
            alt="START"
          >
          ${turnBadge}
        </span>
      `;
    }else{
      mark.innerHTML=`
        <span class="track-badge">
          <img
            class="track-art"
            src="./assets/images/paw.png"
            alt="足跡"
          >
          ${turnBadge}
        </span>
      `;
    }

    layer.appendChild(mark);
  });

  // 今は存在しなくなった痕跡だけ削除
  existing.forEach(el=>el.remove());

  board.appendChild(layer);
}

  function renderBoard(){
    board.querySelectorAll(
  ":scope > .box, :scope > .node"
).forEach(el=>el.remove());

    for(let i=0;i<E.BOX_COUNT;i++){
      const r=E.boxRow(i),c=E.boxCol(i),b=document.createElement("button");
      b.type="button";
      b.className="box";
      b.dataset.boxIndex=String(i);
      // iPhone Safari compatibility:
      // avoid CSS calc() multiplication/division and place cells with simple percentages.
      b.style.left=`${5 + c*19}%`;
      b.style.top=`${5 + r*19}%`;
      b.style.width="14%";
      b.style.height="14%";

      if(game.phase==="catSetup"){
        b.classList.add("setup-cat-choice");
      }

      if(game.phase==="cat"&&game.catVisible){
        if(game.catHistory.has(i)&&i!==game.catPos)b.classList.add("cat-visited");
        if(i===game.catPos)b.classList.add("cat-current");
        if(E.getCatLegalMoves(game).includes(i)){
          b.classList.add("cat-valid");
          if(E.isCatDeadEnd(game,i))b.classList.add("cat-danger");
        }
      }

      if(game.phase==="dogs"&&game.selectedDog!==null&&!game.dogAction[game.selectedDog]&&!game.actionLocked){
        if(E.getBoxesAroundNode(game.dogs[game.selectedDog]).includes(i))b.classList.add("searchable");
      }
       if(
  game.phase==="dogs" &&
  game.selectedDog===0 &&
  game.policeAbilityPending==="howl" &&
  !game.policeAbilities.howlUsed &&
  !game.dogAction[0] &&
  !game.actionLocked &&
  E.getBoxesAroundNode(game.dogs[0]).includes(i)
){
  b.classList.add("howl-area");
}


      if(game.phase!=="cat"&&game.revealedTracks.has(i)){
        b.classList.add("revealed");
        if(game.catHistory.get(i)===1)b.classList.add("start-track");
      }

      b.innerHTML=`<span class="boxnum">${i+1}</span>
        <img class="box-art" src="./assets/images/box.png" alt="">
        ${playMode!=="cpuCat"&&game.phase==="cat"&&game.catVisible&&game.catPos===i?'<span class="cat"><img class="cat-art" src="./assets/images/cat_play_normal.png" alt="ネコ"></span>':""}
        ${privateHistoryHTML(i)}
        ${game.phase==="cat" &&
  game.catVisible &&
  game.catAbilityPending==="fakePaw" &&
  game.fakePawTarget===i
    ? `<span class="fake-paw-marker">
         ${game.fakePawConfirmed ? "🎭🐾" : "🐾?"}
       </span>`
    : ""
}
        ${game.phase==="cat"&&game.catVisible&&E.isCatDeadEnd(game,i)?'<span class="danger-mark">⚠️</span>':""}`;

      if(game.phase==="catSetup"){
        b.addEventListener("pointerdown",e=>{
          if(game.phase!=="catSetup"||game.actionLocked||game.gameOver)return;
          e.preventDefault();
          e.stopPropagation();
          handleBoxPress(i);
        },{passive:false});
        b.addEventListener("touchstart",e=>{
          if(game.phase!=="catSetup"||game.actionLocked||game.gameOver)return;
          e.preventDefault();
          e.stopPropagation();
          handleBoxPress(i);
        },{passive:false});
      }else{
        bindPress(b,()=>handleBoxPress(i));
      }
      board.appendChild(b);
    }

    for(let i=0;i<E.NODE_COUNT;i++){
      const r=E.nodeRow(i),c=E.nodeCol(i),n=document.createElement("button");
      n.type="button";
      n.className="node";
      n.style.left=`${2.5 + c*19}%`;
      n.style.top=`${2.5 + r*19}%`;

      if(!E.isActiveDogNode(i)){n.classList.add("inactive");n.disabled=true;}
      if(game.phase==="catSetup"){n.disabled=true;}
      if(game.phase==="dogSetup"&&E.isActiveDogNode(i))n.classList.add("setup");
      if(game.selectedDog!==null&&game.dogs[game.selectedDog]===i)n.classList.add("selected");

// 黒柴ダッシュ中
if(
  game.phase==="dogs" &&
  game.selectedDog===1 &&
  game.policeAbilityPending==="dash" &&
  !game.policeAbilities.dashUsed &&
  !game.dogAction[1] &&
  !game.actionLocked
){
  // ダッシュ中は2マス先だけ表示
if(E.getDogDashMoves(game,1).includes(i)){
  n.classList.add("dash-move");

  if(game.dashTarget===i){
    n.classList.add("dash-target");
  }
}

// 通常移動
}else if(
  game.phase==="dogs" &&
  game.selectedDog!==null &&
  !game.dogAction[game.selectedDog] &&
  !game.actionLocked &&
   game.policeAbilityPending!=="howl" &&
  E.getDogLegalMoves(game,game.selectedDog).includes(i)
){
  n.classList.add("move");
}

       if(
  game.phase==="dogs" &&
  game.selectedDog===1 &&
  game.policeAbilityPending==="dash" &&
  !game.policeAbilities.dashUsed &&
  !game.dogAction[1] &&
  !game.actionLocked &&
  E.getDogDashMoves(game,1).includes(i)
){
  n.classList.add("dash-move");
}

      const here=game.dogs.map((p,j)=>p===i?j:-1).filter(j=>j>=0);
      if(here.length){
        const s=document.createElement("span");
        s.className="dogstack";
        here.forEach(j=>{
          const t=document.createElement("span");
          t.className=`dogtoken ${E.DOGS[j].token}`;
          const dogImg=["dog_red.png","dog_green.png","dog_blue.png"][j];
          t.innerHTML=`<img src="./assets/images/${dogImg}" alt="${E.DOGS[j].name}">`;
          s.appendChild(t);
        });
        n.appendChild(s);
      }

      if(!n.disabled)bindPress(n,()=>handleNodePress(i));
      board.appendChild(n);
    }
     renderTrackLayer();
  }

  function privateHistoryHTML(i){
    if(playMode==="cpuCat")return"";
    if(game.phase!=="cat"||!game.catVisible||!game.catHistory.has(i))return"";
    if(game.catHistory.get(i)===1){
      return'<span class="private-foot private-start"><img src="./assets/images/start.png" alt="スタート"></span>';
    }
    return'<span class="private-foot"><img src="./assets/images/paw.png" alt="足跡"></span>';
  }

  function shouldShowTrackTurn(turn){
    // ターン数字は「プレイヤー＝警察 / CPUネコ戦」の難易度ヒントだけ。
    if(playMode!=="cpuCat") return false;
    if(cpuDifficulty==="easy") return turn===3||turn===6||turn===9;
    if(cpuDifficulty==="normal") return turn===6;
    return false; // hard / つよい
  }

function publicTrackHTML(i){
  if(!game.revealedTracks.has(i)) return "";

  const turn =
    game.revealedTracks.get(i) ??
    game.catHistory.get(i);

  const turnBadge = shouldShowTrackTurn(turn)
    ? `<b class="track-turn">${turn}</b>`
    : "";

  if(game.catHistory.get(i) === 1){
    return `
      <span class="track-badge">
        <img
          class="start-art"
          src="./assets/images/start.png"
          alt="START"
          decoding="sync"
          draggable="false"
        >
        ${turnBadge}
      </span>
    `;
  }

  return `
    <span class="track-badge">
      <img
        class="track-art"
        src="./assets/images/paw.png"
        alt="足跡"
        decoding="sync"
        draggable="false"
      >
      ${turnBadge}
    </span>
  `;
}


  function handleBoxPress(i){
    if(game.gameOver||game.actionLocked)return;
    A.tapPopBox(board,i);

    if(game.phase==="catSetup"){
      // The exact tapped cardboard is the starting position.
      // Nodes are disabled during this phase so mobile taps cannot be stolen.
      game.actionLocked=true;
      const chosenStart=Number(i);

      A.tapPopBox(board,chosenStart);
      Audio.play("cat");
      Audio.haptic(16);

      cpuTimer=setTimeout(()=>{
        game.catPos=chosenStart;
        game.catHistory.clear();
        game.catHistory.set(chosenStart,1);
        game.catVisible=false;
game.turn=1;

if(playMode==="onlineCat"){
  window.NyanOnline.sendGame({
    type:"catSetup",
    catPos:chosenStart
  });
}

if(playMode==="onlineCat"){
  game.phase="onlineWaitingPolice";
}else{
  game.phase="dogs";
}

game.selectedDog=null;
game.dogAction=[false,false,false];
game.cpuSearchesThisTurn=0;
game.actionLocked=false;

        showPhaseCue("🐕","柴犬警察の捜査！");

        if(playMode==="cpuPolice"){
          setMessage("🤖 CPU柴犬警察が捜査中…");
          render();
          cpuTimer=setTimeout(runCpuPoliceTurn,650);
        }else{
          showPrivacy("🐕","柴犬警察の番",
            "ネコが隠れました。現在地は秘密です。柴犬警察が捜査を開始します。");
          setMessage("🐕 柴犬を選択。緑の交差点＝移動、青い箱＝探索です。");
          render();
        }
      },180);

      return;
    }

    if(game.phase==="cat"){
      if(!game.catVisible){
        setMessage("まず「👀 ネコ位置を見る」をタップしてください。");
        return;
      }
       
       // フェイク肉球：まず偽足跡を置く箱を選ぶ
// ---------------------------------
// フェイク肉球モード
// 確定するまでは猫自身は移動しない
// ---------------------------------
if(
  game.catAbilityPending==="fakePaw" &&
  !game.fakePawConfirmed
){
  const legalMoves=
    E.getCatLegalMoves(game);

  // 現在地は選択不可
  if(i===game.catPos){
    Audio.play("invalid");

    setMessage(
      "🎭🐾 今いる箱にはフェイク肉球を置けません。"
    );

    return;
  }

  // 通常なら移動可能な箱だけ候補
  if(!legalMoves.includes(i)){
    Audio.play("invalid");

    setMessage(
      "🎭🐾 光っている隣の箱から、偽の足跡を置く場所を選んでください。"
    );

    return;
  }

  // 仮選択位置を変更
  game.fakePawTarget=i;

  Audio.haptic(10);

  setMessage(
    `🎭🐾 箱${i+1}を仮選択中。別の箱を選び直すか、「この場所に確定」を押してください。`
  );

  render();

  // ★ここで必ず終了
  // 猫は絶対に移動させない
  return;
}

      if(!E.getCatLegalMoves(game).includes(i)){
        Audio.play("invalid");
        setMessage("グレー＝移動不可。緑＝11ターン目まで逃げ切れる道あり、赤⚠️＝残りターンを逆算すると詰みです。");
        return;
      }

      const dead=E.isCatDeadEnd(game,i);
      const from=game.catPos;

       const useSneak=
  game.abilitiesEnabled &&
  playMode==="local" &&
  game.catAbilityPending==="sneak" &&
  !game.catAbilities.sneakUsed;

       const useFakePaw=
  game.abilitiesEnabled &&
  playMode==="local" &&
  game.catAbilityPending==="fakePaw" &&
  game.fakePawConfirmed &&
  game.fakePawTarget!==null &&
  !game.catAbilities.fakePawUsed;

      // 猫移動中も入力ロック
      game.actionLocked=true;
      Audio.haptic(10);
      Audio.play("cat");

A.animateCatMove(board,from,i,()=>{

  // 忍び足を使った場合、
  // 移動前にいた箱には痕跡を残さない
  if(useSneak){
    game.noTrackBoxes.add(from);
    game.catAbilities.sneakUsed=true;
    game.catAbilityPending=null;
  }

   // フェイク肉球を使った場合
if(useFakePaw){

  // 選択した箱へ偽の足跡を保存
  game.fakeTracks.set(
    game.fakePawTarget,
    game.turn
  );

  game.catAbilities.fakePawUsed=true;

  game.catAbilityPending=null;
  game.fakePawTarget=null;
  game.fakePawConfirmed=false;
}

  game.catPos=i;
  game.catHistory.set(i,game.turn);
  game.catVisible=false;

        if(playMode==="onlineCat"){
  window.NyanOnline.sendGame({
    type:"catMove",
    catPos:i,
    turn:game.turn
  });
} 
         
         if(playMode==="onlineCat"){
  game.phase="onlineWaitingPolice";
}else{
  game.phase="dogs";
}

game.selectedDog=null;
game.dogAction=[false,false,false];
game.cpuSearchesThisTurn=0;
game.actionLocked=false;
         

        // 1〜10ターン目は、次の逃げ道が無ければ警察勝利。
        // 11ターン目は次の12ターン目が存在しないため、
        // 行き止まりでもそのまま警察の最終捜索へ進む。
if(game.turn<E.MAX_TURNS && (dead||E.getCatLegalMoves(game).length===0)){
  game.actionLocked=false;

  if(playMode==="onlineCat"){
    window.NyanOnline.sendGame({
      type:"catNoEscape",
      turn:game.turn
    });
  }

  endGame(
    "dogs",
    "ネコが行き止まりに入り、次の逃げ道がなくなりました！"
  );

  return;
}


      if(playMode==="cpuPolice"){
  setMessage("🤖 柴犬警察CPUが捜査中…");
  render();
  cpuTimer=setTimeout(runCpuPoliceTurn,550);

}else if(playMode==="onlineCat"){
  setMessage("🐱 柴犬警察が捜査中です…");
  render();

}else{
  showPrivacy(
    "🐕",
    "柴犬警察の番",
    "ネコの移動が完了しました。現在地と未発見の足跡は隠れています。"
  );

  setMessage(
    "🐕 柴犬を選択すると、緑の交差点へ移動・青い箱を探索できます。"
  );

  render();
}
      
      });
      render();
      return;
    }

     if(
  game.phase==="dogs" &&
  game.selectedDog===0 &&
  game.policeAbilityPending==="howl"
){
  setMessage(
    "📣 遠吠えモード中です。「遠吠えを確定」を押してください。"
  );
  return;
}
     
    if(game.phase==="dogs"&&game.selectedDog!==null&&!game.dogAction[game.selectedDog]){
      const di=game.selectedDog;
      if(!E.getBoxesAroundNode(game.dogs[di]).includes(i)){
        setMessage("青く光っている箱から1つ選んでください。");
        return;
      }
      performSearch(di,i);
    }
  }

  function handleNodePress(i){
    if(game.gameOver||game.actionLocked||!E.isActiveDogNode(i))return;

    if(game.phase==="dogSetup"){
      if(playMode==="cpuPolice") return;

      if(game.dogs.includes(i)){
        setMessage("その交差点にはすでに柴犬がいます。");
        return;
      }

      const di=game.dogSetupCount;
      game.dogs[di]=i;
      game.dogSetupCount++;

      if(game.dogSetupCount>=3){
        if(playMode==="cpuCat"){
          game.phase="catSetup";
          game.turn=1;
          setMessage("🐱 CPUネコが隠れ場所を考えています…");
          render();
          cpuTimer=setTimeout(cpuCatInitialHide,250);
          return;
        }

         if(playMode==="onlinePolice"){
  window.NyanOnline.sendGame({
    type:"dogSetup",
    dogs:[...game.dogs]
  });

  game.phase="onlineWaitingCatSetup";
  game.turn=0;

  showPrivacy(
    "🐕",
    "配置完了！",
    "柴犬警察3匹の配置をネコ側へ送りました。ネコが隠れ場所を決めるまで待ってね。"
  );

  setMessage("🐕 ネコが隠れ場所を決めています…");

  render();
  return;
}

        game.phase="catSetup";
        game.turn=1;
        showPrivacy("🐱","逃走1ターン目・ネコの番",
          "柴犬警察の配置を確認して、スタート地点にする箱を1つ選んでください。");
        setMessage("🐱 柴犬の配置を見て、好きな箱に隠れよう。");
      }else{
        setMessage(`${E.DOGS[di].label} ${E.DOGS[di].name} を配置しました。次の柴犬を配置してください。`);
      }

      render();
      return;
    }

    if(game.phase!=="dogs")return;

    const tapped=game.dogs.findIndex(p=>p===i);
    if(tapped!==-1){
      selectDog(tapped);
      return;
    }

    if(game.selectedDog!==null&&!game.dogAction[game.selectedDog]){
      const di=game.selectedDog;
if(
  di===0 &&
  game.policeAbilityPending==="howl"
){
  Audio.play("invalid");

  setMessage(
    "📣 遠吠えモード中です。「遠吠えを確定」するか、特殊スキルをキャンセルしてください。"
  );

  return;
}
       
// ---------------------------------
// 黒柴ダッシュ中
// 確定するまでは黒柴を移動させない
// ---------------------------------
if(
  di===1 &&
  game.policeAbilityPending==="dash" &&
  !game.policeAbilities.dashUsed
){
  const dashMoves=
    E.getDogDashMoves(game,1);

  if(!dashMoves.includes(i)){
    Audio.play("invalid");

    setMessage(
      "⚡ 黄色く光っている2マス先の交差点を選んでください。"
    );

    return;
  }

  // ダッシュ先を仮選択
  // 別の候補を押せば何度でも変更できる
  game.dashTarget=i;
  game.dashConfirmed=false;

  Audio.haptic(10);

  setMessage(
    "⚡ ダッシュ先を仮選択しました。別の黄色い交差点を選び直すか、「ダッシュ確定」を押してください。"
  );

  render();
  return;
}

      if(!E.getDogLegalMoves(game,di).includes(i)){
        setMessage("緑色に光っている交差点へ1マス移動できます。");
        return;
      }
 // 移動は即時確定。以後この犬は行動不可。
Audio.play("move");
game.dogs[di]=i;

if(playMode==="onlinePolice"){
  window.NyanOnline.sendGame({
    type:"dogMove",
    dogIndex:di,
    node:i
  });
}

game.dogAction[di]="move";
game.selectedDog=null;
      setMessage(`${E.DOGS[di].label} ${E.DOGS[di].name} は移動済み✓。`);
      afterDogAction();
      render();
    }
  }

  function selectDog(di){
if(
  playMode!=="local" &&
  playMode!=="cpuCat" &&
  playMode!=="onlinePolice"
)return;    if(game.phase!=="dogs"||game.gameOver||game.actionLocked||game.dogs[di]===null)return;

    if(game.dogAction[di]){
      setMessage(`${E.DOGS[di].label} ${E.DOGS[di].name} はこのターン行動済みです。`);
      return;
    }

    if(game.selectedDog===di){
      game.selectedDog=null;
      setMessage("柴犬の選択を解除しました。");
      render();
      return;
    }

    game.selectedDog=di;
        setMessage(`${E.DOGS[di].label} ${E.DOGS[di].name} を選択。緑の交差点＝移動、青い箱＝探索です。`);
    render();
  }

  function performSearch(di,bi){
    // 探索開始時点で行動を確定し、演出中の二重行動を防ぐ。
    game.dogAction[di]="search";
    game.selectedDog=null;
    game.actionLocked=true;
if(playMode==="onlinePolice"){

  // ★ 警察側でも探索開始SE
  Audio.play("sniff");

  window.NyanOnline.sendGame({
    type:"search",
    dogIndex:di,
    box:bi
  });

  setMessage(
    `${E.DOGS[di].label} ${E.DOGS[di].name} がクンクン調査中…`
  );

  render();
  return;
}

    if(playMode==="cpuPolice"){
      game.cpuSearchedBoxes.add(bi);
      game.cpuSearchCount++;
      game.cpuSearchesThisTurn++;
    }

    render();

    A.animateSniff(board,game.dogs[di],di,bi,motionStatus,()=>{
      if(bi===game.catPos){
        Audio.play("capture");
        Audio.haptic([35,45,70]);
        A.burstAtBox(board,bi,"🐱✨");
        game.actionLocked=false;
        endGame("dogs",`${E.DOGS[di].name} が箱${bi+1}をクンクン……ネコを発見！`);
        return;
      }
const hasRealTrack=
  game.catHistory.has(bi) &&
  !game.noTrackBoxes.has(bi);

const hasFakeTrack=
  game.fakeTracks.has(bi);

if(hasRealTrack || hasFakeTrack){
  // まだ発見していない痕跡かどうか
  const isNewTrack = !game.revealedTracks.has(bi);

const trackTurn=
  hasRealTrack
    ? game.catHistory.get(bi)
    : game.fakeTracks.get(bi);

game.revealedTracks.set(
  bi,
  trackTurn
);

  if(!cpuMemory.discoveredTrackBoxes.includes(bi)){
    cpuMemory.discoveredTrackBoxes.push(bi);
  }

  // ★ 初めて発見した瞬間だけ演出
if(isNewTrack){
  const foundBox=board.querySelector(
    `.box[data-box-index="${bi}"]`
  );

  if(foundBox){
    foundBox.classList.remove("found-track");
    void foundBox.offsetWidth;
    foundBox.classList.add("found-track");

    // 1回の演出が終わったらクラスも外す
    setTimeout(()=>{
      foundBox.classList.remove("found-track");
    },700);
  }

  Audio.haptic([15,35,25]);
}

if(
  hasRealTrack &&
  game.catHistory.get(bi)===1
){

  // START発見時もBGMを下げる
  Audio.duckBgm(900);

  setTimeout(()=>{
    Audio.play("start");
  },60);

  A.burstAtBox(board,bi,"🚩✨");

  showToast(
    "🚩",
    "スタート地点を発見！",
    "ここから逃げ始めたみたいだワン！"
  );

}else{

  // 足跡発見
  Audio.duckBgm(900);

  setTimeout(()=>{
    Audio.play("paw");
  },60);

  A.burstAtBox(board,bi,"🐾✨");

  showToast(
    "🐕🐾",
    "クンクン……！",
    "ネコの足跡を発見！"
  );
}
      }else{
        if(playMode==="cpuPolice"){
  cpuMemory.emptyBoxes.set(bi, game.turn);

  if(!cpuMemory.emptyByTurn.has(game.turn)){
    cpuMemory.emptyByTurn.set(game.turn,new Set());
  }

  cpuMemory.emptyByTurn
    .get(game.turn)
    .add(bi);
}
        const emptyBox=board.querySelector(`.box[data-box-index="${bi}"]`);
        if(emptyBox){
          emptyBox.classList.remove("empty-search");
          void emptyBox.offsetWidth;
          emptyBox.classList.add("empty-search");
        }
        Audio.play("empty");
        Audio.haptic(10);
        A.burstAtBox(board,bi,"💨");
        showToast("💨","クンクン……","何もないワン！");
      }

      game.actionLocked=false;
      setMessage(`${E.DOGS[di].label} ${E.DOGS[di].name} は探索済み✓。`);
      afterDogAction();
      render();
    });
  }

  function afterDogAction(){
    if(!E.allDogsDone(game))return;

    // CPU戦では waitingEnd に切り替えない。
    // 3匹目が「探索」だった場合、探索アニメーション終了後に
    // runCpuPoliceTurn() がもう一度呼ばれ、di === -1 を検知して
    // cpuFinishTurn() → ネコ側へ切り替える。
    //
    // ここで waitingEnd にしてしまうと runCpuPoliceTurn() 冒頭の
    // phase !== "dogs" 判定で処理が止まり、CPUターンが終了できない。
    if(playMode==="cpuPolice"){
      return;
    }

    game.phase="waitingEnd";
    setMessage("✅ 3匹の行動が完了しました。「柴犬ターン終了」を押してください。");
  }

  function toggleCatView(){
    if(game.phase!=="cat"||game.gameOver||game.actionLocked)return;
    game.catVisible=!game.catVisible;
    setMessage(game.catVisible
      ?"🐱 自分の足跡を表示中。グレー＝通過済み、緑＝移動可、赤⚠️＝行き止まり。"
      :"🙈 ネコの位置と足跡を隠しました。");
    render();
  }
   function toggleSneak(){
  if(!game.abilitiesEnabled) return;
  if(playMode!=="local") return;
  if(game.phase!=="cat") return;
  if(game.gameOver) return;
  if(game.actionLocked) return;
  if(game.catAbilities.sneakUsed) return;
      if(game.catHistory.get(game.catPos)===1){
  setMessage("🚩 スタート地点では忍び足は使えません。");
  return;
}

  if(game.catAbilityPending==="sneak"){
    game.catAbilityPending=null;
  }else{
    game.catAbilityPending="sneak";
  }

  render();
}


   function cancelPendingAbility(){

  // フェイク肉球
  if(
    game.catAbilityPending==="fakePaw" &&
    !game.fakePawConfirmed
  ){
    game.catAbilityPending=null;
    game.fakePawTarget=null;
    game.fakePawConfirmed=false;

    setMessage(
      "フェイク肉球をキャンセルしました。通常の移動に戻ります。"
    );

    render();
    return;
  }

      if(
  game.policeAbilityPending==="howl"
){
  game.policeAbilityPending=null;

  setMessage(
    "赤柴・遠吠えをキャンセルしました。通常の行動に戻ります。"
  );

  render();
  return;
}

  // 黒柴ダッシュ
  if(
    game.policeAbilityPending==="dash" &&
    !game.dashConfirmed
  ){
    game.policeAbilityPending=null;
    game.dashTarget=null;
    game.dashConfirmed=false;

    setMessage(
      "黒柴ダッシュをキャンセルしました。通常の行動に戻ります。"
    );

    render();
    return;
  }
}

function toggleFakePaw(){
  if(!game.abilitiesEnabled) return;
  if(playMode!=="local") return;
  if(game.phase!=="cat") return;
  if(game.gameOver) return;
  if(game.actionLocked) return;
  if(game.catAbilities.fakePawUsed) return;

  // ---------------------------------
  // ① 箱を仮選択済み → 確定する
  // ---------------------------------
  if(
    game.catAbilityPending==="fakePaw" &&
    game.fakePawTarget!==null &&
    !game.fakePawConfirmed
  ){
    game.fakePawConfirmed=true;

    Audio.haptic(15);

    setMessage(
      `🎭🐾 箱${game.fakePawTarget+1}にフェイク肉球を仕掛けます。本当に逃げる別の箱を選んでください。`
    );

    render();
    return;
  }

  // ---------------------------------
  // ② すでに確定済み
  // ---------------------------------
  if(
    game.catAbilityPending==="fakePaw" &&
    game.fakePawConfirmed
  ){
    setMessage(
      "🎭🐾 フェイク肉球は確定済みです。本当に逃げる箱を選んでください。"
    );
    return;
  }

  // 忍び足を選択していたら解除
  if(game.catAbilityPending==="sneak"){
    game.catAbilityPending=null;
  }

  // ---------------------------------
  // ③ フェイク肉球をON
  // ---------------------------------
  if(game.catAbilityPending!=="fakePaw"){
    game.catAbilityPending="fakePaw";
    game.fakePawTarget=null;
    game.fakePawConfirmed=false;

    setMessage(
      "🐾 フェイク肉球を置く箱を選んでください。"
    );

  // ---------------------------------
  // ④ 箱を選ぶ前ならキャンセル可能
  // ---------------------------------
  }else{
    game.catAbilityPending=null;
    game.fakePawTarget=null;
    game.fakePawConfirmed=false;

    setMessage(
      "フェイク肉球をキャンセルしました。"
    );
  }

  render();
}

function toggleHowl(){
  if(!game.abilitiesEnabled) return;
  if(playMode!=="local") return;
  if(game.phase!=="dogs") return;
  if(game.gameOver) return;
  if(game.actionLocked) return;

  // 赤柴だけ
  if(game.selectedDog!==0){
    setMessage(
      "📣 赤柴を選択してから遠吠えを使ってください。"
    );
    return;
  }

  if(game.dogAction[0]){
    setMessage(
      "📣 赤柴はこのターンすでに行動済みです。"
    );
    return;
  }

  if(game.policeAbilities.howlUsed) return;


  // ---------------------------------
  // ① 遠吠えモード中 → 確定して実行
  // ---------------------------------
  if(game.policeAbilityPending==="howl"){

    const howlBoxes=
      E.getBoxesAroundNode(game.dogs[0]);

    const catInside=
      howlBoxes.includes(game.catPos);

    // 能力使用済み
    game.policeAbilities.howlUsed=true;

    // 赤柴の行動終了
    game.dogAction[0]="howl";

    // 能力モード解除
    game.policeAbilityPending=null;

    // 赤柴選択解除
    game.selectedDog=null;

    Audio.haptic([20,30,20]);

    if(catInside){
      setMessage(
        "📣 赤柴の遠吠え！この範囲にネコの気配があります！"
      );

      showToast(
        "👀",
        "気配あり！",
        "この範囲のどこかにネコがいるワン！"
      );

    }else{
      setMessage(
        "📣 赤柴の遠吠え！この範囲にネコの気配はありません。"
      );

      showToast(
        "💨",
        "気配なし",
        "この範囲にはネコはいないみたいだワン。"
      );
    }

    afterDogAction();
    render();
    return;
  }


  // ---------------------------------
  // ② 遠吠えモード開始
  // ---------------------------------
  game.policeAbilityPending="howl";

  setMessage(
    "📣 赤柴の周囲4箱が遠吠え対象です。もう一度「遠吠え」を押すと確定します。"
  );

  render();
}

function toggleDash(){
  if(!game.abilitiesEnabled) return;
  if(playMode!=="local") return;
  if(game.phase!=="dogs") return;
  if(game.gameOver) return;
  if(game.actionLocked) return;

  // 黒柴だけ
  if(game.selectedDog!==1){
    setMessage(
      "⚡ 黒柴を選択してからダッシュを使ってください。"
    );
    return;
  }

  if(game.dogAction[1]){
    setMessage(
      "⚡ 黒柴はこのターンすでに行動済みです。"
    );
    return;
  }

  if(game.policeAbilities.dashUsed) return;


  // ---------------------------------
  // ① ダッシュ先を仮選択済み
  // → ここで確定して実際に移動
  // ---------------------------------
  if(
    game.policeAbilityPending==="dash" &&
    game.dashTarget!==null
  ){
    const target=game.dashTarget;

    // 念のため再チェック
    if(!E.getDogDashMoves(game,1).includes(target)){
      game.dashTarget=null;

      setMessage(
        "⚡ その場所にはダッシュできません。もう一度選んでください。"
      );

      render();
      return;
    }

    game.dashConfirmed=true;

    Audio.play("move");
    Audio.haptic([15,25,15]);

    // 黒柴を2マス先へ移動
    game.dogs[1]=target;

    // 能力を消費
    game.policeAbilities.dashUsed=true;

    // 黒柴はこのターン行動終了
    game.dogAction[1]="move";

    // 状態を解除
    game.policeAbilityPending=null;
    game.dashTarget=null;
    game.dashConfirmed=false;
    game.selectedDog=null;

    setMessage(
      "⚡ 黒柴ダッシュ！2マス移動しました。"
    );

    afterDogAction();
    render();
    return;
  }


  // ---------------------------------
  // ② ダッシュモードをキャンセル
  // ---------------------------------
  if(game.policeAbilityPending==="dash"){
    game.policeAbilityPending=null;
    game.dashTarget=null;
    game.dashConfirmed=false;

    setMessage(
      "黒柴ダッシュをキャンセルしました。"
    );

  // ---------------------------------
  // ③ ダッシュモード開始
  // ---------------------------------
  }else{
    game.policeAbilityPending="dash";
    game.dashTarget=null;
    game.dashConfirmed=false;

    setMessage(
      "⚡ 黒柴ダッシュ！黄色く光っている2マス先から移動先を選んでください。"
    );
  }

  render();
}

  function finishDogTurn(){
    if(game.phase!=="waitingEnd"||game.gameOver||game.actionLocked)return;

    if(playMode==="cpuCat"){
      runCpuCatTurn();
      return;
    }
     if(playMode==="onlinePolice"){
  window.NyanOnline.sendGame({
    type:"dogTurnEnd",
    turn:game.turn
  });

  game.phase="onlineWaitingCatMove";

  setMessage(
    "🐕 ネコが次の逃げ先を決めています…"
  );

  render();
  return;
}

    if(game.turn>=E.MAX_TURNS){
      endGame("cat","11ターンすべて逃げ切りました！");
      return;
    }

    game.turn++;

    if(E.getCatLegalMoves(game).length===0){
      endGame("dogs","ネコが次に移動できる箱がありません！");
      return;
    }

    game.phase="cat";
    game.catVisible=false;
    game.selectedDog=null;
    game.dogAction=[false,false,false];

    let extra=game.turn===9?" あと3ターン！"
      :game.turn===10?" あと2ターン！"
      :game.turn===11?" LAST TURN！":"";

    showPrivacy("🐱",`ターン${game.turn}・ネコの番`,
      `柴犬警察から画面を受け取ってください。ネコさんだけ足跡と現在地を確認します。${extra}`);
    setMessage(`🐱 ターン${game.turn}。まだ通っていない隣の箱へ移動しよう。${extra}`);
    render();
  }

  function renderStatus(){
    const currentTurn=Math.max(0,Math.min(E.MAX_TURNS,game.turn));
    const remaining=game.turn===0 ? 11 : Math.max(0,E.MAX_TURNS-game.turn+1);
    turnDisplay.textContent=`${currentTurn} / ${E.MAX_TURNS}`;

    document.body.classList.remove("turn-mid","turn-late","turn-last");
    if(currentTurn>=8 && currentTurn<=9) document.body.classList.add("turn-mid");
    if(currentTurn===10) document.body.classList.add("turn-late");
    if(currentTurn===11) document.body.classList.add("turn-last");

    if(currentTurn===11 && !game.gameOver && !lastTurnStingerPlayed){
      lastTurnStingerPlayed=true;
      if(lastTurnBanner) lastTurnBanner.classList.remove("show");
      if(lastTurnBanner) void lastTurnBanner.offsetWidth;
      if(lastTurnBanner) lastTurnBanner.classList.add("show");
      Audio.play("lastturn");
      Audio.haptic([30,35,30]);
    }

    // BGM changes reliably for the final 3 escape turns.
    if(game.turn>0 && remaining<=3 && !game.gameOver){
      Audio.setBgmMode("tension");
      document.body.classList.add("final-three");
    }else{
      Audio.setBgmMode("normal");
      document.body.classList.remove("final-three");
    }

    const phases={
      dogSetup:"🐕 警察配置",
      catSetup:"🐱 ネコ潜伏",
      cat:"🐱 ネコ移動",
      dogs:"🐕 柴犬捜査",
      waitingEnd:"🐕 捜査完了",
      gameover:"🎉 ゲーム終了"
    };
    phaseDisplay.textContent=phases[game.phase]||"";

    document.body.classList.remove("phase-cat","phase-dogs","phase-setup","phase-cat-setup");
    if(game.phase==="cat"||game.phase==="catSetup") document.body.classList.add("phase-cat");
    else if(game.phase==="dogs"||game.phase==="waitingEnd") document.body.classList.add("phase-dogs");
    else document.body.classList.add("phase-setup");
    if(game.phase==="catSetup") document.body.classList.add("phase-cat-setup");

    if(lastRenderedPhase!==game.phase){
      if(game.phase==="catSetup") showPhaseCue("🐱","好きな箱に隠れよう！");
      else if(game.phase==="cat") showPhaseCue("🐱","ネコの逃走！");
      else if(game.phase==="dogs") showPhaseCue("🐕","柴犬警察の捜査！");
      lastRenderedPhase=game.phase;
    }

    if(game.actionLocked){
      guideDisplay.textContent=game.phase==="dogs"?"🐕 クンクン調査中…":"🐱 逃走中…";
    }else if(game.phase==="dogSetup"){
      guideDisplay.textContent=`0ターン目：中央16交差点に柴犬を配置 ${game.dogSetupCount}/3`;
    }else if(game.phase==="catSetup"){
      guideDisplay.textContent="逃走1ターン目：柴犬の配置を見てスタート地点を選ぼう";
    }else if(game.phase==="cat"){
      guideDisplay.textContent=game.catVisible
        ?"緑＝安全 / 赤⚠️＝危険 / グレー＝移動不可"
        :"「ネコ位置を見る」で現在地と逃げ道を確認";
    }else if(game.phase==="dogs"){
      guideDisplay.textContent=playMode==="cpuPolice"
        ?`CPU柴犬警察（${{easy:"やさしい",normal:"ふつう",hard:"つよい"}[cpuDifficulty]}）が捜査中…`
        :(game.selectedDog===null
          ?"柴犬を選択して、交差点へ移動 or 箱を探索"
          :"緑の交差点＝移動 / 青い箱＝探索");
    }else if(game.phase==="waitingEnd"){
      guideDisplay.textContent=playMode==="cpuPolice"?"CPUの捜査終了":"柴犬ターン終了をタップ";
    }else{
      guideDisplay.textContent="ゲーム終了";
    }
  }

  function renderDogCards(){
    for(let i=0;i<3;i++){
      const c=dogCards[i];
      c.classList.remove("selected","done");
      const pos=game.dogs[i];
      let status="未配置";

      if(pos!==null){
        if(game.dogAction[i]==="move"){
          status="移動済み ✓";
          c.classList.add("done");
        }else if(game.dogAction[i]==="search"){
          status=game.actionLocked?"探索中…":"探索済み ✓";
          c.classList.add("done");
        }else{
          status="行動できます";
        }
      }

      const dogImg=["dog_card_red.png","dog_card_green.png","dog_card_blue.png"][i];
      const role=playMode==="cpuPolice" ? ["探索に強い","バランス型","移動に強い"][i] : "";
      c.innerHTML=`<span class="dog-name"><img class="character-img" src="./assets/images/${dogImg}" alt="">${E.DOGS[i].name}</span>
        ${role?`<span class="dog-role">${role}</span>`:""}
        <span class="dog-status">${status}</span>`;
      if(game.selectedDog===i)c.classList.add("selected");

c.disabled=!(
  (
    playMode==="local" ||
    playMode==="cpuCat" ||
    playMode==="onlinePolice"
  ) &&
  game.phase==="dogs" &&
  pos!==null &&
  !game.dogAction[i] &&
  !game.actionLocked
);
    }
  }

  function renderControls(){
    const isCatPhase=(game.phase==="cat"||game.phase==="catSetup");

    const shouldHideDogs=isCatPhase;
    const wasHidden=dogRow.classList.contains("is-hidden");
    dogRow.classList.toggle("is-hidden",shouldHideDogs);

    if(!shouldHideDogs && wasHidden){
      dogRow.classList.remove("phase-enter");
      void dogRow.offsetWidth;
      dogRow.classList.add("phase-enter");
    }

    tracksSummary.style.display=(game.phase==="dogSetup"||game.phase==="catSetup")?"none":"flex";
tracksFoundCount.textContent=String(
  playMode==="onlineCat"
    ? onlineFoundTrackCount
    : game.revealedTracks.size
);
    catViewBtn.classList.toggle("show",game.phase==="cat");
    catViewBtn.disabled=game.phase!=="cat"||game.gameOver||game.actionLocked;
    catViewBtn.textContent=game.catVisible?"🙈 ネコ位置を隠す":"👀 ネコ位置を見る";
const canUseSneak=
  game.abilitiesEnabled &&
  playMode==="local" &&
  game.phase==="cat" &&
   game.catVisible &&
  !game.gameOver &&
  !game.actionLocked &&
  !game.catAbilities.sneakUsed &&
  game.catHistory.get(game.catPos)!==1;

const showSneakBtn=
  game.abilitiesEnabled &&
  playMode==="local" &&
  game.phase==="cat" &&
  game.selectedAbilities.cat==="sneak";

sneakBtn.style.display=
  showSneakBtn ? "" : "none";

sneakBtn.disabled=
  !canUseSneak;

const isStartBox=
  game.catHistory.get(game.catPos)===1;

sneakBtn.textContent=
  game.catAbilities.sneakUsed
    ? "🐾 忍び足 使用済み"
    : !game.catVisible
      ? "🐾 忍び足｜先にネコ位置を確認"
      : isStartBox
        ? "🐾 忍び足｜スタート地点では使用できません"
        : game.catAbilityPending==="sneak"
          ? "✨🐾 忍び足 発動中！"
          : "🐾 忍び足";

     document.body.classList.toggle(
  "sneak-active",
  game.catAbilityPending==="sneak"
);

     const showSneakBanner=
  game.abilitiesEnabled &&
  playMode==="local" &&
  game.phase==="cat" &&
  game.catVisible &&
  game.catAbilityPending==="sneak" &&
  !game.catAbilities.sneakUsed;

sneakBanner.classList.toggle(
  "show",
  showSneakBanner
);

const canUseFakePaw=
  game.abilitiesEnabled &&
  playMode==="local" &&
  game.phase==="cat" &&
   game.catVisible &&
  !game.gameOver &&
  !game.actionLocked &&
  !game.catAbilities.fakePawUsed;

const showFakePawBtn=
  game.abilitiesEnabled &&
  playMode==="local" &&
  game.phase==="cat" &&
  game.selectedAbilities.cat==="fakePaw";

fakePawBtn.style.display=
  showFakePawBtn ? "" : "none";

fakePawBtn.disabled=
  !canUseFakePaw;

fakePawBtn.textContent=
  game.catAbilities.fakePawUsed
    ? "🐾 フェイク肉球 使用済み"

    : !game.catVisible
      ? "🐾 フェイク肉球｜先にネコ位置を確認"

    : game.catAbilityPending==="fakePaw" &&
      game.fakePawTarget!==null &&
      !game.fakePawConfirmed
      ? `✅ 箱${game.fakePawTarget+1}｜この場所に確定`

    : game.catAbilityPending==="fakePaw" &&
      game.fakePawConfirmed
      ? "🎭🐾 フェイク肉球 発動中！"

    : game.catAbilityPending==="fakePaw"
      ? "🎭🐾 フェイク肉球｜場所を選択中"

    : "🐾 フェイク肉球";
     const showFakePawBanner=
  game.abilitiesEnabled &&
  playMode==="local" &&
  game.phase==="cat" &&
  game.catVisible &&
  game.catAbilityPending==="fakePaw" &&
  !game.catAbilities.fakePawUsed;

fakePawBanner.classList.toggle(
  "show",
  showFakePawBanner
);

if(showFakePawBanner){

  if(
    game.fakePawTarget!==null &&
    game.fakePawConfirmed
  ){
    fakePawBannerTitle.textContent=
      "🎭🐾 フェイク肉球 発動中";

    fakePawBannerText.textContent=
      `箱${game.fakePawTarget+1}に偽の足跡を仕掛けます。本当に逃げる別の箱を選んでください`;

  }else if(game.fakePawTarget!==null){

    fakePawBannerTitle.textContent=
      "🎭🐾 フェイク肉球 仮選択中";

    fakePawBannerText.textContent=
      `箱${game.fakePawTarget+1}を選択中です。「確定」を押してください`;

  }else{

    fakePawBannerTitle.textContent=
      "🎭🐾 フェイク肉球 選択中";

    fakePawBannerText.textContent=
      "警察をだます偽の足跡を置く箱を選んでください";
  }
}

finishDogTurnBtn.classList.toggle(
  "show",
  (
    playMode==="local" ||
    playMode==="cpuCat" ||
    playMode==="onlinePolice"
  ) &&
  game.phase==="waitingEnd"
);   

     document.body.classList.toggle(
  "fake-paw-mode",
  game.catAbilityPending==="fakePaw" &&
  !game.fakePawConfirmed
);
const canUseHowl=
  game.abilitiesEnabled &&
  playMode==="local" &&
  game.phase==="dogs" &&
  game.selectedAbilities.police==="howl" &&
  game.selectedDog===0 &&
  !game.dogAction[0] &&
  !game.policeAbilities.howlUsed &&
  !game.gameOver &&
  !game.actionLocked;

const showHowlBtn=
  game.abilitiesEnabled &&
  playMode==="local" &&
  game.phase==="dogs" &&
  game.selectedAbilities.police==="howl";

howlBtn.style.display=
  showHowlBtn ? "" : "none";

howlBtn.disabled=
  !canUseHowl;

howlBtn.textContent=
  game.policeAbilities.howlUsed
    ? "📣 赤柴・遠吠え 使用済み"

    : game.selectedDog!==0
      ? "📣 赤柴・遠吠え｜先に赤柴を選択"

    : game.dogAction[0]
      ? "📣 赤柴・遠吠え｜赤柴は行動済み"

    : game.policeAbilityPending==="howl"
      ? "✅ 遠吠えを確定"

    : "📣 赤柴・遠吠え";
     
const canUseDash=
  game.abilitiesEnabled &&
  playMode==="local" &&
  game.phase==="dogs" &&
  game.selectedAbilities.police==="dash" &&
  game.selectedDog===1 &&
  !game.dogAction[1] &&
  !game.gameOver &&
  !game.actionLocked &&
  !game.policeAbilities.dashUsed;
     
const showDashBtn=
  game.abilitiesEnabled &&
  playMode==="local" &&
  game.phase==="dogs" &&
  game.selectedAbilities.police==="dash";

dashBtn.style.display=
  showDashBtn ? "" : "none";

dashBtn.disabled=
  !canUseDash;

dashBtn.textContent=
  game.policeAbilities.dashUsed
    ? "⚡ 黒柴ダッシュ 使用済み"

    : game.selectedDog!==1
      ? "⚡ 黒柴ダッシュ｜先に黒柴を選択"

    : game.dogAction[1]
      ? "⚡ 黒柴ダッシュ｜黒柴は行動済み"

    : game.policeAbilityPending==="dash" &&
      game.dashTarget!==null
      ? "✅ ダッシュ確定"

    : game.policeAbilityPending==="dash"
      ? "⚡ ダッシュ先を選択中"

    : "⚡ 黒柴ダッシュ";

     document.body.classList.toggle(
  "dash-mode",
  game.policeAbilityPending==="dash"
);
const canCancelAbility=
  (
    game.phase==="cat" &&
    (
      game.catAbilityPending==="sneak" ||
      (
        game.catAbilityPending==="fakePaw" &&
        !game.fakePawConfirmed
      )
    )
  ) ||
  (
    game.phase==="dogs" &&
    (
      game.policeAbilityPending==="howl" ||
      (
        game.policeAbilityPending==="dash" &&
        !game.dashConfirmed
      )
    )
  );

abilityCancelBtn.style.display=
  canCancelAbility ? "" : "none";

abilityCancelBtn.disabled=
  !canCancelAbility;
     
     finishDogTurnBtn.disabled=game.phase!=="waitingEnd"||game.gameOver||game.actionLocked;
  }

  function showPhaseCue(icon,text){
    phaseCueIcon.textContent=icon;
    phaseCueText.textContent=text;
    phaseCue.classList.remove("show");
    void phaseCue.offsetWidth;
    phaseCue.classList.add("show");
  }

  function setMessage(t){message.textContent=t;}

  function showPrivacy(icon,title,text){
     privacyBtn.textContent="OK";
    privacyIcon.textContent=icon;
    privacyTitle.textContent=title;
    privacyText.textContent=text;
    privacyOverlay.classList.add("show");
  }

function closePrivacy(){
  if(game.actionLocked)return;

  privacyOverlay.classList.remove("show");

  if(privacyBtn.dataset.nextAction==="openCatAbility"){
    privacyBtn.dataset.nextAction="";
    catAbilityOverlay.classList.add("show");
  }
}

  function showToast(icon,title,text){
    clearTimeout(toastTimer);
    toastIcon.textContent=icon;
    toastTitle.textContent=title;
    toastText.textContent=text;
    toast.classList.add("show");
    toastTimer=setTimeout(hideToast,900);
  }

  function hideToast(){toast.classList.remove("show");}

  function updateSettingsUI(){
    sfxState.textContent=Audio.settings.sfx?"ON":"OFF";
    bgmState.textContent=Audio.settings.bgm?"ON":"OFF";
    vibrationState.textContent=Audio.settings.vibration?"ON":"OFF";

    sfxState.style.background=Audio.settings.sfx?"var(--green)":"#E6E2DE";
    bgmState.style.background=Audio.settings.bgm?"var(--green)":"#E6E2DE";
    vibrationState.style.background=Audio.settings.vibration?"var(--green)":"#E6E2DE";
    bgmVolumeSlider.value=String(Audio.settings.bgmVolume);
    bgmVolumeValue.textContent=`${Audio.settings.bgmVolume}%`;
  }

function openSettings(){
  if(game.actionLocked)return;

  updateSettingsUI();

  const isHome =
    modeOverlay.classList.contains("show");

  const isOnline =
    playMode==="onlineCat" ||
    playMode==="onlinePolice";


  settingsOverlay.classList.add("show");
}

  function closeSettings(){settingsOverlay.classList.remove("show");}



  function boxDistance(a,b){
    return Math.abs(E.boxRow(a)-E.boxRow(b))+Math.abs(E.boxCol(a)-E.boxCol(b));
  }

  function nodeToBoxDistance(node,box){
    let best=99;
    E.getBoxesAroundNode(node).forEach(b=>{
      best=Math.min(best,boxDistance(b,box));
    });
    return best;
  }

  function isEdgeBox(b){
    const r=E.boxRow(b),c=E.boxCol(b);
    return r===0||r===4||c===0||c===4;
  }

  function catEscapeDegree(boxIndex){
    return E.getBoxNeighbors(boxIndex).filter(n=>!game.catHistory.has(n)).length;
  }

  function knownTrackBoxes(){
    return [...game.revealedTracks.keys()];
  }
   function trackAge(boxIndex){
  const trackTurn=game.revealedTracks.get(boxIndex);

  if(!Number.isInteger(trackTurn)){
    return 99;
  }

  return Math.max(
    0,
    game.turn-trackTurn
  );
}

function trackFreshness(boxIndex){
  const age=trackAge(boxIndex);

  /*
   * 発見した痕跡が現在から何ターン前か。
   *
   * 0～1ターン前 = 非常に強い情報
   * 2～3ターン前 = かなり参考になる
   * 4～5ターン前 = 弱い手掛かり
   * 6ターン以上  = ほぼ参考程度
   */
  if(age<=1) return 1.00;
  if(age===2) return 0.82;
  if(age===3) return 0.62;
  if(age===4) return 0.43;
  if(age===5) return 0.28;

  return 0.15;
}
function inferPossibleCatBoxes(){
  const tracks=[...game.revealedTracks.entries()]
    .filter(([,turn])=>Number.isInteger(turn))
    .sort((a,b)=>a[1]-b[1]);

  // 痕跡がまだ無ければ全25箱が候補
  if(!tracks.length){
    return new Set(
      Array.from({length:E.BOX_COUNT},(_,i)=>i)
    );
  }

  // 「何ターン目に、どの箱の痕跡が見つかっているか」
  const trackByTurn=new Map();

  tracks.forEach(([box,turn])=>{
    trackByTurn.set(turn,box);
  });

  // 一番古い既知の痕跡から推理を開始
  const [startBox,startTurn]=tracks[0];

  let states=[
    {
      pos:startBox,
      visited:new Set([startBox])
    }
  ];

  for(let turn=startTurn+1;turn<=game.turn;turn++){
    const nextStates=[];
    const knownBox=trackByTurn.get(turn);
     const emptyBoxesThisTurn =
  cpuMemory.emptyByTurn.get(turn) || new Set();

    for(const state of states){
      for(const next of E.getBoxNeighbors(state.pos)){

        // 猫は一度通った箱へ戻れない
        if(state.visited.has(next)) continue;

         // このターンに探索して空だった箱には
// 猫はいなかったので候補から除外
if(emptyBoxesThisTurn.has(next)) continue;

        // このターンの痕跡が発見済みなら、
        // 必ずその箱を通ったルートだけ残す
        if(
          Number.isInteger(knownBox) &&
          next!==knownBox
        ){
          continue;
        }

        const visited=new Set(state.visited);
        visited.add(next);

        nextStates.push({
          pos:next,
          visited
        });
      }
    }

    // 同じ「現在位置＋通過履歴」はまとめる
    const unique=new Map();

    nextStates.forEach(state=>{
      const key=
        `${state.pos}:`+
        [...state.visited]
          .sort((a,b)=>a-b)
          .join(",");

      if(!unique.has(key)){
        unique.set(key,state);
      }
    });

    states=[...unique.values()];

    if(!states.length) break;
  }

  return new Set(
    states.map(state=>state.pos)
  );
}

  function inferredHotBoxes(){
    const tracks=knownTrackBoxes();
     const possibleCatBoxes=inferPossibleCatBoxes();
    const scores=new Map();

if(!tracks.length){
  for(let b=0;b<E.BOX_COUNT;b++){
    let s=0;

    const r=E.boxRow(b);
    const c=E.boxCol(b);

    // 序盤は中央付近を少し優先
    s+=5-Math.abs(r-2)-Math.abs(c-2);

    // 最近空振りした箱は避けるが、
    // 時間が経てば再び探索候補へ戻す
    if(cpuMemory.emptyBoxes.has(b)){
      const emptyTurn=cpuMemory.emptyBoxes.get(b);
      const age=Math.max(0,game.turn-emptyTurn);

      if(age===0) s-=5;
      else if(age===1) s-=3;
      else if(age===2) s-=1;
      else s+=1;
    }else{
      // まだ探索していない場所を少し優先
      s+=2.5;
    }

    scores.set(b,s);
  }

  return scores;
}

    for(let b=0;b<E.BOX_COUNT;b++){
      let s=0;
       if(possibleCatBoxes.has(b)){
  s+=8;
}else{
  s-=4;
}
      let nearest=99;
      tracks.forEach(t=>nearest=Math.min(nearest,boxDistance(t,b)));
      s+=Math.max(0,7-nearest)*2.8;

      // The cat cannot return to its own path, so boxes around discovered tracks
      // but not already discovered become especially interesting.
      if(!game.revealedTracks.has(b)) s+=2.2;


      
      if(cpuMemory.emptyBoxes.has(b)){
  const emptyTurn=cpuMemory.emptyBoxes.get(b);
  const age=Math.max(0,game.turn-emptyTurn);

  if(age===0) s-=6.5;
  else if(age===1) s-=4.5;
  else if(age===2) s-=2.5;
  else if(age===3) s-=1.2;
  else s-=0.3;
}

      scores.set(b,s);
    }
    return scores;
  }

  function likelyEscapeBoxes(limit=6){
    const hot=inferredHotBoxes();
    return [...hot.entries()]
      .sort((a,b)=>b[1]-a[1])
      .slice(0,limit)
      .map(([b])=>b);
  }

  function dogRole(di){
    // Dynamic roles:
    // 0 tracker, 1 searcher, 2 blocker.
    // If one dog is much closer to tracks, it becomes tracker.
    const tracks=knownTrackBoxes();
    if(tracks.length){
      let bestDog=0,bestDist=99;
      for(let d=0;d<3;d++){
        const node=game.dogs[d];
        let dist=99;
        tracks.forEach(t=>dist=Math.min(dist,nodeToBoxDistance(node,t)));
        if(dist<bestDist){bestDist=dist;bestDog=d;}
      }
      if(di===bestDog) return "tracker";
    }
    return di===1 ? "searcher" : (di===2 ? "blocker" : "tracker");
  }

  function cpuProfile(){
    if(cpuDifficulty==="easy"){
      return {
        fresh:5.5, track:1.35, spread:.45, backtrack:3, role:1.5,
        endgame:1.5, noise:7.5, forceSearch:.72, think:260,
        targetSearches:1, searchBias:0
      };
    }
if(cpuDifficulty==="hard"){
  return {
    fresh:15.5,
    track:6.5,
    spread:1.5,
    backtrack:14,
    role:7.5,
    endgame:11,
    noise:.15,
    forceSearch:1,
    think:520,

    targetSearches:2,
    searchBias:7.5
  };
}
    return {
      fresh:11.8, track:4.0, spread:.78, backtrack:9.4, role:4.5,
      endgame:5.9, noise:1.05, forceSearch:1, think:390,
      targetSearches:2, searchBias:4.6
    };
  }

  function cpuThinkDelay(){
    return cpuProfile().think;
  }

  function scoreSearch(di,boxIndex){
    const role=dogRole(di);
    const hot=inferredHotBoxes();
    const profile=cpuProfile();

    let score=(hot.get(boxIndex)||0);

     const possibleCatBoxes=inferPossibleCatBoxes();

if(possibleCatBoxes.has(boxIndex)){
  score+=7;
}else{
  score-=5;
}

    // Always value fresh information.
if(!game.cpuSearchedBoxes.has(boxIndex)){
  score+=profile.fresh;
}
    if(cpuMemory.emptyBoxes.has(boxIndex)){
  const emptyTurn=cpuMemory.emptyBoxes.get(boxIndex);
  const age=Math.max(0,game.turn-emptyTurn);

  if(age===0) score-=18;
  else if(age===1) score-=12;
  else if(age===2) score-=7;
  else if(age===3) score-=3;
  else score-=1;
}

    // Evidence discovered here previously is useful, but do not obsess forever.
    if(game.revealedTracks.has(boxIndex)) score-=4;

    // Role tendencies.
    if(role==="searcher") score+=profile.role;
    if(role==="tracker" && knownTrackBoxes().length) score+=profile.role*.95;
    if(role==="blocker") score-=1.2;

    if(knownTrackBoxes().length){
      let nearest=99;
      knownTrackBoxes().forEach(t=>nearest=Math.min(nearest,boxDistance(t,boxIndex)));
      if(nearest===1) score+=6.5;
      else if(nearest===2) score+=3.5;
    }

    // Endgame: searching high-probability boxes matters more.
    const remaining=Math.max(0,E.MAX_TURNS-game.turn+1);
    if(remaining<=3) score+=profile.endgame;

    // Small randomness keeps behavior human.
    score+=Math.random()*profile.noise;

    return score;
  }

  function scoreMove(di,node){
    const role=dogRole(di);
    const profile=cpuProfile();
    let score=0;

    // Spread the dogs, but not too far.
    game.dogs.forEach((other,j)=>{
      if(j===di||other===null)return;
      const d=E.manhattanNodeDistance(node,other);
      if(d===0) score-=100;
      else if(d===1) score-=4;
      else score+=Math.min(d,4)*profile.spread;
    });

    // Avoid immediate backtracking.
    if(cpuMemory.lastDogNodes[di]===node) score-=profile.backtrack;

    // Move toward hot zones.
    const hot=likelyEscapeBoxes(8);
     const possibleCatBoxes=inferPossibleCatBoxes();
     // 現在地候補を多く監視できるノードを評価
const possibleAround=
  E.getBoxesAroundNode(node)
    .filter(b=>possibleCatBoxes.has(b))
    .length;

score+=possibleAround*3.2;

     // 他の柴犬と同じ候補箱ばかり監視する移動は少し減点
let overlap=0;

const candidateBoxes=E.getBoxesAroundNode(node);

game.dogs.forEach((other,j)=>{
  if(j===di || other===null) return;

  const otherBoxes=new Set(
    E.getBoxesAroundNode(other)
  );

  candidateBoxes.forEach(b=>{
    if(
      possibleCatBoxes.has(b) &&
      otherBoxes.has(b)
    ){
      overlap++;
    }
  });
});

score-=overlap*1.8;
     
    let nearest=99;
    hot.forEach(b=>nearest=Math.min(nearest,nodeToBoxDistance(node,b)));
    score+=Math.max(0,7-nearest)*2.1;

// 最近探索していない箱を多く見られる位置を評価する。
// 昔探索した箱でも、時間が経てば再び価値がある。
const around=E.getBoxesAroundNode(node);

const fresh=around.filter(b=>{
  if(!cpuMemory.emptyBoxes.has(b)) return true;

  const emptyTurn=cpuMemory.emptyBoxes.get(b);
  const age=Math.max(0,game.turn-emptyTurn);

  return age>=2;
}).length;

score+=fresh*1.35;

if(fresh===0){
  score-=5.5;
}


    // Tracker moves toward discovered tracks.
    if(role==="tracker" && knownTrackBoxes().length){
      let td=99;
      knownTrackBoxes().forEach(b=>td=Math.min(td,nodeToBoxDistance(node,b)));
      score+=Math.max(0,6-td)*profile.track;
    }

    // Slight central preference early.
    if(game.turn<=4){
      const r=E.nodeRow(node),c=E.nodeCol(node);
      score+=3-Math.abs(r-2.5)*.45-Math.abs(c-2.5)*.45;
    }

    // Endgame: prioritize blockade positions.
    const remaining=Math.max(0,E.MAX_TURNS-game.turn+1);
    if(remaining<=3){
      const likely=likelyEscapeBoxes(5);
      let block=0;
      likely.forEach(b=>{
        if(E.getBoxesAroundNode(node).includes(b)) block+=2.5;
      });
      score+=block;
    }

    score+=Math.random()*profile.noise;
    return score;
  }

function hardProbabilityMap(){
  const probs=new Map();
  const tracks=knownTrackBoxes();

  for(let b=0;b<E.BOX_COUNT;b++){
    let p=1;

    if(game.cpuSearchedBoxes.has(b)) p*=0.08;
    if(cpuMemory.emptyBoxes.has(b)) p*=0.03;
    if(game.revealedTracks.has(b)) p*=0.18;

    if(tracks.length){

      let evidence=0;

      tracks.forEach(t=>{
        const age=trackAge(t);
        const freshness=trackFreshness(t);
        const dist=boxDistance(t,b);

        /*
         * 古い痕跡ほど猫が移動できる範囲が広い。
         *
         * age=1 → かなり近く
         * age=3 → 中距離まで候補
         * age=6 → 広範囲
         */
        const expectedRadius=
          Math.min(7,Math.max(1,age+1));

        const delta=
          Math.abs(dist-expectedRadius);

        let trackScore;

        /*
         * 新しい痕跡は近距離を強く評価。
         */
        if(age<=2){
          if(dist<=age+1){
            trackScore=
              9.0-(dist*1.5);
          }else{
            trackScore=
              Math.max(.4,4-(dist-age));
          }

        /*
         * 中程度の古さなら
         * 周辺だけでなく逃走先も見る。
         */
        }else if(age<=5){
          trackScore=
            Math.max(
              .5,
              5.5-delta
            );

        /*
         * 古い痕跡なら場所を決めつけない。
         */
        }else{
          trackScore=
            Math.max(
              .8,
              2.2-delta*.2
            );
        }

        evidence+=trackScore*freshness;
      });

      p*=1+evidence;

    }else{
      /*
       * 情報ゼロの序盤。
       * 中央固定を弱める。
       */
      const r=E.boxRow(b);
      const c=E.boxCol(b);

      const center=
        2.5-
        Math.abs(r-2)*.18-
        Math.abs(c-2)*.18;

      p*=1+Math.max(0,center);

      // 毎ゲーム少し違う探索傾向
      p*=0.82+Math.random()*.36;
    }

    /*
     * 逃げ道の多い箱も候補に残す。
     */
    p*=1+(catEscapeDegree(b)*.20);

    probs.set(b,p);
  }

  const total=
    [...probs.values()]
      .reduce((a,b)=>a+b,0)||1;

  probs.forEach(
    (v,k)=>probs.set(k,v/total)
  );

  return probs;
}

function hardBestProbabilitySearch(di){
  const boxes=E.getBoxesAroundNode(game.dogs[di]);
  if(!boxes.length)return null;

  const probs=hardProbabilityMap();
  const candidates=[];

  boxes.forEach(b=>{
    let s=(probs.get(b)||0)*160;

    if(!game.cpuSearchedBoxes.has(b)) s+=18;
    if(cpuMemory.emptyBoxes.has(b)) s-=25;

    /*
     * 痕跡がまだ1つも無い序盤は
     * 探索候補に意図的な揺らぎを入れる。
     */
    if(!knownTrackBoxes().length){
      s+=Math.random()*18;
    }else{
      s+=Math.random()*2;
    }

    candidates.push({
      box:b,
      score:s
    });
  });

  candidates.sort((a,b)=>b.score-a.score);

  /*
   * 痕跡ゼロなら上位候補からランダム。
   * 痕跡発見後はほぼ最善手を選ぶ。
   */
  if(!knownTrackBoxes().length){
    const top=candidates.slice(
      0,
      Math.min(3,candidates.length)
    );

    const picked=
      top[Math.floor(Math.random()*top.length)];

    return {
      type:"search",
      target:picked.box,
      score:picked.score
    };
  }

  const best=candidates[0];

  return {
    type:"search",
    target:best.box,
    score:best.score
  };
}

  function hardBestContainmentMove(di){
    const moves=E.getDogLegalMoves(game,di);
    if(!moves.length)return null;
    const probs=hardProbabilityMap();
    let best=null,bestScore=-Infinity;

    moves.forEach(node=>{
      let score=0;
      const around=E.getBoxesAroundNode(node);

      around.forEach(b=>{
        const p=probs.get(b)||0;
        score+=p*120;
        if(catEscapeDegree(b)<=2) score+=p*55;
      });

      game.dogs.forEach((other,j)=>{
        if(j===di||other===null)return;
        const d=E.manhattanNodeDistance(node,other);
        if(d===0) score-=100;
        else if(d===1) score-=9;
        else score+=Math.min(d,4)*1.8;
      });

      if(cpuMemory.lastDogNodes[di]===node) score-=15;

      if(score>bestScore){bestScore=score;best=node;}
    });

    return best===null?null:{type:"move",target:best,score:bestScore};
  }

  function bestSearchAction(di){
    const node=game.dogs[di];
    const boxes=E.getBoxesAroundNode(node);

    let target=null,score=-Infinity;
    boxes.forEach(b=>{
      const s=scoreSearch(di,b);
      if(s>score){score=s;target=b;}
    });
    return {type:"search",target,score};
  }

  function bestMoveAction(di){
    const moves=E.getDogLegalMoves(game,di);

    let target=null,score=-Infinity;
    moves.forEach(n=>{
      const s=scoreMove(di,n);
      if(s>score){score=s;target=n;}
    });
    return {type:"move",target,score};
  }

  function chooseCpuAction(di){
    const profile=cpuProfile();
    let search=bestSearchAction(di);
    let move=bestMoveAction(di);
    const role=dogRole(di);
    const remaining=Math.max(0,E.MAX_TURNS-game.turn+1);

    if(cpuDifficulty==="hard"){
      const ps=hardBestProbabilitySearch(di);
      const cm=hardBestContainmentMove(di);
      if(ps && (!search || ps.score>search.score)) search=ps;
      if(cm && (!move || cm.score>move.score)) move=cm;
    }

    // Normal and Hard: aim for two searches every police turn.
if(
  game.cpuSearchesThisTurn < profile.targetSearches &&
  search &&
  search.target !== null
){
  const recentlyEmpty =
    cpuMemory.emptyBoxes.has(search.target) &&
    game.turn - cpuMemory.emptyBoxes.get(search.target) <= 1;

  if(!recentlyEmpty){
    return search;
  }
}

    if(knownTrackBoxes().length && search && search.target!==null){
      const evidenceBonus=cpuDifficulty==="hard" ? 8 : (cpuDifficulty==="normal" ? 6 : 2);
      if(!move || search.score+evidenceBonus>=move.score) return search;
    }

if(
  role==="searcher" &&
  search &&
  search.target!==null
){
  const recentlyEmpty =
    cpuMemory.emptyBoxes.has(search.target) &&
    game.turn - cpuMemory.emptyBoxes.get(search.target) <= 1;

  if(!recentlyEmpty && cpuDifficulty!=="easy"){
    return search;
  }
}

    if(remaining<=3 && role==="blocker" && move && move.target!==null){
      const bonus=cpuDifficulty==="hard" ? 7 : (cpuDifficulty==="normal" ? 2.5 : 0);
      if(!search || move.score+bonus>=search.score+profile.searchBias) return move;
    }

    if(search && search.target!==null){
      if(!move || search.score+profile.searchBias>=move.score) return search;
    }

    if(cpuDifficulty==="easy" && Math.random()<0.2 && search && move){
      return Math.random()<.5 ? search : move;
    }

    if(move && move.target!==null) return move;
    return search && search.target!==null ? search : null;
  }

  function cpuThoughtFor(di,action){
    const role=dogRole(di);
    if(!action) return "うーん…";
    if(action.type==="search"){
      if(knownTrackBoxes().length) return role==="tracker" ? "足跡の先をクンクンするワン…" : "この辺りを重点捜査するワン…";
      return "未探索の箱を調べるワン…";
    }
    if(role==="blocker") return "逃げ道をふさぐワン…";
    if(knownTrackBoxes().length) return "足跡の先へ回り込むワン…";
    return "広く捜査するワン…";
  }

function cpuSetupDogs(){
  const active=[];

  for(let i=0;i<E.NODE_COUNT;i++){
    if(E.isActiveDogNode(i)) active.push(i);
  }

  const chosen=[];

  while(chosen.length<3){
    const candidates=[];

    active.forEach(n=>{
      if(chosen.includes(n)) return;

      let score=0;

      /*
       * すでに置いた犬とは適度に離れる。
       * ただし距離だけで毎回同じ場所にならないようにする。
       */
      chosen.forEach(c=>{
        score += E.manhattanNodeDistance(n,c) * 1.15;
      });

      /*
       * 中央付近を少しだけ優遇。
       * 固定の preferred ノードは使わない。
       */
      const r=E.nodeRow(n);
      const c=E.nodeCol(n);

      const centerDist=
        Math.abs(r-2.5) +
        Math.abs(c-2.5);

      score += Math.max(0,4-centerDist) * 0.55;

      /*
       * ゲームごとの個性。
       * 以前の0.35より大幅にランダム性を増やす。
       */
      score += Math.random() * 3.2;

      candidates.push({
        node:n,
        score
      });
    });

    candidates.sort((a,b)=>b.score-a.score);

    /*
     * 最善地点に固定せず、
     * 上位候補からランダム選択。
     */
    const top=candidates.slice(
      0,
      Math.min(5,candidates.length)
    );

    const picked=
      top[Math.floor(Math.random()*top.length)];

    chosen.push(picked.node);
  }

  /*
   * 犬の色と初期位置の組み合わせも毎回変える
   */
  for(let i=chosen.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [chosen[i],chosen[j]]=[chosen[j],chosen[i]];
  }

  game.dogs=[
    chosen[0],
    chosen[1],
    chosen[2]
  ];

  game.dogSetupCount=3;
}

  function boxDistance(a,b){
    return Math.abs(E.boxRow(a)-E.boxRow(b))+Math.abs(E.boxCol(a)-E.boxCol(b));
  }

  function runCpuPoliceTurn(){
    if(playMode!=="cpuPolice" || game.gameOver || game.phase!=="dogs") return;

    // New turn begins before any dog has acted.
    if(game.dogAction.every(a=>a===false) && !game.actionLocked){
      game.cpuSearchesThisTurn=0;
    }

    const availableDogs=[];

for(let d=0;d<3;d++){
  if(game.dogAction[d]===false){
    availableDogs.push(d);
  }
}

let di=-1;

if(availableDogs.length){
  /*
   * 痕跡がある場合は、痕跡に近い犬が
   * 少し行動しやすい。ただし固定しない。
   */
  if(knownTrackBoxes().length){
    const ranked=availableDogs
      .map(d=>{
        let dist=99;

        knownTrackBoxes().forEach(b=>{
          dist=Math.min(
            dist,
            nodeToBoxDistance(game.dogs[d],b)
          );
        });

        return {
          dog:d,
          score:(8-dist)+Math.random()*4
        };
      })
      .sort((a,b)=>b.score-a.score);

    di=ranked[0].dog;

  }else{
    // 痕跡なしなら完全にランダム
    di=availableDogs[
      Math.floor(Math.random()*availableDogs.length)
    ];
  }
}

    if(di===-1){
      cpuFinishTurn();
      return;
    }

    let action=chooseCpuAction(di);

    if(cpuDifficulty!=="easy" && game.cpuSearchesThisTurn<cpuProfile().targetSearches){
      const remainingDogs=game.dogAction.filter(a=>a===false).length;
      const searchesNeeded=cpuProfile().targetSearches-game.cpuSearchesThisTurn;

if(remainingDogs<=searchesNeeded){
  const forced=bestSearchAction(di);

  if(forced && forced.target!==null){
    const recentlyEmpty =
      cpuMemory.emptyBoxes.has(forced.target) &&
      game.turn - cpuMemory.emptyBoxes.get(forced.target) <= 1;

    if(!recentlyEmpty){
      action=forced;
    }
  }
}
    }

    if(!action){
      game.dogAction[di]="move";
      cpuTimer=setTimeout(runCpuPoliceTurn,300);
      return;
    }

    game.actionLocked=true;
    const thought=cpuThoughtFor(di,action);
    guideDisplay.textContent=`🐕💭 ${E.DOGS[di]} ${thought}`;
    render();

    cpuTimer=setTimeout(()=>{
      if(game.gameOver) return;

      if(action.type==="move"){
        const previous=game.dogs[di];
        cpuMemory.lastDogNodes[di]=previous;

        game.dogs[di]=action.target;
        game.dogAction[di]="move";
        game.actionLocked=false;

        setMessage(`🤖 ${E.DOGS[di].name} が移動したワン！`);
        Audio.play("move");
        render();

        cpuTimer=setTimeout(runCpuPoliceTurn,430);

      }else{
        game.actionLocked=false;
        game.selectedDog=di;
        performSearch(di,action.target);

        const waitForSearch=()=>{
          if(game.gameOver) return;
          if(game.actionLocked){
            cpuTimer=setTimeout(waitForSearch,110);
            return;
          }
          cpuTimer=setTimeout(runCpuPoliceTurn,320);
        };
        cpuTimer=setTimeout(waitForSearch,160);
      }
    },cpuThinkDelay());
  }

  function cpuFinishTurn(){
    if(game.gameOver)return;

    game.phase="waitingEnd";
    const remaining=Math.max(0,E.MAX_TURNS-game.turn+1);
    setMessage(remaining<=3
      ?"🤖 CPU柴犬警察が包囲を強めています…"
      :"🤖 CPU柴犬警察の捜査が終了しました。");
    render();

    cpuTimer=setTimeout(()=>{
      if(game.turn>=E.MAX_TURNS){
        endGame("cat","11ターンすべて逃げ切りました！");
        return;
      }

      game.turn++;

      if(E.getCatLegalMoves(game).length===0){
        endGame("dogs","ネコが次に移動できる箱がありません！");
        return;
      }

      game.phase="cat";
      game.catVisible=false;
      game.selectedDog=null;
      game.dogAction=[false,false,false];
      game.cpuSearchesThisTurn=0;

      let extra=game.turn===9?" あと3ターン！"
        :game.turn===10?" あと2ターン！"
        :game.turn===11?" LAST TURN！":"";

      showPrivacy("🐱",`ターン${game.turn}・ネコの番`,
        `CPU柴犬警察の捜査が終わりました。ネコの位置を確認して次の箱へ移動してください。${extra}`);
      setMessage(`🐱 ターン${game.turn}。まだ通っていない隣の箱へ移動しよう。${extra}`);
      render();
    },650);
  }


  function showHowTo(){
    privacyIcon.textContent="📖";
    privacyTitle.textContent="遊び方";
    privacyText.textContent=
      "ネコは一度通った箱には戻れません。柴犬は1匹ずつ、移動か探索のどちらかを行います。11ターン逃げ切ればネコの勝ち、現在地を探索されるか逃げ道がなくなると柴犬警察の勝ちです。";
    privacyOverlay.classList.add("show");
  }

  function toggleQuickSound(){
    Audio.toggleSfx();
    Audio.toggleBgm();
    updateSettingsUI();
    soundQuickBtn.textContent=(Audio.settings.sfx||Audio.settings.bgm)?"🔊 サウンド":"🔇 サウンド";
  }


  function cpuCatDistanceFromDogs(boxIndex){
    let min=99;
    game.dogs.forEach(node=>{
      if(node===null)return;
      E.getBoxesAroundNode(node).forEach(b=>{
        min=Math.min(min,boxDistance(b,boxIndex));
      });
    });
    return min;
  }

  function cpuCatFutureFreedom(boxIndex){
    return E.getBoxNeighbors(boxIndex).filter(n=>!game.catHistory.has(n)).length;
  }


  function projectedDogPressure(boxIndex){
    // Estimate how many police intersections can pressure this box next turn.
    let pressure=0;
    game.dogs.forEach((node,di)=>{
      if(node===null)return;

      // current adjacency
      if(E.getBoxesAroundNode(node).includes(boxIndex)) pressure+=2.8;

      // one-move reach
      E.getDogLegalMoves(game,di).forEach(n=>{
        if(E.getBoxesAroundNode(n).includes(boxIndex)) pressure+=1.1;
      });
    });
    return pressure;
  }

  function cpuCatSecondStepValue(fromBox,nextBox){
    let best=-999;
    E.getBoxNeighbors(nextBox).forEach(n=>{
      if(game.catHistory.has(n) || n===fromBox) return;

      const dogDist=cpuCatDistanceFromDogs(n);
      const freedom=E.getBoxNeighbors(n).filter(x=>!game.catHistory.has(x) && x!==nextBox).length;
      const pressure=projectedDogPressure(n);

      let s=dogDist*4.2 + freedom*5.4 - pressure*4.8;
      if(freedom===0) s-=60;
      else if(freedom===1) s-=16;

      best=Math.max(best,s);
    });
    return best;
  }

  function cpuCatScore(boxIndex){
    const dogDist=cpuCatDistanceFromDogs(boxIndex);
    const freedom=cpuCatFutureFreedom(boxIndex);
    const pressure=projectedDogPressure(boxIndex);

    let score=0;

    if(cpuDifficulty==="easy"){
      score+=dogDist*1.6;
      score+=freedom*1.4;
      score-=pressure*.8;
      score+=Math.random()*8;
      if(freedom===0) score-=8;
      return score;
    }

    if(cpuDifficulty==="normal"){
      score+=dogDist*4.4;
      score+=freedom*5.2;
      score-=pressure*3.8;
      if(freedom===0) score-=40;
      if(freedom===1) score-=10;

      const lookahead=cpuCatSecondStepValue(game.catPos,boxIndex);
      if(lookahead>-999) score+=lookahead*.28;

      score+=Math.random()*1.5;
      return score;
    }

  // Hard: stronger 2-step escape planning + police pressure avoidance.
score += dogDist * 6.2;
score += freedom * 8.5;
score -= pressure * 8.0;

if(freedom === 0) score -= 150;
if(freedom === 1) score -= 55;
if(freedom === 2) score -= 10;

const lookahead = cpuCatSecondStepValue(
  game.catPos,
  boxIndex
);

if(lookahead > -999){
  score += lookahead * 1.15;
}

/* 端に追い詰められる動きをかなり嫌う */
if(isEdgeBox(boxIndex)){
  if(freedom <= 2){
    score -= 22;
  }else{
    score -= 4;
  }
}

/* ほぼ判断ミスしない */
score += Math.random() * 0.08;

return score;
  }
  function cpuChooseStartBox(){
    let best=0,bestScore=-Infinity;

    for(let b=0;b<E.BOX_COUNT;b++){
      const dogDist=cpuCatDistanceFromDogs(b);
      const freedom=E.getBoxNeighbors(b).length;
      const pressure=projectedDogPressure(b);

      let s=dogDist*5 + freedom*2.3 - pressure*2.5;

      if(cpuDifficulty==="easy"){
        s+=Math.random()*14;
      }else if(cpuDifficulty==="normal"){
        s+=freedom*2.2;
        s+=Math.random()*2.2;
      }else{
        // Hard prefers starts with both distance and multiple exits.
        s+=freedom*4.4;
        if(freedom<=2)s-=10;
        s+=Math.random()*.35;
      }

      if(s>bestScore){bestScore=s;best=b;}
    }

    return best;
  }

  function cpuChooseCatMove(){
    const moves=E.getCatLegalMoves(game);
    if(!moves.length)return null;

    let best=moves[0],bestScore=-Infinity;
    moves.forEach(b=>{
      const s=cpuCatScore(b);
      if(s>bestScore){bestScore=s;best=b;}
    });
    return best;
  }

  function cpuCatInitialHide(){
    if(playMode!=="cpuCat"||game.gameOver)return;

    // 警察側にはネコの潜伏位置を絶対に見せない。
    game.actionLocked=true;
    game.catVisible=false;
    document.body.classList.add("cpu-cat-thinking");
    guideDisplay.textContent="🐱💭 CPUネコが隠れています…";

    cpuTimer=setTimeout(()=>{
      const start=cpuChooseStartBox();

      // 内部状態だけ更新。盤面上では一切表示・演出しない。
      game.catPos=start;
      game.catHistory.clear();
      game.catHistory.set(start,1);
      cpuCatRoute=[{box:start,turn:1}];
      game.catVisible=false;

      game.turn=1;
      game.phase="dogs";
      game.selectedDog=null;
      game.dogAction=[false,false,false];
      game.actionLocked=false;
      document.body.classList.remove("cpu-cat-thinking");

      showPhaseCue("🐕","捜査開始！");
      setMessage("🐕 CPUネコが隠れました。柴犬を選んで捜査しよう。");
      render();
    },cpuDifficulty==="hard"?650:420);
  }

  function runCpuCatTurn(){
    if(playMode!=="cpuCat"||game.gameOver)return;

    if(game.turn>=E.MAX_TURNS){
      endGame("cat","11ターンすべて逃げ切りました！");
      return;
    }

    game.turn++;
    game.phase="cat";
    game.catVisible=false;
    game.actionLocked=true;
    document.body.classList.add("cpu-cat-thinking");
    guideDisplay.textContent="🐱💭 CPUネコがこっそり移動中…";
    render();

    cpuTimer=setTimeout(()=>{
      const target=cpuChooseCatMove();

      if(target===null){
        game.actionLocked=false;
        document.body.classList.remove("cpu-cat-thinking");
        endGame("dogs","CPUネコの逃げ道がなくなりました！");
        return;
      }

      // 警察側では移動アニメーションを出さず、内部位置だけ更新する。
      // これにより現在地・移動方向が漏れない。
      game.catPos=target;
      game.catHistory.set(target,game.turn);
      cpuCatRoute.push({box:target,turn:game.turn});
      game.catVisible=false;
      game.phase="dogs";
      game.selectedDog=null;
      game.dogAction=[false,false,false];
      game.actionLocked=false;
      document.body.classList.remove("cpu-cat-thinking");

      if(E.getCatLegalMoves(game).length===0 && game.turn<E.MAX_TURNS){
        endGame("dogs","CPUネコの次の逃げ道がなくなりました！");
        return;
      }

            showPhaseCue("🐕","柴犬警察の捜査！");
      setMessage("🐕 CPUネコが移動しました。柴犬3匹を行動させよう。");
      render();
    },cpuDifficulty==="hard"?720:(cpuDifficulty==="normal"?520:340));
  }


  function clearRouteReveal(){
    board.querySelectorAll(".route-step,.route-line").forEach(el=>el.remove());
  }

  function boxCenterPercent(boxIndex){
    const r=E.boxRow(boxIndex),c=E.boxCol(boxIndex);
    // Board layout is a 5x5 box grid with intersections between boxes.
    // These percentages match the box centers visually.
    return {
      x:10 + c*20,
      y:12 + r*20
    };
  }


  function renderResultCpuCatRoute(){

    const ordered=cpuCatRoute.length
      ? cpuCatRoute.slice().sort((a,b)=>a.turn-b.turn)
      : [...game.catHistory.entries()]
          .sort((a,b)=>a[1]-b[1])
          .map(([box,turn])=>({box,turn}));

    if(!ordered.length)return;

    if(resultRouteBoard) if(resultRouteBoard) resultRouteBoard.innerHTML="";

    // Draw all 25 cardboard cells.
    for(let b=0;b<E.BOX_COUNT;b++){
      const r=E.boxRow(b),c=E.boxCol(b);
      const cell=document.createElement("div");
      cell.className="result-route-cell";
      cell.style.left=`${10+c*20}%`;
      cell.style.top=`${10+r*20}%`;
      cell.textContent=b+1;
      if(resultRouteBoard) resultRouteBoard.appendChild(cell);
    }

    // SVG route line.
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("viewBox","0 0 100 100");
    svg.setAttribute("preserveAspectRatio","none");
    svg.classList.add("result-route-svg");

    const polyline=document.createElementNS("http://www.w3.org/2000/svg","polyline");
    const points=ordered.map(step=>{
      const r=E.boxRow(step.box),c=E.boxCol(step.box);
      return `${10+c*20},${10+r*20}`;
    }).join(" ");
    polyline.setAttribute("points",points);
    svg.appendChild(polyline);
    if(resultRouteBoard) resultRouteBoard.appendChild(svg);

    ordered.forEach((step,idx)=>{
      const r=E.boxRow(step.box),c=E.boxCol(step.box);
      const badge=document.createElement("div");
      badge.className="result-route-badge";
      if(idx===0)badge.classList.add("start");
      if(idx===ordered.length-1)badge.classList.add("final");
      badge.style.left=`${10+c*20}%`;
      badge.style.top=`${10+r*20}%`;
      badge.textContent=idx===0?"S":String(step.turn);
      if(resultRouteBoard) resultRouteBoard.appendChild(badge);
    });

    if(resultRouteNote) resultRouteNote.textContent=`STARTから最終地点まで ${ordered.length}地点`;
    if(resultRoute) resultRoute.classList.add("show");
  }

  function revealCpuCatRoute(){

    clearRouteReveal();

    const ordered=cpuCatRoute.length
      ? cpuCatRoute.slice().sort((a,b)=>a.turn-b.turn)
      : [...game.catHistory.entries()]
          .sort((a,b)=>a[1]-b[1])
          .map(([box,turn])=>({box,turn}));

    if(!ordered.length)return;

    // Force a fresh board render so the route badges have correct anchors.
    renderBoard();

    const boardRect=board.getBoundingClientRect();

    const centerForBox=(boxIndex)=>{
      const el=board.querySelector(`.box[data-box-index="${boxIndex}"]`);
      if(!el)return boxCenterPercent(boxIndex);

      const r=el.getBoundingClientRect();
      return {
        x:((r.left+r.width/2-boardRect.left)/boardRect.width)*100,
        y:((r.top+r.height/2-boardRect.top)/boardRect.height)*100
      };
    };

    ordered.forEach((step,idx)=>{
      if(idx<ordered.length-1){
        const a=centerForBox(step.box);
        const b=centerForBox(ordered[idx+1].box);
        const dx=b.x-a.x,dy=b.y-a.y;
        const length=Math.sqrt(dx*dx+dy*dy);
        const angle=Math.atan2(dy,dx)*180/Math.PI;

        const line=document.createElement("div");
        line.className="route-line";
        line.style.left=`${a.x}%`;
        line.style.top=`${a.y}%`;
        line.style.width=`${length}%`;
        line.style.transform=`rotate(${angle}deg)`;
        board.appendChild(line);
      }
    });

    ordered.forEach((step,idx)=>{
      const p=centerForBox(step.box);
      const badge=document.createElement("div");
      badge.className="route-step";
      if(idx===0)badge.classList.add("start");
      if(idx===ordered.length-1)badge.classList.add("final");

      badge.style.left=`${p.x}%`;
      badge.style.top=`${p.y}%`;
      badge.textContent=idx===0?"START":String(step.turn);
      board.appendChild(badge);
    });

    if(routeRevealSub) routeRevealSub.textContent=`${ordered.length}地点を通過`;
    if(routeRevealPanel) routeRevealPanel.classList.add("show");

    guideDisplay.textContent="🐾 ネコの逃走ルートを公開しました";
  }

  function showResultAfterCutin(){
    if(!resultOverlay)return;

    resultOverlay.classList.add("show");
    resultOverlay.classList.add("resultOverlayCelebration");
    A.confetti(confettiLayer);
    setTimeout(()=>resultOverlay.classList.remove("resultOverlayCelebration"),700);

    // Connect Phase5 cut-in directly to the existing escape-route result.
    renderResultCpuCatRoute();
    setTimeout(revealCpuCatRoute,160);
  }

  function showVictoryCutin(winner){
    if(!victoryCutin || !victoryCutinImage){
      showResultAfterCutin();
      return;
    }

    clearTimeout(victoryCutinTimer);
    victoryCutin.classList.remove("closing");
    victoryCutinImage.src=winner==="cat"
      ? "./assets/images/cutin_cat_win.jpg"
      : "./assets/images/cutin_police_win.jpg";
    victoryCutinImage.alt=winner==="cat"
      ? "いたずらネコ勝利カットイン"
      : "柴犬警察勝利カットイン";

    victoryCutin.classList.add("show");
    victoryCutin.setAttribute("aria-hidden","false");

    let finished=false;
    const finish=()=>{
      if(finished)return;
      finished=true;
      clearTimeout(victoryCutinTimer);
      victoryCutin.classList.add("closing");
      setTimeout(()=>{
        victoryCutin.classList.remove("show","closing");
        victoryCutin.setAttribute("aria-hidden","true");
        showResultAfterCutin();
      },240);
    };

    victoryCutin.onclick=finish;
    victoryCutinTimer=setTimeout(finish,1850);
  }

  function endGame(winner,reason){
    game.gameOver=true;
    if(resultRoute) resultRoute.classList.remove("show");
    if(resultRouteBoard) if(resultRouteBoard) resultRouteBoard.innerHTML="";
    if(resultRouteNote) resultRouteNote.textContent="";

    const resultModalEl=resultOverlay.querySelector(".modal");
    if(resultModalEl){
      resultModalEl.classList.remove("win-cat","win-dogs","celebrate");
      resultModalEl.classList.add(winner==="cat"?"win-cat":"win-dogs","celebrate");
    }
    game.phase="gameover";
    game.catVisible=true;
    game.selectedDog=null;
    game.actionLocked=false;

    if(winner==="dogs"){
      resultIcon.textContent="🐕🐕🐕✨";
      resultTitle.textContent="柴犬警察の勝利！";
      resultText.textContent=`${reason} ネコの最後の場所は箱${game.catPos+1}でした。`;
    }else{
      resultIcon.textContent="🐱🎀✨";
      resultTitle.textContent="いたずらネコの勝利！";
      resultText.textContent=`${reason} 最後は箱${game.catPos+1}に隠れていました。`;
    }

    // Freeze the final board first, then play the dedicated Phase5 cut-in.
    resultOverlay.classList.remove("show");
    Audio.stopBgm();
    Audio.play(winner==="cat"?"catwin":"policewin");
    Audio.haptic([40,50,40,50,90]);
    render();

    // Short beat before the cut-in makes the win moment feel intentional.
    victoryCutinTimer=setTimeout(()=>showVictoryCutin(winner),280);
  }

bindPress(onlineModeBtn,()=>{
  resetOnlineState();
  onlineOverlay.classList.add("show");
});

bindPress(onlineBackBtn,()=>{
  onlineOverlay.classList.remove("show");
}); 
   bindPress(selectHowlBtn,()=>selectPoliceAbility("howl"));
bindPress(selectDashBtn,()=>selectPoliceAbility("dash"));
bindPress(selectDoubleSearchBtn,()=>selectPoliceAbility("doubleSearch"));

   bindPress(selectSneakBtn,()=>selectCatAbility("sneak"));
bindPress(selectFakePawBtn,()=>selectCatAbility("fakePaw"));

   bindPress(abilityStartBtn,startLocalAfterAbilitySelect);

   bindPress(onlineStartGameBtn,()=>{
  if(onlineGameStarted)return;

  onlineSelfReady=true;
  onlineStartGameBtn.disabled=true;
  onlineStartGameBtn.textContent="相手を待っています…";

  window.NyanOnline.sendGame({
    type:"ready"
  });

  tryStartOnlineGame();
});

   bindPress(createOnlineRoomBtn,async()=>{
  if(!window.NyanOnline){
    onlineStatus.textContent="オンライン機能を読み込めませんでした";
    return;
  }

  createOnlineRoomBtn.disabled=true;
  onlineStatus.textContent="部屋を作成しています…";

  try{
    const room=await window.NyanOnline.createRoom();

    onlineStatus.innerHTML=
      `合言葉コード<br><strong style="font-size:32px">${room.roomCode}</strong><br>`+
      `相手を待っています…`;

    window.NyanOnline.connect({
      onPresence:(data)=>{
        if(data.ready){
          onlineStatus.innerHTML=
            `合言葉コード<br><strong style="font-size:32px">${room.roomCode}</strong><br>`+
            `🐾 2人そろいました！`;
        }
      },

       onRole:(data)=>{
  onlineAssignedRole=data.role;
onlineStartGameBtn.hidden=false;
  if(data.role==="cat"){
    onlineStatus.innerHTML=
      `🐱 あなたはネコ！<br>`+
      `<span style="font-size:14px">柴犬警察から逃げ切ろう！</span>`;
  }else{
    onlineStatus.innerHTML=
      `🐕 あなたは警察！<br>`+
      `<span style="font-size:14px">いたずらネコを見つけよう！</span>`;
  }
},

      onGame:(data)=>{

  // 2人ともゲーム開始を押した
  if(data.payload?.type==="ready"){
    onlinePeerReady=true;
    tryStartOnlineGame();
  }

 if(
  data.payload?.type==="catNoEscape" &&
  onlineAssignedRole==="police"
){
  const route=data.payload.route;

  if(Array.isArray(route)){
    cpuCatRoute=route
      .map(step=>({
        box:Number(step.box),
        turn:Number(step.turn)
      }))
      .filter(step=>
        Number.isInteger(step.box) &&
        step.box>=0 &&
        step.box<E.BOX_COUNT &&
        Number.isInteger(step.turn)
      )
      .sort((a,b)=>a.turn-b.turn);
  }

  game.actionLocked=false;

  endGame(
    "dogs",
    "ネコが行き止まりに入り、逃げ道がなくなりました！"
  );

  return;
}

  // 警察3匹の初期配置をネコ側へ反映
  if(
    data.payload?.type==="dogSetup" &&
    onlineAssignedRole==="cat"
  ){
    const dogs=data.payload.dogs;

    if(Array.isArray(dogs) && dogs.length===3){
      game.dogs=[...dogs];
      game.dogSetupCount=3;
      game.phase="catSetup";
      game.turn=1;

      showPrivacy(
        "🐱",
        "警察の配置完了！",
        "柴犬警察3匹の配置を確認して、スタート地点にする箱を1つ選んでください。"
      );

      setMessage(
        "🐱 柴犬の配置を見て、好きな箱に隠れよう。"
      );

      render();
    }
  }

  // ネコのスタート地点を警察側へ反映
 if(
  data.payload?.type==="catSetupDone" &&
  onlineAssignedRole==="police"
){
  game.catPos=null;
  game.catHistory.clear();
  game.catVisible=false;

  game.turn=1;
  game.phase="dogs";
  game.selectedDog=null;
  game.dogAction=[false,false,false];
  game.cpuSearchesThisTurn=0;
  game.actionLocked=false;

  showPrivacy(
    "🐕",
    "捜査開始！",
    "ネコが隠れました。現在地は秘密です。柴犬警察で捜査を開始してください。"
  );

  setMessage(
    "🐕 柴犬を選択。緑の交差点＝移動、青い箱＝探索です。"
  );

  render();
}

  // 警察の移動をネコ側へ反映
  if(
    data.payload?.type==="dogMove" &&
    onlineAssignedRole==="cat"
  ){
    const dogIndex=Number(data.payload.dogIndex);
    const node=Number(data.payload.node);

    if(
      Number.isInteger(dogIndex) &&
      dogIndex>=0 &&
      dogIndex<3 &&
      Number.isInteger(node) &&
      node>=0 &&
      node<E.NODE_COUNT
    ){
      game.dogs[dogIndex]=node;
      game.dogAction[dogIndex]="move";

      setMessage(
        `${E.DOGS[dogIndex].label} ${E.DOGS[dogIndex].name} が移動しました。`
      );

      render();
    }
  }
// 警察がどの箱を探索しているかネコ側へ表示
// 警察の探索をネコ側でも演出
if(
  data.payload?.type==="policeSearch" &&
  onlineAssignedRole==="cat"
){
  const dogIndex=Number(data.payload.dogIndex);
  const box=Number(data.payload.box);

  if(
    Number.isInteger(dogIndex) &&
    dogIndex>=0 &&
    dogIndex<3 &&
    Number.isInteger(box) &&
    box>=0 &&
    box<E.BOX_COUNT
  ){
    setMessage(
      `🐕 ${E.DOGS[dogIndex].name} が箱${box+1}をクンクン調査中…`
    );

    // 現在の犬位置・盤面を確実に反映
    render();

    // CPU戦と同じクンクン演出
    A.animateSniff(
      board,
      game.dogs[dogIndex],
      dogIndex,
      box,
      motionStatus,
      ()=>{
        // 演出終了後は特に何もしない
      }
    );
  }
}
         
         if(
  data.payload?.type==="dogTurnEnd" &&
  onlineAssignedRole==="cat"
){
if(game.turn>=E.MAX_TURNS){

  // オンラインでは警察側にも「ネコ逃げ切り」を通知
  if(playMode==="onlineCat"){
    window.NyanOnline.sendGame({
      type:"catEscaped",
      turn:game.turn
    });
  }

  endGame(
    "cat",
    "11ターンすべて逃げ切りました！"
  );

  return;
}


  game.turn++;

  if(E.getCatLegalMoves(game).length===0){
    endGame("dogs","ネコが次に移動できる箱がありません！");
    return;
  }

  game.phase="cat";
  game.catVisible=false;
  game.selectedDog=null;
  game.dogAction=[false,false,false];

  let extra=
    game.turn===9 ? " あと3ターン！" :
    game.turn===10 ? " あと2ターン！" :
    game.turn===11 ? " LAST TURN！" : "";

  showPrivacy(
    "🐱",
    `ターン${game.turn}・ネコの番`,
    `柴犬警察の捜査が終わりました。次の箱へ逃げてください。${extra}`
  );

  setMessage(
    `🐱 ターン${game.turn}。まだ通っていない隣の箱へ移動しよう。${extra}`
  );

  render();
}

         
         if(
  data.payload?.type==="searchResult" &&
  onlineAssignedRole==="police"
){
  const dogIndex=Number(data.payload.dogIndex);
  const box=Number(data.payload.box);
  const result=data.payload.result;
  const trackTurn=data.payload.trackTurn;
  const route=data.payload.route;          

  if(
    !Number.isInteger(dogIndex) ||
    dogIndex<0 ||
    dogIndex>=3 ||
    !Number.isInteger(box) ||
    box<0 ||
    box>=E.BOX_COUNT
  ){
    return;
  }

  if(result==="capture"){
    Audio.play("capture");
     if(Array.isArray(route)){
  cpuCatRoute=route
    .map(step=>({
      box:Number(step.box),
      turn:Number(step.turn)
    }))
    .filter(step=>
      Number.isInteger(step.box) &&
      step.box>=0 &&
      step.box<E.BOX_COUNT &&
      Number.isInteger(step.turn)
    )
    .sort((a,b)=>a.turn-b.turn);
}
    Audio.haptic([35,45,70]);
    A.burstAtBox(board,box,"🐱✨");
    A.shakeBoxSoon(board,box);

    game.actionLocked=false;

    endGame(
      "dogs",
      `${E.DOGS[dogIndex].name} が箱${box+1}をクンクン……ネコを発見！`
    );

    return;
  }

 if(result==="track"){
  const foundTurn=Number(trackTurn);

  game.revealedTracks.set(
    box,
    Number.isInteger(foundTurn)
      ? foundTurn
      : game.turn
  );

  // オンラインでもSTART判定できるように公開情報側へ記録
  if(foundTurn===1){
    game.catHistory.set(box,1);
  }

  const foundBox=board.querySelector(
    `.box[data-box-index="${box}"]`
  );

  if(foundBox){
    foundBox.classList.remove("found-track");
    void foundBox.offsetWidth;
    foundBox.classList.add("found-track");
  }

  Audio.haptic([15,35,25]);
  A.shakeBoxSoon(board,box);

  if(foundTurn===1){
    Audio.play("start");
    A.burstAtBox(board,box,"🚩✨");
    showToast(
      "🚩",
      "スタート地点を発見！",
      "ここから逃げ始めたみたいだワン！"
    );
  }else{
  Audio.duckBgm(700);
  Audio.play("paw");

  A.burstAtBox(board,box,"🐾✨");
  showToast(
    "🐕🐾",
    "クンクン……！",
    "ネコの足跡を発見！"
  );
}
  }else{
    const emptyBox=board.querySelector(
      `.box[data-box-index="${box}"]`
    );

    if(emptyBox){
      emptyBox.classList.remove("empty-search");
      void emptyBox.offsetWidth;
      emptyBox.classList.add("empty-search");
    }

    Audio.play("empty");
    Audio.haptic(10);
    A.burstAtBox(board,box,"💨");
    showToast(
      "💨",
      "クンクン……",
      "何もないワン！"
    );
  }

  game.actionLocked=false;

  setMessage(
    `${E.DOGS[dogIndex].label} ${E.DOGS[dogIndex].name} は探索済み✓。`
  );

  afterDogAction();
  render();
}
if(
  data.payload?.type==="captured" &&
  onlineAssignedRole==="cat"
){
  game.actionLocked=false;

  Audio.duckBgm(900);
  Audio.play("capture");

  setTimeout(()=>{
    endGame(
      "dogs",
      "柴犬警察に見つかってしまいました！"
    );
  },500);

  return;
}
      
         if(
  data.payload?.type==="catMoveDone" &&
  onlineAssignedRole==="police"
){
  const turn=Number(data.payload.turn);

  if(
    !Number.isInteger(turn) ||
    turn<1 ||
    turn>E.MAX_TURNS
  ){
    return;
  }

  game.turn=turn;
  game.phase="dogs";
  game.selectedDog=null;
  game.dogAction=[false,false,false];
  game.cpuSearchesThisTurn=0;
  game.actionLocked=false;

  showPrivacy(
    "🐕",
    `ターン${game.turn}・柴犬警察の番`,
    "ネコの移動が完了しました。現在地は秘密です。捜査を開始してください。"
  );

  setMessage(
    "🐕 柴犬を選択。緑の交差点＝移動、青い箱＝探索です。"
  );

  render();
}
         
if(
  data.payload?.type==="trackCount" &&
  onlineAssignedRole==="cat"
){
  const count=Number(data.payload.count);
  const box=Number(data.payload.box);
  const trackTurn=Number(data.payload.trackTurn);

  if(
    Number.isInteger(count) &&
    count>=0
  ){
    onlineFoundTrackCount=count;
  }

  if(
    Number.isInteger(box) &&
    box>=0 &&
    box<E.BOX_COUNT &&
    Number.isInteger(trackTurn)
  ){
    // 今回初めて公開された痕跡か
    const isNewTrack=!game.revealedTracks.has(box);

    game.revealedTracks.set(box,trackTurn);

    // START地点
    if(trackTurn===1){
      game.catHistory.set(box,1);
    }

    // ★ 猫側でも痕跡発見SEを鳴らす
if(isNewTrack){
  Audio.duckBgm(1200);

  if(trackTurn===1){

    // START
    setTimeout(()=>{
      Audio.play("start");
    },180);

  }else{

    // 通常足跡
    setTimeout(()=>{
      Audio.play("paw");
    },250);

  }
}
  }

  render();
}
        if(
  data.payload?.type==="catEscaped" &&
  onlineAssignedRole==="police"
){
  const route=data.payload.route;

  if(Array.isArray(route)){
    cpuCatRoute=route
      .map(step=>({
        box:Number(step.box),
        turn:Number(step.turn)
      }))
      .filter(step=>
        Number.isInteger(step.box) &&
        step.box>=0 &&
        step.box<E.BOX_COUNT &&
        Number.isInteger(step.turn)
      )
      .sort((a,b)=>a.turn-b.turn);
  }

  game.actionLocked=false;

  endGame(
    "cat",
    "11ターンすべて逃げ切られました！"
  );

  return;
}
         
},
       
      onError:()=>{
        onlineStatus.textContent="通信エラーが発生しました";
      },
       onPeerDisconnected:()=>{
  onlinePeerDisconnected=true;
  // ゲーム中なら切断を明示
  if(
    playMode==="onlineCat" ||
    playMode==="onlinePolice"
  ){
    game.actionLocked=true;

    showPrivacy(
      "📡",
      "接続が切れました",
      "相手との接続が切れました。タイトルへ戻って、もう一度オンライン対戦を始めてください。"
    );
     privacyBtn.textContent="タイトルへ戻る";

    setMessage(
      "📡 相手との接続が切れました。"
    );

    render();
  }else{
    onlineStatus.textContent=
      "相手との接続が切れました";
  }
},
    });

  }catch(err){
    console.error(err);
    onlineStatus.textContent="部屋を作れませんでした";
    createOnlineRoomBtn.disabled=false;
  }
});

   bindPress(joinOnlineRoomBtn,async()=>{
  if(!window.NyanOnline){
    onlineStatus.textContent="オンライン機能を読み込めませんでした";
    return;
  }

  const code=(onlineRoomCodeInput.value||"")
    .trim()
    .replace(/\D/g,"");

  if(code.length!==6){
    onlineStatus.textContent="6桁の合言葉コードを入力してください";
    return;
  }

  joinOnlineRoomBtn.disabled=true;
  onlineStatus.textContent="部屋に参加しています…";

  try{
    const room=await window.NyanOnline.joinRoom(code);

    onlineStatus.innerHTML=
      `合言葉コード<br>`+
      `<strong style="font-size:32px">${room.roomCode}</strong><br>`+
      `接続しています…`;

    window.NyanOnline.connect({
      onOpen:()=>{
        onlineStatus.innerHTML=
          `合言葉コード<br>`+
          `<strong style="font-size:32px">${room.roomCode}</strong><br>`+
          `相手と接続しました！`;
      },
       onRole:(data)=>{
    onlineAssignedRole=data.role;
    onlineStartGameBtn.hidden=false;      

    if(data.role==="cat"){
      onlineStatus.innerHTML=
        `🐱 あなたはネコ！<br>`+
        `<span style="font-size:14px">柴犬警察から逃げ切ろう！</span>`;
    }else{
      onlineStatus.innerHTML=
        `🐕 あなたは警察！<br>`+
        `<span style="font-size:14px">いたずらネコを見つけよう！</span>`;
    }
  },
     onGame:(data)=>{

  // 2人ともゲーム開始を押した
  if(data.payload?.type==="ready"){
    onlinePeerReady=true;
    tryStartOnlineGame();
  }
       if(
  data.payload?.type==="catNoEscape" &&
  onlineAssignedRole==="police"
){
  const route=data.payload.route;

  if(Array.isArray(route)){
    cpuCatRoute=route
      .map(step=>({
        box:Number(step.box),
        turn:Number(step.turn)
      }))
      .filter(step=>
        Number.isInteger(step.box) &&
        step.box>=0 &&
        step.box<E.BOX_COUNT &&
        Number.isInteger(step.turn)
      )
      .sort((a,b)=>a.turn-b.turn);
  }

  game.actionLocked=false;

  endGame(
    "dogs",
    "ネコが行き止まりに入り、逃げ道がなくなりました！"
  );

  return;
}

  // 警察3匹の初期配置をネコ側へ反映
  if(
    data.payload?.type==="dogSetup" &&
    onlineAssignedRole==="cat"
  ){
    const dogs=data.payload.dogs;

    if(Array.isArray(dogs) && dogs.length===3){
      game.dogs=[...dogs];
      game.dogSetupCount=3;
      game.phase="catSetup";
      game.turn=1;

      showPrivacy(
        "🐱",
        "警察の配置完了！",
        "柴犬警察3匹の配置を確認して、スタート地点にする箱を1つ選んでください。"
      );

      setMessage(
        "🐱 柴犬の配置を見て、好きな箱に隠れよう。"
      );

      render();
    }
  }

  // ネコのスタート地点を警察側へ反映
  if(
  data.payload?.type==="catSetupDone" &&
  onlineAssignedRole==="police"
){
  game.catPos=null;
  game.catHistory.clear();
  game.catVisible=false;

  game.turn=1;
  game.phase="dogs";
  game.selectedDog=null;
  game.dogAction=[false,false,false];
  game.cpuSearchesThisTurn=0;
  game.actionLocked=false;

  showPrivacy(
    "🐕",
    "捜査開始！",
    "ネコが隠れました。現在地は秘密です。柴犬警察で捜査を開始してください。"
  );

  setMessage(
    "🐕 柴犬を選択。緑の交差点＝移動、青い箱＝探索です。"
  );

  render();
}

  // 警察の移動をネコ側へ反映
  if(
    data.payload?.type==="dogMove" &&
    onlineAssignedRole==="cat"
  ){
    const dogIndex=Number(data.payload.dogIndex);
    const node=Number(data.payload.node);

    if(
      Number.isInteger(dogIndex) &&
      dogIndex>=0 &&
      dogIndex<3 &&
      Number.isInteger(node) &&
      node>=0 &&
      node<E.NODE_COUNT
    ){
      game.dogs[dogIndex]=node;
      game.dogAction[dogIndex]="move";

      setMessage(
        `${E.DOGS[dogIndex].label} ${E.DOGS[dogIndex].name} が移動しました。`
      );

      render();
    }
  }
// 警察がどの箱を探索しているかネコ側へ表示
// 警察の探索をネコ側でも演出
if(
  data.payload?.type==="policeSearch" &&
  onlineAssignedRole==="cat"
){
  const dogIndex=Number(data.payload.dogIndex);
  const box=Number(data.payload.box);

  if(
    Number.isInteger(dogIndex) &&
    dogIndex>=0 &&
    dogIndex<3 &&
    Number.isInteger(box) &&
    box>=0 &&
    box<E.BOX_COUNT
  ){
    setMessage(
      `🐕 ${E.DOGS[dogIndex].name} が箱${box+1}をクンクン調査中…`
    );

    // 現在の犬位置・盤面を確実に反映
    render();

    // CPU戦と同じクンクン演出
    A.animateSniff(
      board,
      game.dogs[dogIndex],
      dogIndex,
      box,
      motionStatus,
      ()=>{
        // 演出終了後は特に何もしない
      }
    );
  }
}
        
        if(
  data.payload?.type==="dogTurnEnd" &&
  onlineAssignedRole==="cat"
){
if(game.turn>=E.MAX_TURNS){

  // オンラインでは警察側にも「ネコ逃げ切り」を通知
  if(playMode==="onlineCat"){
    window.NyanOnline.sendGame({
      type:"catEscaped",
      turn:game.turn
    });
  }

  endGame(
    "cat",
    "11ターンすべて逃げ切りました！"
  );

  return;
}

  game.turn++;

  if(E.getCatLegalMoves(game).length===0){
    endGame("dogs","ネコが次に移動できる箱がありません！");
    return;
  }

  game.phase="cat";
  game.catVisible=false;
  game.selectedDog=null;
  game.dogAction=[false,false,false];

  let extra=
    game.turn===9 ? " あと3ターン！" :
    game.turn===10 ? " あと2ターン！" :
    game.turn===11 ? " LAST TURN！" : "";

  showPrivacy(
    "🐱",
    `ターン${game.turn}・ネコの番`,
    `柴犬警察の捜査が終わりました。次の箱へ逃げてください。${extra}`
  );

  setMessage(
    `🐱 ターン${game.turn}。まだ通っていない隣の箱へ移動しよう。${extra}`
  );

  render();
}
        if(
  data.payload?.type==="searchResult" &&
  onlineAssignedRole==="police"
){
  const dogIndex=Number(data.payload.dogIndex);
  const box=Number(data.payload.box);
  const result=data.payload.result;
  const trackTurn=data.payload.trackTurn;
  const route=data.payload.route;         

  if(
    !Number.isInteger(dogIndex) ||
    dogIndex<0 ||
    dogIndex>=3 ||
    !Number.isInteger(box) ||
    box<0 ||
    box>=E.BOX_COUNT
  ){
    return;
  }

  if(result==="capture"){
    Audio.play("capture");
     if(Array.isArray(route)){
  cpuCatRoute=route
    .map(step=>({
      box:Number(step.box),
      turn:Number(step.turn)
    }))
    .filter(step=>
      Number.isInteger(step.box) &&
      step.box>=0 &&
      step.box<E.BOX_COUNT &&
      Number.isInteger(step.turn)
    )
    .sort((a,b)=>a.turn-b.turn);
}
    Audio.haptic([35,45,70]);
    A.burstAtBox(board,box,"🐱✨");
    A.shakeBoxSoon(board,box);

    game.actionLocked=false;

    endGame(
      "dogs",
      `${E.DOGS[dogIndex].name} が箱${box+1}をクンクン……ネコを発見！`
    );

    return;
  }

if(result==="track"){
  const foundTurn=Number(trackTurn);

  game.revealedTracks.set(
    box,
    Number.isInteger(foundTurn)
      ? foundTurn
      : game.turn
  );

  if(foundTurn===1){
    game.catHistory.set(box,1);
  }

  const foundBox=board.querySelector(
    `.box[data-box-index="${box}"]`
  );

  if(foundBox){
    foundBox.classList.remove("found-track");
    void foundBox.offsetWidth;
    foundBox.classList.add("found-track");
  }

  Audio.haptic([15,35,25]);
  A.shakeBoxSoon(board,box);

  if(foundTurn===1){
    Audio.play("start");
    A.burstAtBox(board,box,"🚩✨");
    showToast(
      "🚩",
      "スタート地点を発見！",
      "ここから逃げ始めたみたいだワン！"
    );
  }else{
  Audio.duckBgm(700);
  Audio.play("paw");

  A.burstAtBox(board,box,"🐾✨");
  showToast(
    "🐕🐾",
    "クンクン……！",
    "ネコの足跡を発見！"
  );
}

}else{
  const emptyBox=board.querySelector(
    `.box[data-box-index="${box}"]`
  );

  if(emptyBox){
    emptyBox.classList.remove("empty-search");
    void emptyBox.offsetWidth;
    emptyBox.classList.add("empty-search");
  }

  Audio.play("empty");
  Audio.haptic(10);
  A.burstAtBox(board,box,"💨");
  showToast(
    "💨",
    "クンクン……",
    "何もないワン！"
  );
}

  game.actionLocked=false;

  setMessage(
    `${E.DOGS[dogIndex].label} ${E.DOGS[dogIndex].name} は探索済み✓。`
  );

  afterDogAction();
  render();
}
if(
  data.payload?.type==="captured" &&
  onlineAssignedRole==="cat"
){
  game.actionLocked=false;

  Audio.duckBgm(900);
  Audio.play("capture");

  setTimeout(()=>{
    endGame(
      "dogs",
      "柴犬警察に見つかってしまいました！"
    );
  },500);

  return;
}
        
        if(
  data.payload?.type==="catMoveDone" &&
  onlineAssignedRole==="police"
){
  const turn=Number(data.payload.turn);

  if(
    !Number.isInteger(turn) ||
    turn<1 ||
    turn>E.MAX_TURNS
  ){
    return;
  }

  game.turn=turn;
  game.phase="dogs";
  game.selectedDog=null;
  game.dogAction=[false,false,false];
  game.cpuSearchesThisTurn=0;
  game.actionLocked=false;

  showPrivacy(
    "🐕",
    `ターン${game.turn}・柴犬警察の番`,
    "ネコの移動が完了しました。現在地は秘密です。捜査を開始してください。"
  );

  setMessage(
    "🐕 柴犬を選択。緑の交差点＝移動、青い箱＝探索です。"
  );

  render();
}
if(
  data.payload?.type==="trackCount" &&
  onlineAssignedRole==="cat"
){
  const count=Number(data.payload.count);
  const box=Number(data.payload.box);
  const trackTurn=Number(data.payload.trackTurn);

  if(
    Number.isInteger(count) &&
    count>=0
  ){
    onlineFoundTrackCount=count;
  }

  if(
    Number.isInteger(box) &&
    box>=0 &&
    box<E.BOX_COUNT &&
    Number.isInteger(trackTurn)
  ){
    // 今回初めて公開された痕跡か
    const isNewTrack=!game.revealedTracks.has(box);

    game.revealedTracks.set(box,trackTurn);

    // START地点
    if(trackTurn===1){
      game.catHistory.set(box,1);
    }

    // ★ 猫側でも痕跡発見SEを鳴らす
if(isNewTrack){
  Audio.duckBgm(1200);

  if(trackTurn===1){

    // START
    setTimeout(()=>{
      Audio.play("start");
    },180);

  }else{

    // 通常足跡
    setTimeout(()=>{
      Audio.play("paw");
    },250);

  }
}
  }

  render();
}
      if(
  data.payload?.type==="catEscaped" &&
  onlineAssignedRole==="police"
){
  const route=data.payload.route;

  if(Array.isArray(route)){
    cpuCatRoute=route
      .map(step=>({
        box:Number(step.box),
        turn:Number(step.turn)
      }))
      .filter(step=>
        Number.isInteger(step.box) &&
        step.box>=0 &&
        step.box<E.BOX_COUNT &&
        Number.isInteger(step.turn)
      )
      .sort((a,b)=>a.turn-b.turn);
  }

  game.actionLocked=false;

  endGame(
    "cat",
    "11ターンすべて逃げ切られました！"
  );

  return;
}
},
      onPresence:(data)=>{
        if(data.ready){
          onlineStatus.innerHTML=
            `合言葉コード<br>`+
            `<strong style="font-size:32px">${room.roomCode}</strong><br>`+
            `🐾 2人そろいました！`;
        }
      },

      onError:()=>{
        onlineStatus.textContent="通信エラーが発生しました";
        joinOnlineRoomBtn.disabled=false;
      },
       onPeerDisconnected:()=>{
  onlinePeerDisconnected=true;
  // ゲーム中なら切断を明示
  if(
    playMode==="onlineCat" ||
    playMode==="onlinePolice"
  ){
    game.actionLocked=true;

    showPrivacy(
      "📡",
      "接続が切れました",
      "相手との接続が切れました。タイトルへ戻って、もう一度オンライン対戦を始めてください。"
    );
     privacyBtn.textContent="タイトルへ戻る";

    setMessage(
      "📡 相手との接続が切れました。"
    );

    render();
  }else{
    onlineStatus.textContent=
      "相手との接続が切れました";
  }
},
    });

  }catch(err){
    console.error(err);

    if(err.message==="room_not_found"){
      onlineStatus.textContent="その部屋は見つかりませんでした";
    }else if(err.message==="room_full"){
      onlineStatus.textContent="この部屋はすでに満員です";
    }else if(err.message==="invalid_room_code"){
      onlineStatus.textContent="6桁の合言葉コードを確認してください";
    }else{
      onlineStatus.textContent="部屋に参加できませんでした";
    }

    joinOnlineRoomBtn.disabled=false;
  }
});
   
  bindPress(localModeBtn,startLocalMode);
  bindPress(cpuModeBtn,startCpuPoliceMode);
  bindPress(playCatSideBtn,()=>chooseCpuSide("cat"));
  bindPress(playPoliceSideBtn,()=>chooseCpuSide("police"));
  bindPress(cpuSideBackBtn,closeCpuSidePicker);
  bindPress(cpuEasyBtn,()=>beginCpuPoliceGame("easy"));
  bindPress(cpuNormalBtn,()=>beginCpuPoliceGame("normal"));
  bindPress(cpuHardBtn,()=>beginCpuPoliceGame("hard"));
  bindPress(difficultyBackBtn,closeDifficultyPicker);
  bindPress(titleSettingsBtn,openSettings);
  bindPress(howToBtn,showHowTo);
  bindPress(soundQuickBtn,toggleQuickSound);
bindPress(abilityCancelBtn,cancelPendingAbility);

  for(let i=0;i<3;i++) bindPress(dogCards[i],()=>selectDog(i));
  bindPress(catViewBtn,toggleCatView);
   bindPress(sneakBtn,toggleSneak);
   bindPress(fakePawBtn,toggleFakePaw);
bindPress(dashBtn,toggleDash);
   bindPress(howlBtn,toggleHowl);
   
  bindPress(settingsBtn,openSettings);
  bindPress(settingsCloseBtn,closeSettings);

bindPress(backToTitleBtn,()=>{
  settingsOverlay.classList.remove("show");

  if(
    playMode==="onlineCat" ||
    playMode==="onlinePolice"
  ){
    window.NyanOnline?.disconnect();
    resetOnlineState();
  }

  initGame(true);
});
  bindPress(sfxToggleBtn,()=>{Audio.toggleSfx();updateSettingsUI();});
  bindPress(bgmToggleBtn,()=>{Audio.toggleBgm();updateSettingsUI();});
function applyBgmVolume(){
  const v=Audio.setBgmVolume(bgmVolumeSlider.value);
  bgmVolumeValue.textContent=`${v}%`;
}

bgmVolumeSlider.addEventListener("input",applyBgmVolume);
bgmVolumeSlider.addEventListener("change",applyBgmVolume);
  bindPress(vibrationToggleBtn,()=>{Audio.toggleVibration();updateSettingsUI();});
  bindPress(finishDogTurnBtn,finishDogTurn);
bindPress(privacyBtn,()=>{
  if(onlinePeerDisconnected){
    window.NyanOnline?.disconnect();
    resetOnlineState();

    privacyBtn.textContent="OK";
    privacyOverlay.classList.remove("show");

    initGame(true);
    return;
  }

  closePrivacy();
}); bindPress(againBtn,()=>{
  Audio.setBgmMode("normal");
  Audio.startBgm();

  // オンライン対戦終了後はホームへ戻す
  if(
    playMode==="onlineCat" ||
    playMode==="onlinePolice"
  ){
    window.NyanOnline?.disconnect();
    resetOnlineState();
    initGame(true);
    return;
  }

  // CPUネコ戦：プレイヤー＝柴犬警察
  if(playMode==="cpuCat"){
    Audio.play("gamestart");

    initGame(false);

    game.phase="dogSetup";
    game.turn=0;

    const label={
      easy:"やさしい",
      normal:"ふつう",
      hard:"つよい"
    }[cpuDifficulty];

    showPrivacy(
      "🐕",
      "0ターン目・警察配置",
      `CPUネコ（${label}）と再戦します。まず柴犬警察3匹を中央16交差点に配置してください。`
    );

    setMessage(
      "🐕 柴犬警察3匹を配置しよう。配置後、CPUネコが隠れます。"
    );

    render();
    return;
  }

  // CPU警察戦：プレイヤー＝ネコ
  if(playMode==="cpuPolice"){
    Audio.play("gamestart");

    initGame(false);

    cpuSetupDogs();
    game.phase="catSetup";
    game.turn=1;

    const label={
      easy:"やさしい",
      normal:"ふつう",
      hard:"つよい"
    }[cpuDifficulty];

    showPrivacy(
      "🐱",
      "逃走1ターン目・ネコの番",
      `CPU柴犬警察（${label}）と再戦します。配置を見て、スタート地点にする箱を1つ選んでください。`
    );

    setMessage(
      "🐱 柴犬の配置を見て、好きな箱に隠れよう。"
    );

    render();
    return;
  }

  // 通常の対人戦
  Audio.play("gamestart");
  initGame(false);

  showPrivacy(
    "🐕",
    "0ターン目・警察配置",
    "まず柴犬警察3匹を中央16交差点に配置してください。配置後にネコがスタート地点を選びます。"
  );

  render();
});

initGame(true);
})();
