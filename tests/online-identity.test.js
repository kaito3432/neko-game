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
