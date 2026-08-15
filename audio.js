/* にゃんチェイス - 効果音 / 設定 */
window.NyanAudio = (() => {
  let audioCtx=null;

  const settings={
    sfx: localStorage.getItem("nyanChaseSfx")!=="off",
    vibration: localStorage.getItem("nyanChaseVibration")!=="off"
  };

  function ensureAudio(){
    if(!settings.sfx) return null;
    try{
      if(!audioCtx){
        const AC=window.AudioContext||window.webkitAudioContext;
        if(!AC) return null;
        audioCtx=new AC();
      }
      if(audioCtx.state==="suspended") audioCtx.resume();
      return audioCtx;
    }catch(e){ return null; }
  }

  function tone(freq,duration=.08,type="sine",gain=.05,delay=0){
    const ctx=ensureAudio();
    if(!ctx) return;
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type;
    o.frequency.value=freq;
    g.gain.setValueAtTime(0.0001,ctx.currentTime+delay);
    g.gain.exponentialRampToValueAtTime(gain,ctx.currentTime+delay+.01);
    g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+delay+duration);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(ctx.currentTime+delay);
    o.stop(ctx.currentTime+delay+duration+.02);
  }

  function play(name){
    if(!settings.sfx) return;
    switch(name){
      case "tap":
        tone(520,.055,"sine",.035); break;
      case "box":
        tone(250,.07,"triangle",.04);
        tone(390,.08,"triangle",.035,.045); break;
      case "sniff":
        tone(180,.09,"sine",.025);
        tone(210,.09,"sine",.022,.17);
        tone(185,.09,"sine",.022,.34); break;
      case "paw":
        tone(660,.08,"sine",.045);
        tone(880,.12,"sine",.04,.075); break;
      case "cat":
        tone(720,.10,"sine",.04);
        tone(960,.12,"sine",.035,.08);
        tone(760,.12,"sine",.03,.18); break;
      case "win":
        tone(523,.12,"sine",.04);
        tone(659,.12,"sine",.04,.12);
        tone(784,.18,"sine",.045,.24);
        tone(1047,.28,"sine",.045,.38); break;
      case "empty":
        tone(220,.09,"triangle",.025);
        tone(170,.12,"triangle",.02,.08); break;
      case "start":
        tone(440,.08,"square",.025);
        tone(660,.10,"square",.025,.08);
        tone(880,.16,"square",.025,.18); break;
    }
  }

  function haptic(pattern){
    if(!settings.vibration) return;
    try{
      if(navigator.vibrate) navigator.vibrate(pattern);
    }catch(e){}
  }

  function toggleSfx(){
    settings.sfx=!settings.sfx;
    localStorage.setItem("nyanChaseSfx",settings.sfx?"on":"off");
    if(settings.sfx) play("tap");
    return settings.sfx;
  }

  function toggleVibration(){
    settings.vibration=!settings.vibration;
    localStorage.setItem("nyanChaseVibration",settings.vibration?"on":"off");
    return settings.vibration;
  }

  return {settings,play,haptic,toggleSfx,toggleVibration};
})();
