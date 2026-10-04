const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const catalog=require('../collection-catalog.js');
const collection=require('../collection.js');
const presentation=require('../skin-presentation.js');
const monthly=import('../server/pass-monthly-skins.mjs');
const online=import('../server/online-profile.mjs');
const summary=import('../server/pass-summary.mjs');

const id='cat_pass_2026_11_starlight';
const item=catalog.getItem('catSkin',id);
const now=Date.parse('2026-11-10T12:00:00+09:00');
const unowned={ownedCatSkins:['default'],equippedAppearance:{catSkinId:'default'}};

test('adopted Starlight catalog resolves exactly nine normal assets and no locked art',()=>{
  assert.equal(item.name,'星灯りの旅ねこ');
  assert.equal(item.releaseMonth,'2026-11');
  assert.equal(item.acquisitionType,'passMonthlyReward');
  const fields=['collectionImage','profileImage','pieceImage','resultWinImage','resultLoseImage',
    'moveEffect','foundFootprintEffect','homeCharacterImage','homeDecorImage'];
  for(const field of fields){
    assert.ok(fs.existsSync(path.resolve(__dirname,'..',item[field])),field);
    assert.doesNotMatch(item[field],/candidate|locked|preview/);
  }
  assert.equal(item.lockedImage,undefined);
  assert.equal(item.lockedProfileImage,undefined);
  assert.equal(collection.displayImage(item,'unowned'),item.collectionImage);
  assert.equal(collection.displayImage(item,'unowned','profile'),item.profileImage);
  assert.equal(collection.usesLockedImage(item,'unowned'),false);
});

test('current unowned Pass Skin is visible; past/future unowned is hidden; owned persists',()=>{
  const owned={...unowned,ownedCatSkins:['default',id]};
  const current={currentSkinId:id,currentSkinAvailable:true};
  const unavailable={currentSkinId:null,currentSkinAvailable:false};
  assert.equal(collection.isCollectionVisible(item,unowned,current,catalog),true);
  assert.equal(collection.getItemState(unowned,item,catalog),'unowned');
  assert.equal(collection.isCollectionVisible(item,unowned,unavailable,catalog),false);
  assert.equal(collection.isCollectionVisible(item,owned,unavailable,catalog),true);
  assert.equal(collection.getItemState(owned,item,catalog),'owned');
  assert.equal(collection.canEquipItem(unowned,item,catalog),false);
  assert.equal(collection.canEquipItem(owned,item,catalog),true);
  const mission=catalog.getItem('catSkin','cat_kaitou');
  assert.equal(collection.isCollectionVisible(mission,unowned,null,catalog),true);
  assert.equal(collection.usesLockedImage(mission,'unowned'),true);
});

test('server current-month summary follows JST period mapping without future preview',async()=>{
  const {passSummary}=await summary;
  const profile={...unowned,passSubscription:null};
  const options={periods:{'2026-11':id},catalog:{[id]:item},knownSkins:{ownedCatSkins:['default',id]}};
  const current=passSummary(profile,{...options,now});
  assert.equal(current.currentSkinId,id);
  assert.equal(current.currentSkinAvailable,true);
  const past=passSummary(profile,{...options,now:Date.parse('2026-12-01T00:00:00+09:00')});
  const future=passSummary(profile,{...options,now:Date.parse('2026-10-31T23:59:59+09:00')});
  assert.equal(past.currentSkinAvailable,false);
  assert.equal(future.currentSkinAvailable,false);
});

test('server-owned Pass Skin remains equippable after Pass expiry and rejects client self-claim',async()=>{
  const {initialProfile,SKINS,validateAppearance,validateProfileCharacter}=await online;
  const {grantCurrentPassMonthlySkinIfEligible:grant,PASS_MONTHLY_SKINS}=await monthly;
  const base=initialProfile({ownedCatSkins:[id]},'op_test',now);
  assert.equal(base.ownedCatSkins.includes(id),false);
  assert.equal(SKINS.ownedCatSkins.includes(id),true);
  const passSubscription={store:'app_store',period:{id:'verified-test',startsAt:now-1000,expiresAt:now+1000},
    verifiedAt:now-1000,autoRenewing:false};
  const granted=grant({...base,passSubscription},{now,periods:{'2026-11':id},catalog:PASS_MONTHLY_SKINS,
    knownSkins:SKINS});
  assert.equal(granted.granted,true);
  const expired={...granted.profile,passSubscription:{...passSubscription,
    period:{...passSubscription.period,expiresAt:now-1}}};
  assert.equal(validateAppearance(expired,{catSkinId:id}).catSkinId,id);
  assert.equal(validateProfileCharacter(expired,{category:'catSkin',itemId:id}).itemId,id);
});

test('Profile, Board, Result, Home and scaled Move/Found effects use catalog resolver',()=>{
  const owned={...unowned,ownedCatSkins:['default',id],equippedAppearance:{catSkinId:id}};
  assert.equal(item.profileImage.endsWith('cat_pass_starlight_profile.png'),true);
  assert.equal(item.pieceImage.endsWith('cat_pass_starlight_piece.png'),true);
  assert.equal(item.resultWinImage.endsWith('cat_pass_starlight_result_win.png'),true);
  assert.equal(item.resultLoseImage.endsWith('cat_pass_starlight_result_lose.png'),true);
  assert.equal(item.homeCharacterImage.endsWith('cat_pass_starlight_home_character.png'),true);
  assert.equal(item.homeDecorImage.endsWith('cat_pass_starlight_home_decor.png'),true);
  assert.equal(presentation.effectSource(owned,'catSkin','move'),item.moveEffect);
  assert.equal(presentation.effectSource(owned,'catSkin','found'),item.foundFootprintEffect);
  assert.equal(presentation.effectDisplayScale(owned,'catSkin','move'),2);
  assert.equal(presentation.effectDisplayScale(owned,'catSkin','found'),1.75);
  const game=fs.readFileSync(path.resolve(__dirname,'../game.js'),'utf8');
  assert.match(game,/payload\.result==='track'\|\|payload\.result==='capture'/);
});
