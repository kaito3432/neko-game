// Generated test-only certificate authority. Never imported by Worker code.
const {createRequire}=require('node:module'),crypto=require('node:crypto');
const requireServer=createRequire(require('node:path').resolve(__dirname,'../server/package.json'));
const {KJUR}=requireServer('jsrsasign');
const {SignedDataVerifier}=requireServer('@apple/app-store-server-library');
const keys=()=>crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1',
 publicKeyEncoding:{format:'pem',type:'spki'},privateKeyEncoding:{format:'pem',type:'pkcs8'}});
function cert(subject,issuer,pub,sign,ca,oid,expired=false,ocspUrl){
 return KJUR.asn1.x509.X509Util.newCertPEM({serial:{int:Math.floor(Math.random()*1000000)+1},
 sigalg:'SHA256withECDSA',issuer:{str:'/CN='+issuer},subject:{str:'/CN='+subject},
 notbefore:'20200101000000Z',notafter:expired?'20200102000000Z':'20400101000000Z',
 sbjpubkey:pub,cakey:sign,ext:[{extname:'basicConstraints',cA:ca,critical:true},
 {extname:'keyUsage',names:ca?['keyCertSign','cRLSign']:['digitalSignature']},
 ...(oid?[{extname:oid,extn:'0500'}]:[]),
 ...(ocspUrl?[{extname:'authorityInfoAccess',array:[{ocsp:ocspUrl}]}]:[])]});
}
function fixture({environment='Production',expired=false,leafOid=true,intermediateOid=true,ocspUrl,online=false}={}){
 const rootKeys=keys(),interKeys=keys(),leafKeys=keys();
 const root=cert('Test Root','Test Root',rootKeys.publicKey,rootKeys.privateKey,true),
 intermediate=cert('Test Intermediate','Test Root',interKeys.publicKey,rootKeys.privateKey,true,intermediateOid?'1.2.840.113635.100.6.2.1':null,false,ocspUrl),
 leaf=cert('Test Leaf','Test Intermediate',leafKeys.publicKey,interKeys.privateKey,false,leafOid?'1.2.840.113635.100.6.11.1':null,expired,ocspUrl);
 const raw=certificate=>new crypto.X509Certificate(certificate).raw;
 const x5c=[leaf,intermediate,root].map(c=>raw(c).toString('base64'));
 const sign=(payload,header={})=>{const input=[{alg:'ES256',x5c,...header},payload].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
 return input+'.'+crypto.sign('sha256',Buffer.from(input),{key:leafKeys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');};
 const verifier=new SignedDataVerifier([raw(root)],online,environment,'jp.nyanchase.game',6821995143);
 const now=Date.now(),claim={transactionId:'1001',originalTransactionId:'1001',productId:'SKILL_PACK_01',
 bundleId:'jp.nyanchase.game',environment,purchaseDate:now,signedDate:now,inAppOwnershipType:'PURCHASED',
 appAccountToken:'11111111-1111-4111-8111-111111111111',type:'Non-Consumable',quantity:1};
 return {sign,claim,verifier,root:raw(root),x5c,now};
}
module.exports={fixture,SignedDataVerifier};
