const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../purchase-provider.js'),'utf8');
function select(platform){const context={Capacitor:{getPlatform:()=>platform},NyanStoreKit:{PRODUCT_IDS:[],nativePlugin(){},provider:{kind:'ios'}},NyanGooglePlay:{PRODUCT_IDS:[],nativePlugin(){},provider:{kind:'android'}},Object};vm.createContext(context);vm.runInContext(source,context);return context.NyanPurchases;}
test('iOSはStoreKit、AndroidはGoogle Play、Webは安全なStoreKit非対応provider',()=>{assert.equal(select('ios').provider.kind,'ios');assert.equal(select('android').provider.kind,'android');assert.equal(select('web').provider.kind,'ios');});
