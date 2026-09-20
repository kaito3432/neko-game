const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('対人戦の再戦は前回ルールで分岐し、通常戦はスキル選択へ進まない',()=>{
  const source=read('game.js');
  const rematch=source.slice(source.indexOf('bindPress(againBtn,'),source.indexOf('let bootRecoveryRunning='));
  assert.match(rematch,/if\(game\.abilitiesEnabled!==true\)\{\s*startLocalNormalMode\(\);\s*return;/);
  assert.match(rematch,/game\.abilitiesEnabled=true;[\s\S]*policeAbilityOverlay\.classList\.add\("show"\)/);
  assert.match(rematch,/playMode==="cpuCat"/);
  assert.match(rematch,/playMode==="onlineCat"/);
});

test('設定から収益化UIを外し、ホームの専用ショップへ置く',()=>{
  const html=read('index.html');
  const settings=html.slice(html.indexOf('id="settingsOverlay"'),html.indexOf('id="skillUnlockOverlay"'));
  assert.doesNotMatch(settings,/skillModeUnlockPanel|storeKitPanel/);
  assert.match(html,/id="shopOpenBtn"[^>]*>🛍️ ショップ/);
  assert.match(html,/data-shop-category="skills"/);
  assert.match(html,/data-shop-category="ads"/);
  assert.match(html,/data-shop-role="cat"/);
  assert.match(html,/data-shop-role="police"/);
  assert.doesNotMatch(html,/スキルストア/);
});

test('ショップは単一カテゴリを描画し、解放導線と復元を分離する',()=>{
  const html=read('index.html'),source=read('storekit-ui.js');
  const shop=html.slice(html.indexOf('id="shopOverlay"'),html.indexOf('id="lastTurnBanner"'));
  assert.doesNotMatch(shop,/skillModeUnlockPanel/);
  assert.match(html,/id="localSkillUnlockOpen"/);
  assert.doesNotMatch(html,/id="onlineSkillUnlockOpen"/);
  assert.match(html,/id="onlineSkillModeNotice"/);
  assert.match(shop,/id="shopPackProducts"/);
  assert.match(shop,/class="shop-footer"/);
  assert.match(source,/list\.hidden=category!=='ads'/);
  assert.match(source,/browser\.hidden=category!=='skills'/);
  assert.match(source,/view=>Boolean\(view\.packId\)/);
  assert.match(source,/skill=>skill\.role===role/);
  assert.match(source,/shopPreviewPrice/);
});

test('全5スキルの図解を遊び方とショップで共用する',()=>{
  const game=read('game.js'),shop=read('storekit-ui.js'),html=read('index.html');
  const start=game.indexOf('const howToSkillDescriptions=');
  const end=game.indexOf('\n};\nwindow.NyanHowToSkillDescriptions',start)+3;
  assert.ok(start>=0&&end>start);
  const descriptions=vm.runInNewContext(`${game.slice(start,end)}\nhowToSkillDescriptions`);
  for(const id of ['sneak','fakepaw','howl','dash','search']){
    assert.ok(descriptions[id]?.visual?.trim(),`${id}の図解`);
    assert.ok(descriptions[id]?.detail?.trim(),`${id}の説明`);
  }
  assert.match(shop,/NyanHowToSkillDescriptions/);
  assert.match(shop,/shopPreviewVisual'\)\.innerHTML=info\?\.visual\|\|''/);
  assert.match(html,/id="shopPreviewVisual"/);
  assert.match(read('style.css'),/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
