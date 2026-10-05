const test=require('node:test');
const assert=require('node:assert/strict');
const Pass=require('../pass-google-play-provider.js');
const Model=require('../pass-ui-model.js');
const product={productId:'pass-monthly-test',basePlanId:'monthly-test',billingPeriod:'P1M',
  displayPrice:'¥500',currencyCode:'JPY',offerToken:'base-plan-offer'};
function fixture({status='purchased',acknowledged=false,verifyError=false,products=[product]}={}){
  const calls=[];
  const purchase={status,purchaseToken:'opaque-token',productIds:[product.productId],acknowledged};
  const plugin={loadSubscriptionProducts:async()=>({products}),
    purchaseSubscription:async input=>{calls.push(['purchase',input]);return purchase;},
    currentSubscriptions:async()=>({purchases:[purchase]}),
    acknowledgePurchase:async()=>{calls.push(['acknowledge']);}};
  const api={identity:async()=>({playerId:'op_test'}),
    verifyPurchase:async()=>{calls.push(['verify']);if(verifyError)throw new Error('denied');return {active:true};},
    refresh:async()=>({passSummary:{active:true}})};
  const provider=Pass.createProvider({plugin,api});
  provider.configure({productId:product.productId,basePlanId:product.basePlanId});
  return {provider,calls};
}
test('Android PassはPlayの月額表示とbase planを使う',async()=>{
  const {provider}=fixture();assert.equal((await provider.loadProduct()).product.displayPrice,'¥500');
  assert.equal(provider.getProduct().offerToken,'base-plan-offer');
  const view=Model.fromServer({googleProductId:product.productId,googleBasePlanId:product.basePlanId},null,
    provider.getProduct());
  assert.equal(view.canPurchase,true);assert.equal(view.price.source,'google-play');
  assert.equal(view.price.text,'¥500 / 月');
  assert.equal((await fixture({products:[]}).provider.loadProduct()).product,null);
});
test('購入後にserver検証してから未acknowledged tokenだけacknowledgeする',async()=>{
  const f=fixture();await f.provider.loadProduct();assert.equal((await f.provider.purchase()).purchased,true);
  assert.deepEqual(f.calls.map(x=>x[0]),['purchase','verify','acknowledge']);
  assert.equal(f.calls[0][1].offerToken,'base-plan-offer');
  const acknowledged=fixture({acknowledged:true});await acknowledged.provider.loadProduct();
  await acknowledged.provider.purchase();assert.deepEqual(acknowledged.calls.map(x=>x[0]),['purchase','verify']);
});
test('pending、cancel、server拒否ではPassを付与せずacknowledgeしない',async()=>{
  for(const status of ['pending','cancelled']){
    const f=fixture({status});await f.provider.loadProduct();
    assert.equal((await f.provider.purchase()).purchased,false);
    assert.deepEqual(f.calls.map(x=>x[0]),['purchase']);
  }
  const denied=fixture({verifyError:true});await denied.provider.loadProduct();
  assert.equal((await denied.provider.purchase()).purchased,false);
  assert.deepEqual(denied.calls.map(x=>x[0]),['purchase','verify']);
});
test('再同期は購入済みだけをserverへ送り、未登録商品は安全に無効',async()=>{
  const f=fixture();assert.equal((await f.provider.restore()).restored,true);
  assert.deepEqual(f.calls.map(x=>x[0]),['verify','acknowledge']);
  const unavailable=Pass.createProvider({plugin:null,api:null});
  unavailable.configure({productId:product.productId,basePlanId:product.basePlanId});
  assert.equal((await unavailable.loadProduct()).product,null);
  assert.equal((await unavailable.purchase()).purchased,false);
});
