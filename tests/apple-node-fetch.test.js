const test=require('node:test'),assert=require('node:assert/strict');
test('Worker OCSP transport preserves binary response and HTTP status',async()=>{
 const {default:fetch}=await import('../server/apple-node-fetch.mjs'),prior=globalThis.fetch;
 try{globalThis.fetch=async(url,options)=>{assert.equal(url,'https://ocsp.example');assert.equal(options.method,'POST');return new Response(new Uint8Array([1,2,3]),{status:503});};
  const result=await fetch('https://ocsp.example',{method:'POST',timeout:30000});
  assert.equal(result.ok,false);assert.equal(result.status,503);assert.deepEqual([...await result.buffer()],[1,2,3]);
 }finally{globalThis.fetch=prior;}
});
test('Worker OCSP transport propagates timeout and network failure',async()=>{
 const {default:fetch}=await import('../server/apple-node-fetch.mjs'),prior=globalThis.fetch;
 try{globalThis.fetch=async()=>{throw Error('network unavailable');};
  await assert.rejects(()=>fetch('https://ocsp.example',{timeout:30000}),/network/);
  globalThis.fetch=async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  const hold=setTimeout(()=>{},100);
  try{await assert.rejects(()=>fetch('https://ocsp.example',{timeout:5}),error=>error.name==='TimeoutError');}finally{clearTimeout(hold);}
 }finally{globalThis.fetch=prior;}
});
