'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
function productionConfig(env){
  const result={testing:false,rewardedAdUnitIds:{},appIds:{}};
  for(const platform of ['ios','android']){
    const key=platform.toUpperCase();
    for(const [field,suffix,separator] of [['appIds','APP_ID','~'],['rewardedAdUnitIds','REWARDED_ID','/']]){
      const value=env[`NYAN_ADMOB_${key}_${suffix}`];
      if(!new RegExp(`^ca-app-pub-[0-9]{16}\\${separator}[0-9]{10}$`).test(value||'')||value.includes('3940256099942544'))throw new Error(`Missing/non-production NYAN_ADMOB_${key}_${suffix}`);
      result[field][platform]=value;
    }
  }
  if(env.NYAN_AD_NPA&&env.NYAN_AD_NPA!=='true')throw new Error('Release requires non-personalized ads');
  result.npa=true;
  for(const [field,key] of [['tagForChildDirectedTreatment','NYAN_AD_CHILD_DIRECTED'],['tagForUnderAgeOfConsent','NYAN_AD_UNDER_AGE']]){
    if(!['true','false'].includes(env[key]))throw new Error(`Human policy decision required: ${key}`);
    result[field]=env[key]==='true';
  }
  if(!['General','ParentalGuidance','Teen','MatureAudience'].includes(env.NYAN_AD_MAX_RATING))throw new Error('Human policy decision required: NYAN_AD_MAX_RATING');
  result.maxAdContentRating=env.NYAN_AD_MAX_RATING;
  return result;
}
function prepare({root=ROOT,release=false,env=process.env}={}){
  // Validate before writing anything. No fabricated production identifiers.
  const config=release?productionConfig(env):null;
  const output=path.join(root,'www');fs.mkdirSync(output,{recursive:true});
  for(const file of fs.readdirSync(root))if(/\.(html|css|js|webmanifest)$/.test(file)&&file!=='api-environment.sandbox.js')fs.copyFileSync(path.join(root,file),path.join(output,file));
  fs.cpSync(path.join(root,'assets'),path.join(output,'assets'),{recursive:true});
  // Existing opt-in browser QA helpers are not part of a Release bundle.
  if(!release)fs.cpSync(path.join(root,'debug'),path.join(output,'debug'),{recursive:true});
  if(release){
    fs.rmSync(path.join(output,'debug'),{recursive:true,force:true});
    const html=releaseHtml(fs.readFileSync(path.join(output,'index.html'),'utf8'));
    fs.writeFileSync(path.join(output,'index.html'),html);
    fs.writeFileSync(path.join(output,'ad-config.js'),`globalThis.NYAN_AD_CONFIG=Object.freeze(${JSON.stringify(config)});\n`);
  }
  const files=require('./validate-generated-web.cjs').sourceFiles(root);
  const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  fs.writeFileSync(path.join(output,'web-source-manifest.json'),JSON.stringify({production:release,
    files:Object.fromEntries(files.map(file=>[file,{source:digest(path.join(root,file)),bundled:digest(path.join(output,file))}]))}));
  return {output,config};
}
function releaseHtml(html){return html.replace(/<script src="\.\/debug\/[^"\n]+"><\/script>\s*/g,'')
  .replace(/<script src="\.\/monetization-ui\.js[^"\n]*"><\/script>\s*/g,'')
  .replace(/<section class="monetization-dev"[\s\S]*?<\/section>/,'');}
if(require.main===module){try{const result=prepare({release:process.argv.includes('--release')});console.log(`Web assets ready: ${result.output}`);}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={productionConfig,prepare,releaseHtml};
