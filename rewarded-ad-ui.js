(function(root){
  'use strict';
  if(!root?.document||!root.NyanRewardedAds||!root.NyanMonetization)return;
  const panel=document.getElementById('skillModeUnlockPanel'),progress=document.getElementById('skillModeUnlockProgress');
  const dots=document.getElementById('skillModeUnlockDots'),status=document.getElementById('skillModeAdStatus'),button=document.getElementById('skillModeAdButton');
  if(!panel||!button)return;
  const labels={initializing:'広告を準備しています',loading:'広告を読み込んでいます',available:'広告を視聴できます',
    unavailable:'現在広告を利用できません',viewing:'広告を視聴中',verifying:'視聴完了を確認しています',completed:'視聴が完了しました'};
  function render(message){
    const state=root.NyanMonetization.getState(),unlocked=state.skillModeUnlocked;
    panel.hidden=unlocked;progress.textContent=unlocked?'解放済み':`${state.skillModeUnlockAdViews} / 3`;
    if(dots)dots.replaceChildren(...[0,1,2].map(index=>{const dot=document.createElement('i');dot.className=index<state.skillModeUnlockAdViews?'done':'';return dot;}));
    if(message)status.textContent=message;
    button.disabled=unlocked||root.NyanRewardedAds.provider.isBusy()||root.NyanRewardedAds.provider.getState()===root.NyanRewardedAds.STATES.UNAVAILABLE;
  }
  root.addEventListener('nyan-rewarded-ad-state',event=>{const value=event.detail||{};status.textContent=labels[value.state]||'';render();});
  root.addEventListener('nyan-online-profile',()=>render());root.addEventListener('nyan-rewarded-ad-progress',()=>render('サーバーで視聴を確認しました'));
  button.addEventListener('click',async()=>{
    button.disabled=true;const result=await root.NyanRewardedAds.provider.showRewardedAd();
    if(result.testMode)render('テスト広告完了（権利加算は本番SSVのみ）');
    else if(result.verified)render(result.duplicate?'確認済みの広告です':'視聴を確認しました');
    else render(result.reason==='cancelled'?'最後まで視聴されませんでした':'広告を完了できませんでした');
  });
  root.NyanRewardedAds.provider.initialize().finally(()=>render());render();
})(typeof globalThis!=='undefined'?globalThis:this);
