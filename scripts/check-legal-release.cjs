/* Run before public hosting or store URL submission. A nonzero exit blocks release. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const PAGES=['privacy.html','terms.html','support.html','data-deletion.html'];
const PLACEHOLDER=/\[(運営者名|お問い合わせメール|公開URL|所在国|施行日)\]/g;

function checkText(file,source){
  return [...source.matchAll(PLACEHOLDER)].map(match=>`${file}: 未確定 [${match[1]}]`);
}
function checkLegalRelease(root=ROOT){
  const issues=[];
  for(const file of PAGES){
    const target=path.join(root,file);
    if(!fs.existsSync(target)){issues.push(`${file}: ファイルなし`);continue;}
    issues.push(...checkText(file,fs.readFileSync(target,'utf8')));
  }
  const disclosure='APP_PRIVACY_DISCLOSURE.md';
  const disclosurePath=path.join(root,disclosure);
  if(!fs.existsSync(disclosurePath))issues.push(`${disclosure}: ファイルなし`);
  else{
    const source=fs.readFileSync(disclosurePath,'utf8');
    issues.push(...checkText(disclosure,source));
    for(const match of source.matchAll(/TODO/g))issues.push(`${disclosure}: 未確定 TODO`);
    for(const section of ['App Store App Privacy','Google Play Data safety','削除・復元・保持'])
      if(!source.includes(section))issues.push(`${disclosure}: ${section} がありません`);
  }
  const config=path.join(root,'legal-pages.js');
  if(!fs.existsSync(config))issues.push('legal-pages.js: ファイルなし');
  else{
    const source=fs.readFileSync(config,'utf8');
    const value=source.match(/const PUBLIC_BASE_URL\s*=\s*(null|"[^"]+"|'[^']+');/);
    if(!value||value[1]==='null')issues.push('legal-pages.js: 公開URL未設定');
    else{
      const url=value[1].slice(1,-1);
      try{if(new URL(url).protocol!=='https:')issues.push('legal-pages.js: 公開URLはHTTPS必須');}
      catch(_){issues.push('legal-pages.js: 公開URLが不正');}
    }
  }
  return issues;
}
if(require.main===module){
  const issues=checkLegalRelease();
  if(issues.length){console.error(`公開前チェック: FAIL (${issues.length}件)`);for(const issue of issues)console.error(`- ${issue}`);process.exitCode=1;}
  else console.log('公開前チェック: PASS');
}
module.exports={checkText,checkLegalRelease};
