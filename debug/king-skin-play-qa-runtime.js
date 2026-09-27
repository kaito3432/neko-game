(function(root){
  "use strict";
  if(!/KING_DEBUG_V7/.test(root.navigator?.userAgent||""))return;
  const qa=root.__KING_SKIN_PLAY_QA__;
  if(!qa||!root.document)return;
  const style=document.createElement("style");
  style.dataset.kingPlayQa="piece";
  style.textContent=`.cat-art[data-skin-id="${qa.itemId}"]{width:94%;height:94%;padding:0;object-fit:contain!important}`;
  document.head.append(style);

  // Preserve normal online UI while hiding the Debug-only ownership overlay
  // from every authenticated request boundary.
  const identity=root.NyanOnlineIdentity;
  if(identity){
    const withoutKingBody=body=>{
      if(!body||typeof body!=="object")return body;
      const copy={...body};
      if(copy.equippedAppearance?.catSkinId===qa.itemId)copy.equippedAppearance={...copy.equippedAppearance,catSkinId:"default"};
      if(copy.profileCharacter?.itemId===qa.itemId)copy.profileCharacter=null;
      if(copy.collectionOwnership?.ownedCatSkins)copy.collectionOwnership={...copy.collectionOwnership,
        ownedCatSkins:copy.collectionOwnership.ownedCatSkins.filter(id=>id!==qa.itemId)};
      return copy;
    };
    const serverCall=async operation=>{qa.beginServerRead();try{return await operation();}finally{qa.endServerRead();}};
    root.NyanOnlineIdentity=Object.freeze({...identity,
      prepare:()=>serverCall(()=>identity.prepare()),
      request:(api,path,body,method)=>serverCall(()=>identity.request(api,path,withoutKingBody(body),method))
    });
  }

  function applyHome(){
    const hero=document.querySelector(".vu3-hero");
    const stage=document.querySelector(".vu3-hero-stage");
    const layers=stage?.querySelector(".vu3-home-layered-skin");
    const decor=layers?.querySelector(".vu3-home-layer-treasure");
    const character=layers?.querySelector(".vu3-home-layer-character");
    if(!hero||!stage||!layers||!decor||!character)return;
    hero.classList.add("skin-favorite-active");
    stage.classList.add("skin-favorite-active","skin-home-layered-active");
    hero.dataset.favoriteCategory="catSkin";hero.dataset.favoriteItemId=qa.itemId;hero.dataset.homeMode="layered";
    layers.setAttribute("aria-hidden","false");
    decor.src=qa.qaItem.homeDecorImage;decor.style.translate="0 0";decor.style.scale="1";
    character.src=qa.qaItem.homeCharacterImage;character.style.translate="0 0";character.style.scale="1";
    character.tabIndex=0;character.setAttribute("role","button");character.setAttribute("aria-label","王様ネコのリアクションを再生");
    let playing=false;
    const react=()=>{if(playing)return;playing=true;character.animate([
      {transform:"translate3d(0,0,0) scale(1)"},{transform:"translate3d(8px,-6px,0) scale(1.02)"},{transform:"translate3d(0,0,0) scale(1)"}
    ],{duration:450,easing:"ease-out"}).finished.finally(()=>{playing=false;});};
    character.onclick=react;character.onkeydown=event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();react();}};
  }
  function applyOnlineProfilePreview(){
    if(!qa.selections.profile)return;
    const source=qa.qaItem.profileImage;
    document.querySelectorAll(".ranked-profile-card [data-rank-icon]").forEach(image=>{if(image.src!==new URL(source,document.baseURI).href)image.src=source;});
  }
  function applyBoardPiece(){
    if(!qa.selections.equipped)return;
    const source=new URL(qa.qaItem.profileImage,document.baseURI).href;
    document.querySelectorAll(`.cat-art[data-skin-id="${qa.itemId}"]`).forEach(image=>{
      if(image.src!==source)image.src=qa.qaItem.profileImage;
    });
  }
  function connectOnlineProfile(){
    const online=root.NyanOnline;
    if(!online?.prepareIdentity||online.prepareIdentity.__kingQaWrapped)return;
    const prepare=online.prepareIdentity.bind(online);
    const wrapped=async()=>{
      const prepared=await prepare();
      root.NyanRankedUI?.updateProfile?.(prepared?.profile);
      setTimeout(applyOnlineProfilePreview,0);
      return prepared;
    };
    wrapped.__kingQaWrapped=true;
    online.prepareIdentity=wrapped;
  }
  const run=()=>{
    root.addEventListener("nyan-player-appearance-changed",()=>setTimeout(()=>{
      if(qa.selections.favorite)applyHome();
      applyOnlineProfilePreview();
      applyBoardPiece();
    },0));
    root.addEventListener("nyan-online-profile",()=>setTimeout(applyOnlineProfilePreview,0));
    connectOnlineProfile();
    if(qa.selections.favorite)applyHome();
    applyOnlineProfilePreview();applyBoardPiece();
    const observer=new MutationObserver(()=>{
      if(qa.selections.favorite)applyHome();
      applyBoardPiece();
    });
    observer.observe(document.body,{subtree:true,childList:true});
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});else run();
})(globalThis);
