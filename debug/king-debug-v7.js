(function(root){
  "use strict";
  if(!/KING_DEBUG_V7/.test(root.navigator?.userAgent||"")||!root.document)return;
  const install=()=>{
    if(document.getElementById("kingDebugV7Marker"))return;
    const marker=document.createElement("div");
    marker.id="kingDebugV7Marker";
    marker.textContent="KING DEBUG V7";
    marker.style.cssText="position:fixed;top:calc(8px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:2147483647;padding:7px 14px;border:3px solid #fff;border-radius:999px;background:#d51f3f;color:#fff;font:900 16px/1 sans-serif;letter-spacing:.5px;box-shadow:0 3px 10px #0006;pointer-events:none";
    document.body.append(marker);
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
