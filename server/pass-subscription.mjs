// Phase 1 domain model. Only a future store-verified server writer may set a
// subscription period; registration and appearance requests never import it.
const STORES=new Set(['app_store','google_play']);

export function normalizePassSubscription(value){
  const period=value?.period;
  const valid=STORES.has(value?.store)&&typeof period?.id==='string'&&
    /^[A-Za-z0-9:_-]{1,200}$/.test(period.id)&&
    Number.isSafeInteger(period.startsAt)&&Number.isSafeInteger(period.expiresAt)&&
    period.startsAt>=0&&period.expiresAt>period.startsAt&&
    Number.isSafeInteger(value.verifiedAt)&&value.verifiedAt>=0;
  if(!valid)return {version:1,store:null,period:null,verifiedAt:null,autoRenewing:false};
  return {version:1,store:value.store,
    period:{id:period.id,startsAt:period.startsAt,expiresAt:period.expiresAt},
    verifiedAt:value.verifiedAt,autoRenewing:value.autoRenewing===true};
}

export function isPassActive(value,now=Date.now()){
  const state=normalizePassSubscription(value),period=state.period;
  return Boolean(period&&Number.isSafeInteger(now)&&
    period.startsAt<=now&&now<period.expiresAt&&state.verifiedAt<=now);
}
