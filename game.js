/* にゃんチェイス - UI / ゲーム進行
   Ver1.5.2 開発基盤版
   修正: 探索開始直後に actionLocked=true にして二重行動を防止。
*/
(() => {
  const E=NyanEngine;
  const A=NyanAnimation;
  const Audio=NyanAudio;
  let game;
  let toastTimer=null;
  let playMode="local"; // local | cpuPolice
  let cpuTimer=null;

  const $=id=>document.getElementById(id);
  const board=$("board");
  const modeOverlay=$("modeOverlay"),localModeBtn=$("localModeBtn"),cpuModeBtn=$("cpuModeBtn");
  const titleSettingsBtn=$("titleSettingsBtn"),howToBtn=$("howToBtn"),soundQuickBtn=$("soundQuickBtn");
  const turnCard=$("turnCard"),turnDisplay=$("turnDisplay"),turnExtra=$("turnExtra");
  const phaseDisplay=$("phaseDisplay"),guideDisplay=$("guideDisplay");
  const dogCards=[$("dogCard0"),$("dogCard1"),$("dogCard2")];
  const message=$("message");
  const catViewBtn=$("catViewBtn"),settingsBtn=$("settingsBtn");
  const finishDogTurnBtn=$("finishDogTurnBtn"),restartBtn=$("restartBtn");
  const privacyOverlay=$("privacyOverlay"),privacyIcon=$("privacyIcon");
  const privacyTitle=$("privacyTitle"),privacyText=$("privacyText"),privacyBtn=$("privacyBtn");
  const resultOverlay=$("resultOverlay"),resultIcon=$("resultIcon");
  const resultTitle=$("resultTitle"),resultText=$("resultText"),againBtn=$("againBtn");
  const settingsOverlay=$("settingsOverlay"),sfxToggleBtn=$("sfxToggleBtn"),bgmToggleBtn=$("bgmToggleBtn");
  const vibrationToggleBtn=$("vibrationToggleBtn"),sfxState=$("sfxState"),bgmState=$("bgmState");
  const vibrationState=$("vibrationState"),settingsCloseBtn=$("settingsCloseBtn");
  const bgmVolumeSlider=$("bgmVolumeSlider"),bgmVolumeValue=$("bgmVolumeValue");
  const toast=$("toast"),toastIcon=$("toastIcon"),toastTitle=$("toastTitle"),toastText=$("toastText");
  const motionStatus=$("motionStatus"),confettiLayer=$("confettiLayer");

  function bindPress(el,fn){
    if(!el)return;

    let lastFire=0;

    const fire=(e)=>{
      if(el.disabled)return;

      const now=Date.now();
      if(now-lastFire<350)return;
      lastFire=now;

      if(e){
        e.preventDefault();
        e.stopPropagation();
      }

      Audio.unlockAudio().then(()=>Audio.startBgm());
      fn(e);
    };

    if(window.PointerEvent){
      el.addEventListener("pointerup",fire,{passive:false});
    }else{
      el.addEventListener("touchend",fire,{passive:false});
    }

    el.addEventListener("click",fire,{passive:false});
  }

  function initGame(showMode=false){
    game=E.createState();
    clearTimeout(cpuTimer);
    privacyOverlay.classList.remove("show");
    resultOverlay.classList.remove("show");
    settingsOverlay.classList.remove("show");
    hideToast();
    setMessage("🐱 ネコのスタート地点を秘密に決めよう。好きな箱を1つタップしてください。");
    if(showMode){
      modeOverlay.classList.add("show");
    }
    render();
  }

  function startLocalMode(){
    playMode="local";
    modeOverlay.classList.remove("show");
    initGame(false);
  }

  function startCpuPoliceMode(){
    playMode="cpuPolice";
    modeOverlay.classList.remove("show");
    initGame(false);
  }

  function render(){
    renderBoard();
    renderStatus();
    renderDogCards();
    renderControls();
  }

  function renderBoard(){
    board.innerHTML="";

    for(let i=0;i<E.BOX_COUNT;i++){
      const r=E.boxRow(i),c=E.boxCol(i),b=document.createElement("button");
      b.type="button";
      b.className="box";
      b.dataset.boxIndex=String(i);
      b.style.left=`calc(var(--road) + ${c} * (var(--road) + var(--boxs)))`;
      b.style.top=`calc(var(--road) + ${r} * (var(--road) + var(--boxs)))`;
      b.style.width="var(--boxs)";
      b.style.height="var(--boxs)";

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

      if(game.phase!=="cat"&&game.revealedTracks.has(i)){
        b.classList.add("revealed");
        if(game.catHistory.get(i)===0)b.classList.add("start-track");
      }

      b.innerHTML=`<span class="boxnum">${i+1}</span>
        <img class="box-art" src="./assets/images/box.png" alt="">
        ${game.phase==="cat"&&game.catVisible&&game.catPos===i?'<span class="cat"><img class="cat-art" src="./assets/images/cat.png" alt="ネコ"></span>':""}
        ${privateHistoryHTML(i)}
        ${publicTrackHTML(i)}
        ${game.phase==="cat"&&game.catVisible&&E.isCatDeadEnd(game,i)?'<span class="danger-mark">⚠️</span>':""}`;

      bindPress(b,()=>handleBoxPress(i));
      board.appendChild(b);
    }

    for(let i=0;i<E.NODE_COUNT;i++){
      const r=E.nodeRow(i),c=E.nodeCol(i),n=document.createElement("button");
      n.type="button";
      n.className="node";
      n.style.left=`calc(${c} * (var(--road) + var(--boxs)) + var(--road)/2)`;
      n.style.top=`calc(${r} * (var(--road) + var(--boxs)) + var(--road)/2)`;

      if(!E.isActiveDogNode(i)){n.classList.add("inactive");n.disabled=true;}
      if(game.phase==="dogSetup"&&E.isActiveDogNode(i))n.classList.add("setup");
      if(game.selectedDog!==null&&game.dogs[game.selectedDog]===i)n.classList.add("selected");

      if(game.phase==="dogs"&&game.selectedDog!==null&&!game.dogAction[game.selectedDog]&&!game.actionLocked
         &&E.getDogLegalMoves(game,game.selectedDog).includes(i)){
        n.classList.add("move");
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
  }

  function privateHistoryHTML(i){
    if(game.phase!=="cat"||!game.catVisible||!game.catHistory.has(i))return"";
    if(game.catHistory.get(i)===0){
      return'<span class="private-foot private-start"><img src="./assets/images/start.png" alt="スタート"></span>';
    }
    return'<span class="private-foot"><img src="./assets/images/paw.png" alt="足跡"></span>';
  }

  function publicTrackHTML(i){
    if(game.phase==="cat"||!game.revealedTracks.has(i))return"";
    if(game.catHistory.get(i)===0){
      return'<span class="track-badge"><img class="start-art" src="./assets/images/start.png" alt="START"></span>';
    }
    return'<span class="track-badge"><img class="track-art" src="./assets/images/paw.png" alt="足跡"></span>';
  }

  function handleBoxPress(i){
    if(game.gameOver||game.actionLocked)return;
    A.tapPopBox(board,i);

    if(game.phase==="catSetup"){
      game.catPos=i;
      game.catHistory.set(i,0);
      game.catVisible=false;

      if(playMode==="cpuPolice"){
        cpuSetupDogs();
        game.phase="cat";
        showPrivacy("🐱","ターン1・ネコの番",
          "CPU柴犬警察の配置が完了しました。ネコの現在地を確認して移動してください。");
        setMessage("🐱 「ネコ位置を見る」を押して、自分の足跡と移動先を確認してください。");
      }else{
        game.phase="dogSetup";
        showPrivacy("🐕","柴犬警察へ交代",
          "ネコのスタート地点は秘密になりました。中央の16交差点から柴犬3匹のスタート位置を順番に選んでください。");
        setMessage("🐕 中央16交差点から柴犬3匹を配置してください。");
      }

      render();
      return;
    }

    if(game.phase==="cat"){
      if(!game.catVisible){
        setMessage("まず「👀 ネコ位置を見る」をタップしてください。");
        return;
      }

      if(!E.getCatLegalMoves(game).includes(i)){
        setMessage("グレーの箱には戻れません。緑の箱から1つ選んでください。");
        return;
      }

      const dead=E.isCatDeadEnd(game,i);
      const from=game.catPos;

      // 猫移動中も入力ロック
      game.actionLocked=true;
      Audio.haptic(10);
      Audio.play("cat");

      A.animateCatMove(board,from,i,()=>{
        game.catPos=i;
        game.catHistory.set(i,game.turn);
        game.catVisible=false;

        if(dead||E.getCatLegalMoves(game).length===0){
          game.actionLocked=false;
          endGame("dogs","ネコが行き止まりに入り、次の逃げ道がなくなりました！");
          return;
        }

        game.phase="dogs";
        game.selectedDog=null;
        game.dogAction=[false,false,false];
        game.actionLocked=false;

        if(playMode==="cpuPolice"){
          setMessage("🤖 柴犬警察CPUが捜査中…");
          render();
          cpuTimer=setTimeout(runCpuPoliceTurn,550);
        }else{
          showPrivacy("🐕","柴犬警察の番",
            "ネコの移動が完了しました。現在地と未発見の足跡は隠れています。");
          setMessage("🐕 柴犬を選択すると、緑の交差点へ移動・青い箱を探索できます。");
          render();
        }
      });
      render();
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
        game.phase="cat";
        showPrivacy("🐱","ターン1・ネコの番",
          "柴犬3匹の配置が完了しました。ネコさんだけ画面を見てください。");
        setMessage("🐱 「ネコ位置を見る」を押して、自分の足跡と移動先を確認してください。");
      }else{
        setMessage(`${E.DOGS[di].label} ${E.DOGS[di].name} を配置しました。次の柴犬を選んでください。`);
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

      if(!E.getDogLegalMoves(game,di).includes(i)){
        setMessage("緑色に光っている交差点へ1マス移動できます。");
        return;
      }

      // 移動は即時確定。以後この犬は行動不可。
      Audio.play("tap");
      game.dogs[di]=i;
      game.dogAction[di]="move";
      game.selectedDog=null;
      setMessage(`${E.DOGS[di].label} ${E.DOGS[di].name} は移動済み✓。`);
      afterDogAction();
      render();
    }
  }

  function selectDog(di){
    if(playMode!=="local")return;
    if(game.phase!=="dogs"||game.gameOver||game.actionLocked||game.dogs[di]===null)return;

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
    Audio.play("tap");
    setMessage(`${E.DOGS[di].label} ${E.DOGS[di].name} を選択。緑の交差点＝移動、青い箱＝探索です。`);
    render();
  }

  function performSearch(di,bi){
    // ★ バグ修正の核心：
    // 探索アニメーションが始まる「前」に行動済みにして入力をロックする。
    game.dogAction[di]="search";
    game.selectedDog=null;
    game.actionLocked=true;
    render();

    A.animateSniff(board,game.dogs[di],di,bi,motionStatus,()=>{
      if(bi===game.catPos){
        Audio.play("cat");
        Audio.haptic([35,45,70]);
        A.burstAtBox(board,bi,"🐱✨");
        A.shakeBoxSoon(board,bi);
        game.actionLocked=false;
        endGame("dogs",`${E.DOGS[di].name} が箱${bi+1}をクンクン……ネコを発見！`);
        return;
      }

      if(game.catHistory.has(bi)){
        game.revealedTracks.set(bi,game.catHistory.get(bi));
        Audio.haptic([15,35,25]);
        A.shakeBoxSoon(board,bi);

        if(game.catHistory.get(bi)===0){
          Audio.play("start");
          A.burstAtBox(board,bi,"🚩✨");
          showToast("🚩","スタート地点を発見！","ここから逃げ始めたみたいだワン！");
        }else{
          Audio.play("paw");
          A.burstAtBox(board,bi,"🐾✨");
          showToast("🐕🐾","クンクン……！","ネコの足跡を発見！");
        }
      }else{
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

  function finishDogTurn(){
    if(game.phase!=="waitingEnd"||game.gameOver||game.actionLocked)return;

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
    turnDisplay.textContent=`${game.turn} / ${E.MAX_TURNS}`;

    if(game.turn>=9 && !game.gameOver){
      Audio.setBgmMode("tension");
    }else{
      Audio.setBgmMode("normal");
    }

    turnCard.className="card turn";
    turnExtra.textContent="";

    if(game.turn===9&&!game.gameOver){turnCard.classList.add("t9");turnExtra.textContent="あと3ターン！";}
    if(game.turn===10&&!game.gameOver){turnCard.classList.add("t10");turnExtra.textContent="あと2ターン！";}
    if(game.turn===11&&!game.gameOver){turnCard.classList.add("t11");turnExtra.textContent="LAST TURN";}

    const p={
      catSetup:"🐱 ネコ初期配置",
      dogSetup:"🐕 柴犬初期配置",
      cat:"🐱 ネコ移動",
      dogs:"🐕 柴犬行動",
      waitingEnd:"🌙 行動完了",
      gameover:"🎉 ゲーム終了"
    };
    phaseDisplay.textContent=p[game.phase]||"";

    if(game.actionLocked){
      guideDisplay.textContent=game.phase==="dogs"?"🐕 クンクン調査中…":"🐱 逃走中…";
    }else if(game.phase==="catSetup"){
      guideDisplay.textContent="ネコのスタート箱を1つタップ";
    }else if(game.phase==="dogSetup"){
      guideDisplay.textContent=`中央16交差点から柴犬を配置 ${game.dogSetupCount}/3`;
    }else if(game.phase==="cat"){
      guideDisplay.textContent=game.catVisible?"緑の箱へ移動。グレーには戻れません":"「ネコ位置を見る」をタップ";
    }else if(game.phase==="dogs"){
      guideDisplay.textContent=game.selectedDog===null?"盤面または下のカードから柴犬を選択":"緑の交差点＝移動 / 青い箱＝探索";
    }else if(game.phase==="waitingEnd"){
      guideDisplay.textContent="柴犬ターン終了をタップ";
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

      const dogImg=["dog_red.png","dog_green.png","dog_blue.png"][i];
      c.innerHTML=`<span class="dog-name"><img class="character-img" src="./assets/images/${dogImg}" alt="">${E.DOGS[i].name}</span>${status}`;
      if(game.selectedDog===i)c.classList.add("selected");

      c.disabled=!(
        playMode==="local" &&
        game.phase==="dogs" &&
        pos!==null &&
        !game.dogAction[i] &&
        !game.actionLocked
      );
    }
  }

  function renderControls(){
    catViewBtn.disabled=game.phase!=="cat"||game.gameOver||game.actionLocked;
    catViewBtn.textContent=game.catVisible?"🙈 ネコ位置を隠す":"👀 ネコ位置を見る";
    finishDogTurnBtn.style.display=playMode==="cpuPolice"?"none":"";
    finishDogTurnBtn.disabled=game.phase!=="waitingEnd"||game.gameOver||game.actionLocked;
  }

  function setMessage(t){message.textContent=t;}

  function showPrivacy(icon,title,text){
    privacyIcon.textContent=icon;
    privacyTitle.textContent=title;
    privacyText.textContent=text;
    privacyOverlay.classList.add("show");
  }

  function closePrivacy(){
    if(game.actionLocked)return;
    privacyOverlay.classList.remove("show");
  }

  function showToast(icon,title,text){
    clearTimeout(toastTimer);
    toastIcon.textContent=icon;
    toastTitle.textContent=title;
    toastText.textContent=text;
    toast.classList.add("show");
    toastTimer=setTimeout(hideToast,1500);
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
    settingsOverlay.classList.add("show");
    Audio.play("tap");
  }

  function closeSettings(){settingsOverlay.classList.remove("show");}


  function cpuSetupDogs(){
    const active=[];
    for(let i=0;i<E.NODE_COUNT;i++){
      if(E.isActiveDogNode(i)) active.push(i);
    }

    // Spread the dogs across the inner 4x4 grid.
    const preferred=[7,10,25,28].filter(E.isActiveDogNode);
    const chosen=[];

    while(chosen.length<3){
      let best=null,bestScore=-Infinity;

      active.forEach(n=>{
        if(chosen.includes(n)) return;

        let score=Math.random()*0.35;

        // Prefer distance from already chosen dogs.
        chosen.forEach(c=>{
          score+=E.manhattanNodeDistance(n,c)*1.6;
        });

        if(preferred.includes(n)) score+=1.2;

        if(score>bestScore){
          bestScore=score;
          best=n;
        }
      });

      chosen.push(best);
    }

    game.dogs=[chosen[0],chosen[1],chosen[2]];
    game.dogSetupCount=3;
  }

  function cpuSearchScore(di,boxIndex){
    let score=Math.random()*0.8;

    // Known track: investigate around discovered traces.
    if(game.revealedTracks.size){
      let nearest=99;
      game.revealedTracks.forEach((_,b)=>{
        const d=Math.abs(E.boxRow(b)-E.boxRow(boxIndex))+Math.abs(E.boxCol(b)-E.boxCol(boxIndex));
        nearest=Math.min(nearest,d);
      });
      score+=Math.max(0,5-nearest)*1.8;
    }else{
      // Early game: prefer central coverage.
      const r=E.boxRow(boxIndex),c=E.boxCol(boxIndex);
      score+=3-Math.abs(r-2)*.6-Math.abs(c-2)*.6;
    }

    // Avoid repeating already revealed boxes.
    if(game.revealedTracks.has(boxIndex)) score-=5;

    return score;
  }

  function cpuMoveScore(di,node){
    let score=Math.random()*0.8;

    // Spread away from other dogs.
    game.dogs.forEach((p,j)=>{
      if(j!==di && p!==null){
        score+=Math.min(4,E.manhattanNodeDistance(node,p))*.7;
      }
    });

    // If tracks are known, move toward them.
    if(game.revealedTracks.size){
      let nearest=99;
      game.revealedTracks.forEach((_,b)=>{
        E.getBoxesAroundNode(node).forEach(nb=>{
          const d=Math.abs(E.boxRow(nb)-E.boxRow(b))+Math.abs(E.boxCol(nb)-E.boxCol(b));
          nearest=Math.min(nearest,d);
        });
      });
      score+=Math.max(0,5-nearest)*1.2;
    }

    return score;
  }

  function chooseCpuAction(di){
    const node=game.dogs[di];
    const searchable=E.getBoxesAroundNode(node);
    const moves=E.getDogLegalMoves(game,di);

    let bestSearch=null,bestSearchScore=-Infinity;
    searchable.forEach(b=>{
      const s=cpuSearchScore(di,b);
      if(s>bestSearchScore){bestSearchScore=s;bestSearch=b;}
    });

    let bestMove=null,bestMoveScore=-Infinity;
    moves.forEach(n=>{
      const s=cpuMoveScore(di,n);
      if(s>bestMoveScore){bestMoveScore=s;bestMove=n;}
    });

    // Search more aggressively when a track is known, otherwise mix move/search.
    const searchBias=game.revealedTracks.size ? 2.0 : 0.25;

    if(bestSearch!==null && (bestSearchScore+searchBias >= bestMoveScore || bestMove===null)){
      return {type:"search",target:bestSearch};
    }

    return {type:"move",target:bestMove};
  }

  function runCpuPoliceTurn(){
    if(playMode!=="cpuPolice" || game.gameOver || game.phase!=="dogs") return;

    let di=game.dogAction.findIndex(a=>a===false);

    if(di===-1){
      cpuFinishTurn();
      return;
    }

    const action=chooseCpuAction(di);
    if(!action){
      game.dogAction[di]="move";
      cpuTimer=setTimeout(runCpuPoliceTurn,350);
      return;
    }

    if(action.type==="move"){
      game.actionLocked=true;
      game.dogs[di]=action.target;
      game.dogAction[di]="move";
      setMessage(`🤖 ${E.DOGS[di].name} が移動したワン！`);
      Audio.play("tap");
      render();

      cpuTimer=setTimeout(()=>{
        game.actionLocked=false;
        render();
        runCpuPoliceTurn();
      },520);

    }else{
      game.selectedDog=di;
      performSearch(di,action.target);

      // performSearch unlocks when animation ends.
      const waitForSearch=()=>{
        if(game.gameOver) return;
        if(game.actionLocked){
          cpuTimer=setTimeout(waitForSearch,120);
          return;
        }
        cpuTimer=setTimeout(runCpuPoliceTurn,360);
      };
      cpuTimer=setTimeout(waitForSearch,180);
    }
  }

  function cpuFinishTurn(){
    if(game.gameOver)return;

    game.phase="waitingEnd";
    setMessage("🤖 CPU柴犬警察の捜査が終了しました。");
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

  function endGame(winner,reason){
    game.gameOver=true;
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

    resultOverlay.classList.add("show");
    resultOverlay.classList.add("resultOverlayCelebration");
    Audio.duckBgm(1250);
    Audio.play("win");
    Audio.haptic([40,50,40,50,90]);
    A.confetti(confettiLayer);
    setTimeout(()=>resultOverlay.classList.remove("resultOverlayCelebration"),700);
    render();
  }

  bindPress(localModeBtn,startLocalMode);
  bindPress(cpuModeBtn,startCpuPoliceMode);
  bindPress(titleSettingsBtn,openSettings);
  bindPress(howToBtn,showHowTo);
  bindPress(soundQuickBtn,toggleQuickSound);

  for(let i=0;i<3;i++) bindPress(dogCards[i],()=>selectDog(i));
  bindPress(catViewBtn,toggleCatView);
  bindPress(settingsBtn,openSettings);
  bindPress(settingsCloseBtn,closeSettings);
  bindPress(sfxToggleBtn,()=>{Audio.toggleSfx();updateSettingsUI();});
  bindPress(bgmToggleBtn,()=>{Audio.toggleBgm();updateSettingsUI();});
  bgmVolumeSlider.addEventListener("input",()=>{
    const v=Audio.setBgmVolume(bgmVolumeSlider.value);
    bgmVolumeValue.textContent=`${v}%`;
    Audio.startBgm();
  });
  bindPress(vibrationToggleBtn,()=>{Audio.toggleVibration();updateSettingsUI();});
  bindPress(finishDogTurnBtn,finishDogTurn);
  bindPress(restartBtn,()=>initGame(true));
  bindPress(privacyBtn,closePrivacy);
  bindPress(againBtn,initGame);

  initGame(true);
})();
