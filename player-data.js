/* にゃんチェイス - Phase 1 プレイヤーデータ基盤
   ゲーム進行には依存せず、端末キャッシュと将来のサーバー保存を分離する。
*/
(function(root, factory){
  const api=factory(root);

  if(typeof module==="object" && module.exports){
    module.exports=api;
  }

  if(root){
    root.NyanPlayerData=api;
  }
})(typeof globalThis!=="undefined" ? globalThis : this, root=>{
  "use strict";

  const CURRENT_VERSION=1;
  const STORAGE_KEYS=Object.freeze({
    playerId:"nyanChasePlayerId",
    playerData:"nyanChasePlayerData"
  });

  const DEFAULT_ITEM_ID="default";
  const PLAYER_ID_PATTERN=/^ncp_[a-zA-Z0-9_-]{16,128}$/;

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
      dailyMissionProgress:{
        date:null,
        missions:[],
        allClearRewardClaimed:false
      },
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
    const source=isPlainObject(value) ? value : {};
    const missions=Array.isArray(source.missions)
      ? source.missions
          .filter(isPlainObject)
          .map(safeProgressObject)
      : [];

    return {
      date:typeof source.date==="string" ? source.date : null,
      missions,
      allClearRewardClaimed:source.allClearRewardClaimed===true
    };
  }

  function normalizeData(value,playerId){
    const source=isPlainObject(value) ? value : {};
    const defaults=createDefaultData(playerId);
    const equipped=isPlainObject(source.equippedAppearance)
      ? source.equippedAppearance
      : {};

    return {
      version:CURRENT_VERSION,
      playerId,
      nyanCoins:safeNonNegativeInteger(source.nyanCoins),
      ownedCatSkins:safeOwnedItems(source.ownedCatSkins),
      ownedDogSkins:safeOwnedItems(source.ownedDogSkins),
      ownedCardboards:safeOwnedItems(source.ownedCardboards),
      ownedPaws:safeOwnedItems(source.ownedPaws),
      ownedBoardThemes:safeOwnedItems(source.ownedBoardThemes),
      equippedAppearance:{
        catSkinId:safeString(equipped.catSkinId,defaults.equippedAppearance.catSkinId),
        dogSkinId:safeString(equipped.dogSkinId,defaults.equippedAppearance.dogSkinId),
        cardboardId:safeString(equipped.cardboardId,defaults.equippedAppearance.cardboardId),
        pawId:safeString(equipped.pawId,defaults.equippedAppearance.pawId),
        boardThemeId:safeString(equipped.boardThemeId,defaults.equippedAppearance.boardThemeId)
      },
      dailyMissionProgress:normalizeDailyMissionProgress(source.dailyMissionProgress),
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
    // Phase 1の初期版。今後はversionごとの変換をこの境界に追加する。
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
          storage?.setItem(key,value);
          return {ok:true,error:null};
        }catch(error){
          return {ok:false,error};
        }
      }
    };
  }

  function createStore({storage,remoteProvider=null}={}){
    const local=storage?.read && storage?.write
      ? storage
      : createStorageAdapter(storage);
    let remote=remoteProvider;
    let currentData=null;
    let lastStatus={source:"uninitialized",error:null};

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

    function setRemoteProvider(provider){
      remote=provider || null;
    }

    function getSnapshot(){
      return currentData ? normalizeData(currentData,currentData.playerId) : null;
    }

    function getStatus(){
      return {...lastStatus};
    }

    return {load,save,setRemoteProvider,getSnapshot,getStatus};
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
    setRemoteProvider:defaultStore.setRemoteProvider,
    getSnapshot:defaultStore.getSnapshot,
    getStatus:defaultStore.getStatus
  });
});
