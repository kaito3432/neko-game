(function(factory){
  const api=factory(typeof globalThis!=='undefined'?globalThis:this);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else globalThis.NyanPassStoreKit=api;
})(function(root){
  'use strict';
  const nativePlugin=scope=>{
    const cap=scope?.Capacitor;
    return cap?.getPlatform?.()==='ios'?(cap.Plugins?.NyanStoreKit||cap.registerPlugin?.('NyanStoreKit')):null;
  };
  function createProvider({plugin=nativePlugin(root),api,onState=()=>{}}={}){
    let productId=null,groupId=null,product=null,busy=false;
    const emit=(state,detail={})=>onState({state,...detail});
    function configure(config={}){
      const nextId=typeof config.productId==='string'?config.productId:null;
      const nextGroup=typeof config.groupId==='string'?config.groupId:null;
      if(nextId!==productId||nextGroup!==groupId)product=null;
      productId=nextId;groupId=nextGroup;
    }
    async function loadProduct(){
      if(!plugin||!productId||!groupId)return {product:null,reason:'unavailable'};
      emit('loading');
      try{
        const result=await plugin.loadProducts({productIds:[productId]});
        const found=(result.products||[]).find(item=>item.productId===productId&&
          item.subscriptionGroupId===groupId&&item.subscriptionPeriod?.unit==='month'&&
          item.subscriptionPeriod?.value===1&&typeof item.displayPrice==='string'&&item.displayPrice);
        product=found||null;
        emit(product?'available':'unavailable',{product});
        return {product,reason:product?null:'product_unavailable'};
      }catch(error){product=null;emit('error');return {product:null,reason:'product_load_failed'};}
    }
    async function submit(transaction){
      if(transaction?.productId!==productId||!transaction?.signedTransaction)throw new Error('invalid_pass_transaction');
      const verified=await api.verifyTransaction(transaction.signedTransaction);
      await plugin.finishTransaction({transactionId:transaction.transactionId});
      return verified;
    }
    async function purchase(){
      if(busy)return {purchased:false,reason:'busy'};
      if(!plugin||!api||!product||!productId)return {purchased:false,reason:'unavailable'};
      busy=true;emit('purchasing');
      try{
        const identity=await api.identity();
        const token=String(identity.playerId||'').replace(/^op_/,'');
        if(!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(token))throw new Error('invalid_pass_player_id');
        const result=await plugin.purchase({productId,appAccountToken:token});
        if(result.status==='cancelled'){emit('available');return {purchased:false,reason:'cancelled'};}
        if(result.status==='pending'){emit('pending');return {purchased:false,reason:'pending'};}
        if(result.status!=='purchased')throw new Error('unexpected_purchase_status');
        const verified=await submit(result.transaction);
        emit('verified',{verified});return {purchased:true,verified};
      }catch(error){emit('error');return {purchased:false,reason:'verification_failed'};}
      finally{busy=false;}
    }
    async function restore(){
      if(busy)return {restored:false,reason:'busy'};
      if(!plugin||!api||!productId)return {restored:false,reason:'unavailable'};
      busy=true;emit('restoring');
      try{
        await api.identity();
        const result=await plugin.restorePurchases();
        const transactions=(result.transactions||[]).filter(t=>t.productId===productId);
        for(const transaction of transactions)await submit(transaction);
        const refreshed=await api.refresh();
        emit('verified',{verified:refreshed});
        return {restored:true,count:transactions.length,verified:refreshed};
      }catch(error){emit('error');return {restored:false,reason:'restore_failed'};}
      finally{busy=false;}
    }
    async function syncCurrent(){
      if(busy||!plugin||!api||!productId)return {synced:false,reason:'unavailable'};
      busy=true;emit('syncing');
      try{
        await api.identity();
        const result=await plugin.currentEntitlements({productIds:[productId]});
        const transactions=(result.transactions||[]).filter(t=>t.productId===productId);
        for(const transaction of transactions)await submit(transaction);
        const refreshed=await api.refresh();
        emit('verified',{verified:refreshed});
        return {synced:true,count:transactions.length,verified:refreshed};
      }catch(error){emit('error');return {synced:false,reason:'sync_failed'};}
      finally{busy=false;}
    }
    plugin?.addListener?.('storeKitTransactionUpdated',async transaction=>{
      if(busy||transaction?.productId!==productId||!transaction?.signedTransaction)return;
      try{const verified=await submit(transaction);emit('verified',{verified});}catch(_){emit('error');}
    });
    return Object.freeze({configure,loadProduct,purchase,restore,syncCurrent,
      getProduct:()=>product&&{...product},isBusy:()=>busy,isAvailable:()=>Boolean(plugin)});
  }
  function browserApi(){
    const base=()=>root.NyanOnline.API_BASE;
    return {
      async identity(){const result=await root.NyanOnlineIdentity.prepare(base());return {playerId:result.profile.playerId};},
      async verifyTransaction(signedTransaction){
        await root.NyanOnlineIdentity.request(base(),'pass-storekit-transaction',{signedTransaction});
        return root.NyanOnlineIdentity.refreshSkillView(base());
      },
      async refresh(){
        await root.NyanOnlineIdentity.request(base(),'pass-subscription-refresh',null,'GET');
        return root.NyanOnlineIdentity.refreshSkillView(base());
      }
    };
  }
  const provider=createProvider({api:browserApi(),onState:detail=>
    root.dispatchEvent?.(new root.CustomEvent('nyan-pass-storekit-state',{detail}))});
  return Object.freeze({createProvider,nativePlugin,provider});
});
