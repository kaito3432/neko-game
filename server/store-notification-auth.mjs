import {verifyAppleData} from './apple-signed-data.mjs';
export async function verifyAppleSignedPayload(signedPayload,{env={},now=Date.now(),verifier}={}){
  if(!['sandbox','production'].includes(env.NYAN_ENVIRONMENT))
    throw new Error('apple_notification_environment_unavailable');
  const payload=await verifyAppleData(signedPayload,{env,kind:'notification',verifier});
  if(typeof payload.notificationUUID!=='string'||!payload.notificationUUID.length||payload.notificationUUID.length>100||
      typeof payload.notificationType!=='string'||
      !Number.isSafeInteger(payload.signedDate)||Math.abs(now-payload.signedDate)>7*86400000||
      payload.data?.bundleId!==(env.APPLE_BUNDLE_ID||'jp.nyanchase.game')||
      (payload.data?.environment==='Production'&&
        payload.data?.appAppleId!==Number(env.APPLE_APP_ID||'6821995143'))||
      !(payload.data?.environment===(env.NYAN_ENVIRONMENT==='production'?'Production':'Sandbox')||
        env.NYAN_ENVIRONMENT==='production'&&payload.data?.environment==='Sandbox'))
    throw new Error('invalid_apple_notification_claims');
  if(payload.data.signedTransactionInfo){
    const transaction=await verifyAppleData(payload.data.signedTransactionInfo,{env,verifier});
    if(transaction.environment!==payload.data.environment)throw new Error('store_environment_mismatch');
  }
  if(payload.data.signedRenewalInfo){
    const renewal=await verifyAppleData(payload.data.signedRenewalInfo,{env,kind:'renewal',verifier});
    if(renewal.environment!==payload.data.environment)throw new Error('store_environment_mismatch');
  }
  return payload;
}

// Transactions and notifications share Apple's certificate-chain verifier.
export async function verifyAppleJwsSignature(signedPayload,options={}){
  return verifyAppleData(signedPayload,options);
}

// Google's tokeninfo endpoint validates the OIDC token signature. Its signed
// claims must match the configured Pub/Sub push service account and audience.
export async function verifyPubSubPush(request,{env={},fetchFn=fetch,now=Date.now()}={}){
  const account=env.GOOGLE_PUBSUB_PUSH_EMAIL,audience=env.GOOGLE_PUBSUB_PUSH_AUDIENCE;
  if(!account||!audience)throw new Error('pubsub_verifier_unavailable');
  const auth=request.headers.get('authorization')||'';
  if(!/^Bearer [A-Za-z0-9._-]+$/.test(auth))throw new Error('pubsub_unauthorized');
  const token=auth.slice(7),response=await fetchFn(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
  if(!response.ok)throw new Error('pubsub_token_invalid');
  const claims=await response.json();
  if(claims.aud!==audience||claims.email!==account||claims.email_verified!=='true'&&
      claims.email_verified!==true||!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||
      !Number.isFinite(Number(claims.exp))||Number(claims.exp)*1000<=now)
    throw new Error('pubsub_claims_invalid');
  return claims;
}
