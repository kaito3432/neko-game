(function(factory){const api=factory(typeof globalThis!=='undefined'?globalThis:this);if(typeof module==='object'&&module.exports)module.exports=api;else globalThis.NyanGooglePlay=api;})(function(root){
  'use strict';
  const IDS=Object.freeze(['SKILL_CAT_FAKE_PAW','SKILL_POLICE_GROUP_SEARCH','SKILL_POLICE_DASH','SKILL_PACK_01','REMOVE_ADS','REMOVE_ADS_PLUS_SKILL_PACK_01']);
  function nativePlugin(scope=root){const cap=scope?.Capacitor;if(!cap||cap.getPlatform?.()!=='android')return null;return cap.Plugins?.NyanGooglePlay||cap.registerPlugin?.('NyanGooglePlay')||null;}
  function createProvider({plugin=nativePlugin(),api=null,onState=()=>{}}={}){
    let busy=false,products=[];const emit=(state,detail={})=>onState({state,...detail});
    async function loadProducts(){if(!plugin){emit('error',{reason:'unsupportedPlatform'});return {products:[],reason:'unsupportedPlatform'};}emit('loading');try{const value=await plugin.loadProducts({productIds:IDS});products=(value.products||[]).filter(p=>IDS.includes(p.productId));emit('available',{products});return {products};}catch(error){emit('error',{error});return {products:[],error};}}
    async function submit(purchase){const result=await api.verifyPurchase({purchaseToken:purchase.purchaseToken,productId:purchase.productId});await plugin.acknowledgePurchase({purchaseToken:purchase.purchaseToken});return result;}
    async function purchaseProduct(productId){
      if(!IDS.includes(productId))return {purchased:false,reason:'unknownProduct'};if(busy)return {purchased:false,reason:'busy'};if(!plugin||!api)return {purchased:false,reason:'unavailable'};
      busy=true;emit('purchasing',{productId});try{const identity=await api.identity(),result=await plugin.purchase({productId,obfuscatedAccountId:identity.playerId});
        if(result.status==='cancelled'){emit('available',{cancelled:true});return {purchased:false,reason:'cancelled'};}if(result.status==='pending'){emit('pending',{productId});return {purchased:false,pending:true};}
        const verified=await submit(result);emit('purchased',{productId,verified});return {purchased:true,productId,...verified};
      }catch(error){emit('error',{error,productId});return {purchased:false,reason:error?.status?'serverVerificationFailed':'purchaseFailed',error};}finally{busy=false;}
    }
    async function restorePurchases(){if(busy)return {restored:false,reason:'busy'};if(!plugin||!api)return {restored:false,reason:'unavailable'};busy=true;emit('restoring');try{await api.identity();const value=await plugin.restorePurchases(),verified=[];for(const purchase of value.purchases||[]){if(IDS.includes(purchase.productId))verified.push(await submit(purchase));}emit('available',{restored:true});return {restored:true,count:verified.length,purchases:verified};}catch(error){emit('error',{error});return {restored:false,reason:'restoreFailed',error};}finally{busy=false;}}
    return Object.freeze({loadProducts,purchaseProduct,restorePurchases,getProducts:()=>products.map(p=>({...p})),isBusy:()=>busy});
  }
  function browserApi(){return {async identity(){const value=await root.NyanOnline.prepareIdentity();return {playerId:value.profile.playerId};},async verifyPurchase(payload){const value=await root.NyanOnlineIdentity.request(root.NyanOnline.API_BASE,'google-play-purchase',payload);root.NyanMonetization.syncServerPurchaseEntitlements(value.profile?.skillEntitlements||{});root.dispatchEvent(new root.CustomEvent('nyan-purchase-entitlements',{detail:value}));return value;}};}
  const provider=createProvider({api:browserApi(),onState:detail=>root.dispatchEvent?.(new root.CustomEvent('nyan-purchase-state',{detail}))});
  return Object.freeze({PRODUCT_IDS:IDS,createProvider,nativePlugin,provider});
});
