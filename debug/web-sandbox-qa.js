/* Opt-in Web-only Sandbox routing and connection diagnostics for local online QA. */
(function(root){
  'use strict';
  const location=root.location;
  if(!location)return;
  const local=location.protocol==='file:' ||
    (location.protocol==='http:' && ['localhost','127.0.0.1'].includes(location.hostname));
  if(!local || new URLSearchParams(location.search).get('nyanSandboxQa')!=='1')return;
  root.NYAN_API_BASE='https://nyan-chase-online-sandbox.honda19990602.workers.dev';
  root.NYAN_WEB_SANDBOX_QA=true;
  if(!root.document)return;
  root.document.addEventListener('DOMContentLoaded',()=>{
    let serverPlayerId=null;
    root.addEventListener('nyan-online-profile',event=>{
      serverPlayerId=event.detail?.profile?.playerId||null;
    });
    const panel=root.document.createElement('pre');
    panel.setAttribute('aria-label','Web Sandbox QA 接続情報');
    panel.style.cssText='position:fixed;left:6px;bottom:6px;z-index:34000;max-width:calc(100vw - 12px);padding:5px 7px;margin:0;border-radius:7px;background:#241b2de0;color:#fff;font:10px/1.35 monospace;white-space:pre-wrap;overflow-wrap:anywhere;pointer-events:none';
    root.document.body.append(panel);
    const update=()=>{
      const playerId=root.NyanPlayerData?.getSnapshot?.()?.playerId||'(未登録)';
      const overlay=root.document.getElementById('matchmakingOverlay');
      const label=overlay?.querySelector('#matchmakingStatus')?.textContent||'';
      const status=overlay?.hidden?'idle':label.includes('探しています')?'waiting':label.includes('見つかりました')?'matched':'selection';
      panel.textContent=`Web QA | ${root.NYAN_API_BASE}\nlocal playerId: ${playerId}\nserver playerId: ${serverPlayerId||'(オンラインを開いて登録)'}\nmode: ${status==='waiting'||status==='matched'?'randomMatch':'—'} | queue: queue | ${status}`;
    };
    update();root.setInterval(update,500);
  });
})(typeof globalThis!=='undefined'?globalThis:this);
