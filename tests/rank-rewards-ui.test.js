const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const rewards=require('../rank-rewards.js');
const byId=id=>rewards.ranks.find(rank=>rank.id===id);

test('ランク報酬一覧は必要RPとシーズンコイン仕様を一元管理する',()=>{
  assert.deepEqual(rewards.ranks.map(rank=>[rank.id,rank.min,rank.max,rank.seasonCoins]),[
    ['bronze',0,99,0],['silver',100,199,200],['gold',200,349,400],
    ['platinum',350,549,800],['diamond',550,799,1200],['master',800,null,1500]
  ]);
  assert.equal(rewards.formatCoins(1200),'1,200');
  assert.equal(rewards.formatCoins(1500),'1,500');
});

test('ブロンズは初期フレーム、シルバー以上は到達フレームを持つ',()=>{
  assert.equal(byId('bronze').frameId,'rank_bronze');
  assert.match(byId('bronze').arrivalRewards[0],/初期所持/);
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
  assert.match(matchmaking,/nyan-online-selection-opened/);
  assert.match(ranked,/nyan-online-selection-opened/);
  assert.match(ranked,/coinsAndSkin/);
  assert.doesNotMatch(matchmaking,/online-opponent-profile/);
});

test('オンライン入口はoverlay生成後にranked profileを接続する',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(html.indexOf('random-match.js')<html.indexOf('ranked-ui.js'));
});

test('初回Online表示は認証済みSkill viewがまだなくても暫定ランクを描画する',()=>{
  const source=fs.readFileSync(path.join(root,'ranked-ui.js'),'utf8');
  const fields=new Map();
  const element=()=>({isConnected:false,hidden:false,classList:{add(){},remove(){}},
    append(){},after(child){child.isConnected=true;},replaceChildren(){},setImage(){},
    querySelector(selector){if(!fields.has(selector))fields.set(selector,element());return fields.get(selector);}});
  const document={createElement:element,body:{append(){}},querySelector(selector){
    return selector==='#matchmakingStatus'||selector==='#resultText'?element():null;
  }};
  let skillView=null;
  const context={document,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
    NyanRankRewards:{ranks:[{id:'bronze',name:'ブロンズ',min:0,icon:''},{id:'silver',name:'シルバー',min:100,icon:''}]},
    NyanOnlineProfileUI:{frames:{rank_bronze:'肉球ブロンズフレーム'},frameId:()=> 'rank_bronze',setImage(){},setFrame(){}},
    NyanOnlineIdentity:{getAuthenticatedSkillView:()=>skillView},NyanOnline:{API_BASE:'https://example.test'},
    NyanPlayerData:{getSnapshot:()=>({})},addEventListener(){},dispatchEvent(){}};
  vm.runInNewContext(source,context);
  assert.doesNotThrow(()=>context.NyanRankedUI.setSelectionVisible(true));
  assert.equal(fields.get('[data-rank-skill-access]').textContent,'Skill Mode：サーバー確認中');
  skillView={playerId:'op_test',apiBase:'https://example.test',effectiveSkillEntitlements:{skillModeUnlocked:true,availableSkillIds:['CAT_STEALTH']}};
  context.NyanRankedUI.updateProfile({playerId:'op_test',ranked:{rank:'bronze',rp:0,seasonWins:0,seasonLosses:0}});
  assert.match(fields.get('[data-rank-skill-access]').textContent,/オンライン利用可能（1スキル）/);
});
