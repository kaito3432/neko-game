'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function sourceFiles(root){
 const files=fs.readdirSync(root).filter(file=>/\.(html|css|js|webmanifest)$/.test(file)&&!['ad-config.js','api-environment.sandbox.js'].includes(file));
 const walk=dir=>{if(!fs.existsSync(path.join(root,dir)))return;
  for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
   const name=path.posix.join(dir,entry.name);
   if(entry.isDirectory())walk(name);else if(entry.isFile())files.push(name);
  }};
 walk('assets');return files.sort();
}
function validate(root,assets,platform){
 if(fs.existsSync(path.join(assets,'debug')))throw new Error('QA directory in Release assets');
 const manifest=JSON.parse(fs.readFileSync(path.join(assets,'web-source-manifest.json'),'utf8'));
 if(manifest.production!==true)throw new Error('Release assets were not prepared in production mode');
 const platforms=platform?[platform]:(manifest.platforms||['ios','android']);
 const text=fs.readFileSync(path.join(assets,'ad-config.js'),'utf8');
 if(text.includes('3940256099942544'))throw new Error('Google test ID in Release assets');
 const match=text.match(/Object\.freeze\((\{.*\})\);/s),config=match&&JSON.parse(match[1]);
 if(!config||config.testing!==false||config.npa!==true)throw new Error('Invalid Release ad configuration');
 for(const os of platforms){
  if(!['ios','android'].includes(os)||!manifest.platforms?.includes(os))throw new Error(`Release assets not prepared for ${os}`);
  if(!/^ca-app-pub-\d{16}~\d{10}$/.test(config.appIds?.[os]||'')||!/^ca-app-pub-\d{16}\/\d{10}$/.test(config.rewardedAdUnitIds?.[os]||''))throw new Error(`Missing production ad IDs for ${os}`);
 }
 const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 for(const [file,hash] of Object.entries(manifest.files))if(digest(path.join(root,file))!==hash.source||digest(path.join(assets,file))!==hash.bundled)throw new Error(`Stale or modified Web asset: ${file}`);
 const actual=sourceFiles(root);
 if(actual.some(file=>!manifest.files[file]))throw new Error('New source asset missing from manifest');
 const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
 if(/monetizationDevPanel|\.\/debug\//.test(html))throw new Error('QA surface in Release HTML');
}
if(require.main===module){try{validate(path.resolve(__dirname,'..'),path.resolve(process.argv[2]),process.argv[3]);console.log('Release Web assets: PASS');}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={validate,sourceFiles};
