/* Profile presentation is independent of battle appearance and viewer inventory. */
(function(root){
  'use strict';
  const catalog=typeof module==='object'&&module.exports?require('./collection-catalog.js'):root.NyanCollectionCatalog;
  const frames=Object.freeze({default:'フレームなし',rank_bronze:'肉球ブロンズフレーム',
    rank_silver:'足あとシルバーフレーム',rank_gold:'きらめきゴールドフレーム',
    rank_platinum:'月夜のプラチナフレーム',rank_diamond:'宝石肉球ダイヤフレーム',
    rank_master:'にゃんチェイス・マスターフレーム'});
  const fallback=()=>catalog.getItem('catSkin','default')?.profileImage||'./assets/images/cpu_select_cat.png';
  function imageSource(selection){
    if(!['catSkin','dogSkin'].includes(selection?.category))return fallback();
    return catalog.getItem(selection.category,selection.itemId)?.profileImage||fallback();
  }
  function setImage(image,selection){
    image.onerror=()=>{image.onerror=null;image.src=fallback();};
    image.src=imageSource(selection);
  }
  const frameId=id=>Object.hasOwn(frames,id)?id:'default';
  function setFrame(element,id){element.dataset.frameId=frameId(id);}
  function opponentProfile(data){
    if(data?.matchType!=='randomMatch'||!data.matchId)return null;
    const seat=data.player,other=seat==='host'?'guest':seat==='guest'?'host':null;
    if(!other||!data.playerId||data.participants?.[seat]!==data.playerId)return null;
    const peer=data.playerProfiles?.[other];
    return peer?.playerId && peer.playerId!==data.playerId && peer.playerId===data.participants?.[other]?peer:null;
  }
  const api={imageSource,setImage,frameId,setFrame,frames,opponentProfile};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.NyanOnlineProfileUI=api;
  if(!root.document)return;
  const badges=[];
  for(const selector of ['#onlineStatus','#onlineRuleOverlay h2','#catAbilityOverlay .ability-select-header',
    '#policeAbilityOverlay .ability-select-header','#abilityRevealOverlay .ability-vs-title','#resultText']){
    const anchor=document.querySelector(selector);
    if(!anchor)continue;
    const badge=document.createElement('div');
    badge.className='online-opponent-profile';badge.hidden=true;
    const frame=document.createElement('span');frame.className='ranked-frame-preview online-profile-frame';
    const image=document.createElement('img');image.alt='対戦相手のプロフィールアイコン';frame.append(image);
    const label=document.createElement('span');label.textContent='対戦相手';
    badge.append(frame,label);anchor.after(badge);badges.push(badge);
  }
  root.addEventListener('nyan-online-player-profiles',({detail})=>{
    const peer=opponentProfile(detail);
    for(const badge of badges){
      badge.hidden=!peer;
      if(peer){badge.dataset.playerId=peer.playerId;setFrame(badge.querySelector('.online-profile-frame'),peer.equippedProfileFrameId);setImage(badge.querySelector('img'),peer.profileCharacter);}
      else{delete badge.dataset.playerId;setFrame(badge.querySelector('.online-profile-frame'),'default');badge.querySelector('img').removeAttribute('src');}
    }
  });
  // Reuse the authenticated prepare boundary; no offline data is overwritten.
  root.addEventListener('nyan-player-appearance-changed',()=>{
    if(root.NyanOnlineIdentity?.hasCredential())root.NyanRankedUI?.refresh();
  });
})(globalThis);
