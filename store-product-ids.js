/* Internal entitlement keys stay stable; Store identifiers are platform-specific. */
(function(root){
  'use strict';
  const initial=Object.freeze(['SKILL_CAT_FAKE_PAW','SKILL_POLICE_GROUP_SEARCH','SKILL_POLICE_DASH','SKILL_PACK_01']);
  const restorable=Object.freeze([...initial,'REMOVE_ADS','REMOVE_ADS_PLUS_SKILL_PACK_01']);
  const toStore=(platform,key)=>restorable.includes(key)?platform==='android'?key.toLowerCase():key:null;
  const toInternal=(platform,id)=>restorable.find(key=>toStore(platform,key)===id)||null;
  const api=Object.freeze({initial,restorable,toStore,toInternal});
  root.NyanStoreProductIds=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
