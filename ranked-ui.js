(function(root){
  'use strict';
  const ranks=root.NyanRankRewards.ranks.map(item=>[item.id,item.name,item.min,item.icon]);
  const frameNames=root.NyanOnlineProfileUI.frames;
  let profile=null;
  let selectionVisible=false;
  const dismissedSeasons=new Set();
  const rank=id=>ranks.find(value=>value[0]===id)||ranks[0];
  const api=(path,body,method)=>root.NyanOnlineIdentity.request(root.NyanOnline.API_BASE,path,body,method);

  const panel=document.createElement('section');
  panel.className='ranked-profile-card';
  panel.hidden=true;
  panel.innerHTML=`<div class="ranked-profile-main">
    <span class="ranked-frame ranked-frame-preview" data-rank-frame-preview data-frame-id="rank_bronze"><span class="ranked-avatar-clip"><img data-rank-icon alt="プロフィールアイコン"></span></span>
    <div><strong data-rank-name>ブロンズ</strong><small data-rank-rp>RP 0 / 100</small><small data-rank-next>次のシルバーまで あと100RP</small></div>
  </div>
  <div class="ranked-record" data-rank-record>今シーズン 0勝 0敗</div>
  <label>プロフィールフレーム<select data-rank-frame></select></label>
  <div class="ranked-skill-access" data-rank-skill-access>Skill Mode：確認中</div>
  <div class="ranked-coins" data-rank-coins>オンライン報酬 0 にゃんコイン</div>`;
  const result=document.createElement('div');
  result.className='ranked-result-notice';
  result.hidden=true;
  const season=document.createElement('div');
  season.className='overlay season-reward-overlay';
  season.innerHTML=`<div class="modal"><div class="modal-icon">🏆</div><h2>シーズン報酬</h2>
    <div data-season-copy></div><button class="btn pink" data-season-claim>受け取る</button>
    <button class="btn secondary" data-season-close>あとで</button></div>`;
  document.body.append(season);
  document.querySelector('#resultText')?.after(result);
  document.querySelector('#matchmakingStatus')?.after(panel);

  function attachPanel(){
    if(!panel.isConnected)document.querySelector('#matchmakingStatus')?.after(panel);
    return panel.isConnected;
  }

  function update(next){
    profile=next?{...profile,...next}:profile;
    if(!profile?.ranked)return;
    profile={...profile,ownedProfileFrames:[...new Set(['rank_bronze',...(profile.ownedProfileFrames||[])])],
      equippedProfileFrameId:root.NyanOnlineProfileUI.frameId(profile.equippedProfileFrameId)};
    attachPanel();
    panel.hidden=!selectionVisible;
    const current=rank(profile.ranked.rank),index=ranks.indexOf(current),nextRank=ranks[index+1];
    root.NyanOnlineProfileUI.setImage(panel.querySelector('[data-rank-icon]'),profile.profileCharacter);
    panel.querySelector('[data-rank-name]').textContent=current[1];
    panel.querySelector('[data-rank-rp]').textContent=nextRank?`RP ${profile.ranked.rp} / ${nextRank[2]}`:`RP ${profile.ranked.rp}`;
    const nextCopy=panel.querySelector('[data-rank-next]');
    nextCopy.hidden=!nextRank;
    nextCopy.textContent=nextRank?`次の${nextRank[1]}まで あと${nextRank[2]-profile.ranked.rp}RP`:'';
    panel.querySelector('[data-rank-record]').textContent=`今シーズン ${profile.ranked.seasonWins}勝 ${profile.ranked.seasonLosses}敗`;
    panel.querySelector('[data-rank-coins]').textContent=`オンライン報酬 ${profile.serverNyanCoins||0} にゃんコイン`;
    const skillView=root.NyanOnlineIdentity.getAuthenticatedSkillView?.();
    const access=skillView?.playerId&&skillView.playerId===profile.playerId&&skillView.apiBase===root.NyanOnline.API_BASE
      ?skillView.effectiveSkillEntitlements:null;
    const skillStatus=panel.querySelector('[data-rank-skill-access]');
    skillStatus.textContent=access?.skillModeUnlocked===true
      ?`Skill Mode：オンライン利用可能（${access.availableSkillIds?.length||0}スキル）`
      :access?'Skill Mode：未解放':'Skill Mode：サーバー確認中';

    const select=panel.querySelector('[data-rank-frame]');
    const owned=[...new Set(['rank_bronze',...(profile.ownedProfileFrames||[])])];
    select.replaceChildren();
    for(const id of owned){
      const option=document.createElement('option');
      option.value=id;
      option.textContent=frameNames[id]||id;
      select.append(option);
    }
    select.value=root.NyanOnlineProfileUI.frameId(profile.equippedProfileFrameId);
    root.NyanOnlineProfileUI.setFrame(panel.querySelector('[data-rank-frame-preview]'),select.value);
    select.onchange=async()=>{
      select.disabled=true;
      try{const response=await api('profile-frame',{frameId:select.value});update(response.profile);}
      catch(_){select.value=root.NyanOnlineProfileUI.frameId(profile.equippedProfileFrameId);}
      finally{select.disabled=false;}
    };
    if(selectionVisible)showSeason();
    root.dispatchEvent(new CustomEvent('nyan-ranked-profile-changed',{detail:{profile}}));
  }

  function showSeason(){
    if(!selectionVisible)return;
    const reward=profile?.seasonHistory?.find(item=>
      ['claimable','pendingConfiguration'].includes(item.rewardStatus)&&!dismissedSeasons.has(item.seasonId));
    if(!reward)return;
    season.dataset.seasonId=reward.seasonId;
    season.classList.add('show');
    const rankName=rank(reward.finalRank)[1];
    const rewardText=reward.rewardStatus==='pendingConfiguration'
      ?'マスター限定スキン：準備中（受取資格は保存済み）'
      :reward.rewardType==='coins'?`${reward.rewardAmount} にゃんコイン`
        :reward.rewardType==='coinsAndSkin'?`${reward.rewardAmount} にゃんコイン＋マスター限定スキン`
          :'マスター限定スキン';
    season.querySelector('[data-season-copy]').textContent=
      `${reward.seasonId} 最終ランク ${rankName}（${reward.finalRP} RP）／報酬：${rewardText}`;
    const button=season.querySelector('[data-season-claim]');
    button.disabled=reward.rewardStatus!=='claimable';
    button.textContent=reward.rewardStatus==='pendingConfiguration'?'報酬準備中':'受け取る';
    button.onclick=async()=>{
      button.disabled=true;
      try{const response=await api('season-reward',{seasonId:reward.seasonId});season.classList.remove('show');update(response.profile);}
      catch(_){button.disabled=reward.rewardStatus!=='claimable';}
    };
  }
  season.querySelector('[data-season-close]').onclick=()=>{
    dismissedSeasons.add(season.dataset.seasonId);
    season.classList.remove('show');
  };

  async function equipFrame(frameId){
    const requested=root.NyanOnlineProfileUI.frameId(frameId);
    const owned=profile?.ownedProfileFrames||[];
    if(requested!=='rank_bronze'&&!owned.includes(requested))throw new Error('frame_not_owned');
    const response=await api('profile-frame',{frameId:requested});
    update(response.profile);
    return response.profile;
  }

  async function refresh(){
    try{
      const prepared=await root.NyanOnline.prepareIdentity();
      update(prepared.profile);return prepared.profile;
    }
    catch(_){return null;}
  }
  function fallbackProfile(){
    const local=root.NyanPlayerData?.getSnapshot?.()||{};
    return {
      profileCharacter:local.profileCharacter||{category:'catSkin',itemId:'default'},
      ownedProfileFrames:[...new Set(['rank_bronze',...(local.ownedProfileFrames||[])])],
      equippedProfileFrameId:root.NyanOnlineProfileUI.frameId(profile?.equippedProfileFrameId),
      ranked:profile?.ranked||{rank:'bronze',rp:0,seasonWins:0,seasonLosses:0},
      serverNyanCoins:profile?.serverNyanCoins||0
    };
  }
  function setSelectionVisible(visible){
    selectionVisible=visible===true;
    attachPanel();
    if(selectionVisible&&!profile?.ranked)update(fallbackProfile());
    panel.hidden=!selectionVisible||!profile?.ranked;
    if(!selectionVisible)season.classList.remove('show');
    else if(profile?.ranked)showSeason();
  }
  root.addEventListener('nyan-online-profile',event=>update(event.detail.profile));
  // random-match creates its overlay after this module on some cached/native
  // bundles. Reattach whenever the entry screen is opened.
  root.addEventListener('nyan-online-selection-opened',()=>{attachPanel();setSelectionVisible(true);});
  root.addEventListener('nyan-online-matched',()=>{result.hidden=true;result.replaceChildren();});
  root.addEventListener('nyan-ranked-result',event=>{
    const receipt=event.detail?.ranked;
    if(!receipt)return;
    if(event.detail.rankedProfile)update(event.detail.rankedProfile);
    const before=rank(receipt.beforeRank)[1],after=rank(receipt.afterRank)[1];
    result.hidden=false;
    result.replaceChildren();
    const primary=document.createElement('strong');
    primary.textContent=`${receipt.rpDelta>0?'+':''}${receipt.rpDelta} RP`;
    const detail=document.createElement('span');
    detail.textContent=`${before===after?after:`${before} → ${after}`}　${receipt.beforeRP} → ${receipt.afterRP} RP`;
    result.append(primary,detail);
    if(receipt.beforeRank!==receipt.afterRank){
      const change=document.createElement('em');change.textContent=receipt.rpDelta>0?'ランクアップ！':'ランクダウン';result.append(change);
    }
    if(receipt.unlockedProfileFrames?.length){
      const unlocked=document.createElement('em');unlocked.textContent='新しいプロフィールフレームを獲得！';result.append(unlocked);
    }
  });
  root.NyanRankedUI={refresh,equipFrame,updateProfile:update,getProfile:()=>profile,setSelectionVisible,
    totalCoins:local=>(Number(local)||0)+(Number(profile?.serverNyanCoins)||0)};
})(globalThis);
