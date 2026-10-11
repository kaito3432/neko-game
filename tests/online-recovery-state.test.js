const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const data=new Map(),ctx={localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../online-recovery-state.js'),'utf8'),ctx);
 data.set('nyanChaseOnlineCredentialV1','a'.repeat(64));
 return {data,api:ctx.NyanOnlineRecoveryState};
}
test('認証済みでもHome / CPU / ローカル対人 / 閲覧のみは復帰候補なし',()=>{
 const {api}=setup();assert.equal(api.hasCandidate(),false);
});
for(const matchType of ['roomMatch','randomMatch'])test(`${matchType}途中と未確認結果は即復帰候補、確認後は解除`,()=>{
 const {api,data}=setup();api.save({matchId:'match1',roomCode:'123456',matchType});
 assert.equal(api.hasCandidate(),true);
 // 再起動しても同じ永続データで判定できる。
 assert.equal(JSON.parse(data.get('nyanOnlineRecoveryV1')).matchId,'match1');
 data.set('nyanOnlineLastResultV1','match1');assert.equal(api.hasCandidate(),false);
 api.clear();assert.equal(data.has('nyanOnlineRecoveryV1'),false);
});
test('壊れた情報や非Online試合は復帰候補にしない',()=>{
 const {api,data}=setup();for(const value of ['{','null',JSON.stringify({matchId:'cpu',roomCode:'x',matchType:'cpu'})]){
 data.set('nyanOnlineRecoveryV1',value);assert.equal(api.hasCandidate(),false);
 }
});
