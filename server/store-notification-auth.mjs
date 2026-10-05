const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+
  '='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
const json=value=>JSON.parse(new TextDecoder().decode(decode(value)));

// Pin trusted Apple notification keys through a secret. Multiple keys allow
// old/new overlap during rotation without changing the Worker bundle.
export async function verifyAppleSignedPayload(signedPayload,{env={},now=Date.now()}={}){
  if(!['sandbox','production'].includes(env.NYAN_ENVIRONMENT))
    throw new Error('apple_notification_environment_unavailable');
  const parts=String(signedPayload||'').split('.');
  if(parts.length!==3||parts.some(part=>!part))throw new Error('invalid_apple_notification');
  const header=json(parts[0]);
  if(header.alg!=='ES256')throw new Error('invalid_apple_notification_algorithm');
  let pins={};
  if(!env.APPLE_NOTIFICATION_PUBLIC_KEYS&&!env.APPLE_NOTIFICATION_PUBLIC_KEY_SPKI)
    throw new Error('apple_notification_verifier_unavailable');
  if(env.APPLE_NOTIFICATION_PUBLIC_KEYS){
    try{pins=JSON.parse(env.APPLE_NOTIFICATION_PUBLIC_KEYS);}catch(_){throw new Error('apple_notification_keys_invalid');}
    if(!pins||typeof pins!=='object'||Array.isArray(pins))
      throw new Error('apple_notification_keys_invalid');
  }
  let keyId=typeof header.kid==='string'?header.kid:null;
  if(!keyId&&Array.isArray(header.x5c)&&typeof header.x5c[0]==='string'){
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',
      Uint8Array.from(atob(header.x5c[0]),c=>c.charCodeAt(0))));
    keyId=[...digest].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  const pin=keyId?pins[keyId]:env.APPLE_NOTIFICATION_PUBLIC_KEY_SPKI;
  if(!pin||typeof pin!=='string')throw new Error('apple_notification_key_unknown');
  const key=await crypto.subtle.importKey('spki',decode(pin),
    {name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const valid=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,
    decode(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if(!valid)throw new Error('invalid_apple_notification_signature');
  const payload=json(parts[1]);
  if(typeof payload.notificationUUID!=='string'||payload.notificationUUID.length>100||
      !Number.isSafeInteger(payload.signedDate)||Math.abs(now-payload.signedDate)>7*86400000||
      payload.data?.bundleId!==(env.APPLE_BUNDLE_ID||'jp.nyanchase.game')||
      payload.data?.environment!==(env.NYAN_ENVIRONMENT==='production'?'Production':'Sandbox'))
    throw new Error('invalid_apple_notification_claims');
  return payload;
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
