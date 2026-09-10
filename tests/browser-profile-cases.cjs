const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async(pages,output)=>{
  const [a,b]=pages;
  for(const p of pages){
    await p.locator('#onlineModeBtn').click();
    await p.locator('.ranked-profile-card:not([hidden])').waitFor();
    assert.match(await p.locator('[data-rank-icon]').getAttribute('src'),/cat_play_normal.png$/);
  }
  for(const [p,category,itemId] of [[a,'catSkin','cat_kaitou'],[b,'dogSkin','dog_detective']]){
    await p.evaluate(async({category,itemId})=>{
      await NyanPlayerData.updateProfileCharacter(category,itemId);
      await NyanRankedUI.refresh();
    },{category,itemId});
    await p.waitForFunction(id=>document.querySelector('[data-rank-icon]').src.includes(id),itemId);
    const server=await p.evaluate(async()=> (await NyanOnlineIdentity.request(NyanOnline.API_BASE,'profile',null,'GET')).profile.profileCharacter);
    assert.deepEqual(server,{category,itemId});
    await p.locator('#randomMatchStart').click();
  }
  await Promise.all(pages.map(p=>p.waitForFunction(()=>NyanOnline.getSession().role)));
  const host=await a.evaluate(()=>NyanOnline.getSession().player==='host')?a:b;
  for(const [p,id] of [[a,'dog_detective'],[b,'cat_kaitou']]){
    const badge=p.locator('.online-opponent-profile:visible').first();await badge.waitFor();
    assert.match(await badge.locator('img').getAttribute('src'),new RegExp(id+'_profile.png$'));
    await badge.locator('img').evaluate(img=>new Promise((resolve,reject)=>{if(img.complete&&img.naturalWidth)return resolve();img.onload=resolve;img.onerror=reject;}));
    assert.equal(await p.evaluate(id=>{
      const d=NyanPlayerData.getSnapshot();return [...d.ownedCatSkins,...d.ownedDogSkins].includes(id);
    },id),false);
    await p.screenshot({path:path.join(output,`profile-opponent-${id}.png`)});
  }
  await host.locator('#onlineAbilityRuleBtn').click();
  for(const p of pages){
    await p.locator('#catAbilityOverlay.show,#policeAbilityOverlay.show').waitFor();
    const close=p.locator('#catAbilityOverlay.show [data-home-close],#policeAbilityOverlay.show [data-home-close]');
    assert.ok(await close.isHidden());
    await close.evaluate(el=>el.click()); // hidden control cannot escape even via scripted click.
    assert.ok(await p.locator('#catAbilityOverlay.show,#policeAbilityOverlay.show').isVisible());
    await p.screenshot({path:path.join(output,`profile-ability-${p===a?'a':'b'}.png`)});
  }
  // Image failure is handled in the actual DOM, not just by a string resolver.
  const first=pages[0];
  const firstRole=await first.evaluate(()=>NyanOnline.getSession().role);
  await first.locator(firstRole==='cat'?'#selectSneakBtn':'#selectHowlBtn').click();
  await first.locator(firstRole==='cat'?'#confirmCatAbilityBtn':'#confirmPoliceAbilityBtn').click();
  await first.waitForTimeout(400);
  assert.ok(await first.locator('#catAbilityOverlay.show [data-home-close],#policeAbilityOverlay.show [data-home-close]').isHidden());
  const second=pages[1],secondRole=await second.evaluate(()=>NyanOnline.getSession().role);
  await second.locator(secondRole==='cat'?'#selectSneakBtn':'#selectHowlBtn').click();
  await second.locator(secondRole==='cat'?'#confirmCatAbilityBtn':'#confirmPoliceAbilityBtn').click();
  for(const p of pages){
    await p.locator('#abilityRevealOverlay.show').waitFor();
    assert.ok(await p.locator('#abilityRevealOverlay [data-home-close]').isHidden());
  }
  await a.locator('[data-rank-icon]').evaluate(img=>{img.src='/missing-profile.png';});
  await a.waitForFunction(()=>document.querySelector('[data-rank-icon]').src.endsWith('cat_play_normal.png'));
  await a.evaluate(()=>NyanOnline.reset());
  assert.equal(await a.locator('.online-opponent-profile:not([hidden])').count(),0);
  console.log('PASS Chrome two clients: default/cat/dog self icons, authenticated server setting, opponent unowned viewer, ability close hidden + guarded, broken image fallback');
};
