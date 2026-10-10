const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../animation.js'),'utf8');

for(const dogIndex of [0,1,2]){
  test(`dog ${dogIndex} search result waits until sniff animation finishes`,async()=>{
    let finishAnimation;
    const finished=new Promise(resolve=>{finishAnimation=resolve;});
    const sniff={
      style:{},classList:{add(){}},
      animate(frames,options){
        assert.equal(options.duration,1100);
        assert.equal(frames.length,4);
        return {finished};
      },
      remove(){this.removed=true;}
    };
    const node={getBoundingClientRect:()=>({left:10,top:20,width:30,height:30})};
    const box={getBoundingClientRect:()=>({left:50,top:60,width:30,height:30})};
    const board={
      querySelectorAll:()=>[node],
      querySelector:()=>box
    };
    const status={textContent:'',classList:{add(){},remove(){}}};
    const context={
      window:{},document:{createElement:()=>sniff,body:{appendChild(){}}},
      NyanAudio:{play(){},haptic(){}},
      setTimeout(){return 1;}
    };
    vm.createContext(context);
    vm.runInContext(source,context);
    let resultShown=false;
    context.window.NyanAnimation.animateSniff(board,0,dogIndex,0,status,()=>{resultShown=true;});
    assert.equal(status.textContent,'クンクン……');
    assert.equal(resultShown,false);
    assert.equal(sniff.removed,undefined);
    finishAnimation();
    await Promise.resolve();
    assert.equal(resultShown,true);
    assert.equal(sniff.removed,true);
    assert.equal(resultShown,true);
  });
}
