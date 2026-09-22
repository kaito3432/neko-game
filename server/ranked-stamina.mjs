export const RANKED_STAMINA_CONFIG=Object.freeze({
  MAX_STAMINA:5,
  STAMINA_RECOVERY_MINUTES:60,
  STAMINA_COIN_COST:15,
  STAMINA_AD_DAILY_LIMIT:5,
  RANKED_MATCH_STAMINA_COST:1
});

export const STAMINA_REWARD_TYPE='RANKED_STAMINA_RECOVERY';
const recoveryMs=RANKED_STAMINA_CONFIG.STAMINA_RECOVERY_MINUTES*60*1000;
export const serverDateKey=now=>new Date(now).toISOString().slice(0,10);

export function normalizeRankedStamina(value,now=Date.now()){
  const source=value&&typeof value==='object'?value:{};
  const hasSaved=Number.isFinite(Number(source.lastRecoveryAt));
  let stamina=Number.isFinite(Number(source.stamina))?Math.max(0,Math.min(RANKED_STAMINA_CONFIG.MAX_STAMINA,Math.floor(Number(source.stamina)))):RANKED_STAMINA_CONFIG.MAX_STAMINA;
  let lastRecoveryAt=hasSaved?Number(source.lastRecoveryAt):now;
  if(lastRecoveryAt>now)lastRecoveryAt=now;
  if(stamina<RANKED_STAMINA_CONFIG.MAX_STAMINA){
    const recovered=Math.floor((now-lastRecoveryAt)/recoveryMs);
    if(recovered>0){
      stamina=Math.min(RANKED_STAMINA_CONFIG.MAX_STAMINA,stamina+recovered);
      lastRecoveryAt=stamina===RANKED_STAMINA_CONFIG.MAX_STAMINA?now:lastRecoveryAt+recovered*recoveryMs;
    }
  }
  const today=serverDateKey(now),savedDay=typeof source.adRecoveryDateKey==='string'?source.adRecoveryDateKey:today;
  return {stamina,lastRecoveryAt,
    adRecoveryCount:savedDay===today?Math.max(0,Math.min(RANKED_STAMINA_CONFIG.STAMINA_AD_DAILY_LIMIT,Math.floor(Number(source.adRecoveryCount)||0))):0,
    adRecoveryDateKey:today};
}

export function withRankedStamina(profile,now=Date.now()){
  return {...profile,rankedStamina:normalizeRankedStamina(profile?.rankedStamina,now)};
}

export function publicRankedStamina(profile,now=Date.now()){
  const value=normalizeRankedStamina(profile?.rankedStamina,now);
  return {...value,max:RANKED_STAMINA_CONFIG.MAX_STAMINA,recoveryMinutes:RANKED_STAMINA_CONFIG.STAMINA_RECOVERY_MINUTES,
    coinCost:RANKED_STAMINA_CONFIG.STAMINA_COIN_COST,adDailyLimit:RANKED_STAMINA_CONFIG.STAMINA_AD_DAILY_LIMIT,
    nextRecoveryAt:value.stamina<RANKED_STAMINA_CONFIG.MAX_STAMINA?value.lastRecoveryAt+recoveryMs:null};
}

export function consumeRankedStamina(profile,now=Date.now()){
  const current=withRankedStamina(profile,now),state=current.rankedStamina;
  if(state.stamina<RANKED_STAMINA_CONFIG.RANKED_MATCH_STAMINA_COST)throw new Error('STAMINA_EMPTY');
  const wasFull=state.stamina===RANKED_STAMINA_CONFIG.MAX_STAMINA;
  return {...current,rankedStamina:{...state,stamina:state.stamina-RANKED_STAMINA_CONFIG.RANKED_MATCH_STAMINA_COST,
    lastRecoveryAt:wasFull?now:state.lastRecoveryAt}};
}

export function canSpendCoins(profile,amount=RANKED_STAMINA_CONFIG.STAMINA_COIN_COST){
  return Number.isSafeInteger(amount)&&amount>0&&(Number(profile?.serverNyanCoins)||0)>=amount;
}
export function spendCoins(profile,{amount=RANKED_STAMINA_CONFIG.STAMINA_COIN_COST}={}){
  if(!canSpendCoins(profile,amount))throw new Error('insufficient_coins');
  return {...profile,serverNyanCoins:(Number(profile.serverNyanCoins)||0)-amount};
}
export function addCoins(profile,amount){
  if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('invalid_coin_amount');
  return {...profile,serverNyanCoins:(Number(profile?.serverNyanCoins)||0)+amount};
}

export function recoverStaminaWithCoins(profile,now=Date.now()){
  let current=withRankedStamina(profile,now);
  if(current.rankedStamina.stamina>=RANKED_STAMINA_CONFIG.MAX_STAMINA)throw new Error('STAMINA_FULL');
  current=spendCoins(current);
  const stamina=current.rankedStamina.stamina+1;
  return {...current,rankedStamina:{...current.rankedStamina,stamina,
    lastRecoveryAt:stamina===RANKED_STAMINA_CONFIG.MAX_STAMINA?now:current.rankedStamina.lastRecoveryAt}};
}

export async function applyVerifiedStaminaAd({storage,profileKey,profile,verificationId,verification,verify,now=Date.now()}={}){
  if(typeof verificationId!=='string'||!/^[A-Za-z0-9:_-]{8,200}$/.test(verificationId))throw new Error('invalid_verification_id');
  if(typeof verify!=='function')throw new Error('reward_verification_unavailable');
  if(await verify({playerId:profile.playerId,rewardType:STAMINA_REWARD_TYPE,verificationId,verification})!==true)throw new Error('reward_not_verified');
  const marker=`rewarded-ad:${profile.playerId}:${verificationId}`;
  const apply=async tx=>{
    const existing=await tx.get(marker),current=withRankedStamina(await tx.get(profileKey)||profile,now);
    if(existing)return {profile:current,applied:false,duplicate:true};
    if(current.rankedStamina.stamina>=RANKED_STAMINA_CONFIG.MAX_STAMINA)throw new Error('STAMINA_FULL');
    if(current.rankedStamina.adRecoveryCount>=RANKED_STAMINA_CONFIG.STAMINA_AD_DAILY_LIMIT)throw new Error('STAMINA_AD_DAILY_LIMIT');
    const stamina=current.rankedStamina.stamina+1,next={...current,rankedStamina:{...current.rankedStamina,stamina,
      lastRecoveryAt:stamina===RANKED_STAMINA_CONFIG.MAX_STAMINA?now:current.rankedStamina.lastRecoveryAt,
      adRecoveryCount:current.rankedStamina.adRecoveryCount+1}};
    await tx.put({[profileKey]:next,[marker]:{rewardType:STAMINA_REWARD_TYPE,processedAt:now}});
    return {profile:next,applied:true,duplicate:false};
  };
  return typeof storage.transaction==='function'?storage.transaction(apply):apply(storage);
}
