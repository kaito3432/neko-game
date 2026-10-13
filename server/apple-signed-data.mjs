import {Buffer} from 'node:buffer';
import {X509Certificate} from 'node:crypto';
import {APPLE_ROOT_G3} from './apple-root-certificates.mjs';

const cache=new Map();
const PRODUCTS=new Set(['SKILL_CAT_FAKE_PAW','SKILL_POLICE_GROUP_SEARCH','SKILL_POLICE_DASH','SKILL_PACK_01','REMOVE_ADS','REMOVE_ADS_PLUS_SKILL_PACK_01']);
function transactionFields(value){
 if(!PRODUCTS.has(value.productId)||!/^[0-9]+$/.test(String(value.transactionId||''))||
    !/^[0-9]+$/.test(String(value.originalTransactionId||''))||
    !Number.isSafeInteger(value.signedDate)||!Number.isSafeInteger(value.purchaseDate)||
    value.purchaseDate<0||value.purchaseDate>value.signedDate||value.signedDate>Date.now()+300000||
    value.inAppOwnershipType!=='PURCHASED'||value.type!=='Non-Consumable'||
    (value.appAccountToken!==undefined&&!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value.appAccountToken))||
    (value.revocationDate!==undefined&&(!Number.isSafeInteger(value.revocationDate)||value.revocationDate<0))||
    (value.revocationReason!==undefined&&![0,1].includes(value.revocationReason)))
  throw new Error('invalid_store_product_or_transaction_fields');
 return value;
}
let library;
export async function appleVerifier(env,environment){
 // jsrsasign initializes random state; import it inside the Worker request,
 // not at global scope, where workerd correctly prohibits random generation.
 library||=import('@apple/app-store-server-library');
 const {SignedDataVerifier,Environment}=await library;
 if(![Environment.PRODUCTION,Environment.SANDBOX].includes(environment))throw new Error('unsupported_store_environment');
 const root=Buffer.from(APPLE_ROOT_G3,'base64'),certificate=new X509Certificate(root);
 if(certificate.fingerprint256.replaceAll(':','')!=='63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179'||
     !certificate.ca||!certificate.verify(certificate.publicKey))throw new Error('invalid_bundled_apple_root');
 const bundle=env.APPLE_BUNDLE_ID||'jp.nyanchase.game',appId=Number(env.APPLE_APP_ID||'6821995143');
 if(bundle!=='jp.nyanchase.game'||appId!==6821995143)throw new Error('invalid_apple_app_configuration');
 const key=environment;
 if(!cache.has(key))cache.set(key,new SignedDataVerifier([root],true,environment,bundle,appId));
 return cache.get(key);
}
export async function verifyAppleData(proof,{env={},kind='transaction',verifier}={}){
 // Untrusted decode is used ONLY to select one of two fixed verifiers. The
 // official verifier checks the signed environment again after chain validation.
 let payload,header;
 try{const parts=String(proof).split('.');if(parts.length!==3)throw Error();
  header=JSON.parse(Buffer.from(parts[0],'base64url'));payload=JSON.parse(Buffer.from(parts[1],'base64url'));
 }catch(_){throw new Error('invalid_apple_notification');}
 if(header.alg!=='ES256')throw new Error('invalid_apple_notification_algorithm');
 const environment=kind==='notification'?payload.data?.environment:payload.environment;
 if(!['Production','Sandbox'].includes(environment))throw new Error('unsupported_store_environment');
 if(env.NYAN_ENVIRONMENT==='sandbox'&&environment!=='Sandbox')throw new Error('store_environment_mismatch');
 const instance=verifier||await appleVerifier(env,environment);
 try{
  if(kind==='notification')return await instance.verifyAndDecodeNotification(proof);
  if(kind==='renewal')return await instance.verifyAndDecodeRenewalInfo(proof);
  return transactionFields(await instance.verifyAndDecodeTransaction(proof));
 }catch(error){
  if(error.message==='invalid_store_product_or_transaction_fields')throw error;
  if(error.status===2) // Apple VerificationStatus.RETRYABLE_VERIFICATION_FAILURE
   throw new Error('apple_certificate_verifier_unavailable');
  throw new Error('invalid_apple_notification_signature_or_claims',{cause:error});
 }
}
