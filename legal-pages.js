/* Public URLs for Web, bundled legal pages for native apps. */
(function(root){
  'use strict';
  const PUBLIC_BASE_URL='https://kaito3432.github.io/neko-game/';
  const PATHS=Object.freeze({privacy:'privacy.html',terms:'terms.html',support:'support.html',deletion:'data-deletion.html'});
  function pageUrl(page){
    const path=PATHS[page];
    if(!path)throw new Error('unknown_legal_page');
    const native=Boolean(root.Capacitor?.isNativePlatform?.())||root.location.protocol==='capacitor:';
    return new URL(path,native?root.location.href:PUBLIC_BASE_URL).href;
  }
  const overlay=root.document.getElementById('legalPageOverlay');
  const frame=root.document.getElementById('legalPageFrame');
  const close=root.document.getElementById('legalPageClose');
  const status=root.document.getElementById('legalPageStatus');
  if(!overlay||!frame||!close){root.NyanLegalPages=Object.freeze({pageUrl,publicBaseUrl:PUBLIC_BASE_URL,paths:PATHS});return;}
  let previousFocus=null;
  function hide(){
    overlay.hidden=true;overlay.classList.remove('show');frame.removeAttribute('src');previousFocus?.focus?.();
  }
  function closeIfOpen(){if(overlay.hidden)return false;hide();return true;}
  root.NyanLegalPages=Object.freeze({pageUrl,publicBaseUrl:PUBLIC_BASE_URL,paths:PATHS,closeIfOpen});
  for(const button of root.document.querySelectorAll('[data-legal-page]'))button.addEventListener('click',()=>{
    try{
      previousFocus=root.document.activeElement;
      status.textContent='';
      frame.src=pageUrl(button.dataset.legalPage);
      overlay.hidden=false;overlay.classList.add('show');close.focus();
    }catch(_){status.textContent='ページを開けませんでした。';}
  });
  frame.addEventListener('error',()=>{status.textContent='ページを読み込めませんでした。';});
  frame.addEventListener('load',()=>{
    if(overlay.hidden)return;
    // Internal page switches replace the iframe entry to avoid stale page history.
    frame.contentDocument?.addEventListener('click',event=>{
      const link=event.target.closest?.('a[href]');
      if(!link||link.target==='_blank')return;
      const url=new URL(link.href);
      if(url.origin!==root.location.origin||!Object.values(PATHS).some(path=>url.pathname.endsWith('/'+path)))return;
      event.preventDefault();frame.contentWindow.location.replace(url.href);
    });
    frame.contentDocument?.addEventListener('keydown',event=>{
      if(event.key==='Escape'||event.key==='Backspace'){event.preventDefault();hide();}
    });
  });
  close.addEventListener('click',hide);
  overlay.addEventListener('click',event=>{if(event.target===overlay)hide();});
  root.document.addEventListener('keydown',event=>{
    if(!overlay.hidden&&(event.key==='Escape'||event.key==='Backspace')){event.preventDefault();hide();}
  });
})(globalThis);
