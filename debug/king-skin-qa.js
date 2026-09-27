(function(root){
  "use strict";
  if(!/KING_DEBUG_V7/.test(root.navigator?.userAgent||""))return;
  if(!root.document || !root.NyanCollectionCatalog || !root.NyanSkinPresentation)return;

  const ITEM_ID="cat_master_s01_king";
  const Catalog=root.NyanCollectionCatalog;
  const Skins=root.NyanSkinPresentation;
  const pending=Catalog.getItem("catSkin",ITEM_ID);
  if(!pending || pending.materialStatus!=="pending" || pending.assetStatus!=="placeholder")return;

  const qaItem=Object.freeze({...pending,...pending.plannedAssets,
    preview:pending.plannedAssets.collectionImage});
  const qaCatalog=Object.freeze({...Catalog,getItem(category,id){
    if(category==="catSkin"&&id===ITEM_ID)return qaItem;
    return Catalog.getItem(category,id);
  }});
  const qaData=Object.freeze({ownedCatSkins:Object.freeze(["default",ITEM_ID]),
    equippedAppearance:Object.freeze({catSkinId:ITEM_ID}),
    favoriteCharacter:Object.freeze({category:"catSkin",itemId:ITEM_ID})});
  const piece=Skins.resolveCatPiece(qaData,{catalog:qaCatalog});
  const win=Skins.resolveOutcomeImage(qaData,"catSkin","win",{catalog:qaCatalog});
  const lose=Skins.resolveOutcomeImage(qaData,"catSkin","lose",{catalog:qaCatalog});
  const move=Skins.effectSource(qaData,"catSkin","move",{catalog:qaCatalog});
  const found=Skins.effectSource(qaData,"catSkin","found",{catalog:qaCatalog});

  const style=document.createElement("style");
  style.dataset.kingQa="style";
  style.textContent=`
    .king-qa-launch{position:fixed;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:10020;border:2px solid #e8b844;border-radius:999px;background:#2b234d;color:#fff4bd;padding:9px 13px;font-weight:900;box-shadow:0 4px 14px #0005}
    .king-qa{position:fixed;inset:0;z-index:10021;display:none;overflow:auto;background:#fff8e8;color:#4e382e;padding:max(14px,env(safe-area-inset-top)) 12px max(22px,env(safe-area-inset-bottom));box-sizing:border-box}
    .king-qa.show{display:block}.king-qa *{box-sizing:border-box}.king-qa-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;background:#fff8e8eF;padding:5px 0 10px}.king-qa-head h2{margin:0;font-size:20px}.king-qa-close{border:0;border-radius:999px;background:#eee0d3;padding:9px 14px;font-weight:900}
    .king-qa-note{margin:2px 0 12px;font-size:11px}.king-qa-section{margin:12px auto;padding:12px;max-width:680px;border:2px solid #d6a95d;border-radius:16px;background:#fff}.king-qa-section h3{margin:0 0 10px}.king-qa-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.king-qa-card{min-width:0;border:1px solid #e2cda7;border-radius:12px;padding:8px;text-align:center;background:#fffaf0}.king-qa-card>img{display:block;width:100%;max-height:250px;object-fit:contain;margin:auto}.king-qa-card small{display:block;margin-top:5px;font-weight:800}
    .king-qa-profiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;justify-items:center}.king-qa-profile{text-align:center;overflow:visible}.king-qa-profile .ranked-frame{width:112px;height:112px;overflow:visible}.king-qa-profile .ranked-avatar-clip img{width:100%;height:100%;object-fit:cover}.king-qa-profile small{display:block;font-weight:900}
    .king-qa-home{position:relative;width:100%;aspect-ratio:3/1;overflow:hidden;border-radius:12px;background:linear-gradient(#f8dfaf,#fff1cd)}.king-qa-home img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.king-qa-home-character{z-index:1;transform-origin:32% 85%}.king-qa-home-decor{z-index:0}.king-qa-home.reacting .king-qa-home-character{animation:kingQaReact 450ms ease-out}@keyframes kingQaReact{0%,100%{transform:none}45%{transform:translate(8px,-6px) scale(1.02) rotate(-1deg)}70%{transform:translate(4px,-2px) scale(1.01)}}
    .king-qa-board{display:flex;justify-content:center;align-items:center;gap:14px;min-height:130px;background:linear-gradient(135deg,#d8edb5,#f8e4a7);border-radius:12px}.king-qa-node{position:relative;width:76px;height:76px;border:2px dashed #936a43;border-radius:14px;background:#fff9}.king-qa-node img{position:absolute;left:50%;top:50%;width:66px;height:66px;object-fit:contain;transform:translate(-50%,-50%)}.king-qa-node.small img{width:47px;height:47px}
    .king-qa-effects{display:flex;justify-content:center;align-items:center;gap:28px;min-height:110px}.king-qa-effect{display:grid;place-items:center;width:82px;height:82px;border-radius:14px;background:#edf1cf}.king-qa-effect img{object-fit:contain}.king-qa-effect.move img{width:54px;height:54px}.king-qa-effect.found img{width:44px;height:44px}.king-qa-replay{display:block;margin:8px auto 0;border:0;border-radius:999px;background:#d9a344;color:#fff;padding:8px 14px;font-weight:900}
    .king-qa-result{width:100%;border-radius:10px;display:block}.king-qa-status{font-size:11px;color:#875e45}.king-qa-status strong{color:#bd3c3c}
    @media(max-width:380px){.king-qa-profile .ranked-frame{width:96px;height:96px}.king-qa-section{padding:9px}.king-qa-grid{gap:7px}}
  `;
  document.head.append(style);

  const launch=document.createElement("button");launch.type="button";launch.className="king-qa-launch";launch.textContent="KING QA";
  const panel=document.createElement("section");panel.className="king-qa";panel.setAttribute("aria-label","王様ネコ表示QA");
  panel.innerHTML=`<div class="king-qa-head"><h2>王様ネコ 表示QA</h2><button class="king-qa-close" type="button">閉じる</button></div>
    <p class="king-qa-note">Debug限定・保存なし・サーバー送信なし</p>
    <section class="king-qa-section"><h3>Collection</h3><div class="king-qa-grid">
      <figure class="king-qa-card"><img src="${qaItem.collectionImage}" alt="王様ネコ通常"><small>一覧／詳細 通常</small></figure>
      <figure class="king-qa-card"><img src="${qaItem.silhouetteImage}" alt="王様ネコ未獲得"><small>未獲得専用locked</small></figure>
    </div></section>
    <section class="king-qa-section"><h3>Profile × Frame</h3><div class="king-qa-profiles"></div></section>
    <section class="king-qa-section"><h3>Home layers</h3><div class="king-qa-home" role="button" tabindex="0" aria-label="王様ネコの反応を再生"><img class="king-qa-home-decor" src="${qaItem.homeDecorImage}" alt=""><img class="king-qa-home-character" src="${qaItem.homeCharacterImage}" alt="王様ネコ ホーム"></div><p class="king-qa-status">character左側・下端基準／decor右側。タップで450ms反応。</p></section>
    <section class="king-qa-section"><h3>Board Piece</h3><div class="king-qa-board"><div class="king-qa-node small"><img src="${piece.src}" alt="47px駒"></div><div class="king-qa-node"><img src="${piece.src}" alt="66px駒"></div></div><p class="king-qa-status">resolver: <strong>${piece.itemId}</strong>／47px・66px</p></section>
    <section class="king-qa-section"><h3>Effects</h3><div class="king-qa-effects"><div class="king-qa-effect move"><img src="${move}" alt="移動エフェクト"></div><div class="king-qa-effect found"><img src="${found}" alt="発見エフェクト"></div></div><button class="king-qa-replay" type="button">エフェクト再表示</button><p class="king-qa-status">既存resolver／Move 54px・Found 44px</p></section>
    <section class="king-qa-section"><h3>Result Win</h3><img class="king-qa-result" src="${win.src}" alt="王様ネコ勝利リザルト"></section>
    <section class="king-qa-section"><h3>Result Lose</h3><img class="king-qa-result" src="${lose.src}" alt="王様ネコ敗北リザルト"></section>
    <p class="king-qa-status">正式状態: <strong>${pending.materialStatus} / ${pending.assetStatus}</strong></p>`;
  document.body.append(launch,panel);

  const profiles=panel.querySelector(".king-qa-profiles");
  for(const id of ["default","rank_bronze","rank_diamond","rank_master"]){
    const wrap=document.createElement("div");wrap.className="king-qa-profile";
    const frame=document.createElement("span");frame.className="ranked-frame ranked-frame-preview";
    const clip=document.createElement("span");clip.className="ranked-avatar-clip";
    const image=document.createElement("img");image.src=qaItem.profileImage;image.alt=`王様ネコ ${id}`;
    clip.append(image);frame.append(clip);wrap.append(frame);
    const caption=document.createElement("small");caption.textContent=id;wrap.append(caption);profiles.append(wrap);
    root.NyanOnlineProfileUI?.setFrame(frame,id);
  }
  const open=()=>{panel.classList.add("show");panel.scrollTop=0;};
  const close=()=>panel.classList.remove("show");
  launch.addEventListener("click",open);panel.querySelector(".king-qa-close").addEventListener("click",close);
  const home=panel.querySelector(".king-qa-home");
  const react=()=>{home.classList.remove("reacting");void home.offsetWidth;home.classList.add("reacting");};
  home.addEventListener("click",react);home.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();react();}});
  panel.querySelector(".king-qa-replay").addEventListener("click",()=>{
    for(const image of panel.querySelectorAll(".king-qa-effect img")){const src=image.src;image.removeAttribute("src");requestAnimationFrame(()=>{image.src=src;});}
  });
  root.__KING_SKIN_QA__=Object.freeze({itemId:ITEM_ID,status:Object.freeze({materialStatus:pending.materialStatus,assetStatus:pending.assetStatus}),open,close});
})(globalThis);
