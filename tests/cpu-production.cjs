// Isolated test profiles on the production Worker, explicit opt-in only.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Player=require('../player-data.js'),Sync=require('../cpu-unlock-sync.js');
if(process.env.NYAN_PRODUCTION_SMOKE!=='yes')throw Error('Production opt-in required');
const API='https://nyan-chase-online.honda19990602.workers.dev';
(async()=>{
  for(const [side,achievement,skin,owned,field] of [['cat','cat_hard_10wins','cat_kaitou','ownedCatSkins','catSkinId'],['police','police_hard_10wins','dog_detective','ownedDogSkins','dogSkinId']]){
    const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v))};
    let player=Player.createStore({storage});await player.load();let fail=false,claims=0;
    const ctx=vm.createContext({localStorage:storage,crypto,AbortController,setTimeout,clearTimeout,NyanPlayerData:player,NyanCpuUnlockSync:Sync,fetch:async(url,opts)=>{if(url.endsWith('/cpu-unlock')){assert.deepEqual(JSON.parse(opts.body),{achievement});claims++;if(fail)throw Error('test_offline');}return fetch(url,opts);}});
    vm.runInContext(fs.readFileSync(require.resolve('../online-identity.js'),'utf8'),ctx);
    const before=await ctx.NyanOnlineIdentity.prepare(API);assert.deepEqual(before.profile[owned],['default']);
    for(let i=1;i<=10;i++)await player.recordDailyMissionBattle({battleId:`production_smoke_${side}_${crypto.randomUUID()}`,source:'cpu',side,difficulty:'hard',won:true,completed:true,completedAt:Date.now()});
    fail=true;await ctx.NyanOnlineIdentity.prepare(API);assert.equal(player.getSnapshot().cpuUnlockSync[achievement],'pending');assert.ok(player.getSnapshot()[owned].includes(skin));
    player=Player.createStore({storage});await player.load();ctx.NyanPlayerData=player;fail=false;
    await player.updateEquipment(side==='cat'?'catSkin':'dogSkin',skin);
    const after=await ctx.NyanOnlineIdentity.prepare(API);await player.load();
    assert.equal(after.profile[owned].filter(s=>s===skin).length,1);assert.equal(after.profile.equippedAppearance[field],skin);assert.equal(player.getSnapshot().cpuUnlockSync[achievement],'synced');
    await ctx.NyanOnlineIdentity.prepare(API);assert.equal(claims,2);assert.equal(player.getSnapshot().nyanCoins,0);
    console.log('PASS live CPU unlock, failed transport, restart, retry, owned/equipped, idempotency:',achievement);
  }
  assert.equal((await fetch(API+'/api/online/profile')).status,401);
  console.log('PASS unauthenticated profile = 401 (not missing endpoint)');
})().catch(e=>{console.error(e);process.exitCode=1;});
