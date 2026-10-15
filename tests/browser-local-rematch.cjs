// Local-only smoke: no production requests, real purchases or persisted user data.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer(async(req,res)=>{
  try{
    const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
    if(name.includes('..'))throw Error('invalid path');
    let data=await fs.readFile(path.join(root,name));
    if(name==='game.js')data=Buffer.from(data.toString().replace(/initGame\(true\);\s*\}\)\(\);\s*$/,
      'initGame(true);window.__rematchQA={startLocalMode,selectPoliceAbility,selectCatAbility,startLocalAfterAbilitySelect,endGame,render,state:()=>game};})();'));
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(name)]||'application/octet-stream');
    res.end(data);
  }catch{res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try{
    for(const [width,height] of [[834,1194],[1024,1366],[390,844]]){
      const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block'}),errors=[];
      const origin=`http://127.0.0.1:${server.address().port}`;
      await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(origin);
      await page.evaluate(()=>{
        // Isolated in-memory entitlement stub, never written to storage or shipped.
        window.NyanMonetization={...window.NyanMonetization,isSkillModeUnlocked:()=>true,canEquipSkill:()=>true};
        __rematchQA.startLocalMode();
      });
      for(let round=0;round<3;round++){
        await page.evaluate(round=>{
          __rematchQA.selectPoliceAbility(['howl','doubleSearch','dash'][round]);
          __rematchQA.selectCatAbility(round%2?'fakePaw':'sneak');
        },round);
        await page.waitForTimeout(1250);
        for(const selector of ['.cat-side','.police-side','.ability-vs-title','.ability-vs-start-btn'])
          assert.equal(await page.locator('#abilityRevealOverlay '+selector).evaluate(el=>getComputedStyle(el).opacity),'1');
        // Animation failure must not hide the content or the start button.
        await page.locator('#abilityRevealOverlay').evaluate(el=>el.classList.remove('vs-animate'));
        assert.equal(await page.locator('#abilityStartBtn').evaluate(el=>getComputedStyle(el).opacity),'1');
        await page.evaluate(()=>document.querySelector('#abilityStartBtn').click());
        assert.equal(await page.locator('#abilityRevealOverlay.show').count(),0);
        await page.evaluate(()=>{
          const game=__rematchQA.state();game.turn=11;game.phase='cat';__rematchQA.render();
        });
        for(const label of ['9 / 13','10 / 13','11 / 13','13 / 13']){
          const fits=await page.locator('#turnDisplay').evaluate((el,label)=>{el.textContent=label;return el.scrollWidth<=el.clientWidth;},label);
          assert.ok(fits,`${width}: ${label} clipped`);
        }
        await page.evaluate(()=>__rematchQA.endGame('cat','local smoke'));
        await page.waitForTimeout(3200);
        await page.evaluate(()=>document.querySelector('#againBtn').click());
        await page.waitForTimeout(400);
        assert.equal(await page.locator('#policeAbilityOverlay.show').count(),1);
      }
      assert.deepEqual(errors,[]);
      console.log(`PASS ${width}x${height}: 3 rounds, VS fallback, start, rematch, two-digit turns`);
      await page.close();
    }
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
