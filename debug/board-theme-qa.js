(function(root){
  "use strict";
  const location=root.location;
  const local=location?.protocol==="file:" ||
    (["http:","https:"].includes(location?.protocol) && ["localhost","127.0.0.1"].includes(location.hostname));
  if(!local || new URLSearchParams(location.search).get("nyanBoardThemeQa")!=="1")return;
  const catalog=root.NyanCollectionCatalog,base=root.NyanPlayerData;
  if(!catalog||!base)return;

  const allThemes=new URLSearchParams(location.search).get("allThemes")==="1";
  const ownedFields={catSkin:"ownedCatSkins",dogSkin:"ownedDogSkins",cardboard:"ownedCardboards",
    paw:"ownedPaws",boardTheme:"ownedBoardThemes",profileFrame:"ownedProfileFrames"};
  const ready=item=>item.materialStatus!=="pending" && item.assetStatus!=="placeholder";
  const unlocked={};
  for(const [category,field] of Object.entries(ownedFields)){
    unlocked[field]=catalog.getItemsByCategory(category).filter(ready).map(item=>item.id);
  }
  const purchasedThemes=new Set();
  const equipped={};
  let frame=null,coins=2000,favorite=undefined,profile=undefined;

  function presentationState(data){
    if(!data)return data;
    const owned={};
    for(const [category,field] of Object.entries(ownedFields)){
      const qaItems=category==="boardTheme"&&!allThemes?["default",...purchasedThemes]:unlocked[field];
      owned[field]=[...new Set([...(data[field]||[]),...qaItems])];
    }
    return {...data,...owned,nyanCoins:coins,
      equippedAppearance:{...data.equippedAppearance,...equipped},
      equippedProfileFrameId:frame||data.equippedProfileFrameId,
      favoriteCharacter:favorite===undefined?data.favoriteCharacter:favorite,
      profileCharacter:profile===undefined?data.profileCharacter:profile};
  }
  const snapshot=()=>presentationState(base.getSnapshot?.());
  const collectionPlayerData={
    async load(){return presentationState(await base.load());},
    getSnapshot:snapshot,
    async save(){return snapshot();},
    async purchaseCollectionItem(category,id){
      const item=catalog.getItem(category,id);
      if(category!=="boardTheme"||!item||!ready(item)||item.acquisitionType!=="coins"||!Number.isSafeInteger(item.priceCoins))throw new Error("item_not_coin_purchasable");
      if(coins<item.priceCoins)throw new Error("insufficient_coins");
      coins-=item.priceCoins;purchasedThemes.add(id);
      return snapshot();
    },
    async updateEquipment(category,id){
      const definition=catalog.getCategory(category),item=catalog.getItem(category,id);
      if(!definition||!item||!snapshot()[definition.ownedField]?.includes(id))throw new Error("not_owned");
      equipped[definition.equippedField]=id;
      return snapshot();
    },
    async updateFavoriteCharacter(category,id){favorite=id?{category,itemId:id}:null;return snapshot();},
    async updateProfileCharacter(category,id){profile=id?{category,itemId:id}:null;return snapshot();}
  };
  root.NyanBoardThemeQa=Object.freeze({active:true,allThemes,collectionPlayerData,presentationState,
    equipFrame(id){if(unlocked.ownedProfileFrames.includes(id))frame=id;return snapshot();},
    diagnostics(){return {coins,allThemes,ownedBoardThemes:snapshot()?.ownedBoardThemes||[]};}});
})(globalThis);
