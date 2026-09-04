"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Catalog=require("../collection-catalog.js");
const Skins=require("../skin-presentation.js");

function data(){
  return {
    ownedCatSkins:["default","cat_kaitou"],
    ownedDogSkins:["default","dog_detective"],
    equippedAppearance:{catSkinId:"cat_kaitou",dogSkinId:"dog_detective"},
    favoriteCharacter:{category:"catSkin",itemId:"cat_kaitou"}
  };
}

test("第1弾スキンの全カタログ画像が実在する",()=>{
  [Catalog.getItem("catSkin","cat_kaitou"),Catalog.getItem("dogSkin","dog_detective")]
    .forEach(item=>{
      ["collectionImage","profileImage","homeImage","resultWinImage","resultLoseImage","moveEffect","foundFootprintEffect"]
        .forEach(field=>assert.equal(fs.existsSync(path.resolve(__dirname,"..",item[field])),true,`${item.id}.${field}`));
      const pieces=typeof item.pieceImage==="string" ? [item.pieceImage] : Object.values(item.pieceImage);
      pieces.forEach(piece=>assert.equal(fs.existsSync(path.resolve(__dirname,"..",piece)),true,piece));
    });
});

test("探偵しばは1スキン内に赤・黒・白の個別駒を持つ",()=>{
  const item=Catalog.getItem("dogSkin","dog_detective");
  assert.deepEqual(Object.keys(item.pieceImage),["red","black","white"]);
  assert.deepEqual(Object.keys(item.cardImage),["red","black","white"]);
  assert.equal(Skins.resolveDogPiece(data(),0).src,item.pieceImage.red);
  assert.equal(Skins.resolveDogPiece(data(),1).src,item.pieceImage.black);
  assert.equal(Skins.resolveDogPiece(data(),2).src,item.pieceImage.white);
  assert.equal(Skins.resolveDogCard(data(),0).src,item.cardImage.red);
  assert.equal(Skins.resolveDogCard(data(),1).src,item.cardImage.black);
  assert.equal(Skins.resolveDogCard(data(),2).src,item.cardImage.white);
});

test("怪盗にゃん装備時は猫駒を解決する",()=>{
  assert.equal(Skins.resolveCatPiece(data()).src,Catalog.getItem("catSkin","cat_kaitou").pieceImage);
});

test("default装備と不正装備は従来画像へフォールバックする",()=>{
  const defaults={
    ownedCatSkins:["default"],ownedDogSkins:["default"],
    equippedAppearance:{catSkinId:"default",dogSkinId:"default"}
  };
  assert.equal(Skins.resolveCatPiece(defaults).src,"./assets/images/cat_play_normal.png");
  assert.deepEqual([0,1,2].map(i=>Skins.resolveDogPiece(defaults,i).src),[
    "./assets/images/dog_red.png","./assets/images/dog_green.png","./assets/images/dog_blue.png"
  ]);
  const invalid={...defaults,equippedAppearance:{catSkinId:"missing",dogSkinId:"missing"}};
  assert.equal(Skins.resolveCatPiece(invalid).src,Skins.DEFAULTS.catPiece);
  assert.equal(Skins.resolveDogPiece(invalid,1).src,Skins.DEFAULTS.dogPieces[1]);
});

test("オンラインは通信仕様を使わず標準画像を維持する",()=>{
  assert.equal(Skins.resolveCatPiece(data(),{playMode:"onlineCat"}).src,Skins.DEFAULTS.catPiece);
  assert.equal(Skins.resolveDogPiece(data(),2,{playMode:"onlinePolice"}).src,Skins.DEFAULTS.dogPieces[2]);
  assert.equal(Skins.resolveDogCard(data(),2,{playMode:"onlinePolice"}).src,Skins.DEFAULTS.dogCards[2]);
  assert.equal(Skins.effectSource(data(),"catSkin","move",{playMode:"onlineCat"}),null);
});

test("勝敗とプレイヤー側に応じて勝利・敗北画像を解決する",()=>{
  const cat=Catalog.getItem("catSkin","cat_kaitou");
  const dog=Catalog.getItem("dogSkin","dog_detective");
  assert.equal(Skins.resolveResultImage(data(),"cat","cpuPolice").src,cat.resultWinImage);
  assert.equal(Skins.resolveResultImage(data(),"dogs","cpuPolice").src,cat.resultLoseImage);
  assert.equal(Skins.resolveResultImage(data(),"dogs","cpuCat").src,dog.resultWinImage);
  assert.equal(Skins.resolveResultImage(data(),"cat","cpuCat").src,dog.resultLoseImage);

  const onlyCat=data();
  onlyCat.equippedAppearance.dogSkinId="default";
  assert.equal(Skins.resolveResultImage(onlyCat,"dogs","local").src,cat.resultLoseImage);
  const onlyDog=data();
  onlyDog.equippedAppearance.catSkinId="default";
  assert.equal(Skins.resolveResultImage(onlyDog,"cat","local").src,dog.resultLoseImage);
});

test("ホーム推し設定は装備とは独立して候補画像を解決する",()=>{
  const state=data();
  state.equippedAppearance.catSkinId="default";
  const cat=Skins.resolveFavorite(state);
  assert.equal(cat.item.id,"cat_kaitou");
  assert.equal(cat.mode,"layered");
  assert.match(cat.src,/kaito-nyan-home-character\.png$/);
  assert.equal("background" in cat.layered,false);
  assert.equal("stage" in cat.layered,false);
  state.favoriteCharacter={category:"dogSkin",itemId:"dog_detective"};
  const dog=Skins.resolveFavorite(state);
  assert.equal(dog.item.id,"dog_detective");
  assert.equal(dog.mode,"layered");
  assert.match(dog.layered.treasure,/detective-shiba-home-clues\.png$/);
  assert.match(dog.src,/detective-shiba-home-character\.png$/);
});

function heroMock(){
  const classes=new Set();
  const attributes=new Map();
  const animationCalls=[];
  return {
    alt:"",src:"",onerror:null,dataset:{},
    style:{},animationCalls,
    classList:{
      toggle(name,enabled){ enabled ? classes.add(name) : classes.delete(name); },
      add(name){ classes.add(name); },
      remove(name){ classes.delete(name); },
      contains(name){ return classes.has(name); }
    },
    closest(){ return this; },
    querySelector(){ return null; },
    animate(keyframes,options){
      const animation={keyframes,options,cancelled:false,cancel(){ this.cancelled=true; }};
      animationCalls.push(animation);
      return animation;
    },
    setAttribute(name,value){ attributes.set(name,value); },
    removeAttribute(name){ attributes.delete(name); },
    hasAttribute(name){ return attributes.has(name); }
  };
}

function layeredHomeMock(){
  const createElement=()=>{
    const classes=new Set();
    const attributes=new Map();
    const animationCalls=[];
    return {
      src:"",onerror:null,dataset:{},style:{},animationCalls,children:[],
      classList:{
        toggle(name,enabled){ enabled ? classes.add(name) : classes.delete(name); },
        add(name){ classes.add(name); },
        remove(name){ classes.delete(name); },
        contains(name){ return classes.has(name); }
      },
      animate(keyframes,options){
        const animation={keyframes,options,cancel(){}};
        animationCalls.push(animation);
        return animation;
      },
      appendChild(child){ this.children.push(child); },
      setAttribute(name,value){ attributes.set(name,value); },
      removeAttribute(name){ attributes.delete(name); },
      hasAttribute(name){ return attributes.has(name); }
    };
  };
  const hero=heroMock();
  const blend=createElement();
  const treasureImage=createElement();
  const characterImage=createElement();
  const sparkles=createElement();
  const layeredRoot=createElement();
  const stage=createElement();
  layeredRoot.querySelector=selector=>({
    ".vu3-home-layer-treasure":treasureImage,
    ".vu3-home-layer-character":characterImage,
    ".vu3-home-layer-sparkles":sparkles
  })[selector] || null;
  stage.querySelector=selector=>({
    ".vu3-home-layered-skin":layeredRoot,
    ".vu3-hero-blend":blend
  })[selector] || null;
  hero.closest=()=>stage;
  const document={
    querySelector:selector=>({
      ".vu3-hero":hero,
      ".vu3-hero-stage":stage,
      ".vu3-hero-blend":blend
    })[selector] || null,
    createElement
  };
  sparkles.ownerDocument=document;
  return {
    hero,stage,blend,treasureImage,characterImage,sparkles,document
  };
}

test("怪盗にゃんのホーム描画は前景と猫の2レイヤーだけを表示しデータを変更しない",()=>{
  const view=layeredHomeMock();
  const {hero,document}=view;
  const state=data();
  const before=JSON.stringify(state);

  Skins.renderHomeFavorite(state,{document});
  assert.equal(hero.dataset.favoriteCategory,"catSkin");
  assert.equal(hero.dataset.favoriteItemId,"cat_kaitou");
  assert.equal(hero.dataset.homeMode,"layered");
  assert.equal("homeFrame" in hero.dataset,false);
  assert.match(view.treasureImage.src,/kaito-nyan-home-treasure\.png$/);
  assert.match(view.characterImage.src,/kaito-nyan-home-character\.png$/);
  assert.equal(view.treasureImage.style.translate,"2% 38%");
  assert.equal(view.characterImage.style.translate,"-4.5% 42%");
  assert.equal(view.stage.classList.contains("skin-home-layered-active"),true);
  assert.equal(Skins.renderedHomeFavorite(hero).item.id,"cat_kaitou");
  assert.equal(JSON.stringify(state),before);

  Skins.renderHomeFavorite({...state,favoriteCharacter:null},{document});
  assert.equal("favoriteCategory" in hero.dataset,false);
  assert.equal("favoriteItemId" in hero.dataset,false);
  assert.equal("homeFrame" in hero.dataset,false);
  assert.equal("homeMode" in hero.dataset,false);
  assert.equal(Skins.renderedHomeFavorite(hero),null);
});

test("旧フレーム式ホーム素材は削除せず維持する",()=>{
  Object.values(Skins.HOME_ANIMATIONS).forEach(animation=>{
    assert.equal(animation.frames.length,10);
    assert.equal(animation.keyPoses.length,6);
    assert.equal(animation.durationMs,1450);
    assert.equal(animation.crossfadeMs,60);
    assert.ok(animation.motion.length>=7);
    animation.frames.forEach((src,index)=>{
      assert.match(src,new RegExp(`-${String(index+1).padStart(2,"0")}\\.png$`));
      const buffer=fs.readFileSync(path.resolve(__dirname,"..",src));
      assert.equal(buffer.readUInt32BE(16),2172);
      assert.equal(buffer.readUInt32BE(20),724);
    });
  });
});

test("怪盗にゃん2レイヤー素材は指定順で実在する",()=>{
  const layered=Skins.HOME_LAYERED_SKINS["catSkin:cat_kaitou"];
  assert.deepEqual(Object.keys(layered).slice(0,2),["treasure","character"]);
  [layered.treasure,layered.character].forEach(src=>{
    const buffer=fs.readFileSync(path.resolve(__dirname,"..",src));
    assert.equal(buffer.readUInt32BE(16),2172,src);
    assert.equal(buffer.readUInt32BE(20),724,src);
    assert.equal(buffer[25],6,`${src} must be RGBA`);
  });
  assert.equal(layered.durationMs,450);
  assert.equal(layered.reaction.length,5);
});

test("探偵しば2レイヤー素材とスキン別配置が実在する",()=>{
  const layered=Skins.HOME_LAYERED_SKINS["dogSkin:dog_detective"];
  assert.match(layered.treasure,/detective-shiba-home-clues\.png$/);
  assert.match(layered.character,/detective-shiba-home-character\.png$/);
  [layered.treasure,layered.character].forEach(src=>{
    const buffer=fs.readFileSync(path.resolve(__dirname,"..",src));
    assert.equal(buffer.readUInt32BE(16),2172,src);
    assert.equal(buffer.readUInt32BE(20),724,src);
    assert.equal(buffer[25],6,`${src} must be RGBA`);
  });
  assert.deepEqual(layered.supportLayout,{translate:"26% 8%",scale:".50"});
  assert.deepEqual(layered.characterLayout,{translate:"-13% 12%",scale:".88"});
  assert.doesNotMatch(layered.supportLayout.translate,/px/);
  assert.doesNotMatch(layered.characterLayout.translate,/px/);
  assert.equal(layered.durationMs,480);

  const view=layeredHomeMock();
  const state=data();
  state.favoriteCharacter={category:"dogSkin",itemId:"dog_detective"};
  Skins.renderHomeFavorite(state,{document:view.document});
  assert.equal(view.stage.classList.contains("skin-favorite-dog-detective"),true);
});

test("ホームフレームの事前読み込みは初期表示を塞がず順番に進む",()=>{
  const scheduled=[];
  const images=[];
  class FakeImage{
    constructor(){ images.push(this); }
    set src(value){ this.loadedSrc=value; }
  }
  const frames=["preview-01.png","preview-02.png","preview-03.png"];
  assert.equal(Skins.preloadHomeAnimation(frames,{
    ImageCtor:FakeImage,
    schedule:callback=>scheduled.push(callback)
  }),true);
  assert.equal(images.length,0);
  assert.equal(scheduled.length,1);

  scheduled.shift()();
  assert.equal(images[0].loadedSrc,"preview-02.png");
  images[0].onload();
  assert.equal(scheduled.length,1);
  scheduled.shift()();
  assert.equal(images[1].loadedSrc,"preview-03.png");
});

test("探偵しばは3匹レイヤーだけを480ms動かし連打を無視する",()=>{
  const view=layeredHomeMock();
  const state=data();
  state.favoriteCharacter={category:"dogSkin",itemId:"dog_detective"};
  Skins.renderHomeFavorite(state,{document:view.document});
  const queue=[];
  const setTimer=(callback,delay)=>{
    const task={callback,delay,cancelled:false};
    queue.push(task);
    return task;
  };
  const clearTimer=task=>{ task.cancelled=true; };

  assert.equal(Skins.playHomeAnimation(view.hero,{setTimer,clearTimer,reducedMotion:false}),true);
  assert.equal(Skins.playHomeAnimation(view.hero,{setTimer,clearTimer,reducedMotion:false}),false);
  assert.equal(Skins.isHomeAnimationPlaying(view.hero),true);
  assert.deepEqual(queue.map(task=>task.delay),[480]);
  const reaction=view.characterImage.animationCalls[0];
  assert.equal(reaction.options.duration,480);
  assert.match(reaction.keyframes[2].transform,/translate3d\(8px,-5px,0\)/);
  assert.equal(view.stage.animationCalls.length,0);
  assert.equal(view.treasureImage.animationCalls.length,0);
  queue[0].callback();
  assert.equal(Skins.isHomeAnimationPlaying(view.hero),false);
  assert.equal(view.characterImage.hasAttribute("aria-busy"),false);
});

test("怪盗にゃんは猫レイヤーだけを450ms動かし連打を無視する",()=>{
  const view=layeredHomeMock();
  const state=data();
  Skins.renderHomeFavorite(state,{document:view.document});
  const queue=[];
  const setTimer=(callback,delay)=>{
    const task={callback,delay,cancelled:false};
    queue.push(task);
    return task;
  };
  const clearTimer=task=>{ task.cancelled=true; };

  assert.equal(Skins.playHomeAnimation(view.hero,{setTimer,clearTimer,reducedMotion:false}),true);
  assert.equal(Skins.playHomeAnimation(view.hero,{setTimer,clearTimer,reducedMotion:false}),false);
  assert.equal(Skins.isHomeAnimationPlaying(view.hero),true);
  assert.deepEqual(queue.map(task=>task.delay),[450]);
  const reaction=view.characterImage.animationCalls[0];
  assert.equal(reaction.options.duration,450);
  assert.match(reaction.keyframes[2].transform,/translate3d\(10px,-6px,0\)/);
  assert.match(reaction.keyframes.at(-1).transform,/translate3d\(0,0,0\)/);
  assert.equal(view.stage.animationCalls.length,0);
  assert.equal(view.treasureImage.animationCalls.length,0);

  queue[0].callback();
  assert.equal(Skins.isHomeAnimationPlaying(view.hero),false);
  assert.equal(view.characterImage.style.transform,"");
  assert.equal(view.characterImage.hasAttribute("aria-busy"),false);
});

test("探偵しばもモーション低減時は静止したまま",()=>{
  const view=layeredHomeMock();
  const state=data();
  state.favoriteCharacter={category:"dogSkin",itemId:"dog_detective"};
  Skins.renderHomeFavorite(state,{document:view.document});
  let scheduled=0;
  assert.equal(Skins.playHomeAnimation(view.hero,{
    reducedMotion:true,
    setTimer:()=>{ scheduled+=1; }
  }),false);
  assert.equal(scheduled,0);
  assert.equal(view.characterImage.animationCalls.length,0);
  assert.equal(Skins.isHomeAnimationPlaying(view.hero),false);
});

test("怪盗にゃんもモーション低減時は静止したまま",()=>{
  const view=layeredHomeMock();
  Skins.renderHomeFavorite(data(),{document:view.document});
  let scheduled=0;
  assert.equal(Skins.playHomeAnimation(view.hero,{
    reducedMotion:true,
    setTimer:()=>{ scheduled+=1; }
  }),false);
  assert.equal(scheduled,0);
  assert.equal(view.characterImage.animationCalls.length,0);
  assert.equal(Skins.isHomeAnimationPlaying(view.hero),false);
});

test("装飾エフェクト解決はデータを書き換えない",()=>{
  const state=data();
  const before=JSON.stringify(state);
  assert.match(Skins.effectSource(state,"catSkin","move"),/cat_kaitou_effect_cards/);
  assert.match(Skins.effectSource(state,"dogSkin","found"),/dog_detective_effect_search/);
  assert.equal(JSON.stringify(state),before);
});

test("画像ロード失敗時は指定したdefaultへ一度だけ戻す",()=>{
  const image={src:"",onerror:null};
  Skins.setImageWithFallback(image,"missing.png","default.png");
  assert.equal(image.src,"missing.png");
  image.onerror();
  assert.equal(image.src,"default.png");
  assert.equal(image.onerror,null);
});

test("既存リザルト導線とゲーム定数はソース上でも維持される",()=>{
  const root=path.resolve(__dirname,"..");
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const engine=fs.readFileSync(path.join(root,"engine.js"),"utf8");
  ["resultRoute","resultRouteBoard","againBtn","resultHomeBtn"].forEach(id=>{
    assert.match(html,new RegExp(`id=[\"']${id}[\"']`));
  });
  assert.match(engine,/BOX_COUNT\s*=\s*25/);
  assert.match(engine,/NODE_COUNT\s*=\s*36/);
  assert.match(engine,/MAX_TURNS\s*=\s*11/);
});
