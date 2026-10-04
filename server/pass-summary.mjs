import {seasonId} from './ranked-progression.mjs';
import {normalizePassSubscription,isPassActive} from './pass-subscription.mjs';
import {passSkinPeriods,PASS_MONTHLY_SKINS} from './pass-monthly-skins.mjs';
import {normalizePassLoginProgress,passLoginGiftAmount,publicGiftBox,PASS_LOGIN_GIFT_SOURCE,PASS_LOGIN_GIFT_LIMIT} from './pass-gift-box.mjs';
import {SERVER_SKILLS} from './skill-entitlements.mjs';

// Read-only, authenticated presentation. It grants no entitlement and never
// accepts a client-supplied subscription or reward state.
export function passSummary(profile,{now=Date.now(),periods={},catalog=PASS_MONTHLY_SKINS,knownSkins={},passProductId=null,passGroupId=null}={}){
  const subscription=normalizePassSubscription(profile?.passSubscription),period=subscription.period;
  const active=isPassActive(subscription,now),monthKey=seasonId(now);
  const configured=passSkinPeriods(periods);
  const mappedId=configured[monthKey],item=catalog?.[mappedId];
  const ownedField=item?.category==='catSkin'?'ownedCatSkins':item?.category==='dogSkin'?'ownedDogSkins':null;
  const currentSkinId=ownedField&&item.passMonthlyReward===true&&knownSkins?.[ownedField]?.includes(mappedId)?mappedId:null;
  const progress=normalizePassLoginProgress(profile?.passLoginProgress);
  const loginRewardCount=period&&progress.periodId===period.id?progress.issuedCount:0;
  const giftBox=publicGiftBox(profile,now);
  return {active,expired:Boolean(period&&now>=period.expiresAt),expiresAt:period?.expiresAt??null,
    productId:typeof passProductId==='string'&&passProductId?passProductId:null,
    subscriptionGroupId:typeof passGroupId==='string'&&passGroupId?passGroupId:null,
    autoRenew:subscription.autoRenewing,periodId:period?.id??null,currentMonthKey:monthKey,
    currentSkinPreview:false,
    currentSkinAvailable:Boolean(currentSkinId),
    currentSkinId,currentSkinCategory:currentSkinId?item.category:null,
    currentSkinOwned:Boolean(currentSkinId&&profile?.[ownedField]?.includes(currentSkinId)),
    eligibleSkillCount:Object.values(SERVER_SKILLS).filter(skill=>skill.passEligible).length,
    loginRewardCount,maxLoginRewardCount:PASS_LOGIN_GIFT_LIMIT,
    nextLoginStaminaReward:active?passLoginGiftAmount(loginRewardCount+1):null,
    unclaimedPassGiftCount:giftBox.rewards.filter(reward=>reward.source===PASS_LOGIN_GIFT_SOURCE&&reward.status==='claimable').length,
    giftBadgeCount:giftBox.badgeCount};
}
