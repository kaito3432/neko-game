const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Catalog=require('../collection-catalog.js');

const root=path.resolve(__dirname,'..');
const ids=['bronze','silver','gold','platinum','diamond','master'];

test('正式6ランクフレームは1024px RGBA PNGとしてカタログへ登録される',()=>{
  for(const rank of ids){
    const item=Catalog.getItem('profileFrame',`rank_${rank}`);
    assert.ok(item);
    const file=path.resolve(root,item.frameImage);
    const png=fs.readFileSync(file);
    assert.equal(png.subarray(1,4).toString(),'PNG');
    assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1024,1024]);
    assert.equal(png[25],6,'PNG color type must be RGBA');
  }
});

test('PNG overlayはavatar前面・非clip・pointer無効でCSS fallbackを残す',()=>{
  const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
  const ui=fs.readFileSync(path.join(root,'online-profile-ui.js'),'utf8');
  assert.match(css,/\.ranked-frame-preview \.ranked-frame-image\{[^}]*position:absolute!important[^}]*z-index:2[^}]*inset:0!important[^}]*width:100%!important[^}]*height:100%!important[^}]*border-radius:0!important[^}]*clip-path:none!important[^}]*pointer-events:none/);
  assert.match(css,/\.ranked-frame-preview\{[^}]*overflow:visible!important[^}]*overflow-x:visible!important[^}]*overflow-y:visible!important/);
  assert.match(css,/\.ranked-frame-preview\.has-frame-image\{[^}]*border-radius:0!important[^}]*clip-path:none!important[^}]*-webkit-mask:none!important[^}]*contain:none!important[^}]*transform:none!important/);
  assert.match(css,/\.ranked-avatar-clip\{[^}]*overflow:hidden[^}]*border-radius:50%/);
  assert.match(css,/\.ranked-frame-preview\.has-frame-image \.ranked-avatar-clip\{inset:15\.8203125%\}/);
  assert.match(ui,/function ensureAvatarClip\(element\)/);
  assert.match(ui,/className='ranked-frame-image ranked-frame-overlay'/);
  assert.match(ui,/overlay\.onerror=.*has-frame-image/);
  assert.match(ui,/catalog\.getItem\('profileFrame',valid\)\?\.frameImage/);
});

test('オンライン選択画面はframe有無で顔の見かけサイズを揃えて大きく表示する',()=>{
  const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
  assert.match(css,/\.ranked-profile-main \.ranked-frame-preview\{[^}]*width:clamp\(100px,28vw,112px\)[^}]*height:clamp\(100px,28vw,112px\)[^}]*flex:0 0 clamp\(100px,28vw,112px\)/);
  assert.match(css,/\.ranked-profile-main \.ranked-frame-preview:not\(\.has-frame-image\) \.ranked-avatar-clip\{inset:calc\(\(100% - clamp\(72px,19vw,80px\)\)\/2\)\}/);
});
