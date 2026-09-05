/* にゃんチェイス - Phase 2 コレクションカタログ
   見た目素材の解決だけを担当する。価格・ショップ・特殊能力は扱わない。
*/
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
      equippedField:"catSkinId"
    }),
    dogSkin:Object.freeze({
      id:"dogSkin",
      label:"柴犬スキン",
      section:"police",
      ownedField:"ownedDogSkins",
      equippedField:"dogSkinId"
    }),
    cardboard:Object.freeze({
      id:"cardboard",
      label:"ダンボール",
      section:"town",
      ownedField:"ownedCardboards",
      equippedField:"cardboardId"
    }),
    paw:Object.freeze({
      id:"paw",
      label:"肉球",
      section:"town",
      ownedField:"ownedPaws",
      equippedField:"pawId"
    }),
    boardTheme:Object.freeze({
      id:"boardTheme",
      label:"盤面テーマ",
      section:"town",
      ownedField:"ownedBoardThemes",
      equippedField:"boardThemeId"
    })
  });

  const DEFAULT_CAT_IMAGES=Object.freeze({
    collectionImage:"./assets/images/cpu_select_cat.png",
    profileImage:"./assets/images/cat.png",
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
    profileImage:"./assets/images/cpu_select_dogs.png",
    pieceImage:DEFAULT_DOG_PIECES,
    homeImage:"./assets/images/home_hero.png",
    resultWinImage:"./assets/images/cutin_police_win.jpg",
    resultLoseImage:"./assets/images/cutin_cat_win.jpg",
    moveEffect:null,
    foundFootprintEffect:null
  });

  const MYSTERY_ROOT="./assets/images/skins/mystery01";
  const ITEMS=Object.freeze([
    Object.freeze({
      id:"default",category:"catSkin",name:"デフォルト",
      preview:"./assets/images/cpu_select_cat.png",
      ...DEFAULT_CAT_IMAGES
    }),
    Object.freeze({
      id:"cat_kaitou",category:"catSkin",name:"怪盗にゃん",
      preview:`${MYSTERY_ROOT}/cat_kaitou_collection.png`,
      collectionImage:`${MYSTERY_ROOT}/cat_kaitou_collection.png`,
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
      preview:DEFAULT_DOG_IMAGES.collectionImage,
      ...DEFAULT_DOG_IMAGES
    }),
    Object.freeze({
      id:"dog_detective",category:"dogSkin",name:"探偵しば",
      preview:`${MYSTERY_ROOT}/dog_detective_collection.png`,
      collectionImage:`${MYSTERY_ROOT}/dog_detective_collection.png`,
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
    Object.freeze({id:"default",category:"cardboard",name:"デフォルト",preview:"./assets/images/box.png"}),
    Object.freeze({id:"default",category:"paw",name:"デフォルト",preview:"./assets/images/paw.png"}),
    Object.freeze({id:"default",category:"boardTheme",name:"デフォルト",preview:"./assets/images/bg_day.png"})
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

  return Object.freeze({
    CATEGORIES,
    ITEMS,
    getCategory,
    getItemsByCategory,
    getItem,
    isKnownItem
  });
});
