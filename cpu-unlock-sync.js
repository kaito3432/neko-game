/* TEMPORARY: these are client-claimed achievements, NOT server-verified CPU wins.
   DevTools can forge claims. Only these two fixed achievements are supported.
   Replace this boundary with verified match evidence when CPU validation moves server-side. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.NyanCpuUnlockSync=api;
})(globalThis,()=>{
  'use strict';
  const RULES=Object.freeze({
    cat_hard_10wins:Object.freeze({skin:'cat_kaitou',owned:'ownedCatSkins'}),
    police_hard_10wins:Object.freeze({skin:'dog_detective',owned:'ownedDogSkins'})
  });
  function normalize(data){
    const result={};
    for(const [achievement,rule] of Object.entries(RULES)){
      if(data?.skinUnlockProgress?.[rule.skin]>=10 && Array.isArray(data?.[rule.owned]) && data[rule.owned].includes(rule.skin)){
        result[achievement]=data.cpuUnlockSync?.[achievement]==='synced'?'synced':'pending';
      }
    }
    return result;
  }
  function confirms(achievement,response){
    const rule=RULES[achievement];
    return !!rule && response?.achievement===achievement &&
      Array.isArray(response?.profile?.[rule.owned]) && response.profile[rule.owned].includes(rule.skin);
  }
  async function flush(playerData,post){
    const pending=Object.entries(normalize(playerData.getSnapshot())).filter(([,status])=>status==='pending');
    const acknowledgements=[];
    const failed=[];
    for(const [achievement] of pending){
      try{
        // Never send a skinId, owned array, counter, or arbitrary grant payload.
        const response=await post({achievement});
        if(!confirms(achievement,response)) throw new Error('unlock_not_acknowledged');
        acknowledgements.push(playerData.acknowledgeCpuUnlock(achievement,response).catch(()=>{failed.push(achievement);}));
      }catch(_){failed.push(achievement);}
    }
    // Do not await the player-data queue here: identity preparation can itself
    // be called by result verification from inside that queue. Acks run after it.
    return {acknowledgements:Promise.all(acknowledgements),failed};
  }
  return Object.freeze({RULES,normalize,confirms,flush});
});
