const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async(pages,output)=>{
  const [a,b]=pages;
  for(const p of pages){
    await p.locator('#onlineModeBtn').click();
    await p.locator('.ranked-profile-card:not([hidden])').waitFor();
    assert.match(await p.locator('[data-rank-icon]').getAttribute('src'),/cat_play_normal.png$/);
  }
  await a.locator('[data-rank-frame]').selectOption('rank_bronze');
  await a.waitForFunction(()=>NyanRankedUI.getProfile().equippedProfileFrameId==='rank_bronze');
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
  for(const [p,id,frameId] of [[a,'dog_detective','default'],[b,'cat_kaitou','rank_bronze']]){
    const badge=p.locator('.online-opponent-profile:visible').first();await badge.waitFor();
    assert.match(await badge.locator('img').getAttribute('src'),new RegExp(id+'_profile.png$'));
    await badge.locator('img').evaluate(img=>new Promise((resolve,reject)=>{if(img.complete&&img.naturalWidth)return resolve();img.onload=resolve;img.onerror=reject;}));
    assert.equal(await p.evaluate(id=>{
      const d=NyanPlayerData.getSnapshot();return [...d.ownedCatSkins,...d.ownedDogSkins].includes(id);
    },id),false);
    assert.equal(await badge.locator('.online-profile-frame').getAttribute('data-frame-id'),frameId);
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
  await b.evaluate(()=>{
    const s=NyanOnline.getSession(),other=s.player==='host'?'guest':'host',peer='server-validated-gold';
    const participants={[s.player]:s.playerId,[other]:peer};
    const playerProfiles={[other]:{playerId:peer,profileCharacter:{category:'catSkin',itemId:'default'},equippedProfileFrameId:'rank_gold'}};
    dispatchEvent(new CustomEvent('nyan-online-player-profiles',{detail:{...s,participants,playerProfiles}}));
  });
  const gold=b.locator('.online-opponent-profile:visible').first();
  assert.equal(await gold.locator('.online-profile-frame').getAttribute('data-frame-id'),'rank_gold');
  assert.equal((await b.evaluate(()=>NyanRankedUI.getProfile().ownedProfileFrames)).includes('rank_gold'),false);
  await b.evaluate(()=>{
    const s=NyanOnline.getSession(),other=s.player==='host'?'guest':'host',peer='next-default-player';
    dispatchEvent(new CustomEvent('nyan-online-player-profiles',{detail:{...s,matchId:'rm_next',participants:{[s.player]:s.playerId,[other]:peer},
      playerProfiles:{[other]:{playerId:peer,profileCharacter:{category:'catSkin',itemId:'default'},equippedProfileFrameId:'default'}}}}));
  });
  assert.equal(await gold.locator('.online-profile-frame').getAttribute('data-frame-id'),'default');
  await a.evaluate(()=>NyanOnline.reset());
  assert.equal(await a.locator('.online-opponent-profile:not([hidden])').count(),0);
  await b.evaluate(()=>NyanOnline.reset());
  assert.equal(await b.locator('.online-profile-frame[data-frame-id="rank_gold"]').count(),0);
  console.log('PASS Chrome two clients: default/cat/dog self icons, authenticated server setting, opponent unowned viewer, ability close hidden + guarded, broken image fallback');
};
