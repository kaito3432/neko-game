(function(root,factory){
  const api=factory();
  if(typeof module==="object" && module.exports) module.exports=api;
  if(root) root.NyanSkillCatalog=api;
})(typeof globalThis!=="undefined" ? globalThis : this,()=>{
  "use strict";

  const SKILL_IDS=Object.freeze({
    CAT_STEALTH:"CAT_STEALTH",
    CAT_FAKE_PAW:"CAT_FAKE_PAW",
    POLICE_HOWL:"POLICE_HOWL",
    POLICE_DASH:"POLICE_DASH",
    POLICE_GROUP_SEARCH:"POLICE_GROUP_SEARCH"
  });
  const SKILL_PACK_IDS=Object.freeze({SKILL_PACK_01:"SKILL_PACK_01"});

  const SKILLS=Object.freeze({
    [SKILL_IDS.CAT_STEALTH]:Object.freeze({id:SKILL_IDS.CAT_STEALTH,role:"cat",runtimeId:"sneak",name:"忍び足",free:true}),
    [SKILL_IDS.CAT_FAKE_PAW]:Object.freeze({id:SKILL_IDS.CAT_FAKE_PAW,role:"cat",runtimeId:"fakePaw",name:"フェイク肉球",free:false,purchaseProductId:"SKILL_CAT_FAKE_PAW"}),
    [SKILL_IDS.POLICE_HOWL]:Object.freeze({id:SKILL_IDS.POLICE_HOWL,role:"police",runtimeId:"howl",name:"遠吠え",free:true}),
    [SKILL_IDS.POLICE_DASH]:Object.freeze({id:SKILL_IDS.POLICE_DASH,role:"police",runtimeId:"dash",name:"ダッシュ",free:false,purchaseProductId:"SKILL_POLICE_DASH"}),
    [SKILL_IDS.POLICE_GROUP_SEARCH]:Object.freeze({id:SKILL_IDS.POLICE_GROUP_SEARCH,role:"police",runtimeId:"doubleSearch",name:"一斉捜索",free:false,purchaseProductId:"SKILL_POLICE_GROUP_SEARCH"})
  });

  const SKILL_PACKS=Object.freeze({
    [SKILL_PACK_IDS.SKILL_PACK_01]:Object.freeze({
      id:SKILL_PACK_IDS.SKILL_PACK_01,
      purchaseProductId:"SKILL_PACK_01",
      skillIds:Object.freeze([
        SKILL_IDS.CAT_FAKE_PAW,
        SKILL_IDS.POLICE_GROUP_SEARCH,
        SKILL_IDS.POLICE_DASH
      ])
    })
  });

  const FREE_SKILL_IDS=Object.freeze(Object.values(SKILLS).filter(skill=>skill.free).map(skill=>skill.id));
  function isKnownSkillId(skillId){return Object.prototype.hasOwnProperty.call(SKILLS,skillId);}
  function isKnownSkillPackId(packId){return Object.prototype.hasOwnProperty.call(SKILL_PACKS,packId);}
  function fromRuntimeId(role,runtimeId){
    return Object.values(SKILLS).find(skill=>skill.role===role && skill.runtimeId===runtimeId)?.id||null;
  }
  function toRuntimeId(skillId){return SKILLS[skillId]?.runtimeId||null;}

  return Object.freeze({SKILL_IDS,SKILL_PACK_IDS,SKILLS,SKILL_PACKS,FREE_SKILL_IDS,isKnownSkillId,isKnownSkillPackId,fromRuntimeId,toRuntimeId});
});
