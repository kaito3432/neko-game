/* にゃんチェイス - コレクションカタログ
   表示素材・入手方法・価格・同期範囲を一元管理する。 */
(function(root,factory){
  const api=factory();

  if(typeof module==="object" && module.exports){
    module.exports=api;
  }

  if(root){
    root.NyanCollectionCatalog=api;
  }
})(typeof globalThis!=="undefined" ? globalThis : this,()=>{
  "use strict";

  const CATEGORIES=Object.freeze({
    catSkin:Object.freeze({
      id:"catSkin",
      label:"ネコスキン",
      section:"cat",
      ownedField:"ownedCatSkins",
      equippedField:"catSkinId",
      equipmentScope:"appearance",
      opponentVisible:true
    }),
    dogSkin:Object.freeze({
      id:"dogSkin",
      label:"柴犬スキン",
      section:"police",
      ownedField:"ownedDogSkins",
      equippedField:"dogSkinId",
      equipmentScope:"appearance",
      opponentVisible:true
    }),
    cardboard:Object.freeze({
      id:"cardboard",
      label:"ダンボール",
      section:"town",
      ownedField:"ownedCardboards",
      equippedField:"cardboardId",
      equipmentScope:"appearance",
      opponentVisible:false
    }),
    paw:Object.freeze({
      id:"paw",
      label:"肉球",
      section:"town",
      ownedField:"ownedPaws",
      equippedField:"pawId",
      equipmentScope:"appearance",
      opponentVisible:false
    }),
    boardTheme:Object.freeze({
      id:"boardTheme",
      label:"盤面テーマ",
      section:"town",
      ownedField:"ownedBoardThemes",
      equippedField:"boardThemeId",
      equipmentScope:"appearance",
      opponentVisible:false
    }),
    profileFrame:Object.freeze({
      id:"profileFrame",label:"プロフィールフレーム",section:"rank",
      ownedField:"ownedProfileFrames",equippedField:"equippedProfileFrameId",equipmentScope:"onlineProfile",opponentVisible:true
    }),
  });

  const DEFAULT_CAT_IMAGES=Object.freeze({
    collectionImage:"./assets/images/cpu_select_cat.png",
    profileImage:"./assets/images/cat_play_normal.png",
    pieceImage:"./assets/images/cat_play_normal.png",
    homeImage:"./assets/images/home_hero.png",
    resultWinImage:"./assets/images/cutin_cat_win.jpg",
    resultLoseImage:"./assets/images/cutin_police_win.jpg",
    moveEffect:null,
    foundFootprintEffect:null
  });

  const DEFAULT_DOG_PIECES=Object.freeze({
    red:"./assets/images/dog_red.png",
    black:"./assets/images/dog_green.png",
    white:"./assets/images/dog_blue.png"
  });

  const DEFAULT_DOG_IMAGES=Object.freeze({
    collectionImage:"./assets/images/cpu_select_dogs.png",
    profileImage:"./assets/images/dog_default_profile.png",
    pieceImage:DEFAULT_DOG_PIECES,
    homeImage:"./assets/images/home_hero.png",
    resultWinImage:"./assets/images/cutin_police_win.jpg",
    resultLoseImage:"./assets/images/cutin_cat_win.jpg",
    moveEffect:null,
    foundFootprintEffect:null
  });

  const MYSTERY_ROOT="./assets/images/skins/mystery01";
  const NINJA_ROOT="./assets/images/skins/ninja01";
  const JAPANESE_COSMETIC_ROOT="./assets/images/cosmetics/japanese01";
  const RANK_FRAME_ROOT="./assets/images/rank/profile-frames";
  const CAT_NINJA_PLANNED_ASSETS=Object.freeze({
    collectionImage:`${NINJA_ROOT}/cat_ninja_collection.png`,
    profileImage:`${NINJA_ROOT}/cat_ninja_profile.png`,
    pieceImage:`${NINJA_ROOT}/cat_ninja_piece.png`,
    resultWinImage:`${NINJA_ROOT}/cat_ninja_result_win.png`,
    resultLoseImage:`${NINJA_ROOT}/cat_ninja_result_lose.png`,
    moveEffect:`${NINJA_ROOT}/cat_ninja_effect_smoke.png`,
    foundFootprintEffect:`${NINJA_ROOT}/cat_ninja_effect_found.png`,
    homeDecorImage:`${NINJA_ROOT}/cat_ninja_home_decor.png`,
    homeCharacterImage:`${NINJA_ROOT}/cat_ninja_home_character.png`,
    homeImage:`${NINJA_ROOT}/cat_ninja_home.png`
  });
  const DOG_SAMURAI_PLANNED_ASSETS=Object.freeze({
    collectionImage:`${NINJA_ROOT}/dog_samurai_collection.png`,
    profileImage:`${NINJA_ROOT}/dog_samurai_profile.png`,
    pieceImage:Object.freeze({
      red:`${NINJA_ROOT}/dog_samurai_red_piece.png`,
      black:`${NINJA_ROOT}/dog_samurai_black_piece.png`,
      white:`${NINJA_ROOT}/dog_samurai_white_piece.png`
    }),
    resultWinImage:`${NINJA_ROOT}/dog_samurai_result_win.png`,
    resultLoseImage:`${NINJA_ROOT}/dog_samurai_result_lose.png`,
    moveEffect:`${NINJA_ROOT}/dog_samurai_effect_slash.png`,
    foundFootprintEffect:`${NINJA_ROOT}/dog_samurai_effect_found.png`,
    homeDecorImage:`${NINJA_ROOT}/dog_samurai_home_decor.png`,
    homeCharacterImage:`${NINJA_ROOT}/dog_samurai_home_character.png`,
    homeImage:`${NINJA_ROOT}/dog_samurai_home.png`
  });
  const ITEMS=Object.freeze([
    Object.freeze({
      id:"default",category:"catSkin",name:"デフォルト",
      preview:"./assets/images/cpu_select_cat.png",acquisitionType:"default",rarity:"Common",
      ...DEFAULT_CAT_IMAGES
    }),
    Object.freeze({
      id:"cat_kaitou",category:"catSkin",name:"怪盗にゃん",acquisitionType:"achievement",rarity:"Rare",
      preview:`${MYSTERY_ROOT}/cat_kaitou_collection_cutout.png`,
      collectionImage:`${MYSTERY_ROOT}/cat_kaitou_collection_cutout.png`,
      silhouetteImage:`${MYSTERY_ROOT}/cat_kaitou_collection_locked.png`,
      lockedProfileImage:`${MYSTERY_ROOT}/cat_kaitou_profile_locked.png`,
      unlockCondition:Object.freeze({progressKey:"cat_kaitou",target:10,text:"ネコでCPU（つよい）から10回逃げ切る"}),
      profileImage:`${MYSTERY_ROOT}/cat_kaitou_profile.png`,
      pieceImage:`${MYSTERY_ROOT}/cat_kaitou_piece.png`,
      homeImage:`${MYSTERY_ROOT}/cat_kaitou_home.png`,
      resultWinImage:`${MYSTERY_ROOT}/cat_kaitou_result_win.png`,
      resultLoseImage:`${MYSTERY_ROOT}/cat_kaitou_result_lose.png`,
      moveEffect:`${MYSTERY_ROOT}/cat_kaitou_effect_cards.png`,
      foundFootprintEffect:`${MYSTERY_ROOT}/cat_kaitou_effect_gem.png`
    }),
    Object.freeze({
      id:"default",category:"dogSkin",name:"デフォルト",
      preview:DEFAULT_DOG_IMAGES.collectionImage,acquisitionType:"default",rarity:"Common",
      ...DEFAULT_DOG_IMAGES
    }),
    Object.freeze({
      id:"dog_detective",category:"dogSkin",name:"探偵しば",acquisitionType:"achievement",rarity:"Rare",
      preview:`${MYSTERY_ROOT}/dog_detective_collection.png`,
      collectionImage:`${MYSTERY_ROOT}/dog_detective_collection.png`,
      silhouetteImage:`${MYSTERY_ROOT}/dog_detective_collection_locked.png`,
      lockedProfileImage:`${MYSTERY_ROOT}/dog_detective_profile_locked.png`,
      unlockCondition:Object.freeze({progressKey:"dog_detective",target:10,text:"しば犬でCPU（つよい）を10回確保"}),
      profileImage:`${MYSTERY_ROOT}/dog_detective_profile.png`,
      pieceImage:Object.freeze({
        red:`${MYSTERY_ROOT}/dog_detective_red_piece.png`,
        black:`${MYSTERY_ROOT}/dog_detective_black_piece.png`,
        white:`${MYSTERY_ROOT}/dog_detective_white_piece.png`
      }),
      cardImage:Object.freeze({
        red:`${MYSTERY_ROOT}/dog_detective_red_piece.png`,
        black:`${MYSTERY_ROOT}/dog_detective_black_piece.png`,
        white:`${MYSTERY_ROOT}/dog_detective_white_piece.png`
      }),
      homeImage:`${MYSTERY_ROOT}/dog_detective_home.png`,
      resultWinImage:`${MYSTERY_ROOT}/dog_detective_result_win.png`,
      resultLoseImage:`${MYSTERY_ROOT}/dog_detective_result_lose.png`,
      moveEffect:`${MYSTERY_ROOT}/dog_detective_effect_clue.png`,
      foundFootprintEffect:`${MYSTERY_ROOT}/dog_detective_effect_search.png`
    }),
    Object.freeze({id:"default",category:"cardboard",name:"デフォルト",preview:"./assets/images/box.png",cardboardImage:"./assets/images/box.png",acquisitionType:"default",rarity:"Common"}),
    Object.freeze({id:"default",category:"paw",name:"デフォルト",preview:"./assets/images/paw.png",pawImage:"./assets/images/paw.png",acquisitionType:"default",rarity:"Common"}),
    Object.freeze({id:"default",category:"boardTheme",name:"デフォルト",preview:"./assets/images/bg_day.png",boardImage:"./assets/images/bg_day.png",acquisitionType:"default",rarity:"Common"}),
    // Production art passed display QA and is available for local coin-purchase verification.
    Object.freeze({
      id:"cat_coin_01",category:"catSkin",name:"忍者にゃん",
      preview:CAT_NINJA_PLANNED_ASSETS.collectionImage,
      ...CAT_NINJA_PLANNED_ASSETS,
      acquisitionType:"coins",currency:"nyanCoins",priceCoins:500,rarity:"Rare",
      materialStatus:"ready",assetStatus:"ready",plannedAssets:CAT_NINJA_PLANNED_ASSETS
    }),
    // Production art passed display QA and is available for local coin-purchase verification.
    Object.freeze({
      id:"dog_coin_01",category:"dogSkin",name:"侍しば（3匹セット）",
      preview:DOG_SAMURAI_PLANNED_ASSETS.collectionImage,
      ...DOG_SAMURAI_PLANNED_ASSETS,
      cardImage:DOG_SAMURAI_PLANNED_ASSETS.pieceImage,
      acquisitionType:"coins",currency:"nyanCoins",priceCoins:500,rarity:"Rare",
      materialStatus:"ready",assetStatus:"ready",plannedAssets:DOG_SAMURAI_PLANNED_ASSETS
    }),
    Object.freeze({
      id:"cardboard_coin_01",category:"cardboard",name:"忍者屋敷の木箱",
      preview:`${JAPANESE_COSMETIC_ROOT}/cardboard_ninja_crate.png`,
      cardboardImage:`${JAPANESE_COSMETIC_ROOT}/cardboard_ninja_crate.png`,
      acquisitionType:"coins",currency:"nyanCoins",priceCoins:30,rarity:"Common",
      materialStatus:"ready",assetStatus:"ready"
    }),
    Object.freeze({
      id:"paw_coin_01",category:"paw",name:"墨の足跡",
      preview:`${JAPANESE_COSMETIC_ROOT}/paw_sumi.png`,
      pawImage:`${JAPANESE_COSMETIC_ROOT}/paw_sumi.png`,
      acquisitionType:"coins",currency:"nyanCoins",priceCoins:30,rarity:"Common",
      materialStatus:"ready",assetStatus:"ready"
    }),
    Object.freeze({
      id:"board_coin_01",category:"boardTheme",name:"月夜の城下町",
      preview:`${JAPANESE_COSMETIC_ROOT}/board_moonlit_castle_town.png`,
      boardImage:`${JAPANESE_COSMETIC_ROOT}/board_moonlit_castle_town.png`,
      acquisitionType:"coins",currency:"nyanCoins",priceCoins:60,rarity:"Common",
      materialStatus:"ready",assetStatus:"ready"
    }),
    Object.freeze({id:"cat_master_reward_pending",category:"catSkin",name:"マスター限定ネコスキン",acquisitionType:"masterRankReward",rarity:"Legendary",materialStatus:"pending"}),
    Object.freeze({id:"dog_master_reward_pending",category:"dogSkin",name:"マスター限定柴犬スキン（3匹セット）",acquisitionType:"masterRankReward",rarity:"Legendary",materialStatus:"pending"}),
    ...["bronze","silver","gold","platinum","diamond","master"].map((rank,index)=>Object.freeze({
      id:`rank_${rank}`,category:"profileFrame",rank,
      name:`${({bronze:"ブロンズ",silver:"シルバー",gold:"ゴールド",platinum:"プラチナ",diamond:"ダイヤモンド",master:"マスター"})[rank]}フレーム`,
      preview:`${RANK_FRAME_ROOT}/rank_${rank}_frame.png`,
      collectionImage:`${RANK_FRAME_ROOT}/rank_${rank}_frame.png`,
      profileImage:`${RANK_FRAME_ROOT}/rank_${rank}_frame.png`,
      frameImage:`${RANK_FRAME_ROOT}/rank_${rank}_frame.png`,
      lockedImage:null,
      unlockCondition:Object.freeze({rank,minRp:[0,100,200,350,550,800][index],text:rank==="bronze"?"初期所持":`${[0,100,200,350,550,800][index]} RP到達で永久解放`}),
      acquisitionType:"rankReward",rarity:rank==="master"?"Legendary":rank==="bronze"?"Common":"Epic",
      materialStatus:"ready",assetStatus:"ready"
    }))
  ]);

  function getCategory(categoryId){
    return CATEGORIES[categoryId] || null;
  }

  function getItemsByCategory(categoryId){
    return ITEMS.filter(item=>item.category===categoryId);
  }

  function getItem(categoryId,itemId){
    return ITEMS.find(item=>item.category===categoryId && item.id===itemId) || null;
  }

  function isKnownItem(categoryId,itemId){
    return getItem(categoryId,itemId)!==null;
  }

  function acquisitionLabel(item){
    if(item?.acquisitionType==="coins")return "にゃんコイン";
    if(item?.acquisitionType==="masterRankReward")return "ランク報酬（マスター限定）";
    if(item?.acquisitionType==="rankReward")return "ランク報酬";
    if(item?.acquisitionType==="achievement")return "プレイ実績";
    return "初期所持";
  }

  function isOpponentVisible(categoryId){return getCategory(categoryId)?.opponentVisible===true;}
  function isLocalOnly(categoryId){return ["cardboard","paw","boardTheme"].includes(categoryId);}

  return Object.freeze({
    CATEGORIES,
    ITEMS,
    getCategory,
    getItemsByCategory,
    getItem,
    isKnownItem,
    acquisitionLabel,
    isOpponentVisible,
    isLocalOnly
  });
});
