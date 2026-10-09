export const DAILY_REWARD_TYPE='DAILY_COIN_REWARD';
export const dailyDateKey=now=>new Date(now+9*60*60*1000).toISOString().slice(0,10);

export async function applyVerifiedDailyAd({storage,profileKey,profile,verificationId,verification,verify,now=Date.now()}={}){
  if(typeof verificationId!=='string'||!/^[A-Za-z0-9:_-]{8,200}$/.test(verificationId))throw new Error('invalid_verification_id');
  if(typeof verify!=='function')throw new Error('reward_verification_unavailable');
  if(await verify({playerId:profile.playerId,rewardType:DAILY_REWARD_TYPE,verificationId,verification})!==true)throw new Error('reward_not_verified');
  const marker=`rewarded-ad:${profile.playerId}:${verificationId}`,date=dailyDateKey(now);
  const apply=async tx=>{
    const current=await tx.get(profileKey)||profile;
    if(await tx.get(marker))return {profile:current,applied:false,duplicate:true};
    if(current.dailyAdRewardDate===date)throw new Error('daily_ad_already_claimed');
    const coins=Number(current.serverNyanCoins)||0;
    if(!Number.isSafeInteger(coins+50))throw new Error('coin_overflow');
    const next={...current,serverNyanCoins:coins+50,dailyAdRewardDate:date};
    await tx.put({[profileKey]:next,[marker]:{rewardType:DAILY_REWARD_TYPE,processedAt:now}});
    return {profile:next,applied:true,duplicate:false};
  };
  return typeof storage.transaction==='function'?storage.transaction(apply):apply(storage);
}
