const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('home/pre-match renders keep the home track and only an active match selects battle BGM',()=>{
  const source=fs.readFileSync(require.resolve('../game.js'),'utf8').replace(/\r\n/g,'\n');
  const start=source.indexOf('function initGame(showMode=false)');
  const end=source.indexOf('// =====================================\n// \u30aa\u30f3\u30e9\u30a4\u30f3',start);
  const initGame=source.slice(start,end);
  assert.match(initGame,/const returningFromBattle=showMode && battleBgmActive/);
  assert.match(initGame,/battleBgmActive=false/);
  assert.match(initGame,/if\(returningFromBattle\)\{Audio\.setBgmMode\("home"\);Audio\.startBgm\(\);\}/);
  assert.match(source,/if\(battleBgmActive && !game\.gameOver\)Audio\.setBgmMode\("normal"\)/);
  assert.match(source,/if\(battleBgmActive && game\.turn>0 && remaining<=3 && !game\.gameOver\)\{\s*Audio\.setBgmMode\("tension"\)/);
  assert.match(source,/function startLocalMode\(\)\{[\s\S]*?initGame\(false\);[\s\S]*?policeAbilityOverlay\.classList\.add\("show"\);[\s\S]*?render\(\);/);
  assert.doesNotMatch(source.slice(source.indexOf('function startLocalMode(){'),source.indexOf('function selectPoliceAbility(')),/beginBattleBgm|setBgmMode\("normal"\)/);
  for(const start of ['function startOnlineGame(){','function startLocalNormalMode(){','function beginCpuPoliceGame(difficulty){']){
    const block=source.slice(source.indexOf(start),source.indexOf(start)+2000);
    assert.match(block,/beginBattleBgm\(\)/,start);
  }
  assert.match(source,/function startLocalAfterAbilitySelect\(\)[\s\S]*?beginBattleBgm\(\)/);
  assert.match(source,/window\.addEventListener\('nyan-online-recovery',[\s\S]*?beginBattleBgm\(\);\s*render\(\)/);
});

test('home modal and pregame navigation cannot reset the home playback position',()=>{
  const source=fs.readFileSync(require.resolve('../game.js'),'utf8');
  const home=source.slice(source.indexOf('function returnHomeFromOverlay(){'),source.indexOf('function initGame(showMode=false)'));
  assert.match(home,/initGame\(true\)/);
  assert.match(source,/if\(returningFromBattle\)\{Audio\.setBgmMode\("home"\)/);
  for(const [start,end] of [
    ['bindPress(howToBtn,','bindPress(howToNextBtn,'],
    ['bindPress(howToCloseBtn,','bindPress(playCatSideBtn,'],
    ['function openSettings(){','function closeSettings()'],
    ['function closeSettings()','function boxDistance('],
    ['bindPress(shopOpenBtn,','const skillUnlockOverlay='],
    ['function openOnlineRulePicker(){','function closeOnlineRulePicker()'],
    ['function openLocalRulePicker(){','// 通常戦']
  ]){
    const block=source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
    assert.ok(block.length>0,start);
    assert.doesNotMatch(block,/stopBgm\(|setBgmMode\("normal"\)|currentTime\s*=\s*0/,start);
  }
});

test('battle BGM uses source files without playback-rate processing',()=>{
  const source=fs.readFileSync(require.resolve('../audio.js'),'utf8');
  assert.match(source,/normal:"\.\/assets\/audio\/bgm_game\.wav"/);
  assert.match(source,/bgmAudio\.playbackRate=1/);
  assert.match(source,/a\.playbackRate=1/);
  assert.doesNotMatch(source,/playbackRate\s*=\s*(?!1(?:\.0)?\s*;)[^;]+;/);
});

test('BGM mode changes keep one player and do not recreate it at loop boundaries',async()=>{
  const vm=require('node:vm');
  const instances=[];
  class MockAudio{
    constructor(){this.src='';this.paused=true;this.playbackRate=1;this.loadCount=0;this.playCount=0;instances.push(this);}
    load(){this.loadCount++;}
    play(){this.paused=false;this.playCount++;return Promise.resolve();}
    pause(){this.paused=true;}
  }
  let sourceCount=0;
  class MockAudioContext{
    constructor(){this.state='running';this.destination={};}
    createMediaElementSource(){sourceCount++;return {connect(){}};}
    createGain(){return {gain:{value:0},connect(){}};}
  }
  const context={window:{AudioContext:MockAudioContext},Audio:MockAudio,localStorage:{getItem:()=>null},location:{href:'https://example.test/game/'},URL,console,fetch:()=>Promise.reject(new Error('unused'))};
  vm.runInNewContext(fs.readFileSync(require.resolve('../audio.js'),'utf8'),context);
  const bgm=context.window.NyanAudio;
  await bgm.startBgm();
  const player=instances.find(a=>a.playCount>0);
  assert.ok(player);
  bgm.setBgmMode('normal');
  await Promise.resolve();
  assert.equal(player.playbackRate,1);
  assert.equal(player.loop,true);
  const count=instances.length,loads=player.loadCount,plays=player.playCount;
  bgm.setBgmMode('normal');
  assert.equal(instances.length,count);
  assert.equal(player.loadCount,loads);
  assert.equal(player.playCount,plays);
  player.playbackRate=.8;
  bgm.setBgmMode('home');
  assert.equal(player.playbackRate,1);
  assert.equal(instances.filter(a=>a.playCount>0).length,1);
  assert.equal(sourceCount,1);
});

test('home native loop uses 350 ms gain fades without changing user volume or creating a second player',async()=>{
  const vm=require('node:vm');
  const instances=[],gainNodes=[];
  class MockAudio{
    constructor(){this.src='';this.currentTime=0;this.duration=72;this.paused=true;this.events={};this.loadCount=0;this.playCount=0;instances.push(this);}
    addEventListener(type,fn){(this.events[type]||=[]).push(fn);}
    emit(type){for(const fn of this.events[type]||[])fn();}
    load(){this.loadCount++;}
    play(){this.paused=false;this.playCount++;this.emit('playing');return Promise.resolve();}
    pause(){this.paused=true;this.emit('pause');}
  }
  class MockAudioContext{
    constructor(){this.state='running';this.destination={};}
    createMediaElementSource(){return {connect(){}};}
    createGain(){const node={gain:{value:0},connect(){}};gainNodes.push(node);return node;}
  }
  const context={window:{AudioContext:MockAudioContext},Audio:MockAudio,localStorage:{getItem:()=>null,setItem(){}},location:{href:'https://example.test/game/'},URL,console,fetch:()=>Promise.reject(new Error('unused')),requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../audio.js'),'utf8'),context);
  const bgm=context.window.NyanAudio;
  await bgm.startBgm();
  const player=instances.find(a=>a.playCount>0),[loopGain,volumeGain]=gainNodes;
  assert.ok(player.loop);
  assert.equal(gainNodes.length,2);
  player.currentTime=.175;player.emit('timeupdate');
  assert.ok(Math.abs(loopGain.gain.value-.5)<.001);
  assert.ok(Math.abs(volumeGain.gain.value-.58*.72)<.001);
  player.currentTime=71.825;player.emit('timeupdate');
  assert.ok(Math.abs(loopGain.gain.value-.5)<.001);
  player.currentTime=0;player.emit('timeupdate');
  assert.equal(loopGain.gain.value,0);
  player.currentTime=.35;player.emit('timeupdate');
  assert.equal(loopGain.gain.value,1);
  bgm.setBgmVolume(40);
  assert.ok(Math.abs(volumeGain.gain.value-.58*.4)<.001);
  const plays=player.playCount,loads=player.loadCount,count=instances.length;
  bgm.setBgmMode('home');
  assert.equal(player.playCount,plays);
  assert.equal(player.loadCount,loads);
  assert.equal(instances.length,count);
  await bgm.toggleBgm();assert.equal(player.paused,true);
  await bgm.toggleBgm();assert.equal(player.paused,false);
  assert.ok(Math.abs(volumeGain.gain.value-.58*.4)<.001);
  bgm.setBgmMode('normal');
  assert.equal(loopGain.gain.value,1);
  assert.equal(instances.filter(a=>a.playCount>0).length,1);
});

test('home fade also preserves the volume setting without Web Audio',async()=>{
  const vm=require('node:vm');
  const instances=[];
  class MockAudio{
    constructor(){this.src='';this.currentTime=0;this.duration=72;this.paused=true;this.events={};instances.push(this);}
    addEventListener(type,fn){(this.events[type]||=[]).push(fn);}
    emit(type){for(const fn of this.events[type]||[])fn();}
    play(){this.paused=false;this.emit('playing');return Promise.resolve();}
    pause(){this.paused=true;this.emit('pause');}
    load(){}
  }
  const context={window:{},Audio:MockAudio,localStorage:{getItem:()=>null,setItem(){}},location:{href:'https://example.test/game/'},URL,console,requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../audio.js'),'utf8'),context);
  const bgm=context.window.NyanAudio;
  await bgm.startBgm();
  const player=instances.find(a=>!a.paused);
  player.currentTime=71.825;player.emit('timeupdate');
  assert.ok(Math.abs(player.volume-.58*.72*.5)<.001);
  bgm.setBgmVolume(40);
  assert.ok(Math.abs(player.volume-.58*.4*.5)<.001);
  player.currentTime=.35;player.emit('timeupdate');
  assert.ok(Math.abs(player.volume-.58*.4)<.001);
});
