const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const unlocked={skillEntitlements:{skillModeUnlocked:true}};
const locked={skillEntitlements:{skillModeUnlocked:false}};
const room=(host,guest)=>({roles:{host:'cat',guest:'police'},requiresRuleSelection:true,profiles:{host,guest}});

test('online skill mode requires both server-verified profiles',async()=>{
  const {sessionEvent}=await import('../server/session-events.mjs');
  for(const [host,guest,allowed] of [[unlocked,unlocked,true],[unlocked,locked,false],[locked,unlocked,false],[locked,locked,false]]){
    const match=room(host,guest),answer=sessionEvent(match,'host',{type:'ruleSelect',rule:'ability'});
    if(allowed){assert.deepEqual(answer,{type:'ruleSelect',rule:'ability'});assert.equal(match.rule,'ability');}
    else{assert.equal(answer.skillError,'SKILL_MODE_LOCKED');assert.equal(match.rule,undefined);}
    assert.deepEqual(sessionEvent(room(host,guest),'host',{type:'ruleSelect',rule:'normal'}),{type:'ruleSelect',rule:'normal'});
  }
  const missing=room(unlocked,null);
  assert.equal(sessionEvent(missing,'host',{type:'ruleSelect',rule:'ability'}).skillError,'SKILL_MODE_LOCKED');
});

test('role/recovery share server availability, never a local unlock claim',()=>{
  const base=path.resolve(__dirname,'..');
  const worker=fs.readFileSync(path.join(base,'server/worker.mjs'),'utf8');
  const recovery=fs.readFileSync(path.join(base,'server/reconnection.mjs'),'utf8');
  const game=fs.readFileSync(path.join(base,'game.js'),'utf8');
  const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
  assert.match(worker,/skillModeAvailable:canUseOnlineSkillMode\(room\.profiles\)/);
  assert.match(recovery,/skillModeAvailable:canUseOnlineSkillMode\(room\.profiles\)/);
  assert.match(game,/onlineSkillModeAvailable=data\.skillModeAvailable===true/);
  assert.match(game,/if\(!onlineSkillModeAvailable\) return/);
  assert.doesNotMatch(html,/id="onlineSkillUnlockOpen"/);
  assert.match(html,/この対戦では通常戦のみ/);
});
