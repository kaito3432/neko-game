const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const modulePromise=import('../server/pass-google-play.mjs');
const profilePromise=import('../server/online-profile.mjs');
const summaryPromise=import('../server/pass-summary.mjs');
const now=Date.parse('2026-11-10T12:00:00+09:00');
const env={GOOGLE_PLAY_PACKAGE_NAME:'jp.nyanchase.game',GOOGLE_PASS_PRODUCT_ID:'pass-monthly-test',
  GOOGLE_PASS_BASE_PLAN_ID:'monthly-test',GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL:'fixture@example.test',
  GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY:'fixture'};
function store(){const data=new Map();return {get:async key=>data.get(key),put:async (key,value)=>{
  if(typeof key==='object')for(const [name,item] of Object.entries(key))data.set(name,item);
  else data.set(key,value);},transaction:async fn=>fn({get:async key=>data.get(key),
    put:async (key,value)=>{if(typeof key==='object')for(const [name,item] of Object.entries(key))data.set(name,item);
      else data.set(key,value);}})};}
const receipt=(token='a',overrides={})=>({store:'google_play',tokenId:token.repeat(64),
  periodId:`google:${token.repeat(64)}:${now+86400000}`,startsAt:now-1000,expiresAt:now+86400000,
  autoRenewing:true,accountId:'op_test',productId:env.GOOGLE_PASS_PRODUCT_ID,...overrides});

test('Google API responseだけがPass periodになり、package/product/base plan/stateを検証',async()=>{
  const {verifyGooglePassSubscription}=await modulePromise;
  const body={startTime:new Date(now-1000).toISOString(),subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',
    acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',
    externalAccountIdentifiers:{obfuscatedExternalAccountId:'op_test'},
    lineItems:[{productId:env.GOOGLE_PASS_PRODUCT_ID,expiryTime:new Date(now+86400000).toISOString(),
      offerDetails:{basePlanId:env.GOOGLE_PASS_BASE_PLAN_ID},autoRenewingPlan:{autoRenewEnabled:false}}]};
  const fetchFn=async url=>url.includes('oauth2.googleapis.com')?{ok:true,json:async()=>({access_token:'fixture'})}:
    {ok:true,json:async()=>body};
  // Inject only the credential exchange: never enable a production mock verifier.
  await assert.rejects(verifyGooglePassSubscription({purchaseToken:'token-123',env:{...env,GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY:null},fetchFn,now}),/unavailable/);
  {
    // The test signs an OAuth assertion locally; no fixture credential reaches runtime.
    const {generateKeyPairSync}=require('node:crypto');
    const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
    const configured={...env,GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'})};
    const verified=await verifyGooglePassSubscription({purchaseToken:'token-123',env:configured,fetchFn,now});
    assert.equal(verified.store,'google_play');assert.equal(verified.autoRenewing,false);
    assert.equal(verified.expiresAt,now+86400000);assert.ok(!JSON.stringify(verified).includes('token-123'));
    for(const change of [
      {lineItems:[{...body.lineItems[0],productId:'wrong'}]},
      {lineItems:[{...body.lineItems[0],offerDetails:{basePlanId:'wrong'}}]},
      {subscriptionState:'SUBSCRIPTION_STATE_PENDING'},
      {subscriptionState:'SUBSCRIPTION_STATE_ON_HOLD'}]){
      await assert.rejects(verifyGooglePassSubscription({purchaseToken:'token-123',env:configured,
        fetchFn:async url=>url.includes('oauth2.googleapis.com')?fetchFn(url):{ok:true,json:async()=>({...body,...change})},now}),/not_verified/);
    }
    await assert.rejects(verifyGooglePassSubscription({purchaseToken:'token-123',
      env:{...configured,GOOGLE_PLAY_PACKAGE_NAME:'wrong.package'},
      fetchFn:async url=>url.includes('oauth2.googleapis.com')?fetchFn(url):
        {ok:url.includes('/applications/jp.nyanchase.game/'),json:async()=>body},now}),
    /status_unavailable/);
    assert.ok(!configured.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY.includes('fixture'));
  }
});

test('token再送、別player利用、古い期間、更新を同じPass writerで扱う',async()=>{
  const {applyVerifiedGooglePass}=await modulePromise,{initialProfile}=await profilePromise;
  const storage=store(),profile=initialProfile({},'op_test',now);await storage.put('p',profile);
  const first=await applyVerifiedGooglePass({storage,profileKey:'p',profile,receipt:receipt(),now});
  assert.equal((await summaryPromise).passSummary(first.profile,{now}).active,true);
  assert.equal((await applyVerifiedGooglePass({storage,profileKey:'p',profile,receipt:receipt(),now})).duplicate,true);
  await assert.rejects(applyVerifiedGooglePass({storage,profileKey:'other',profile:{...profile,playerId:'op_other'},
    receipt:receipt('a',{accountId:'op_other'}),now}),/bound_to_other_player/);
  await assert.rejects(applyVerifiedGooglePass({storage,profileKey:'p',profile,
    receipt:receipt('f',{accountId:null}),now}),/account_mismatch/);
  assert.equal((await applyVerifiedGooglePass({storage,profileKey:'p',profile,receipt:receipt('a',
    {expiresAt:now+1000,periodId:`google:${'a'.repeat(64)}:${now+1000}`}),now})).stale,true);
  const renewed=receipt('a',{expiresAt:now+2*86400000,periodId:`google:${'a'.repeat(64)}:${now+2*86400000}`});
  const next=await applyVerifiedGooglePass({storage,profileKey:'p',profile,receipt:renewed,now});
  assert.equal(next.profile.passSubscription.period.id,renewed.periodId);
  const rotated=receipt('d',{linkedTokenId:'a'.repeat(64),
    expiresAt:now+3*86400000,periodId:`google:${'d'.repeat(64)}:${now+3*86400000}`});
  assert.equal((await applyVerifiedGooglePass({storage,profileKey:'p',profile,receipt:rotated,now}))
    .profile.passSubscription.period.id,rotated.periodId);
  await assert.rejects(applyVerifiedGooglePass({storage,profileKey:'p',profile,receipt:receipt('e'),now}),
    /account_transfer_requires_review/);
  assert.equal((await summaryPromise).passSummary(next.profile,{now:now+3*86400000}).active,false);
});

test('Google Passは共通Skill、Skin、Giftへ流れ、無効な自己申告は反映されない',async()=>{
  const {profileRequest,initialProfile}=await profilePromise,storage=store(),key='profile:test';
  const token='b'.repeat(64),headers={Authorization:`Bearer ${token}`};
  const register=new Request('https://players/register',{method:'POST',headers,
    body:JSON.stringify({passSubscription:{store:'google_play',period:{id:'forged',startsAt:0,expiresAt:9999999999999}}})});
  const created=await (await profileRequest(storage,register,{now})).json();
  assert.equal(created.profile.passSubscription.period,null);
  const options={now,googleProductId:env.GOOGLE_PASS_PRODUCT_ID,googleBasePlanId:env.GOOGLE_PASS_BASE_PLAN_ID,
    passSkinPeriods:{'2026-11':'cat_pass_2026_11_starlight'},verifyGooglePass:async()=>receipt('c',
      {accountId:created.profile.playerId}),environment:'sandbox'};
  const response=await profileRequest(storage,new Request('https://players/pass-google-play-purchase',
    {method:'POST',headers,body:JSON.stringify({purchaseToken:'opaque'})}),options);
  const result=await response.json();
  assert.equal(response.status,200);assert.equal(result.passSummary.active,true);
  assert.ok(result.profile.ownedCatSkins.includes('cat_pass_2026_11_starlight'));
  assert.equal(result.passSummary.loginRewardCount,1);
  const skill=await import('../server/skill-entitlements.mjs');
  const locked=skill.resolvePersonalEffectiveSkillEntitlements(result.profile,now);
  assert.equal(locked.skillModeUnlocked,false);
  const unlocked={...result.profile,skillEntitlements:{...result.profile.skillEntitlements,
    skillModeUnlocked:true}};
  const personal=skill.resolvePersonalEffectiveSkillEntitlements(unlocked,now);
  assert.ok(personal.availableSkillIds.includes('POLICE_DASH'));
  assert.equal(skill.resolvePersonalEffectiveSkillEntitlements(unlocked,now+2*86400000)
    .availableSkillIds.includes('POLICE_DASH'),false);
  assert.ok(unlocked.ownedCatSkins.includes('cat_pass_2026_11_starlight'));
  const room={matchType:'roomMatch',profiles:{host:unlocked,guest:{playerId:'guest',
    skillEntitlements:{skillModeUnlocked:true}}},roles:{host:'police',guest:'cat'}};
  room.skillEntitlementSnapshot=skill.captureMatchSkillEntitlements(room,now);
  assert.ok(skill.resolveEffectiveSkillEntitlements(room,'guest').borrowedSkillIds.includes('POLICE_DASH'));
  const opponentShopSkill=require('../match-skill-info.js').opponentShopSkill;
  const cta=opponentShopSkill({playMode:'onlineCat',game:{abilitiesEnabled:true,
    selectedAbilities:{police:'dash'}},catalog:require('../skill-catalog.js'),
    shopDefinitions:require('../store-ui-model.js').DEFINITIONS,
    products:require('../monetization-products.js'),permanentSkillEntitlements:{ownedSkillIds:[]},
    personalSkillEntitlements:personal});
  assert.equal(cta,null);
  const absent=await profileRequest(storage,new Request('https://players/pass-google-play-purchase',
    {method:'POST',headers,body:JSON.stringify({purchaseToken:'opaque'})}),{now});
  assert.equal(absent.status,503);
  assert.match(fs.readFileSync(path.join(__dirname,'../server/worker.mjs'),'utf8'),/pass-google-play-purchase/);
});

test('認証済みplayerのGoogle API検証要求を30回/分に制限する',async()=>{
  const {profileRequest}=await profilePromise,storage=store(),headers={Authorization:`Bearer ${'d'.repeat(64)}`};
  await profileRequest(storage,new Request('https://players/register',{method:'POST',headers,body:'{}'}),{now});
  let calls=0;
  const options={now,verifyGooglePass:async()=>{calls++;throw new Error('not_verified');}};
  for(let i=0;i<30;i++){
    const response=await profileRequest(storage,new Request('https://players/pass-google-play-purchase',
      {method:'POST',headers,body:'{"purchaseToken":"opaque"}'}),options);
    assert.equal(response.status,403);
  }
  const limited=await profileRequest(storage,new Request('https://players/pass-google-play-purchase',
    {method:'POST',headers,body:'{"purchaseToken":"opaque"}'}),options);
  assert.equal(limited.status,429);assert.equal(calls,30);
});
