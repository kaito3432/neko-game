const test=require('node:test'),assert=require('node:assert/strict');
const Visual=require('../online-appearance.js');
function fixture(catId='A',catSkin='default'){
  const dogId=catId==='A'?'B':'A';
  return {type:'role',player:'host',role:catId==='A'?'cat':'police',playerId:'A',matchId:'match-new',
    participants:{host:'A',guest:'B'},appearanceSnapshot:{catPlayer:{playerId:catId,catSkinId:catSkin},policePlayer:{playerId:dogId,dogSkinId:'default'}}};
}
const ctx={myPlayerId:'A',player:'host',profile:{playerId:'A',ownedCatSkins:['default'],ownedDogSkins:['default'],equippedAppearance:{catSkinId:'default',dogSkinId:'default'}}};
test('未所持Aが猫なら相手が怪盗所持でも自分はdefault',()=>{
  const state=Visual.accept(fixture(),ctx);assert.equal(Visual.resolve(state,'catSkin').id,'default');
});
test('host警察Aは未所持でもguest猫Bの怪盗を表示',()=>{
  const state=Visual.accept(fixture('B','cat_kaitou'),ctx);assert.equal(Visual.resolve(state,'catSkin').id,'cat_kaitou');assert.equal(Visual.resolve(state,'dogSkin').id,'default');
});
test('自分の検証済み装備と異なるsnapshotはdefaultへ',()=>{
  assert.equal(Visual.resolve(Visual.accept(fixture('A','cat_kaitou'),ctx),'catSkin').id,'default');
});
test('playerId/seat不一致snapshotは受け入れない',()=>{
  const p=fixture();p.appearanceSnapshot.catPlayer.playerId='B';assert.equal(Visual.accept(p,ctx),null);
  assert.equal(Visual.accept({...fixture(),playerId:'B'},ctx),null);
  assert.equal(Visual.accept({...fixture(),participants:{host:'A',guest:'A'}},ctx),null);
});
test('前試合怪盗→次試合default、未取得はpending',()=>{
  assert.equal(Visual.resolve(Visual.accept(fixture('B','cat_kaitou'),ctx),'catSkin').id,'cat_kaitou');
  assert.equal(Visual.resolve(null,'catSkin').status,'pending');
  assert.equal(Visual.resolve(Visual.accept(fixture('B','default'),ctx),'catSkin').id,'default');
});
test('snapshotは深いコピー、元の書換で進行中の見た目は変わらない',()=>{
  const p=fixture('B','cat_kaitou'),state=Visual.accept(p,ctx);p.appearanceSnapshot.catPlayer.catSkinId='default';assert.equal(Visual.resolve(state,'catSkin').id,'cat_kaitou');
});
test('自分が探偵未所持でも相手policeの探偵しばを表示',()=>{
  const p=fixture();p.appearanceSnapshot.policePlayer.dogSkinId='dog_detective';
  assert.equal(Visual.resolve(Visual.accept(p,ctx),'dogSkin').id,'dog_detective');
});
test('自分だけ探偵所持でも相手のdefaultへ流用しない',()=>{
  const mine={...ctx,profile:{...ctx.profile,ownedDogSkins:['default','dog_detective'],equippedAppearance:{catSkinId:'default',dogSkinId:'dog_detective'}}};
  assert.equal(Visual.resolve(Visual.accept(fixture(),mine),'dogSkin').id,'default');
});
test('host警察の探偵しばもplayerIdを照合して表示',()=>{
  const p=fixture('B');p.appearanceSnapshot.policePlayer.dogSkinId='dog_detective';
  const mine={...ctx,profile:{...ctx.profile,ownedDogSkins:['default','dog_detective'],equippedAppearance:{catSkinId:'default',dogSkinId:'dog_detective'}}};
  assert.equal(Visual.resolve(Visual.accept(p,mine),'dogSkin').id,'dog_detective');
});
test('ルール変更はhostのみ、ready後は固定、選択通知に秘密フィールドを混ぜない',async()=>{
  const {sessionEvent}=await import('../server/session-events.mjs');
  const room={roles:{host:'police',guest:'cat'},requiresRuleSelection:true};
  assert.equal(sessionEvent(room,'guest',{type:'ruleSelect',rule:'normal'}),false);
  assert.equal(sessionEvent(room,'host',{type:'ready'}),false);
  assert.deepEqual(sessionEvent(room,'host',{type:'ruleSelect',rule:'normal',catPos:9}),{type:'ruleSelect',rule:'normal'});
  sessionEvent(room,'host',{type:'ready'});assert.equal(sessionEvent(room,'host',{type:'ruleSelect',rule:'ability'}),false);
  room.publicPhase='dogs';assert.deepEqual(sessionEvent(room,'host',{type:'policeSelection',dogIndex:1,target:9,catPos:12}),{type:'policeSelection',dogIndex:1});
  assert.equal(sessionEvent(room,'guest',{type:'policeSelection',dogIndex:1}),false);
  room.publicPhase='catSetup';assert.equal(sessionEvent(room,'host',{type:'policeSelection',dogIndex:1}),false);
});
test('特殊ルールも既存スキル名とengineで検証する',async()=>{
  const {acceptRandomAction:accept}=await import('../server/random-game-validation.mjs');
  const r={rule:'ability',abilities:{cat:'sneak',police:'doubleSearch'}};
  assert.ok(accept(r,'police',{type:'dogSetup',dogs:[14,15,21]}));assert.ok(accept(r,'cat',{type:'catSetup',catPos:20}));
  assert.ok(accept(r,'police',{type:'doubleSearch',targets:[12,13]}));assert.equal(accept(r,'police',{type:'doubleSearch',targets:[12,13]}),false);
});
