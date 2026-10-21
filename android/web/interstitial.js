(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)api.install(root);
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const KEY='nyanAndroidInterstitialV1';
 function createController({storage,ad,now=Date.now}){
  let value;try{value=JSON.parse(storage.getItem(KEY));}catch(_){}
  let count=Number.isSafeInteger(value?.count)&&value.count>=0?value.count:0;
  let ids=Array.isArray(value?.ids)?value.ids.slice(-64):[];
  let result=null,locked=false;
  function record(id){
   if(!id||ids.includes(id))return false;
   const next={count:count+1,ids:[...ids,id].slice(-64)};
   // If persistence is unavailable, fail open without displaying an untracked ad.
   try{storage.setItem(KEY,JSON.stringify(next));}catch(_){return false;}
   count=next.count;ids=next.ids;result={id,due:count%3===0,handled:false};locked=false;return true;
  }
  function begin(){result=null;locked=false;}
  function exit(transition){
   if(locked||result?.handled)return false;
   locked=true;const due=Boolean(result?.due);if(result)result.handled=true;
   let finished=false;
   const finish=()=>{if(finished)return;finished=true;transition();};
   // Consume the opportunity before requesting native display, including all failures.
   if(!due){finish();return true;}
   try{if(!ad.show(finish))finish();}catch(_){finish();}
   return true;
  }
  return{begin,record,exit,state:()=>({count,ids:[...ids],result:result&&{...result}})};
 }
 function createAd({plugin,initialize,consent,busy=()=>false,adId,now=Date.now}){
  let loading=null,ready=false,loadedAt=0,active=null,listening=null,handles=[];
  const allowed=()=>consent?.canRequestAds()===true&&!busy();
  const valid=()=>/^ca-app-pub-\d{16}\/\d{10}$/.test(adId||'');
  function finish(){const callback=active;active=null;if(!callback)return;callback();void preload();}
  function listeners(){
   if(!listening)listening=Promise.all(['interstitialAdDismissed','interstitialAdFailedToShow'].map(name=>plugin.addListener(name,finish))).then(h=>{handles=h;return true;}).catch(()=>false);
   return listening;
  }
  function preload(){
   if(loading)return loading;
   if(active||!plugin||!valid()||ready&&now()-loadedAt<55*60*1000)return Promise.resolve(false);
   ready=false;
   loading=(async()=>{try{
    if(!(await initialize()).available||!allowed()||!(await listeners()))return false;
    await plugin.prepareInterstitial({adId,isTesting:false,npa:true});
    ready=allowed();loadedAt=now();return ready;
   }catch(_){ready=false;return false;}finally{loading=null;}})();
   return loading;
  }
  function show(done){
   if(active||!ready||now()-loadedAt>=55*60*1000||!allowed())return false;
   ready=false;active=done;
   // The plugin resolves show() on display start, not dismissal. Only callbacks navigate.
   try{Promise.resolve(plugin.showInterstitial({adId})).catch(finish);}catch(_){finish();}
   return true;
  }
  return{preload,show,isReady:()=>ready};
 }
 function install(win){
  if(win.Capacitor?.getPlatform?.()!=='android'||!win.NYAN_ANDROID_CLOSED_TEST)return null;
  const plugin=win.NyanRewardedAds?.nativePlugin(win),rewarded=win.NyanRewardedAds?.provider;
  const ad=createAd({plugin,adId:win.NYAN_ANDROID_INTERSTITIAL_ID,
   initialize:()=>rewarded?.initialize()||Promise.resolve({available:false}),
   consent:win.NyanAdConsent?.manager,busy:()=>rewarded?.isBusy()===true});
  let storage;try{storage=win.localStorage;}catch(_){storage={getItem(){},setItem(){throw Error('storage unavailable');}};}
  const controller=createController({storage,ad});let localId=null;
  const api={
   begin(){controller.begin();localId='local:'+win.crypto.randomUUID();void ad.preload();},
   completed({playMode,alreadyOver}){
    if(alreadyOver||playMode==='onlineCat'||playMode==='onlinePolice')return;
    controller.record(localId);
   },
   ended(session,result){
    // Reuse the existing server-confirmed Room completion event and review exclusions.
    if(!session?.matchId||session.matchType!=='roomMatch'||['invalid','cancelled'].includes(result?.status)||result?.finishReason||!['cat','police'].includes(result?.winner))return;
    controller.record(session.matchId);
   },
   wrap(transition){return()=>{if(!win.document.getElementById('resultOverlay')?.classList.contains('show'))return;controller.exit(transition);};}
  };
  win.NyanAndroidInterstitial=api;
  win.addEventListener('nyan-online-ended',event=>api.ended(win.NyanOnline?.getSession(),event.detail));
  win.addEventListener('load',()=>void ad.preload(),{once:true});
  return api;
 }
 return{KEY,createController,createAd,install};
});
