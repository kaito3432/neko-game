(function(root){
  "use strict";
  if(root.NYAN_KING_QA_BUILD!==13||!root.document)return;
  const install=()=>{
    if(document.getElementById("kingDebugV7Marker"))return;
    const marker=document.createElement("div");
    marker.id="kingDebugV7Marker";
    const update=()=>{
      const d=root.NyanKingQaSelectors?.diagnostics?.();
      marker.textContent=d ? `KING QA B13\nqaEnabled = ${d.qaEnabled}\nqaCoinBalance = ${d.qaCoinBalance}\nrenderedCoinBalance = ${d.renderedCoinBalance}\nownedCatSkinCount = ${d.ownedCatSkinCount}\nownedDogSkinCount = ${d.ownedDogSkinCount}\nownedFrameCount = ${d.ownedFrameCount}\nkingOwned = ${d.kingOwned}` : "KING QA B13\nQA selectors unavailable";
    };
    marker.style.cssText="position:fixed;top:calc(8px + env(safe-area-inset-top));right:8px;z-index:2147483647;padding:7px 10px;border:2px solid #fff;border-radius:10px;background:#3c235f;color:#fff;white-space:pre;font:800 10px/1.25 ui-monospace,monospace;box-shadow:0 3px 10px #0006;pointer-events:none;text-align:left";
    update();
    document.body.append(marker);
    root.addEventListener("nyan-player-progress",update);
    root.addEventListener("nyan-online-profile",update);
  };
  const clearWebCaches=async()=>{
    try{
      const registrations=await root.navigator.serviceWorker?.getRegistrations?.()||[];
      await Promise.all(registrations.map(registration=>registration.unregister()));
    }catch(_){/* Debug marker must remain visible even if cleanup is unavailable. */}
    try{
      const keys=await root.caches?.keys?.()||[];
      await Promise.all(keys.map(key=>root.caches.delete(key)));
    }catch(_){/* localStorage is intentionally untouched. */}
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
  clearWebCaches();
})(globalThis);
