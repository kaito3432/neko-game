/* Native DEBUG document-start opt-in only; stripped from Release. Run before app scripts. */
(function(root){
  'use strict';
  if(root.__nyanScreenshotIsolated!==true||root.Capacitor?.getPlatform?.()!=='ios')return;
  const blocked={web:0,native:0};
  Object.defineProperty(root,'NyanScreenshotIsolation',{value:Object.freeze({active:true,counts:()=>({...blocked})})});
  const denied=()=>Object.assign(new Error('Offline capture session'),{code:'SCREENSHOT_OFFLINE'});
  function localRead(input,options){
    try{
      const method=String(options?.method||input?.method||'GET').toUpperCase();
      if(!['GET','HEAD'].includes(method))return false;
      const base=new URL('./',root.location.href);
      const address=typeof input==='string'?input:input?.url||input?.href;
      if(typeof address!=='string')return false;
      const url=new URL(address,root.location.href);
      if(['data:','blob:'].includes(url.protocol))return true;
      if(!['capacitor:','file:','app:','asset:'].includes(base.protocol)||
        url.protocol!==base.protocol||url.host!==base.host||url.username||url.password)return false;
      const pathname=decodeURIComponent(url.pathname);
      return pathname.startsWith(base.pathname)&&!pathname.split('/').some(part=>part==='..'||part==='api')&&
        /\.(wav|mp3|ogg|m4a|png|webp|jpe?g|svg|html|css|js|json|webmanifest)$/i.test(pathname);
    }catch(_){return false;}
  }
  const fetch=root.fetch?.bind(root);
  root.fetch=(input,options)=>{
    if(fetch&&localRead(input,options))return fetch(input,{...options,redirect:'error'});
    blocked.web++;return Promise.reject(denied());
  };
  if(root.XMLHttpRequest){
    const prototype=root.XMLHttpRequest.prototype,open=prototype.open,send=prototype.send,requests=new WeakMap();
    prototype.open=function(method,url,...args){requests.set(this,{method,url});return open.call(this,method,url,...args);};
    prototype.send=function(...args){
      const request=requests.get(this);
      if(request&&localRead(request.url,{method:request.method}))return send.apply(this,args);
      blocked.web++;throw denied();
    };
  }
  root.WebSocket=class{constructor(){throw denied();}};
  if(root.EventSource)root.EventSource=class{constructor(){throw denied();}};
  if(root.navigator?.sendBeacon)root.navigator.sendBeacon=()=>false;
  const meta=root.document.createElement('meta');meta.httpEquiv='Content-Security-Policy';
  meta.content="connect-src capacitor: file: app: asset: data: blob:; form-action 'none'; frame-src 'self'";root.document.head.append(meta);
  // No native HTTP, StoreKit, UMP, review request, or ads during capture.
  const cap=root.Capacitor;
  for(const key of ['nativePromise','nativeCallback']){
    const original=cap[key];if(typeof original!=='function')continue;
    cap[key]=function(plugin,method,...args){
      if(plugin==='NyanReview'&&method==='getEnvironment'||['Console','SystemBars','WebView'].includes(plugin))return original.call(cap,plugin,method,...args);
      blocked.native++;
      if(key==='nativePromise')return Promise.reject(denied());
      return undefined;
    };
  }
})(globalThis);
