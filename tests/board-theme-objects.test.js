const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const Catalog=require("../collection-catalog.js");
const Collection=require("../collection.js");
const Skins=require("../skin-presentation.js");
const engineContext={window:{}};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,"../engine.js"),"utf8"),engineContext);
const Engine=engineContext.window.NyanEngine;

test("defaultと月夜の城下町は別の封鎖オブジェクトを持ち、欠落テーマはdefaultへ戻る",()=>{
  const day=Catalog.boardThemePresentation("default");
  const moon=Catalog.boardThemePresentation("board_coin_01");
  assert.match(day.blockedObjects[1],/day-planter\.svg$/);
  assert.match(day.blockedObjects[25],/day-sign\.svg$/);
  assert.match(moon.blockedObjects[1],/moon-stone-lantern\.svg$/);
  assert.match(moon.blockedObjects[25],/moon-andon\.svg$/);
  assert.notDeepEqual(moon.blockedObjects,day.blockedObjects);
  assert.deepEqual(Catalog.boardThemePresentation("missing").blockedObjects,day.blockedObjects);
  for(const src of Object.values({...day.blockedObjects,...moon.blockedObjects})){
    assert.ok(fs.existsSync(path.resolve(__dirname,"..",src)));
  }
});

test("装備テーマを変えると背景と1・25オブジェクトが同じresolverで切り替わる",()=>{
  const data={ownedBoardThemes:["default","board_coin_01"],equippedAppearance:{boardThemeId:"default"}};
  const day=Skins.resolveBoardTheme(data);
  data.equippedAppearance.boardThemeId="board_coin_01";
  const moon=Skins.resolveBoardTheme(data);
  assert.notEqual(day.src,moon.src);
  assert.deepEqual(day.blockedObjects,Catalog.boardThemePresentation("default").blockedObjects);
  assert.deepEqual(moon.blockedObjects,Catalog.boardThemePresentation("board_coin_01").blockedObjects);
});

test("Collection縮小盤面は実テーマデータの5×5・1/25封鎖を非操作で表示する",()=>{
  const moon=Catalog.getItem("boardTheme","board_coin_01");
  const model=Collection.boardThemePreviewModel(moon);
  assert.equal(model.cells.length,25);
  assert.deepEqual(model.cells.filter(cell=>cell.blocked).map(cell=>cell.number),[1,25]);
  assert.equal(model.cells[0].object,Catalog.boardThemePresentation(moon.id).blockedObjects[1]);
  assert.equal(model.cells[24].object,Catalog.boardThemePresentation(moon.id).blockedObjects[25]);
  const createElement=tag=>({tag,children:[],style:{setProperty(name,value){this[name]=value;}},dataset:{},appendChild(child){this.children.push(child);},append(...children){this.children.push(...children);},setAttribute(){}});
  const preview=Collection.createBoardThemePreview({createElement},moon);
  assert.equal(preview.children.length,41);
  assert.equal(preview.children.filter(child=>child.tag==="button").length,0);
  assert.equal(preview.dataset.boardThemeId,moon.id);
  assert.equal(preview.children[0].children[0].src,model.cells[0].object);
  assert.equal(preview.children[24].children[0].src,model.cells[24].object);
  assert.equal(preview.style["--nyan-board-theme-image"],`url("${model.background}")`);
  const pair=Collection.createBoardThemePreviews({createElement},moon);
  assert.equal(pair.children.length,2);
  assert.equal(pair.children[0].children[0].textContent,"ホーム");
  assert.equal(pair.children[1].children[0].textContent,"プレイ画面");
  assert.equal(pair.children[0].children[1].style["--nyan-home-theme-image"],`url("${model.background}")`);
  assert.equal(pair.children[0].children[1].children[1].src,"./assets/images/home_hero.png");
  assert.equal(pair.children[1].children[1].dataset.boardThemeId,moon.id);
  assert.equal(pair.children[1].children[1].children[0].children[0].src,model.cells[0].object);
  assert.equal(pair.children[1].children[1].children[24].children[0].src,model.cells[24].object);
  assert.equal(pair.children[0].children[1].children.filter(child=>child.tag==="button").length,0);
});

test("Homeとプレイ画面プレビューはテーマ切替とfallbackを共有し、実画面の背景CSSを再利用する",()=>{
  const css=fs.readFileSync(path.resolve(__dirname,"../style.css"),"utf8");
  assert.match(css,/\.visual-update3,\.collection-home-preview\{[^}]*--nyan-home-theme-image/s);
  assert.match(css,/\.board-shell::before,\.collection-board-preview::before\{[^}]*opacity:\.11/s);
  assert.match(css,/\.collection-theme-previews\{[^}]*pointer-events:none/s);
  const createElement=tag=>({tag,children:[],style:{setProperty(name,value){this[name]=value;}},dataset:{},append(...children){this.children.push(...children);},appendChild(child){this.children.push(child);},setAttribute(){}});
  const document={createElement};
  const day=Collection.createBoardThemePreviews(document,Catalog.getItem("boardTheme","default"));
  const moon=Collection.createBoardThemePreviews(document,Catalog.getItem("boardTheme","board_coin_01"));
  const fallback=Collection.createBoardThemePreviews(document,{id:"missing"});
  const background=pair=>pair.children[0].children[1].style["--nyan-home-theme-image"];
  assert.notEqual(background(day),background(moon));
  assert.equal(background(day),background(fallback));
  assert.equal(moon.children[1].children[1].style["--nyan-board-theme-image"],background(moon));
});

function qaAt(url){
  const data={nyanCoins:7,ownedCatSkins:["default"],ownedDogSkins:["default"],
    ownedBoardThemes:["default"],ownedCardboards:["default"],ownedPaws:["default"],
    ownedProfileFrames:["rank_bronze"],equippedAppearance:{boardThemeId:"default"}};
  let writes=0;
  const base={getSnapshot:()=>data,load:async()=>data,save:async()=>{writes++;return data;},
    purchaseCollectionItem:async()=>{writes++;return data;},updateEquipment:async()=>{writes++;return data;}};
  const context={location:new URL(url),URLSearchParams,NyanCollectionCatalog:Catalog,NyanPlayerData:base};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,"../debug/board-theme-qa.js"),"utf8"),context);
  return {qa:context.NyanBoardThemeQa,data,writes:()=>writes};
}

test("ローカルQAは2000コイン・全Skinを表示し、月夜購入と装備はメモリ内だけ",async()=>{
  const {qa,data,writes}=qaAt("http://localhost:8000/index.html?nyanBoardThemeQa=1");
  assert.equal(qa.active,true);
  const before=await qa.collectionPlayerData.load();
  assert.equal(before.nyanCoins,2000);
  assert.ok(before.ownedCatSkins.includes("cat_master_s01_king"));
  assert.ok(before.ownedDogSkins.includes("dog_coin_01"));
  assert.ok(before.ownedProfileFrames.includes("rank_master"));
  assert.equal(before.ownedBoardThemes.includes("board_coin_01"),false);
  await qa.collectionPlayerData.purchaseCollectionItem("boardTheme","board_coin_01");
  await qa.collectionPlayerData.updateEquipment("boardTheme","board_coin_01");
  assert.equal(qa.presentationState(data).nyanCoins,1940);
  assert.equal(qa.presentationState(data).equippedAppearance.boardThemeId,"board_coin_01");
  assert.equal(data.nyanCoins,7);
  assert.deepEqual(data.ownedBoardThemes,["default"]);
  assert.equal(data.equippedAppearance.boardThemeId,"default");
  assert.equal(writes(),0);
});

test("QA全テーマURLは全開放、通常URL・Production originは無効",()=>{
  const all=qaAt("http://localhost:8000/index.html?nyanBoardThemeQa=1&allThemes=1");
  assert.ok(all.qa.presentationState(all.data).ownedBoardThemes.includes("board_coin_01"));
  assert.equal(qaAt("http://localhost:8000/index.html").qa,undefined);
  assert.equal(qaAt("https://example.com/index.html?nyanBoardThemeQa=1&allThemes=1").qa,undefined);
});

test("封鎖と9ターンの正式ルールは維持",()=>{
  assert.equal(Engine.MAX_TURNS,9);
  assert.equal(Engine.isValidBox(0),false);
  assert.equal(Engine.isValidBox(24),false);
  const game=fs.readFileSync(path.resolve(__dirname,"../game.js"),"utf8");
  assert.match(game,/document\.createElement\(active\?"button":"div"\)/);
  assert.match(game,/b\.dataset\.blockedBox=String\(i\+1\)/);
  assert.match(game,/object\.draggable=false/);
});
