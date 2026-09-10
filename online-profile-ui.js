/* Profile presentation is independent of battle appearance and viewer inventory. */
(function(root){
  'use strict';
  const catalog=typeof module==='object'&&module.exports?require('./collection-catalog.js'):root.NyanCollectionCatalog;
  const fallback=()=>catalog.getItem('catSkin','default')?.profileImage||'./assets/images/cpu_select_cat.png';
  function imageSource(selection){
    if(!['catSkin','dogSkin'].includes(selection?.category))return fallback();
    return catalog.getItem(selection.category,selection.itemId)?.profileImage||fallback();
  }
  function setImage(image,selection){
    image.onerror=()=>{image.onerror=null;image.src=fallback();};
    image.src=imageSource(selection);
  }
  function opponentProfile(data){
    if(data?.matchType!=='randomMatch'||!data.matchId)return null;
    const seat=data.player,other=seat==='host'?'guest':seat==='guest'?'host':null;
    if(!other||!data.playerId||data.participants?.[seat]!==data.playerId)return null;
    const peer=data.playerProfiles?.[other];
    return peer?.playerId && peer.playerId!==data.playerId && peer.playerId===data.participants?.[other]?peer:null;
  }
  const api={imageSource,setImage,opponentProfile};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.NyanOnlineProfileUI=api;
  if(!root.document)return;
  const badges=[];
  for(const selector of ['#onlineStatus','#onlineRuleOverlay h2','#catAbilityOverlay .ability-select-header',
    '#policeAbilityOverlay .ability-select-header','#resultText']){
    const anchor=document.querySelector(selector);
    if(!anchor)continue;
    const badge=document.createElement('div');
    badge.className='online-opponent-profile';badge.hidden=true;
    const image=document.createElement('img');image.alt='対戦相手のプロフィールアイコン';
    const label=document.createElement('span');label.textContent='対戦相手';
    badge.append(image,label);anchor.after(badge);badges.push(badge);
  }
  root.addEventListener('nyan-online-player-profiles',({detail})=>{
    const peer=opponentProfile(detail);
    for(const badge of badges){
      badge.hidden=!peer;
      if(peer){badge.dataset.playerId=peer.playerId;setImage(badge.querySelector('img'),peer.profileCharacter);}
      else{delete badge.dataset.playerId;badge.querySelector('img').removeAttribute('src');}
    }
  });
  // Reuse the authenticated prepare boundary; no offline data is overwritten.
  root.addEventListener('nyan-player-appearance-changed',()=>{
    if(root.NyanOnlineIdentity?.hasCredential())root.NyanRankedUI?.refresh();
  });
})(globalThis);
