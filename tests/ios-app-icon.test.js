const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('iOS AppIcon uses the approved opaque 1024px icon, not the Capacitor placeholder',()=>{
  const root=path.resolve(__dirname,'..');
  const dir=path.join(root,'ios/App/App/Assets.xcassets/AppIcon.appiconset');
  const catalog=JSON.parse(fs.readFileSync(path.join(dir,'Contents.json'),'utf8'));
  assert.equal(catalog.images.length,1);
  const icon=catalog.images[0];
  assert.equal(icon.filename,'nyan-chase-appicon-1024.png');
  assert.equal(icon.size,'1024x1024');
  assert.equal(icon.platform,'ios');
  const png=fs.readFileSync(path.join(dir,icon.filename));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),1024);
  assert.equal(png.readUInt32BE(20),1024);
  assert.ok([0,2].includes(png[25]),'icon must be opaque grayscale or RGB, with no alpha channel');
  assert.ok(!png.equals(fs.readFileSync(path.join(dir,'AppIcon-512@2x.png'))));
  const project=fs.readFileSync(path.join(root,'ios/App/App.xcodeproj/project.pbxproj'),'utf8');
  assert.equal((project.match(/ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;/g)||[]).length,2);
});
