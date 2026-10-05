import {decodeStoreKitJws,verifyApplePurchaseLifecycle} from './storekit-verification.mjs';
import {verifyApplePassStatus} from './pass-storekit.mjs';
import {verifyGooglePurchaseLifecycle,listGoogleVoidedPurchases} from './google-play-verification.mjs';
import {verifyGooglePassLifecycle} from './pass-google-play.mjs';
import {reconcileVerifiedPurchase} from './purchase-lifecycle.mjs';

const enc=value=>new TextEncoder().encode(value);
const hash=async token=>{const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',enc(token)));
  let value='';for(const byte of bytes)value+=String.fromCharCode(byte);
  return btoa(value).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');};
const hex=async token=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',enc(token)))]
  .map(byte=>byte.toString(16).padStart(2,'0')).join('');
const dedupeKey=(store,id)=>`store-notification:${store}:${id}`;
async function once(storage,store,id,process,now){
  const key=dedupeKey(store,id),prior=await storage.get(key);
  if(prior?.processedAt)return {duplicate:true};
  const result=await process();
  await storage.put(key,{processedAt:now,expiresAt:now+30*86400000});
  return result;
}
export async function cleanupNotificationDedupe(storage,now=Date.now()){
  const keys=[];
  for(const [key,value] of await storage.list({prefix:'store-notification:'}))
    if(Number.isSafeInteger(value?.expiresAt)&&value.expiresAt<=now)keys.push(key);
  for(const key of keys)await storage.delete(key);
  return keys.length;
}

export async function processAppleNotification({storage,payload,env={},now=Date.now(),
  verifyOneTime=verifyApplePurchaseLifecycle,verifyPass=verifyApplePassStatus}={}){
  const type=payload?.notificationType,id=payload?.notificationUUID;
  if(!['REFUND','REFUND_REVERSED','EXPIRED','DID_RENEW','DID_FAIL_TO_RENEW',
    'DID_CHANGE_RENEWAL_STATUS','REVOKE'].includes(type)||typeof id!=='string')
    throw new Error('unsupported_apple_notification');
  const signed=payload.data?.signedTransactionInfo;
  const claim=decodeStoreKitJws(signed);
  const environment=payload.data?.environment;
  if(!/^[0-9]+$/.test(String(claim.transactionId))||
      !/^[0-9]+$/.test(String(claim.originalTransactionId||claim.transactionId))||
      !['Sandbox','Production'].includes(environment))throw new Error('invalid_apple_notification_identity');
  return once(storage,'apple',id,async()=>{
    const oneTimeKey=`storekit:${claim.transactionId}`;
    const passKey=`pass-original:${environment.toLowerCase()}:${claim.originalTransactionId||claim.transactionId}`;
    const markerKey=await storage.get(oneTimeKey)?oneTimeKey:passKey;
    if(!await storage.get(markerKey))return {ignored:true,reason:'unknown_purchase'};
    const verify=markerKey===oneTimeKey?async()=>{
      const state=await verifyOneTime(String(claim.transactionId),environment,{env,now});
      return {...state,allowReactivation:type==='REFUND_REVERSED'&&state.status==='active'};
    }:async()=>{
      const receipt=await verifyPass({originalTransactionId:String(claim.originalTransactionId||claim.transactionId),env,now});
      return {status:receipt.revoked?'revoked':receipt.expiresAt<=now?'expired':'active',
        productId:receipt.productId,verifiedAt:now,revokedAt:receipt.revokedAt,
        reason:receipt.revokeReason,allowReactivation:type==='REFUND_REVERSED'&&!receipt.revoked,
        period:{id:receipt.periodId,startsAt:receipt.startsAt,expiresAt:receipt.expiresAt},
        autoRenewing:receipt.autoRenewing};
    };
    return reconcileVerifiedPurchase({storage,markerKey,verify,now});
  },now);
}

const parseData=message=>{
  const encoded=message?.data;
  if(typeof encoded!=='string'||encoded.length>10000)throw new Error('invalid_rtdn_data');
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))));
};
export async function processGoogleNotification({storage,message,env={},now=Date.now(),
  verifyOneTime=verifyGooglePurchaseLifecycle,verifyPass=verifyGooglePassLifecycle,
  listVoided=listGoogleVoidedPurchases}={}){
  if(typeof message?.messageId!=='string'||message.messageId.length>200)
    throw new Error('invalid_pubsub_message');
  const data=parseData(message);
  if(data.packageName!==(env.GOOGLE_PLAY_PACKAGE_NAME||'jp.nyanchase.game'))
    throw new Error('rtdn_package_mismatch');
  return once(storage,'google',message.messageId,async()=>{
    const sub=data.subscriptionNotification,one=data.oneTimeProductNotification,
      voided=data.voidedPurchaseNotification;
    const token=sub?.purchaseToken||one?.purchaseToken||voided?.purchaseToken;
    if(typeof token!=='string'||token.length<8)return {ignored:true};
    const key=sub?`pass-google-token:${await hex(token)}`:
      `googleplay:${await hash(token)}`;
    const marker=await storage.get(key);
    if(!marker)return {ignored:true,reason:'unknown_purchase'};
    const verify=async()=>{
      if(sub){
        const state=await verifyPass({purchaseToken:token,env,now});
        if(Number(sub.notificationType)===12){
          const rows=await listVoided({env,now,type:1});
          if(rows.some(row=>row.purchaseToken===token&&row.orderId===state.orderId))
            return {...state,status:'revoked',reason:'google_subscription_voided'};
        }
        return {...state,allowReactivation:state.status==='active'&&
          [1,2,7].includes(Number(sub.notificationType))};
      }
      const state=await verifyOneTime({purchaseToken:token,productId:marker.productId},{env,now});
      if(voided){
        const rows=await listVoided({env,now,type:0});
        if(rows.some(row=>row.purchaseToken===token&&
            (!marker.orderId||row.orderId===marker.orderId)))
          return {...state,status:'revoked',reason:'google_purchase_voided'};
      }
      return state;
    };
    return reconcileVerifiedPurchase({storage,markerKey:key,verify,now});
  },now);
}

// Invoke from a scheduled Worker event or an authenticated operational trigger.
// The cursor window overlaps to tolerate delayed ingestion; marker updates are idempotent.
export async function scanGoogleVoidedPurchases({storage,env={},now=Date.now(),
  listVoided=listGoogleVoidedPurchases,verifyOneTime=verifyGooglePurchaseLifecycle,
  verifyPass=verifyGooglePassLifecycle}={}){
  const cursor=await storage.get('store-voided-scan:cursor');
  const startTime=Number.isSafeInteger(cursor)?Math.max(now-30*86400000,cursor-3600000):now-86400000;
  const rows=await listVoided({env,now,startTime,type:0});
  let matched=0;
  for(const row of rows){
    if(!row?.purchaseToken||row.voidedQuantity)continue; // Multi-quantity partial refunds are not sold.
    const key=`googleplay:${await hash(row.purchaseToken)}`,marker=await storage.get(key);
    if(!marker||marker.orderId&&row.orderId!==marker.orderId)continue;
    await reconcileVerifiedPurchase({storage,markerKey:key,now,verify:async()=>{
      const state=await verifyOneTime({purchaseToken:row.purchaseToken,productId:marker.productId},{env,now});
      return {...state,status:'revoked',reason:`google_voided_${row.voidedReason??'unknown'}`};
    }});
    matched++;
  }
  const subscriptions=await listVoided({env,now,startTime,type:1});
  for(const row of subscriptions){
    if(!row?.purchaseToken||row.voidedQuantity)continue;
    const key=`pass-google-token:${await hex(row.purchaseToken)}`,marker=await storage.get(key);
    if(!marker)continue;
    await reconcileVerifiedPurchase({storage,markerKey:key,now,verify:async()=>{
      const state=await verifyPass({purchaseToken:row.purchaseToken,env,now});
      if(!row.orderId||row.orderId!==state.orderId)return state;
      return {...state,status:'revoked',reason:`google_subscription_voided_${row.voidedReason??'unknown'}`};
    }});
    matched++;
  }
  await storage.put('store-voided-scan:cursor',now);
  return {scanned:rows.length+subscriptions.length,matched};
}
