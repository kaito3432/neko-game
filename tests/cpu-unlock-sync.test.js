const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Player=require('../player-data.js');
const Sync=require('../cpu-unlock-sync.js');
class LocalStorage{
  values=new Map();fail=false;
  getItem(k){return this.values.get(k)||null;}
  setItem(k,v){if(this.fail)throw Error('storage_failed');this.values.set(k,String(v));}
}
class ServerStorage{
  values=new Map();writes=0;
  async get(k){return structuredClone(this.values.get(k));}
  async put(k,v){this.writes++;this.values.set(k,structuredClone(v));}
}
const rules=[['cat','cat_hard_10wins','cat_kaitou','ownedCatSkins'],['police','police_hard_10wins','dog_detective','ownedDogSkins']];
const battle=(i,side)=>({battleId:`cpu_unlock_test_${side}_${i}`,source:'cpu',side,difficulty:'hard',won:true,completed:true,completedAt:Date.now()});
test('CPU解放時に自動同期を起動し、同期の同期的例外でもローカル解放を維持',async()=>{
  const previous=globalThis.NyanOnline;
  let calls=0;
  globalThis.NyanOnline={syncCpuUnlocks(){calls++;throw Error('network_unavailable');}};
  try{
    const player=Player.createStore({storage:new LocalStorage()});await player.load();
    for(let i=1;i<=10;i++)await player.recordDailyMissionBattle(battle(i,'cat'));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls,1);
    assert.ok(player.getSnapshot().ownedCatSkins.includes('cat_kaitou'));
    assert.equal(player.getSnapshot().cpuUnlockSync.cat_hard_10wins,'pending');
  }finally{if(previous===undefined)delete globalThis.NyanOnline;else globalThis.NyanOnline=previous;}
});
async function fixture(){
  const {profileRequest}=await import('../server/online-profile.mjs');
  const local=new LocalStorage(),server=new ServerStorage();
  let player=Player.createStore({storage:local});await player.load();
  let fail=false;const claims=[];
  const context=vm.createContext({localStorage:local,crypto,AbortController,setTimeout,clearTimeout,
    NyanCpuUnlockSync:Sync,NyanPlayerData:player,
    fetch:async(url,options)=>{
      const endpoint=new URL(url).pathname.replace('/api/online','');
      if(endpoint==='/cpu-unlock'){
        claims.push(JSON.parse(options.body));
        if(fail)throw Error('offline');
      }
      return profileRequest(server,new Request('https://test'+endpoint,options));
    }});
  vm.runInContext(fs.readFileSync(require.resolve('../online-identity.js'),'utf8'),context);
  return {local,server,context,claims,get player(){return player;},setFailure:v=>{fail=v;},
    reconnect:()=>context.NyanOnlineIdentity.prepare('https://test'),
    restart:async()=>{player=Player.createStore({storage:local});await player.load();context.NyanPlayerData=player;}};
}
for(const [side,achievement,skin,owned] of rules){
  test(`${achievement}: 初回登録→CPU10勝→解放→通信失敗→再起動/オンライン接続→サーバー反映`,async()=>{
    const f=await fixture();
    assert.deepEqual((await f.reconnect()).profile[owned],['default']);
    for(let i=1;i<=9;i++)await f.player.recordDailyMissionBattle(battle(i,side));
    assert.deepEqual(f.player.getSnapshot().cpuUnlockSync,{});
    await f.player.recordDailyMissionBattle(battle(10,side));
    assert.equal(f.player.getSnapshot().cpuUnlockSync[achievement],'pending');
    assert.ok(f.player.getSnapshot()[owned].includes(skin));
    f.setFailure(true);await f.reconnect();
    assert.ok(f.player.getSnapshot()[owned].includes(skin));
    assert.equal(f.player.getSnapshot().cpuUnlockSync[achievement],'pending');
    await f.restart();assert.equal(f.player.getSnapshot().cpuUnlockSync[achievement],'pending');
    f.setFailure(false);
    await f.player.updateEquipment(side==='cat'?'catSkin':'dogSkin',skin);
    const saved=await f.reconnect();
    await f.player.load(); // drain queued acknowledgement
    assert.equal(f.player.getSnapshot().cpuUnlockSync[achievement],'synced');
    assert.equal(saved.profile[owned].filter(id=>id===skin).length,1);
    assert.equal(saved.profile.equippedAppearance[side==='cat'?'catSkinId':'dogSkinId'],skin);
    assert.deepEqual(f.claims,[{achievement},{achievement}]);
    await f.reconnect();assert.equal(f.claims.length,2);
    assert.equal(f.player.getSnapshot().nyanCoins,0);
    assert.equal(f.player.getSnapshot().battleReceipts.length,10);
  });
}
test('APIは認証必須・実績2種類のみ、skinIdや追加フィールドを拒否、再送は無変更',async()=>{
  const {profileRequest}=await import('../server/online-profile.mjs');const server=new ServerStorage();
  const headers={Authorization:`Bearer ${'ab'.repeat(32)}`};
  const post=(path,body,h=headers)=>profileRequest(server,new Request('https://test'+path,{method:'POST',headers:h,body:JSON.stringify(body)}));
  assert.equal((await post('/cpu-unlock',{achievement:'cat_hard_10wins'},{})).status,401);
  await post('/register',{});
  for(const body of [{skinId:'cat_kaitou'},{achievement:'unknown'},{achievement:'cat_hard_10wins',skinId:'other'},{achievement:'__proto__'}]){
    assert.equal((await post('/cpu-unlock',body)).status,400);
  }
  const granted=await (await post('/cpu-unlock',{achievement:'cat_hard_10wins'})).json();
  const writes=server.writes;
  assert.ok(granted.profile.ownedCatSkins.includes('cat_kaitou'));
  const replay=await (await post('/cpu-unlock',{achievement:'cat_hard_10wins'})).json();
  assert.equal(server.writes,writes);assert.deepEqual(replay,granted);
  assert.equal(granted.profile.cpuUnlockClaims.cat_hard_10wins,'unverified-client-claim');
});
test('不完全な応答・同期済み保存失敗でもpendingを保持して再送できる',async()=>{
  const f=await fixture();await f.reconnect();for(let i=1;i<=10;i++)await f.player.recordDailyMissionBattle(battle(i,'cat'));
  let result=await Sync.flush(f.player,async()=>({achievement:'cat_hard_10wins',profile:{ownedCatSkins:['default']}}));
  await result.acknowledgements;assert.equal(f.player.getSnapshot().cpuUnlockSync.cat_hard_10wins,'pending');
  const response={achievement:'cat_hard_10wins',profile:{ownedCatSkins:['default','cat_kaitou']}};
  f.local.fail=true;
  result=await Sync.flush(f.player,async()=>response);await result.acknowledgements;
  assert.equal(f.player.getSnapshot().cpuUnlockSync.cat_hard_10wins,'pending');
  f.local.fail=false;
  result=await Sync.flush(f.player,async()=>response);await result.acknowledgements;
  assert.equal(f.player.getSnapshot().cpuUnlockSync.cat_hard_10wins,'synced');
});
test('v4補完は実績10＋所持の場合のみpendingにし、既存データを保持',()=>{
  const old=Player.createDefaultData('ncp_1234567890123456');delete old.cpuUnlockSync;old.version=4;
  old.nyanCoins=123;old.ownedCatSkins.push('cat_kaitou');old.skinUnlockProgress.cat_kaitou=10;
  const migrated=Player.normalizeData(old,old.playerId);
  assert.equal(migrated.cpuUnlockSync.cat_hard_10wins,'pending');assert.equal(migrated.nyanCoins,123);
  assert.deepEqual(migrated.equippedAppearance,old.equippedAppearance);
  assert.deepEqual(Sync.normalize({skinUnlockProgress:{cat_kaitou:10},ownedCatSkins:{}}),{});
});
