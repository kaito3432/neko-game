const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../game.js'),'utf8').replace(/\r\n/g,'\n');
test('Room match disables both entry buttons and reset enables both',()=>{
  const block=source.slice(source.indexOf('let onlineRoomMatched=false;'),source.indexOf('  const cpuSideOverlay='));
  const context={createOnlineRoomBtn:{disabled:false},joinOnlineRoomBtn:{disabled:false},onlineStartGameBtn:null,onlineStatus:null,onlineRoomCodeInput:null,roomRolePicker:null,confirmRoomRoleBtn:null};
  vm.createContext(context);
  vm.runInContext(block,context);
  for(let i=0;i<2;i++){
    vm.runInContext('markOnlineRoomMatched()',context);
    assert.equal(context.createOnlineRoomBtn.disabled,true);
    assert.equal(context.joinOnlineRoomBtn.disabled,true);
    vm.runInContext('resetOnlineState()',context);
    assert.equal(context.createOnlineRoomBtn.disabled,false);
    assert.equal(context.joinOnlineRoomBtn.disabled,false);
  }
});
test('Room create handler rejects disabled or matched entry before network work',async()=>{
  const start=source.indexOf('bindPress(createOnlineRoomBtn,async()=>{');
  const body=source.slice(start+'bindPress(createOnlineRoomBtn,async()=>{'.length,source.indexOf('  createOnlineRoomBtn.disabled=true;',start));
  for(const state of [{disabled:true,matched:false},{disabled:false,matched:true}]){
    const context={createOnlineRoomBtn:{disabled:state.disabled},onlineRoomMatched:state.matched};
    vm.createContext(context);
    await vm.runInContext('(async()=>{'+body+'throw new Error("guard did not return");})()',context);
  }
});
