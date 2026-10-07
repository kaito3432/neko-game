(function(factory){
  const api=factory(typeof globalThis!=='undefined'?globalThis:this);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else globalThis.NyanAdConsent=api;
})(function(root){
  'use strict';
  const STATES=Object.freeze({UNKNOWN:'unknown',REQUIRED:'required',OBTAINED:'obtained',NOT_REQUIRED:'not_required',ERROR:'error'});
  function createManager({onState=()=>{}}={}){
    let state=STATES.UNKNOWN,canRequestAds=false,privacyOptionsRequired=false,pending=null;
    const snapshot=()=>({state,canRequestAds,privacyOptionsRequired});
    const emit=()=>{onState(snapshot());return snapshot();};
    function apply(info){
      const status=String(info?.status||'UNKNOWN');
      state=({REQUIRED:STATES.REQUIRED,OBTAINED:STATES.OBTAINED,NOT_REQUIRED:STATES.NOT_REQUIRED})[status]||STATES.UNKNOWN;
      canRequestAds=info?.canRequestAds===true;
      privacyOptionsRequired=info?.privacyOptionsRequirementStatus==='REQUIRED';
      return emit();
    }
    async function refresh(plugin){
      canRequestAds=false;state=STATES.UNKNOWN;emit();
      try{
        if(typeof plugin?.requestConsentInfo!=='function')throw new Error('ump_unavailable');
        let info=await plugin.requestConsentInfo();
        apply(info);
        if(info.status==='REQUIRED'){
          if(typeof plugin.showConsentForm!=='function'||info.isConsentFormAvailable===false)
            throw new Error('consent_form_unavailable');
          info=await plugin.showConsentForm();
          apply(info);
        }
        return snapshot();
      }catch(error){state=STATES.ERROR;canRequestAds=false;emit();return {...snapshot(),error};}
    }
    function ensure(plugin){
      if(pending)return pending;
      pending=refresh(plugin).finally(()=>{pending=null;});
      return pending;
    }
    async function showPrivacyOptions(plugin){
      if(!privacyOptionsRequired||typeof plugin?.showPrivacyOptionsForm!=='function')return false;
      try{await plugin.showPrivacyOptionsForm();return (await ensure(plugin)).state!==STATES.ERROR;}
      catch(_){state=STATES.ERROR;canRequestAds=false;emit();return false;}
    }
    return Object.freeze({ensure,showPrivacyOptions,getState:snapshot,canRequestAds:()=>canRequestAds});
  }
  const button=root.document?.getElementById('adPrivacyOptionsButton');
  const status=root.document?.getElementById('adPrivacyOptionsStatus');
  const manager=createManager({onState:value=>{
    if(button)button.hidden=!value.privacyOptionsRequired;
    root.dispatchEvent?.(new root.CustomEvent('nyan-ad-consent-state',{detail:value}));
  }});
  if(button)button.addEventListener('click',async()=>{
    const plugin=root.Capacitor?.Plugins?.AdMob||root.Capacitor?.registerPlugin?.('AdMob');
    button.disabled=true;
    const shown=await manager.showPrivacyOptions(plugin);
    if(status)status.textContent=shown?'広告プライバシー設定を更新しました':'広告プライバシー設定を開けませんでした';
    button.disabled=false;
  });
  return Object.freeze({STATES,createManager,manager});
});
