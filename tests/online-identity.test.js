"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {webcrypto}=require("node:crypto");

test("オンラインappearance payloadはコイン購入スキンの所有IDとプロフィール設定を送る",async()=>{
  const calls=[],values=new Map();
  const localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value))};
  const local={playerId:"ncp_1234567890abcdef",ownedCatSkins:["default","cat_coin_01"],
    ownedDogSkins:["default","dog_coin_01"],equippedAppearance:{catSkinId:"cat_coin_01",dogSkinId:"dog_coin_01"},
    profileCharacter:{category:"catSkin",itemId:"cat_coin_01"}};
  const context=vm.createContext({console,crypto:webcrypto,localStorage,AbortController,setTimeout,clearTimeout,
    navigator:{},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},dispatchEvent(){},
    NyanPlayerData:{getSnapshot:()=>local,load:async()=>local},NyanCpuUnlockSync:{flush:async()=>({})},
    fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({profile:{playerId:"online"}})};}});
  context.globalThis=context;
  vm.runInContext(fs.readFileSync(require.resolve("../online-identity.js"),"utf8"),context);
  await context.NyanOnlineIdentity.prepare("https://sandbox.example");
  const appearance=calls.find(call=>call.url.endsWith("/appearance")).body;
  assert.deepEqual(JSON.parse(JSON.stringify(appearance.collectionOwnership)),{
    ownedCatSkins:["default","cat_coin_01"],ownedDogSkins:["default","dog_coin_01"]});
  assert.deepEqual(JSON.parse(JSON.stringify(appearance.profileCharacter)),local.profileCharacter);
});

test("認証済みeffective Skill viewは表示用メモリだけに保持し正式ownershipへ保存しない",async()=>{
  const values=new Map(),events=[];
  const formal={skillModeUnlocked:false,ownedSkillIds:[]};
  const profile={playerId:'op_qa_web',skillEntitlements:formal};
  const effectiveSkillEntitlements={skillModeUnlocked:true,availableSkillIds:
    ['CAT_STEALTH','CAT_FAKE_PAW','POLICE_HOWL','POLICE_GROUP_SEARCH','POLICE_DASH'],borrowedSkillIds:[]};
  const local={playerId:'ncp_qa_web',ownedCatSkins:['default'],ownedDogSkins:['default'],equippedAppearance:{}};
  const context=vm.createContext({crypto:webcrypto,AbortController,setTimeout,clearTimeout,navigator:{},
    localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value))},
    NyanPlayerData:{getSnapshot:()=>local,load:async()=>local},NyanCpuUnlockSync:{flush:async()=>{}},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    dispatchEvent:event=>events.push(event),
    fetch:async url=>({ok:true,json:async()=>url.endsWith('/appearance')?{profile,effectiveSkillEntitlements}:{profile}})});
  context.globalThis=context;
  vm.runInContext(fs.readFileSync(require.resolve('../online-identity.js'),'utf8'),context);
  await context.NyanOnlineIdentity.prepare('https://sandbox.example');
  const view=context.NyanOnlineIdentity.getAuthenticatedSkillView();
  assert.equal(view.playerId,'op_qa_web');
  assert.equal(view.apiBase,'https://sandbox.example');
  assert.equal(view.effectiveSkillEntitlements.skillModeUnlocked,true);
  assert.equal(events.at(-1).detail.effectiveSkillEntitlements.availableSkillIds.length,5);
  assert.deepEqual(formal,{skillModeUnlocked:false,ownedSkillIds:[]});
  assert.equal([...values.keys()].some(key=>key.includes('skill')),false);
});

test('冷起動reconnectは認証済みprofile GETで本人Skill viewを復元する',async()=>{
  const values=new Map([['nyanChaseOnlineCredentialV1','a'.repeat(64)]]),calls=[],events=[];
  const profile={playerId:'op_qa_phone',skillEntitlements:{skillModeUnlocked:false,ownedSkillIds:[]}};
  const effectiveSkillEntitlements={skillModeUnlocked:true,availableSkillIds:['CAT_STEALTH','POLICE_HOWL'],borrowedSkillIds:[]};
  const context=vm.createContext({AbortController,setTimeout,clearTimeout,
    localStorage:{getItem:key=>values.get(key)||null},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    dispatchEvent:event=>events.push(event),
    fetch:async(url,options)=>{calls.push({url,method:options.method,authorization:options.headers.Authorization});
      return {ok:true,json:async()=>({profile,effectiveSkillEntitlements})};}});
  context.globalThis=context;
  vm.runInContext(fs.readFileSync(require.resolve('../online-identity.js'),'utf8'),context);
  const result=await context.NyanOnlineIdentity.refreshSkillView('https://sandbox.example');
  assert.equal(calls.length,1);
  assert.equal(calls[0].method,'GET');
  assert.equal(calls[0].authorization,`Bearer ${'a'.repeat(64)}`);
  assert.equal(result.effectiveSkillEntitlements.availableSkillIds.length,2);
  assert.equal(context.NyanOnlineIdentity.getAuthenticatedSkillView().playerId,'op_qa_phone');
  assert.equal(events.at(-1).type,'nyan-online-profile');
  assert.deepEqual(profile.skillEntitlements,{skillModeUnlocked:false,ownedSkillIds:[]});
  assert.equal(values.size,1);
});
