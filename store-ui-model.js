(function(root,factory){
  const products=typeof module==='object'&&module.exports?require('./monetization-products.js'):root.NyanMonetizationProducts;
  const skills=typeof module==='object'&&module.exports?require('./skill-catalog.js'):root.NyanSkillCatalog;
  const api=factory(products,skills);if(typeof module==='object'&&module.exports)module.exports=api;else root.NyanStoreUIModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,(Products,Skills)=>{
  'use strict';
  const IDS=Products.PRODUCT_IDS;
  const DEFINITIONS=Object.freeze([
    {productId:IDS.SKILL_CAT_FAKE_PAW,name:'フェイク肉球',description:'偽の足跡で警察を惑わせる',icon:'🐾',skillId:Skills.SKILL_IDS.CAT_FAKE_PAW},
    {productId:IDS.SKILL_POLICE_GROUP_SEARCH,name:'一斉捜索',description:'2箱を一度に探索する',icon:'🔎',skillId:Skills.SKILL_IDS.POLICE_GROUP_SEARCH},
    {productId:IDS.SKILL_POLICE_DASH,name:'ダッシュ',description:'一気に2マス先へ移動する',icon:'💨',skillId:Skills.SKILL_IDS.POLICE_DASH},
    {productId:IDS.SKILL_PACK_01,name:'スキル3点パック',description:'フェイク肉球・一斉捜索・ダッシュ',icon:'🎁',packId:Skills.SKILL_PACK_IDS.SKILL_PACK_01},
    {productId:IDS.REMOVE_ADS,name:'広告削除',description:'強制広告・インタースティシャル広告を削除',icon:'🚫',adsRemoved:true},
    {productId:IDS.REMOVE_ADS_PLUS_SKILL_PACK_01,name:'広告削除＋3点パック',description:'広告削除とスキル3点パックのセット',icon:'🌟',bundle:true}
  ]);
  function build(manager,storeProducts=[],activeProductId=null){
    const byId=new Map(storeProducts.map(product=>[product.productId,product]));
    return DEFINITIONS.map(def=>{
      const product=byId.get(def.productId),direct=manager.isProductPurchased(def.productId);
      const included=Boolean(def.skillId&&!direct&&manager.isSkillOwned(def.skillId));
      const packStatus=def.packId?manager.getSkillPackOwnershipStatus(def.packId):null;
      const owned=direct||included||Boolean(def.packId&&manager.isSkillPackOwned(def.packId))||Boolean(def.adsRemoved&&manager.hasRemovedAds());
      const purchasing=activeProductId===def.productId;
      const status=purchasing?'購入中':direct?'購入済み':included?'パックに含まれる':owned?'購入済み':product?'未購入':'利用不可';
      const ownership=packStatus&&!owned?`${packStatus.ownedCount}個購入済み・残り${packStatus.missingCount}個`:'';
      return {...def,displayName:product?.displayName||def.name,storeDescription:product?.description||def.description,
        displayPrice:product?.displayPrice||'',available:Boolean(product),owned,purchasing,status,ownership};
    });
  }
  return Object.freeze({DEFINITIONS,build});
});
