/* iOS DEBUG + explicit launch environment only. Never included in Release assets. */
(function(root){
  'use strict';
  const skills=Object.freeze({
    CAT_FAKE_PAW:{role:'cat',name:'フェイク肉球',desc:'偽の肉球で警察を惑わせる',image:'./assets/images/vs_fakepaw.png'},
    POLICE_GROUP_SEARCH:{role:'police',name:'一斉捜索',desc:'2つの箱を同時に捜索',image:'./assets/images/vs_search.png'},
    POLICE_DASH:{role:'police',name:'ダッシュ',desc:'一気に2マス移動',image:'./assets/images/vs_dash.png'}
  });
  function previewManager(original,catalog){
    // Only local match eligibility changes. All ownership/purchase/profile methods stay real.
    return Object.freeze({...original,isSkillModeUnlocked:()=>true,
      canEquipSkill:(role,id)=>catalog.SKILLS[id]?.role===role});
  }
  function allowed(cap,environment){
    return cap?.getPlatform?.()==='ios'&&environment?.debug===true&&environment?.screenshotMode===true;
  }
  function install(){
    const doc=root.document,original=root.NyanMonetization;
    if(!original||!root.NyanSkillCatalog)return;
    root.NyanMonetization=previewManager(original,root.NyanSkillCatalog);
    const blocked='#createOnlineRoomBtn,#joinOnlineRoomBtn,#randomMatchOpenBtn,#rankedOpenBtn,#passOpenBtn,#giftBoxOpenBtn,#storeKitRestore,#shopPreviewPurchase,#shopPackProducts button,#skillModeAdButton,#dailyOverlay button:not(#dailyCloseBtn),#monetizationDevPanel button,#onlineDataDeleteOpen,#adPrivacyOptionsButton';
    // Capture before game handlers; do not start purchases, restore, ads or Online sessions.
    for(const event of ['click','pointerdown','touchstart','keydown'])doc.addEventListener(event,e=>{
      if(e.target.closest?.(blocked)){e.preventDefault();e.stopImmediatePropagation();}
    },{capture:true,passive:false});
    const style=doc.createElement('style');
    style.textContent=blocked+'{pointer-events:none!important;opacity:.45!important} #nyanScreenshotPanel{position:fixed;bottom:5px;left:5px;z-index:2147483647;background:#fff8e9;color:#543c30;padding:8px;border:1px solid;border-radius:8px;max-width:95vw;font-size:12px} #nyanScreenshotPanel button{margin:3px} body.nyan-shot-hold #skillCutin,body.nyan-shot-hold #skillCutin *{animation:none!important} body.nyan-shot-hold #skillCutin .skill-cutin-card{opacity:1!important;transform:none!important;filter:none!important}';
    doc.head.append(style);
    const panel=doc.createElement('details');panel.id='nyanScreenshotPanel';
    const summary=doc.createElement('summary');summary.textContent='撮影用（ローカル限定・権利変更なし）';panel.append(summary);
    const button=(label,action)=>{const b=doc.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',action);panel.append(b);};
    const closeCutin=()=>{doc.body.classList.remove('nyan-shot-hold');const node=doc.getElementById('skillCutin');node?.classList.remove('show','cat-skill','police-skill');node?.setAttribute('aria-hidden','true');};
    for(const [id,skill] of Object.entries(skills)){
      button(skill.name+' 詳細',()=>{closeCutin();doc.getElementById('shopOpenBtn')?.click();root.NyanShopOpenSkillDetail?.(id);});
      button(skill.name+' 演出固定',()=>{
        closeCutin();const node=doc.getElementById('skillCutin');if(!node)return;
        doc.getElementById('skillCutinKicker').textContent=skill.role==='cat'?'CAT SPECIAL SKILL':'POLICE SPECIAL SKILL';
        doc.getElementById('skillCutinName').textContent=skill.name;
        doc.getElementById('skillCutinDesc').textContent=skill.desc;
        const image=doc.getElementById('skillCutinImage');image.src=skill.image;image.alt=skill.name;
        doc.body.classList.add('nyan-shot-hold');node.classList.add(skill.role+'-skill','show');node.setAttribute('aria-hidden','false');panel.open=false;
      });
    }
    button('演出を閉じる',closeCutin);
    button('Online Room画面（通信なし）',()=>{closeCutin();doc.getElementById('onlineOverlay')?.classList.add('show');});
    button('パネルを隠す（3本指タップで戻す）',()=>{panel.hidden=true;});
    doc.addEventListener('touchstart',event=>{if(event.touches?.length===3){event.preventDefault();panel.hidden=false;}},{passive:false});
    button('撮影モード終了（再起動までOFF）',()=>{closeCutin();root.NyanMonetization=original;panel.remove();style.remove();
      // Capturing guards intentionally stay until restart: no accidental purchase after preview.
      root.dispatchEvent(new root.Event('nyan-purchase-entitlements'));});
    doc.body.append(panel);
    root.dispatchEvent(new root.Event('nyan-purchase-entitlements'));
  }
  if(typeof module==='object'&&module.exports){module.exports={allowed,previewManager,skills};return;}
  async function boot(){
    try{
      if(root.__nyanScreenshotIsolated!==true||root.NyanScreenshotIsolation?.active!==true)return;
      const cap=root.Capacitor;if(cap?.getPlatform?.()!=='ios')return;
      const plugin=cap.Plugins?.NyanReview||cap.registerPlugin?.('NyanReview');
      if(allowed(cap,await plugin?.getEnvironment?.())){
        install();root.console?.info?.('[ScreenshotQA] isolated temporary session ready; '+JSON.stringify(root.NyanScreenshotIsolation.counts()));
      }
    }catch(_){/* Fail closed, without personal data or native payload logging. */}
  }
  if(root.document?.readyState==='complete')void boot();else root.addEventListener('load',boot,{once:true});
})(typeof globalThis!=='undefined'?globalThis:this);
