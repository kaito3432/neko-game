/* にゃんチェイス - Phase 2A コレクションカタログ
   現在存在するdefault見た目だけを登録する。価格・ショップ・特殊能力は扱わない。
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

  const ITEMS=Object.freeze([
    Object.freeze({id:"default",category:"catSkin",name:"デフォルト",preview:"./assets/images/cat_play_normal.png"}),
    Object.freeze({id:"default",category:"dogSkin",name:"デフォルト",preview:"./assets/images/cpu_select_dogs.png"}),
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
