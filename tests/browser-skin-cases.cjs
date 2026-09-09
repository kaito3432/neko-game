const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function(pages,output){
 const [a,b]=pages;
 const dismiss=async p=>{await p.waitForTimeout(400);if(await p.locator('#privacyOverlay.show').count())await p.locator('#privacyBtn').click();};
 for(const mode of ['room','random']){
  await b.evaluate(()=>NyanPlayerData.updateEquipment('dogSkin','dog_detective'));
  const seen=new Set();let nextDefault=false,done=false;
  for(let n=0;n<14&&!done;n++){
   console.log('skin case',mode,n,nextDefault?'next default':'asymmetric owners');
   if(nextDefault)await b.evaluate(()=>NyanPlayerData.updateEquipment('dogSkin','default'));
   const previous=await Promise.all(pages.map(p=>p.evaluate(()=>NyanOnline.getSession().matchId)));
   for(const p of pages){await p.waitForTimeout(400);await p.locator('#onlineModeBtn').click();await p.locator(mode==='room'?'#roomMatchStart':'#randomMatchStart').click();}
   if(mode==='room'){
    await a.locator('#createOnlineRoomBtn').click();await a.waitForFunction(()=>NyanOnline.getSession().roomCode);
    const code=await a.evaluate(()=>NyanOnline.getSession().roomCode);await b.locator('#onlineRoomCodeInput').fill(code);await b.locator('#joinOnlineRoomBtn').click();
   }
   try{await Promise.all(pages.map((p,i)=>p.waitForFunction(old=>NyanOnline.getSession().role&&NyanOnline.getSession().matchId!==old,previous[i])));}
   catch(e){console.log(await Promise.all(pages.map(p=>p.evaluate(()=>({room:NyanOnline.getSession().roomCode,role:NyanOnline.getSession().role,status:document.getElementById('onlineStatus').textContent})))));throw e;}
   const sessions=await Promise.all(pages.map(p=>p.evaluate(()=>NyanOnline.getSession())));
   const host=sessions[0].player==='host'?a:b,cat=sessions[0].role==='cat'?a:b,police=cat===a?b:a;
   seen.add(sessions[0].role);
   if(mode==='room')await host.locator('#onlineStartGameBtn').click();
   await host.locator('#onlineNormalRuleBtn').click();
   for(const p of pages)await p.waitForFunction(()=>__onlineQA.mode().startsWith('online'));
   for(const p of pages)await dismiss(p);
   const catId=cat===a?'cat_kaitou':'default',dogId=police===b&&!nextDefault?'dog_detective':'default';
   for(const p of pages){
    assert.equal(await p.evaluate(()=>NyanOnline.resolveAppearance('catSkin').id),catId);
    assert.equal(await p.evaluate(()=>NyanOnline.resolveAppearance('dogSkin').id),dogId);
    const snapshot=await p.evaluate(()=>NyanOnline.getAppearanceSnapshot());
    assert.equal(snapshot.catPlayer.playerId,sessions[cat===a?0:1].playerId);
    assert.equal(snapshot.policePlayer.playerId,sessions[police===a?0:1].playerId);
   }
   await police.evaluate(()=>{__onlineQA.node(14);__onlineQA.node(15);__onlineQA.node(21);});
   await cat.waitForFunction(()=>__onlineQA.state().phase==='catSetup');await dismiss(cat);await cat.evaluate(()=>__onlineQA.box(12));
   await police.waitForFunction(()=>__onlineQA.state().phase==='dogs');await dismiss(police);
   for(const p of pages){
    assert.equal(await p.locator(`#board img[data-skin-id="${dogId}"]`).count(),3);
    assert.equal(await p.locator(`#dogRow img[data-skin-id="${dogId}"]`).count(),3);
    await p.waitForFunction(()=>[...document.querySelectorAll('#dogRow img')].every(i=>i.complete&&i.naturalWidth>0));
   }
   assert.equal(await a.evaluate(()=>NyanPlayerData.getSnapshot().ownedDogSkins.includes('dog_detective')),false);
   if(dogId==='dog_detective')await a.screenshot({path:path.join(output,`${mode}-unowned-viewer-detective.png`)});
   await police.evaluate(()=>{__onlineQA.node(14);__onlineQA.box(12);});
   for(const p of pages){
    await p.locator('#resultOverlay.show').waitFor({timeout:15000});
    if(p===police&&dogId==='dog_detective')assert.match(await p.locator('#victoryCutinImage').getAttribute('src'),/dog_detective_result_win\.png$/);
    if(p===cat&&catId==='cat_kaitou')assert.match(await p.locator('#victoryCutinImage').getAttribute('src'),/cat_kaitou_result_lose\.png$/);
    await p.locator('#resultHomeBtn').click();
   }
   if(nextDefault)done=true;
   else if(seen.size===2&&dogId==='dog_detective')nextDefault=true;
  }
  assert.equal(seen.size,2,'both random role assignments exercised');assert.ok(done,'custom → next match default');
 }
 console.log('PASS Chrome asymmetric owners: room/random, both role assignments, unowned viewer, three pieces/cards, results, same-client next default');
};
