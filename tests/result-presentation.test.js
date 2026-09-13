const test=require('node:test'),assert=require('node:assert/strict');
const {shouldCelebrate}=require('../result-presentation.js');
const session=role=>({playerId:'verified-player',role});
test('ローカル勝者演出は維持し、オンラインは正式結果の本人役割だけ',()=>{
  assert.equal(shouldCelebrate({playMode:'cpu',winner:'cat'}),true);
  for(const [winner,winnerRole] of [['cat','cat'],['dogs','police']])for(const role of ['cat','police'])
    assert.equal(shouldCelebrate({playMode:'onlineCat',winner,winnerPlayerId:role===winnerRole?'verified-player':'opponent',session:session(role),official:true}),role===winnerRole);
  assert.equal(shouldCelebrate({playMode:'onlineCat',winner:'cat',session:session('cat')}),false);
  assert.equal(shouldCelebrate({playMode:'onlineCat',winner:'cat',session:{role:'cat'},official:true}),false);
  assert.equal(shouldCelebrate({playMode:'local',winner:'cat',winnerPlayerId:'opponent',session:session('cat'),official:true}),false);
});
test('切断・時間切れの正式勝者は演出し、無効・中止は双方演出しない',()=>{
  for(const finishReason of ['disconnectForfeit','turnTimeout']){
    assert.equal(shouldCelebrate({playMode:'onlinePolice',winner:'dogs',winnerPlayerId:'verified-player',session:session('police'),official:true,finishReason}),true);
    assert.equal(shouldCelebrate({playMode:'onlineCat',winner:'dogs',winnerPlayerId:'opponent',session:session('cat'),official:true,finishReason}),false);
  }
  for(const resultStatus of ['invalid','cancelled'])
    assert.equal(shouldCelebrate({playMode:'onlineCat',winner:'cat',winnerPlayerId:'verified-player',session:session('cat'),official:true,resultStatus}),false);
  assert.equal(shouldCelebrate({playMode:'onlineCat',winner:'cat',winnerPlayerId:'verified-player',session:session('cat'),official:true,finishReason:'serverInvalid'}),false);
  assert.equal(shouldCelebrate({playMode:'onlineCat',winner:null,session:session('cat'),official:true}),false);
});
