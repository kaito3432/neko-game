const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const game=fs.readFileSync(require.resolve('../game.js'),'utf8');
const css=fs.readFileSync(require.resolve('../style.css'),'utf8');

test('VS replay resets animation synchronously on every opening, including rematches',()=>{
  const source=game.match(/function showAbilityReveal\(\)\{[\s\S]*?\n\}/)[0];
  const classes=new Set(['vs-animate']),events=[];
  const overlay={classList:{remove(c){events.push(`remove:${c}`);classes.delete(c);},add(c){events.push(`add:${c}`);classes.add(c);}},
    get offsetWidth(){events.push('layout');assert.ok(classes.has('show'));assert.ok(!classes.has('vs-animate'));return 400;}};
  const context=vm.createContext({abilityRevealOverlay:overlay});
  vm.runInContext(source,context);
  for(let i=0;i<3;i++){
    classes.delete('show');events.length=0;
    vm.runInContext('showAbilityReveal()',context);
    assert.deepEqual(events,['remove:vs-animate','add:show','layout','add:vs-animate']);
  }
  assert.equal((game.match(/showAbilityReveal\(\);/g)||[]).length,2);
});

test('VS content stays visible without animation and iPad reserves two-digit turn width',()=>{
  assert.match(css,/#abilityRevealOverlay \.cat-side,[\s\S]*?#abilityRevealOverlay \.ability-vs-start-btn\{\s*opacity:1;\s*transform:none/);
  assert.match(css,/@media \(orientation:portrait\) and \(min-width:700px\)\{[^}]*\}[\s\S]*?\.app > \.game-topbar\{grid-template-columns:132px minmax\(0,1fr\)\}/);
});
