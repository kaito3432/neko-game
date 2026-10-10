const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const catalog=require('../collection-catalog.js');
const collection=require('../collection.js');
const presentation=require('../skin-presentation.js');
const monthly=import('../server/pass-monthly-skins.mjs');
const online=import('../server/online-profile.mjs');

const id='dog_pass_2026_12_moonlit';
const item=catalog.getItem('dogSkin',id);
const now=Date.parse('2026-12-10T12:00:00+09:00');
const asset=src=>fs.readFileSync(path.resolve(__dirname,'..',src));

test('Moonlit Shiba is one December Pass-only 3-dog catalog skin, not a coin product',()=>{
  assert.equal(item.name,'月灯りの旅しば');
  assert.equal(item.releaseMonth,'2026-12');
  assert.equal(item.acquisitionType,'passMonthlyReward');
  assert.equal(item.passExclusive,true);
  assert.equal(item.priceCoins,undefined);
  assert.equal(item.preview,item.collectionImage);
  assert.deepEqual(Object.keys(item.pieceImage),['red','black','white']);
  assert.equal(item.cardImage,item.pieceImage);
  assert.equal(collection.displayImage(item,'unowned'),item.collectionImage);
});

test('Moonlit Shiba has exactly eleven production assets at intended dimensions and transparency',()=>{
  const specs=new Map([
    [item.collectionImage,[1254,1254,6]],[item.profileImage,[1254,1254,6]],
    [item.pieceImage.red,[1254,1254,6]],[item.pieceImage.black,[1254,1254,6]],
    [item.pieceImage.white,[1254,1254,6]],
    [item.resultWinImage,[1536,1024,2]],[item.resultLoseImage,[1536,1024,2]],
    [item.moveEffect,[1672,941,6]],[item.foundFootprintEffect,[1254,1254,6]],
    [item.homeCharacterImage,[2172,724,6]],[item.homeDecorImage,[2172,724,6]]
  ]);
  assert.equal(specs.size,11);
  for(const [src,[width,height,colorType]] of specs){
    assert.doesNotMatch(src,/candidate|review|locked/);
    const png=asset(src);
    assert.equal(png.readUInt32BE(16),width,src);
    assert.equal(png.readUInt32BE(20),height,src);
    assert.equal(png[25],colorType,src);
  }
});

test('December Pass grant requires server-verified active period and remains owned afterward',async()=>{
  const {PASS_MONTHLY_SKINS,grantCurrentPassMonthlySkinIfEligible:grant}=await monthly;
  const {initialProfile,SKINS,validateAppearance}=await online;
  assert.equal(PASS_MONTHLY_SKINS[id].category,'dogSkin');
  assert.ok(SKINS.ownedDogSkins.includes(id));
  const base=initialProfile({ownedDogSkins:[id]},'moonlit-test',now);
  assert.equal(base.ownedDogSkins.includes(id),false);
  const periods={'2026-12':id};
  assert.equal(grant(base,{now,periods,catalog:PASS_MONTHLY_SKINS,knownSkins:SKINS}).granted,false);
  const passSubscription={store:'app_store',period:{id:'verified-december',startsAt:now-1000,expiresAt:now+1000},
    verifiedAt:now-1000,autoRenewing:false};
  const granted=grant({...base,passSubscription},{now,periods,catalog:PASS_MONTHLY_SKINS,knownSkins:SKINS});
  assert.equal(granted.granted,true);
  assert.ok(granted.profile.ownedDogSkins.includes(id));
  assert.equal(grant(granted.profile,{now,periods,catalog:PASS_MONTHLY_SKINS,knownSkins:SKINS}).granted,false);
  assert.equal(validateAppearance(granted.profile,{dogSkinId:id}).dogSkinId,id);
});

test('Moonlit Shiba Profile, Home, Result and Effect resolve from the owned catalog item',()=>{
  const owned={ownedDogSkins:['default',id],equippedAppearance:{dogSkinId:id}};
  assert.equal(presentation.effectSource(owned,'dogSkin','move'),item.moveEffect);
  assert.equal(presentation.effectSource(owned,'dogSkin','found'),item.foundFootprintEffect);
  assert.equal(item.homeImage,item.homeCharacterImage);
  assert.match(item.profileImage,/dog_pass_moonlit_profile\.png$/);
  assert.match(item.resultWinImage,/dog_pass_moonlit_result_win\.png$/);
  assert.match(item.resultLoseImage,/dog_pass_moonlit_result_lose\.png$/);
});
