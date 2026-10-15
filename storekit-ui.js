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
  let selectedPack=false;
  let onlineEffectiveSkillEntitlements=null;
  const platformAvailable=Boolean(root.NyanPurchases.nativePlugin());
  const skills=root.NyanSkillCatalog.SKILLS;
  const usagePolicy=root.NyanSkillCatalog.USAGE_POLICY;
  const released=name=>root.NyanReleaseFeatures?.enabled(name)!==false;
  if(usagePolicy){
    document.querySelectorAll('[data-skill-usage-summary]').forEach(node=>{node.textContent=usagePolicy.summary;});
    document.querySelectorAll('[data-skill-usage-room-description]').forEach(node=>{node.textContent=usagePolicy.room.description;});
    document.querySelectorAll('[data-skill-usage-ranked-description]').forEach(node=>{node.textContent=usagePolicy.ranked.description;});
    document.querySelectorAll('[data-skill-usage-entitlement]').forEach(node=>{node.textContent=released('pass')
      ?usagePolicy.entitlementDescription:'スキル利用権には、買い切りで購入したスキルが含まれます。';});
    document.querySelectorAll('[data-skill-usage-room-scope]').forEach(node=>{node.textContent=usagePolicy.room.scope;});
    document.querySelectorAll('[data-skill-usage-ranked-scope]').forEach(node=>{node.textContent=usagePolicy.ranked.scope;});
  }
  async function buy(productId){
    if(productId==='SKILL_PACK_01'&&root.NyanStoreUIModel.packPurchaseReason(root.NyanMonetization))return;
    if([root.NyanMonetizationProducts.PRODUCT_IDS.REMOVE_ADS,
      root.NyanMonetizationProducts.PRODUCT_IDS.REMOVE_ADS_PLUS_SKILL_PACK_01].includes(productId))return;
    activeProductId=productId;render();const result=await root.NyanPurchases.provider.purchaseProduct(productId);activeProductId=null;
    if(result.purchased)status.textContent='購入を確認しました';else if(result.pending)status.textContent='購入承認待ちです';
    else if(result.reason==='cancelled')status.textContent='購入をキャンセルしました';else status.textContent='購入を完了できませんでした';
    await load();if(selectedPack)showPackPreview();else if(selectedSkillId)showPreview(selectedSkillId);
  }
  function card(view){
    const article=document.createElement('article');article.className='store-product-card';article.dataset.productId=view.productId;
    article.classList.toggle('is-owned',view.owned);article.classList.toggle('is-unavailable',!view.available);
    const icon=document.createElement('span');icon.className='store-product-icon';icon.textContent=view.icon;
    const copy=document.createElement('div');copy.className='store-product-copy';
    const title=document.createElement('strong');title.textContent=view.displayName;
    const ownership=document.createElement('small');ownership.className='store-product-ownership';ownership.textContent=view.purchaseBlockedReason==='individualSkillOwned'?view.purchaseBlockedLabel:view.ownership;
    copy.append(title);if(ownership.textContent)copy.append(ownership);
    const action=document.createElement('div');action.className='store-product-action';
    if(view.packId){
      article.classList.add('shop-pack-card');
      const price=document.createElement('div');price.className='shop-pack-price-label';
      const savings=root.NyanStoreUIModel.packSavings(products);
      if(savings&&!view.owned){
        const total=document.createElement('small');total.className='shop-pack-original-price';total.textContent=`単品合計 ${savings.total}`;
        const badge=document.createElement('span');badge.className='shop-pack-saving-badge';badge.textContent=`${savings.saving} お得`;
        price.append(total,badge);
      }
      const amount=document.createElement('strong');amount.className='shop-pack-price-amount';
      amount.textContent=view.owned?'購入済み':view.displayPrice||'価格を確認中';price.append(amount);copy.append(price);
      const detail=document.createElement('button');detail.type='button';detail.textContent='詳細を見る';
      detail.className='shop-pack-detail-button';detail.addEventListener('click',showPackPreview);action.append(detail);
    }else{
      const button=document.createElement('button');button.type='button';button.textContent=view.purchaseBlockedReason==='individualSkillOwned'?'購入不可':view.purchaseBlockedLabel|| (view.purchasing?'購入中…':view.owned?view.status:(view.displayPrice||'利用不可'));
      button.dataset.purchaseProduct=view.productId;
      button.disabled=view.owned||!view.available||Boolean(activeProductId);button.addEventListener('click',()=>buy(view.productId));action.append(button);
    }
    article.append(icon,copy,action);return article;
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
    selectedPack=false;selectedSkillId=skillId;
    const info=root.NyanHowToSkillDescriptions?.[skill.runtimeId==='fakePaw'?'fakepaw':skill.runtimeId==='doubleSearch'?'search':skill.runtimeId];
    document.getElementById('shopPreviewRole').textContent=skill.role==='cat'?'🐱 ネコのスキル':'🐕 警察のスキル';
    document.getElementById('shopPreviewName').textContent=skill.name;
    document.getElementById('shopPreviewDescription').textContent=info?.desc||'';
    const image=document.getElementById('shopPreviewImage');image.hidden=false;image.src=info?.image||'';image.alt=skill.name;
    document.getElementById('shopPreviewVisual').classList.remove('shop-pack-contents');
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
  function showPackPreview(){
    const view=root.NyanStoreUIModel.build(root.NyanMonetization,products,activeProductId).find(v=>v.productId==='SKILL_PACK_01');
    if(!view||!preview)return;
    selectedSkillId=null;selectedPack=true;
    document.getElementById('shopPreviewRole').textContent='🎁 3つの有料スキルをまとめて解放';
    document.getElementById('shopPreviewName').textContent='スキル3点パック';
    document.getElementById('shopPreviewDescription').textContent='ネコも警察も、まとめて楽しもう！';
    const image=document.getElementById('shopPreviewImage');image.removeAttribute('src');image.alt='';image.hidden=true;
    const ownership=document.getElementById('shopPreviewOwnership');ownership.hidden=false;
    ownership.textContent=view.owned?'所有済み':'未所持';ownership.classList.toggle('is-owned',view.owned);
    const visual=document.getElementById('shopPreviewVisual');visual.classList.add('shop-pack-contents');visual.replaceChildren();
    for(const id of ['CAT_FAKE_PAW','POLICE_DASH','POLICE_GROUP_SEARCH']){
      const skill=skills[id],runtime=skill.runtimeId==='fakePaw'?'fakepaw':skill.runtimeId==='doubleSearch'?'search':skill.runtimeId;
      const info=root.NyanHowToSkillDescriptions?.[runtime];
      const row=document.createElement('div');row.className='shop-pack-skill';
      const art=document.createElement('img');art.src=info?.image||'';art.alt='';
      const copy=document.createElement('div'),name=document.createElement('strong'),desc=document.createElement('small');
      name.textContent=skill.name;desc.textContent=(skill.role==='cat'?'ネコ用：':'警察用：')+(info?.desc||'');
      copy.append(name,desc);row.append(art,copy);visual.append(row);
    }
    const detail=document.getElementById('shopPreviewDetail');detail.replaceChildren();
    const savings=root.NyanStoreUIModel.packSavings(products);
    if(savings){const offer=document.createElement('strong');offer.className='shop-pack-savings';offer.textContent=`単品合計 ${savings.total} より ${savings.saving} お得！`;detail.append(offer);}
    const note=document.createElement('p');note.textContent='買い切り・3スキルを永久解放。使用にはスキルモードの解放が別途必要です（リワード広告3回・報酬確認後）。対象スキルを単品で所持している場合は、重複購入を防ぐためパックを購入できません。';detail.append(note);
    const price=document.getElementById('shopPreviewPrice');price.hidden=!view.displayPrice;price.textContent=view.displayPrice;
    previewBuy.hidden=false;previewBuy.disabled=view.owned||!view.available||Boolean(activeProductId);
    previewBuy.textContent=view.owned?'所持済み':view.purchaseBlockedLabel||(view.available?'パックを購入する':'現在購入できません');
    document.getElementById('shopPreviewPack').hidden=true;
    preview.querySelector('.shop-preview-body').scrollTop=0;
    preview.classList.add('show');preview.setAttribute('aria-hidden','false');
  }
  previewBuy?.addEventListener('click',()=>{if(selectedPack)buy('SKILL_PACK_01');else if(selectedSkillId)buy(skills[selectedSkillId].purchaseProductId);});
  document.getElementById('shopPreviewClose')?.addEventListener('click',()=>{preview.classList.remove('show');preview.setAttribute('aria-hidden','true');selectedSkillId=null;selectedPack=false;});
  document.getElementById('shopPreviewPackLink')?.addEventListener('click',showPackPreview);
  document.querySelectorAll('[data-shop-category]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.shopCategory;selectedSkillId=null;preview?.classList.remove('show');preview?.setAttribute('aria-hidden','true');render();}));
  document.querySelectorAll('[data-shop-role]').forEach(button=>button.addEventListener('click',()=>{role=button.dataset.shopRole;render();}));
  async function load(){
    if(!platformAvailable){products=[];status.textContent='この環境では購入機能を利用できません';render();return;}
    status.textContent='商品を読み込み中';const value=await root.NyanPurchases.provider.loadProducts();products=value.products||[];
    const availableIds=new Set(products.map(product=>product.productId));
    const expectedIds=root.NyanStoreProductIds.initial;
    status.textContent=expectedIds.every(id=>availableIds.has(id))?'購入可能です':
      expectedIds.some(id=>availableIds.has(id))?'一部の商品を読み込めませんでした。時間をおいて再度お試しください':
      '商品を読み込めませんでした。通信環境を確認して再度お試しください';render();
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
    await load();
    status.textContent=value.restored?`購入を復元しました（${value.count}件）`:value.reason==='cancelled'?'購入の復元をキャンセルしました':value.reason==='noPurchases'?'復元対象の購入が見つかりませんでした':'購入を復元できませんでした';
  });
  render();load();
})(typeof globalThis!=='undefined'?globalThis:this);
