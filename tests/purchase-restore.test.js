const test=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
globalThis.crypto||=webcrypto;

class Store{
  values=new Map();
  async get(key){return structuredClone(this.values.get(key));}
  async put(key,value){for(const [k,v] of typeof key==='string'?[[key,value]]:Object.entries(key))
    this.values.set(k,structuredClone(v));}
  async list({prefix=''}={}){return new Map([...this.values].filter(([key])=>key.startsWith(prefix)));}
  async transaction(fn){return fn(this);}
}
const modules=Promise.all([import('../server/online-profile.mjs'),
  import('../server/storekit-verification.mjs'),import('../server/google-play-verification.mjs'),
  import('../server/pass-storekit.mjs'),import('../server/pass-google-play.mjs'),
  import('../server/purchase-restore.mjs')]);
const OLD='op_11111111-1111-4111-8111-111111111111';
const NEW='op_22222222-2222-4222-8222-222222222222';
const now=Date.parse('2026-11-10T12:00:00Z');
const appleReceipt={transactionId:'100',originalTransactionId:'100',productId:'SKILL_PACK_01',
  purchaseDate:now-1000,environment:'Sandbox',appAccountToken:OLD.slice(3)};

test('retained recordは購入と取得済みPass Skinだけを残し通常進行をコピーしない',async()=>{
  const [online,,,,,restore]=await modules,storage=new Store();
  const profile={...online.initialProfile({},OLD,now),ranked:{rp:800},serverNyanCoins:300,
    passSkinRewardsClaimed:[{monthKey:'2026-11',skinId:'cat_pass_2026_11_starlight',claimedAt:now-1}]};
  await storage.put('storekit:100',{playerId:OLD,productId:'SKILL_PACK_01',purchaseDate:now-1000});
  await storage.put('pass-original:sandbox:200',{playerId:OLD,productId:'pass',verifiedAt:now-1000});
  await storage.put(`pass-store:${OLD}`,{originalTransactionId:'200',productId:'pass'});
  const records=await restore.retainedPurchaseRecords(storage,profile,now);
  assert.equal(records.length,2);
  assert.equal(records.find(row=>row.key==='storekit:100').record.passSkinRewards.length,0);
  assert.equal(records.find(row=>row.key==='pass-original:sandbox:200').record.passSkinRewards.length,1);
  assert.equal(JSON.stringify(records).includes(OLD),false);
  assert.equal(/ranked|serverNyanCoins|giftBox|stamina/.test(JSON.stringify(records)),false);
});

test('Apple買い切りはdeleted markerとRestoreとStore確認更新が揃う場合だけ再付与',async()=>{
  const [online,apple]=await modules,storage=new Store(),profile=online.initialProfile({},NEW,now);
  await storage.put('new',profile);
  const marker={state:'deleted',store:'app_store',productId:'SKILL_PACK_01'};
  await storage.put('storekit:100',marker);
  const verify=async()=>appleReceipt;
  await assert.rejects(apple.applyVerifiedStoreTransaction({storage,profileKey:'new',profile,
    signedTransaction:'jws',verify}),/restore_not_allowed/);
  await assert.rejects(apple.applyVerifiedStoreTransaction({storage,profileKey:'new',profile,
    signedTransaction:'jws',verify,restore:true,setAccountToken:async()=>{throw Error('update_failed');}}),/update_failed/);
  assert.deepEqual(await storage.get('storekit:100'),marker);
  assert.equal((await storage.get('new')).skillEntitlements.purchasedProductIds.length,0);
  const applied=await apple.applyVerifiedStoreTransaction({storage,profileKey:'new',profile,
    signedTransaction:'jws',verify,restore:true,setAccountToken:async()=>true});
  assert.ok(applied.profile.skillEntitlements.purchasedProductIds.includes('SKILL_PACK_01'));
  assert.equal((await apple.applyVerifiedStoreTransaction({storage,profileKey:'new',profile:applied.profile,
    signedTransaction:'jws',verify:async()=>({...appleReceipt,appAccountToken:NEW.slice(3)})})).duplicate,true);
});

test('Apple買い切りは有効な旧binding、検証なし、別商品を拒否',async()=>{
  const [online,apple]=await modules,storage=new Store(),profile=online.initialProfile({},NEW,now);
  await storage.put('new',profile);
  await storage.put('storekit:100',{playerId:OLD,productId:'SKILL_PACK_01'});
  await assert.rejects(apple.applyVerifiedStoreTransaction({storage,profileKey:'new',profile,
    signedTransaction:'jws',verify:async()=>appleReceipt,restore:true,setAccountToken:async()=>true}));
  await storage.put('storekit:100',{state:'deleted',store:'app_store',productId:'REMOVE_ADS'});
  await assert.rejects(apple.applyVerifiedStoreTransaction({storage,profileKey:'new',profile,
    signedTransaction:'jws',verify:async()=>appleReceipt,restore:true,setAccountToken:async()=>true}),/restore_not_allowed/);
  await assert.rejects(apple.applyVerifiedStoreTransaction({storage,profileKey:'new',profile,
    signedTransaction:'100',restore:true,setAccountToken:async()=>true}),/verification_unavailable/);
});

test('Google買い切りはdeleted markerと再検証済みtokenで復元し全文を保存しない',async()=>{
  const [online,,google]=await modules,storage=new Store(),profile=online.initialProfile({},NEW,now);
  await storage.put('new',profile);
  const token='purchase-token',hash=Buffer.from(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(token))).toString('base64url');
  await storage.put(`googleplay:${hash}`,{state:'deleted',store:'google_play',productId:'SKILL_POLICE_DASH'});
  const verify=async()=>({purchaseToken:token,productId:'SKILL_POLICE_DASH',orderId:'order',
    purchaseDate:now,obfuscatedExternalAccountId:OLD});
  await assert.rejects(google.applyVerifiedGooglePlayPurchase({storage,profileKey:'new',profile,
    purchaseToken:token,productId:'SKILL_POLICE_DASH',verify}),/restore_not_allowed/);
  const result=await google.applyVerifiedGooglePlayPurchase({storage,profileKey:'new',profile,
    purchaseToken:token,productId:'SKILL_POLICE_DASH',verify,restore:true});
  assert.ok(result.profile.skillEntitlements.purchasedProductIds.includes('SKILL_POLICE_DASH'));
  assert.equal(JSON.stringify(await storage.get(`googleplay:${hash}`)).includes(token),false);
  assert.equal((await google.applyVerifiedGooglePlayPurchase({storage,profileKey:'new',profile:result.profile,
    purchaseToken:token,productId:'SKILL_POLICE_DASH',verify:async()=>({...await verify(),
      obfuscatedExternalAccountId:NEW}),restore:true})).duplicate,true);
});

test('Apple Pass復元は取得済みSkinだけ移しGift・Rank・Coinを移さない',async()=>{
  const [online,,,applePass,,restore]=await modules,storage=new Store();
  const profile=online.initialProfile({},NEW,now);await storage.put('new',profile);
  const receipt={store:'app_store',environment:'sandbox',productId:'pass',groupId:'group',
    originalTransactionId:'200',transactionId:'201',periodId:'apple:201',
    appAccountToken:OLD.slice(3),startsAt:now-1000,expiresAt:now+86400000,autoRenewing:false};
  await storage.put('pass-original:sandbox:200',{state:'deleted',store:'app_store',productId:'pass',
    identity:'sandbox:200',passSkinRewards:[{rewardType:'passMonthlySkin',
      skinId:'cat_pass_2026_11_starlight',monthKey:'2026-11',acquiredAt:now-500,
      source:'Pass',purchaseIdentity:'sandbox:200'}]});
  const result=await applePass.applyVerifiedApplePass({storage,profileKey:'new',profile,receipt,now,
    restore:true,setAccountToken:async()=>true});
  assert.ok(result.profile.ownedCatSkins.includes('cat_pass_2026_11_starlight'));
  assert.equal(result.profile.passSkinRewardsClaimed.length,1);
  assert.equal(result.profile.serverNyanCoins,0);
  assert.equal(result.profile.giftBox.rewards.length,0);
  assert.equal(result.profile.passLoginProgress.issuedCount,15);
  assert.equal(result.profile.passSubscription.autoRenewing,false);
  assert.equal(restore.restoreRetainedPassSkins(result.profile,{state:'bound',identity:'sandbox:200',
    passSkinRewards:[]},now).passSkinRewardsClaimed.length,1);
});

test('Apple Passで旧profileがSkin未取得なら現在月の自動付与も止める',async()=>{
  const [online,,,applePass]=await modules,storage=new Store(),profile=online.initialProfile({},NEW,now);
  await storage.put('new',profile);
  await storage.put('pass-original:sandbox:200',{state:'deleted',store:'app_store',productId:'pass',
    identity:'sandbox:200',passSkinRewards:[]});
  const receipt={store:'app_store',environment:'sandbox',productId:'pass',groupId:'group',
    originalTransactionId:'200',transactionId:'201',periodId:'apple:201',
    appAccountToken:OLD.slice(3),startsAt:now-1000,expiresAt:now+86400000,autoRenewing:true};
  const result=await applePass.applyVerifiedApplePass({storage,profileKey:'new',profile,receipt,now,
    restore:true,setAccountToken:async()=>true});
  const monthly=await import('../server/pass-monthly-skins.mjs');
  assert.equal(monthly.grantCurrentPassMonthlySkinIfEligible(result.profile,{now,
    periods:{'2026-11':'cat_pass_2026_11_starlight'},knownSkins:{ownedCatSkins:['cat_pass_2026_11_starlight']}}).granted,false);
});

test('Google Pass linked tokenは削除済みchainから一度だけ復元',async()=>{
  const [online,,,,googlePass]=await modules,storage=new Store(),profile=online.initialProfile({},NEW,now);
  await storage.put('new',profile);
  await storage.put(`pass-google-token:${'a'.repeat(64)}`,{state:'deleted',store:'google_play',
    productId:'pass',identity:'a'.repeat(64),passSkinRewards:[]});
  const receipt={store:'google_play',tokenId:'b'.repeat(64),linkedTokenId:'a'.repeat(64),
    periodId:`google:${'b'.repeat(64)}:${now+86400000}`,startsAt:now-1000,expiresAt:now+86400000,
    autoRenewing:true,accountId:OLD,productId:'pass'};
  const result=await googlePass.applyVerifiedGooglePass({storage,profileKey:'new',profile,receipt,now,restore:true});
  assert.equal(result.profile.passSubscription.period.id,receipt.periodId);
  assert.equal((await storage.get(`pass-google-token:${'a'.repeat(64)}`)).playerId,NEW);
  await assert.rejects(googlePass.applyVerifiedGooglePass({storage,profileKey:'other',
    profile:{...profile,playerId:'op_other'},receipt:{...receipt,accountId:'op_other'},now,restore:true}));
});

test('Restore endpointは認証必須でbodyのplayerIdを信用せず10回/分で制限',async()=>{
  const [online]=await modules,storage=new Store(),token='a'.repeat(64);
  const key=`profile:${await online.digestToken(token)}`;
  await storage.put(key,online.initialProfile({},NEW,now));
  const request=auth=>new Request('https://players/google-play-restore',{method:'POST',
    headers:auth?{Authorization:`Bearer ${token}`}:{},
    body:JSON.stringify({playerId:OLD,purchaseToken:'opaque',productId:'SKILL_PACK_01'})});
  assert.equal((await online.profileRequest(storage,request(false),{now})).status,401);
  const options={now,verifyGooglePlayPurchase:async()=>({purchaseToken:'opaque',
    productId:'SKILL_PACK_01',obfuscatedExternalAccountId:OLD})};
  for(let i=0;i<10;i++){
    const response=await online.profileRequest(storage,request(true),options);
    assert.equal(response.status,403);
  }
  assert.equal((await online.profileRequest(storage,request(true),options)).status,429);
  assert.equal((await storage.get(key)).playerId,NEW);
});

test('deleted binding作成はprofile-key削除後だけ許可',async()=>{
  const [online,,,,,restore]=await modules,storage=new Store();
  const profile=online.initialProfile({},OLD,now);
  await storage.put(`profile-key:${OLD}`,'profile:old');
  await storage.put('storekit:100',{playerId:OLD,productId:'SKILL_PACK_01'});
  const records=await restore.retainedPurchaseRecords(storage,profile,now);
  await assert.rejects(restore.markDeletedPurchaseBindings(storage,profile,records),/profile_not_deleted/);
  storage.values.delete(`profile-key:${OLD}`);
  assert.equal(await restore.markDeletedPurchaseBindings(storage,profile,records),1);
  assert.equal((await storage.get('storekit:100')).state,'deleted');
});

test('Pass restoreは失効期間をactiveにせず、active旧profileの別player rebindを拒否',async()=>{
  const [online,,,applePass,googlePass]=await modules,storage=new Store(),profile=online.initialProfile({},NEW,now);
  await storage.put('new',profile);
  const apple={store:'app_store',environment:'sandbox',productId:'pass',groupId:'group',
    originalTransactionId:'200',transactionId:'201',periodId:'apple:201',
    appAccountToken:OLD.slice(3),startsAt:now-86400000,expiresAt:now-1,autoRenewing:false};
  await storage.put('pass-original:sandbox:200',{state:'deleted',store:'app_store',productId:'pass',
    identity:'sandbox:200',passSkinRewards:[]});
  await assert.rejects(applePass.applyVerifiedApplePass({storage,profileKey:'new',profile,
    receipt:apple,now,restore:true,setAccountToken:async()=>true}),/restore_not_allowed/);
  await storage.put('pass-original:sandbox:200',{playerId:OLD});
  await assert.rejects(applePass.applyVerifiedApplePass({storage,profileKey:'new',profile,
    receipt:{...apple,expiresAt:now+10000},now,restore:true,setAccountToken:async()=>true}));
  const google={store:'google_play',tokenId:'a'.repeat(64),periodId:`google:${'a'.repeat(64)}:${now+10000}`,
    startsAt:now-1000,expiresAt:now+10000,autoRenewing:true,accountId:OLD,productId:'pass'};
  await storage.put(`pass-google-token:${'a'.repeat(64)}`,{playerId:OLD});
  await assert.rejects(googlePass.applyVerifiedGooglePass({storage,profileKey:'new',profile,
    receipt:google,now,restore:true}));
});

test('Apple restoreは取引IDだけを埋めた偽JWSをStore署名済み取引と一致させず拒否',async()=>{
  const [,apple, ,applePass]=await modules;
  const payload={transactionId:'100',originalTransactionId:'100',productId:'SKILL_PACK_01',
    bundleId:'jp.nyanchase.game',environment:'Sandbox',purchaseDate:now};
  const signed=value=>`e30.${Buffer.from(JSON.stringify(value)).toString('base64url')}.signature`;
  const official=signed(payload),forged=signed({...payload,signedDate:1});
  const {generateKeyPairSync}=require('node:crypto');
  const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({type:'pkcs8',format:'pem'});
  const env={APP_STORE_CONNECT_PRIVATE_KEY:key,APP_STORE_CONNECT_KEY_ID:'K',
    APP_STORE_CONNECT_ISSUER_ID:'I',APPLE_BUNDLE_ID:'jp.nyanchase.game'};
  await assert.rejects(apple.verifyStoreKitTransaction(forged,{env,restoreProof:true,
    fetchFn:async()=>({ok:true,json:async()=>({signedTransactionInfo:official})})}),/proof_mismatch/);
  const passEnv={...env,NYAN_ENVIRONMENT:'sandbox',APPLE_PASS_PRODUCT_ID:'pass',
    APPLE_PASS_SUBSCRIPTION_GROUP_ID:'group'};
  const passPayload={...payload,transactionId:'201',originalTransactionId:'200',productId:'pass',
    expiresDate:now+86400000};
  const passOfficial=signed(passPayload),passForged=signed({...passPayload,signedDate:1});
  await assert.rejects(applePass.verifyApplePassStatus({signedTransaction:passForged,env:passEnv,
    restoreProof:true,fetchFn:async()=>({ok:true,json:async()=>({environment:'Sandbox',
      bundleId:'jp.nyanchase.game',data:[{subscriptionGroupIdentifier:'group',lastTransactions:[{
        status:1,signedTransactionInfo:passOfficial}]}]})})}),/proof_mismatch/);
});

test('Set App Account Tokenは元取引IDへPUTし失敗時は拒否',async()=>{
  const [,apple]=await modules;
  const {generateKeyPairSync}=require('node:crypto');
  const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({type:'pkcs8',format:'pem'});
  const env={APP_STORE_CONNECT_PRIVATE_KEY:key,APP_STORE_CONNECT_KEY_ID:'K',
    APP_STORE_CONNECT_ISSUER_ID:'I'};
  const calls=[];
  const receipt={originalTransactionId:'100',environment:'Sandbox'};
  await apple.setAppleAppAccountToken(receipt,NEW,{env,now,fetchFn:async(url,options)=>{
    calls.push({url,options});return {ok:true};}});
  assert.match(calls[0].url,/api\.storekit-sandbox\.apple\.com\/inApps\/v1\/transactions\/100\/appAccountToken$/);
  assert.equal(calls[0].options.method,'PUT');
  assert.deepEqual(JSON.parse(calls[0].options.body),{appAccountToken:NEW.slice(3)});
  await assert.rejects(apple.setAppleAppAccountToken(receipt,NEW,{env,now,
    fetchFn:async()=>({ok:false})}),/update_failed/);
});

test('Google購入の無効状態と商品・package不一致はServer検証で拒否',async()=>{
  const [,,google]=await modules;
  const env={GOOGLE_PLAY_PACKAGE_NAME:'jp.nyanchase.game',GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL:'x',
    GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY:'x'};
  const purchase={purchaseStateContext:{purchaseState:'CANCELLED'},
    productLineItem:[{productId:'SKILL_PACK_01'}],orderId:'o'};
  const fetchFn=async url=>url.includes('oauth2.googleapis.com')
    ?{ok:true,json:async()=>({access_token:'a'})}:{ok:true,json:async()=>purchase};
  // A valid OAuth signing key is supplied only inside this test.
  const {generateKeyPairSync}=require('node:crypto');
  env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY=generateKeyPairSync('rsa',{modulusLength:2048})
    .privateKey.export({type:'pkcs8',format:'pem'});
  await assert.rejects(google.verifyGooglePlayPurchase({purchaseToken:'opaque-token',
    productId:'SKILL_PACK_01'},{env,fetchFn,now}),/purchase_mismatch/);
  await assert.rejects(google.verifyGooglePlayPurchase({purchaseToken:'opaque-token',
    productId:'SKILL_PACK_01'},{env:{...env,GOOGLE_PLAY_PACKAGE_NAME:'wrong.package'},
    fetchFn:async url=>url.includes('oauth2.googleapis.com')?fetchFn(url):{ok:false},now}),
  /not_verified/);
});

test('期限切れApple Passは取得済み永久Skinだけ復元しPassとGiftは付与しない',async()=>{
  const [online,,,,,restore]=await modules,storage=new Store(),profile=online.initialProfile({},NEW,now);
  await storage.put('new',profile);
  await storage.put('pass-original:sandbox:200',{state:'deleted',store:'app_store',productId:'pass',
    identity:'sandbox:200',passSkinRewards:[{rewardType:'passMonthlySkin',
      skinId:'cat_pass_2026_11_starlight',monthKey:'2026-11',acquiredAt:now-86400000,
      source:'Pass',purchaseIdentity:'sandbox:200'}]});
  const receipt={store:'app_store',environment:'sandbox',productId:'pass',originalTransactionId:'200',
    expiresAt:now-1};
  const result=await restore.restoreExpiredApplePassSkins({storage,profileKey:'new',profile,
    receipt,now,setAccountToken:async()=>true});
  assert.equal(result.restoredSkins,1);
  assert.ok(result.profile.ownedCatSkins.includes('cat_pass_2026_11_starlight'));
  assert.equal(result.profile.passSubscription.period,null);
  assert.equal(result.profile.giftBox.rewards.length,0);
  assert.equal(result.profile.serverNyanCoins,0);
});

test('期限切れGoogle Passも取得済みSkinだけ復元し購読は再開しない',async()=>{
  const [online,,,,googlePass,restore]=await modules,storage=new Store();
  const profile=online.initialProfile({},NEW,now),tokenId='a'.repeat(64);
  await storage.put('new',profile);
  await storage.put(`pass-google-token:${tokenId}`,{state:'deleted',store:'google_play',
    productId:'pass',identity:tokenId,passSkinRewards:[{rewardType:'passMonthlySkin',
      skinId:'cat_pass_2026_11_starlight',monthKey:'2026-11',acquiredAt:now-86400000,
      source:'Pass',purchaseIdentity:tokenId}]});
  const receipt={store:'google_play',tokenId,accountId:OLD,productId:'pass',expired:true};
  const result=await restore.restoreExpiredGooglePassSkins({storage,profileKey:'new',profile,receipt,now});
  assert.equal(result.restoredSkins,1);
  assert.ok(result.profile.ownedCatSkins.includes('cat_pass_2026_11_starlight'));
  assert.equal(result.profile.passSubscription.period,null);
  assert.equal(result.profile.giftBox.rewards.length,0);
  const config={GOOGLE_PLAY_PACKAGE_NAME:'jp.nyanchase.game',GOOGLE_PASS_PRODUCT_ID:'pass',
    GOOGLE_PASS_BASE_PLAN_ID:'monthly',GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL:'x'};
  const {generateKeyPairSync}=require('node:crypto');
  config.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY=generateKeyPairSync('rsa',{modulusLength:2048})
    .privateKey.export({type:'pkcs8',format:'pem'});
  const fetchFn=async url=>url.includes('oauth2.googleapis.com')
    ?{ok:true,json:async()=>({access_token:'a'})}:{ok:true,json:async()=>({
      subscriptionState:'SUBSCRIPTION_STATE_EXPIRED',externalAccountIdentifiers:{obfuscatedExternalAccountId:OLD},
      lineItems:[{productId:'pass',expiryTime:new Date(now-1).toISOString(),
        offerDetails:{basePlanId:'monthly'}}]})};
  const verified=await googlePass.verifyGoogleExpiredPassOwnership({purchaseToken:'opaque-token',
    env:config,fetchFn,now});
  assert.equal(verified.expired,true);
  await assert.rejects(googlePass.verifyGooglePassSubscription({purchaseToken:'opaque-token',
    env:config,fetchFn,now}),/not_verified/);
});

test('認証済みPass Restore endpointは期限切れ証明をSkin専用経路へ送りactiveを返さない',async()=>{
  const [online]=await modules,storage=new Store(),token='c'.repeat(64);
  const key=`profile:${await online.digestToken(token)}`,profile=online.initialProfile({},NEW,now);
  await storage.put(key,profile);
  await storage.put(`pass-google-token:${'a'.repeat(64)}`,{state:'deleted',store:'google_play',
    productId:'pass',identity:'a'.repeat(64),passSkinRewards:[{rewardType:'passMonthlySkin',
      skinId:'cat_pass_2026_11_starlight',monthKey:'2026-11',acquiredAt:now-1000,
      source:'Pass',purchaseIdentity:'a'.repeat(64)}]});
  const response=await online.profileRequest(storage,new Request('https://players/pass-google-play-restore',{
    method:'POST',headers:{Authorization:`Bearer ${token}`},
    body:JSON.stringify({purchaseToken:'opaque-token',playerId:OLD})}),{
    now,verifyGooglePass:async()=>{throw Error('google_pass_status_not_verified');},
    verifyGoogleExpiredPass:async()=>({store:'google_play',tokenId:'a'.repeat(64),
      productId:'pass',expired:true,accountId:OLD})});
  const result=await response.json();
  assert.equal(response.status,200);
  assert.equal(result.passSummary.active,false);
  assert.equal(result.profile.passSubscription.period,null);
  assert.ok(result.profile.ownedCatSkins.includes('cat_pass_2026_11_starlight'));
  assert.equal(result.profile.giftBox.rewards.length,0);
});
