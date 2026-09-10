(function(root){
  'use strict';
  const ranks=[
    ['bronze','ブロンズ',0,'🥉'],['silver','シルバー',100,'🐾'],
    ['gold','ゴールド',250,'✨'],['platinum','プラチナ',450,'🌙'],
    ['diamond','ダイヤ',700,'💎'],['master','マスター',1000,'👑']
  ];
  const frameNames={
    rank_bronze:'肉球ブロンズフレーム',rank_silver:'足あとシルバーフレーム',
    rank_gold:'きらめきゴールドフレーム',rank_platinum:'月夜のプラチナフレーム',
    rank_diamond:'宝石肉球ダイヤフレーム',rank_master:'にゃんチェイス・マスターフレーム'
  };
  let profile=null;
  const dismissedSeasons=new Set();
  const rank=id=>ranks.find(value=>value[0]===id)||ranks[0];
  const api=(path,body,method)=>root.NyanOnlineIdentity.request(root.NyanOnline.API_BASE,path,body,method);

  const panel=document.createElement('section');
  panel.className='ranked-profile-card';
  panel.hidden=true;
  panel.innerHTML=`<div class="ranked-profile-main">
    <span class="ranked-frame-preview" data-rank-frame-preview data-frame-id="default"><span data-rank-icon>🥉</span></span>
    <div><strong data-rank-name>ブロンズ</strong><small data-rank-rp>RP 0 / 100</small><small data-rank-next>次のシルバーまで あと100RP</small></div>
  </div>
  <div class="ranked-record" data-rank-record>今シーズン 0勝 0敗</div>
  <label>プロフィールフレーム<select data-rank-frame></select></label>
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

  function update(next){
    profile=next||profile;
    if(!profile?.ranked)return;
    if(!panel.isConnected)document.querySelector('#matchmakingStatus')?.after(panel);
    panel.hidden=false;
    const current=rank(profile.ranked.rank),index=ranks.indexOf(current),nextRank=ranks[index+1];
    panel.querySelector('[data-rank-icon]').textContent=current[3];
    panel.querySelector('[data-rank-name]').textContent=current[1];
    panel.querySelector('[data-rank-rp]').textContent=nextRank?`RP ${profile.ranked.rp} / ${nextRank[2]}`:`RP ${profile.ranked.rp}`;
    const nextCopy=panel.querySelector('[data-rank-next]');
    nextCopy.hidden=!nextRank;
    nextCopy.textContent=nextRank?`次の${nextRank[1]}まで あと${nextRank[2]-profile.ranked.rp}RP`:'';
    panel.querySelector('[data-rank-record]').textContent=`今シーズン ${profile.ranked.seasonWins}勝 ${profile.ranked.seasonLosses}敗`;
    panel.querySelector('[data-rank-coins]').textContent=`オンライン報酬 ${profile.serverNyanCoins||0} にゃんコイン`;

    const select=panel.querySelector('[data-rank-frame]');
    const owned=profile.ownedProfileFrames||[];
    select.replaceChildren();
    for(const id of ['default',...owned]){
      const option=document.createElement('option');
      option.value=id;
      option.textContent=id==='default'?'フレームなし':frameNames[id]||id;
      select.append(option);
    }
    select.value=profile.equippedProfileFrameId||'default';
    panel.querySelector('[data-rank-frame-preview]').dataset.frameId=select.value;
    select.onchange=async()=>{
      select.disabled=true;
      try{const response=await api('profile-frame',{frameId:select.value});update(response.profile);}
      catch(_){select.value=profile.equippedProfileFrameId||'default';}
      finally{select.disabled=false;}
    };
    showSeason();
    root.dispatchEvent(new CustomEvent('nyan-ranked-profile-changed',{detail:{profile}}));
  }

  function showSeason(){
    const reward=profile?.seasonHistory?.find(item=>
      ['claimable','pendingConfiguration'].includes(item.rewardStatus)&&!dismissedSeasons.has(item.seasonId));
    if(!reward)return;
    season.dataset.seasonId=reward.seasonId;
    season.classList.add('show');
    const rankName=rank(reward.finalRank)[1];
    const rewardText=reward.rewardStatus==='pendingConfiguration'
      ?'マスター限定スキン：準備中（受取資格は保存済み）'
      :reward.rewardType==='coins'?`${reward.rewardAmount} にゃんコイン`:'マスター限定スキン';
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

  async function refresh(){
    try{const prepared=await root.NyanOnline.prepareIdentity();update(prepared.profile);return prepared.profile;}
    catch(_){return null;}
  }
  root.addEventListener('nyan-online-profile',event=>update(event.detail.profile));
  root.addEventListener('nyan-online-matched',()=>{result.hidden=true;result.replaceChildren();});
  root.addEventListener('nyan-ranked-result',event=>{
    const receipt=event.detail?.ranked;
    if(!receipt)return;
    if(event.detail.rankedProfile)update(event.detail.rankedProfile);
    const before=rank(receipt.beforeRank)[1],after=rank(receipt.afterRank)[1];
    result.hidden=false;
    result.replaceChildren();
    const primary=document.createElement('strong');
    primary.textContent=`${receipt.rpDelta>0?'+':''}${receipt.rpDelta} RP${receipt.coinDelta?` ／ +${receipt.coinDelta} にゃんコイン`:''}`;
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
  root.NyanRankedUI={refresh,updateProfile:update,getProfile:()=>profile,
    totalCoins:local=>(Number(local)||0)+(Number(profile?.serverNyanCoins)||0)};
})(globalThis);
