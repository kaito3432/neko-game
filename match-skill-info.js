(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.NyanMatchSkillInfo=api;
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';

  const HOW_TO_KEYS=Object.freeze({fakePaw:'fakepaw',doubleSearch:'search'});
  const roleName=role=>role==='cat'?'ネコ':'警察';

  function resolveSkill(role,runtimeId,catalog,descriptions){
    const id=catalog?.fromRuntimeId?.(role,runtimeId);
    const skill=id&&catalog.SKILLS?.[id];
    const info=descriptions?.[HOW_TO_KEYS[runtimeId]||runtimeId];
    if(!skill||!info)return null;
    return {id,name:skill.name,role,roleName:roleName(role),image:info.image,
      summary:info.desc,visual:info.visual||'',detail:info.detail||''};
  }

  function selectedSlots(playMode,game){
    if(game?.abilitiesEnabled!==true||game.gameOver)return [];
    const selected=game.selectedAbilities||{};
    let order;
    if(playMode==='onlineCat'||playMode==='cpuPolice')order=[['self','cat'],['opponent','police']];
    else if(playMode==='onlinePolice'||playMode==='cpuCat')order=[['self','police'],['opponent','cat']];
    else order=[['cat','cat'],['police','police']];
    return order.map(([side,role])=>({side,role,runtimeId:selected[role]||null}));
  }

  // Durable grants are one source of personal access. Room borrowing is not.
  function permanentlyOwnsSkill(skillId,entitlements,catalog,products){
    if(!entitlements||typeof entitlements!=='object')return null;
    if(entitlements.ownedSkillIds?.includes(skillId))return true;
    const packIds=new Set(entitlements.ownedSkillPackIds||[]);
    for(const productId of entitlements.purchasedProductIds||[]){
      const grant=products?.PRODUCTS?.[productId]?.grants;
      if(grant?.skillId===skillId)return true;
      if(grant?.skillPackId)packIds.add(grant.skillPackId);
    }
    return [...packIds].some(id=>catalog?.SKILL_PACKS?.[id]?.skillIds?.includes(skillId));
  }

  function canPersonallyUseSkill(skillId,{permanentSkillEntitlements,personalSkillEntitlements,catalog,products}={}){
    if(permanentlyOwnsSkill(skillId,permanentSkillEntitlements,catalog,products)===true)return true;
    // Personal access is returned by the authenticated profile endpoint. A
    // future pass can enter that resolver without adding a CTA-specific branch.
    if(typeof personalSkillEntitlements?.skillModeUnlocked!=='boolean'||
        !Array.isArray(personalSkillEntitlements.availableSkillIds))return null;
    return personalSkillEntitlements.skillModeUnlocked&&personalSkillEntitlements.availableSkillIds.includes(skillId);
  }

  // Match availability (including Room borrowing) is deliberately not personal access.
  function opponentShopSkill({playMode,game,catalog,shopDefinitions,permanentSkillEntitlements,personalSkillEntitlements,products}){
    if(!['onlineCat','onlinePolice'].includes(playMode)||game?.abilitiesEnabled!==true)return null;
    const role=playMode==='onlineCat'?'police':'cat';
    const skillId=catalog?.fromRuntimeId?.(role,game.selectedAbilities?.[role]);
    const skill=skillId&&catalog.SKILLS?.[skillId];
    if(!skill||skill.free||!skill.purchaseProductId)return null;
    if(!Array.isArray(shopDefinitions)||!shopDefinitions.some(item=>
      item.skillId===skillId&&item.productId===skill.purchaseProductId&&
      item.hidden!==true&&item.purchasable!==false))return null;
    if(canPersonallyUseSkill(skillId,{permanentSkillEntitlements,personalSkillEntitlements,catalog,products})!==false)return null;
    return skill;
  }

  function mount({document,container,catalog,getDescriptions}){
    if(!document||!container||!catalog)return null;
    const layer=document.createElement('div');layer.className='match-skill-info-layer';layer.hidden=true;
    const panel=document.createElement('section');panel.className='match-skill-info-panel';
    panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
    panel.setAttribute('aria-label','使用中スキルの説明');
    const closeButton=document.createElement('button');closeButton.type='button';
    closeButton.className='match-skill-info-close';closeButton.textContent='×';closeButton.setAttribute('aria-label','説明を閉じる');
    const heading=document.createElement('div');heading.className='match-skill-info-heading';
    const image=document.createElement('img');image.alt='';
    const title=document.createElement('div');
    const name=document.createElement('strong'),role=document.createElement('small');
    title.append(name,role);heading.append(image,title);
    const summary=document.createElement('p');summary.className='match-skill-info-summary';
    const visual=document.createElement('div');visual.className='howto-ability-visual match-skill-info-visual';
    const detail=document.createElement('div');detail.className='match-skill-info-detail';
    const scope=document.createElement('p');scope.className='match-skill-info-scope';
    panel.append(closeButton,heading,summary,visual,detail,scope);layer.append(panel);document.body.append(layer);

    let lastButton=null,openedId=null;
    function close(){layer.hidden=true;openedId=null;lastButton?.focus?.({preventScroll:true});}
    function open(button,skill){
      if(!skill)return;
      lastButton=button;openedId=skill.id;
      image.src=skill.image;name.textContent=skill.name;role.textContent=`${skill.roleName}用スキル`;
      summary.textContent=skill.summary;
      // The HTML comes only from the app's static How-to skill definitions.
      visual.innerHTML=skill.visual;visual.hidden=!skill.visual;
      detail.innerHTML=skill.detail;detail.hidden=!skill.detail;
      const policy=catalog.USAGE_POLICY;
      scope.textContent=policy?`${policy.room.label}：${policy.room.scope} ／ ${policy.ranked.label}：${policy.ranked.scope}`:'';
      scope.hidden=!policy;
      layer.hidden=false;closeButton.focus?.({preventScroll:true});
    }
    closeButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();close();});
    layer.addEventListener('click',event=>{event.stopPropagation();if(event.target===layer)close();});
    for(const type of ['pointerdown','pointerup','touchstart','touchend']){
      layer.addEventListener(type,event=>event.stopPropagation());
    }
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!layer.hidden){event.stopPropagation();close();}});

    const slots=['self','opponent'].map(()=>{
      const button=document.createElement('button');button.type='button';button.className='match-skill-button';
      const side=document.createElement('span');side.className='match-skill-side';
      const icon=document.createElement('img');icon.alt='';
      const affordance=document.createElement('span');affordance.className='match-skill-affordance';
      affordance.textContent='ⓘ';affordance.setAttribute('aria-hidden','true');
      button.append(side,icon,affordance);container.append(button);
      let skill=null;
      for(const type of ['pointerdown','pointerup','touchstart','touchend'])
        button.addEventListener(type,event=>event.stopPropagation());
      button.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();});
      button.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();
        if(!layer.hidden&&openedId===skill?.id){close();return;}
        open(button,skill);
      });
      return {button,side,icon,set(value,label){skill=value;button.hidden=!value;if(!value)return;
        side.textContent=label;icon.src=value.image;
        button.setAttribute('aria-label',`${label}の使用中スキル：${value.name}。タップで詳細を開く`);
      }};
    });

    function render({playMode,game,active=true}){
      const selected=active?selectedSlots(playMode,game):[];
      const descriptions=getDescriptions?.()||{};
      const values=selected.map(entry=>({
        label:entry.side==='self'?'自分':entry.side==='opponent'?'相手':roleName(entry.role),
        skill:resolveSkill(entry.role,entry.runtimeId,catalog,descriptions)
      }));
      slots.forEach((slot,index)=>slot.set(values[index]?.skill||null,values[index]?.label||''));
      container.hidden=!values.some(value=>value.skill);
      container.parentElement?.classList.toggle('has-match-skills',!container.hidden);
      if(!layer.hidden&&!values.some(value=>value.skill?.id===openedId))close();
    }
    return {render,close,layer,slots};
  }

  return Object.freeze({resolveSkill,selectedSlots,permanentlyOwnsSkill,canPersonallyUseSkill,opponentShopSkill,mount});
});
