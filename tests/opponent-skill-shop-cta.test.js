const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Catalog=require('../skill-catalog.js');
const Store=require('../store-ui-model.js');
const SkillInfo=require('../match-skill-info.js');
const Products=require('../monetization-products.js');

const pick=({playMode='onlineCat',cat='sneak',police='dash',owned=false,definitions=Store.DEFINITIONS,enabled=true,
  matchType='roomMatch',effectiveShared=false,personalSkillIds=[],personalKnown=true}={})=>
  SkillInfo.opponentShopSkill({playMode,game:{abilitiesEnabled:enabled,selectedAbilities:{cat,police}},
    catalog:Catalog,shopDefinitions:definitions,matchType,effectiveSkillEntitlements:
      {skillModeUnlocked:effectiveShared,availableSkillIds:effectiveShared?['POLICE_DASH']:[]},
    permanentSkillEntitlements:{ownedSkillIds:owned?['POLICE_DASH','CAT_FAKE_PAW','POLICE_GROUP_SEARCH']:[],
      ownedSkillPackIds:[],purchasedProductIds:[]},
    personalSkillEntitlements:personalKnown?{skillModeUnlocked:true,availableSkillIds:personalSkillIds}:null,
    products:Products});

test('Room/Random共通で永久所有ならCTAなし、未所有ならRoom共有の有無によらずCTAあり',()=>{
  assert.equal(pick()?.id,'POLICE_DASH');
  assert.equal(pick({playMode:'onlinePolice',cat:'fakePaw'})?.id,'CAT_FAKE_PAW');
  assert.equal(pick({police:'doubleSearch'})?.id,'POLICE_GROUP_SEARCH');
  assert.equal(pick({matchType:'roomMatch',owned:true,effectiveShared:true}),null);
  assert.equal(pick({matchType:'roomMatch',owned:false,effectiveShared:true})?.id,'POLICE_DASH');
  assert.equal(pick({matchType:'roomMatch',owned:false,effectiveShared:false})?.id,'POLICE_DASH');
  assert.equal(pick({matchType:'randomMatch',owned:true}),null);
  assert.equal(pick({matchType:'randomMatch',owned:false})?.id,'POLICE_DASH');
});

test('QA本人権利と将来Pass由来の本人権利はCTAなし、Room共有のみはCTAあり',()=>{
  assert.equal(pick({personalSkillIds:['POLICE_DASH'],effectiveShared:true}),null);
  assert.equal(pick({personalSkillIds:['POLICE_DASH'],matchType:'randomMatch'}),null);
  assert.equal(pick({personalSkillIds:[],effectiveShared:true})?.id,'POLICE_DASH');
  const passPersonalView={skillModeUnlocked:true,availableSkillIds:['POLICE_DASH']};
  assert.equal(SkillInfo.canPersonallyUseSkill('POLICE_DASH',{
    permanentSkillEntitlements:{ownedSkillIds:[]},personalSkillEntitlements:passPersonalView,
    catalog:Catalog,products:Products}),true);
});

test('server verified直接所有・単品購入・pack購入を永久所有として解決し、未取得はCTAを出さない',()=>{
  const owned=entitlements=>SkillInfo.permanentlyOwnsSkill('POLICE_DASH',entitlements,Catalog,Products);
  assert.equal(owned({ownedSkillIds:['POLICE_DASH']}),true);
  assert.equal(owned({ownedSkillPackIds:['SKILL_PACK_01']}),true);
  assert.equal(owned({purchasedProductIds:['SKILL_POLICE_DASH']}),true);
  assert.equal(owned({purchasedProductIds:['SKILL_PACK_01']}),true);
  assert.equal(owned({purchasedProductIds:['REMOVE_ADS_PLUS_SKILL_PACK_01']}),true);
  assert.equal(owned({ownedSkillIds:[],purchasedProductIds:[]}),false);
  assert.equal(owned(null),null);
  assert.equal(pick({personalKnown:false}),null);
  assert.equal(SkillInfo.opponentShopSkill({playMode:'onlineCat',game:{abilitiesEnabled:true,selectedAbilities:{police:'dash'}},
    catalog:Catalog,shopDefinitions:Store.DEFINITIONS,products:Products}),null);
});

test('無料・Skillなし・非online・invalid・非公開・通常戦は表示しない',()=>{
  assert.equal(pick({police:'howl'}),null);
  assert.equal(pick({police:null}),null);
  assert.equal(pick({playMode:'cpuCat'}),null);
  assert.equal(pick({playMode:'local'}),null);
  assert.equal(pick({police:'not-a-skill'}),null);
  assert.equal(pick({definitions:[]}),null);
  assert.equal(pick({definitions:[{skillId:'POLICE_DASH',productId:'SKILL_POLICE_DASH',purchasable:false}]}),null);
  assert.equal(pick({enabled:false}),null);
});

test('reconnect snapshotの確定runtime IDから同じ相手Skillを復元',()=>{
  const restored={abilitiesEnabled:true,selectedAbilities:{cat:'fakePaw',police:'dash'}};
  const candidate=SkillInfo.opponentShopSkill({playMode:'onlineCat',game:restored,
    catalog:Catalog,shopDefinitions:Store.DEFINITIONS,
    permanentSkillEntitlements:{ownedSkillIds:[]},
    personalSkillEntitlements:{skillModeUnlocked:true,availableSkillIds:[]},products:Products});
  assert.equal(candidate.id,'POLICE_DASH');
  assert.deepEqual(restored.selectedAbilities,{cat:'fakePaw',police:'dash'});
});

test('結果CTAは既存Shopへ入り同じSkill詳細を開き、試合中UIを変更しない',()=>{
  const root=path.resolve(__dirname,'..');
  const read=file=>fs.readFileSync(path.join(root,file),'utf8');
  const game=read('game.js'),shop=read('storekit-ui.js'),html=read('index.html');
  assert.match(game,/selectedAbilities:d\.abilities/);
  assert.match(game,/opponentShopSkill\(\{/);
  assert.match(game,/permanentSkillEntitlements:window\.NyanOnline\?\.getPermanentSkillEntitlements\?\.\(\)/);
  assert.match(game,/personalSkillEntitlements:window\.NyanOnline\?\.getPersonalSkillEntitlements\?\.\(\)/);
  assert.match(read('online.js'),/getPermanentSkillEntitlements:\(\)=>sessionProfile\?\.skillEntitlements\|\|null/);
  assert.match(read('online.js'),/getPersonalSkillEntitlements:personalSkillView/);
  assert.match(game,/resultHomeBtn\.click\(\);\s*shopOpenBtn\.click\(\);\s*if\(!window\.NyanShopOpenSkillDetail\(skillId\)\)/);
  assert.match(game,/if\(resultOpponentShopOpening\|\|!resultOpponentSkillId/);
  assert.match(shop,/root\.NyanShopOpenSkillDetail=skillId=>\{/);
  assert.match(shop,/category='skills';role=skill\.role;render\(\);showPreview\(skillId\)/);
  assert.match(html,/id="resultOpponentSkill" hidden/);
  assert.doesNotMatch(read('match-skill-info.js'),/ショップで見る/);
});

test('既存Shop詳細APIは対象Skillの役割と詳細だけを開き、購入状態を維持',()=>{
  const nodes=new Map();
  function node(id){
    if(!nodes.has(id))nodes.set(id,{id,hidden:false,children:[],attributes:{},classList:{add(){},remove(){},toggle(){}},
      append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},
      setAttribute(name,value){this.attributes[name]=value;},addEventListener(){},querySelector(){return {scrollTop:0};}});
    return nodes.get(id);
  }
  const document={getElementById:node,querySelectorAll:()=>[],createElement:()=>node(Symbol())};
  const root={document,NyanPurchases:{nativePlugin:()=>null},
    NyanMonetization:{isSkillOwned:()=>false},NyanStoreUIModel:{DEFINITIONS:Store.DEFINITIONS,build:()=>[]},
    NyanSkillCatalog:Catalog,NyanHowToSkillDescriptions:{dash:{image:'dash.png',desc:'ダッシュ',visual:'<b>図</b>',detail:'詳細'}},
    addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../storekit-ui.js'),'utf8'),
    {globalThis:root,document});
  assert.equal(root.NyanShopOpenSkillDetail('INVALID'),false);
  assert.equal(root.NyanShopOpenSkillDetail('POLICE_DASH'),true);
  assert.equal(node('shopPreviewName').textContent,'ダッシュ');
  assert.equal(node('shopPreviewImage').src,'dash.png');
  assert.equal(node('shopPreviewPurchase').textContent,'現在購入できません');
  assert.equal(node('shopSkillList').children.length,3);
  assert.equal(node('shopSkillPreview').attributes['aria-hidden'],'false');
});
