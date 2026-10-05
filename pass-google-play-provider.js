(function(factory){
  const api=factory(typeof globalThis!=='undefined'?globalThis:this);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else globalThis.NyanPassGooglePlay=api;
})(function(root){
  'use strict';
  const nativePlugin=scope=>scope?.Capacitor?.getPlatform?.()==='android'
    ?scope.Capacitor.Plugins?.NyanGooglePlay||scope.Capacitor.registerPlugin?.('NyanGooglePlay'):null;
  function createProvider({plugin=nativePlugin(root),api,onState=()=>{}}={}){
    let productId=null,basePlanId=null,product=null,busy=false;
    const emit=(state,detail={})=>onState({state,...detail});
    function configure(config={}){
      const id=config.productId||null,plan=config.basePlanId||null;
      if(id!==productId||plan!==basePlanId)product=null;
      productId=id;basePlanId=plan;
    }
    async function loadProduct(){
      if(!plugin||!productId||!basePlanId)return {product:null,reason:'unavailable'};
      try{
        const result=await plugin.loadSubscriptionProducts({productIds:[productId]});
        product=(result.products||[]).find(item=>item.productId===productId&&
          item.basePlanId===basePlanId&&item.billingPeriod==='P1M'&&item.displayPrice)||null;
        emit(product?'available':'unavailable',{product});
        return {product,reason:product?null:'product_unavailable'};
      }catch(_){product=null;emit('error');return {product:null,reason:'product_load_failed'};}
    }
    async function submit(purchase){
      if(!purchase?.purchaseToken||!purchase.productIds?.includes(productId))
        throw new Error('invalid_pass_purchase');
      const verified=await api.verifyPurchase(purchase.purchaseToken);
      if(!purchase.acknowledged)await plugin.acknowledgePurchase({purchaseToken:purchase.purchaseToken});
      return verified;
    }
    async function purchase(){
      if(busy)return {purchased:false,reason:'busy'};
      if(!plugin||!api||!product)return {purchased:false,reason:'unavailable'};
      busy=true;emit('purchasing');
      try{
        const identity=await api.identity();
        const result=await plugin.purchaseSubscription({productId,offerToken:product.offerToken,
          obfuscatedAccountId:identity.playerId});
        if(result.status==='cancelled'){emit('available');return {purchased:false,reason:'cancelled'};}
        if(result.status==='pending'){emit('pending');return {purchased:false,reason:'pending'};}
        if(result.status!=='purchased')throw new Error('unexpected_purchase_status');
        const verified=await submit(result);emit('verified',{verified});return {purchased:true,verified};
      }catch(_){emit('error');return {purchased:false,reason:'verification_failed'};}
      finally{busy=false;}
    }
    async function syncCurrent(){
      if(busy||!plugin||!api||!productId)return {synced:false,reason:'unavailable'};
      busy=true;emit('syncing');
      try{
        await api.identity();
        const result=await plugin.currentSubscriptions();
        const purchases=(result.purchases||[]).filter(item=>item.status==='purchased'&&
          item.productIds?.includes(productId));
        for(const purchase of purchases)await submit(purchase);
        const verified=await api.refresh();emit('verified',{verified});
        return {synced:true,count:purchases.length,verified};
      }catch(_){emit('error');return {synced:false,reason:'sync_failed'};}
      finally{busy=false;}
    }
    async function restore(){const result=await syncCurrent();return {...result,restored:result.synced};}
    return Object.freeze({configure,loadProduct,purchase,restore,syncCurrent,
      getProduct:()=>product&&{...product},isBusy:()=>busy,isAvailable:()=>Boolean(plugin)});
  }
  function browserApi(){
    const base=()=>root.NyanOnline.API_BASE;
    return {
      async identity(){const result=await root.NyanOnlineIdentity.prepare(base());return {playerId:result.profile.playerId};},
      async verifyPurchase(purchaseToken){
        await root.NyanOnlineIdentity.request(base(),'pass-google-play-purchase',{purchaseToken});
        return root.NyanOnlineIdentity.refreshSkillView(base());
      },
      async refresh(){return root.NyanOnlineIdentity.refreshSkillView(base());}
    };
  }
  const provider=createProvider({api:browserApi(),onState:detail=>
    root.dispatchEvent?.(new root.CustomEvent('nyan-pass-google-play-state',{detail}))});
  return Object.freeze({createProvider,nativePlugin,provider});
});
