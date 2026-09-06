/* にゃんチェイス - Phase 1 プレイヤーデータ基盤
   ゲーム進行には依存せず、端末キャッシュと将来のサーバー保存を分離する。
*/
(function(root, factory){
  const model=typeof module==="object" && module.exports ? require("./progression-model.js") : root.NyanProgressionModel;
  const unlockSync=typeof module==="object" && module.exports ? require("./cpu-unlock-sync.js") : root.NyanCpuUnlockSync;
  const api=factory(root,model,unlockSync);

  if(typeof module==="object" && module.exports){
    module.exports=api;
  }

  if(root){
    root.NyanPlayerData=api;
  }
})(typeof globalThis!=="undefined" ? globalThis : this, (root,Progress,UnlockSync)=>{
  "use strict";

  const CURRENT_VERSION=5;
  const STORAGE_KEYS=Object.freeze({
    playerId:"nyanChasePlayerId",
    playerData:"nyanChasePlayerData",
    pendingBattles:"nyanChasePendingBattles"
  });

  const DEFAULT_ITEM_ID="default";
  const PLAYER_ID_PATTERN=/^ncp_[a-zA-Z0-9_-]{16,128}$/;
  const EQUIPMENT_CATEGORIES=Object.freeze({
    catSkin:Object.freeze({ownedField:"ownedCatSkins",equippedField:"catSkinId"}),
    dogSkin:Object.freeze({ownedField:"ownedDogSkins",equippedField:"dogSkinId"}),
    cardboard:Object.freeze({ownedField:"ownedCardboards",equippedField:"cardboardId"}),
    paw:Object.freeze({ownedField:"ownedPaws",equippedField:"pawId"}),
    boardTheme:Object.freeze({ownedField:"ownedBoardThemes",equippedField:"boardThemeId"})
  });

  function isPlainObject(value){
    if(!value || typeof value!=="object" || Array.isArray(value)) return false;
    const prototype=Object.getPrototypeOf(value);
    return prototype===Object.prototype || prototype===null;
  }

  function safeString(value,fallback){
    return typeof value==="string" && value.length>0 ? value : fallback;
  }

  function safeNonNegativeInteger(value,fallback=0){
    const number=Number(value);
    return Number.isSafeInteger(number) && number>=0 ? number : fallback;
  }

  function safeNullableTimestamp(value){
    if(value===null || value==="") return null;
    const timestamp=Number(value);
    return Number.isSafeInteger(timestamp) && timestamp>=0 ? timestamp : null;
  }

  function safeOwnedItems(value){
    const items=Array.isArray(value)
      ? value.filter(item=>typeof item==="string" && item.length>0)
      : [];

    return [...new Set([DEFAULT_ITEM_ID,...items])];
  }

  function safeEquippedItem(value,ownedItems){
    const itemId=safeString(value,DEFAULT_ITEM_ID);
    return ownedItems.includes(itemId) ? itemId : DEFAULT_ITEM_ID;
  }

  function safeCharacterSelection(value,ownedCatSkins,ownedDogSkins){
    if(!isPlainObject(value)) return null;
    const category=value.category;
    const itemId=value.itemId;
    const ownedItems=category==="catSkin"
      ? ownedCatSkins
      : category==="dogSkin"
        ? ownedDogSkins
        : null;
    if(!ownedItems || typeof itemId!=="string" || !ownedItems.includes(itemId)){
      return null;
    }
    return {category,itemId};
  }

  function safeProgressObject(value){
    if(!isPlainObject(value)) return {};

    try{
      const copy=JSON.parse(JSON.stringify(value));
      return isPlainObject(copy) ? copy : {};
    }catch(_){
      return {};
    }
  }

  function createDefaultData(playerId){
    return {
      version:CURRENT_VERSION,
      playerId,
      nyanCoins:0,
      ownedCatSkins:[DEFAULT_ITEM_ID],
      ownedDogSkins:[DEFAULT_ITEM_ID],
      ownedCardboards:[DEFAULT_ITEM_ID],
      ownedPaws:[DEFAULT_ITEM_ID],
      ownedBoardThemes:[DEFAULT_ITEM_ID],
      equippedAppearance:{
        catSkinId:DEFAULT_ITEM_ID,
        dogSkinId:DEFAULT_ITEM_ID,
        cardboardId:DEFAULT_ITEM_ID,
        pawId:DEFAULT_ITEM_ID,
        boardThemeId:DEFAULT_ITEM_ID
      },
      favoriteCharacter:null,
      profileCharacter:null,
      dailyMissionProgress:Progress.normalizeDaily(null),
      skinUnlockProgress:Progress.normalizeUnlocks(null),
      cpuUnlockSync:{},
      battleReceipts:[],
      challengeProgress:{},
      rankPoints:0,
      currentRank:"bronze",
      onlineWins:0,
      onlineLosses:0,
      catMatches:0,
      policeMatches:0,
      disconnectCount:0,
      rankPenaltyUntil:null
    };
  }

  function normalizeDailyMissionProgress(value){
    return Progress.normalizeDaily(value);
  }

  function normalizeData(value,playerId){
    const source=isPlainObject(value) ? value : {};
    const defaults=createDefaultData(playerId);
    const equipped=isPlainObject(source.equippedAppearance)
      ? source.equippedAppearance
      : {};
    const ownedCatSkins=safeOwnedItems(source.ownedCatSkins);
    const ownedDogSkins=safeOwnedItems(source.ownedDogSkins);
    const ownedCardboards=safeOwnedItems(source.ownedCardboards);
    const ownedPaws=safeOwnedItems(source.ownedPaws);
    const ownedBoardThemes=safeOwnedItems(source.ownedBoardThemes);

    return {
      version:CURRENT_VERSION,
      playerId,
      nyanCoins:safeNonNegativeInteger(source.nyanCoins),
      ownedCatSkins,
      ownedDogSkins,
      ownedCardboards,
      ownedPaws,
      ownedBoardThemes,
      equippedAppearance:{
        catSkinId:safeEquippedItem(equipped.catSkinId,ownedCatSkins),
        dogSkinId:safeEquippedItem(equipped.dogSkinId,ownedDogSkins),
        cardboardId:safeEquippedItem(equipped.cardboardId,ownedCardboards),
        pawId:safeEquippedItem(equipped.pawId,ownedPaws),
        boardThemeId:safeEquippedItem(equipped.boardThemeId,ownedBoardThemes)
      },
      favoriteCharacter:safeCharacterSelection(
        source.favoriteCharacter,
        ownedCatSkins,
        ownedDogSkins
      ),
      profileCharacter:safeCharacterSelection(
        source.profileCharacter,
        ownedCatSkins,
        ownedDogSkins
      ),
      dailyMissionProgress:normalizeDailyMissionProgress(source.dailyMissionProgress || source.dailyMissions),
      skinUnlockProgress:Progress.normalizeUnlocks(source.skinUnlockProgress),
      cpuUnlockSync:UnlockSync.normalize(source),
      battleReceipts:Array.isArray(source.battleReceipts) ? [...new Set(source.battleReceipts.filter(id=>typeof id==="string" && /^[a-zA-Z0-9_-]{8,160}$/.test(id)))] : [],
      challengeProgress:safeProgressObject(source.challengeProgress),
      rankPoints:safeNonNegativeInteger(source.rankPoints),
      currentRank:safeString(source.currentRank,defaults.currentRank),
      onlineWins:safeNonNegativeInteger(source.onlineWins),
      onlineLosses:safeNonNegativeInteger(source.onlineLosses),
      catMatches:safeNonNegativeInteger(source.catMatches),
      policeMatches:safeNonNegativeInteger(source.policeMatches),
      disconnectCount:safeNonNegativeInteger(source.disconnectCount),
      rankPenaltyUntil:safeNullableTimestamp(source.rankPenaltyUntil)
    };
  }

  function migrateData(value,playerId){
    // v5: completed local CPU unlocks gain retryable sync status, assets stay intact.
    return normalizeData(value,playerId);
  }

  function generatePlayerId(){
    let uniquePart="";

    try{
      if(root?.crypto?.randomUUID){
        uniquePart=root.crypto.randomUUID().replace(/-/g,"");
      }else if(root?.crypto?.getRandomValues){
        const bytes=new Uint8Array(16);
        root.crypto.getRandomValues(bytes);
        uniquePart=Array.from(bytes,byte=>byte.toString(16).padStart(2,"0")).join("");
      }
    }catch(_){
      uniquePart="";
    }

    if(!uniquePart){
      uniquePart=`${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    }

    return `ncp_${uniquePart}`;
  }

  function isValidPlayerId(value){
    return typeof value==="string" && PLAYER_ID_PATTERN.test(value);
  }

  function createStorageAdapter(storage){
    return {
      read(key){
        try{
          return {ok:true,value:storage?.getItem(key) ?? null,error:null};
        }catch(error){
          return {ok:false,value:null,error};
        }
      },
      write(key,value){
        try{
          if(!storage) throw new Error("storage_unavailable");
          storage.setItem(key,value);
          return {ok:true,error:null};
        }catch(error){
          return {ok:false,error};
        }
      }
    };
  }

  function createStore({storage,remoteProvider=null,now=()=>Date.now()}={}){
    const local=storage?.read && storage?.write
      ? storage
      : createStorageAdapter(storage);
    let remote=remoteProvider;
    let currentData=null;
    let lastStatus={source:"uninitialized",error:null};
    let queue=Promise.resolve();
    function serial(operation){
      const run=async()=>{
        // Refresh across tabs before deriving a mutation from the existing data.
        if(currentData && !remote && lastStatus.source!=="memory") currentData=readLocal(currentData.playerId);
        return operation();
      };
      const locked=()=>root?.navigator?.locks?.request
        ? root.navigator.locks.request("nyan-player-data",run) : run();
      const result=queue.then(locked,locked);
      queue=result.catch(()=>{});
      return result;
    }

    function ensurePlayerId(){
      const saved=local.read(STORAGE_KEYS.playerId);
      if(saved.ok && isValidPlayerId(saved.value)) return saved.value;

      const playerId=generatePlayerId();
      const result=local.write(STORAGE_KEYS.playerId,playerId);
      if(!result.ok){
        lastStatus={source:"memory",error:result.error};
      }
      return playerId;
    }

    function readLocal(playerId){
      const saved=local.read(STORAGE_KEYS.playerData);
      if(!saved.ok){
        lastStatus={source:"memory",error:saved.error};
        return createDefaultData(playerId);
      }

      if(saved.value===null) return createDefaultData(playerId);

      try{
        return migrateData(JSON.parse(saved.value),playerId);
      }catch(error){
        lastStatus={source:"recovered",error};
        return createDefaultData(playerId);
      }
    }

    function cache(data,source,error=null){
      currentData=normalizeData(data,data.playerId);
      const result=local.write(STORAGE_KEYS.playerData,JSON.stringify(currentData));
      lastStatus={
        source:result.ok ? source : "memory",
        error:result.ok ? error : result.error
      };
      return currentData;
    }

    async function load(){
      const playerId=ensurePlayerId();
      const localData=readLocal(playerId);

      if(remote && typeof remote.load==="function"){
        try{
          const serverData=await remote.load(playerId);
          if(!isPlainObject(serverData)) throw new Error("invalid_server_player_data");
          return cache(normalizeData(serverData,playerId),"server");
        }catch(error){
          currentData=localData;
          lastStatus={source:"local-cache",error};
          return currentData;
        }
      }

      return cache(localData,lastStatus.source==="recovered" ? "recovered" : "local");
    }

    async function save(value){
      const playerId=currentData?.playerId || ensurePlayerId();
      const candidate=normalizeData(value,playerId);

      if(remote){
        if(typeof remote.save!=="function"){
          lastStatus={source:"local-cache",error:new Error("server_save_unavailable")};
          return currentData || readLocal(playerId);
        }

        try{
          // サーバー導入後は、サーバーが返したデータだけを正としてキャッシュする。
          const serverData=await remote.save(playerId,candidate);
          if(!isPlainObject(serverData)) throw new Error("invalid_server_player_data");
          return cache(normalizeData(serverData,playerId),"server");
        }catch(error){
          const fallback=currentData || readLocal(playerId);
          lastStatus={source:"local-cache",error};
          return fallback;
        }
      }

      return cache(candidate,"local");
    }

    async function updateEquipment(category,itemId){
      const definition=EQUIPMENT_CATEGORIES[category];
      if(!definition) throw new Error("invalid_equipment_category");
      if(typeof itemId!=="string" || itemId.length===0){
        throw new Error("invalid_equipment_item");
      }

      const base=currentData || await load();
      if(!base[definition.ownedField].includes(itemId)){
        throw new Error("equipment_item_not_owned");
      }

      const candidate={
        ...base,
        equippedAppearance:{
          ...base.equippedAppearance,
          [definition.equippedField]:itemId
        }
      };

      return save(candidate);
    }

    async function updateFavoriteCharacter(category,itemId){
      if(category!=="catSkin" && category!=="dogSkin"){
        throw new Error("invalid_favorite_category");
      }
      const base=currentData || await load();
      if(itemId===null){
        return save({...base,favoriteCharacter:null});
      }
      if(typeof itemId!=="string" || itemId.length===0){
        throw new Error("invalid_favorite_item");
      }

      const definition=EQUIPMENT_CATEGORIES[category];
      if(!base[definition.ownedField].includes(itemId)){
        throw new Error("favorite_item_not_owned");
      }

      return save({...base,favoriteCharacter:{category,itemId}});
    }

    async function updateProfileCharacter(category,itemId){
      if(category!=="catSkin" && category!=="dogSkin"){
        throw new Error("invalid_profile_category");
      }
      const base=currentData || await load();
      if(itemId===null){
        return save({...base,profileCharacter:null});
      }
      if(typeof itemId!=="string" || itemId.length===0){
        throw new Error("invalid_profile_item");
      }

      const definition=EQUIPMENT_CATEGORIES[category];
      if(!base[definition.ownedField].includes(itemId)){
        throw new Error("profile_item_not_owned");
      }

      return save({...base,profileCharacter:{category,itemId}});
    }

    function setRemoteProvider(provider){
      remote=provider || null;
    }

    function getSnapshot(){
      return currentData ? normalizeData(currentData,currentData.playerId) : null;
    }

    function getStatus(){
      return {...lastStatus};
    }

    function pendingBattles(){
      try{
        const read=local.read(STORAGE_KEYS.pendingBattles);
        if(!read.ok) throw read.error;
        const values=JSON.parse(read.value || "[]");
        return Array.isArray(values) ? values.filter(v=>{
          try{Progress.validateBattle(v);return true;}catch(_){return false;}
        }) : [];
      }catch(_){return [];}
    }
    function writePending(values){
      const result=local.write(STORAGE_KEYS.pendingBattles,JSON.stringify(values));
      if(!result.ok) throw result.error || new Error("pending_save_failed");
    }
    function persistProgress(candidate){
      const data=normalizeData(candidate,candidate.playerId);
      const result=local.write(STORAGE_KEYS.playerData,JSON.stringify(data));
      if(!result.ok){
        lastStatus={source:"memory",error:result.error};
        throw result.error || new Error("progress_save_failed");
      }
      currentData=data;
      lastStatus={source:"local",error:null};
      return getSnapshot();
    }
    async function progressCommand(method,payload,apply){
      const base=currentData || await load();
      if(remote){
        // Send intent and an idempotency key, never a client-calculated balance/ownership.
        if(typeof remote[method]!=="function") throw new Error("progress_provider_unavailable");
        const server=await remote[method](base.playerId,payload);
        if(!isPlainObject(server)) throw new Error("invalid_server_player_data");
        return cache(normalizeData(server,base.playerId),"server");
      }
      return persistProgress(apply(base));
    }
    async function recordPendingBattle(event){
      if(event.source==='randomMatch' && !remote) {
        if(typeof root?.NyanOnline?.verifyResult!=='function') throw new Error('online_result_verifier_unavailable');
        // Always re-fetch the authenticated server receipt, including outbox replay.
        const verified=Progress.validateBattle(await root.NyanOnline.verifyResult(event));
        if(verified.source!=='randomMatch' || verified.battleId!==event.battleId) throw new Error('invalid_online_receipt');
        event=verified;
      }
      const data=await progressCommand("recordDailyMissionBattle",event,base=>Progress.recordBattle(base,event,now()));
      if(!data.battleReceipts.includes(event.battleId)) throw new Error("battle_not_acknowledged");
      writePending(pendingBattles().filter(b=>b.battleId!==event.battleId));
      if(event.source==='cpu' && Object.values(data.cpuUnlockSync).includes('pending')){
        // Local unlock+pending flag were already committed atomically. Networking
        // must never block the game or roll back a local unlock on failure.
        root.queueMicrotask(()=>Promise.resolve().then(()=>root.NyanOnline?.syncCpuUnlocks?.()).catch(()=>{}));
      }
      return data;
    }
    function acknowledgeCpuUnlock(achievement,response){
      return serial(async()=>{
        if(!UnlockSync.confirms(achievement,response))throw new Error('unlock_not_acknowledged');
        const base=currentData || await load();
        if(base.cpuUnlockSync[achievement]!=='pending')return getSnapshot();
        if(remote)throw new Error('cpu_unlock_sync_remote_managed');
        return persistProgress({...base,cpuUnlockSync:{...base.cpuUnlockSync,[achievement]:'synced'}});
      });
    }
    function recordDailyMissionBattle(value){
      let event;
      try{
        event=Progress.validateBattle(value);
        if(!["cpu","randomMatch"].includes(event.source)) return Promise.resolve(getSnapshot());
        // Journal immediately at confirmed match completion, before any cut-in/ad/UI awaits.
        const pending=pendingBattles();
        if(!pending.some(b=>b.battleId===event.battleId)) writePending([...pending,event]);
      }catch(error){return Promise.reject(error);}
      return serial(()=>recordPendingBattle(event));
    }
    function retryPendingBattles(){
      return serial(async()=>{
        for(const event of pendingBattles()) await recordPendingBattle(event);
        return getSnapshot();
      });
    }
    function refreshDailyMissions(){
      return serial(async()=>{
        const base=await load();
        if(remote) return base;
        const next=Progress.rollover(base,now());
        return JSON.stringify(next.dailyMissionProgress)===JSON.stringify(base.dailyMissionProgress)
          ? base : persistProgress(next);
      });
    }
    function claimDailyReward(date,missionId){
      return serial(()=>progressCommand("claimDailyReward",{
        date,missionId,requestId:`daily:${date}:${missionId}`
      },base=>Progress.claim(base,{date,missionId},now())));
    }
    return {
      load:()=>serial(load),save:value=>serial(()=>save(value)),
      updateEquipment:(...args)=>serial(()=>updateEquipment(...args)),
      updateFavoriteCharacter:(...args)=>serial(()=>updateFavoriteCharacter(...args)),
      updateProfileCharacter:(...args)=>serial(()=>updateProfileCharacter(...args)),
      recordDailyMissionBattle,retryPendingBattles,refreshDailyMissions,claimDailyReward,acknowledgeCpuUnlock,
      setRemoteProvider,getSnapshot,getStatus
    };
  }

  let browserStorage=null;
  try{
    browserStorage=root?.localStorage || null;
  }catch(_){
    browserStorage=null;
  }

  const defaultStore=createStore({storage:browserStorage});
  const ready=defaultStore.load().catch(()=>null);

  return Object.freeze({
    CURRENT_VERSION,
    STORAGE_KEYS,
    EQUIPMENT_CATEGORIES,
    createDefaultData,
    normalizeData,
    migrateData,
    generatePlayerId,
    isValidPlayerId,
    createStorageAdapter,
    createStore,
    ready,
    load:defaultStore.load,
    save:defaultStore.save,
    updateEquipment:defaultStore.updateEquipment,
    updateFavoriteCharacter:defaultStore.updateFavoriteCharacter,
    updateProfileCharacter:defaultStore.updateProfileCharacter,
    setRemoteProvider:defaultStore.setRemoteProvider,
    getSnapshot:defaultStore.getSnapshot,
    getStatus:defaultStore.getStatus,
    recordDailyMissionBattle:defaultStore.recordDailyMissionBattle,
    retryPendingBattles:defaultStore.retryPendingBattles,
    refreshDailyMissions:defaultStore.refreshDailyMissions,
    claimDailyReward:defaultStore.claimDailyReward
    ,acknowledgeCpuUnlock:defaultStore.acknowledgeCpuUnlock
  });
});
