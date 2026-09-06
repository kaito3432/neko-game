/* Run with NODE_PATH pointing to a Playwright installation. Uses an isolated browser profile. */
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const path=require("node:path");
const http=require("node:http");
const {execFileSync}=require("node:child_process");
const root=path.resolve(__dirname,"..");
const output=path.join(root,"artifacts/daily-20260906");
const errors=[];
const checks=[];
const mime={".js":"text/javascript",".css":"text/css",".html":"text/html",".png":"image/png",".jpg":"image/jpeg",".wav":"audio/wav",".webmanifest":"application/manifest+json"};
const server=http.createServer(async(req,res)=>{
  try{
    let name=decodeURIComponent(new URL(req.url,"http://localhost").pathname).slice(1);
    const baseline=name.startsWith("baseline/");
    if(baseline) name=name.slice(9);
    if(!name || name.endsWith("/")) name+="index.html";
    if(name.includes("..")) throw new Error("invalid path");
    let body=baseline && ["index.html","style.css","player-data.js","collection.js","collection-catalog.js","skin-presentation.js","game.js"].includes(name)
      ? execFileSync("git",["show",`HEAD:${name}`],{cwd:root}) : await fs.readFile(path.join(root,name));
    // Test-only integration access; never written into shipped game code.
    if(name==="game.js" && !baseline) body=Buffer.from(body.toString().replace(/initGame\(true\);\s*\}\)\(\);\s*$/,`initGame(true);
      window.__dailyGameTest={end:endGame,state:()=>game,showResult:showResultAfterCutin,hide:()=>resultOverlay.classList.remove('show')};
    })();`));
    res.writeHead(200,{"Content-Type":mime[path.extname(name)] || "application/octet-stream","Cache-Control":"no-store"});res.end(body);
  }catch(_){res.writeHead(404);res.end();}
});
(async()=>{
  await fs.mkdir(output,{recursive:true});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
  try{
    const context=await browser.newContext({viewport:{width:320,height:568},serviceWorkers:"block"});
    const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
    await page.goto(url);await page.waitForFunction(()=>window.NyanPlayerData?.getSnapshot()?.dailyMissionProgress.date);
    const geometry=()=>page.evaluate(()=>Object.fromEntries([".vu3-logo",".vu3-hero-stage",".vu3-sub",".vu3-modes",".vu3-bottom"].map(s=>{
      const r=document.querySelector(s).getBoundingClientRect();return [s,{x:r.x,y:r.y,width:r.width,height:r.height}];
    })));
    for(const [width,height] of [[320,568],[375,812],[390,844],[430,932]]){
      await page.setViewportSize({width,height});await page.goto(`${url}/baseline/`);await page.waitForTimeout(180);
      const before=await geometry();
      await page.goto(url);await page.waitForTimeout(180);
      const after=await geometry();
      for(const key of Object.keys(before)) for(const axis of ["x","y","width","height"]) assert.ok(Math.abs(before[key][axis]-after[key][axis])<1,`${width}: ${key} ${axis} moved`);
      const size=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}));
      assert.deepEqual(size,{w:width,h:height});
      await page.screenshot({path:path.join(output,`home-${width}.png`)});
      await page.locator("#dailyOpenBtn").click();
      assert.equal(await page.locator(".daily-mission").count(),3);
      await page.screenshot({path:path.join(output,`daily-${width}.png`)});
      await page.locator("#dailyCloseBtn").click();
      checks.push(`${width}x${height}: home geometry unchanged, no page scroll, daily 3 missions`);
    }
    await page.setViewportSize({width:320,height:568});
    const requested=[];page.on("request",r=>requested.push(r.url()));
    await page.locator("#collectionOpenBtn").click();
    for(const [section,name] of [["cat","怪盗にゃん"],["police","探偵しば"]]){
      await page.locator(`[data-collection-section="${section}"]`).click();
      await page.getByRole("button",{name:`${name}の詳細を見る`}).click();
      const srcs=await page.locator("#collectionOverlay img").evaluateAll(images=>images.map(i=>i.getAttribute("src")).filter(Boolean));
      assert.ok(srcs.filter(src=>src.includes("mystery01")).every(src=>src.includes("_locked.png")));
      assert.match(await page.locator("[data-detail-profile-image]").getAttribute("src"),/_profile_locked\.png$/);
      assert.equal(await page.locator("[data-unlock-progress]").textContent(),"0 / 10");
      await page.screenshot({path:path.join(output,`locked-${section}.png`)});
      // A failed locked-image load must never reveal the owned fallback.
      await page.locator("[data-detail-collection-image]").evaluate(img=>img.dispatchEvent(new Event("error")));
      assert.equal(await page.locator("[data-detail-collection-image]").getAttribute("src"),null);
      await page.locator("#collectionDetailBackBtn").click();
    }
    assert.ok(requested.filter(src=>src.includes("mystery01")).every(src=>src.includes("_locked.png")));
    checks.push("unowned list/detail/profile: only supplied locked URLs; failed-load fallback safe");
    await page.locator("#collectionBackBtn").click();
    // Start a real CPU game through its UI, then confirm its outcome via the test harness.
    async function cpu(side){
      await page.locator("#cpuModeBtn").click();
      await page.locator(side==="cat" ? "#playCatSideBtn" : "#playPoliceSideBtn").click();
      await page.locator("#cpuHardBtn").click();
      await page.locator("#privacyBtn").click();
      assert.equal(await page.locator("#board .box").count(),25);
      assert.equal(await page.locator("#board .node").count(),36);
    }
    await cpu("cat");
    assert.equal(await page.evaluate(()=>NyanPlayerData.getSnapshot().battleReceipts.length),0);
    await page.evaluate(()=>{__dailyGameTest.state().catPos=12;__dailyGameTest.end("cat","テスト：正常な勝敗確定");});
    await page.waitForFunction(()=>NyanPlayerData.getSnapshot().battleReceipts.length===1);
    assert.equal(await page.evaluate(()=>document.getElementById("resultOverlay").classList.contains("show")),false,"saved before result/cut-in");
    await page.evaluate(()=>__dailyGameTest.end("cat","重複通知"));
    assert.equal(await page.evaluate(()=>NyanPlayerData.getSnapshot().skinUnlockProgress.cat_kaitou),1);
    await page.locator("#victoryCutin").waitFor({state:"visible"});await page.locator("#victoryCutin").click();
    await page.locator("#dailyResultNotice").waitFor({state:"visible"});
    await page.locator("#dailyResultNotice").click();
    await page.getByRole("button",{name:"10 にゃんコインを受け取る",exact:true}).click();
    await page.waitForFunction(()=>NyanPlayerData.getSnapshot().nyanCoins===10);
    await page.screenshot({path:path.join(output,"daily-claimed.png")});
    await page.locator("#dailyCloseBtn").click();await page.locator("#resultHomeBtn").click();
    await cpu("police");
    await page.evaluate(()=>{__dailyGameTest.state().catPos=12;__dailyGameTest.end("dogs","テスト：正常な勝敗確定");});
    await page.waitForFunction(()=>NyanPlayerData.getSnapshot().skinUnlockProgress.dog_detective===1);
    checks.push("CPU cat/police outcome hooks: progress persisted before result, duplicate ignored, reward claimed by UI");
    await page.reload();await page.waitForFunction(()=>NyanPlayerData.getSnapshot()?.nyanCoins===10);
    // Verify both standalone skin effects are nonblocking and reduced-motion aware.
    for(const [category,id] of [["catSkin","cat_kaitou"],["dogSkin","dog_detective"]]){
      await page.evaluate(async({category,id})=>{
        const data=await NyanPlayerData.load();const field=category==="catSkin" ? "ownedCatSkins" : "ownedDogSkins";
        await NyanPlayerData.save({...data,[field]:[...data[field],id]});await NyanPlayerData.updateEquipment(category,id);
        const src=NyanSkinPresentation.effectSource(NyanPlayerData.getSnapshot(),category,"found");
        NyanSkinPresentation.showEffectAtElement(document.querySelector("#collectionOpenBtn"),src,"found-cat");
      },{category,id});
      await page.locator(".skin-decorative-effect.show").waitFor({state:"attached"});
      const effect=page.locator(".skin-decorative-effect");
      const animation=await effect.evaluate(el=>({duration:getComputedStyle(el).animationDuration,pointer:getComputedStyle(el).pointerEvents,width:el.getBoundingClientRect().width}));
      assert.equal(animation.duration,"0.7s");assert.equal(animation.pointer,"none");
      await page.screenshot({path:path.join(output,`effect-${id}.png`)});
      await effect.waitFor({state:"detached"});
    }
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.evaluate(()=>NyanSkinPresentation.showEffectAtElement(document.querySelector("#collectionOpenBtn"),NyanSkinPresentation.effectSource(NyanPlayerData.getSnapshot(),"catSkin","move")));
    await page.locator(".skin-decorative-effect.show").waitFor({state:"attached"});
    assert.equal(await page.locator(".skin-decorative-effect").evaluate(el=>getComputedStyle(el).animationName),"none");
    checks.push("skin effects 700ms, pointer-events:none, reduced-motion static; saved data restored after reload");
    // Entry smoke checks, without making a room or contacting another player.
    await page.locator("#localModeBtn").click();
    assert.ok(await page.locator("#localRuleOverlay").isVisible());
    await page.reload();await page.locator("#onlineModeBtn").click();
    await page.locator("#roomMatchStart").click();
    assert.ok(await page.locator("#onlineOverlay").isVisible());
    checks.push("local match selection and online room entry open");
    assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(output,"checks.json"),JSON.stringify({checks,errors},null,2));
    console.log(JSON.stringify({checks,errors},null,2));
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
