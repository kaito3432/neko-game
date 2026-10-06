import {retainedPurchaseRecords,markDeletedPurchaseBindings} from './purchase-restore.mjs';

const TERMINAL=new Set(['finished','cancelled','invalid']);
const DAY=86400000;

// Called only after Bearer authentication, inside OnlinePlayers' serialized DO.
export async function deleteOnlineProfile({storage,profileKey,profile,now=Date.now(),
  checkActiveRoom,googlePassProductId=null}={}){
  if(!storage||!profileKey||!profile?.playerId)throw new Error('invalid_delete_context');
  const playerId=profile.playerId,indexKey=`profile-key:${playerId}`;
  const queueState=await storage.get(`queue:${playerId}`);
  if(queueState?.status==='waiting')throw new Error('active_match');
  if(queueState?.matchId){
    const match=await storage.get(`match:${queueState.matchId}`);
    if(match&&!TERMINAL.has(match.status))throw new Error('active_match');
  }
  const active=await storage.get(`active:${playerId}`);
  if(active?.roomCode){
    if(typeof checkActiveRoom!=='function')throw new Error('active_room_check_unavailable');
    if(await checkActiveRoom(active.roomCode,playerId))throw new Error('active_match');
  }
  const pending=await storage.get('queue')||[];
  if(pending.some(entry=>entry?.profile?.playerId===playerId&&entry.expiresAt>now))
    throw new Error('active_match');
  // Snapshot and validate before deleting. The transaction rolls all writes back
  // if any retained purchase binding cannot be safely created.
  const apply=async tx=>{
    const current=await tx.get(profileKey);
    if(!current||current.playerId!==playerId||await tx.get(indexKey)!==profileKey)
      throw new Error('profile_delete_conflict');
    const records=await retainedPurchaseRecords(tx,current,now,{googlePassProductId});
    for(const {key,record} of records){
      if(!record.productId||!record.store||!record.identity||
          (await tx.get(key))?.playerId!==playerId)
        throw new Error('retained_purchase_invalid');
    }
    const attemptIds=new Set();
    const cleanup=[profileKey,indexKey,`queue:${playerId}`,`active:${playerId}`,
      `disconnectStats:${playerId}`,`pass-store:${playerId}`,
      `pass-google-store:${playerId}`,`purchase-restore-rate:${playerId}`,
      `pass-google-verify-rate:${playerId}`];
    for(const prefix of [`rewarded-ad:${playerId}:`,`rewarded-ad-verified:${playerId}:`,
      `stamina-coin:${playerId}:`])
      for(const [key] of await tx.list({prefix}))cleanup.push(key);
    for(const prefix of ['rewarded-ad-attempt:'])
      for(const [key,value] of await tx.list({prefix}))
        if(value?.playerId===playerId){cleanup.push(key);attemptIds.add(value.attemptId);}
    for(const [key,value] of await tx.list({prefix:'rewarded-ad-transaction:'}))
      if(attemptIds.has(value?.attemptId))cleanup.push(key);
    for(const prefix of ['ranked:','stamina-consumed:'])
      for(const [key] of await tx.list({prefix}))if(key.endsWith(`:${playerId}`))cleanup.push(key);
    for(const key of new Set(cleanup))await tx.delete(key);
    if(records.length)await markDeletedPurchaseBindings(tx,current,records);
    await tx.put('queue',pending.filter(entry=>entry?.profile?.playerId!==playerId));
    // Only a credential hash and timestamp remain for short retry idempotency.
    await tx.put(`profile-deleted:${profileKey.slice('profile:'.length)}`,
      {deletedAt:now,expiresAt:now+DAY});
    return {deleted:true,retainedPurchases:records.length};
  };
  return storage.transaction?storage.transaction(apply):apply(storage);
}

export async function cleanupProfileDeletionReceipts(storage,now=Date.now()){
  let count=0;
  for(const prefix of ['profile-deleted:','profile-delete-rate:'])
    for(const [key,value] of await storage.list({prefix})){
      const expiresAt=prefix==='profile-deleted:'?value?.expiresAt:value?.until;
      if(Number.isSafeInteger(expiresAt)&&expiresAt<=now){await storage.delete(key);count++;}
    }
  return count;
}
