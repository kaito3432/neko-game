(function(root){
  'use strict';
  const entry=document.getElementById('passOpenBtn');
  if(!entry)return;
  const modal=document.createElement('section');
  modal.className='pass-overlay';modal.hidden=true;modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','にゃんチェイスパス');
  modal.innerHTML=`<div class="pass-shell">
    <header class="pass-header"><button type="button" data-pass-close aria-label="パス画面を閉じる">←</button><h2>にゃんチェイスパス</h2></header>
    <p data-pass-message role="status"></p>
    <div class="pass-loading" data-pass-loading aria-hidden="true"><div></div><div></div><div></div></div>
    <button type="button" data-pass-refresh hidden>再試行</button>
    <div class="pass-content" hidden>
      <div class="pass-top"><strong data-pass-status></strong><span data-pass-price></span></div>
      <div class="pass-grid">
        <section class="pass-card pass-skin" aria-label="今月の限定Skin">
          <div class="pass-skin-kicker"><span data-pass-month>今月の限定Skin</span><span>✦ PASS EXCLUSIVE</span></div>
          <h3 data-pass-skin-name>今月の限定Skin</h3>
          <div class="pass-skin-art" data-pass-skin></div>
          <p class="pass-skin-description" data-pass-skin-description></p>
          <strong class="pass-skin-state" data-pass-skin-state></strong>
          <small>獲得した限定SkinはPass終了後も使用できます。</small>
        </section>
        <div class="pass-benefits">
          <section class="pass-benefit"><span aria-hidden="true">🌟</span><strong>限定Skin</strong><small>今月だけの特別な姿</small></section>
          <section class="pass-benefit"><span aria-hidden="true">✨</span><strong>対象Skill全種類利用可能</strong><small data-pass-skills></small></section>
          <section class="pass-benefit"><span aria-hidden="true">⚡</span><strong>最大30 Stamina</strong><small>ログインで段階的に獲得</small></section>
        </div>
      </div>
      <div class="pass-cta"><button type="button" data-pass-join disabled>にゃんチェイスパスに加入</button><button type="button" data-pass-retry hidden>価格を再取得</button><button type="button" data-pass-restore>購入を復元</button><small data-pass-store-note></small></div>
      <p class="pass-skill-note">Pass加入だけではSkill Modeは解放されません。<small>広告を3回視聴するとSkill Modeは永続解放されます。解放後はPass期間中、対象Skillを利用できます。</small></p>
      <section class="pass-card pass-login"><div class="pass-section-head"><h3>⚡ ログインスタミナ特典</h3><strong data-pass-progress></strong></div>
        <progress data-pass-progress-bar max="15" value="0" aria-label="ログイン特典の進捗"></progress>
        <div class="pass-login-tiers"><span>1〜5回 <b>+1 ×5</b></span><span>6〜10回 <b>+2 ×5</b></span><span>11〜15回 <b>+3 ×5</b></span></div>
        <strong class="pass-next" data-pass-next></strong><small>1購読期間で最大30スタミナ。連続ログインは不要です。</small></section>
      <section class="pass-card pass-gifts"><div class="pass-section-head"><h3>🎁 プレゼントボックス</h3><strong data-pass-gifts></strong></div>
        <button type="button" data-pass-gift-open>プレゼントを見る</button><small>ログイン特典は発行から90日以内に受け取れます。Pass終了後も期限内なら受取可能です。</small></section>
      <section class="pass-card pass-subscription"><h3>購読状況</h3><p data-pass-expiration></p><p data-pass-renew></p></section>
      <details class="pass-faq"><summary>Passについて、もう少し詳しく</summary>
        <p><strong>Skinは解約後も残る？</strong><br>獲得済みの限定Skinは残ります。</p>
        <p><strong>Skill Modeも解放される？</strong><br>Pass加入だけでは解放されません。広告を3回視聴すると永続解放されます。</p>
        <p><strong>Pass対象Skillは？</strong><br>Skill Mode解放済みなら、Pass期間中に利用できます。終了後は未購入の対象Skillだけ利用できなくなり、個別購入済みSkillは残ります。</p>
        <p><strong>Stamina報酬は？</strong><br>プレゼントボックスから90日以内に受け取れます。</p>
      </details>
    </div>
  </div>`;
  document.body.append(modal);
  const q=selector=>modal.querySelector(selector);
  let summary=null;
  const store=root.NyanPassStoreKit?.provider;
  let storeBusy=false,storeMessage='',loadedProductKey=null,productLoadPromise=null,syncedKey=null;
  const date=timestamp=>new Date(timestamp).toLocaleDateString('ja-JP',
    {timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric'});
  const monthLabel=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value||'')
    ?`${value.slice(0,4)}年${Number(value.slice(5))}月限定`:'今月の限定Skin';
  function render(){
    const state=root.NyanPassUIState?.fromServer(summary,root.NyanCollectionCatalog,store?.getProduct());
    q('.pass-content').hidden=!state;
    if(!state)return;
    q('[data-pass-status]').textContent=state.active?'✦ Pass加入中  ACTIVE':state.expired?'にゃんチェイスパスは終了しました':'✦ 今月のPass特典';
    q('[data-pass-price]').textContent=state.price.text;
    const skin=q('[data-pass-skin]');skin.replaceChildren();
    q('[data-pass-month]').textContent=monthLabel(state.currentMonthKey);
    if(state.currentSkin){
      if(state.currentSkin.image){const image=document.createElement('img');image.src=state.currentSkin.image;
        image.alt=state.currentSkin.name;skin.append(image);}
      q('[data-pass-skin-name]').textContent=state.currentSkin.name;
      q('[data-pass-skin-description]').textContent=state.currentSkin.description;
      q('[data-pass-skin-state]').textContent=state.skinOwned?'獲得済み ✓':state.active
        ?state.currentSkinPreview?'公開月の開始後に獲得':'獲得処理中':'Pass加入で獲得';
    }else{
      skin.textContent='今月の限定Skinは準備中です。';
      q('[data-pass-skin-name]').textContent='今月の限定Skin';
      q('[data-pass-skin-description]').textContent='公開情報をお待ちください。';
      q('[data-pass-skin-state]').textContent='準備中';
    }
    q('[data-pass-skills]').textContent=`現在の対象：${state.eligibleSkillCount}種類`;
    q('[data-pass-progress]').textContent=`${state.loginCount} / ${state.maxLoginCount}`;
    const progress=q('[data-pass-progress-bar]');progress.max=state.maxLoginCount||15;progress.value=state.loginCount;
    q('[data-pass-next]').textContent=state.active
      ?state.nextLoginReward?`次回：スタミナ +${state.nextLoginReward}`:'今期のログイン特典をすべて獲得しました'
      :'加入後のログインから進捗が始まります';
    q('[data-pass-gifts]').textContent=state.giftCount?`未受取 ${state.giftCount}件`:'未受取 0件';
    q('[data-pass-gift-open]').textContent=state.giftCount?'受け取る':'プレゼントボックスを見る';
    q('[data-pass-expiration]').textContent=state.expiresAt
      ?`有効期限：${date(state.expiresAt)}`:'有効な購読期間はありません。';
    q('[data-pass-renew]').textContent=state.active
      ?state.autoRenew?'自動更新ON':`自動更新は停止されています。${date(state.expiresAt)}までは特典を利用できます。`
      :state.expired?'獲得済みSkinと期限内のGiftは引き続き残ります。':'加入すると特典を利用できます。';
    const join=q('[data-pass-join]');
    join.disabled=storeBusy||state.active||!state.canPurchase;
    join.textContent=storeBusy?'処理中…':state.canPurchase?'にゃんチェイスパスに加入':'にゃんチェイスパスに加入（準備中）';
    q('[data-pass-retry]').hidden=state.canPurchase||!state.productId;
    q('[data-pass-retry]').disabled=storeBusy;
    q('[data-pass-restore]').disabled=storeBusy||!state.productId||!store?.isAvailable();
    q('[data-pass-store-note]').textContent=storeMessage||(!state.canPurchase?'購入準備中。現在は加入手続きを開始できません。':'');
    q('.pass-cta').hidden=false;
    join.hidden=state.active;
    q('[data-pass-retry]').hidden=state.active||q('[data-pass-retry]').hidden;
  }
  async function loadProduct(){
    if(!summary?.productId||!summary?.subscriptionGroupId||!store)return;
    const key=`${summary.productId}:${summary.subscriptionGroupId}`;
    store.configure({productId:summary.productId,groupId:summary.subscriptionGroupId});
    if(loadedProductKey===key&&store.getProduct())return;
    if(productLoadPromise)return productLoadPromise;
    storeMessage='価格を読み込み中…';render();
    productLoadPromise=(async()=>{
      const result=await store.loadProduct();
      loadedProductKey=result.product?key:null;
      storeMessage=result.product?'':'価格を取得できませんでした。';render();
      if(result.product&&syncedKey!==key){
        syncedKey=key;
        await store.syncCurrent();
      }
    })();
    try{await productLoadPromise;}finally{productLoadPromise=null;}
  }
  async function refresh(){
    q('[data-pass-message]').textContent='Pass情報を確認しています…';
    q('.pass-content').hidden=true;
    q('[data-pass-loading]').hidden=false;
    q('[data-pass-refresh]').hidden=true;
    try{
      await root.NyanOnlineIdentity.prepare(root.NyanOnline.API_BASE);
      const response=await root.NyanOnlineIdentity.refreshSkillView(root.NyanOnline.API_BASE);
      summary=response.passSummary||null;
      q('[data-pass-message]').textContent=summary?'':'Pass情報を取得できませんでした。';
      q('[data-pass-loading]').hidden=true;
      q('[data-pass-refresh]').hidden=Boolean(summary);
      render();await loadProduct();
    }catch(_){q('[data-pass-message]').textContent='Pass情報を取得できませんでした。';
      q('[data-pass-loading]').hidden=true;q('[data-pass-refresh]').hidden=false;summary=null;render();}
  }
  entry.addEventListener('click',()=>{modal.hidden=false;q('[data-pass-close]').focus();refresh();});
  q('[data-pass-close]').addEventListener('click',()=>{modal.hidden=true;entry.focus();});
  q('[data-pass-gift-open]').addEventListener('click',()=>document.getElementById('giftBoxOpenBtn')?.click());
  q('[data-pass-refresh]').addEventListener('click',refresh);
  q('[data-pass-retry]').addEventListener('click',()=>{loadedProductKey=null;loadProduct();});
  q('[data-pass-join]').addEventListener('click',async()=>{
    if(storeBusy||!store)return;
    storeBusy=true;storeMessage='購入情報を確認しています…';render();
    const result=await store.purchase();
    storeBusy=false;
    storeMessage=result.purchased?'':result.reason==='cancelled'?'':'購入情報を確認できませんでした。もう一度お試しください。';
    if(result.purchased)await refresh();else render();
  });
  q('[data-pass-restore]').addEventListener('click',async()=>{
    if(storeBusy||!store)return;
    storeBusy=true;storeMessage='復元中…';render();
    const result=await store.restore();
    storeBusy=false;storeMessage=result.restored?'購入情報を確認しました。':'購入情報を確認できませんでした。もう一度お試しください。';
    if(result.restored)await refresh();else render();
  });
  root.addEventListener('nyan-online-profile',event=>{if(event.detail?.passSummary){summary=event.detail.passSummary;render();loadProduct();}});
  root.addEventListener('nyan-gift-box-updated',event=>{if(event.detail?.passSummary){summary=event.detail.passSummary;render();}});
  root.addEventListener('nyan-pass-storekit-state',event=>{if(event.detail?.state==='verified'&&!modal.hidden)refresh();});
})(globalThis);
