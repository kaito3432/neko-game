const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('home BGM is confirmed after the shared render selects the game track',()=>{
  const source=fs.readFileSync(require.resolve('../game.js'),'utf8').replace(/\r\n/g,'\n');
  const start=source.indexOf('function initGame(showMode=false)');
  const end=source.indexOf('// =====================================\n// \u30aa\u30f3\u30e9\u30a4\u30f3',start);
  const initGame=source.slice(start,end);
  const renderIndex=initGame.lastIndexOf('render();');
  const homeIndex=initGame.lastIndexOf('Audio.setBgmMode("home")');

  assert.ok(renderIndex>=0);
  assert.ok(homeIndex>renderIndex);
});

test('battle BGM uses source files without playback-rate processing',()=>{
  const source=fs.readFileSync(require.resolve('../audio.js'),'utf8');
  assert.match(source,/normal:"\.\/assets\/audio\/bgm_game\.wav"/);
  assert.doesNotMatch(source,/playbackRate|preservesPitch|detune/);
});
