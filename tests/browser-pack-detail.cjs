// Isolated local UI smoke. Prices are test fixtures, never shipped or sent to StoreKit.
const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const stub=`window.NyanPurchases={...window.NyanPurchases,nativePlugin:()=>({}),provider:{loadProducts:async()=>({products:['SKILL_CAT_FAKE_PAW','SKILL_POLICE_GROUP_SEARCH','SKILL_POLICE_DASH','SKILL_PACK_01'].map((productId,i)=>({productId,priceNumber:i===3?380:160,displayPrice:i===3?'¥380':'¥160',currencyCode:'JPY'}))}),purchaseProduct:async()=>{throw Error('Purchase must not run')}}};`;
const server=http.createServer((request,response)=>{
  try{
    const name=new URL(request.url,'http://localhost').pathname.slice(1)||'index.html';
    if(name.includes('..'))throw Error('invalid path');
    let data=fs.readFileSync(path.join(root,name));
    if(name==='storekit-ui.js')data=Buffer.from(stub+data.toString());
    response.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(name)]||'application/octet-stream');
    response.end(data);
  }catch{response.statusCode=404;response.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try{
    for(const [width,height] of [[320,568],[390,844],[834,1194]]){
      const page=await browser.newPage({viewport:{width,height}}),errors=[];
      const origin=`http://127.0.0.1:${server.address().port}`;
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
      await page.goto(origin);await page.locator('#shopOpenBtn').click();
      assert.doesNotMatch(await page.locator('#shopPackProducts').textContent(),/個購入済み|残り\d個/);
      assert.equal(await page.locator('#shopPackProducts button').count(),1);
      assert.equal(await page.locator('#shopPackProducts [data-purchase-product]').count(),0);
      assert.equal(await page.locator('.shop-pack-price-amount').textContent(),'¥380');
      assert.equal(await page.locator('.shop-pack-price-label').evaluate(el=>el.tagName),'DIV');
      assert.match(await page.locator('.shop-pack-saving-badge').textContent(),/100.*お得/);
      await page.locator('.shop-pack-price-amount').click();
      assert.equal(await page.locator('#shopSkillPreview.show').count(),0);
      await page.screenshot({path:`/tmp/nyan-pack-card-${width}.png`});
      await page.locator('.shop-pack-detail-button').click();
      assert.deepEqual(await page.locator('.shop-pack-skill strong').allTextContents(),['フェイク肉球','ダッシュ','一斉捜索']);
      assert.match(await page.locator('.shop-pack-savings').textContent(),/100.*お得/);
      assert.equal(await page.locator('#shopPreviewPrice').textContent(),'¥380');
      assert.equal(await page.locator('#shopPreviewImage').isVisible(),false);
      assert.equal(await page.locator('#shopSkillPreview').evaluate(el=>el.scrollWidth<=innerWidth),true);
      const rows=await page.locator('.shop-pack-skill').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {y:r.y,width:r.width};}));
      const containerWidth=await page.locator('#shopPreviewVisual').evaluate(el=>el.getBoundingClientRect().width);
      assert.ok(rows.every(row=>row.width>containerWidth*.8));assert.ok(rows[0].y<rows[1].y&&rows[1].y<rows[2].y);
      await page.screenshot({path:`/tmp/nyan-pack-detail-${width}.png`});
      await page.locator('#shopPreviewClose').click();
      await page.locator('.shop-skill-item').filter({hasText:'フェイク肉球'}).click();
      assert.equal(await page.locator('#shopPreviewImage').isVisible(),true);
      await page.locator('#shopPreviewPackLink').click();assert.equal(await page.locator('.shop-pack-skill').count(),3);
      assert.deepEqual(errors,[]);console.log(`PASS ${width}x${height}: details, vertical layout, prices, links, count removed`);
      await page.close();
    }
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
