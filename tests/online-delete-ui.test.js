const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup({failure=false}={}){
  const values=new Map([['nyanChaseOnlineCredentialV1','a'.repeat(64)]]),events=[];
  const localStorage={getItem:key=>values.get(key)||null,removeItem:key=>values.delete(key)};
  let resolveDelete,callCount=0,resetCount=0;
  const fetch=async(_url,options)=>{callCount++;return new Promise(resolve=>{
    resolveDelete=()=>resolve(failure?{ok:false,status:503,json:async()=>({error:'failed'})}:
      {ok:true,json:async()=>({deleted:true})});});};
  const elements=new Map();
  for(const id of ['onlineDataDeleteOverlay','onlineDataDeleteOpen','onlineDataDeleteCancel',
    'onlineDataDeleteNext','onlineDataDeleteConfirm','onlineDataDeleteWarning','onlineDataDeleteStatus'])
    elements.set(id,{hidden:id==='onlineDataDeleteOverlay',disabled:false,textContent:'',listeners:{},
      classList:{add(){},remove(){}},
      addEventListener(type,fn){this.listeners[type]=fn;},click(){return this.listeners.click?.({target:this});}});
  const root={localStorage,fetch,AbortController,setTimeout,clearTimeout,
    document:{getElementById:id=>elements.get(id)},NyanOnline:{API_BASE:'https://sandbox',clearDeletedProfile(){resetCount++;}},
    dispatchEvent:event=>events.push(event),CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}};
  root.globalThis=root;
  const context=vm.createContext(root);
  vm.runInContext(fs.readFileSync(require.resolve('../online-identity.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(require.resolve('../online-delete-ui.js'),'utf8'),context);
  return {elements,values,events,resolve:()=>resolveDelete(),calls:()=>callCount,resets:()=>resetCount};
}
test('確認キャンセルでは送信せず、二重送信せず、成功後だけcredentialを消す',async()=>{
  const x=setup(),el=id=>x.elements.get(id);
  el('onlineDataDeleteOpen').click();el('onlineDataDeleteCancel').click();
  assert.equal(x.calls(),0);assert.equal(x.values.size,1);
  el('onlineDataDeleteOpen').click();el('onlineDataDeleteNext').click();
  const first=el('onlineDataDeleteConfirm').click();
  const second=el('onlineDataDeleteConfirm').click();
  assert.equal(x.calls(),1);assert.equal(x.values.size,1);
  x.resolve();await Promise.all([first,second]);
  assert.equal(x.values.has('nyanChaseOnlineCredentialV1'),false);
  assert.equal(x.resets(),1);
  assert.equal(el('onlineDataDeleteStatus').textContent,'オンラインデータを削除しました');
});
test('Server失敗ではcredentialを保持し再試行できる',async()=>{
  const x=setup({failure:true}),el=id=>x.elements.get(id);
  el('onlineDataDeleteOpen').click();el('onlineDataDeleteNext').click();
  const pending=el('onlineDataDeleteConfirm').click();x.resolve();await pending;
  assert.equal(x.values.has('nyanChaseOnlineCredentialV1'),true);
  assert.equal(x.resets(),0);
  assert.equal(el('onlineDataDeleteConfirm').disabled,false);
});
