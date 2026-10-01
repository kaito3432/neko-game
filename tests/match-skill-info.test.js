const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Catalog=require('../skill-catalog.js');
const SkillInfo=require('../match-skill-info.js');

const descriptions={
  sneak:{image:'sneak.png',desc:'足跡を残さず移動',visual:'<div>忍び足の図</div>',detail:'移動前に使用します。<ul><li>1ゲームに1回</li></ul>'},
  fakepaw:{image:'fake.png',desc:'ニセの足跡',detail:'別の箱に設置します。'},
  howl:{image:'howl.png',desc:'ネコの気配を探知',detail:'探索前に使用します。'},
  dash:{image:'dash.png',desc:'一気に2マス移動',detail:'1ゲームに1回。'},
  search:{image:'search.png',desc:'2箱を探索',detail:'周囲の箱を選びます。'}
};
class Element{
  constructor(){this.children=[];this.listeners=new Map();this.hidden=false;this.attributes={};this.classList={toggle:()=>{}};}
  append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
  setAttribute(name,value){this.attributes[name]=value;}
  addEventListener(type,listener){const list=this.listeners.get(type)||[];list.push(listener);this.listeners.set(type,list);}
  fire(type,properties={}){
    const event={type,target:this,clientX:0,clientY:0,button:0,stopped:false,prevented:false,
      stopPropagation(){this.stopped=true;},preventDefault(){this.prevented=true;},...properties};
    for(const listener of this.listeners.get(type)||[])listener(event);
    return event;
  }
  focus(){this.focused=true;}
}
function fixture(){
  const document={body:new Element(),listeners:new Map(),createElement:()=>new Element(),
    addEventListener(type,fn){this.listeners.set(type,fn);}};
  const container=new Element(),parent=new Element();parent.append(container);
  const view=SkillInfo.mount({document,container,catalog:Catalog,getDescriptions:()=>descriptions});
  return {document,container,view};
}
const state=(cat,police)=>({abilitiesEnabled:true,selectedAbilities:{cat,police}});

test('自分と相手は試合確定スキルから役割別に解決し、未所持でも説明できる',()=>{
  const {container,view}=fixture();
  view.render({playMode:'onlineCat',game:state('fakePaw','howl')});
  assert.equal(container.hidden,false);
  assert.deepEqual(view.slots.map(slot=>slot.side.textContent),['自分','相手']);
  assert.deepEqual(view.slots.map(slot=>slot.icon.src),['fake.png','howl.png']);
  assert.match(view.slots[1].button.attributes['aria-label'],/相手の使用中スキル/);
  assert.equal(SkillInfo.resolveSkill('police','howl',Catalog,descriptions).name,'遠吠え');
  assert.equal(SkillInfo.resolveSkill('cat','unknown',Catalog,descriptions),null);
});

test('タップで遊び方と同じ詳細を直接表示し、外側と×と再タップで閉じる',()=>{
  const {view}=fixture();view.render({playMode:'onlinePolice',game:state('sneak','dash')});
  const self=view.slots[0].button,opponent=view.slots[1].button;
  self.fire('pointerdown');self.fire('pointerup');const tap=self.fire('click');
  assert.equal(tap.stopped,true);assert.equal(tap.prevented,true);
  assert.equal(view.layer.hidden,false);
  const panel=view.layer.children[0],heading=panel.children[1],summary=panel.children[2],visual=panel.children[3],detail=panel.children[4];
  assert.equal(heading.children[1].children[0].textContent,'ダッシュ');
  assert.equal(summary.textContent,'一気に2マス移動');assert.equal(detail.hidden,false);
  assert.equal(detail.innerHTML,descriptions.dash.detail);
  self.fire('click');assert.equal(view.layer.hidden,true);
  self.fire('click');assert.equal(view.layer.hidden,false);
  panel.children[0].fire('click');assert.equal(view.layer.hidden,true);
  opponent.fire('click');
  assert.equal(view.layer.hidden,false);assert.equal(detail.hidden,false);
  assert.equal(detail.innerHTML,descriptions.sneak.detail);
  assert.equal(visual.innerHTML,descriptions.sneak.visual);
  const outside=view.layer.fire('click');assert.equal(outside.stopped,true);assert.equal(view.layer.hidden,true);
});

test('long press用timerがなく、iconとpopup操作を盤面へ伝播させない',()=>{
  const {view}=fixture();view.render({playMode:'onlineCat',game:state('sneak','howl')});
  const button=view.slots[0].button;
  assert.equal(button.fire('pointerdown').stopped,true);
  assert.equal(button.fire('pointerup').stopped,true);
  assert.equal(view.layer.hidden,true);
  assert.equal(button.fire('click').stopped,true);
  assert.equal(view.layer.hidden,false);assert.equal(view.layer.children[0].children[4].hidden,false);
  assert.equal(view.layer.fire('pointerdown').stopped,true);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'../match-skill-info.js'),'utf8'),/longPressMs|setTimeout|pointermove/);
});

test('recovery後の確定スキルへ更新し、通常戦・CPU・ローカルも同じrendererを使う',()=>{
  const {container,view}=fixture();
  view.render({playMode:'onlineCat',game:state('sneak','howl')});
  view.render({playMode:'onlinePolice',game:state('fakePaw','doubleSearch')});
  assert.deepEqual(view.slots.map(slot=>slot.icon.src),['search.png','fake.png']);
  view.render({playMode:'cpuPolice',game:state('sneak','dash')});
  assert.deepEqual(view.slots.map(slot=>slot.side.textContent),['自分','相手']);
  view.render({playMode:'local',game:state('sneak','dash')});
  assert.deepEqual(view.slots.map(slot=>slot.side.textContent),['ネコ','警察']);
  view.render({playMode:'onlineCat',game:{abilitiesEnabled:false,selectedAbilities:{cat:'sneak',police:'howl'}}});
  assert.equal(container.hidden,true);
});

test('オンラインはサーバー確定値とrecovery snapshotを参照し、UIはゲームstateを変更しない',()=>{
  const game=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(game,/selectedAbilities:d\.abilities/);
  assert.match(game,/matchSkillInfo\?\.render\(\{playMode,game,active:battleBgmActive\}\)/);
  assert.match(html,/match-skill-info\.js\?v=2/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'../match-skill-info.js'),'utf8'),/canEquipSkill|isSkillOwned|sendGame|fetch\(/);
});
test('Desktopだけ2カラムでviewportに収め、mobile既存レイアウトは維持',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');
  assert.match(css,/@media\(min-width:700px\) and \(min-height:700px\)\{/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/max-height:calc\(100dvh - 28px\)/);
  assert.match(css,/\.match-skill-button:hover/);
});
