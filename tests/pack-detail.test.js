const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Model=require('../store-ui-model.js');
const ids=['SKILL_CAT_FAKE_PAW','SKILL_POLICE_GROUP_SEARCH','SKILL_POLICE_DASH','SKILL_PACK_01'];
const products=(prices=[160,160,160,380])=>ids.map((productId,i)=>({productId,priceNumber:prices[i],currencyCode:'JPY'}));
test('pack savings uses only complete same-currency store prices',()=>{
  const actual=Model.packSavings(products());
  assert.match(actual.total,/480/);assert.match(actual.saving,/100/);
  assert.equal(Model.packSavings(products().slice(0,3)),null);
  assert.equal(Model.packSavings(products([160,160,160,480])),null);
  assert.equal(Model.packSavings(products([160,160,160,580])),null);
  assert.equal(Model.packSavings(products().map(p=>({...p,priceNumber:undefined}))),null);
  assert.equal(Model.packSavings(products().map((p,i)=>({...p,currencyCode:i===0?'USD':'JPY'}))),null);
  assert.equal(Model.packSavings(products().map(p=>({...p,priceNumber:NaN}))),null);
});
test('pack details lists the three skills and capture blocks purchases, not detail navigation',()=>{
  const ui=fs.readFileSync(require.resolve('../storekit-ui.js'),'utf8');
  assert.match(ui,/detail.addEventListener\('click',showPackPreview\)/);
  assert.match(ui,/\['CAT_FAKE_PAW','POLICE_DASH','POLICE_GROUP_SEARCH'\]/);
  assert.match(ui,/スキルモードの解放が別途必要/);
  assert.match(ui,/shopPreviewPackLink'\)\?\.addEventListener\('click',showPackPreview\)/);
  assert.match(ui,/if\(selectedPack\)buy\('SKILL_PACK_01'\)/);
  const qa=fs.readFileSync(require.resolve('../debug/screenshot-qa.js'),'utf8');
  assert.match(qa,/#shopPackProducts \[data-purchase-product\]/);
  assert.doesNotMatch(qa,/const blocked=.*#shopPackProducts button/);
});
