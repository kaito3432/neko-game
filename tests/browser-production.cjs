// Explicit production smoke test. Creates isolated test profiles/rooms only.
// Serve QA hooks in memory; never ship them or use the user's browser storage.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const Player=require('../player-data.js');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/deploy-20260906');
if(process.env.NYAN_PRODUCTION_SMOKE!=='yes')throw Error('Explicit production opt-in required');
const server=http.createServer(async(req,res)=>{try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';
  if(name.includes('..'))throw Error('invalid');
  let data=await fs.readFile(path.join(root,name));
  if(name==='game.js')data=Buffer.from(data.toString().replace(/initGame\(true\);\s*\}\)\(\);\s*$/,`initGame(true);window.__onlineQA={state:()=>game,mode:()=>playMode,node:handleNodePress,box:handleBoxPress,render};})();`));
  res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(name)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
}catch(_){res.writeHead(404);res.end();}});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const errors=[],report=[];
  try{
    const pages=[];
    for(let i=0;i<2;i++){
      const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
      const data=Player.createDefaultData();data.ownedCatSkins.push('cat_kaitou');data.ownedDogSkins.push('dog_detective');
      data.equippedAppearance.catSkinId='cat_kaitou';data.equippedAppearance.dogSkinId='dog_detective';
      await context.addInitScript(({data,keys})=>{if(!localStorage.getItem(keys.playerData)){localStorage.setItem(keys.playerData,JSON.stringify(data));localStorage.setItem(keys.playerId,data.playerId);}}, {data,keys:Player.STORAGE_KEYS});
      const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${server.address().port}`);pages.push(p);
    }
    const [a,b]=pages;
    async function dismiss(p){await p.waitForTimeout(500);if(await p.locator('#privacyOverlay.show').count())await p.locator('#privacyBtn').click();}
    for(const kind of ['room','random']){
      for(const p of pages){await p.reload();await p.evaluate(()=>NyanPlayerData.updateEquipment('catSkin','cat_kaitou'));await p.locator('#onlineModeBtn').click();await p.locator(kind==='room'?'#roomMatchStart':'#randomMatchStart').click();}
      if(kind==='room'){
        await a.locator('#createOnlineRoomBtn').click();await a.waitForFunction(()=>NyanOnline.getSession().roomCode);
        const code=await a.evaluate(()=>NyanOnline.getSession().roomCode);assert.match(code,/^\d{6}$/);
        await b.locator('#onlineRoomCodeInput').fill(code);await b.locator('#joinOnlineRoomBtn').click();
        await Promise.all(pages.map(p=>p.waitForFunction(()=>NyanOnline.getSession().role)));
        await a.locator('#onlineStartGameBtn').click();await a.locator('#onlineNormalRuleBtn').click();
      }
      await Promise.all(pages.map(p=>p.waitForFunction(()=>__onlineQA.mode().startsWith('online')&&['dogSetup','onlineWaitingDogSetup'].includes(__onlineQA.state().phase),null,{timeout:45000})));
      const sessions=await Promise.all(pages.map(p=>p.evaluate(()=>NyanOnline.getSession())));
      assert.notEqual(sessions[0].role,sessions[1].role);
      if(kind==='random'){assert.match(sessions[0].matchId,/^rm_[0-9a-f-]{36}$/);assert.equal(sessions[0].matchId,sessions[1].matchId);}
      const cat=sessions[0].role==='cat'?a:b,police=cat===a?b:a;
      for(const p of pages)await dismiss(p);
      await police.evaluate(()=>{__onlineQA.node(14);__onlineQA.node(15);__onlineQA.node(21);});
      await cat.waitForFunction(()=>__onlineQA.state().phase==='catSetup');await dismiss(cat);await cat.evaluate(()=>__onlineQA.box(12));
      await police.waitForFunction(()=>__onlineQA.state().phase==='dogs');await dismiss(police);
      const snapshots=await Promise.all(pages.map(p=>p.evaluate(()=>NyanOnline.getAppearanceSnapshot())));
      assert.deepEqual(snapshots[0],snapshots[1]);assert.equal(snapshots[0].catPlayer.catSkinId,'cat_kaitou');assert.equal(snapshots[0].policePlayer.dogSkinId,'dog_detective');
      for(const p of pages){assert.equal(await p.locator('#board img[data-skin-id="dog_detective"]').count(),3);await p.evaluate(()=>{window.__seenEffects=[];new MutationObserver(rs=>rs.forEach(r=>r.addedNodes.forEach(n=>{if(n.classList?.contains('skin-decorative-effect'))__seenEffects.push(n.src);}))).observe(document.body,{childList:true,subtree:true});});}
      await cat.evaluate(()=>NyanPlayerData.updateEquipment('catSkin','default'));assert.deepEqual(await cat.evaluate(()=>NyanOnline.getAppearanceSnapshot()),snapshots[0]);
      await police.evaluate(()=>{__onlineQA.node(14);__onlineQA.node(20);__onlineQA.node(15);__onlineQA.node(9);__onlineQA.node(21);__onlineQA.node(22);});await police.locator('#finishDogTurnBtn').click();
      await cat.waitForFunction(()=>__onlineQA.state().phase==='cat'&&__onlineQA.state().turn===2);await dismiss(cat);
      await cat.evaluate(()=>{__onlineQA.state().catVisible=true;__onlineQA.render();});assert.equal(await cat.locator('#board img[data-skin-id="cat_kaitou"]').count(),1);
      await cat.waitForTimeout(1300);await cat.evaluate(()=>__onlineQA.box(13));
      await police.waitForFunction(()=>__onlineQA.state().phase==='dogs'&&__onlineQA.state().turn===2);
      await police.evaluate(()=>{__onlineQA.node(20);__onlineQA.box(12);});await police.waitForFunction(()=>!__onlineQA.state().actionLocked);
      for(const p of pages){await p.waitForFunction(()=>__seenEffects.some(src=>src.endsWith(NyanSkinPresentation.effectSource(null,'dogSkin','found',{playMode:'onlineCat'}).replace(/^\.\//,''))));assert.ok(await p.evaluate(()=>__seenEffects.some(src=>src.endsWith(NyanSkinPresentation.effectSource(null,'catSkin','move',{playMode:'onlineCat'}).replace(/^\.\//,'')))));}
      await police.evaluate(()=>{__onlineQA.node(22);__onlineQA.box(13);});await Promise.all(pages.map(p=>p.waitForFunction(()=>__onlineQA.state().gameOver)));
      if(kind==='random')await Promise.all(pages.map(p=>p.waitForFunction(()=>NyanPlayerData.getSnapshot().battleReceipts.some(id=>id.startsWith('rm_')))));
      for(const [i,p] of pages.entries()){
        const data=await p.evaluate(()=>NyanPlayerData.getSnapshot());assert.equal(data.battleReceipts.length,kind==='room'?0:1);assert.equal(data.nyanCoins,0);
        await p.waitForTimeout(2200);await p.screenshot({path:path.join(output,`${kind}-result-${i}.png`)});
      }
      report.push({kind,result:'PASS',sameSkins:true,moveAndFoundEffects:true,frozenSnapshot:true,receipts:kind==='room'?0:1});
      console.log('PASS',kind,'6-digit room/roles, setup, moves, search, capture, skins, effects, receipts');
      await fs.writeFile(path.join(output,'browser-production.json'),JSON.stringify({report,errors},null,2));
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
