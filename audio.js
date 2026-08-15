/* にゃんチェイス - 効果音 / BGM / 設定
   Ver1.5.3
   外部音源なしで動作する軽量Web Audio版。
*/
window.NyanAudio = (() => {
  let audioCtx=null;

  const settings={
    sfx: localStorage.getItem("nyanChaseSfx")!=="off",
    bgm: localStorage.getItem("nyanChaseBgm")!=="off",
    vibration: localStorage.getItem("nyanChaseVibration")!=="off"
  };

  let bgmStarted=false;
  let bgmTimer=null;
  let bgmStep=0;
  let bgmMode="normal";
  let bgmGain=null;

  function ensureAudio(){
    try{
      if(!audioCtx){
        const AC=window.AudioContext||window.webkitAudioContext;
        if(!AC) return null;
        audioCtx=new AC();
      }
      if(audioCtx.state==="suspended"){
        audioCtx.resume();
      }
      return audioCtx;
    }catch(e){
      return null;
    }
  }

  function tone(freq,duration=.08,type="sine",gain=.05,delay=0,destination=null){
    const ctx=ensureAudio();
    if(!ctx) return;

    const o=ctx.createOscillator();
    const g=ctx.createGain();

    o.type=type;
    o.frequency.value=freq;

    const dest=destination||ctx.destination;
    g.gain.setValueAtTime(0.0001,ctx.currentTime+delay);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),ctx.currentTime+delay+.01);
    g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+delay+duration);

    o.connect(g);
    g.connect(dest);

    o.start(ctx.currentTime+delay);
    o.stop(ctx.currentTime+delay+duration+.03);
  }

  function play(name){
    if(!settings.sfx) return;

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
    }
  }

  function haptic(pattern){
    if(!settings.vibration) return;

    try{
      if(navigator.vibrate){
        navigator.vibrate(pattern);
      }
    }catch(e){}
  }

  /* =========================
     BGM
     かわいい木琴風の短いループ。
     通常 / 終盤でテンポを少し変える。
  ========================= */

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
    const ctx=ensureAudio();
    if(!ctx) return null;

    if(!bgmGain){
      bgmGain=ctx.createGain();
      bgmGain.gain.value=0.16;
      bgmGain.connect(ctx.destination);
    }

    return bgmGain;
  }

  function bgmTick(){
    if(!settings.bgm || !bgmStarted){
      return;
    }

    const ctx=ensureAudio();
    const destination=ensureBgmGain();

    if(!ctx || !destination){
      return;
    }

    const melody=bgmMode==="tension" ? TENSION_MELODY : NORMAL_MELODY;
    const note=melody[bgmStep % melody.length];
    const bass=BASS[bgmStep % BASS.length];

    if(note){
      tone(note,.18,"triangle",.022,0,destination);
      tone(note*2,.09,"sine",.006,.02,destination);
    }

    if(bass){
      tone(bass,.22,"sine",.012,0,destination);
    }

    bgmStep=(bgmStep+1)%melody.length;

    const interval=bgmMode==="tension" ? 235 : 290;
    bgmTimer=setTimeout(bgmTick,interval);
  }

  function startBgm(){
    if(!settings.bgm) return;

    const ctx=ensureAudio();
    if(!ctx) return;

    if(bgmStarted) return;

    bgmStarted=true;
    bgmStep=0;
    ensureBgmGain();
    bgmTick();
  }

  function stopBgm(){
    bgmStarted=false;

    if(bgmTimer){
      clearTimeout(bgmTimer);
      bgmTimer=null;
    }

    if(bgmGain && audioCtx){
      const now=audioCtx.currentTime;
      bgmGain.gain.cancelScheduledValues(now);
      bgmGain.gain.setValueAtTime(Math.max(.0001,bgmGain.gain.value),now);
      bgmGain.gain.exponentialRampToValueAtTime(.0001,now+.12);

      setTimeout(()=>{
        if(bgmGain && settings.bgm===false){
          try{ bgmGain.disconnect(); }catch(e){}
          bgmGain=null;
        }
      },150);
    }
  }

  function setBgmMode(mode){
    bgmMode=(mode==="tension") ? "tension" : "normal";
  }

  function duckBgm(ms=700){
    if(!bgmGain || !audioCtx) return;

    const now=audioCtx.currentTime;

    bgmGain.gain.cancelScheduledValues(now);
    bgmGain.gain.setValueAtTime(Math.max(.0001,bgmGain.gain.value),now);
    bgmGain.gain.exponentialRampToValueAtTime(.035,now+.05);

    setTimeout(()=>{
      if(bgmGain && audioCtx && settings.bgm){
        const t=audioCtx.currentTime;
        bgmGain.gain.cancelScheduledValues(t);
        bgmGain.gain.setValueAtTime(Math.max(.0001,bgmGain.gain.value),t);
        bgmGain.gain.exponentialRampToValueAtTime(.16,t+.22);
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

  function toggleBgm(){
    settings.bgm=!settings.bgm;
    localStorage.setItem("nyanChaseBgm",settings.bgm?"on":"off");

    if(settings.bgm){
      startBgm();
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

  return {
    settings,
    play,
    haptic,
    startBgm,
    stopBgm,
    setBgmMode,
    duckBgm,
    toggleSfx,
    toggleBgm,
    toggleVibration
  };
})();
