const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Mapping=require('../store-product-ids.js'),Store=require('../storekit-provider.js');
async function statusFor(ids){
 const node=()=>({hidden:false,textContent:'',replaceChildren(){},addEventListener(){}});
 const nodes={storeKitPanel:node(),storeKitProducts:node(),storeKitStatus:node(),storeKitRestore:node()};
 const root={NyanPurchases:{nativePlugin:()=>({}),PRODUCT_IDS:Store.PRODUCT_IDS,provider:{loadProducts:async()=>({products:ids.map(productId=>({productId}))})}},
  NyanStoreProductIds:Mapping,NyanMonetization:{},NyanSkillCatalog:{SKILLS:{}},NyanStoreUIModel:{build:()=>[]},addEventListener(){},
  document:{getElementById:id=>nodes[id]||null,querySelectorAll:()=>[]}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../storekit-ui.js'),'utf8'),root);
 await new Promise(r=>setImmediate(r));return nodes.storeKitStatus.textContent;
}
test('all four sale products are available without the two restore-only products',async()=>{
 assert.equal(Store.PRODUCT_IDS.length,6);assert.equal(Mapping.initial.length,4);
 assert.equal(await statusFor(Mapping.initial),'購入可能です');
});
test('three of four sale products report a partial availability error',async()=>{
 assert.match(await statusFor(Mapping.initial.slice(0,3)),/一部の商品を読み込めませんでした/);
});
test('zero sale products report load failure',async()=>{
 assert.match(await statusFor([]),/商品を読み込めませんでした/);
});
test('restore-only extras or duplicates cannot hide a missing sale product',async()=>{
 assert.equal(await statusFor(Mapping.restorable),'購入可能です');
 assert.match(await statusFor([...Mapping.initial.slice(0,3),Mapping.initial[0]]),/一部の商品/);
 assert.match(await statusFor(Mapping.restorable.filter(id=>!Mapping.initial.includes(id))),/通信環境/);
});
