/* Shared rank presentation data for the online profile and reward guide. */
(function(root){
  'use strict';
  const ranks=Object.freeze([
    Object.freeze({id:'bronze',name:'ブロンズ',min:0,max:99,icon:'🥉',seasonCoins:0,frameId:'rank_bronze',arrivalRewards:['ブロンズフレーム（初期所持）']}),
    Object.freeze({id:'silver',name:'シルバー',min:100,max:199,icon:'🐾',seasonCoins:200,frameId:'rank_silver',arrivalRewards:['シルバーフレーム']}),
    Object.freeze({id:'gold',name:'ゴールド',min:200,max:349,icon:'✨',seasonCoins:400,frameId:'rank_gold',arrivalRewards:['ゴールドフレーム']}),
    Object.freeze({id:'platinum',name:'プラチナ',min:350,max:549,icon:'🌙',seasonCoins:800,frameId:'rank_platinum',arrivalRewards:['プラチナフレーム']}),
    Object.freeze({id:'diamond',name:'ダイヤ',min:550,max:799,icon:'💎',seasonCoins:1200,frameId:'rank_diamond',arrivalRewards:['ダイヤフレーム']}),
    Object.freeze({id:'master',name:'マスター',min:800,max:null,icon:'👑',seasonCoins:1500,frameId:'rank_master',arrivalRewards:['マスターフレーム','マスター限定スキン']})
  ]);
  const rank=id=>ranks.find(item=>item.id===id)||ranks[0];
  const formatCoins=value=>Number(value).toLocaleString('ja-JP');

  let modal=null,lastFocus=null;
  function card(item){
    const rpLabel=item.max===null
      ?`${item.min.toLocaleString('ja-JP')} RP以上`
      :`${item.min.toLocaleString('ja-JP')}〜${item.max.toLocaleString('ja-JP')} RP`;
    const rewards=item.arrivalRewards.length
      ?item.arrivalRewards.map(reward=>`<li>${reward}</li>`).join('')
      :'<li>到達報酬なし</li>';
    const frame=item.frameId
      ?`<span class="rank-reward-frame ranked-frame ranked-frame-preview" data-frame-id="${item.frameId}" aria-hidden="true">🐾</span>`
      :`<span class="rank-reward-frame rank-reward-frame-none" aria-hidden="true">—</span>`;
    return `<article class="rank-reward-card rank-reward-${item.id}">
      <header><span aria-hidden="true">${item.icon}</span><div><strong>${item.name}</strong><small>${rpLabel}</small></div></header>
      <div class="rank-reward-coin"><span class="rank-coin-icon" aria-hidden="true">🪙</span><strong>×${formatCoins(item.seasonCoins)}</strong><small>シーズン報酬</small></div>
      <div class="rank-arrival-reward">${frame}<div><small>到達報酬</small><ul>${rewards}</ul></div></div>
    </article>`;
  }
  function ensureModal(){
    if(modal)return modal;
    modal=document.createElement('section');
    modal.id='rankRewardsModal';modal.className='rank-rewards-modal';modal.hidden=true;
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','rankRewardsTitle');
    modal.innerHTML=`<div class="rank-rewards-shell">
      <header class="rank-rewards-header"><div><small>ランク戦</small><h2 id="rankRewardsTitle">報酬一覧</h2></div><button type="button" data-rank-rewards-close aria-label="報酬一覧を閉じる">×</button></header>
      <div class="rank-rewards-scroll">
        <div class="rank-reward-rules"><p><strong>到達報酬</strong><span>ランク到達時に獲得</span></p><p><strong>シーズン報酬</strong><span>終了時の最終ランクで決定</span></p></div>
        <div class="rank-reward-list">${ranks.map(card).join('')}</div>
      </div>
      <footer><button class="btn pink" type="button" data-rank-rewards-close>閉じる</button></footer>
    </div>`;
    document.body.append(modal);
    modal.querySelectorAll('.ranked-frame-preview').forEach(frame=>root.NyanOnlineProfileUI?.setFrame(frame,frame.dataset.frameId));
    modal.querySelectorAll('[data-rank-rewards-close]').forEach(button=>button.addEventListener('click',close));
    modal.addEventListener('click',event=>{if(event.target===modal)close();});
    modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});
    return modal;
  }
  function open(trigger){
    const element=ensureModal();lastFocus=trigger||document.activeElement;
    element.hidden=false;document.body.classList.add('rank-rewards-open');
    element.querySelector('[data-rank-rewards-close]')?.focus();
  }
  function close(){
    if(!modal)return;modal.hidden=true;document.body.classList.remove('rank-rewards-open');lastFocus?.focus?.();lastFocus=null;
  }
  function attach(container){
    container?.querySelector('[data-rank-rewards-open]')?.addEventListener('click',event=>open(event.currentTarget));
  }
  const api=Object.freeze({ranks,rank,formatCoins,attach,open,close});
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.NyanRankRewards=api;
})(globalThis);
