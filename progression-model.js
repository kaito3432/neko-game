/* Daily rules are pure functions; storage/provider authority lives in player-data.js. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object" && module.exports) module.exports=api;
  if(root) root.NyanProgressionModel=api;
})(typeof globalThis!=="undefined" ? globalThis : this,()=>{
  "use strict";
  const MISSIONS=Object.freeze([
    Object.freeze({id:"playOneBattle",title:"1回対戦する",target:1,reward:10}),
    Object.freeze({id:"winAsCat",title:"ネコ側で3勝する",target:3,reward:20}),
    Object.freeze({id:"winAsPolice",title:"警察側で3勝する",target:3,reward:20})
  ]);
  const UNLOCKS=Object.freeze({
    cat_kaitou:Object.freeze({side:"cat",target:10,ownedField:"ownedCatSkins",text:"ネコでCPU（つよい）から10回逃げ切る"}),
    dog_detective:Object.freeze({side:"police",target:10,ownedField:"ownedDogSkins",text:"しば犬でCPU（つよい）を10回確保"})
  });
  const integer=value=>Number.isSafeInteger(value) && value>=0 ? value : 0;
  const jstDate=(now=Date.now())=>new Date(now+9*60*60*1000).toISOString().slice(0,10);
  function normalizeDaily(value){
    const source=value && typeof value==="object" ? value : {};
    const list=Array.isArray(source.missions) ? source.missions : [];
    return {
      date:typeof source.date==="string" && /^\d{4}-\d{2}-\d{2}$/.test(source.date) ? source.date : null,
      updatedAt:integer(source.updatedAt),
      missions:MISSIONS.map(rule=>{
        const old=list.find(m=>m?.id===rule.id) || source[rule.id] || {};
        const progress=Math.min(rule.target,integer(old.progress));
        return {id:rule.id,progress,target:rule.target,completed:progress===rule.target,claimed:progress===rule.target && old.claimed===true};
      }),
      allClearRewardClaimed:source.allClearRewardClaimed===true
    };
  }
  function normalizeUnlocks(value){
    return Object.fromEntries(Object.entries(UNLOCKS).map(([id,rule])=>[id,Math.min(rule.target,integer(value?.[id]))]));
  }
  function rollover(data,now=Date.now()){
    const today=jstDate(now);
    const daily=normalizeDaily(data.dailyMissionProgress);
    // Never reopen an already rewarded day when the device clock moves backwards.
    if(daily.date && daily.date>=today) return {...data,dailyMissionProgress:daily};
    return {...data,dailyMissionProgress:{...normalizeDaily(null),date:today,updatedAt:now}};
  }
  function validateBattle(event){
    if(!event || typeof event.battleId!=="string" || !/^[a-zA-Z0-9_-]{8,160}$/.test(event.battleId)) throw new Error("invalid_battle_id");
    if(!["cpu","randomMatch","roomMatch","local"].includes(event.source)) throw new Error("invalid_battle_source");
    if(!["cat","police"].includes(event.side) || typeof event.won!=="boolean" || event.completed!==true) throw new Error("battle_not_completed");
    if(!Number.isSafeInteger(event.completedAt) || event.completedAt<=0) throw new Error("invalid_battle_date");
    if(event.source==="cpu" && !["easy","normal","hard"].includes(event.difficulty)) throw new Error("invalid_battle_difficulty");
    return {battleId:event.battleId,source:event.source,side:event.side,won:event.won,completed:true,completedAt:event.completedAt,difficulty:event.difficulty};
  }
  function recordBattle(data,event,now=Date.now()){
    event=validateBattle(event);
    // randomMatch receipts are authenticated by the persistence boundary.
    if(!["cpu","randomMatch"].includes(event.source) || data.battleReceipts.includes(event.battleId)) return data;
    if(event.completedAt>now+60000) throw new Error("future_battle_date");
    const next=rollover(data,now);
    next.battleReceipts=[...data.battleReceipts,event.battleId];
    if(next.dailyMissionProgress.date===jstDate(event.completedAt)){
      next.dailyMissionProgress={...next.dailyMissionProgress,updatedAt:now,missions:next.dailyMissionProgress.missions.map(m=>{
        const adds=m.id==="playOneBattle" || (event.won && m.id===(event.side==="cat" ? "winAsCat" : "winAsPolice"));
        const progress=Math.min(m.target,m.progress+(adds ? 1 : 0));
        return {...m,progress,completed:progress===m.target};
      })};
    }
    next.skinUnlockProgress={...data.skinUnlockProgress};
    if(event.source==="cpu" && event.won && event.difficulty==="hard"){
      for(const [id,rule] of Object.entries(UNLOCKS)){
        if(rule.side!==event.side) continue;
        next.skinUnlockProgress[id]=Math.min(rule.target,(data.skinUnlockProgress[id] || 0)+1);
        if(next.skinUnlockProgress[id]===rule.target) next[rule.ownedField]=[...new Set([...data[rule.ownedField],id])];
      }
    }
    return next;
  }
  function claim(data,{date,missionId},now=Date.now()){
    const next=rollover(data,now);
    if(date!==jstDate(now) || next.dailyMissionProgress.date!==date) throw new Error("daily_date_changed");
    const rule=MISSIONS.find(m=>m.id===missionId);
    const mission=next.dailyMissionProgress.missions.find(m=>m.id===missionId);
    if(!rule || !mission?.completed) throw new Error("mission_not_completed");
    if(mission.claimed) return next;
    if(!Number.isSafeInteger(next.nyanCoins+rule.reward)) throw new Error("coin_overflow");
    next.nyanCoins+=rule.reward;
    next.dailyMissionProgress={...next.dailyMissionProgress,updatedAt:now,missions:next.dailyMissionProgress.missions.map(m=>m.id===missionId ? {...m,claimed:true} : m)};
    return next;
  }
  return Object.freeze({MISSIONS,UNLOCKS,jstDate,normalizeDaily,normalizeUnlocks,rollover,validateBattle,recordBattle,claim});
});
