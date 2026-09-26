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
  function ensureAvatarClip(element){
    if(!element?.querySelector||!root.document)return null;
    let clip=element.querySelector(':scope > .ranked-avatar-clip');
    if(clip)return clip;
    const avatar=element.querySelector(':scope > img:not(.ranked-frame-overlay)');
    if(!avatar)return null;
    clip=root.document.createElement('span');
    clip.className='ranked-avatar-clip';
    element.insertBefore(clip,avatar);
    clip.append(avatar);
    return clip;
  }
  const frameId=id=>Object.hasOwn(frames,id)?id:'default';
  function frameSource(id){
    const valid=frameId(id);
    return valid==='default'?null:catalog.getItem('profileFrame',valid)?.frameImage||null;
  }
  function setFrame(element,id){
    const valid=frameId(id);element.dataset.frameId=valid;
    if(!element?.querySelector||!root.document)return valid;
    ensureAvatarClip(element);
    let overlay=element.querySelector('.ranked-frame-image,.ranked-frame-overlay');
    const source=frameSource(valid);
    element.classList.remove('has-frame-image');
    if(!source){overlay?.remove();return valid;}
    if(!overlay){overlay=root.document.createElement('img');overlay.className='ranked-frame-image ranked-frame-overlay';overlay.alt='';overlay.setAttribute('aria-hidden','true');element.append(overlay);}
    element.classList.add('has-frame-image');
    overlay.onload=()=>element.classList.add('has-frame-image');
    overlay.onerror=()=>{overlay.remove();element.classList.remove('has-frame-image');};
    overlay.src=source;
    if(overlay.complete&&!overlay.naturalWidth){overlay.remove();element.classList.remove('has-frame-image');}
    return valid;
  }
  function opponentProfile(data){
    if(!['randomMatch','roomMatch'].includes(data?.matchType)||!data.matchId)return null;
    const seat=data.player,other=seat==='host'?'guest':seat==='guest'?'host':null;
    if(!other||!data.playerId||data.participants?.[seat]!==data.playerId)return null;
    const peer=data.playerProfiles?.[other];
    return peer?.playerId && peer.playerId!==data.playerId && peer.playerId===data.participants?.[other]?peer:null;
  }
  function ownProfile(data){
    if(!['randomMatch','roomMatch'].includes(data?.matchType)||!data.matchId)return null;
    const seat=data.player;
    if(!['host','guest'].includes(seat)||!data.playerId||data.participants?.[seat]!==data.playerId)return null;
    const own=data.profile?.playerId===data.playerId?data.profile:data.playerProfiles?.[seat];
    return own?.playerId===data.playerId?own:null;
  }
  const api={imageSource,setImage,frameId,frameSource,setFrame,frames,opponentProfile,ownProfile};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.NyanOnlineProfileUI=api;
  if(!root.document)return;
  function profileSide(side,label){
    const card=document.createElement('div');card.className='online-profile-side';card.dataset.side=side;
    const caption=document.createElement('small');caption.className='online-profile-label';caption.textContent=label;
    const frame=document.createElement('span');frame.className='ranked-frame ranked-frame-preview online-profile-frame';
    const clip=document.createElement('span');clip.className='ranked-avatar-clip';
    const image=document.createElement('img');image.alt=`${label}のプロフィールアイコン`;clip.append(image);frame.append(clip);
    const name=document.createElement('span');name.className='online-profile-name';name.textContent=label;
    card.append(caption,frame,name);return card;
  }
  function updateSide(card,profile){
    card.dataset.playerId=profile.playerId;
    setFrame(card.querySelector('.online-profile-frame'),profile.equippedProfileFrameId);
    setImage(card.querySelector('.ranked-avatar-clip>img'),profile.profileCharacter);
  }
  const badges=[];
  for(const selector of ['#onlineStatus','#onlineRuleOverlay h2','#catAbilityOverlay .ability-select-header',
    '#policeAbilityOverlay .ability-select-header','#abilityRevealOverlay .ability-vs-title','#resultText']){
    const anchor=document.querySelector(selector);
    if(!anchor)continue;
    const badge=document.createElement('div');
    badge.className='online-opponent-profile online-profile-versus';badge.hidden=true;
    badge.append(profileSide('self','あなた'));
    const vs=document.createElement('strong');vs.className='online-profile-vs';vs.textContent='VS';badge.append(vs);
    badge.append(profileSide('opponent','対戦相手'));
    anchor.after(badge);badges.push(badge);
  }
  root.addEventListener('nyan-online-player-profiles',({detail})=>{
    const own=ownProfile(detail),peer=opponentProfile(detail);
    for(const badge of badges){
      badge.hidden=!(own&&peer);
      if(own&&peer){updateSide(badge.querySelector('[data-side="self"]'),own);updateSide(badge.querySelector('[data-side="opponent"]'),peer);}
      else for(const card of badge.querySelectorAll('.online-profile-side')){delete card.dataset.playerId;setFrame(card.querySelector('.online-profile-frame'),'default');card.querySelector('.ranked-avatar-clip>img').removeAttribute('src');}
    }
  });
  // Reuse the authenticated prepare boundary; no offline data is overwritten.
  root.addEventListener('nyan-player-appearance-changed',()=>{
    if(root.NyanOnlineIdentity?.hasCredential())root.NyanRankedUI?.refresh();
  });
})(globalThis);
