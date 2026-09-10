export const RANKS=Object.freeze([
  {id:'bronze',name:'ブロンズ',min:0,frameId:'rank_bronze',frameName:'肉球ブロンズフレーム'},
  {id:'silver',name:'シルバー',min:100,frameId:'rank_silver',frameName:'足あとシルバーフレーム'},
  {id:'gold',name:'ゴールド',min:250,frameId:'rank_gold',frameName:'きらめきゴールドフレーム'},
  {id:'platinum',name:'プラチナ',min:450,frameId:'rank_platinum',frameName:'月夜のプラチナフレーム'},
  {id:'diamond',name:'ダイヤ',min:700,frameId:'rank_diamond',frameName:'宝石肉球ダイヤフレーム'},
  {id:'master',name:'マスター',min:1000,frameId:'rank_master',frameName:'にゃんチェイス・マスターフレーム'}
]);
const SEASON_COINS={silver:200,gold:400,platinum:800,diamond:1200};
const RESET_RP={bronze:0,silver:50,gold:150,platinum:300,diamond:500,master:750};
export const seasonId=now=>new Date(now+9*60*60*1000).toISOString().slice(0,7);
export const rankForRp=rp=>[...RANKS].reverse().find(r=>rp>=r.min)||RANKS[0];
export const periodId=id=>`${id.slice(0,4)}-Q${Math.floor((Number(id.slice(5,7))-1)/3)+1}`;
export function masterPeriods(value){try{return typeof value==='string'?(JSON.parse(value)||{}):(value||{});}catch(_){return {};}}
export function eligibleRankedResult(match,input){
  return match?.matchType==='randomMatch'&&input?.status==='finished'&&input?.hasStarted===true&&
    ['cat','police'].includes(input.result?.winner)&&
    [undefined,'disconnectForfeit','turnTimeout'].includes(input.result?.finishReason);
}
function configuredMaster(id,periods,knownSkins){
  const skinId=masterPeriods(periods)[periodId(id)];
  if(typeof skinId!=='string'||!knownSkins?.[skinId])return null;
  return {skinId,category:knownSkins[skinId]};
}
function rewardFor(profile,id,rank,periods,knownSkins){
  if(rank!=='master'){
    const amount=SEASON_COINS[rank]||0;
    return amount?{rewardType:'coins',rewardAmount:amount,rewardStatus:'claimable'}:
      {rewardType:'none',rewardAmount:0,rewardStatus:'none'};
  }
  const configured=configuredMaster(id,periods,knownSkins);
  if(!configured)return {rewardType:'masterSkin',rewardSkinId:null,rewardStatus:'pendingConfiguration',rewardPeriodId:periodId(id)};
  const ownedField=configured.category==='catSkin'?'ownedCatSkins':'ownedDogSkins';
  return profile[ownedField]?.includes(configured.skinId)
    ?{rewardType:'coins',rewardAmount:1500,rewardSkinId:configured.skinId,rewardStatus:'claimable',rewardPeriodId:periodId(id)}
    :{rewardType:'skin',rewardSkinId:configured.skinId,rewardSkinCategory:configured.category,rewardStatus:'claimable',rewardPeriodId:periodId(id)};
}
export function normalizeRanked(profile,now=Date.now(),periods={},knownSkins={}){
  const p=structuredClone(profile);p.version=Math.max(2,Number(p.version)||1);
  p.serverNyanCoins=Math.max(0,Number(p.serverNyanCoins)||0);
  p.ownedProfileFrames=[...new Set(['rank_bronze',...(Array.isArray(p.ownedProfileFrames)?p.ownedProfileFrames:[])])];
  if(!p.ownedProfileFrames.includes(p.equippedProfileFrameId))p.equippedProfileFrameId='default';
  p.seasonHistory=Array.isArray(p.seasonHistory)?p.seasonHistory:[];
  p.seasonRewardsClaimed=[...new Set(Array.isArray(p.seasonRewardsClaimed)?p.seasonRewardsClaimed:[])];
  const current=seasonId(now),old=p.ranked||{};
  p.ranked={rp:Math.max(0,Number(old.rp)||0),seasonId:typeof old.seasonId==='string'?old.seasonId:current,
    seasonWins:Math.max(0,Number(old.seasonWins)||0),seasonLosses:Math.max(0,Number(old.seasonLosses)||0),
    lifetimeWins:Math.max(0,Number(old.lifetimeWins)||0),lifetimeLosses:Math.max(0,Number(old.lifetimeLosses)||0)};
  if(p.ranked.seasonId!==current){
    const final=rankForRp(p.ranked.rp);
    if(!p.seasonHistory.some(h=>h.seasonId===p.ranked.seasonId))p.seasonHistory.push({seasonId:p.ranked.seasonId,finalRP:p.ranked.rp,finalRank:final.id,
      seasonWins:p.ranked.seasonWins,seasonLosses:p.ranked.seasonLosses,...rewardFor(p,p.ranked.seasonId,final.id,periods,knownSkins)});
    p.ranked={...p.ranked,rp:RESET_RP[final.id],seasonId:current,seasonWins:0,seasonLosses:0};
  }
  for(const h of p.seasonHistory)if(h.finalRank==='master'&&h.rewardStatus==='pendingConfiguration')Object.assign(h,rewardFor(p,h.seasonId,'master',periods,knownSkins));
  const rank=rankForRp(p.ranked.rp);p.ranked.rank=rank.id;
  p.seasonHistory=p.seasonHistory.slice(-36);
  return p;
}
export function applyRankedResult(profile,{matchId,won,completedAt},periods={},knownSkins={}){
  const p=normalizeRanked(profile,completedAt,periods,knownSkins),beforeRP=p.ranked.rp,beforeRank=rankForRp(beforeRP);
  p.ranked.rp=Math.max(0,beforeRP+(won?10:-6));p.ranked[won?'seasonWins':'seasonLosses']++;p.ranked[won?'lifetimeWins':'lifetimeLosses']++;
  if(won)p.serverNyanCoins+=5;
  const afterRank=rankForRp(p.ranked.rp),unlocked=[];
  for(const rank of RANKS)if(rank.min<=afterRank.min&&!p.ownedProfileFrames.includes(rank.frameId)){p.ownedProfileFrames.push(rank.frameId);unlocked.push(rank.frameId);}
  p.ranked.rank=afterRank.id;
  return {profile:p,receipt:{battleId:matchId,seasonId:p.ranked.seasonId,won,beforeRP,afterRP:p.ranked.rp,rpDelta:p.ranked.rp-beforeRP,
    beforeRank:beforeRank.id,afterRank:afterRank.id,coinDelta:won?5:0,unlockedProfileFrames:unlocked}};
}
export function claimSeasonReward(profile,id,now=Date.now(),periods={},knownSkins={}){
  const p=normalizeRanked(profile,now,periods,knownSkins),reward=p.seasonHistory.find(h=>h.seasonId===id);
  if(!reward)return {profile:p,error:'reward_not_found'};
  if(p.seasonRewardsClaimed.includes(id)||reward.rewardStatus==='claimed')return {profile:p,reward,error:'already_claimed'};
  if(reward.rewardStatus==='pendingConfiguration')return {profile:p,reward,error:'pending_configuration'};
  if(reward.rewardStatus!=='claimable')return {profile:p,reward,error:'not_claimable'};
  if(reward.rewardType==='coins')p.serverNyanCoins+=reward.rewardAmount;
  if(reward.rewardType==='skin'){
    const field=reward.rewardSkinCategory==='catSkin'?'ownedCatSkins':'ownedDogSkins';p[field]=[...new Set([...p[field],reward.rewardSkinId])];
  }
  reward.rewardStatus='claimed';reward.claimedAt=now;p.seasonRewardsClaimed.push(id);
  return {profile:p,reward};
}
export const publicRankedProfile=p=>({ranked:p.ranked,serverNyanCoins:p.serverNyanCoins,ownedProfileFrames:p.ownedProfileFrames,
  equippedProfileFrameId:p.equippedProfileFrameId,seasonHistory:p.seasonHistory,seasonRewardsClaimed:p.seasonRewardsClaimed});
