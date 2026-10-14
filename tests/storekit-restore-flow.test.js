const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Store=require('../storekit-provider.js');
const transaction={productId:'SKILL_CAT_FAKE_PAW',transactionId:'100',signedTransaction:'test-proof'};
function setup(result,error){
 let finishes=0,verifications=0,options,owned=true;
 const plugin={addListener(){},async restorePurchases(value){options=value;if(error)throw error;return result;},async finishTransaction(){finishes++;}};
 const api={async identity(){return {};},async verifyTransaction(proof,{restore}){verifications++;assert.equal(restore,true);return {duplicate:true,profile:{owned}};}};
 return {api,provider:Store.createProvider({plugin,api}),counts:()=>({finishes,verifications,owned,options})};
}
test('existing and partial purchase restore uses Worker and preserves duplicate result',async()=>{
 const f=setup({status:'available',transactions:[transaction]});const value=await f.provider.restorePurchases();
 assert.equal(value.restored,true);assert.equal(value.count,1);assert.equal(value.transactions[0].duplicate,true);
 assert.deepEqual(f.counts(),{finishes:1,verifications:1,owned:true,options:{forceSync:false}});
});
test('explicit missing-purchase sync option reaches native without new UI',async()=>{
 const f=setup({status:'available',transactions:[transaction]});await f.provider.restorePurchases({forceSync:true});
 assert.equal(f.counts().options.forceSync,true);
});
for(const status of ['cancelled','noPurchases'])test(`${status} does not grant or finish and releases busy`,async()=>{
 const f=setup({status,transactions:[]});const value=await f.provider.restorePurchases();
 assert.equal(value.restored,false);assert.equal(value.reason,status);assert.equal(f.provider.isBusy(),false);
 assert.equal(f.counts().finishes,0);assert.equal(f.counts().verifications,0);assert.equal(f.counts().owned,true);
});
test('sync communication error is retained, ownership preserved and busy cleared',async()=>{
 const error=Object.assign(new Error('sync failed'),{code:'RESTORE_SYNC_FAILED',data:{errorDomain:'test',errorCode:1}});
 const f=setup(null,error),value=await f.provider.restorePurchases();
 assert.equal(value.error,error);assert.equal(value.restored,false);assert.equal(f.provider.isBusy(),false);
 assert.equal(f.counts().owned,true);assert.equal(f.counts().finishes,0);
});
test('Worker rejection never reports success or finishes',async()=>{
 const f=setup({transactions:[transaction]});f.api.verifyTransaction=async()=>{throw new Error('revoked/token/environment denied');};
 assert.equal((await f.provider.restorePurchases()).restored,false);assert.equal(f.counts().finishes,0);
 assert.equal(f.provider.isBusy(),false);
});
test('unknown products do not reach Worker or finish',async()=>{
 const f=setup({transactions:[{...transaction,productId:'UNKNOWN'}]});
 assert.equal((await f.provider.restorePurchases()).reason,'noPurchases');assert.equal(f.counts().verifications,0);
});
test('native contract: verified current non-consumables first, one sync fallback, no transaction history',()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'../ios/App/App/NyanStoreKitPlugin.swift'),'utf8');
 const collect=source.slice(source.indexOf('private func restorableTransactions'),source.indexOf('@objc func restorePurchases'));
 for(const text of ['Transaction.currentEntitlements','case .verified','ids.contains(transaction.productID)',
  'transaction.productType == .nonConsumable','transaction.revocationDate == nil','transaction.ownershipType == .purchased'])assert.ok(collect.includes(text));
 const flow=source.slice(source.indexOf('@objc func restorePurchases'),source.indexOf('@objc func currentEntitlements'));
 assert.ok(flow.indexOf('let existing = await restorableTransactions()')<flow.indexOf('try await AppStore.sync()'));
 assert.ok(flow.includes('!existing.isEmpty && !call.getBool("forceSync", false)'));
 assert.equal((flow.match(/AppStore.sync\(\)/g)||[]).length,1);
 assert.ok(flow.includes('let transactions = await restorableTransactions()'));
 assert.ok(flow.includes('"noPurchases"'));assert.ok(flow.includes('catch StoreKitError.userCancelled'));
 assert.ok(flow.includes('"RESTORE_SYNC_FAILED"'));assert.ok(!flow.includes('Transaction.all'));
});
