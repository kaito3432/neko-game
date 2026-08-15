/* にゃんチェイス - 効果音 / BGM / 設定
   Ver1.5.3a
   iPhone/Safari向けにBGM開始処理と音量を強化。
*/
window.NyanAudio = (() => {
  let audioCtx=null;

  const savedVolume=parseInt(localStorage.getItem("nyanChaseBgmVolume")||"72",10);
  const settings={
    sfx: localStorage.getItem("nyanChaseSfx")!=="off",
    bgm: localStorage.getItem("nyanChaseBgm")!=="off",
    vibration: localStorage.getItem("nyanChaseVibration")!=="off",
    bgmVolume: Number.isFinite(savedVolume) ? Math.max(0,Math.min(100,savedVolume)) : 72
  };

  let bgmStarted=false;
  let bgmTimer=null;
  let bgmStep=0;
  let bgmMode="normal";
  let bgmGain=null;

  function getContext(){
    try{
      if(!audioCtx){
        const AC=window.AudioContext||window.webkitAudioContext;
        if(!AC) return null;
        audioCtx=new AC();
      }
      return audioCtx;
    }catch(e){
      return null;
    }
  }

  async function unlockAudio(){
    const ctx=getContext();
    if(!ctx) return null;

    try{
      if(ctx.state==="suspended"){
        await ctx.resume();
      }

      // Safariで音声コンテキストを確実にアンロックするための無音再生
      const buffer=ctx.createBuffer(1,1,22050);
      const source=ctx.createBufferSource();
      source.buffer=buffer;
      source.connect(ctx.destination);
      source.start(0);

      return ctx;
    }catch(e){
      return ctx;
    }
  }

  function tone(freq,duration=.08,type="sine",gain=.05,delay=0,destination=null){
    const ctx=getContext();
    if(!ctx || ctx.state!=="running") return;

    const o=ctx.createOscillator();
    const g=ctx.createGain();

    o.type=type;
    o.frequency.value=freq;

    const dest=destination||ctx.destination;

    g.gain.setValueAtTime(0.0001,ctx.currentTime+delay);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),ctx.currentTime+delay+.012);
    g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+delay+duration);

    o.connect(g);
    g.connect(dest);

    o.start(ctx.currentTime+delay);
    o.stop(ctx.currentTime+delay+duration+.03);
  }

  async function play(name){
    if(!settings.sfx) return;

    await unlockAudio();

    switch(name){
      case "tap":
        tone(520,.055,"sine",.035);
        break;
      case "box":
        tone(250,.07,"triangle",.04);
        tone(390,.08,"triangle",.035,.045);
        break;
      case "sniff":
        tone(180,.09,"sine",.025);
        tone(210,.09,"sine",.022,.17);
        tone(185,.09,"sine",.022,.34);
        break;
      case "paw":
        tone(660,.08,"sine",.045);
        tone(880,.12,"sine",.04,.075);
        break;
      case "cat":
        tone(720,.10,"sine",.04);
        tone(960,.12,"sine",.035,.08);
        tone(760,.12,"sine",.03,.18);
        break;
      case "win":
        tone(523,.12,"sine",.04);
        tone(659,.12,"sine",.04,.12);
        tone(784,.18,"sine",.045,.24);
        tone(1047,.28,"sine",.045,.38);
        break;
      case "empty":
        tone(220,.09,"triangle",.025);
        tone(170,.12,"triangle",.02,.08);
        break;
      case "start":
        tone(440,.08,"square",.025);
        tone(660,.10,"square",.025,.08);
        tone(880,.16,"square",.025,.18);
        break;
      case "lastturn":
        tone(523,.10,"triangle",.035);
        tone(659,.10,"triangle",.035,.08);
        tone(784,.14,"triangle",.04,.16);
        tone(988,.18,"triangle",.045,.27);
        break;
    }
  }

  function haptic(pattern){
    if(!settings.vibration) return;
    try{
      if(navigator.vibrate) navigator.vibrate(pattern);
    }catch(e){}
  }

  /* ===== BGM ===== */

  const NORMAL_MELODY=[
    659,784,880,784,
    698,784,659,587,
    659,784,988,880,
    784,698,659,0
  ];

  const TENSION_MELODY=[
    659,784,880,988,
    784,880,988,1047,
    880,784,988,880,
    784,698,784,0
  ];

  const BASS=[
    262,0,262,0,
    233,0,233,0,
    220,0,220,0,
    196,0,196,0
  ];

  function ensureBgmGain(){
    const ctx=getContext();
    if(!ctx) return null;

    if(!bgmGain){
      bgmGain=ctx.createGain();
      // Ver1.6: 初期音量を上げ、設定スライダーと連動
      bgmGain.gain.value=0.62*(settings.bgmVolume/100);
      bgmGain.connect(ctx.destination);
    }

    return bgmGain;
  }

  function bgmTick(){
    if(!settings.bgm || !bgmStarted) return;

    const ctx=getContext();
    const destination=ensureBgmGain();

    if(!ctx || ctx.state!=="running" || !destination){
      bgmTimer=setTimeout(bgmTick,250);
      return;
    }

    const melody=bgmMode==="tension" ? TENSION_MELODY : NORMAL_MELODY;
    const note=melody[bgmStep % melody.length];
    const bass=BASS[bgmStep % BASS.length];

    if(note){
      tone(note,.20,"triangle",.050,0,destination);
      tone(note*2,.10,"sine",.010,.025,destination);
    }

    if(bass){
      tone(bass,.24,"sine",.025,0,destination);
    }

    bgmStep=(bgmStep+1)%melody.length;

    const interval=bgmMode==="tension" ? 235 : 290;
    bgmTimer=setTimeout(bgmTick,interval);
  }

  async function startBgm(){
    if(!settings.bgm) return;

    const ctx=await unlockAudio();
    if(!ctx || ctx.state!=="running") return;

    if(bgmStarted) return;

    if(bgmGain){
      try{ bgmGain.disconnect(); }catch(e){}
      bgmGain=null;
    }

    ensureBgmGain();
    bgmStarted=true;
    bgmStep=0;
    bgmTick();
  }

  function stopBgm(){
    bgmStarted=false;

    if(bgmTimer){
      clearTimeout(bgmTimer);
      bgmTimer=null;
    }

    if(bgmGain && audioCtx){
      const gainNode=bgmGain;
      const now=audioCtx.currentTime;

      try{
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(Math.max(.0001,gainNode.gain.value),now);
        gainNode.gain.exponentialRampToValueAtTime(.0001,now+.12);
      }catch(e){}

      setTimeout(()=>{
        try{ gainNode.disconnect(); }catch(e){}
        if(bgmGain===gainNode) bgmGain=null;
      },160);
    }
  }

  function setBgmMode(mode){
    bgmMode=(mode==="tension") ? "tension" : "normal";
  }

  function duckBgm(ms=700){
    if(!bgmGain || !audioCtx || audioCtx.state!=="running") return;

    const now=audioCtx.currentTime;

    try{
      bgmGain.gain.cancelScheduledValues(now);
      bgmGain.gain.setValueAtTime(Math.max(.0001,bgmGain.gain.value),now);
      bgmGain.gain.exponentialRampToValueAtTime(.10,now+.05);
    }catch(e){}

    setTimeout(()=>{
      if(bgmGain && audioCtx && settings.bgm){
        const t=audioCtx.currentTime;
        try{
          bgmGain.gain.cancelScheduledValues(t);
          bgmGain.gain.setValueAtTime(Math.max(.0001,bgmGain.gain.value),t);
          bgmGain.gain.exponentialRampToValueAtTime(Math.max(.0001,0.62*(settings.bgmVolume/100)),t+.22);
        }catch(e){}
      }
    },ms);
  }

  function toggleSfx(){
    settings.sfx=!settings.sfx;
    localStorage.setItem("nyanChaseSfx",settings.sfx?"on":"off");

    if(settings.sfx){
      play("tap");
    }

    return settings.sfx;
  }

  async function toggleBgm(){
    settings.bgm=!settings.bgm;
    localStorage.setItem("nyanChaseBgm",settings.bgm?"on":"off");

    if(settings.bgm){
      await startBgm();
    }else{
      stopBgm();
    }

    return settings.bgm;
  }

  function toggleVibration(){
    settings.vibration=!settings.vibration;
    localStorage.setItem("nyanChaseVibration",settings.vibration?"on":"off");
    return settings.vibration;
  }

  function setBgmVolume(value){
    const v=Math.max(0,Math.min(100,Number(value)||0));
    settings.bgmVolume=v;
    localStorage.setItem("nyanChaseBgmVolume",String(v));

    if(bgmGain && audioCtx){
      const now=audioCtx.currentTime;
      const target=Math.max(.0001,0.62*(v/100));
      try{
        bgmGain.gain.cancelScheduledValues(now);
        bgmGain.gain.setValueAtTime(Math.max(.0001,bgmGain.gain.value),now);
        bgmGain.gain.exponentialRampToValueAtTime(target,now+.08);
      }catch(e){}
    }
    return v;
  }

  return {
    settings,
    play,
    haptic,
    unlockAudio,
    startBgm,
    stopBgm,
    setBgmMode,
    duckBgm,
    toggleSfx,
    toggleBgm,
    toggleVibration,
    setBgmVolume
  };
})();
