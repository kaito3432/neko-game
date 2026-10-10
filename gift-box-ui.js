(function(root){
  'use strict';
  const openButton=document.getElementById('giftBoxOpenBtn');
  const badge=document.getElementById('giftBoxBadge');
  if(!openButton||!badge)return;
  const modal=document.createElement('section');
  modal.className='gift-box-modal';modal.hidden=true;
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','ギフトボックス');
  modal.innerHTML='<div class="gift-box-shell"><h2>🎁 ギフトボックス</h2><p data-gift-message role="status"></p><div data-gift-list></div><button type="button" class="gift-box-close">閉じる</button></div>';
  document.body.append(modal);
  let gifts=[],busy=false;
  const message=modal.querySelector('[data-gift-message]');
  const list=modal.querySelector('[data-gift-list]');
  const date=value=>new Date(value).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'});
  function render(){
    const now=Date.now();
    gifts=gifts.map(g=>({...g,status:g.claimed?'claimed':now>=g.expiresAt?'expired':'claimable'}));
    const claimable=gifts.filter(g=>g.status==='claimable');
    badge.hidden=claimable.length===0;badge.textContent=String(claimable.length);
    list.replaceChildren();
    if(!gifts.length){const p=document.createElement('p');p.textContent='現在ギフトはありません。';list.append(p);return;}
    for(const gift of [...gifts].reverse()){
      const row=document.createElement('div');row.className='gift-box-item';
      const info=document.createElement('div'),source=document.createElement('small'),title=document.createElement('strong'),limit=document.createElement('small');
      source.textContent=gift.source==='NYAN_CHASE_PASS_LOGIN'?'にゃんチェイスパス ログイン特典':gift.source;
      title.textContent=gift.rewardType==='STAMINA'?`⚡ スタミナ +${gift.amount}`:`${gift.rewardType} +${gift.amount}`;
      limit.textContent=`受取期限：${date(gift.expiresAt)} · ${gift.status==='claimed'?'受取済み':gift.status==='expired'?'期限切れ':'未受取'}`;
      info.append(source,title,limit);row.append(info);
      if(gift.status==='claimable'){
        const button=document.createElement('button');button.type='button';button.textContent='受け取る';button.disabled=busy;
        button.addEventListener('click',()=>claim(gift.rewardId));row.append(button);
      }
      list.append(row);
    }
  }
  async function fetchGifts(){
    await root.NyanOnline.prepareIdentity();
    const result=await root.NyanOnlineIdentity.request(root.NyanOnline.API_BASE,'gifts',null,'GET');
    gifts=result.giftBox?.rewards||[];render();
    root.dispatchEvent(new root.CustomEvent('nyan-gift-box-updated',{detail:{passSummary:result.passSummary,giftBox:result.giftBox}}));
  }
  async function claim(rewardId){
    if(busy)return;busy=true;message.textContent='受け取っています…';render();
    try{
      const result=await root.NyanOnlineIdentity.request(root.NyanOnline.API_BASE,'gift-claim',{rewardId});
      gifts=result.giftBox?.rewards||[];
      if(result.profile)root.NyanRankedStaminaUI?.update(result.profile);
      root.dispatchEvent(new root.CustomEvent('nyan-gift-box-updated',{detail:{passSummary:result.passSummary,giftBox:result.giftBox}}));
      message.textContent='ギフトを受け取りました。';
    }catch(error){message.textContent=error.message==='gift_expired'?'受取期限が過ぎています。':'ギフトを受け取れませんでした。';
      await fetchGifts().catch(()=>{});
    }finally{busy=false;render();}
  }
  openButton.addEventListener('click',async()=>{
    if(root.NyanReleaseFeatures?.enabled('pass')===false)return;
    modal.hidden=false;message.textContent='読み込み中…';modal.querySelector('.gift-box-close').focus();
    try{await fetchGifts();message.textContent='';}catch(_){message.textContent='ギフトを読み込めませんでした。';}
  });
  modal.querySelector('.gift-box-close').addEventListener('click',()=>{modal.hidden=true;openButton.focus();});
  root.addEventListener('nyan-online-profile',event=>{
    const box=event.detail?.profile?.giftBox;if(box?.rewards){
      const now=Date.now();gifts=box.rewards.map(g=>({...g,status:g.claimed?'claimed':now>=g.expiresAt?'expired':'claimable'}));render();
    }
  });
  root.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')render();});
  root.setInterval(render,60000);
})(globalThis);
