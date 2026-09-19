const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Skills=require('../skill-catalog.js');
const Products=require('../monetization-products.js');
const Monetization=require('../monetization.js');

function memoryStorage(){
  const values=new Map();
  return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
}
function manager(storage=memoryStorage()){return Monetization.createManager({storage,now:()=>100,logger:{info(){}}});}
function unlock(api){api.recordSkillModeUnlockAdView();api.recordSkillModeUnlockAdView();api.recordSkillModeUnlockAdView();}

test('広告1回と2回では未解放、3回で永久解放',()=>{
  const api=manager();
  api.recordSkillModeUnlockAdView();
  assert.equal(api.getSkillModeUnlockAdViewCount(),1);assert.equal(api.isSkillModeUnlocked(),false);
  api.recordSkillModeUnlockAdView();
  assert.equal(api.getSkillModeUnlockAdViewCount(),2);assert.equal(api.isSkillModeUnlocked(),false);
  api.recordSkillModeUnlockAdView();
  assert.equal(api.getSkillModeUnlockAdViewCount(),3);assert.equal(api.isSkillModeUnlocked(),true);
  api.recordSkillModeUnlockAdView();
  assert.equal(api.getSkillModeUnlockAdViewCount(),3);
});

test('3回到達後に再起動しても解放済み',()=>{
  const store=memoryStorage(),first=manager(store);unlock(first);
  const reopened=manager(store);
  assert.equal(reopened.isSkillModeUnlocked(),true);
  assert.equal(reopened.getSkillModeUnlockAdViewCount(),3);
});

test('無料スキルは解放後に使え、未購入有料スキルは使えない',()=>{
  const api=manager();unlock(api);
  assert.equal(api.canEquipSkill('cat',Skills.SKILL_IDS.CAT_STEALTH),true);
  assert.equal(api.canEquipSkill('police',Skills.SKILL_IDS.POLICE_HOWL),true);
  assert.equal(api.canEquipSkill('cat',Skills.SKILL_IDS.CAT_FAKE_PAW),false);
  assert.equal(api.canEquipSkill('police',Skills.SKILL_IDS.POLICE_GROUP_SEARCH),false);
});

test('フェイク肉球の単品購入後は使用可能',async()=>{
  const api=manager();unlock(api);
  await api.purchaseSkillMock(Skills.SKILL_IDS.CAT_FAKE_PAW);
  assert.equal(api.isProductPurchased(Products.PRODUCT_IDS.SKILL_CAT_FAKE_PAW),true);
  assert.equal(api.canEquipSkill('cat',Skills.SKILL_IDS.CAT_FAKE_PAW),true);
});

test('一斉捜索の単品購入後は使用可能',async()=>{
  const api=manager();unlock(api);
  await api.purchaseSkillMock(Skills.SKILL_IDS.POLICE_GROUP_SEARCH);
  assert.equal(api.isProductPurchased(Products.PRODUCT_IDS.SKILL_POLICE_GROUP_SEARCH),true);
  assert.equal(api.canEquipSkill('police',Skills.SKILL_IDS.POLICE_GROUP_SEARCH),true);
});

test('ダッシュの単品購入後は使用可能',async()=>{
  const api=manager();unlock(api);
  await api.purchaseSkillMock(Skills.SKILL_IDS.POLICE_DASH);
  assert.equal(api.isProductPurchased(Products.PRODUCT_IDS.SKILL_POLICE_DASH),true);
  assert.equal(api.canEquipSkill('police',Skills.SKILL_IDS.POLICE_DASH),true);
});

test('PACK 01購入で3スキルすべてを解放',async()=>{
  const api=manager();unlock(api);
  await api.purchaseSkillPackMock(Skills.SKILL_PACK_IDS.SKILL_PACK_01);
  assert.equal(api.isSkillPackOwned(Skills.SKILL_PACK_IDS.SKILL_PACK_01),true);
  assert.equal(api.canEquipSkill('cat',Skills.SKILL_IDS.CAT_FAKE_PAW),true);
  assert.equal(api.canEquipSkill('police',Skills.SKILL_IDS.POLICE_GROUP_SEARCH),true);
  assert.equal(api.canEquipSkill('police',Skills.SKILL_IDS.POLICE_DASH),true);
});

test('1つ単品所有時のPACK割引対象を判定',async()=>{
  const api=manager();
  await api.purchaseSkillMock(Skills.SKILL_IDS.CAT_FAKE_PAW);
  assert.deepEqual(api.getSkillPackOwnershipStatus(Skills.SKILL_PACK_IDS.SKILL_PACK_01),{
    packId:Skills.SKILL_PACK_IDS.SKILL_PACK_01,
    ownedSkillIds:[Skills.SKILL_IDS.CAT_FAKE_PAW],
    missingSkillIds:[Skills.SKILL_IDS.POLICE_GROUP_SEARCH,Skills.SKILL_IDS.POLICE_DASH],
    ownedCount:1,missingCount:2,eligibleForDiscount:true
  });
});

test('2つ単品所有時のPACK割引対象を判定',async()=>{
  const api=manager();
  await api.purchaseSkillMock(Skills.SKILL_IDS.CAT_FAKE_PAW);
  await api.purchaseSkillMock(Skills.SKILL_IDS.POLICE_GROUP_SEARCH);
  assert.deepEqual(api.getSkillPackOwnershipStatus(Skills.SKILL_PACK_IDS.SKILL_PACK_01),{
    packId:Skills.SKILL_PACK_IDS.SKILL_PACK_01,
    ownedSkillIds:[Skills.SKILL_IDS.CAT_FAKE_PAW,Skills.SKILL_IDS.POLICE_GROUP_SEARCH],
    missingSkillIds:[Skills.SKILL_IDS.POLICE_DASH],
    ownedCount:2,missingCount:1,eligibleForDiscount:true
  });
});

test('3つすべて単品所有時はPACK内欠損なしで割引対象外',async()=>{
  const api=manager();
  for(const skillId of [Skills.SKILL_IDS.CAT_FAKE_PAW,Skills.SKILL_IDS.POLICE_GROUP_SEARCH,Skills.SKILL_IDS.POLICE_DASH]){
    await api.purchaseSkillMock(skillId);
  }
  const status=api.getSkillPackOwnershipStatus(Skills.SKILL_PACK_IDS.SKILL_PACK_01);
  assert.deepEqual(status.ownedSkillIds,[Skills.SKILL_IDS.CAT_FAKE_PAW,Skills.SKILL_IDS.POLICE_GROUP_SEARCH,Skills.SKILL_IDS.POLICE_DASH]);
  assert.deepEqual(status.missingSkillIds,[]);
  assert.equal(status.ownedCount,3);assert.equal(status.missingCount,0);assert.equal(status.eligibleForDiscount,false);
  assert.equal(api.isSkillPackOwned(Skills.SKILL_PACK_IDS.SKILL_PACK_01),false);
});

test('猫・警察とも1試合1能力で、後の選択が同じ役割を置き換える',async()=>{
  const api=manager();unlock(api);
  await api.purchaseSkillMock(Skills.SKILL_IDS.CAT_FAKE_PAW);
  await api.purchaseSkillMock(Skills.SKILL_IDS.POLICE_GROUP_SEARCH);
  let selection={cat:null,police:null};
  selection=api.selectSkillForMatch(selection,'cat',Skills.SKILL_IDS.CAT_STEALTH).selection;
  selection=api.selectSkillForMatch(selection,'cat',Skills.SKILL_IDS.CAT_FAKE_PAW).selection;
  selection=api.selectSkillForMatch(selection,'police',Skills.SKILL_IDS.POLICE_HOWL).selection;
  selection=api.selectSkillForMatch(selection,'police',Skills.SKILL_IDS.POLICE_GROUP_SEARCH).selection;
  assert.deepEqual(selection,{cat:Skills.SKILL_IDS.CAT_FAKE_PAW,police:Skills.SKILL_IDS.POLICE_GROUP_SEARCH});
});

test('未所有スキルの直接指定を拒否',()=>{
  const api=manager();unlock(api);
  const result=api.selectSkillForMatch({cat:null,police:null},'cat',Skills.SKILL_IDS.CAT_FAKE_PAW);
  assert.equal(result.selected,false);assert.equal(result.reason,'notEntitled');
});

test('adsRemovedでも任意のリワード広告は利用可能',async()=>{
  const api=manager();await api.purchaseProduct(Products.PRODUCT_IDS.REMOVE_ADS);
  assert.equal((await api.showInterstitialAd()).shown,false);
  assert.equal((await api.showRewardedAd()).rewarded,true);
});

test('広告削除＋PACK 01は指定パックだけを付与',async()=>{
  const api=manager();unlock(api);
  await api.purchaseProduct(Products.PRODUCT_IDS.REMOVE_ADS_PLUS_SKILL_PACK_01);
  assert.equal(api.hasRemovedAds(),true);
  assert.equal(api.isSkillPackOwned(Skills.SKILL_PACK_IDS.SKILL_PACK_01),true);
  assert.equal(api.isSkillOwned(Skills.SKILL_IDS.CAT_FAKE_PAW),true);
  assert.equal(api.isSkillOwned(Skills.SKILL_IDS.POLICE_GROUP_SEARCH),true);
  assert.equal(api.isSkillOwned(Skills.SKILL_IDS.POLICE_DASH),true);
});

test('Store復元は購入権利を再構築し、広告3回の永久解放は保持',async()=>{
  const store=memoryStorage();
  const initial=Monetization.createManager({storage:store,provider:{restorePurchases:async()=>({purchasedProductIds:[]})},logger:{info(){}}});
  unlock(initial);
  await initial.purchaseSkillPackMock(Skills.SKILL_PACK_IDS.SKILL_PACK_01);
  assert.equal(initial.isSkillOwned(Skills.SKILL_IDS.CAT_FAKE_PAW),true);
  await initial.restorePurchases();
  assert.equal(initial.isSkillModeUnlocked(),true);
  assert.equal(initial.isSkillPackOwned(Skills.SKILL_PACK_IDS.SKILL_PACK_01),false);
  assert.equal(initial.isSkillOwned(Skills.SKILL_IDS.CAT_FAKE_PAW),false);
  assert.equal(initial.isSkillOwned(Skills.SKILL_IDS.CAT_STEALTH),true);
});

test('ゲームUIはモード解放と所有権を選択・確定の両方で検証',()=>{
  const source=fs.readFileSync(require.resolve('../game.js'),'utf8');
  assert.match(source,/function startLocalAbilityMode\(\)[\s\S]*?isSkillModeUnlocked/);
  assert.match(source,/function choosePendingPoliceAbility\(ability\)[\s\S]*?canChooseRuntimeSkill/);
  assert.match(source,/function choosePendingCatAbility\(ability\)[\s\S]*?canChooseRuntimeSkill/);
  assert.ok((source.match(/if\(!canChooseRuntimeSkill\(/g)||[]).length>=4);
});
