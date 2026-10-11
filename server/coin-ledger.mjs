// A profile's coin balance, coin purchases and daily claims share one Durable Object.
// Never fall back to non-transactional writes: a partial purchase is worse than a failed one.
const ITEMS=Object.freeze({
  'catSkin:cat_coin_01':Object.freeze({field:'ownedCatSkins',price:500}),
  'dogSkin:dog_coin_01':Object.freeze({field:'ownedDogSkins',price:500}),
  'boardTheme:board_coin_01':Object.freeze({field:'ownedBoardThemes',price:60}),
  'cardboard:cardboard_coin_01':Object.freeze({field:'ownedCardboards',price:30}),
  'paw:paw_coin_01':Object.freeze({field:'ownedPaws',price:30})
});
const FIELDS=['ownedCatSkins','ownedDogSkins','ownedBoardThemes','ownedCardboards','ownedPaws'];
const RULES=Object.freeze({playOneBattle:{target:1,reward:10},winAsCat:{target:3,reward:20},winAsPolice:{target:3,reward:20}});
const idPattern=/^[A-Za-z0-9:_-]{8,180}$/;
const battlePattern=/^[A-Za-z0-9_-]{8,160}$/;
const validCoins=value=>Number.isSafeInteger(value)&&value>=0;
export const coinDay=now=>new Date(now+32400000).toISOString().slice(0,10);
const owned=(profile,field)=>[...new Set(['default',...(Array.isArray(profile[field])?profile[field]:[])])];
const dailyState=(value,date)=>{
  if(value?.date===date)return {date,progress:{...value.progress},claimed:{...value.claimed},allClearClaimed:value.allClearClaimed===true};
  return {date,progress:{playOneBattle:0,winAsCat:0,winAsPolice:0},claimed:{},allClearClaimed:false};
};
export const currentCoinDaily=(profile,now=Date.now())=>dailyState(profile?.coinDaily,coinDay(now));
const balance=profile=>profile.serverNyanCoins;
function requireTransaction(storage){
  if(typeof storage?.transaction!=='function')throw new Error('atomic_storage_unavailable');
  return storage.transaction.bind(storage);
}
export function coinInventory(profile){
  return {serverNyanCoins:balance(profile),migration:profile.coinMigration||null,
    daily:profile.coinDaily||null,...Object.fromEntries(FIELDS.map(field=>[field,owned(profile,field)]))};
}
export async function migrateLegacyCoins({storage,profileKey,input,now=Date.now()}){
  const transaction=requireTransaction(storage);
  const migrationId=input?.migrationId;
  if(typeof migrationId!=='string'||!idPattern.test(migrationId)||!validCoins(input?.localCoins))throw new Error('invalid_migration');
  const claims=input?.ownership||{};
  if(!claims||typeof claims!=='object'||Array.isArray(claims))throw new Error('invalid_migration');
  for(const field of FIELDS){
    if(!Array.isArray(claims[field])||claims[field].some(id=>id!=='default'&&!Object.entries(ITEMS).some(([key,entry])=>entry.field===field&&key.endsWith(`:${id}`))))
      throw new Error('invalid_migration_item');
  }
  return transaction(async tx=>{
    const profile=await tx.get(profileKey);
    if(!profile)throw new Error('unauthorized');
    if(profile.coinMigration){
      if(profile.coinMigration.id!==migrationId)throw new Error('migration_already_completed');
      return {profile,duplicate:true};
    }
    const total=balance(profile)+input.localCoins;
    if(!validCoins(total))throw new Error('coin_overflow');
    const next={...profile,serverNyanCoins:total,
      coinMigration:{version:1,id:migrationId,completedAt:now,localCoins:input.localCoins}};
    for(const field of FIELDS)next[field]=[...new Set([...owned(profile,field),...claims[field]])];
    // Older local Daily claims were already included in localCoins. Import their
    // claimed flags so today's reward cannot be collected a second time.
    const today=coinDay(now),legacy=input.daily;
    {
      const state=dailyState(null,today);
      if(legacy?.date===today){
      for(const [id,rule] of Object.entries(RULES)){
        const mission=Array.isArray(legacy.missions)?legacy.missions.find(item=>item?.id===id):null;
        state.progress[id]=Math.min(rule.target,Math.max(0,Math.floor(Number(mission?.progress)||0)));
        state.claimed[id]=mission?.claimed===true&&state.progress[id]>=rule.target;
      }
      state.allClearClaimed=legacy.allClearRewardClaimed===true;
      }
      next.coinDaily=state;
    }
    await tx.put(profileKey,next);
    return {profile:next,duplicate:false};
  });
}
export async function purchaseCoinItem({storage,profileKey,input,now=Date.now()}){
  const transaction=requireTransaction(storage),requestId=input?.requestId;
  if(typeof requestId!=='string'||!idPattern.test(requestId))throw new Error('invalid_request_id');
  const itemKey=`${input?.categoryId}:${input?.itemId}`,item=ITEMS[itemKey];
  if(!item)throw new Error('item_not_coin_purchasable');
  const marker=`coin-purchase:${profileKey}:${requestId}`;
  return transaction(async tx=>{
    const receipt=await tx.get(marker);
    if(receipt){
      if(receipt.itemKey!==itemKey)throw new Error('request_id_conflict');
      return {...receipt,profile:await tx.get(profileKey),duplicate:true};
    }
    const profile=await tx.get(profileKey);
    if(!profile?.coinMigration)throw new Error('migration_required');
    if(owned(profile,item.field).includes(input.itemId))throw new Error('already_owned');
    if(balance(profile)<item.price)throw new Error('insufficient_coins');
    const next={...profile,serverNyanCoins:balance(profile)-item.price,
      [item.field]:[...owned(profile,item.field),input.itemId]};
    const result={itemKey,price:item.price,processedAt:now};
    await tx.put({[profileKey]:next,[marker]:result});
    return {...result,profile:next,duplicate:false};
  });
}
export async function recordCoinBattle({storage,profileKey,input,now=Date.now()}){
  const transaction=requireTransaction(storage);
  if(!battlePattern.test(input?.battleId||'')||!['cpu','randomMatch'].includes(input?.source)||
    !['cat','police'].includes(input?.side)||typeof input?.won!=='boolean'||input?.completed!==true||
    !Number.isSafeInteger(input?.completedAt)||input.completedAt<=0||input.completedAt>now+60000)
    throw new Error('invalid_battle');
  const marker=`coin-battle:${profileKey}:${input.battleId}`;
  return transaction(async tx=>{
    const profile=await tx.get(profileKey);
    if(!profile?.coinMigration)throw new Error('migration_required');
    if(await tx.get(marker))return {profile,duplicate:true};
    const date=coinDay(now),daily=dailyState(profile.coinDaily,date);
    if(coinDay(input.completedAt)===date){
      daily.progress.playOneBattle=Math.min(1,daily.progress.playOneBattle+1);
      if(input.won){const id=input.side==='cat'?'winAsCat':'winAsPolice';daily.progress[id]=Math.min(3,daily.progress[id]+1);}
    }
    const next={...profile,coinDaily:daily};
    await tx.put({[profileKey]:next,[marker]:{date,source:input.source,at:now}});
    return {profile:next,duplicate:false};
  });
}
export async function claimCoinDaily({storage,profileKey,input,now=Date.now()}){
  const transaction=requireTransaction(storage),date=coinDay(now),id=input?.missionId;
  if(input?.date!==date||!(id==='allClear'||Object.hasOwn(RULES,id||'')))throw new Error('invalid_daily_claim');
  return transaction(async tx=>{
    const profile=await tx.get(profileKey);
    if(!profile?.coinMigration)throw new Error('migration_required');
    const daily=dailyState(profile.coinDaily,date);
    const allComplete=Object.entries(RULES).every(([key,rule])=>daily.progress[key]>=rule.target);
    if(id==='allClear'&&!allComplete||id!=='allClear'&&daily.progress[id]<RULES[id].target)throw new Error('mission_not_completed');
    if(id==='allClear'?daily.allClearClaimed:daily.claimed[id])return {profile,duplicate:true};
    const amount=id==='allClear'?30:RULES[id].reward;
    if(!validCoins(balance(profile)+amount))throw new Error('coin_overflow');
    if(id==='allClear')daily.allClearClaimed=true;else daily.claimed[id]=true;
    const next={...profile,serverNyanCoins:balance(profile)+amount,coinDaily:daily};
    await tx.put(profileKey,next);
    return {profile:next,duplicate:false,amount};
  });
}
