(function(root){
  "use strict";
  if(!/KING_DEBUG_V7/.test(root.navigator?.userAgent||""))return;
  if(!root.NyanCollectionCatalog||!root.NyanPlayerData||root.__KING_SKIN_PLAY_QA__)return;
  const ITEM_ID="cat_master_s01_king";
  const baseCatalog=root.NyanCollectionCatalog;
  const basePlayerData=root.NyanPlayerData;
  const pending=baseCatalog.getItem("catSkin",ITEM_ID);
  if(!pending||pending.materialStatus!=="pending"||pending.assetStatus!=="placeholder")return;

  const qaItem=Object.freeze({...pending,...pending.plannedAssets,
    // The board uses the same circular, face-first presentation as existing cat tokens.
    pieceImage:pending.plannedAssets.profileImage,
    preview:pending.plannedAssets.collectionImage});
  const qaCatalog=Object.freeze({...baseCatalog,
    getItem(category,id){return category==="catSkin"&&id===ITEM_ID?qaItem:baseCatalog.getItem(category,id);},
    getItemsByCategory(category){return baseCatalog.getItemsByCategory(category).map(item=>item.id===ITEM_ID?qaItem:item);}
  });
  let serverReadDepth=0;
  const selections={equipped:true,favorite:true,profile:true};
  function withKing(data){
    if(!data)return data;
    return {...data,
      ownedCatSkins:[...new Set([...(data.ownedCatSkins||[]),ITEM_ID])],
      equippedAppearance:{...data.equippedAppearance,...(selections.equipped?{catSkinId:ITEM_ID}:{})},
      favoriteCharacter:selections.favorite
        ? {category:"catSkin",itemId:ITEM_ID}
        : data.favoriteCharacter?.itemId===ITEM_ID ? null : data.favoriteCharacter,
      profileCharacter:selections.profile?{category:"catSkin",itemId:ITEM_ID}:data.profileCharacter
    };
  }
  function withoutKing(data){
    if(!data)return data;
    const owned=(data.ownedCatSkins||[]).filter(id=>id!==ITEM_ID);
    return {...data,ownedCatSkins:owned.length?owned:["default"],
      equippedAppearance:{...data.equippedAppearance,catSkinId:data.equippedAppearance?.catSkinId===ITEM_ID?"default":data.equippedAppearance?.catSkinId},
      favoriteCharacter:data.favoriteCharacter?.itemId===ITEM_ID?null:data.favoriteCharacter,
      profileCharacter:data.profileCharacter?.itemId===ITEM_ID?null:data.profileCharacter};
  }
  const presented=data=>serverReadDepth>0?withoutKing(data):withKing(data);
  const qaPlayerData={...basePlayerData,
    ready:Promise.resolve(basePlayerData.ready).then(()=>presented(basePlayerData.getSnapshot())),
    load:async()=>presented(await basePlayerData.load()),
    getSnapshot:()=>presented(basePlayerData.getSnapshot()),
    save:async value=>withKing(await basePlayerData.save(withoutKing(value))),
    updateEquipment:async(category,id)=>{
      if(category==="catSkin")selections.equipped=id===ITEM_ID;
      return id===ITEM_ID?withKing(basePlayerData.getSnapshot()):withKing(await basePlayerData.updateEquipment(category,id));
    },
    updateFavoriteCharacter:async(category,id)=>{
      if(category==="catSkin")selections.favorite=id===ITEM_ID;
      return id===ITEM_ID?withKing(basePlayerData.getSnapshot()):withKing(await basePlayerData.updateFavoriteCharacter(category,id));
    },
    updateProfileCharacter:async(category,id)=>{
      if(category==="catSkin")selections.profile=id===ITEM_ID;
      return id===ITEM_ID?withKing(basePlayerData.getSnapshot()):withKing(await basePlayerData.updateProfileCharacter(category,id));
    }
  };
  root.NyanCollectionCatalog=Object.freeze(qaCatalog);
  root.NyanPlayerData=Object.freeze(qaPlayerData);
  root.__KING_SKIN_PLAY_QA__=Object.freeze({itemId:ITEM_ID,basePlayerData,baseCatalog,qaItem,selections,withKing,withoutKing,
    beginServerRead(){serverReadDepth+=1;},endServerRead(){serverReadDepth=Math.max(0,serverReadDepth-1);}});
})(globalThis);
