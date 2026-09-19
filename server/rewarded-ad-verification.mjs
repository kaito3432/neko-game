import {REWARDED_AD_REWARD_TYPES} from './skill-entitlements.mjs';

export const ADMOB_VERIFIER_KEYS_URL='https://www.gstatic.com/admob/reward/verifier-keys.json';
const ATTEMPT_TTL_MS=30*60*1000;

const b64=value=>{let normalized=String(value).replace(/\s/g,'+').replace(/-/g,'+').replace(/_/g,'/');while(normalized.length%4)normalized+='=';return Uint8Array.from(atob(normalized),char=>char.charCodeAt(0));};
const pemBytes=pem=>b64(String(pem).replace(/-----[^-]+-----/g,'').replace(/\s/g,''));

// Google signs with ASN.1 DER while WebCrypto ECDSA expects fixed-width r || s.
export function derEcdsaToRaw(value,size=32){
  const bytes=value instanceof Uint8Array?value:new Uint8Array(value);let offset=0;
  if(bytes[offset++]!==0x30)throw new Error('invalid_ssv_signature');
  const readLength=()=>{const first=bytes[offset++];if(first<0x80)return first;const count=first&0x7f;if(!count||count>2)throw new Error('invalid_ssv_signature');let length=0;for(let i=0;i<count;i++)length=(length<<8)|bytes[offset++];return length;};
  readLength();
  const readInteger=()=>{if(bytes[offset++]!==0x02)throw new Error('invalid_ssv_signature');const length=readLength(),part=bytes.slice(offset,offset+length);offset+=length;const trimmed=part[0]===0?part.slice(1):part;if(trimmed.length>size)throw new Error('invalid_ssv_signature');const result=new Uint8Array(size);result.set(trimmed,size-trimmed.length);return result;};
  const r=readInteger(),s=readInteger(),raw=new Uint8Array(size*2);raw.set(r);raw.set(s,size);return raw;
}

export async function createRewardedAdAttempt(storage,profile,rewardType,now=Date.now()){
  if(rewardType!==REWARDED_AD_REWARD_TYPES.SKILL_MODE_UNLOCK_PROGRESS)throw new Error('invalid_reward_type');
  const attemptId=`ra_${crypto.randomUUID()}`;
  await storage.put(`rewarded-ad-attempt:${attemptId}`,{attemptId,playerId:profile.playerId,rewardType,createdAt:now,expiresAt:now+ATTEMPT_TTL_MS});
  return {attemptId,rewardType,expiresAt:now+ATTEMPT_TTL_MS};
}

async function importVerifierKey(pem){
  return crypto.subtle.importKey('spki',pemBytes(pem),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
}

export async function verifyAdMobSsvUrl(rawUrl,{fetchFn=fetch,keysUrl=ADMOB_VERIFIER_KEYS_URL,allowedAdUnitId='',expectedRewardItem='',now=Date.now()}={}){
  const url=new URL(rawUrl),query=url.search.slice(1),signatureAt=query.lastIndexOf('&signature=');
  if(signatureAt<1)throw new Error('invalid_ssv_payload');
  const signed=query.slice(0,signatureAt),tail=new URLSearchParams(query.slice(signatureAt+1));
  const signature=tail.get('signature'),keyId=tail.get('key_id');
  if(!signature||!keyId)throw new Error('invalid_ssv_payload');
  const params=new URLSearchParams(signed),transactionId=params.get('transaction_id'),attemptId=params.get('custom_data');
  const userId=params.get('user_id'),rewardAmount=params.get('reward_amount'),rewardItem=params.get('reward_item');
  const adUnit=params.get('ad_unit');
  if(!transactionId||!attemptId||!userId||!rewardAmount||!rewardItem)throw new Error('invalid_ssv_payload');
  if(allowedAdUnitId&&adUnit!==allowedAdUnitId)throw new Error('invalid_ad_unit');
  if(expectedRewardItem&&rewardItem!==expectedRewardItem)throw new Error('invalid_reward_item');
  const timestamp=Number(params.get('timestamp'));
  if(Number.isFinite(timestamp)){
    const millis=timestamp>1e14?Math.floor(timestamp/1000):timestamp;
    if(millis>now+5*60*1000||millis<now-7*24*60*60*1000)throw new Error('invalid_ssv_timestamp');
  }
  const keyResponse=await fetchFn(keysUrl);if(!keyResponse.ok)throw new Error('ssv_key_unavailable');
  const keys=(await keyResponse.json()).keys||[],entry=keys.find(value=>String(value.keyId)===String(keyId));
  if(!entry?.pem)throw new Error('unknown_ssv_key');
  const key=await importVerifierKey(entry.pem),valid=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,derEcdsaToRaw(b64(signature)),new TextEncoder().encode(signed));
  if(!valid)throw new Error('invalid_ssv_signature');
  return {transactionId,attemptId,userId,rewardAmount,rewardItem,adUnit,timestamp};
}

export async function acceptVerifiedAdMobSsv(storage,rawUrl,options={}){
  const receipt=await verifyAdMobSsvUrl(rawUrl,options),attemptKey=`rewarded-ad-attempt:${receipt.attemptId}`;
  const attempt=await storage.get(attemptKey);
  if(!attempt||attempt.expiresAt<(options.now??Date.now()))throw new Error('reward_attempt_expired');
  if(attempt.playerId!==receipt.userId)throw new Error('reward_player_mismatch');
  const transactionKey=`rewarded-ad-transaction:${receipt.transactionId}`;
  if(await storage.get(transactionKey))return {accepted:true,duplicate:true};
  await storage.put({[transactionKey]:{attemptId:receipt.attemptId,verifiedAt:options.now??Date.now()},
    [`rewarded-ad-verified:${attempt.playerId}:${receipt.attemptId}`]:{...receipt,rewardType:attempt.rewardType,verifiedAt:options.now??Date.now()}});
  return {accepted:true,duplicate:false};
}

export async function verifyStoredRewardedAd(storage,{playerId,rewardType,verificationId}){
  const receipt=await storage.get(`rewarded-ad-verified:${playerId}:${verificationId}`);
  return Boolean(receipt&&receipt.rewardType===rewardType&&receipt.userId===playerId);
}
