import {checkProfileDeletionActivity,deleteOnlineProfile} from './profile-deletion.mjs';
import {retainedPurchaseRecords} from './purchase-restore.mjs';

const WINDOW=600000,PREVIEW_TTL=300000;
const REASONS=new Set(['external_verified_request','privacy_request','support_correction']);
const encode=value=>new TextEncoder().encode(value);
const hex=bytes=>[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const hash=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encode(value))));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const reply=(status,error)=>Response.json({error},{status});
const equal=(left,right)=>{
  if(left.length!==right.length)return false;
  let mismatch=0;
  for(let i=0;i<left.length;i++)mismatch|=left.charCodeAt(i)^right.charCodeAt(i);
  return mismatch===0;
};
const auditKey=(now)=>`admin-delete-audit:${now}:${crypto.randomUUID()}`;

// This feature is deliberately unavailable until an operator configures both
// the explicit gate and a high-entropy Worker secret. No public CORS headers.
export async function adminAuthorization(request,env={}){
  if(env.PROFILE_ADMIN_DELETE_ENABLED!=='true')return {error:reply(404,'not_found')};
  const secret=env.PROFILE_ADMIN_DELETE_SECRET;
  if(typeof secret!=='string'||secret.length<32)return {error:reply(503,'unavailable')};
  if(request.headers.has('origin'))return {error:reply(403,'forbidden')};
  const bearer=/^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(request.headers.get('authorization')||'');
  const actor=request.headers.get('x-nyan-admin-actor')||'';
  if(!bearer||!equal(await hash(bearer[1]),await hash(secret))||
      !/^[A-Za-z0-9_-]{2,64}$/.test(actor))return {error:reply(401,'unauthorized')};
  return {actorHash:await hash(actor)};
}

async function rateLimit(storage,actorHash,action,now){
  const key=`admin-delete-rate:${actorHash}:${action}`,previous=await storage.get(key);
  const next=previous?.until>now?previous:{until:now+WINDOW,count:0};
  if(next.count>=(action==='execute'?5:20))return false;
  await storage.put(key,{...next,count:next.count+1});
  return true;
}

async function authenticationRateLimit(storage,request,now){
  // Cloudflare sets this header at the edge. Store only a digest of the IP.
  const address=request.headers.get('cf-connecting-ip')||'unknown';
  const key=`admin-delete-auth-rate:${await hash(address)}`;
  const previous=await storage.get(key);
  const next=previous?.until>now?previous:{until:now+WINDOW,count:0};
  if(next.count>=60)return false;
  await storage.put(key,{...next,count:next.count+1});
  return true;
}

function validInput(input){
  return /^op_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input?.playerId||'')&&
    /^[A-Za-z0-9:_-]{4,64}$/.test(input?.supportReference||'')&&REASONS.has(input?.reason);
}

async function target(storage,playerId,options,now){
  const profileKey=await storage.get(`profile-key:${playerId}`);
  const profile=profileKey&&await storage.get(profileKey);
  if(!profile||profile.playerId!==playerId)return null;
  await checkProfileDeletionActivity(storage,playerId,{now,checkActiveRoom:options.checkActiveRoom});
  const records=await retainedPurchaseRecords(storage,profile,now,
    {googlePassProductId:options.googlePassProductId});
  // Bind to the entire profile and purchase snapshot, including sidecars. The
  // digest is internal only; no credential or purchase identity is returned.
  const sidecars=await Promise.all([`queue:${playerId}`,`active:${playerId}`,
    `pass-store:${playerId}`,`pass-google-store:${playerId}`].map(key=>storage.get(key)));
  const purchaseBindings=[];
  for(const prefix of ['storekit:','googleplay:','pass-original:','pass-google-token:'])
    for(const [key,value] of await storage.list({prefix}))
      if(value?.playerId===playerId)purchaseBindings.push([key,value]);
  purchaseBindings.sort(([left],[right])=>left.localeCompare(right));
  const stableRecords=records.map(({key,record})=>{
    const {createdAt,updatedAt,...stable}=record;
    return [key,stable];
  });
  stableRecords.sort(([left],[right])=>left.localeCompare(right));
  const fingerprint=await hash(JSON.stringify([profileKey,profile,stableRecords,sidecars,purchaseBindings]));
  return {profileKey,profile,records,fingerprint};
}

export async function adminProfileDeletionRequest(storage,request,{env={},now=Date.now(),
  checkActiveRoom,googlePassProductId=null}={}){
  if(env.PROFILE_ADMIN_DELETE_ENABLED!=='true')return reply(404,'not_found');
  if(!await authenticationRateLimit(storage,request,now))return reply(429,'rate_limited');
  const authorization=await adminAuthorization(request,env);
  if(authorization.error)return authorization.error;
  const action=new URL(request.url).pathname.split('/').at(-1);
  if(request.method!=='POST'||!['preview','execute'].includes(action))return reply(404,'not_found');
  if(Number(request.headers.get('content-length'))>4096)return reply(413,'invalid_request');
  let input;
  try{const body=await request.text();if(body.length>4096)throw Error();input=JSON.parse(body);}
  catch(_){return reply(400,'invalid_request');}
  if(!validInput(input))return reply(400,'invalid_request');
  const {actorHash}=authorization;
  if(!await rateLimit(storage,actorHash,action,now))return reply(429,'rate_limited');
  const options={checkActiveRoom,googlePassProductId};
  if(action==='preview'){
    try{
      const state=await target(storage,input.playerId,options,now);
      if(!state)return reply(404,'not_found');
      const requestId=crypto.randomUUID(),confirmationToken=random();
      const preview={requestId,playerId:input.playerId,actorHash,
        supportReference:input.supportReference,reason:input.reason,
        tokenHash:await hash(confirmationToken),fingerprint:state.fingerprint,
        previewAt:now,expiresAt:now+PREVIEW_TTL};
      await storage.put(`admin-delete-preview:${requestId}`,preview);
      const {profile,records}=state;
      return Response.json({requestId,confirmationToken,expiresAt:preview.expiresAt,
        profile:{playerId:input.playerId,createdAt:profile.createdAt??null,
          updatedAt:profile.updatedAt??null,rank:profile.ranked?.rank??null,
          rp:profile.ranked?.rp??0,wins:profile.ranked?.lifetimeWins??0,
          losses:profile.ranked?.lifetimeLosses??0,
          profileCharacter:profile.profileCharacter??null,
          equippedAppearance:profile.equippedAppearance??null,
          equippedProfileFrameId:profile.equippedProfileFrameId??null},
        activeMatch:false,matchmaking:false,retainedPurchaseCount:records.length,
        acquiredPermanentPassSkin:records.some(({record})=>record.passSkinRewards?.length>0)});
    }catch(error){return reply(error.message==='active_match'?409:503,
      error.message==='active_match'?'deletion_rejected':'unavailable');}
  }
  if(input.confirm!==true||input.confirmPlayerId!==input.playerId||
      !/^[0-9a-f-]{36}$/.test(input.requestId||'')||
      !/^[0-9a-f]{64}$/.test(input.confirmationToken||''))return reply(400,'invalid_confirmation');
  const previewKey=`admin-delete-preview:${input.requestId}`;
  const preview=await storage.get(previewKey);
  if(!preview||preview.expiresAt<=now||preview.playerId!==input.playerId||
      preview.actorHash!==actorHash||preview.supportReference!==input.supportReference||
      preview.reason!==input.reason||
      !equal(preview.tokenHash,await hash(input.confirmationToken)))return reply(409,'preview_invalid');
  // Consume before attempting deletion. A failed attempt requires a fresh
  // preview, preventing replay even when the deletion transaction rolls back.
  await storage.delete(previewKey);
  const audit={requestId:preview.requestId,actorHash,playerId:input.playerId,
    supportReference:input.supportReference,reason:input.reason,
    previewAt:preview.previewAt,executeAt:now};
  try{
    const state=await target(storage,input.playerId,options,now);
    if(!state||state.fingerprint!==preview.fingerprint)throw Error('stale_preview');
    const result=await deleteOnlineProfile({storage,profileKey:state.profileKey,
      profile:state.profile,now,checkActiveRoom,googlePassProductId,
      onCommitted:async(tx,deleted)=>tx.put(auditKey(now),{...audit,result:'deleted',
        retainedPurchaseCount:deleted.retainedPurchases})});
    return Response.json({deleted:true,requestId:preview.requestId,
      retainedPurchaseCount:result.retainedPurchases});
  }catch(error){
    const category=['active_match','active_room_check_unavailable','stale_preview',
      'profile_delete_conflict','retained_purchase_invalid'].includes(error.message)?error.message:'delete_failed';
    await storage.put(auditKey(now),{...audit,result:'rejected',failureCategory:category});
    return reply(category==='active_match'||category==='stale_preview'||
      category==='profile_delete_conflict'?409:503,'deletion_rejected');
  }
}
