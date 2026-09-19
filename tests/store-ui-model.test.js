const test=require('node:test');
const assert=require('node:assert/strict');
const Monetization=require('../monetization.js');
const Model=require('../store-ui-model.js');

function manager(state={}){
  const storage={value:JSON.stringify(state),getItem(){return this.value;},setItem(_,value){this.value=value;}};
  return Monetization.createManager({storage});
}
const products=Model.DEFINITIONS.map(({productId,name})=>({productId,displayName:name,description:`${name}の説明`,displayPrice:'¥テスト'}));

test('StoreKit利用不可でも6商品を安全に利用不可表示',()=>{
  const views=Model.build(manager(),[]);assert.equal(views.length,6);assert.ok(views.every(view=>view.status==='利用不可'&&!view.available));
});
test('単品購入済みとパック付与を区別して表示',()=>{
  const direct=Model.build(manager({purchasedProductIds:['SKILL_CAT_FAKE_PAW']}),products);
  assert.equal(direct.find(view=>view.productId==='SKILL_CAT_FAKE_PAW').status,'購入済み');
  const packed=Model.build(manager({purchasedProductIds:['SKILL_PACK_01']}),products);
  assert.equal(packed.find(view=>view.productId==='SKILL_POLICE_DASH').status,'パックに含まれる');
  assert.equal(packed.find(view=>view.productId==='SKILL_PACK_01').status,'購入済み');
});
test('3点パックは単品所有数と残数を表示',()=>{
  const views=Model.build(manager({purchasedProductIds:['SKILL_CAT_FAKE_PAW','SKILL_POLICE_DASH']}),products);
  assert.equal(views.find(view=>view.productId==='SKILL_PACK_01').ownership,'2個購入済み・残り1個');
});
test('広告削除セットでも広告削除を購入済み表示',()=>{
  const views=Model.build(manager({purchasedProductIds:['REMOVE_ADS_PLUS_SKILL_PACK_01']}),products);
  assert.equal(views.find(view=>view.productId==='REMOVE_ADS').status,'購入済み');
  assert.equal(views.find(view=>view.productId==='REMOVE_ADS_PLUS_SKILL_PACK_01').status,'購入済み');
});
test('操作中の商品だけ購入中表示',()=>{
  const views=Model.build(manager(),products,'SKILL_POLICE_GROUP_SEARCH');
  assert.equal(views.find(view=>view.productId==='SKILL_POLICE_GROUP_SEARCH').status,'購入中');
});
