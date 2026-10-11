/* Authenticated Worker coin inventory. Local data is an offline display/equipment cache. */
(function(root){
  'use strict';
  const MIGRATION_KEY='nyanChaseCoinMigrationV1';
  const PENDING_KEY='nyanChaseCoinPurchasePendingV1';
  const FIELDS=['ownedCatSkins','ownedDogSkins','ownedBoardThemes','ownedCardboards','ownedPaws'];
  const LEGACY_COIN_ITEMS=Object.freeze({ownedCatSkins:'cat_coin_01',ownedDogSkins:'dog_coin_01',
    ownedBoardThemes:'board_coin_01',ownedCardboards:'cardboard_coin_01',ownedPaws:'paw_coin_01'});
  let profile=null;
  function read(key){try{return JSON.parse(root.localStorage.getItem(key)||'null');}catch(_){return null;}}
  function write(key,value){root.localStorage.setItem(key,JSON.stringify(value));}
  function id(){return root.crypto.randomUUID().replace(/-/g,'');}
  function dailyFromProfile(server,local){
    const state=server.coinDaily;
    if(!state)return local;
    const rules=root.NyanProgressionModel.MISSIONS;
    return {date:state.date,updatedAt:Date.now(),allClearRewardClaimed:state.allClearClaimed===true,
      missions:rules.map(rule=>({id:rule.id,target:rule.target,progress:state.progress?.[rule.id]||0,
        completed:(state.progress?.[rule.id]||0)>=rule.target,claimed:state.claimed?.[rule.id]===true}))};
  }
  async function accept(server){
    if(!server?.coinMigration)return server;
    profile=server;
    await root.NyanPlayerData.applyCoinProfile(server);
    root.dispatchEvent?.(new root.CustomEvent('nyan-coin-balance-changed',{detail:{balance:server.serverNyanCoins}}));
    root.dispatchEvent?.(new root.CustomEvent('nyan-player-progress-changed'));
    return server;
  }
  async function migrate(post,local,server){
    if(server?.coinMigration){
      await accept(server);
      return server;
    }
    let pending=read(MIGRATION_KEY);
    if(!pending||pending.playerId!==local.playerId||pending.profileId!==server?.playerId){
      const previouslyMigrated=local.coinAuthority?.version===1;
      pending={playerId:local.playerId,profileId:server?.playerId,migrationId:`legacy:${id()}`,
        localCoins:previouslyMigrated?0:local.nyanCoins,
        ownership:Object.fromEntries(FIELDS.map(field=>[field,['default',...(!previouslyMigrated&&(local[field]||[]).includes(LEGACY_COIN_ITEMS[field])?[LEGACY_COIN_ITEMS[field]]:[])]])),
        daily:local.dailyMissionProgress};
      // Persist the exact claim before network I/O. A lost response reuses it.
      write(MIGRATION_KEY,pending);
    }
    const response=await post('coin-migration',pending);
    if(!response?.profile?.coinMigration)throw new Error('coin_migration_unconfirmed');
    await accept(response.profile);
    return response.profile;
  }
  async function ensure(){
    const base=root.NyanOnline?.API_BASE;
    if(!base)throw new Error('coin_service_unavailable');
    const result=await root.NyanOnlineIdentity.prepare(base);
    if(!result.profile?.coinMigration)throw new Error('coin_migration_required');
    return result.profile;
  }
  async function request(path,body){
    await ensure();
    const response=await root.NyanOnlineIdentity.request(root.NyanOnline.API_BASE,path,body);
    if(response?.profile)await accept(response.profile);
    return response;
  }
  async function requestRaw(path,body){
    // Used from player-data's serialized mutation; never re-enter its queue.
    const response=await root.NyanOnlineIdentity.request(root.NyanOnline.API_BASE,path,body);
    if(response?.profile)profile=response.profile;
    return response;
  }
  async function purchase(categoryId,itemId){
    await ensure();
    const itemKey=`${categoryId}:${itemId}`;
    let pending=read(PENDING_KEY);
    if(pending?.itemKey!==itemKey){
      pending={itemKey,requestId:`buy:${id()}`};write(PENDING_KEY,pending);
    }
    const response=await request('coin-purchase',{categoryId,itemId,requestId:pending.requestId});
    root.localStorage.removeItem(PENDING_KEY);
    return response;
  }
  function currentBalance(){return profile?.coinMigration?profile.serverNyanCoins:null;}
  function resetForDeletedProfile(){profile=null;root.localStorage.removeItem(MIGRATION_KEY);root.localStorage.removeItem(PENDING_KEY);}
  root.NyanCoinWallet={migrate,ensure,request,requestRaw,purchase,accept,currentBalance,resetForDeletedProfile,
    dailyFromProfile,getProfile:()=>profile};
})(globalThis);
