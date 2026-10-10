(function(root){
  'use strict';
  if(!root?.document||!root.NyanPurchases||!root.NyanMonetization||!root.NyanStoreUIModel)return;
  const panel=document.getElementById('storeKitPanel'),list=document.getElementById('storeKitProducts');
  const packs=document.getElementById('shopPackProducts');
  const status=document.getElementById('storeKitStatus'),restore=document.getElementById('storeKitRestore');
  const browser=document.getElementById('shopSkillBrowser'),skillList=document.getElementById('shopSkillList');
  const preview=document.getElementById('shopSkillPreview'),previewBuy=document.getElementById('shopPreviewPurchase');
  if(!panel||!list||!restore)return;
  let activeProductId=null,products=[],category='skills',role='cat',selectedSkillId=null;
  let onlineEffectiveSkillEntitlements=null;
  const platformAvailable=Boolean(root.NyanPurchases.nativePlugin());
  const skills=root.NyanSkillCatalog.SKILLS;
  const usagePolicy=root.NyanSkillCatalog.USAGE_POLICY;
  const released=name=>root.NyanReleaseFeatures?.enabled(name)!==false;
  if(usagePolicy){
    document.querySelectorAll('[data-skill-usage-summary]').forEach(node=>{node.textContent=released('ranked')
      ?usagePolicy.summary:'部屋対戦では、どちらかが持っているスキルを2人で使用できます。';});
    document.querySelectorAll('[data-skill-usage-room-description]').forEach(node=>{node.textContent=usagePolicy.room.description;});
    document.querySelectorAll('[data-skill-usage-ranked-description]').forEach(node=>{node.textContent=usagePolicy.ranked.description;});
    document.querySelectorAll('[data-skill-usage-entitlement]').forEach(node=>{node.textContent=released('pass')
      ?usagePolicy.entitlementDescription:'スキル利用権には、買い切りで購入したスキルが含まれます。';});
    document.querySelectorAll('[data-skill-usage-room-scope]').forEach(node=>{node.textContent=usagePolicy.room.scope;});
    document.querySelectorAll('[data-skill-usage-ranked-scope]').forEach(node=>{node.textContent=usagePolicy.ranked.scope;});
  }
  async function buy(productId){
    if([root.NyanMonetizationProducts.PRODUCT_IDS.REMOVE_ADS,
      root.NyanMonetizationProducts.PRODUCT_IDS.REMOVE_ADS_PLUS_SKILL_PACK_01].includes(productId))return;
    activeProductId=productId;render();const result=await root.NyanPurchases.provider.purchaseProduct(productId);activeProductId=null;
    if(result.purchased)status.textContent='購入を確認しました';else if(result.pending)status.textContent='購入承認待ちです';
    else if(result.reason==='cancelled')status.textContent='購入をキャンセルしました';else status.textContent='購入を完了できませんでした';
    await load();if(selectedSkillId)showPreview(selectedSkillId);
  }
  function card(view){
    const article=document.createElement('article');article.className='store-product-card';article.dataset.productId=view.productId;
    article.classList.toggle('is-owned',view.owned);article.classList.toggle('is-unavailable',!view.available);
    const icon=document.createElement('span');icon.className='store-product-icon';icon.textContent=view.icon;
    const copy=document.createElement('div');copy.className='store-product-copy';
    const title=document.createElement('strong');title.textContent=view.displayName;
    const ownership=document.createElement('small');ownership.className='store-product-ownership';ownership.textContent=view.ownership;
    copy.append(title);if(view.ownership)copy.append(ownership);
    const action=document.createElement('div');action.className='store-product-action';
    const button=document.createElement('button');button.type='button';button.textContent=view.purchasing?'購入中…':view.owned?view.status:(view.displayPrice||'利用不可');
    button.disabled=view.owned||!view.available||Boolean(activeProductId);button.addEventListener('click',()=>buy(view.productId));
    action.append(button);article.append(icon,copy,action);return article;
  }
  function render(){
    const views=root.NyanStoreUIModel.build(root.NyanMonetization,products,activeProductId);
    list.hidden=category!=='ads';
    list.replaceChildren();
    packs?.replaceChildren(...views.filter(view=>Boolean(view.packId)).map(card));
    restore.disabled=Boolean(activeProductId)||!platformAvailable;
    if(browser)browser.hidden=category!=='skills';
    document.querySelectorAll('[data-shop-category]').forEach(button=>button.classList.toggle('active',button.dataset.shopCategory===category));
    document.querySelectorAll('[data-shop-role]').forEach(button=>button.classList.toggle('active',button.dataset.shopRole===role));
    if(skillList){
      skillList.replaceChildren(...Object.values(skills).filter(skill=>skill.role===role).map(skill=>{
        const info=root.NyanHowToSkillDescriptions?.[skill.runtimeId==='fakePaw'?'fakepaw':skill.runtimeId==='doubleSearch'?'search':skill.runtimeId];
        const item=document.createElement('button');item.type='button';item.className='howto-preview-card shop-skill-item';
        const img=document.createElement('img');img.src=info?.image||'';img.alt='';
        const copy=document.createElement('div');copy.className='howto-preview-copy';
        const title=document.createElement('strong');title.textContent=skill.name;
        const state=document.createElement('span');state.textContent=skill.free?'無料':root.NyanMonetization.isSkillOwned(skill.id)?'所持済み':
          onlineEffectiveSkillEntitlements?.skillModeUnlocked===true&&onlineEffectiveSkillEntitlements.availableSkillIds?.includes(skill.id)?
            'オンラインで利用可能':'🔒 未所持';
        copy.append(title,state);const arrow=document.createElement('span');arrow.className='howto-preview-arrow';arrow.textContent='›';
        item.append(img,copy,arrow);item.addEventListener('click',()=>showPreview(skill.id));return item;
      }));
    }
  }
  function showPreview(skillId){
    const skill=skills[skillId];if(!skill||!preview)return;
    selectedSkillId=skillId;
    const info=root.NyanHowToSkillDescriptions?.[skill.runtimeId==='fakePaw'?'fakepaw':skill.runtimeId==='doubleSearch'?'search':skill.runtimeId];
    document.getElementById('shopPreviewRole').textContent=skill.role==='cat'?'🐱 ネコのスキル':'🐕 警察のスキル';
    document.getElementById('shopPreviewName').textContent=skill.name;
    document.getElementById('shopPreviewDescription').textContent=info?.desc||'';
    const image=document.getElementById('shopPreviewImage');image.src=info?.image||'';image.alt=skill.name;
    document.getElementById('shopPreviewVisual').innerHTML=info?.visual||'';
    document.getElementById('shopPreviewDetail').innerHTML=info?.detail||'';
    const owned=root.NyanMonetization.isSkillOwned(skillId),view=root.NyanStoreUIModel.build(root.NyanMonetization,products,activeProductId).find(item=>item.skillId===skillId);
    const packIncludes=Object.values(root.NyanSkillCatalog.SKILL_PACKS).some(pack=>pack.skillIds.includes(skillId));
    const ownership=document.getElementById('shopPreviewOwnership');ownership.hidden=skill.free;
    ownership.textContent=skill.free?'':owned?'所有済み':'未所持';
    ownership.classList.toggle('is-owned',owned);
    const price=document.getElementById('shopPreviewPrice');price.hidden=skill.free||!view?.displayPrice;
    price.textContent=skill.free?'':view?.displayPrice||'';
    document.getElementById('shopPreviewPack').hidden=skill.free||!packIncludes;
    previewBuy.hidden=skill.free;previewBuy.disabled=owned||!view?.available||Boolean(activeProductId);
    previewBuy.textContent=owned?'所持済み':view?.available?'購入する':'現在購入できません';
    preview.querySelector('.shop-preview-body').scrollTop=0;
    preview.classList.add('show');preview.setAttribute('aria-hidden','false');
  }
  previewBuy?.addEventListener('click',()=>{if(selectedSkillId)buy(skills[selectedSkillId].purchaseProductId);});
  document.getElementById('shopPreviewClose')?.addEventListener('click',()=>{preview.classList.remove('show');preview.setAttribute('aria-hidden','true');selectedSkillId=null;});
  document.getElementById('shopPreviewPackLink')?.addEventListener('click',()=>{
    preview.classList.remove('show');preview.setAttribute('aria-hidden','true');selectedSkillId=null;
    const heading=document.querySelector('.shop-pack-section h3');
    heading?.scrollIntoView({block:'start'});heading?.focus({preventScroll:true});
  });
  document.querySelectorAll('[data-shop-category]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.shopCategory;selectedSkillId=null;preview?.classList.remove('show');preview?.setAttribute('aria-hidden','true');render();}));
  document.querySelectorAll('[data-shop-role]').forEach(button=>button.addEventListener('click',()=>{role=button.dataset.shopRole;render();}));
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
  root.addEventListener('nyan-online-profile',event=>{
    onlineEffectiveSkillEntitlements=event.detail?.effectiveSkillEntitlements||null;
    render();
  });
  root.NyanShopRefresh=render;
  root.NyanShopOpenSkillDetail=skillId=>{
    const skill=skills[skillId];
    if(!skill||!root.NyanStoreUIModel.DEFINITIONS.some(item=>
      item.skillId===skillId&&item.productId===skill.purchaseProductId&&
      item.hidden!==true&&item.purchasable!==false))return false;
    category='skills';role=skill.role;render();showPreview(skillId);
    return true;
  };
  restore.addEventListener('click',async()=>{
    activeProductId='restore';render();const value=await root.NyanPurchases.provider.restorePurchases();activeProductId=null;
    status.textContent=value.restored?`購入を復元しました（${value.count}件）`:'購入を復元できませんでした';await load();
  });
  render();load();
})(typeof globalThis!=='undefined'?globalThis:this);
