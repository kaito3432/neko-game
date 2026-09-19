(function(root,factory){
  const skills=typeof module==="object" && module.exports ? require("./skill-catalog.js") : root.NyanSkillCatalog;
  const api=factory(skills);
  if(typeof module==="object" && module.exports) module.exports=api;
  if(root) root.NyanMonetizationProducts=api;
})(typeof globalThis!=="undefined" ? globalThis : this,(Skills)=>{
  "use strict";

  const PRODUCT_IDS=Object.freeze({
    REMOVE_ADS:"REMOVE_ADS",
    SKIN_PACK_01:"SKIN_PACK_01",
    SKIN_PACK_02:"SKIN_PACK_02",
    SKILL_CAT_FAKE_PAW:"SKILL_CAT_FAKE_PAW",
    SKILL_POLICE_DASH:"SKILL_POLICE_DASH",
    SKILL_POLICE_GROUP_SEARCH:"SKILL_POLICE_GROUP_SEARCH",
    SKILL_PACK_01:"SKILL_PACK_01",
    REMOVE_ADS_PLUS_SKILL_PACK_01:"REMOVE_ADS_PLUS_SKILL_PACK_01"
  });

  const PRODUCTS=Object.freeze({
    [PRODUCT_IDS.REMOVE_ADS]:Object.freeze({id:PRODUCT_IDS.REMOVE_ADS,type:"nonConsumable",grants:Object.freeze({adsRemoved:true})}),
    [PRODUCT_IDS.SKIN_PACK_01]:Object.freeze({id:PRODUCT_IDS.SKIN_PACK_01,type:"nonConsumable",grants:Object.freeze({catalogGroup:"skin_pack_01"})}),
    [PRODUCT_IDS.SKIN_PACK_02]:Object.freeze({id:PRODUCT_IDS.SKIN_PACK_02,type:"nonConsumable",grants:Object.freeze({catalogGroup:"skin_pack_02"})}),
    [PRODUCT_IDS.SKILL_CAT_FAKE_PAW]:Object.freeze({id:PRODUCT_IDS.SKILL_CAT_FAKE_PAW,type:"nonConsumable",grants:Object.freeze({skillId:Skills.SKILL_IDS.CAT_FAKE_PAW})}),
    [PRODUCT_IDS.SKILL_POLICE_DASH]:Object.freeze({id:PRODUCT_IDS.SKILL_POLICE_DASH,type:"nonConsumable",grants:Object.freeze({skillId:Skills.SKILL_IDS.POLICE_DASH})}),
    [PRODUCT_IDS.SKILL_POLICE_GROUP_SEARCH]:Object.freeze({id:PRODUCT_IDS.SKILL_POLICE_GROUP_SEARCH,type:"nonConsumable",grants:Object.freeze({skillId:Skills.SKILL_IDS.POLICE_GROUP_SEARCH})}),
    [PRODUCT_IDS.SKILL_PACK_01]:Object.freeze({id:PRODUCT_IDS.SKILL_PACK_01,type:"nonConsumable",grants:Object.freeze({skillPackId:Skills.SKILL_PACK_IDS.SKILL_PACK_01})}),
    [PRODUCT_IDS.REMOVE_ADS_PLUS_SKILL_PACK_01]:Object.freeze({id:PRODUCT_IDS.REMOVE_ADS_PLUS_SKILL_PACK_01,type:"nonConsumable",grants:Object.freeze({adsRemoved:true,skillPackId:Skills.SKILL_PACK_IDS.SKILL_PACK_01})})
  });

  function isKnownProductId(productId){
    return typeof productId==="string" && Object.prototype.hasOwnProperty.call(PRODUCTS,productId);
  }

  return Object.freeze({PRODUCT_IDS,PRODUCTS,isKnownProductId});
});
