(function(root){
  "use strict";
  if(root.NYAN_KING_QA_BUILD!==13)return;
  const qa=root.__KING_SKIN_PLAY_QA__;
  if(!qa||!root.document)return;
  const identity=root.NyanOnlineIdentity;
  if(identity){
    let lastServerProfile=null;
    const qaProfile=profile=>{
      if(!profile)return profile;
      lastServerProfile=profile;
      return root.NyanKingQaSelectors?.profileState?.(profile)||{...profile,
        profileCharacter:qa.selections.profile??profile.profileCharacter,
        ownedProfileFrames:[...new Set([...(profile.ownedProfileFrames||[]),...qa.allProfileFrames])],
        equippedProfileFrameId:qa.selections.frame??profile.equippedProfileFrameId??"default"};
    };
    const augment=response=>response?.profile?{...response,profile:qaProfile(response.profile)}:response;
    const cleanBody=body=>qa.serverPayload(body);
    const serverCall=async operation=>{qa.beginServerRead();try{return await operation();}finally{qa.endServerRead();}};
    root.NyanOnlineIdentity=Object.freeze({...identity,
      prepare:async apiBase=>augment(await serverCall(()=>identity.prepare(apiBase))),
      request:async(api,path,body,method)=>{
        if(path==="profile-frame"){
          const requested=body?.frameId;
          if(requested!=="default"&&!qa.allProfileFrames.includes(requested))throw new Error("frame_not_owned");
          qa.selections.frame=requested||"default";
          return {profile:qaProfile(lastServerProfile)};
        }
        return augment(await serverCall(()=>identity.request(api,path,cleanBody(body),method)));
      }
    });
  }
  function refreshLocalProfilePreview(){
    const selection=qa.selections.profile;
    if(!selection)return;
    const source=qa.baseCatalog.getItem(selection.category,selection.itemId)?.profileImage;
    if(!source)return;
    document.querySelectorAll(".ranked-profile-card [data-rank-icon]").forEach(image=>{image.src=source;});
  }
  root.addEventListener("nyan-player-appearance-changed",()=>setTimeout(refreshLocalProfilePreview,0));
  root.addEventListener("nyan-online-profile",()=>setTimeout(refreshLocalProfilePreview,0));
  root.addEventListener("nyan-online-selection-opened",()=>setTimeout(refreshLocalProfilePreview,0));
})(globalThis);
