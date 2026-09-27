(function(root){
  "use strict";
  if(root.NYAN_KING_QA_BUILD!==13)return;
  if(!root.NyanCollectionCatalog||!root.NyanPlayerData||root.__KING_SKIN_PLAY_QA__)return;
  const ITEM_ID="cat_master_s01_king";
  const baseCatalog=root.NyanCollectionCatalog;
  const basePlayerData=root.NyanPlayerData;
  const item=baseCatalog.getItem("catSkin",ITEM_ID);
  if(!item)return;
  const isReady=entry=>entry.id==="default"||(
    entry.materialStatus!=="pending"&&entry.assetStatus!=="placeholder"&&Boolean(entry.profileImage)&&Boolean(entry.pieceImage));
  const allCatSkins=baseCatalog.getItemsByCategory("catSkin").filter(isReady).map(entry=>entry.id);
  const allDogSkins=baseCatalog.getItemsByCategory("dogSkin").filter(isReady).map(entry=>entry.id);
  const allProfileFrames=baseCatalog.getItemsByCategory("profileFrame")
    .filter(entry=>entry.materialStatus!=="pending"&&entry.assetStatus!=="placeholder"&&Boolean(entry.frameImage))
    .map(entry=>entry.id);
  let serverReadDepth=0;
  let qaCoins=2000;
  const qaPurchases={ownedCardboards:new Set(),ownedPaws:new Set(),ownedBoardThemes:new Set()};
  const selections={equippedCat:ITEM_ID,equippedDog:null,
    favorite:{category:"catSkin",itemId:ITEM_ID},profile:{category:"catSkin",itemId:ITEM_ID}};
  function presented(data){
    if(!data||serverReadDepth>0)return data;
    return {...data,nyanCoins:qaCoins,
      ownedCatSkins:[...new Set([...(data.ownedCatSkins||[]),...allCatSkins])],
      ownedDogSkins:[...new Set([...(data.ownedDogSkins||[]),...allDogSkins])],
      equippedAppearance:{...data.equippedAppearance,
        ...(selections.equippedCat?{catSkinId:selections.equippedCat}:{}),
        ...(selections.equippedDog?{dogSkinId:selections.equippedDog}:{})},
      ownedCardboards:[...new Set([...(data.ownedCardboards||[]),...qaPurchases.ownedCardboards])],
      ownedPaws:[...new Set([...(data.ownedPaws||[]),...qaPurchases.ownedPaws])],
      ownedBoardThemes:[...new Set([...(data.ownedBoardThemes||[]),...qaPurchases.ownedBoardThemes])],
      favoriteCharacter:selections.favorite,profileCharacter:selections.profile,
      ownedProfileFrames:[...new Set([...(data.ownedProfileFrames||[]),...allProfileFrames])]};
  }
  function serverSafe(data){
    if(!data)return data;
    const real=basePlayerData.getSnapshot();
    const catId=data.equippedAppearance?.catSkinId,dogId=data.equippedAppearance?.dogSkinId;
    const validSelection=selection=>selection&&(
      selection.category==="catSkin"?real.ownedCatSkins?.includes(selection.itemId):
        selection.category==="dogSkin"?real.ownedDogSkins?.includes(selection.itemId):false);
    return {...data,nyanCoins:real.nyanCoins,
      ownedCatSkins:real.ownedCatSkins,ownedDogSkins:real.ownedDogSkins,
      equippedAppearance:{...data.equippedAppearance,
        catSkinId:real.ownedCatSkins?.includes(catId)?catId:real.equippedAppearance?.catSkinId||"default",
        dogSkinId:real.ownedDogSkins?.includes(dogId)?dogId:real.equippedAppearance?.dogSkinId||"default"},
      favoriteCharacter:validSelection(data.favoriteCharacter)?data.favoriteCharacter:real.favoriteCharacter,
      profileCharacter:validSelection(data.profileCharacter)?data.profileCharacter:real.profileCharacter};
  }
  function serverPayload(body){
    if(!body||typeof body!=="object")return body;
    const real=basePlayerData.getSnapshot();
    const safe=serverSafe({...real,...body,
      equippedAppearance:body.equippedAppearance||real.equippedAppearance,
      favoriteCharacter:body.favoriteCharacter??real.favoriteCharacter,
      profileCharacter:body.profileCharacter??real.profileCharacter});
    const copy={...body};
    if("equippedAppearance" in copy)copy.equippedAppearance=safe.equippedAppearance;
    if("favoriteCharacter" in copy)copy.favoriteCharacter=safe.favoriteCharacter;
    if("profileCharacter" in copy)copy.profileCharacter=safe.profileCharacter;
    if(copy.collectionOwnership)copy.collectionOwnership={...copy.collectionOwnership,
      ownedCatSkins:[...(real.ownedCatSkins||[])],ownedDogSkins:[...(real.ownedDogSkins||[])]};
    return copy;
  }
  const snapshot=()=>presented(basePlayerData.getSnapshot());
  root.NyanPlayerData=Object.freeze({...basePlayerData,
    ready:Promise.resolve(basePlayerData.ready).then(()=>snapshot()),load:async()=>presented(await basePlayerData.load()),getSnapshot:snapshot,
    save:async value=>presented(await basePlayerData.save(serverSafe(value))),
    canSpendCoins:amount=>Number.isSafeInteger(amount)&&amount>=0&&qaCoins>=amount,
    purchaseCollectionItem:async(category,id)=>{
      const definition=baseCatalog.getCategory(category),entry=baseCatalog.getItem(category,id);
      if(!definition||!entry)throw new Error("unknown_collection_item");
      if(entry.acquisitionType!=="coins"||entry.currency!=="nyanCoins"||!Number.isSafeInteger(entry.priceCoins))throw new Error("item_not_coin_purchasable");
      if(entry.materialStatus==="pending"||entry.assetStatus==="placeholder")throw new Error("collection_material_unavailable");
      const ownedField=definition.ownedField,set=qaPurchases[ownedField];
      if(!set)return snapshot();
      if(set.has(id)||(basePlayerData.getSnapshot()?.[ownedField]||[]).includes(id))return snapshot();
      if(qaCoins<entry.priceCoins)throw new Error("insufficient_coins");
      qaCoins-=entry.priceCoins;set.add(id);return snapshot();
    },
    updateEquipment:async(category,id)=>{
      if(category==="catSkin"&&allCatSkins.includes(id)){selections.equippedCat=id;return snapshot();}
      if(category==="dogSkin"&&allDogSkins.includes(id)){selections.equippedDog=id;return snapshot();}
      return presented(await basePlayerData.updateEquipment(category,id));
    },
    updateFavoriteCharacter:async(category,id)=>{
      if(id===null){selections.favorite=null;return snapshot();}
      const allowed=category==="catSkin"?allCatSkins:category==="dogSkin"?allDogSkins:[];
      if(allowed.includes(id)){selections.favorite={category,itemId:id};return snapshot();}
      return presented(await basePlayerData.updateFavoriteCharacter(category,id));
    },
    updateProfileCharacter:async(category,id)=>{
      if(id===null){selections.profile=null;return snapshot();}
      const allowed=category==="catSkin"?allCatSkins:category==="dogSkin"?allDogSkins:[];
      if(allowed.includes(id)){selections.profile={category,itemId:id};return snapshot();}
      return presented(await basePlayerData.updateProfileCharacter(category,id));
    }
  });
  root.NyanKingQaSelectors=Object.freeze({
    collectionState:presented,
    coinBalance:()=>qaCoins,
    diagnostics:()=>{const state=presented(basePlayerData.getSnapshot());return {
      qaEnabled:true,qaCoinBalance:qaCoins,renderedCoinBalance:qaCoins,
      ownedCatSkinCount:state.ownedCatSkins.length,ownedDogSkinCount:state.ownedDogSkins.length,
      ownedFrameCount:state.ownedProfileFrames.length,kingOwned:state.ownedCatSkins.includes(ITEM_ID)};}
  });
  root.__KING_SKIN_PLAY_QA__=Object.freeze({itemId:ITEM_ID,basePlayerData,baseCatalog,qaItem:item,selections,
    allCatSkins,allDogSkins,allProfileFrames,presented,serverSafe,serverPayload,
    beginServerRead(){serverReadDepth+=1;},endServerRead(){serverReadDepth=Math.max(0,serverReadDepth-1);}});
})(globalThis);
