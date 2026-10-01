const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const production=fs.readFileSync(path.join(__dirname,'../api-environment.js'),'utf8');
const qa=fs.readFileSync(path.join(__dirname,'../debug/web-sandbox-qa.js'),'utf8');
const sandbox='https://nyan-chase-online-sandbox.honda19990602.workers.dev';
const prod='https://nyan-chase-online.honda19990602.workers.dev';

function runtime(url){
  const context={location:new URL(url),URLSearchParams};
  vm.createContext(context);
  vm.runInContext(production,context);
  vm.runInContext(qa,context);
  return context;
}

test('local Web QA opt-in uses Sandbox before online initialization',()=>{
  const web=runtime('file:///Users/kaito/game/index.html?nyanSandboxQa=1');
  assert.equal(web.NYAN_API_BASE,sandbox);
  assert.equal(web.NYAN_WEB_SANDBOX_QA,true);
});

test('Web default and production origins keep Production API',()=>{
  assert.equal(runtime('file:///Users/kaito/game/index.html').NYAN_API_BASE,prod);
  assert.equal(runtime('https://nyanchase.example/index.html?nyanSandboxQa=1').NYAN_API_BASE,prod);
  assert.equal(runtime('http://localhost:8000/index.html?nyanSandboxQa=1').NYAN_API_BASE,sandbox);
});

test('Web QA diagnostics do not grant Skill Mode entitlement or appearance',()=>{
  assert.doesNotMatch(qa,/NyanSkillModeQa|skillModeUnlocked|QA_PROFILE_OVERRIDES|profileCharacter\s*=/);
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.doesNotMatch(html,/debug\/skill-mode-qa\.js/);
});
