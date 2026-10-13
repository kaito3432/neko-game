const test=require('node:test'),assert=require('node:assert/strict');
const ids=require('../store-product-ids.js');
test('初回販売は4商品のみ、内部/iOS IDを維持しAndroidは小文字へ',()=>{
 assert.equal(ids.initial.length,4);
 for(const id of ids.initial){assert.equal(ids.toStore('ios',id),id);const google=ids.toStore('android',id);assert.match(google,/^[a-z0-9][a-z0-9_.]*$/);assert.equal(ids.toInternal('android',google),id);}
 assert.equal(ids.toStore('android','BAD'),null);
 assert.equal(ids.initial.includes('REMOVE_ADS'),false);
 assert.equal(ids.restorable.includes('REMOVE_ADS'),true);
});
test('公開外商品は両providerから新規購入できない',async()=>{
 for(const provider of [require('../storekit-provider.js'),require('../google-play-provider.js')]){
  const p=provider.createProvider({plugin:{},api:{}});
  for(const id of ['REMOVE_ADS','REMOVE_ADS_PLUS_SKILL_PACK_01','SKIN_PACK_01','SKIN_PACK_02'])assert.equal((await p.purchaseProduct(id)).reason,'unknownProduct');
 }
});
test('Productionは両Store環境を検証へ送る、Sandbox WorkerはProduction取引を拒否する',async()=>{
 const {applePurchaseEnvironmentAllowed:allowed}=await import('../server/storekit-verification.mjs');
 const env={NYAN_ENVIRONMENT:'production'};
 assert.equal(allowed(env,'Production','op_user'),true);
 assert.equal(allowed(env,'Sandbox','op_user'),true);
 assert.equal(allowed(env,'Sandbox','op_review'),true);
 assert.equal(allowed(env,'Production','op_review'),true);
 assert.equal(allowed(env,'Unknown','op_review'),false);
 assert.equal(allowed({NYAN_ENVIRONMENT:'sandbox'},'Production','op_review'),false);
});
