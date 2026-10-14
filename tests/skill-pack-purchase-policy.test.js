const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Monetization=require('../monetization.js'),Model=require('../store-ui-model.js');
const singles=['SKILL_CAT_FAKE_PAW','SKILL_POLICE_GROUP_SEARCH','SKILL_POLICE_DASH'];
function manager(ids=[]){let saved=JSON.stringify({purchasedProductIds:ids});const storage={getItem:()=>saved,setItem:(_,v)=>{saved=v;}};return {value:Monetization.createManager({storage}),restart:()=>Monetization.createManager({storage})};}
function provider(owner,platform='ios'){
 let calls=0;const selected={PRODUCT_IDS:[],nativePlugin(){},provider:{async purchaseProduct(){calls++;return {purchased:true};},async restorePurchases(){return {restored:true};}}};
 const scope={Capacitor:{getPlatform:()=>platform},NyanStoreUIModel:Model,NyanMonetization:owner,NyanStoreKit:selected,NyanGooglePlay:selected};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../purchase-provider.js'),'utf8'),scope);
 return {api:scope.NyanPurchases.provider,calls:()=>calls};
}
for(let mask=0;mask<8;mask++)test(`pack ownership combination ${mask}: UI and purchase gate`,async()=>{
 const ids=singles.filter((_,i)=>mask&(1<<i)),m=manager(ids).value;
 const view=Model.build(m,[{productId:'SKILL_PACK_01',displayPrice:'¥380'}]).find(v=>v.productId==='SKILL_PACK_01');
 assert.equal(view.available,mask===0);assert.equal(view.displayPrice,'¥380');
 assert.equal(view.purchaseBlockedLabel,mask?'単品スキルを所持しているため購入できません':'');
 for(const platform of ['ios','android']){const p=provider(m,platform),result=await p.api.purchaseProduct('SKILL_PACK_01');assert.equal(result.purchased,mask===0);assert.equal(p.calls(),mask?0:1);}
});
test('owned pack is shown as owned and purchase cannot start',async()=>{
 const m=manager(['SKILL_PACK_01']).value,view=Model.build(m,[{productId:'SKILL_PACK_01'}]).find(v=>v.productId==='SKILL_PACK_01');
 assert.equal(view.owned,true);assert.equal(view.available,false);assert.equal(view.purchaseBlockedLabel,'所持済み');
 const p=provider(m);assert.equal((await p.api.purchaseProduct('SKILL_PACK_01')).reason,'packOwned');assert.equal(p.calls(),0);
});
test('single purchase and restore still delegate unchanged',async()=>{
 const p=provider(manager(singles).value);
 for(const id of singles)assert.equal((await p.api.purchaseProduct(id)).purchased,true);
 assert.equal(p.calls(),3);assert.equal((await p.api.restorePurchases()).restored,true);
});
test('server restore sync and restart update the gate, without stale captured ownership',async()=>{
 const m=manager(),p=provider(m.value);assert.equal(Model.packPurchaseReason(m.value),null);
 m.value.syncServerPurchaseEntitlements({purchasedProductIds:[singles[0]]});
 assert.equal((await p.api.purchaseProduct('SKILL_PACK_01')).reason,'individualSkillOwned');
 assert.equal(Model.packPurchaseReason(m.restart()),'individualSkillOwned');
});
test('missing ownership data fails closed for pack only',async()=>{
 const p=provider(undefined);assert.equal((await p.api.purchaseProduct('SKILL_PACK_01')).reason,'ownershipUnavailable');assert.equal(p.calls(),0);
});
