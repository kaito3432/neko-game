const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {checkText,checkLegalRelease}=require('../scripts/check-legal-release.cjs');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const pages=['privacy.html','terms.html','support.html','data-deletion.html'];

test('4つの独立した法務・サポートページが存在し、内部リンクが有効',()=>{
  for(const page of pages){
    const source=read(page);
    assert.match(source,/<html lang="ja">/);
    assert.match(source,/<meta name="viewport"/);
    assert.match(source,/<h1>[^<]+<\/h1>/);
    assert.match(source,/href="\.\/legal\.css"/);
    for(const href of source.matchAll(/href="\.\/([^"#]+)"/g))
      assert.ok(fs.existsSync(path.join(root,href[1])),`${page}: ${href[1]}`);
  }
});
test('Privacyは収集・購入・AdMob・Cloudflare・削除・保持・連絡先を説明',()=>{
  const text=read('privacy.html');
  for(const word of ['匿名プロフィール','Bearer credential','localStorage','AdMob','Cloudflare',
    'App Store','Google Play','クレジットカード番号','オンラインデータを削除','保持','mailto:nyanchase@gmail.com','User Messaging Platform'])
    assert.ok(text.includes(word),word);
});
test('Terms・Support・削除専用ページが購入復元と契約取消の境界を説明',()=>{
  for(const word of ['にゃんコイン','にゃんチェイスパス','Skill Mode','返金','データの削除'])
    assert.ok(read('terms.html').includes(word),word);
  for(const word of ['購入を復元','にゃんチェイスパス','広告','オンラインデータを削除','Bearer credential'])
    assert.ok(read('support.html').includes(word),word);
  const deletion=read('data-deletion.html');
  for(const word of ['設定','データとプライバシー','オンラインデータを削除','mailto:nyanchase@gmail.com',
    '購入識別情報','購読を解約せず','購入を復元','アンインストール'])
    assert.ok(deletion.includes(word),word);
});
test('設定画面の3リンクと認証済み削除導線は一元URL mapを使う',()=>{
  const html=read('index.html'),script=read('legal-pages.js');
  for(const page of ['privacy','terms','support'])
    assert.match(html,new RegExp(`data-legal-page="${page}"`));
  assert.match(html,/id="onlineDataDeleteOpen"/);
  assert.match(html,/src="\.\/legal-pages\.js\?v=5"/);
  for(const page of pages)assert.ok(script.includes(page));
  assert.match(script,/PUBLIC_BASE_URL=null/);
});
test('公開前チェックは未確定情報と未設定URLを検出する',()=>{
  assert.equal(checkText('sample','運営者：[運営者名]').length,1);
  assert.deepEqual(checkText('sample','公開準備完了'),[]);
  assert.ok(checkLegalRelease(root).some(issue=>issue.includes('公開URL未設定')));
  assert.ok(checkLegalRelease(root).some(issue=>issue.includes('APP_PRIVACY_DISCLOSURE.md')));
});
test('Service Workerの事前キャッシュに欠落ページを含めない',()=>{
  const source=read('service-worker.js');
  for(const page of pages)assert.ok(source.includes(`"./${page}"`));
  assert.match(source,/"\.\/legal-pages\.js"/);
  assert.match(source,/"\.\/legal\.css"/);
  const precache=source.match(/const PRECACHE = \[([\s\S]*?)\];/)[1];
  for(const match of precache.matchAll(/"\.\/([^"\n]+)"/g))
    assert.ok(fs.existsSync(path.join(root,match[1])),`missing ${match[1]}`);
  assert.match(source,/cache\.put\(cacheKey, copy\)/);
  assert.match(source,/caches\.match\(cacheKey\)/);
});
