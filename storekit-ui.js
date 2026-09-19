(function(root){
  'use strict';
  if(!root?.document||!root.NyanPurchases||!root.NyanMonetization||!root.NyanStoreUIModel)return;
  const panel=document.getElementById('storeKitPanel'),list=document.getElementById('storeKitProducts');
  const status=document.getElementById('storeKitStatus'),restore=document.getElementById('storeKitRestore');
  if(!panel||!list||!restore)return;
  let activeProductId=null,products=[];
  const platformAvailable=Boolean(root.NyanPurchases.nativePlugin());
  function card(view){
    const article=document.createElement('article');article.className='store-product-card';article.dataset.productId=view.productId;
    article.classList.toggle('is-owned',view.owned);article.classList.toggle('is-unavailable',!view.available);
    const icon=document.createElement('span');icon.className='store-product-icon';icon.textContent=view.icon;
    const copy=document.createElement('div');copy.className='store-product-copy';
    const title=document.createElement('strong');title.textContent=view.displayName;
    const description=document.createElement('small');description.textContent=view.storeDescription;
    const ownership=document.createElement('small');ownership.className='store-product-ownership';ownership.textContent=view.ownership;
    copy.append(title,description);if(view.ownership)copy.append(ownership);
    const action=document.createElement('div');action.className='store-product-action';
    const state=document.createElement('span');state.className='store-product-state';state.textContent=view.status;
    const button=document.createElement('button');button.type='button';button.textContent=view.purchasing?'購入中…':view.owned?view.status:(view.displayPrice||'利用不可');
    button.disabled=view.owned||!view.available||Boolean(activeProductId);button.addEventListener('click',async()=>{
      activeProductId=view.productId;render();const result=await root.NyanPurchases.provider.purchaseProduct(view.productId);activeProductId=null;
      if(result.purchased)status.textContent='購入を確認しました';else if(result.pending)status.textContent='購入承認待ちです';
      else if(result.reason==='cancelled')status.textContent='購入をキャンセルしました';else status.textContent='購入を完了できませんでした';
      await load();
    });
    action.append(state,button);article.append(icon,copy,action);return article;
  }
  function render(){
    const views=root.NyanStoreUIModel.build(root.NyanMonetization,products,activeProductId);
    list.replaceChildren(...views.map(card));restore.disabled=Boolean(activeProductId)||!platformAvailable;
  }
  async function load(){
    if(!platformAvailable){products=[];status.textContent='この環境では購入機能を利用できません';render();return;}
    status.textContent='商品を読み込み中';const value=await root.NyanPurchases.provider.loadProducts();products=value.products||[];
    status.textContent=products.length===root.NyanPurchases.PRODUCT_IDS.length?'購入可能です':'現在商品を利用できません';render();
  }
  const purchaseState=event=>{
    const value=event.detail||{};if(value.state==='purchasing')activeProductId=value.productId;
    const labels={loading:'商品を読み込み中',purchasing:'購入手続きを開いています',restoring:'購入履歴を復元中',pending:'購入承認待ちです',error:'購入機能でエラーが発生しました',purchased:'購入を確認しました'};
    if(labels[value.state])status.textContent=labels[value.state];render();
  };
  root.addEventListener('nyan-storekit-state',purchaseState);
  root.addEventListener('nyan-purchase-state',purchaseState);
  root.addEventListener('nyan-storekit-entitlements',()=>{activeProductId=null;render();});
  root.addEventListener('nyan-purchase-entitlements',()=>{activeProductId=null;render();});
  root.addEventListener('nyan-online-profile',render);
  restore.addEventListener('click',async()=>{
    activeProductId='restore';render();const value=await root.NyanPurchases.provider.restorePurchases();activeProductId=null;
    status.textContent=value.restored?`購入を復元しました（${value.count}件）`:'購入を復元できませんでした';await load();
  });
  render();load();
})(typeof globalThis!=='undefined'?globalThis:this);
