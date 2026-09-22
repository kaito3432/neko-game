(function(root){
  'use strict';
  const CONFIG=Object.freeze({MAX_STAMINA:5,STAMINA_RECOVERY_MINUTES:60,STAMINA_COIN_COST:15,STAMINA_AD_DAILY_LIMIT:5});
  let profile=null,selectionVisible=false,timer=null,busy=false,refreshing=false;
  const panel=document.createElement('section');
  panel.className='ranked-stamina-card';panel.hidden=true;
  panel.innerHTML=`<div><strong data-stamina-value>⚡ 5 / 5</strong><small data-stamina-timer>スタミナ満タン</small></div><button type="button" data-stamina-open aria-label="スタミナを回復">＋</button>`;
  const modal=document.createElement('section');
  modal.className='ranked-stamina-modal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
  modal.innerHTML=`<div class="ranked-stamina-shell"><h2>スタミナ回復</h2><strong data-stamina-modal-value>⚡ 5 / 5</strong>
    <p data-stamina-modal-timer>スタミナ満タン</p><p data-stamina-ad-count>本日の広告回復 0 / 5</p><p data-stamina-message role="status"></p>
    <button type="button" data-stamina-coin>🪙15 で1回復</button><button type="button" data-stamina-ad>広告を見て1回復</button>
    <button type="button" data-stamina-close>閉じる</button></div>`;
  document.body.append(panel,modal);
  function ensurePanelMounted(){document.querySelector('#matchmakingStatus')?.after(panel);}
  const state=()=>profile?.rankedStamina||{stamina:CONFIG.MAX_STAMINA,lastRecoveryAt:Date.now(),adRecoveryCount:0};
  const remaining=()=>Math.max(0,(Number(state().lastRecoveryAt)||Date.now())+CONFIG.STAMINA_RECOVERY_MINUTES*60000-Date.now());
  const time=value=>`${String(Math.floor(value/60000)).padStart(2,'0')}:${String(Math.floor(value/1000)%60).padStart(2,'0')}`;
  function render(message){
    ensurePanelMounted();
    const value=state(),full=value.stamina>=CONFIG.MAX_STAMINA,copy=full?'スタミナ満タン':`次の回復まで ${time(remaining())}`;
    panel.hidden=!selectionVisible;panel.querySelector('[data-stamina-value]').textContent=`⚡ ${value.stamina} / ${CONFIG.MAX_STAMINA}`;
    panel.querySelector('[data-stamina-timer]').textContent=copy;
    modal.querySelector('[data-stamina-modal-value]').textContent=`⚡ ${value.stamina} / ${CONFIG.MAX_STAMINA}`;
    modal.querySelector('[data-stamina-modal-timer]').textContent=copy;
    modal.querySelector('[data-stamina-ad-count]').textContent=`本日の広告回復 ${value.adRecoveryCount||0} / ${CONFIG.STAMINA_AD_DAILY_LIMIT}`;
    if(message!==undefined)modal.querySelector('[data-stamina-message]').textContent=message;
    modal.querySelector('[data-stamina-coin]').disabled=busy||full||(Number(profile?.serverNyanCoins)||0)<CONFIG.STAMINA_COIN_COST;
    modal.querySelector('[data-stamina-ad]').disabled=busy||full||(value.adRecoveryCount||0)>=CONFIG.STAMINA_AD_DAILY_LIMIT||root.NyanRewardedAds.provider.isBusy();
  }
  function update(next){if(next)profile={...profile,...next};render();}
  function open(message=''){modal.hidden=false;render(message);modal.querySelector('[data-stamina-close]').focus();}
  function close(){modal.hidden=true;panel.querySelector('[data-stamina-open]').focus();}
  panel.querySelector('[data-stamina-open]').onclick=()=>open();modal.querySelector('[data-stamina-close]').onclick=close;
  modal.querySelector('[data-stamina-coin]').onclick=async()=>{
    if(busy)return;busy=true;render('回復しています…');
    try{const result=await root.NyanOnlineIdentity.request(root.NyanOnline.API_BASE,'stamina-coin',{requestId:`stamina_coin_${root.crypto.randomUUID()}`});update(result.profile);render(result.duplicate?'確認済みの回復です':'スタミナを1回復しました');}
    catch(error){render(error.message==='insufficient_coins'?'にゃんコインが足りません':'回復できませんでした');}
    finally{busy=false;render();}
  };
  modal.querySelector('[data-stamina-ad]').onclick=async()=>{
    if(busy)return;busy=true;render('広告を準備しています…');
    const result=await root.NyanRewardedAds.provider.showRewardedAd(root.NyanRewardedAds.STAMINA_REWARD_TYPE);
    if(result.profile)update(result.profile);busy=false;
    render(result.verified?(result.duplicate?'確認済みの広告です':'スタミナを1回復しました'):result.reason==='cancelled'?'最後まで視聴されませんでした':'広告を完了できませんでした');
  };
  root.addEventListener('nyan-online-profile',event=>update(event.detail?.profile));
  root.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')root.NyanOnline?.prepareIdentity?.().then(value=>update(value.profile)).catch(()=>{});});
  timer=setInterval(()=>{
    if(selectionVisible||!modal.hidden)render();
    if(!refreshing&&state().stamina<CONFIG.MAX_STAMINA&&remaining()<=0){
      refreshing=true;root.NyanOnline?.prepareIdentity?.().then(value=>update(value.profile)).catch(()=>{}).finally(()=>{refreshing=false;});
    }
  },1000);
  root.NyanRankedStaminaUI={CONFIG,update,setSelectionVisible(value){selectionVisible=value===true;render();},canStart(){return Number(state().stamina)>0;},open,close,getProfile:()=>profile};
})(globalThis);
