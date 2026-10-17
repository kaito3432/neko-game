const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {prepare}=require('../scripts/prepare-web-assets.cjs');
const {validate}=require('../scripts/validate-generated-web.cjs');
test('Android Release removes the unused dev UI asset and rejects accidental reintroduction',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nyan-release-clean-'));
 try{
  fs.mkdirSync(path.join(root,'assets'));fs.writeFileSync(path.join(root,'index.html'),'<script src="./debug/board-theme-qa.js"></script>');
  fs.writeFileSync(path.join(root,'monetization-ui.js'),'// dev only');
  const {output}=prepare({root,release:true,platform:'android',env:{}});
  assert.equal(fs.existsSync(path.join(output,'monetization-ui.js')),false);
  validate(root,output,'android');
  fs.writeFileSync(path.join(output,'monetization-ui.js'),'// stale dev file');
  assert.throws(()=>validate(root,output,'android'),/Development UI asset/);
  prepare({root,release:true,platform:'ios',env:{NYAN_ADMOB_IOS_APP_ID:'ca-app-pub-6462457361541481~4217995844',NYAN_ADMOB_IOS_REWARDED_ID:'ca-app-pub-6462457361541481/4339169364',NYAN_AD_CHILD_DIRECTED:'false',NYAN_AD_UNDER_AGE:'false',NYAN_AD_MAX_RATING:'Teen'}});
  assert.equal(fs.existsSync(path.join(output,'monetization-ui.js')),true);
  validate(root,output,'ios');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('Release Service Worker never precaches a removed QA helper',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../service-worker.js'),'utf8');
 const cache=vm.runInNewContext(source+';PRECACHE',{self:{addEventListener(){}}});
 assert.equal(cache.some(file=>file.startsWith('./debug/')),false);
 for(const file of cache)assert(fs.existsSync(path.join(__dirname,'..',file)),file+' must exist');
});
