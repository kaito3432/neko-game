const assert=require('node:assert/strict');
module.exports=async({cat,police,dismiss})=>{
 const pages=[cat,police];
 for(const p of pages)await p.evaluate(()=>{
   window.__clockEvents=[];
   window.addEventListener('nyan-online-clock',e=>__clockEvents.push(e.detail));
 });
 const frame=p=>p.evaluate(()=>__clockEvents.at(-1));
 const disconnect=async p=>{await p.context().setOffline(true);await p.evaluate(()=>__qaSockets.at(-1).close());};
 const resume=async p=>{await p.context().setOffline(false);await p.waitForFunction(()=>NyanOnline.getSession().connected&&!NyanOnline.isPaused());};
 const free=async p=>{await p.locator('.online-peer-reconnect-notice:not([hidden])').waitFor();assert.equal(await p.evaluate(()=>NyanOnline.isPaused()),false);assert.equal(await p.locator('.online-reconnect-overlay').evaluate(e=>e.hidden),true);};
 await police.waitForFunction(()=>__clockEvents.length);
 const snapshot=await cat.evaluate(()=>NyanOnline.getAppearanceSnapshot());
 // Waiting cat cannot block police placement; the next cat phase waits instead.
 await disconnect(cat);await free(police);
 await police.evaluate(()=>{__onlineQA.node(14);__onlineQA.node(15);__onlineQA.node(21);});
 await police.waitForFunction(()=>NyanOnline.isPaused());
 assert.equal((await frame(police)).turnClock.pausedRemainingMs,60000);
 await resume(cat);await cat.waitForFunction(()=>__onlineQA.state().phase==='catSetup');await dismiss(cat);
 // Waiting police cannot block the cat's hidden placement.
 await disconnect(police);await free(cat);await cat.evaluate(()=>__onlineQA.box(12));
 await cat.waitForFunction(()=>NyanOnline.isPaused());
 await resume(police);await police.waitForFunction(()=>__onlineQA.state().phase==='dogs');
 assert.equal(await police.evaluate(()=>__onlineQA.state().catPos),null);
 await police.waitForFunction(()=>__clockEvents.at(-1)?.turnClock.phase.startsWith('dogs'));
 await dismiss(police);await police.evaluate(()=>__onlineQA.node(14));
 const deadline=Object.values((await frame(police)).turnClock.deadlines)[0];
 for(const delay of [10000,1000]){
   await disconnect(cat);await free(police);await police.waitForTimeout(delay);
   assert.equal(await police.evaluate(()=>__onlineQA.state().selectedDog),0);
   assert.equal(Object.values((await frame(police)).turnClock.deadlines)[0],deadline);
   await resume(cat);await police.waitForFunction(()=>__clockEvents.at(-1)&&!Object.keys(__clockEvents.at(-1).disconnects).length);
   assert.equal(await police.evaluate(()=>__onlineQA.state().selectedDog),0);
   assert.equal(Object.values((await frame(police)).turnClock.deadlines)[0],deadline);
 }
 // The active police can execute a legal move while the cat is absent.
 await disconnect(cat);await free(police);await police.evaluate(()=>__onlineQA.node(20));
 await resume(cat);await cat.waitForFunction(()=>__onlineQA.state().dogs[0]===20);
 assert.equal(await cat.evaluate(()=>__onlineQA.state().dogAction[0]),true);
 // Active player's remaining time is frozen, not consumed during a 10s outage.
 await disconnect(police);await cat.waitForFunction(()=>__clockEvents.at(-1)?.turnClock.pausedRemainingMs!==undefined);
 const remaining=(await frame(cat)).turnClock.pausedRemainingMs;
 await cat.waitForTimeout(10000);assert.equal((await frame(cat)).turnClock.pausedRemainingMs,remaining);
 await resume(police);await cat.waitForFunction(()=>__clockEvents.at(-1)?.turnClock.pausedRemainingMs===undefined);
 const after=await frame(cat);assert.ok(Math.abs(Object.values(after.turnClock.deadlines)[0]-after.serverTime-remaining)<1500);
 assert.equal(await police.evaluate(()=>__onlineQA.state().dogs[0]),20);
 assert.equal(await police.evaluate(()=>__onlineQA.state().dogAction[0]),true);
 assert.equal(await police.evaluate(()=>__onlineQA.state().catPos),null);
 assert.deepEqual(await cat.evaluate(()=>NyanOnline.getAppearanceSnapshot()),snapshot);
 // Regular cat movement also continues with the waiting police offline.
 await police.evaluate(()=>{__onlineQA.node(15);__onlineQA.node(9);__onlineQA.node(21);__onlineQA.node(22);});
 await police.locator('#finishDogTurnBtn').click();
 await cat.waitForFunction(()=>__onlineQA.state().phase==='cat');await dismiss(cat);
 await cat.locator('#catViewBtn').click();
 await disconnect(police);await free(cat);await cat.evaluate(()=>__onlineQA.box(13));
 await cat.waitForFunction(()=>NyanOnline.isPaused());await resume(police);
 await police.waitForFunction(()=>__onlineQA.state().phase==='dogs'&&__onlineQA.state().turn===2);
 assert.equal(await police.evaluate(()=>__onlineQA.state().catPos),null);
 // A missing waiting participant still loses at its original 15s deadline.
 await disconnect(cat);await free(police);
 await police.waitForFunction(()=>__onlineQA.state().gameOver,null,{timeout:22000});
 await police.locator('#resultOverlay.show').waitFor();
 await cat.context().setOffline(false);
};
