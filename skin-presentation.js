/* にゃんチェイス - Phase 2B スキン表示境界
   カタログから見た目だけを解決し、ゲーム状態や判定は変更しない。
*/
(function(root,factory){
  const catalog=typeof module==="object" && module.exports
    ? require("./collection-catalog.js")
    : root?.NyanCollectionCatalog;
  const api=factory(root,catalog);

  if(typeof module==="object" && module.exports) module.exports=api;
  if(root) root.NyanSkinPresentation=api;
})(typeof globalThis!=="undefined" ? globalThis : this,(root,defaultCatalog)=>{
  "use strict";

  const DOG_KEYS=Object.freeze(["red","black","white"]);
  const HOME_ANIMATION_DURATION_MS=1450;
  const HOME_CROSSFADE_MS=60;
  const HOME_REACTION_DURATION_MS=450;
  const homePlayback=new WeakMap();
  const preloadedHomeFrames=new Set();
  const DEFAULTS=Object.freeze({
    catPiece:"./assets/images/cat_play_normal.png",
    dogPieces:Object.freeze([
      "./assets/images/dog_red.png",
      "./assets/images/dog_green.png",
      "./assets/images/dog_blue.png"
    ]),
    dogCards:Object.freeze([
      "./assets/images/dog_card_red.png",
      "./assets/images/dog_card_green.png",
      "./assets/images/dog_card_blue.png"
    ]),
    catResult:"./assets/images/cutin_cat_win.jpg",
    dogResult:"./assets/images/cutin_police_win.jpg",
    home:"./assets/images/home_hero.png"
  });

  function createHomeFrames(basePath,prefix){
    return Object.freeze(Array.from({length:10},(_,index)=>
      `${basePath}/${prefix}-${String(index+1).padStart(2,"0")}.png`
    ));
  }

  function freezeTimeline(values){
    return Object.freeze(values.map(value=>Object.freeze(value)));
  }

  const HOME_LAYERED_SKINS=Object.freeze({
    "catSkin:cat_kaitou":Object.freeze({
      treasure:"./assets/home-skins/kaito-nyan/kaito-nyan-home-treasure.png",
      character:"./assets/home-skins/kaito-nyan/kaito-nyan-home-character.png",
      supportLayout:Object.freeze({translate:"2% 4%",scale:".93"}),
      characterLayout:Object.freeze({translate:"-4.5% 5px",scale:"1.05"}),
      durationMs:HOME_REACTION_DURATION_MS,
      reaction:freezeTimeline([
        {offset:0,transform:"translate3d(0,0,0) scale(1) rotate(0deg)",easing:"ease-out"},
        {offset:.18,transform:"translate3d(0,3px,0) scale(.971) rotate(0deg)",easing:"ease-in"},
        {offset:.49,transform:"translate3d(10px,-6px,0) scale(1.019) rotate(-1.5deg)",easing:"ease-out"},
        {offset:.71,transform:"translate3d(6px,-2px,0) scale(1.012) rotate(1deg)",easing:"ease-in-out"},
        {offset:1,transform:"translate3d(0,0,0) scale(1) rotate(0deg)"}
      ])
    }),
    "dogSkin:dog_detective":Object.freeze({
      treasure:"./assets/home-skins/detective-shiba/detective-shiba-home-clues.png",
      character:"./assets/home-skins/detective-shiba/detective-shiba-home-character.png",
      supportLayout:Object.freeze({translate:"26% 8%",scale:".50"}),
      characterLayout:Object.freeze({translate:"-13% 7%",scale:".88"}),
      durationMs:480,
      reaction:freezeTimeline([
        {offset:0,transform:"translate3d(0,0,0) scale(1) rotate(0deg)",easing:"ease-out"},
        {offset:.167,transform:"translate3d(0,3px,0) scale(.985) rotate(0deg)",easing:"ease-in"},
        {offset:.458,transform:"translate3d(8px,-5px,0) scale(1.03) rotate(-1deg)",easing:"ease-out"},
        {offset:.667,transform:"translate3d(4px,-1px,0) scale(1.015) rotate(.8deg)",easing:"ease-in-out"},
        {offset:1,transform:"translate3d(0,0,0) scale(1) rotate(0deg)"}
      ])
    })
  });

  const HOME_ANIMATIONS=Object.freeze({
    "dogSkin:dog_detective":Object.freeze({
      frames:createHomeFrames(
        "./assets/home-animation/detective-shiba",
        "detective-shiba-home"
      ),
      durationMs:HOME_ANIMATION_DURATION_MS,
      crossfadeMs:HOME_CROSSFADE_MS,
      keyPoses:freezeTimeline([
        {frame:1,at:0},
        {frame:3,at:.16},
        {frame:5,at:.35},
        {frame:7,at:.55},
        {frame:9,at:.77},
        {frame:10,at:.89}
      ]),
      motion:freezeTimeline([
        {offset:0,transform:"translate3d(0,0,0) scale(1) rotate(0deg)",easing:"ease-out"},
        {offset:.12,transform:"translate3d(-.6%,2px,0) scale(.99) rotate(-.45deg)",easing:"ease-in"},
        {offset:.35,transform:"translate3d(.8%,-2px,0) scale(1.006) rotate(.35deg)",easing:"ease-in-out"},
        {offset:.55,transform:"translate3d(1.5%,1px,0) scale(1.012) rotate(-.25deg)",easing:"ease-in-out"},
        {offset:.77,transform:"translate3d(2%,-3px,0) scale(1.012) rotate(.35deg)",easing:"ease-out"},
        {offset:.9,transform:"translate3d(1%,-6px,0) scale(1.025) rotate(0deg)",easing:"ease-out"},
        {offset:1,transform:"translate3d(0,0,0) scale(1) rotate(0deg)"}
      ]),
      effect:"clues"
    })
  });

  function homeAnimationForItem(item){
    return item ? HOME_ANIMATIONS[`${item.category}:${item.id}`] || null : null;
  }

  function homeLayeredSkinForItem(item){
    return item ? HOME_LAYERED_SKINS[`${item.category}:${item.id}`] || null : null;
  }

  function isOnlineMode(playMode){
    return typeof playMode==="string" && playMode.startsWith("online");
  }

  function equippedItem(data,categoryId,catalog=defaultCatalog,allowCustom=true){
    const category=catalog?.getCategory(categoryId);
    if(!category) return null;
    const requested=allowCustom
      ? data?.equippedAppearance?.[category.equippedField]
      : "default";
    const itemId=typeof requested==="string" ? requested : "default";
    const owned=Array.isArray(data?.[category.ownedField])
      ? data[category.ownedField]
      : ["default"];
    if(!owned.includes(itemId)) return catalog.getItem(categoryId,"default");
    return catalog.getItem(categoryId,itemId) || catalog.getItem(categoryId,"default");
  }

  function resolveCatPiece(data,{catalog=defaultCatalog,playMode="local"}={}){
    const item=equippedItem(data,"catSkin",catalog,!isOnlineMode(playMode));
    return {src:item?.pieceImage || DEFAULTS.catPiece,fallback:DEFAULTS.catPiece,itemId:item?.id || "default"};
  }

  function resolveDogPiece(data,dogIndex,{catalog=defaultCatalog,playMode="local"}={}){
    const safeIndex=Number.isInteger(dogIndex) && dogIndex>=0 && dogIndex<3 ? dogIndex : 0;
    const item=equippedItem(data,"dogSkin",catalog,!isOnlineMode(playMode));
    const piece=item?.pieceImage;
    const src=piece && typeof piece==="object"
      ? piece[DOG_KEYS[safeIndex]]
      : null;
    return {src:src || DEFAULTS.dogPieces[safeIndex],fallback:DEFAULTS.dogPieces[safeIndex],itemId:item?.id || "default"};
  }

  function resolveDogCard(data,dogIndex,{catalog=defaultCatalog,playMode="local"}={}){
    const safeIndex=Number.isInteger(dogIndex) && dogIndex>=0 && dogIndex<3 ? dogIndex : 0;
    const item=equippedItem(data,"dogSkin",catalog,!isOnlineMode(playMode));
    const card=item?.cardImage;
    const src=card && typeof card==="object"
      ? card[DOG_KEYS[safeIndex]]
      : null;
    return {src:src || DEFAULTS.dogCards[safeIndex],fallback:DEFAULTS.dogCards[safeIndex],itemId:item?.id || "default"};
  }

  function resolveOutcomeImage(data,categoryId,outcome,{catalog=defaultCatalog,playMode="local"}={}){
    const isCat=categoryId==="catSkin";
    const fallback=outcome==="win"
      ? (isCat ? DEFAULTS.catResult : DEFAULTS.dogResult)
      : (isCat ? DEFAULTS.dogResult : DEFAULTS.catResult);
    const item=equippedItem(data,categoryId,catalog,!isOnlineMode(playMode));
    const field=outcome==="win" ? "resultWinImage" : "resultLoseImage";
    return {src:item?.[field] || fallback,fallback};
  }

  function resolveResultImage(data,winner,playMode,{catalog=defaultCatalog}={}){
    if(isOnlineMode(playMode)){
      const fallback=winner==="cat" ? DEFAULTS.catResult : DEFAULTS.dogResult;
      return {src:fallback,fallback};
    }
    if(playMode==="cpuPolice"){
      return resolveOutcomeImage(data,"catSkin",winner==="cat" ? "win" : "lose",{catalog,playMode});
    }
    if(playMode==="cpuCat"){
      return resolveOutcomeImage(data,"dogSkin",winner==="dogs" ? "win" : "lose",{catalog,playMode});
    }
    if(playMode==="local"){
      const cat=equippedItem(data,"catSkin",catalog,true);
      const dog=equippedItem(data,"dogSkin",catalog,true);
      const customCat=cat?.id && cat.id!=="default";
      const customDog=dog?.id && dog.id!=="default";
      if(customCat && !customDog){
        return resolveOutcomeImage(data,"catSkin",winner==="cat" ? "win" : "lose",{catalog,playMode});
      }
      if(customDog && !customCat){
        return resolveOutcomeImage(data,"dogSkin",winner==="dogs" ? "win" : "lose",{catalog,playMode});
      }
    }
    return resolveOutcomeImage(data,winner==="cat" ? "catSkin" : "dogSkin","win",{catalog,playMode});
  }

  function resolveFavorite(data,{catalog=defaultCatalog}={}){
    const favorite=data?.favoriteCharacter;
    if(!favorite || (favorite.category!=="catSkin" && favorite.category!=="dogSkin")){
      return null;
    }
    const category=catalog.getCategory(favorite.category);
    const owned=Array.isArray(data?.[category.ownedField]) ? data[category.ownedField] : [];
    const item=owned.includes(favorite.itemId)
      ? catalog.getItem(favorite.category,favorite.itemId)
      : null;
    const layered=homeLayeredSkinForItem(item);
    const animation=homeAnimationForItem(item);
    if((!layered && !animation) || item.id==="default") return null;
    if(layered){
      return {
        item,
        mode:"layered",
        src:layered.character,
        layered,
        durationMs:layered.durationMs,
        fallback:DEFAULTS.home
      };
    }
    return {
      item,
      mode:"frames",
      src:animation.frames[0],
      frames:animation.frames,
      keyPoses:animation.keyPoses,
      motion:animation.motion,
      durationMs:animation.durationMs,
      crossfadeMs:animation.crossfadeMs,
      effect:animation.effect,
      fallback:DEFAULTS.home
    };
  }

  function setImageWithFallback(image,src,fallback){
    if(!image) return;
    image.onerror=()=>{
      image.onerror=null;
      image.src=fallback;
    };
    image.src=src || fallback;
  }

  function effectSource(data,categoryId,kind,{catalog=defaultCatalog,playMode="local"}={}){
    if(isOnlineMode(playMode)) return null;
    const item=equippedItem(data,categoryId,catalog,true);
    const field=kind==="found" ? "foundFootprintEffect" : "moveEffect";
    return item?.id==="default" ? null : item?.[field] || null;
  }

  function showEffectAtElement(element,src,variant="move"){
    const document=root?.document;
    if(!document || !element || !src) return false;
    const rect=element.getBoundingClientRect();
    const image=document.createElement("img");
    image.className=`skin-decorative-effect skin-effect-${variant}`;
    image.alt="";
    image.setAttribute("aria-hidden","true");
    image.style.left=`${rect.left+rect.width/2}px`;
    image.style.top=`${rect.top+rect.height/2}px`;
    image.onerror=()=>image.remove();
    image.src=src;
    document.body.appendChild(image);
    root.requestAnimationFrame?.(()=>image.classList.add("show"));
    root.setTimeout?.(()=>image.remove(),400);
    return true;
  }

  function showBoardEffect(board,index,type,src,variant){
    if(!board || !src) return false;
    const target=type==="node"
      ? board.querySelectorAll(".node")[index]
      : board.querySelector(`.box[data-box-index="${index}"]`);
    return showEffectAtElement(target,src,variant);
  }

  function preloadHomeAnimation(frames,{
    ImageCtor=root?.Image,
    schedule=root?.requestIdleCallback
      ? callback=>root.requestIdleCallback(callback,{timeout:1200})
      : callback=>root?.setTimeout?.(callback,0)
  }={}){
    if(!Array.isArray(frames) || typeof ImageCtor!=="function" || typeof schedule!=="function"){
      return false;
    }
    const pending=frames.slice(1).filter(src=>{
      if(preloadedHomeFrames.has(src)) return false;
      preloadedHomeFrames.add(src);
      return true;
    });
    const loadNext=()=>{
      const src=pending.shift();
      if(!src) return;
      const image=new ImageCtor();
      const continueLoading=()=>schedule(loadNext);
      image.decoding="async";
      image.onload=continueLoading;
      image.onerror=continueLoading;
      image.src=src;
    };
    if(pending.length) schedule(loadNext);
    return true;
  }

  function homeStageFor(hero){
    return hero?.closest?.(".vu3-hero-stage") || hero || null;
  }

  function homeBlendFor(hero){
    return homeStageFor(hero)?.querySelector?.(".vu3-hero-blend") || null;
  }

  function homeLayeredElementsFor(hero){
    const stage=homeStageFor(hero);
    const root=stage?.querySelector?.(".vu3-home-layered-skin") || null;
    return {
      stage,
      root,
      treasureImage:root?.querySelector?.(".vu3-home-layer-treasure") || null,
      characterImage:root?.querySelector?.(".vu3-home-layer-character") || null,
      sparkles:root?.querySelector?.(".vu3-home-layer-sparkles") || null
    };
  }

  function resetLayeredHome(hero){
    const elements=homeLayeredElementsFor(hero);
    elements.stage?.classList?.remove("skin-home-layered-active");
    elements.stage?.classList?.remove("skin-home-layered-playing");
    elements.root?.setAttribute?.("aria-hidden","true");
    if(elements.treasureImage){
      elements.treasureImage.style.translate="";
      elements.treasureImage.style.scale="";
    }
    if(elements.characterImage){
      elements.characterImage.style.transform="";
      elements.characterImage.style.translate="";
      elements.characterImage.style.scale="";
      elements.characterImage.removeAttribute?.("tabindex");
      elements.characterImage.removeAttribute?.("role");
      elements.characterImage.removeAttribute?.("aria-label");
      elements.characterImage.removeAttribute?.("aria-busy");
    }
    return elements;
  }

  function applyLayeredHome(hero,favorite){
    const elements=homeLayeredElementsFor(hero);
    if(!elements.root || !favorite?.layered) return null;
    setImageWithFallback(elements.treasureImage,favorite.layered.treasure,DEFAULTS.home);
    setImageWithFallback(elements.characterImage,favorite.layered.character,DEFAULTS.home);
    if(elements.treasureImage){
      elements.treasureImage.style.translate=favorite.layered.supportLayout?.translate || "";
      elements.treasureImage.style.scale=favorite.layered.supportLayout?.scale || "";
    }
    if(elements.characterImage){
      elements.characterImage.style.translate=favorite.layered.characterLayout?.translate || "";
      elements.characterImage.style.scale=favorite.layered.characterLayout?.scale || "";
    }
    elements.stage?.classList?.add("skin-home-layered-active");
    elements.root.setAttribute?.("aria-hidden","false");
    if(elements.characterImage){
      elements.characterImage.tabIndex=0;
      elements.characterImage.setAttribute?.("role","button");
      elements.characterImage.setAttribute?.("aria-label",`${favorite.item.name}のリアクションを再生`);
    }
    return elements;
  }

  function resetHomeLayers(hero,blend){
    if(hero?.style){
      hero.style.opacity="1";
      hero.style.zIndex="1";
    }
    if(blend?.style){
      blend.style.opacity="0";
      blend.style.zIndex="0";
    }
  }

  function animateHomeElement(state,element,keyframes,options){
    if(typeof element?.animate!=="function") return null;
    const animation=element.animate(keyframes,options);
    state.animations.push(animation);
    return animation;
  }

  function addHomeMotionEffects(state,stage,effectType){
    const host=stage?.querySelector?.(".vu3-home-motion-effects");
    const document=stage?.ownerDocument;
    if(!host || !document) return;
    const width=stage.clientWidth || 300;
    const height=stage.clientHeight || 100;
    const specs=effectType==="gems"
      ? [
          {glyph:"◆",delay:300,color:"ruby"},
          {glyph:"✦",delay:440,color:"gold"},
          {glyph:"◆",delay:580,color:"sapphire"},
          {glyph:"✧",delay:720,color:"gold"}
        ]
      : [
          {glyph:"🐾",delay:260,color:"paw"},
          {glyph:"🐾",delay:430,color:"paw"},
          {glyph:"🐾",delay:600,color:"paw"},
          {glyph:"◆",delay:1050,color:"ruby"}
        ];

    specs.forEach((spec,index)=>{
      const particle=document.createElement("span");
      particle.className=`vu3-home-particle is-${spec.color}`;
      particle.textContent=spec.glyph;
      host.appendChild(particle);
      state.effects.push(particle);
      const startX=width*(.14+index*.08);
      const endX=effectType==="gems"
        ? width*(.46+index*.08)
        : width*(.28+index*.13);
      const startY=height*(effectType==="gems" ? .68 : .78);
      const endY=height*(effectType==="gems" ? .34 : .64)-(index%2)*5;
      animateHomeElement(state,particle,[
        {offset:0,opacity:0,transform:`translate3d(${startX}px,${startY}px,0) scale(.45) rotate(0deg)`},
        {offset:.28,opacity:.9,transform:`translate3d(${startX+8}px,${startY-5}px,0) scale(1) rotate(80deg)`},
        {offset:1,opacity:0,transform:`translate3d(${endX}px,${endY}px,0) scale(.68) rotate(210deg)`}
      ],{
        duration:effectType==="gems" ? 650 : 520,
        delay:spec.delay,
        easing:"cubic-bezier(.2,.7,.25,1)",
        fill:"both"
      });
    });
  }

  function addLayeredHomeSparkles(state,elements){
    const host=elements?.sparkles;
    const document=host?.ownerDocument;
    if(!host || !document) return;
    [
      {left:"71%",top:"40%",delay:105},
      {left:"82%",top:"60%",delay:175}
    ].forEach(spec=>{
      const sparkle=document.createElement("span");
      sparkle.className="vu3-home-layer-sparkle";
      sparkle.textContent="✦";
      sparkle.style.left=spec.left;
      sparkle.style.top=spec.top;
      host.appendChild(sparkle);
      state.effects.push(sparkle);
      animateHomeElement(state,sparkle,[
        {offset:0,opacity:0,transform:"translate(-50%,-50%) scale(.35) rotate(0deg)"},
        {offset:.48,opacity:.92,transform:"translate(-50%,-50%) scale(1) rotate(55deg)"},
        {offset:1,opacity:0,transform:"translate(-50%,-50%) scale(.55) rotate(110deg)"}
      ],{
        duration:240,
        delay:spec.delay,
        easing:"ease-out",
        fill:"both"
      });
    });
  }

  function transitionHomePose(hero,state,pose){
    const frameIndex=pose.frame-1;
    const nextLayer=state.blend && state.visibleLayer===hero ? state.blend : hero;
    const previousLayer=state.visibleLayer;
    hero.dataset.homeFrame=String(pose.frame).padStart(2,"0");
    if(!state.blend || nextLayer===previousLayer){
      setImageWithFallback(hero,state.favorite.frames[frameIndex],state.favorite.frames[0]);
      return;
    }

    setImageWithFallback(nextLayer,state.favorite.frames[frameIndex],state.favorite.frames[0]);
    nextLayer.style.opacity="0";
    nextLayer.style.zIndex="2";
    previousLayer.style.zIndex="1";
    animateHomeElement(state,nextLayer,[
      {opacity:0,filter:"blur(2px)"},
      {opacity:1,filter:"blur(0px)"}
    ],{
      duration:state.favorite.crossfadeMs,
      easing:"ease-in-out",
      fill:"forwards"
    });
    animateHomeElement(state,previousLayer,[
      {opacity:1,filter:"blur(0px)"},
      {opacity:0,filter:"blur(2px)"}
    ],{
      duration:state.favorite.crossfadeMs,
      easing:"ease-in-out",
      fill:"forwards"
    });
    state.visibleLayer=nextLayer;
  }

  function stopHomeAnimation(hero,{restoreFrame=false,catalog=defaultCatalog}={}){
    const state=hero ? homePlayback.get(hero) : null;
    if(state){
      state.timers.forEach(timer=>state.clearTimer?.(timer));
      state.animations.forEach(animation=>animation?.cancel?.());
      state.effects.forEach(effect=>effect?.remove?.());
    }
    if(hero){
      homePlayback.delete(hero);
      hero.classList.remove("skin-favorite-playing");
      const stage=state?.stage || homeStageFor(hero);
      const blend=state?.blend || homeBlendFor(hero);
      const layered=homeLayeredElementsFor(hero);
      stage?.classList?.remove("skin-favorite-playing");
      stage?.classList?.remove("skin-home-layered-playing");
      if(stage?.style) stage.style.transform="";
      if(layered.characterImage?.style) layered.characterImage.style.transform="";
      layered.characterImage?.removeAttribute?.("aria-busy");
      resetHomeLayers(hero,blend);
      hero.removeAttribute?.("aria-busy");
      if(restoreFrame){
        const favorite=renderedHomeFavorite(hero,{catalog});
        if(favorite?.mode==="frames"){
          hero.dataset.homeFrame="01";
          setImageWithFallback(hero,favorite.frames[0],DEFAULTS.home);
        }
      }
    }
  }

  function renderHomeFavorite(data,{document=root?.document,catalog=defaultCatalog}={}){
    const hero=document?.querySelector(".vu3-hero");
    if(!hero) return null;
    stopHomeAnimation(hero);
    const stage=document.querySelector?.(".vu3-hero-stage") || homeStageFor(hero);
    const blend=document.querySelector?.(".vu3-hero-blend") || homeBlendFor(hero);
    const favorite=resolveFavorite(data,{catalog});
    resetLayeredHome(hero);
    hero.classList.toggle("skin-favorite-active",Boolean(favorite));
    stage?.classList?.toggle("skin-favorite-active",Boolean(favorite));
    stage?.classList?.toggle(
      "skin-favorite-dog-detective",
      favorite?.item?.category==="dogSkin" && favorite?.item?.id==="dog_detective"
    );
    resetHomeLayers(hero,blend);
    if(favorite){
      hero.dataset.favoriteCategory=favorite.item.category;
      hero.dataset.favoriteItemId=favorite.item.id;
      hero.dataset.homeMode=favorite.mode;
      if(favorite.mode==="layered"){
        delete hero.dataset.homeFrame;
        if(stage){
          stage.removeAttribute?.("tabindex");
          stage.removeAttribute?.("role");
          stage.removeAttribute?.("aria-label");
        }
        applyLayeredHome(hero,favorite);
      }else{
        hero.dataset.homeFrame="01";
        preloadHomeAnimation(favorite.frames);
      }
      if(stage && favorite.mode==="frames"){
        stage.tabIndex=0;
        stage.setAttribute?.("role","button");
        stage.setAttribute?.("aria-label",`${favorite.item.name}のホームアニメーションを再生`);
      }
      if(blend && favorite.mode==="frames"){
        setImageWithFallback(blend,favorite.frames[0],DEFAULTS.home);
      }
    }else{
      delete hero.dataset.favoriteCategory;
      delete hero.dataset.favoriteItemId;
      delete hero.dataset.homeFrame;
      delete hero.dataset.homeMode;
      if(stage){
        stage.removeAttribute?.("tabindex");
        stage.removeAttribute?.("role");
        stage.removeAttribute?.("aria-label");
      }
    }
    hero.alt=favorite ? `${favorite.item.name}（ホーム推しキャラ）` : "ネコと柴犬警察";
    setImageWithFallback(
      hero,
      favorite?.mode==="frames" ? favorite.src : DEFAULTS.home,
      DEFAULTS.home
    );
    return favorite;
  }

  function renderedHomeFavorite(hero,{catalog=defaultCatalog}={}){
    const categoryId=hero?.dataset?.favoriteCategory;
    const itemId=hero?.dataset?.favoriteItemId;
    if(categoryId!=="catSkin" && categoryId!=="dogSkin") return null;
    const item=catalog?.getItem(categoryId,itemId);
    const layered=homeLayeredSkinForItem(item);
    const animation=homeAnimationForItem(item);
    if((!layered && !animation) || item.id==="default") return null;
    if(layered){
      return {
        item,
        mode:"layered",
        src:layered.character,
        layered,
        durationMs:layered.durationMs,
        fallback:DEFAULTS.home
      };
    }
    return {
      item,
      mode:"frames",
      src:animation.frames[0],
      frames:animation.frames,
      keyPoses:animation.keyPoses,
      motion:animation.motion,
      durationMs:animation.durationMs,
      crossfadeMs:animation.crossfadeMs,
      effect:animation.effect,
      fallback:DEFAULTS.home
    };
  }

  function playHomeAnimation(hero,{
    catalog=defaultCatalog,
    reducedMotion=root?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true,
    setTimer=root?.setTimeout?.bind(root),
    clearTimer=root?.clearTimeout?.bind(root)
  }={}){
    const favorite=renderedHomeFavorite(hero,{catalog});
    if(!favorite) return false;
    if(homePlayback.get(hero)?.playing) return false;
    if(favorite.mode==="layered"){
      if(reducedMotion || typeof setTimer!=="function") return false;
      const elements=homeLayeredElementsFor(hero);
      if(!elements.characterImage) return false;
      const state={
        playing:true,
        favorite,
        stage:elements.stage,
        blend:null,
        visibleLayer:null,
        timers:[],
        animations:[],
        effects:[],
        clearTimer
      };
      homePlayback.set(hero,state);
      elements.stage?.classList?.add("skin-home-layered-playing");
      elements.characterImage.setAttribute?.("aria-busy","true");
      animateHomeElement(state,elements.characterImage,favorite.layered.reaction,{
        duration:favorite.durationMs,
        easing:"linear",
        fill:"none"
      });
      addLayeredHomeSparkles(state,elements);
      state.timers.push(setTimer(()=>{
        if(homePlayback.get(hero)===state){
          state.playing=false;
          stopHomeAnimation(hero,{catalog});
        }
      },favorite.durationMs));
      return true;
    }
    hero.dataset.homeFrame="01";
    setImageWithFallback(hero,favorite.frames[0],DEFAULTS.home);
    if(reducedMotion || typeof setTimer!=="function") return false;

    const stage=homeStageFor(hero);
    const blend=homeBlendFor(hero);
    const state={
      playing:true,
      favorite,
      stage,
      blend,
      visibleLayer:hero,
      timers:[],
      animations:[],
      effects:[],
      clearTimer
    };
    homePlayback.set(hero,state);
    hero.classList.add("skin-favorite-playing");
    stage?.classList?.add("skin-favorite-playing");
    hero.setAttribute?.("aria-busy","true");
    resetHomeLayers(hero,blend);
    animateHomeElement(state,stage,favorite.motion,{
      duration:favorite.durationMs,
      easing:"linear",
      fill:"none"
    });
    addHomeMotionEffects(state,stage,favorite.effect);

    favorite.keyPoses.slice(1).forEach(pose=>{
      state.timers.push(setTimer(()=>{
        if(homePlayback.get(hero)===state) transitionHomePose(hero,state,pose);
      },Math.round(favorite.durationMs*pose.at)));
    });
    state.timers.push(setTimer(()=>{
      if(homePlayback.get(hero)===state){
        state.playing=false;
        stopHomeAnimation(hero,{restoreFrame:true,catalog});
      }
    },favorite.durationMs));
    return true;
  }

  function isHomeAnimationPlaying(hero){
    return homePlayback.get(hero)?.playing===true;
  }

  function initializeHome(){
    const document=root?.document;
    const playerData=root?.NyanPlayerData;
    if(!document || !playerData) return;
    const refresh=()=>renderHomeFavorite(playerData.getSnapshot?.());
    Promise.resolve(playerData.ready).then(refresh).catch(refresh);
    root.addEventListener?.("nyan-player-appearance-changed",refresh);
    const hero=document.querySelector(".vu3-hero");
    const stage=document.querySelector(".vu3-hero-stage") || hero;
    const layeredCharacter=stage?.querySelector?.(".vu3-home-layer-character") || null;
    const play=event=>{
      if(!hero.classList.contains("skin-favorite-active")) return;
      if(hero.dataset.homeMode==="layered" && event?.target!==layeredCharacter) return;
      playHomeAnimation(hero);
    };
    stage?.addEventListener("click",play);
    stage?.addEventListener("keydown",event=>{
      if(event.key!=="Enter" && event.key!==" ") return;
      if(hero.dataset.homeMode==="layered" && event.target!==layeredCharacter) return;
      event.preventDefault();
      play(event);
    });
  }

  const api=Object.freeze({
    DOG_KEYS,DEFAULTS,HOME_ANIMATIONS,HOME_LAYERED_SKINS,
    HOME_ANIMATION_DURATION_MS,HOME_CROSSFADE_MS,HOME_REACTION_DURATION_MS,
    isOnlineMode,equippedItem,resolveCatPiece,resolveDogPiece,resolveDogCard,
    resolveOutcomeImage,resolveResultImage,resolveFavorite,setImageWithFallback,
    effectSource,showEffectAtElement,showBoardEffect,renderHomeFavorite,
    renderedHomeFavorite,preloadHomeAnimation,playHomeAnimation,
    stopHomeAnimation,isHomeAnimationPlaying,initializeHome
  });

  if(root?.document) initializeHome();
  return api;
});
