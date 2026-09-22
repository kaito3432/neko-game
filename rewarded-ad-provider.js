(function(factory){
  const api=factory(typeof globalThis!=='undefined'?globalThis:this);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else globalThis.NyanRewardedAds=api;
})(function(root){
  'use strict';
  const REWARD_TYPE='SKILL_MODE_UNLOCK_PROGRESS';
  const STAMINA_REWARD_TYPE='RANKED_STAMINA_RECOVERY';
  const IOS_TEST_REWARDED_ID='ca-app-pub-3940256099942544/1712485313';
  const ANDROID_TEST_REWARDED_ID='ca-app-pub-3940256099942544/5224354917';
  const STATES=Object.freeze({INITIALIZING:'initializing',LOADING:'loading',AVAILABLE:'available',UNAVAILABLE:'unavailable',VIEWING:'viewing',VERIFYING:'verifying',COMPLETED:'completed'});

  function nativePlugin(scope=root){
    const capacitor=scope?.Capacitor;
    if(!capacitor||!['ios','android'].includes(capacitor.getPlatform?.()))return null;
    return capacitor.Plugins?.AdMob||capacitor.registerPlugin?.('AdMob')||null;
  }

  function createProvider({plugin=nativePlugin(),api=null,config={},onState=()=>{},sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
    let initialized=false,busy=false,state=plugin?STATES.INITIALIZING:STATES.UNAVAILABLE,activeRewardType=null;
    const platform=config.platform||root.Capacitor?.getPlatform?.()||'web';
    const testing=config.testing!==false,adId=testing?(platform==='android'?ANDROID_TEST_REWARDED_ID:IOS_TEST_REWARDED_ID):config.rewardedAdUnitId;
    const emit=(next,detail={})=>{state=next;onState({state,rewardType:activeRewardType,...detail});};
    const removeAll=async handles=>Promise.all(handles.map(handle=>handle?.remove?.()).filter(Boolean));
    async function initialize(){
      if(initialized)return {available:Boolean(plugin&&adId)};
      if(!plugin||!adId){emit(STATES.UNAVAILABLE,{reason:plugin?'missingAdUnitId':'unsupportedPlatform'});return {available:false};}
      emit(STATES.INITIALIZING);
      try{await plugin.initialize({initializeForTesting:testing});initialized=true;emit(STATES.AVAILABLE);return {available:true};}
      catch(error){emit(STATES.UNAVAILABLE,{reason:'initializeFailed',error});return {available:false,error};}
    }
    async function showRewardedAd(rewardType=REWARD_TYPE){
      if(busy)return {shown:false,rewarded:false,reason:'busy'};
      busy=true;activeRewardType=rewardType;let handles=[],rewarded=false,dismissed=false;
      try{
        if(!(await initialize()).available)return {shown:false,rewarded:false,reason:'unavailable'};
        if(!api?.createAttempt||!api?.completeAttempt)return {shown:false,rewarded:false,reason:'serverUnavailable'};
        const attempt=await api.createAttempt(rewardType);
        emit(STATES.LOADING);
        const listen=async(name,fn)=>{if(plugin.addListener)handles.push(await plugin.addListener(name,fn));};
        await listen('onRewardedVideoAdReward',()=>{rewarded=true;});
        await listen('onRewardedVideoAdDismissed',()=>{dismissed=true;});
        await plugin.prepareRewardVideoAd({adId,isTesting:testing,ssv:{userId:attempt.playerId,customData:attempt.attemptId}});
        emit(STATES.AVAILABLE);emit(STATES.VIEWING);
        const showResult=await plugin.showRewardVideoAd();
        rewarded=rewarded||Boolean(showResult&&Object.keys(showResult).length);
        if(!rewarded)return {shown:true,rewarded:false,reason:dismissed?'cancelled':'rewardCallbackMissing'};
        if(testing){emit(STATES.COMPLETED,{testMode:true,verified:false});return {shown:true,rewarded:true,verified:false,testMode:true,reason:'testSsvUnavailable'};}
        emit(STATES.VERIFYING);
        let completed,lastError,attempts=Math.max(1,Number(config.verificationAttempts)||8);
        for(let index=0;index<attempts;index++){
          try{completed=await api.completeAttempt({rewardType,verificationId:attempt.attemptId,verification:{provider:'admob-ssv'}});break;}
          catch(error){lastError=error;if(error?.status!==403||index===attempts-1)throw error;await sleep(1500);}
        }
        if(!completed)throw lastError||new Error('reward_not_verified');
        emit(STATES.COMPLETED,{verified:true,profile:completed.profile,rewardType});
        return {shown:true,rewarded:true,verified:true,...completed};
      }catch(error){
        const reason=error?.status===403?'serverRejected':error?.status===503?'serverUnavailable':dismissed?'cancelled':state===STATES.LOADING?'loadFailed':'showFailed';
        emit(STATES.UNAVAILABLE,{reason,error});return {shown:state===STATES.VIEWING||state===STATES.VERIFYING,rewarded:false,reason,error};
      }finally{await removeAll(handles);busy=false;activeRewardType=null;}
    }
    return Object.freeze({initialize,showRewardedAd,getState:()=>state,isBusy:()=>busy,isTesting:()=>testing});
  }

  function browserApi(){
    return {
      async createAttempt(rewardType){
        const identity=await root.NyanOnline.prepareIdentity(),value=await root.NyanOnlineIdentity.request(root.NyanOnline.API_BASE,'rewarded-ad-attempt',{rewardType});
        return {...value,playerId:identity.profile.playerId};
      },
      async completeAttempt(payload){
        const value=await root.NyanOnlineIdentity.request(root.NyanOnline.API_BASE,'rewarded-ad-completion',payload);
        root.NyanMonetization?.syncServerSkillModeEntitlement?.(value.profile?.skillEntitlements||{});
        root.dispatchEvent?.(new root.CustomEvent('nyan-rewarded-ad-progress',{detail:{...value,rewardType:payload.rewardType}}));return value;
      }
    };
  }
  const nativePlatform=root.Capacitor?.getPlatform?.()||'web';
  const config={testing:root.NYAN_AD_CONFIG?.testing!==false,platform:nativePlatform,rewardedAdUnitId:root.NYAN_AD_CONFIG?.rewardedAdUnitIds?.[nativePlatform]||''};
  const provider=createProvider({config,api:browserApi(),
    onState:detail=>root.dispatchEvent?.(new root.CustomEvent('nyan-rewarded-ad-state',{detail}))});
  return Object.freeze({REWARD_TYPE,STAMINA_REWARD_TYPE,IOS_TEST_REWARDED_ID,ANDROID_TEST_REWARDED_ID,STATES,createProvider,nativePlugin,provider});
});
