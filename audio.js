/* にゃんチェイス Ver2.0 Phase4 - file based BGM / SE */
window.NyanAudio = (() => {
  const savedVolume=parseInt(localStorage.getItem("nyanChaseBgmVolume")||"72",10);
  const settings={
    sfx: localStorage.getItem("nyanChaseSfx")!=="off",
    bgm: localStorage.getItem("nyanChaseBgm")!=="off",
    vibration: localStorage.getItem("nyanChaseVibration")!=="off",
    bgmVolume: Number.isFinite(savedVolume) ? Math.max(0,Math.min(100,savedVolume)) : 72
  };

  const BGM={
    home:"./assets/audio/bgm_home.wav",
    normal:"./assets/audio/bgm_game.wav",
    tension:"./assets/audio/bgm_tension.wav"
  };

  const SFX_VOLUME={
  tap:0.12,
  button:0.12,
  box:0.18,
  sniff:0.20,
  search:0.20,
  paw:0.24,
  footprint:0.24,
  cat:0.14,
  move:0.14,
  empty:0.18,
  invalid:0.18,
  start:0.24,
  lastturn:0.22,
  turn:0.20,
  gamestart:0.24,
  capture:0.30,
  catwin:0.34,
  policewin:0.34,
  win:0.38
};

  const SFX={
    tap:"./assets/audio/se_button_tap.wav",
    button:"./assets/audio/se_button_tap.wav",
    box:"./assets/audio/se_search.wav",
    sniff:"./assets/audio/se_search.wav",
    search:"./assets/audio/se_search.wav",
    paw:"./assets/audio/se_footprint_found.wav",
    footprint:"./assets/audio/se_footprint_found.wav",
    cat:"./assets/audio/se_move.wav",
    move:"./assets/audio/se_move.wav",
    empty:"./assets/audio/se_invalid.wav",
    invalid:"./assets/audio/se_invalid.wav",
    start:"./assets/audio/se_footprint_found.wav",
    lastturn:"./assets/audio/se_turn_change.wav",
    turn:"./assets/audio/se_turn_change.wav",
    gamestart:"./assets/audio/se_game_start.wav",
    capture:"./assets/audio/se_capture.wav",
    catwin:"./assets/audio/jingle_cat_win.wav",
    policewin:"./assets/audio/jingle_police_win.wav",
    win:"./assets/audio/jingle_cat_win.wav"
  };

let bgmMode="home";
let bgmStarted=false;
let bgmAudio=null;
let unlocked=false;
const sfxCache=new Map();

// iPhoneでもBGM音量を変更するためのWeb Audio
let audioContext=null;
let bgmSource=null;
let bgmGain=null;

function setupBgmWebAudio(){
  if(audioContext && bgmGain) return;

  const AudioContextClass=
    window.AudioContext ||
    window.webkitAudioContext;

  if(!AudioContextClass) return;

  try{
    audioContext=new AudioContextClass();

    const a=createBgm();

    bgmSource=audioContext.createMediaElementSource(a);
    bgmGain=audioContext.createGain();

    bgmSource.connect(bgmGain);
    bgmGain.connect(audioContext.destination);

    // HTMLAudio側は100%にして、
    // 実際の音量はGainNodeで制御
    a.volume=1;

    bgmGain.gain.value=
      .58*(settings.bgmVolume/100);

  }catch(e){
    console.warn("BGM WebAudio setup failed",e);
  }
}

function applyBgmVolume(){
  const volume=.58*(settings.bgmVolume/100);

  if(bgmGain){
    bgmGain.gain.value=volume;
  }else if(bgmAudio){
    // Web Audio非対応ブラウザ用
    bgmAudio.volume=volume;
  }
}

function createBgm(){
  if(bgmAudio) return bgmAudio;

  bgmAudio=new Audio();
  bgmAudio.loop=true;
  bgmAudio.preload="auto";
  bgmAudio.playsInline=true;

  // Web Audio使用前のフォールバック音量
  bgmAudio.volume=.58*(settings.bgmVolume/100);

  return bgmAudio;
}

  function preload(){
    Object.values(BGM).forEach(src=>{
      const a=new Audio();
      a.preload="auto";
      a.src=src;
    });
Object.entries(SFX).forEach(([name,src])=>{
  if(sfxCache.has(name)) return;

  const a=new Audio();
  a.src=src;
  a.preload="auto";
  a.playsInline=true;

  // iOS WebViewで読み込みを明示
  try{
    a.load();
  }catch(e){}

  sfxCache.set(name,a);
});
  }

async function unlockAudio(){
  if(unlocked) return true;

  try{
    setupBgmWebAudio();

    if(audioContext && audioContext.state==="suspended"){
      await audioContext.resume();
    }

    unlocked=true;
    return true;

  }catch(e){
    console.warn("Audio unlock failed",e);
    return false;
  }
}

  async function switchBgm(mode, force=false){
    if(!BGM[mode]) mode="normal";
    bgmMode=mode;
    const a=createBgm();
    const wanted=new URL(BGM[mode],location.href).href;
    const changed=a.src!==wanted;

    if(changed){
      try{
        a.pause();
        a.currentTime=0;
      }catch(e){}
      a.src=BGM[mode];
      a.load();
    }

a.loop=true;

if(bgmGain){
  a.volume=1;
  applyBgmVolume();
}else{
  a.volume=.58*(settings.bgmVolume/100);
}

    if(settings.bgm && (bgmStarted||force)){
      bgmStarted=true;
      try{
        const p=a.play();
        if(p && typeof p.catch==="function") p.catch(()=>{});
      }catch(e){}
    }
  }

async function startBgm(){
  if(!settings.bgm) return;

  const a=createBgm();

  // Web Audioを準備
  setupBgmWebAudio();

  // iPhoneではAudioContextがsuspendedになりやすいので復帰
  if(audioContext && audioContext.state==="suspended"){
    try{
      await audioContext.resume();
    }catch(e){}
  }

  if(!a.src){
    a.src=BGM[bgmMode];
  }

  a.loop=true;

  // Web Audio使用時はHTMLAudio側の音量を1に固定
  if(bgmGain){
    a.volume=1;
    applyBgmVolume();
  }else{
    a.volume=.58*(settings.bgmVolume/100);
  }

  if(bgmStarted && !a.paused){
    return;
  }

  bgmStarted=true;

  try{
    const p=a.play();

    if(p && typeof p.then==="function"){
      await p.catch(()=>{});
    }
  }catch(e){}
}

  function stopBgm(){
    bgmStarted=false;
    if(!bgmAudio) return;
    try{
      bgmAudio.pause();
      bgmAudio.currentTime=0;
    }catch(e){}
  }

  function setBgmMode(mode){
    if(!BGM[mode]) mode="normal";
    if(mode===bgmMode && bgmAudio && bgmAudio.src) return;
    switchBgm(mode,false);
  }

async function play(name){
  if(!settings.sfx) return;

  const src=SFX[name];
  if(!src) return;

  // iOSでAudioContextが停止していたら復帰を試みる
  if(audioContext && audioContext.state==="suspended"){
    try{
      await audioContext.resume();
    }catch(e){}
  }

  let base=sfxCache.get(name);

  if(!base){
    base=new Audio(src);
    base.preload="auto";
    base.playsInline=true;
    base.load();
    sfxCache.set(name,base);
  }

  try{
    // ★ 同じAudioを使い回さない
    // オンライン受信が連続しても前のSEを止めない
    const a=base.cloneNode(true);

    a.volume=SFX_VOLUME[name] ?? .28;
    a.playsInline=true;
    a.preload="auto";

    const p=a.play();

    if(p && typeof p.catch==="function"){
      p.catch(err=>{
        console.warn("SE play failed:",name,err);
      });
    }

  }catch(err){
    console.warn("SE error:",name,err);
  }
}

  function haptic(pattern){
    if(!settings.vibration) return;
    try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){}
  }

function duckBgm(ms=700){
  if(!settings.bgm) return;

  const normal=.58*(settings.bgmVolume/100);
  const ducked=Math.max(.04,normal*.30);

  // Web Audio使用時
  if(bgmGain && audioContext){
    const now=audioContext.currentTime;

    try{
      bgmGain.gain.cancelScheduledValues(now);
      bgmGain.gain.setValueAtTime(
        bgmGain.gain.value,
        now
      );

      // SEが聞こえるようにBGMを下げる
      bgmGain.gain.linearRampToValueAtTime(
        ducked,
        now+0.05
      );

      // 指定時間後に元の音量へ
      bgmGain.gain.setValueAtTime(
        ducked,
        now+(ms/1000)
      );

      bgmGain.gain.linearRampToValueAtTime(
        normal,
        now+(ms/1000)+0.15
      );
    }catch(e){}

    return;
  }

  // Web Audio非対応ブラウザ
  if(!bgmAudio) return;

  bgmAudio.volume=ducked;

  setTimeout(()=>{
    if(bgmAudio && settings.bgm){
      bgmAudio.volume=normal;
    }
  },ms);
}

  function toggleSfx(){
    settings.sfx=!settings.sfx;
    localStorage.setItem("nyanChaseSfx",settings.sfx?"on":"off");
    return settings.sfx;
  }

  async function toggleBgm(){
    settings.bgm=!settings.bgm;
    localStorage.setItem("nyanChaseBgm",settings.bgm?"on":"off");
    if(settings.bgm) await startBgm();
    else stopBgm();
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

  // iPhone → GainNode
  // PCなどWeb Audio未使用時 → HTMLAudio.volume
  applyBgmVolume();

  return v;
}

  preload();

  return {
    settings, play, haptic, unlockAudio, startBgm, stopBgm,
    setBgmMode, duckBgm, toggleSfx, toggleBgm, toggleVibration,
    setBgmVolume
  };
})();
