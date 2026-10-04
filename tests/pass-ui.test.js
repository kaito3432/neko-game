const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const summary=import('../server/pass-summary.mjs');
const online=import('../server/online-profile.mjs');
const model=require('../pass-ui-model.js');
const catalog=require('../collection-catalog.js');
const now=Date.parse('2027-01-10T12:00:00+09:00');
const activePass={store:'app_store',period:{id:'period-1',startsAt:now-1000,expiresAt:now+86400000},
  verifiedAt:now-1000,autoRenewing:true};
const skinCatalog={cat_master_s01_king:{category:'catSkin',passMonthlyReward:true}};
const options={now,periods:{'2027-01':'cat_master_s01_king'},catalog:skinCatalog,
  knownSkins:{ownedCatSkins:['default','cat_master_s01_king']}};
const mk=async()=>({...((await online).initialProfile({},'op_test',now))});

test('inactive UIは加入CTAと特典・仮価格を表示用stateへ保持',async()=>{
  const profile=await mk(),server=(await summary).passSummary(profile,options),view=model.fromServer(server,catalog);
  assert.equal(view.active,false);assert.equal(view.expired,false);
  assert.equal(view.currentSkin?.name,'王様ネコ');
  assert.ok(view.currentSkin?.description);
  assert.equal(view.eligibleSkillCount,5);
  assert.equal(view.price.source,'phase5-fixture');assert.equal(view.price.text,'月額500円予定');
  assert.equal(view.canPurchase,false);
  const ui=fs.readFileSync(path.join(__dirname,'../pass-ui.js'),'utf8');
  for(const label of ['にゃんチェイスパスに加入','対象Skill全種類利用可能','限定Skin','最大30 Stamina',
    '広告を3回視聴するとSkill Modeは永続解放されます','Pass加入だけでは解放されません','Pass終了後も使用できます','90日以内']){
    assert.ok(ui.includes(label),label);
  }
  assert.ok(ui.includes('今月の限定Skin'));
  assert.ok(ui.includes('disabled>にゃんチェイスパスに加入'));
  assert.ok(ui.includes('購入を復元'));
  assert.ok(ui.includes('data-pass-progress-bar'));
  assert.ok(ui.includes('data-pass-refresh'));
  assert.ok(ui.includes('data-pass-gift-open'));
  assert.doesNotMatch(ui,/PassでSkill Mode解放|全スキル使い放題/);
  assert.match(ui,/現在の対象：\$\{state\.eligibleSkillCount\}種類/);
});

test('星灯りHeroの紹介はcatalog由来で、Skinの所有判定とは独立',async()=>{
  const profile=await mk(),server=(await summary).passSummary(profile,
    {...options,now:Date.parse('2026-11-10T12:00:00+09:00'),
      periods:{'2026-11':'cat_pass_2026_11_starlight'},
      catalog:{cat_pass_2026_11_starlight:{category:'catSkin',passMonthlyReward:true}},
      knownSkins:{ownedCatSkins:['default','cat_pass_2026_11_starlight']}});
  const view=model.fromServer(server,catalog);
  assert.equal(view.currentSkin.name,'星灯りの旅ねこ');
  assert.match(view.currentSkin.description,/星明かり/);
  assert.equal(view.skinOwned,false);
});

test('active・自動更新OFFは期限まで加入中、Skin/Skill/Giftを分離表示',async()=>{
  const profile=await mk();profile.passSubscription={...activePass,autoRenewing:false};
  profile.ownedCatSkins.push('cat_master_s01_king');
  profile.passLoginProgress={periodId:'period-1',issuedCount:8,lastDateKey:'2027-01-09'};
  profile.giftBox={version:1,rewards:[
    {rewardId:'one',rewardType:'STAMINA',amount:2,source:'NYAN_CHASE_PASS_LOGIN',createdAt:now-1000,expiresAt:now+1000,claimed:false,claimedAt:null,metadata:{}},
    {rewardId:'two',rewardType:'STAMINA',amount:1,source:'NYAN_CHASE_PASS_LOGIN',createdAt:now-10000,expiresAt:now-1,claimed:false,claimedAt:null,metadata:{}},
    {rewardId:'three',rewardType:'STAMINA',amount:1,source:'NYAN_CHASE_PASS_LOGIN',createdAt:now-10000,expiresAt:now+1000,claimed:true,claimedAt:now-500,metadata:{}}]};
  const server=(await summary).passSummary(profile,options),view=model.fromServer(server,catalog);
  assert.equal(view.active,true);assert.equal(view.autoRenew,false);assert.equal(view.expiresAt,activePass.period.expiresAt);
  assert.equal(view.skinOwned,true);assert.equal(view.eligibleSkillCount,5);
  assert.equal(view.loginCount,8);assert.equal(view.nextLoginReward,2);assert.equal(view.giftCount,1);
  assert.equal(view.giftBadgeCount,1);
  assert.equal(profile.skillEntitlements.ownedSkillIds.length,0);
});

test('失効/再加入とSkin mapping未設定は正常fallback',async()=>{
  const profile=await mk();profile.passSubscription={...activePass,period:{...activePass.period,expiresAt:now-1}};
  let server=(await summary).passSummary(profile,options),view=model.fromServer(server,catalog);
  assert.equal(view.active,false);assert.equal(view.expired,true);assert.equal(view.nextLoginReward,null);
  server=(await summary).passSummary({...profile,passSubscription:activePass},
    {...options,periods:{}});view=model.fromServer(server,catalog);
  assert.equal(view.active,true);assert.equal(view.currentSkin,null);
  profile.passLoginProgress={periodId:'old-period',issuedCount:15,lastDateKey:'2027-01-09'};
  server=(await summary).passSummary({...profile,passSubscription:activePass},options);
  assert.equal(server.loginRewardCount,0);assert.equal(server.nextLoginStaminaReward,1);
  assert.equal(model.fromServer(server,catalog).skinOwned,false);
});

test('0/5/10/15回の次回報酬と完了状態',async()=>{
  const profile=await mk();profile.passSubscription=activePass;
  for(const [count,expected] of [[0,1],[5,2],[10,3],[15,null]]){
    profile.passLoginProgress={periodId:'period-1',issuedCount:count,lastDateKey:null};
    const server=(await summary).passSummary(profile,options),view=model.fromServer(server,catalog);
    assert.equal(view.loginCount,count);assert.equal(view.nextLoginReward,expected);
  }
});

test('Phase 6の価格は月額Store商品とgroup一致時だけlocalized値を表示',async()=>{
  const profile=await mk(),server=(await summary).passSummary(profile,{...options,
    passProductId:'test.pass.monthly',passGroupId:'12345678'});
  const product={productId:'test.pass.monthly',subscriptionGroupId:'12345678',
    subscriptionPeriod:{unit:'month',value:1},displayPrice:'¥680',currencyCode:'JPY'};
  const loaded=model.fromServer(server,catalog,product);
  assert.equal(loaded.price.text,'¥680 / 月');assert.equal(loaded.price.source,'app-store');
  assert.equal(loaded.canPurchase,true);
  assert.equal(model.fromServer(server,catalog,{...product,subscriptionGroupId:'other'}).canPurchase,false);
  assert.equal(model.fromServer(server,catalog,{...product,subscriptionPeriod:{unit:'year',value:1}}).canPurchase,false);
  assert.equal(model.fromServer(server,catalog).price.text,'価格を取得できませんでした');
});

test('認証済みprofileとappearanceだけからpassSummaryを受け、client自己申告は無効',async()=>{
  const {profileRequest,digestToken,initialProfile}=await online;
  const token='ab'.repeat(32),key=`profile:${await digestToken(token)}`;
  const values=new Map(),storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v)),
    transaction:async fn=>fn(storage)};
  const profile=initialProfile({},'op_test',now);profile.passSubscription=activePass;
  await storage.put(key,profile);
  const headers={Authorization:`Bearer ${token}`};
  const get=await (await profileRequest(storage,new Request('https://players/profile',{headers}),options)).json();
  assert.equal(get.passSummary.active,true);
  const appearance=await (await profileRequest(storage,new Request('https://players/appearance',
    {method:'POST',headers,body:JSON.stringify({passSubscription:{...activePass,period:{...activePass.period,expiresAt:now+99999999}}})}),options)).json();
  assert.equal(appearance.passSummary.expiresAt,activePass.period.expiresAt);
  assert.equal((await storage.get(key)).passSubscription.period.expiresAt,activePass.period.expiresAt);
  const list=await (await profileRequest(storage,new Request('https://players/gifts',{headers}),options)).json();
  assert.equal(list.passSummary.unclaimedPassGiftCount,1);
  const rewardId=list.giftBox.rewards[0].rewardId;
  const claimed=await (await profileRequest(storage,new Request('https://players/gift-claim',
    {method:'POST',headers,body:JSON.stringify({rewardId})}),options)).json();
  assert.equal(claimed.passSummary.unclaimedPassGiftCount,0);
  assert.equal(claimed.passSummary.loginRewardCount,1);
});
