// TEMPORARY client-claim trust: a caller can forge these achievements via DevTools.
// Authentication proves the profile, not CPU wins. Do not call applyVerifiedUnlock
// with a fake verifier or label this as verified evidence. Replace this adapter later.
const ACHIEVEMENTS=Object.freeze({
  cat_hard_10wins:{field:'ownedCatSkins',skin:'cat_kaitou'},
  police_hard_10wins:{field:'ownedDogSkins',skin:'dog_detective'}
});
export function applyCpuUnlockClaim(profile,input){
  if(!input || typeof input!=='object' || Array.isArray(input) ||
      Object.keys(input).length!==1 || typeof input.achievement!=='string' ||
      !Object.hasOwn(ACHIEVEMENTS,input.achievement))throw new Error('invalid_achievement');
  const rule=ACHIEVEMENTS[input.achievement];
  if(profile[rule.field].includes(rule.skin))return profile;
  return {...profile,[rule.field]:[...profile[rule.field],rule.skin],
    cpuUnlockClaims:{...profile.cpuUnlockClaims,[input.achievement]:'unverified-client-claim'}};
}
