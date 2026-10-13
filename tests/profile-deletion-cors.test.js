const test=require('node:test'),assert=require('node:assert/strict');
const modulePromise=import('../server/profile-deletion-cors.mjs');
const token='a'.repeat(64),origin='capacitor://localhost';
const req=(method='DELETE',path='/api/online/profile',headers={})=>new Request('https://worker.example'+path,{method,headers:{origin,authorization:'Bearer '+token,...headers}});
test('DELETE self-deletion forwards authenticated request and emits exact CORS origin',async()=>{
 const {profileDeletionCors:handle}=await modulePromise;let called=0;
 const response=await handle(req(),async r=>{called++;assert.equal(r.headers.get('authorization'),'Bearer '+token);return Response.json({deleted:true});});
 assert.equal(called,1);assert.equal(response.status,200);
 assert.equal(response.headers.get('access-control-allow-origin'),origin);
 assert.deepEqual(await response.json(),{deleted:true});
});
test('DELETE missing auth, invalid origin and unrelated endpoint are rejected before dispatch',async()=>{
 const {profileDeletionCors:handle}=await modulePromise;
 const forward=()=>{throw Error('must not dispatch');};
 assert.equal((await handle(req('DELETE',undefined,{authorization:''}),forward)).status,401);
 for(const bad of ['https://evil.example','null','https://kaito3432.github.io.evil.example'])
  assert.equal((await handle(req('DELETE',undefined,{origin:bad}),forward)).status,403);
 assert.equal((await handle(req('DELETE','/api/online/coin-purchase'),forward)).status,405);
});
test('DELETE OPTIONS allows only endpoint, trusted origin and minimal requested headers',async()=>{
 const {profileDeletionCors:handle}=await modulePromise;
 const headers={'access-control-request-method':'DELETE','access-control-request-headers':'Authorization, Content-Type',authorization:''};
 const response=await handle(req('OPTIONS',undefined,headers));
 assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-methods'),'DELETE, OPTIONS');
 assert.equal((await handle(req('OPTIONS',undefined,{...headers,'access-control-request-headers':'X-Admin'}))).status,403);
 assert.equal((await handle(req('OPTIONS','/api/online/active',headers))).status,405);
 assert.equal((await handle(req('OPTIONS',undefined,{...headers,origin:'https://evil.example'}))).status,403);
});
test('GET POST and ordinary OPTIONS remain on existing handler',async()=>{
 const {profileDeletionCors:handle}=await modulePromise;
 for(const method of ['GET','POST','OPTIONS'])assert.equal(await handle(req(method)),null);
});
