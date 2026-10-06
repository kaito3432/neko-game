/* Settings-only online data deletion. Offline game progress stays untouched. */
(function(root){
  'use strict';
  const byId=id=>root.document.getElementById(id);
  const overlay=byId('onlineDataDeleteOverlay');
  if(!overlay)return;
  const open=byId('onlineDataDeleteOpen'),cancel=byId('onlineDataDeleteCancel');
  const next=byId('onlineDataDeleteNext'),confirm=byId('onlineDataDeleteConfirm');
  const warning=byId('onlineDataDeleteWarning'),status=byId('onlineDataDeleteStatus');
  let busy=false;
  function show(stage){
    overlay.hidden=false;
    overlay.classList.add('show');
    cancel.textContent='キャンセル';
    next.hidden=stage!==1;
    confirm.hidden=stage!==2;
    warning.hidden=stage!==2;
    status.textContent='';
  }
  function close(){if(!busy){overlay.hidden=true;overlay.classList.remove('show');}}
  open.addEventListener('click',()=>show(1));
  cancel.addEventListener('click',close);
  next.addEventListener('click',()=>show(2));
  overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
  confirm.addEventListener('click',async()=>{
    if(busy)return;
    busy=true;
    cancel.disabled=true;
    confirm.disabled=true;
    status.textContent='削除しています…';
    try{
      if(!root.NyanOnlineIdentity?.hasCredential?.())throw new Error('online_credential_missing');
      await root.NyanOnlineIdentity.deleteProfile(root.NyanOnline.API_BASE);
      root.NyanOnline.clearDeletedProfile();
      status.textContent='オンラインデータを削除しました';
      confirm.hidden=true;
      cancel.textContent='閉じる';
    }catch(error){
      status.textContent=error?.message==='active_match'
        ?'対戦やマッチングを終了してから、もう一度お試しください。'
        :error?.message==='online_credential_missing'||error?.status===401
          ?'オンライン認証を確認できません。オンライン接続後に再度お試しください。'
          :'削除できませんでした。通信状態を確認して、もう一度お試しください。';
    }finally{
      busy=false;
      cancel.disabled=false;
      confirm.disabled=false;
    }
  });
})(globalThis);
