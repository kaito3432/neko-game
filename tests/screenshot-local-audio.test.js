const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(href='capacitor://localhost/index.html'){
 const calls=[],native=[],meta=[];
 class XHR{open(method,url){this.request={method,url};}send(){calls.push(this.request);return 'local-xhr';}}
 const root={URL,location:{href},__nyanScreenshotIsolated:true,XMLHttpRequest:XHR,WebSocket:class{},EventSource:class{},navigator:{sendBeacon:()=>true},
  Capacitor:{getPlatform:()=> 'ios',nativePromise:async(plugin,method)=>native.push({plugin,method})},
  document:{head:{append:node=>meta.push(node)},createElement:()=>({}),addEventListener(){}},
  fetch:async(input,options)=>{calls.push({input,options});return {ok:true,arrayBuffer:async()=>{
    const name=new URL(typeof input==='string'?input:input.url,href).pathname.split('/assets/')[1];
    const file=fs.readFileSync(path.join(__dirname,'../assets',name));return file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
  }};}};
 root.window=root;
 vm.runInNewContext(fs.readFileSync(require.resolve('../debug/screenshot-isolation.js'),'utf8'),root);
 return {root,calls,native,meta};
}
test('same-bundle read-only assets work on capacitor, file, app and asset URLs',async()=>{
 for(const href of ['capacitor://localhost/index.html','file:///bundle/public/index.html','app://localhost/index.html','asset://localhost/index.html']){
  const f=fixture(href);
  for(const asset of ['./assets/audio/jingle_cat_win.wav','./assets/images/vs_dash.png','./privacy.html'])await f.root.fetch(asset);
  const request={url:new URL('./assets/audio/jingle_police_win.wav',href).href,method:'GET'};await f.root.fetch(request);
  await f.root.fetch(new URL('./assets/audio/jingle_cat_win.wav',href),{method:'HEAD'});
  assert.equal(f.calls.length,5);assert.equal(f.calls[0].options.redirect,'error');
  const xhr=new f.root.XMLHttpRequest();xhr.open('GET','./assets/audio/jingle_cat_win.wav');assert.equal(xhr.send(),'local-xhr');
 }
});
test('remote, API, writes and native StoreKit/AdMob/HTTP remain blocked',async()=>{
 const f=fixture();
 for(const url of ['https://nyan-chase-online.honda19990602.workers.dev/api/online/profile','https://example.com/a.wav','http://localhost/a.wav','//foreign/assets/a.wav','./api/online/profile','./api/profile.json','./assets/%2e%2e/api/profile.json'])await assert.rejects(f.root.fetch(url),/Offline/);
 await assert.rejects(f.root.fetch('./assets/audio/jingle_cat_win.wav',{method:'POST'}),/Offline/);
 const xhr=new f.root.XMLHttpRequest();xhr.open('GET','https://example.com/a.wav');assert.throws(()=>xhr.send(),/Offline/);
 assert.throws(()=>new f.root.WebSocket('wss://example.com'),/Offline/);
 for(const plugin of ['NyanStoreKit','AdMob','CapacitorHttp'])await assert.rejects(f.root.Capacitor.nativePromise(plugin,'purchase'),/Offline/);
 assert.equal(f.calls.length,0);assert.equal(f.native.length,0);assert.match(f.meta[0].content,/connect-src capacitor: file:/);
});
test('both real victory WAVs load, decode and start through the isolated audio engine',async()=>{
 const f=fixture();let starts=0,decodes=0;
 f.root.console={log(){},warn(){}};
 f.root.localStorage={getItem:()=>null};
 f.root.Audio=class{constructor(){this.paused=true;this.src='';}load(){}pause(){this.paused=true;}play(){this.paused=false;return Promise.resolve();}addEventListener(){}};
 f.root.AudioContext=class{
  constructor(){this.state='running';this.destination={};}
  createMediaElementSource(){return {connect(){}};}
  createGain(){return {gain:{value:1},connect(){}};}
  async decodeAudioData(data){assert.equal(Buffer.from(data).toString('ascii',0,4),'RIFF');assert(data.byteLength>1000);decodes++;return {};}
  createBufferSource(){return {connect(){},start(){starts++;}};}
 };
 vm.runInNewContext(fs.readFileSync(require.resolve('../audio.js'),'utf8'),f.root);
 await f.root.NyanAudio.play('catwin');await f.root.NyanAudio.play('policewin');
 assert.equal(starts,2);assert.equal(decodes,2);assert.equal(f.calls.length,2);
 assert.equal(f.root.NyanScreenshotIsolation.counts().web,0);
});
