const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function setup(){
  const values=new Map(),sent=[],cached=[];
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
  const local={playerId:'ncp_1234567890abcdef',nyanCoins:20,
    ownedCatSkins:['default','cat_kaitou','cat_coin_01'],ownedDogSkins:['default'],
    ownedBoardThemes:['default'],ownedCardboards:['default'],ownedPaws:['default'],dailyMissionProgress:{date:null}};
  const profile={playerId:'op_test',serverNyanCoins:80,coinMigration:{version:1,id:'legacy:test:0001'}};
  const context=vm.createContext({crypto:webcrypto,localStorage:storage,
    NyanProgressionModel:{MISSIONS:[]},NyanPlayerData:{applyCoinProfile:async value=>cached.push(value)},
    NyanOnline:{API_BASE:'https://sandbox.example'},
    NyanOnlineIdentity:{prepare:async()=>({profile}),request:async(_base,path,body)=>{sent.push({path,body});return {profile};}},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},dispatchEvent(){}});
  context.globalThis=context;
  vm.runInContext(fs.readFileSync(require.resolve('../coin-wallet.js'),'utf8'),context);
  return {wallet:context.NyanCoinWallet,context,local,profile,sent,cached,values};
}
test('legacy claim is snapshotted before I/O and retries with same ID; non-coin unlocks are excluded',async()=>{
  const f=setup();let attempts=0,first=null;
  const post=async(_path,body)=>{attempts++;if(!first)first=structuredClone(body);if(attempts===1)throw Error('lost_response');return {profile:{...f.profile,serverNyanCoins:100,coinMigration:{version:1,id:body.migrationId}}};};
  await assert.rejects(f.wallet.migrate(post,f.local,{...f.profile,coinMigration:null}),/lost_response/);
  assert.equal(f.local.nyanCoins,20);
  await f.wallet.migrate(post,f.local,{...f.profile,coinMigration:null});
  assert.equal(first.migrationId,JSON.parse(f.values.get('nyanChaseCoinMigrationV1')).migrationId);
  assert.deepEqual(first.ownership.ownedCatSkins,['default','cat_coin_01']);
  assert.equal(f.cached.at(-1).serverNyanCoins,100);
});
test('lost purchase response reuses request ID and never falls back to local debit',async()=>{
  const f=setup();let fail=true;
  await f.wallet.accept(f.profile);
  f.context.NyanOnlineIdentity.request=async(_base,path,body)=>{
    f.sent.push({path,body});if(fail){fail=false;throw Error('lost_response');}
    return {profile:{...f.profile,serverNyanCoins:50,ownedCardboards:['default','cardboard_coin_01']}};
  };
  await assert.rejects(f.wallet.purchase('cardboard','cardboard_coin_01'),/lost_response/);
  const stored=JSON.parse(f.values.get('nyanChaseCoinPurchasePendingV1'));
  assert.equal(f.sent.length,1);
  await f.wallet.purchase('cardboard','cardboard_coin_01');
  assert.equal(f.sent[1].body.requestId,stored.requestId);
  assert.equal(f.cached.at(-1).serverNyanCoins,50);
  assert.equal(f.values.has('nyanChaseCoinPurchasePendingV1'),false);
});
test('a previously migrated local cache is never imported as fresh coins for another profile',async()=>{
  const f=setup();f.local.coinAuthority={version:1,profileId:'op_deleted'};
  f.wallet.resetForDeletedProfile();
  let claim;
  await f.wallet.migrate(async(_path,body)=>{claim=body;return {profile:{...f.profile,playerId:'op_new',coinMigration:{version:1,id:body.migrationId}}};},
    f.local,{playerId:'op_new',coinMigration:null});
  assert.equal(claim.localCoins,0);
  assert.deepEqual(Array.from(claim.ownership.ownedCatSkins),['default']);
});
