const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('Home gift entry stays by the logo while the lower navigation has three actions',()=>{
  const html=source('index.html');
  const brand=html.match(/<section class="vu3-brand">([\s\S]*?)<\/section>/)?.[1];
  const shortcuts=html.match(/<div class="collection-entry-btn home-collection-daily">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(brand?.includes('id="giftBoxOpenBtn"'));
  assert.ok(brand?.includes('id="giftBoxBadge"'));
  assert.deepEqual([...shortcuts.matchAll(/id="(collectionOpenBtn|dailyOpenBtn|shopOpenBtn)"/g)].map(match=>match[1]),
    ['collectionOpenBtn','dailyOpenBtn','shopOpenBtn']);
  assert.doesNotMatch(shortcuts,/giftBoxOpenBtn/);
  assert.equal((html.match(/id="giftBoxOpenBtn"/g)||[]).length,1);
  const css=source('style.css');
  assert.match(css,/\.visual-update3 \.home-collection-daily\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/\.visual-update3 #giftBoxOpenBtn\{[^}]*width:44px;height:44px/);
  assert.match(css,/\.visual-update3 \.home-collection-daily>button[^}]*white-space:normal/);
});

test('Pass card highlights all eligible skills while count remains server-derived',()=>{
  const ui=source('pass-ui.js');
  assert.match(ui,/対象Skill全種類利用可能/);
  assert.match(ui,/現在の対象：\$\{state\.eligibleSkillCount\}種類/);
  assert.match(ui,/Pass加入だけではSkill Modeは解放されません/);
  assert.match(ui,/広告を3回視聴するとSkill Modeは永続解放されます/);
});

test('skin effect metadata scale survives animation and defaults to one',()=>{
  const css=source('style.css');
  const presentation=source('skin-presentation.js');
  const catalog=source('collection-catalog.js');
  assert.match(css,/--effect-scale:1/);
  assert.match(css,/14%,71%\{[^}]*scale\(var\(--effect-scale\)\)/);
  assert.match(css,/100%\{[^}]*scale\(calc\(var\(--effect-scale\) \* 1\.04\)\)/);
  assert.match(css,/prefers-reduced-motion:reduce[\s\S]*?scale\(var\(--effect-scale\)\)/);
  assert.match(presentation,/setProperty\('--effect-scale'/);
  assert.match(catalog,/effectDisplayScale:Object\.freeze\(\{move:2,found:1\.75\}\)/);
});
