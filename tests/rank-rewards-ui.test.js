const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const rewards=require('../rank-rewards.js');
const byId=id=>rewards.ranks.find(rank=>rank.id===id);

test('ランク報酬一覧は必要RPとシーズンコイン仕様を一元管理する',()=>{
  assert.deepEqual(rewards.ranks.map(rank=>[rank.id,rank.min,rank.max,rank.seasonCoins]),[
    ['bronze',0,99,0],['silver',100,249,200],['gold',250,449,400],
    ['platinum',450,699,700],['diamond',700,999,1100],['master',1000,null,1500]
  ]);
  assert.equal(rewards.formatCoins(1100),'1,100');
  assert.equal(rewards.formatCoins(1500),'1,500');
});

test('ブロンズは到達報酬なし、シルバー以上は対応フレームを持つ',()=>{
  assert.deepEqual(byId('bronze').arrivalRewards,[]);
  for(const id of ['silver','gold','platinum','diamond']){
    assert.ok(byId(id).frameId?.startsWith('rank_'));
    assert.equal(byId(id).arrivalRewards.length,1);
  }
});

test('マスター到達報酬にフレームと限定スキンを表示する',()=>{
  assert.deepEqual(byId('master').arrivalRewards,['マスターフレーム','マスター限定スキン']);
});

test('オンライン選択画面から報酬モーダルへ接続し、閉じる導線を持つ',()=>{
  const matchmaking=fs.readFileSync(path.join(root,'random-match.js'),'utf8');
  const source=fs.readFileSync(path.join(root,'rank-rewards.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
  assert.match(matchmaking,/ランク戦について/);
  assert.match(matchmaking,/data-rank-rewards-open/);
  assert.match(matchmaking,/NyanRankRewards\?\.attach\(overlay\)/);
  assert.match(source,/到達報酬/);
  assert.match(source,/シーズン報酬/);
  assert.match(source,/data-rank-rewards-close/);
  assert.match(source,/rank-coin-icon[^>]*>🪙/);
  assert.match(html,/rank-rewards\.js/);
  assert.match(css,/\.rank-rewards-shell\{[^}]*width:min\(100%,520px\)[^}]*max-height:100%/);
  assert.match(css,/\.rank-rewards-scroll\{[^}]*overflow-y:auto/);
  assert.match(css,/\.rank-reward-list\{[^}]*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.rank-rewards-shell>footer\{[^}]*flex:none/);
  assert.match(css,/@media\(max-width:390px\),\(max-height:700px\)/);
  assert.doesNotMatch(css,/rank-rewards[^}]*overflow-x:auto/);
});

test('自分のランク情報と説明はオンライン遊び方選択中だけ表示する',()=>{
  const matchmaking=fs.readFileSync(path.join(root,'random-match.js'),'utf8');
  const ranked=fs.readFileSync(path.join(root,'ranked-ui.js'),'utf8');
  assert.match(matchmaking,/function setSelectionVisible\(visible\)/);
  assert.match(matchmaking,/function waiting\(\) \{\s*setSelectionVisible\(false\)/);
  assert.match(matchmaking,/rooms\.onclick = \(\) => \{[^}]*setSelectionVisible\(false\)/);
  assert.match(matchmaking,/cancel\.textContent = '戻る';[^\n]*\n\s*setSelectionVisible\(true\)/);
  assert.match(ranked,/panel\.hidden=!selectionVisible/);
  assert.match(ranked,/if\(!selectionVisible\)season\.classList\.remove\('show'\)/);
  assert.match(ranked,/setSelectionVisible/);
  assert.doesNotMatch(matchmaking,/online-opponent-profile/);
});
