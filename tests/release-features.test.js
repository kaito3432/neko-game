'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const flags=require('../release-features.js');
const catalog=require('../collection-catalog.js');
const collection=require('../collection.js');
const skins=require('../skin-presentation.js');
const profiles=require('../online-profile-ui.js');

test('初期リリースでは4機能を個別に非公開にする',()=>{
  assert.deepEqual(flags.flags,{randomMatch:false,ranked:false,pass:false,stamina:false});
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');
  assert.match(html,/<script src="\.\/release-features\.js\?v=/);
  for(const [name,selector] of [['randomMatch','#randomMatchStart'],['ranked','.ranked-profile-card'],
    ['pass','#passOpenBtn'],['stamina','.ranked-stamina-card']]){
    assert.equal(flags.enabled(name),false);
    assert.match(css,new RegExp(`\\.feature-${name.toLowerCase()}-off[^}]*${selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`));
  }
});

test('公開導線と説明では非公開機能を隠し、Roomと通常Helpは残す',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');
  const help=fs.readFileSync(path.join(__dirname,'../support.html'),'utf8');
  const matchmaking=fs.readFileSync(path.join(__dirname,'../random-match.js'),'utf8');
  for(const selector of ['#giftBoxOpenBtn','#passOpenBtn','[data-collection-section="rank"]',
    '[data-feature-ranked]','[data-feature-pass]','.ranked-frame-overlay']){
    assert.ok(css.includes(selector),selector);
  }
  assert.match(html,/id="roomMatchStart"|id="onlineModeBtn"/);
  assert.match(matchmaking,/start\.hidden = !released\('randomMatch'\);rooms\.hidden = false/);
  assert.match(html,/data-feature-cpu-daily>CPU対戦が対象です/);
  assert.match(help,/data-feature-pass/);
  assert.match(help,/data-feature-random/);
  const pass=catalog.ITEMS.find(item=>item.acquisitionType==='passMonthlyReward');
  const original=globalThis.NyanReleaseFeatures;
  globalThis.NyanReleaseFeatures=flags;
  try{assert.notEqual(profiles.imageSource({category:pass.category,itemId:pass.id}),pass.profileImage);}
  finally{globalThis.NyanReleaseFeatures=original;}
});

test('非公開スキンとランクフレームは表示から除き、カタログと所有権は保持する',()=>{
  const original=globalThis.NyanReleaseFeatures;
  globalThis.NyanReleaseFeatures=flags;
  try{
    for(const item of catalog.ITEMS.filter(item=>
      ['passMonthlyReward','masterRankReward','rankReward'].includes(item.acquisitionType))){
      assert.equal(collection.isCollectionVisible(item),false,item.id);
      assert.equal(catalog.getItem(item.category,item.id),item);
    }
    const pass=catalog.ITEMS.find(item=>item.acquisitionType==='passMonthlyReward');
    const category=catalog.getCategory(pass.category);
    const data={favoriteCharacter:{category:pass.category,itemId:pass.id},
      [category.ownedField]:[pass.id],equippedAppearance:{[category.equippedField]:pass.id}};
    assert.equal(skins.resolveFavorite(data),null);
    const piece=pass.category==='catSkin'?skins.resolveCatPiece(data):skins.resolveDogPiece(data,0);
    assert.equal(piece.itemId,'default');
  }finally{globalThis.NyanReleaseFeatures=original;}
});
