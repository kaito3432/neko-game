/* Isolated Chrome + local Wrangler. No user data or live service is used. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const Player=require('../player-data.js');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/online-20260906');
const server=http.createServer(async(req,res)=>{
  try{
    let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';
    if(name.includes('..'))throw Error('invalid');
    let content=await fs.readFile(path.join(root,name));
    if(name==='online.js')content=Buffer.from(content.toString().replace('https://nyan-chase-online.honda19990602.workers.dev',process.env.NYAN_LOCAL_API||'http://127.0.0.1:8798'));
    if(name==='game.js')content=Buffer.from(content.toString().replace(/initGame\(true\);\s*\}\)\(\);\s*$/,`initGame(true);window.__onlineQA={state:()=>game,mode:()=>playMode,node:handleNodePress,box:handleBoxPress,render};})();`));
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.wav':'audio/wav'};
    res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
  }catch(_){res.writeHead(404);res.end();}
});
(async()=>{
  await fs.mkdir(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const errors=[];
  try{
    const contexts=await Promise.all([0,1].map(async(index)=>{
      const ctx=await browser.newContext({viewport:{width:320,height:568},serviceWorkers:'block'});
      await ctx.addInitScript(()=>{const Original=window.WebSocket;window.__qaSockets=[];window.WebSocket=class extends Original{constructor(...args){super(...args);window.__qaSockets.push(this);}};});
      const data=Player.createDefaultData();data.ownedCatSkins.push('cat_kaitou');data.ownedDogSkins.push('dog_detective');data.equippedAppearance.catSkinId='cat_kaitou';data.equippedAppearance.dogSkinId='dog_detective';
      if(process.env.NYAN_OPPONENT_TEST==='yes'){
        if(index===0){data.ownedDogSkins=['default'];data.equippedAppearance.dogSkinId='default';}
        else{data.ownedCatSkins=['default'];data.equippedAppearance.catSkinId='default';}
      }
      await ctx.addInitScript(({data,keys})=>{if(!localStorage.getItem(keys.playerData)){localStorage.setItem(keys.playerData,JSON.stringify(data));localStorage.setItem(keys.playerId,data.playerId);}}, {data,keys:Player.STORAGE_KEYS});
      return ctx;
    }));
    const pages=await Promise.all(contexts.map(c=>c.newPage()));
    for(const page of pages){page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>window.__onlineQA);}
    const a=pages[0],b=pages[1];
    if(process.env.NYAN_OPPONENT_TEST==='yes'){
      await require('./browser-skin-cases.cjs')(pages,output);assert.deepEqual(errors,[]);return;
    }
    // Menu rendering must not await any online HTTP request.
    await a.route('**/api/**',route=>route.abort());
    await a.evaluate(()=>document.getElementById('onlineModeBtn').click());
    assert.ok(await a.locator('.matchmaking-panel').isVisible());
    await a.locator('#matchmakingCancel').click();await a.unroute('**/api/**');
    for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[768,1024],[844,390]]){
      await a.setViewportSize({width,height});await a.waitForTimeout(400);await a.locator('#onlineModeBtn').click();
      await a.locator('.matchmaking-panel').waitFor({state:'visible'});
      const box=await a.locator('.matchmaking-panel').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);
      assert.deepEqual(await a.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight]),[width,height]);
      await a.screenshot({path:path.join(output,`chooser-${width}x${height}.png`)});await a.locator('#matchmakingCancel').click();
    }
    await a.setViewportSize({width:320,height:568});
    await a.waitForTimeout(400);
    await a.locator('#onlineModeBtn').click();await a.locator('#randomMatchStart').click();
    await a.waitForFunction(()=>document.getElementById('matchmakingCancel').textContent==='キャンセル'&&!document.getElementById('matchmakingCancel').disabled);
    assert.equal(await a.locator('.matchmaking-panel').getByText('ホームへ戻る').count(),0);
    await a.locator('#matchmakingCancel').click();
    await a.locator('#randomMatchStart').waitFor({state:'visible'});
    assert.ok(await a.locator('.matchmaking-panel').isVisible());
    await a.locator('#matchmakingCancel').click();
    for(const page of pages){await page.waitForTimeout(400);await page.locator('#onlineModeBtn').click();await page.locator('#randomMatchStart').click();}
    await Promise.all(pages.map(p=>p.waitForFunction(()=>NyanOnline.getSession().role)));
    const randomHost=await a.evaluate(()=>NyanOnline.getSession().player==='host')?a:b;
    for(const page of pages){
      assert.ok(await page.locator('#onlineBackBtn').isHidden());
      assert.ok(await page.locator('#onlineRuleBackBtn').isHidden());
      assert.ok(await page.locator('.online-turn-clock').evaluate(e=>e.hidden));
    }
    if(process.env.NYAN_PREGAME_TEST==='yes'){
      // Real server clock: rule selection must survive the old 60s deadline.
      await a.waitForTimeout(65000);
      for(const p of pages){assert.equal(await p.evaluate(()=>__onlineQA.state().gameOver),false);assert.ok(await p.locator('.online-turn-clock').evaluate(e=>e.hidden));}
      await randomHost.evaluate(()=>__qaSockets.at(-1).close());
      for(const p of pages){
        await p.getByText('対戦相手との接続が終了しました。勝敗は記録されません。',{exact:true}).waitFor();
        assert.equal(await p.evaluate(()=>NyanPlayerData.getSnapshot().battleReceipts.length),0);
        assert.ok(await p.locator('.online-reconnect-overlay').evaluate(e=>e.hidden));
        await p.locator('#onlineBackBtn').click();await p.locator('#randomMatchStart').waitFor({state:'visible'});
      }
      assert.deepEqual(errors,[]);console.log('PASS Chrome preGame: no back/home/countdown, >60s no result, host disconnect cancels without daily, both return to chooser');return;
    }
    await randomHost.locator('#onlineNormalRuleBtn').click();
    if(process.env.NYAN_TIMEOUT_TEST==='yes'){
      for(const page of pages)await page.locator('.online-turn-clock:not([hidden])').waitFor();
      const texts=await Promise.all(pages.map(p=>p.locator('.online-turn-clock').textContent()));
      assert.ok(texts.every(t=>/残り (60|59|58)秒/.test(t)));
      await Promise.all(pages.map(p=>p.waitForFunction(()=>__onlineQA.state().gameOver,{},{timeout:70000})));
      for(const page of pages){
        await page.locator('#resultOverlay.show').waitFor({timeout:15000});
        assert.ok(await page.locator('.online-reconnect-overlay').evaluate(e=>e.hidden));
        await page.evaluate(()=>__qaSockets.at(-1).dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'connectionState',matchId:NyanOnline.getSession().matchId,status:'reconnecting',disconnects:{host:{deadline:Date.now()+15000}},serverTime:Date.now()})})));
        assert.ok(await page.locator('.online-reconnect-overlay').evaluate(e=>e.hidden));
        await page.waitForFunction(()=>NyanPlayerData.getSnapshot().battleReceipts.length===1);
        await page.screenshot({path:path.join(output,`timeout-result-${pages.indexOf(page)}.png`)});
        await page.locator('#resultHomeBtn').click();
        await page.locator('#resultOverlay').waitFor({state:'hidden'});
      }
      assert.deepEqual(errors,[]);console.log('PASS Chrome: both-side 60s countdown, timeout result, daily once, late notification cannot reopen overlay');return;
    }
    await Promise.all(pages.map(page=>page.waitForFunction(()=>NyanOnline.getSession().role&&__onlineQA.mode().startsWith('online')&&['dogSetup','onlineWaitingDogSetup'].includes(__onlineQA.state().phase))));
    const roles=await Promise.all(pages.map(page=>page.evaluate(()=>NyanOnline.getSession().role)));
    assert.notEqual(roles[0],roles[1]);const cat=roles[0]==='cat'?a:b,police=roles[0]==='police'?a:b;
    async function dismiss(page){await page.waitForTimeout(450);if(await page.locator('#privacyOverlay.show').count())await page.locator('#privacyBtn').click();}
    for(const page of pages)await dismiss(page);
    if(process.env.NYAN_ACTOR_TEST==='yes'){
      await require('./browser-actor-disconnect.cjs')({cat,police,dismiss});
      assert.deepEqual(errors,[]);console.log('PASS Chrome actor disconnect: setup, cat action, repeated waiting disconnect, selection/actions unchanged, handoff pause, own timer pause, recovery privacy, forfeit');return;
    }
    await police.evaluate(()=>{__onlineQA.node(14);__onlineQA.node(15);__onlineQA.node(21);});
    await cat.waitForFunction(()=>__onlineQA.state().phase==='catSetup');
    await dismiss(cat);
    await cat.evaluate(()=>__onlineQA.box(12));
    await police.waitForFunction(()=>__onlineQA.state().phase==='dogs');
    await dismiss(police);
    await police.evaluate(()=>__onlineQA.node(14));
    await cat.waitForFunction(()=>document.querySelector('#guideDisplay').textContent.includes('あか柴'));
    await police.evaluate(()=>__onlineQA.node(14));
    await cat.waitForFunction(()=>document.querySelector('#guideDisplay').textContent==='柴犬警察が捜査しています…');
    const snapshots=await Promise.all(pages.map(page=>page.evaluate(()=>NyanOnline.getAppearanceSnapshot())));
    if(process.env.NYAN_RECONNECT_TEST==='yes'){
      const originalId=await cat.evaluate(()=>NyanOnline.getSession().matchId);
      for(const delay of [4500,10000]){
        await cat.context().setOffline(true);await cat.evaluate(()=>__qaSockets.at(-1).close());
        await police.locator('.online-peer-reconnect-notice:not([hidden])').waitFor();
        await cat.waitForTimeout(delay);await cat.context().setOffline(false);
        await cat.waitForFunction(()=>!NyanOnline.isPaused()&&NyanOnline.getSession().connected);
        await cat.waitForTimeout(500);assert.equal(await cat.evaluate(()=>NyanOnline.getSession().matchId),originalId);
        assert.equal(await cat.evaluate(()=>__onlineQA.state().catPos),12);
        assert.deepEqual(await cat.evaluate(()=>NyanOnline.getAppearanceSnapshot()),snapshots[0]);
      }
      await police.reload();
      await police.waitForFunction(()=>__onlineQA.mode()==='onlinePolice'&&__onlineQA.state().phase==='dogs');
      assert.equal(await police.evaluate(()=>__onlineQA.state().catPos),null);
      for(const p of pages){await p.context().setOffline(true);await p.evaluate(()=>__qaSockets.at(-1).close());}
      await cat.waitForTimeout(3000);for(const p of pages)await p.context().setOffline(false);
      for(const p of pages)await p.waitForFunction(()=>!NyanOnline.isPaused()&&NyanOnline.getSession().connected);
    }
    assert.deepEqual(snapshots[0],snapshots[1]);
    assert.equal(snapshots[0].catPlayer.catSkinId,'cat_kaitou');assert.equal(snapshots[0].policePlayer.dogSkinId,'dog_detective');
    for(const page of pages)assert.equal(await page.locator('#board img[data-skin-id="dog_detective"]').count(),3);
    for(const page of pages)await page.evaluate(()=>{
      window.__seenEffects=[];
      new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{
        if(n.classList?.contains('skin-decorative-effect'))__seenEffects.push(n.src);
      }))).observe(document.body,{childList:true,subtree:true});
    });
    await cat.evaluate(async()=>{await NyanPlayerData.updateEquipment('catSkin','default');});
    assert.deepEqual(await cat.evaluate(()=>NyanOnline.getAppearanceSnapshot()),snapshots[0]);
    // Exercise a full police move turn, then a cat move, then a server-checked capture.
    await police.evaluate(()=>{__onlineQA.node(14);__onlineQA.node(20);__onlineQA.node(15);__onlineQA.node(9);__onlineQA.node(21);__onlineQA.node(22);});
    await police.locator('#finishDogTurnBtn').click();
    await cat.waitForFunction(()=>__onlineQA.state().phase==='cat'&&__onlineQA.state().turn===2);
    await dismiss(cat);
    await cat.evaluate(()=>{__onlineQA.state().catVisible=true;__onlineQA.render();});
    assert.equal(await cat.locator('#board img[data-skin-id="cat_kaitou"]').count(),1);
    await cat.waitForTimeout(1300);
    await cat.screenshot({path:path.join(output,'random-cat-turn.png')});
    await cat.evaluate(()=>__onlineQA.box(13));
    await police.waitForFunction(()=>__onlineQA.state().phase==='dogs'&&__onlineQA.state().turn===2);
    await police.evaluate(()=>{__onlineQA.node(20);__onlineQA.box(12);});
    await police.waitForFunction(()=>!__onlineQA.state().actionLocked);
    for(const page of pages)await page.waitForFunction(()=>__seenEffects.some(src=>src.endsWith(NyanSkinPresentation.effectSource(null,'dogSkin','found',{playMode:'onlineCat'}).replace(/^\.\//,''))));
    for(const page of pages)assert.equal(await page.evaluate(()=>__seenEffects.some(src=>src.endsWith(NyanSkinPresentation.effectSource(null,'catSkin','move',{playMode:'onlineCat'}).replace(/^\.\//,'')))),page===cat);
    await police.evaluate(()=>{__onlineQA.node(22);__onlineQA.box(13);});
    await Promise.all(pages.map(page=>page.waitForFunction(()=>__onlineQA.state().gameOver&&NyanPlayerData.getSnapshot().battleReceipts.some(id=>id.startsWith('rm_')))));
    for(const [i,page] of pages.entries()){
      assert.equal(await page.evaluate(()=>NyanPlayerData.getSnapshot().nyanCoins),0);
      await page.waitForTimeout(2200);await page.screenshot({path:path.join(output,`random-result-${i}.png`)});
    }
    const receipts=await Promise.all(pages.map(p=>p.evaluate(()=>NyanPlayerData.getSnapshot().battleReceipts.length)));
    for(const page of pages){await page.reload();await page.evaluate(()=>NyanPlayerData.updateEquipment('catSkin','cat_kaitou'));await page.locator('#onlineModeBtn').click();await page.locator('#roomMatchStart').click();}
    await a.locator('#createOnlineRoomBtn').click();
    await a.waitForFunction(()=>NyanOnline.getSession().roomCode);
    const code=await a.evaluate(()=>NyanOnline.getSession().roomCode);
    await b.locator('#onlineRoomCodeInput').fill(code);await b.locator('#joinOnlineRoomBtn').click();
    await Promise.all(pages.map(p=>p.waitForFunction(()=>NyanOnline.getSession().role)));
    await a.locator('#onlineStartGameBtn').click();await a.locator('#onlineNormalRuleBtn').click();
    await Promise.all(pages.map(p=>p.waitForFunction(()=>__onlineQA.mode().startsWith('online'))));
    const roomRoles=await Promise.all(pages.map(p=>p.evaluate(()=>NyanOnline.getSession().role)));
    const roomCat=roomRoles[0]==='cat'?a:b,roomPolice=roomRoles[0]==='police'?a:b;
    for(const p of pages)await dismiss(p);
    await roomPolice.evaluate(()=>{__onlineQA.node(14);__onlineQA.node(15);__onlineQA.node(21);});
    await roomCat.waitForFunction(()=>__onlineQA.state().phase==='catSetup');await dismiss(roomCat);
    await roomCat.evaluate(()=>__onlineQA.box(12));await roomPolice.waitForFunction(()=>__onlineQA.state().phase==='dogs');
    for(const page of pages)assert.equal(await page.locator('#board img[data-skin-id="dog_detective"]').count(),3);
    if(process.env.NYAN_RECONNECT_TEST==='yes'){
      await roomCat.context().setOffline(true);await roomCat.evaluate(()=>__qaSockets.at(-1).close());
      await roomPolice.waitForFunction(()=>__onlineQA.state().gameOver,{},{timeout:25000});
      await roomCat.context().setOffline(false);await roomCat.reload();
      await roomCat.waitForFunction(()=>__onlineQA.state().gameOver);
    }else await roomPolice.evaluate(()=>{__onlineQA.node(14);__onlineQA.box(12);});
    await Promise.all(pages.map(p=>p.waitForFunction(()=>__onlineQA.state().gameOver)));
    if(process.env.NYAN_RECONNECT_TEST==='yes')for(const p of pages){
      await p.locator('#resultOverlay.show').waitFor({timeout:15000});
      assert.ok(await p.locator('.online-reconnect-overlay').evaluate(e=>e.hidden));
      await p.screenshot({path:path.join(output,`disconnect-result-${pages.indexOf(p)}.png`)});
      await p.locator('#resultHomeBtn').click();await p.locator('#resultOverlay').waitFor({state:'hidden'});
    }
    assert.deepEqual(await Promise.all(pages.map(p=>p.evaluate(()=>NyanPlayerData.getSnapshot().battleReceipts.length))),receipts);
    // Pre-rollout Worker compatibility: no auth endpoint/CORS support.
    await a.route((process.env.NYAN_LOCAL_API||'http://127.0.0.1:8798')+'/api/online/profile',route=>route.fulfill({status:404,headers:{'access-control-allow-origin':'*'},body:'not found'}));
    await a.reload();await a.locator('#onlineModeBtn').click();await a.locator('#randomMatchStart').click();
    await a.getByText('ランダムマッチはサーバー更新後に利用できます。部屋対戦は引き続き利用できます。').waitFor();
    await a.locator('#roomMatchStart').click();await a.locator('#createOnlineRoomBtn').click();
    await a.waitForFunction(()=>/^\d{6}$/.test(NyanOnline.getSession().roomCode));
    assert.deepEqual(errors,[]);console.log('PASS: 6 responsive sizes, 2 Chrome clients, random and room matches to capture, same skins, both-side move/found effects, frozen snapshot, random-only daily receipt, zero coin grant; no JS exceptions');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
