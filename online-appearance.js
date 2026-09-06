/* Match-scoped presentation only. Offline ownership is never used here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NyanOnlineAppearance=api;})(globalThis,()=>{
  const copy=v=>JSON.parse(JSON.stringify(v));
  function accept(message,{myPlayerId,player,profile,roomCode}){
    const role=message.role,peerRole=role==='cat'?'police':'cat';
    if(!['cat','police'].includes(role)||message.player!==player||!myPlayerId||message.playerId!==myPlayerId)return null;
    const people=message.participants;
    if(people?.[player]!==myPlayerId||!people?.[player==='host'?'guest':'host']||people.host===people.guest)return null;
    const snapshot=message.appearanceSnapshot;
    if(!snapshot)return null;
    const mine=snapshot[role==='cat'?'catPlayer':'policePlayer'];
    const peer=snapshot[peerRole==='cat'?'catPlayer':'policePlayer'];
    if(mine?.playerId!==myPlayerId||peer?.playerId!==people[player==='host'?'guest':'host'])return null;
    const ownField=role==='cat'?'catSkinId':'dogSkinId',owned=role==='cat'?'ownedCatSkins':'ownedDogSkins';
    // Cross-check our own seat against the server profile captured at entry.
    // Never borrow the opponent's appearance even if our local data was edited.
    const validOwn=profile?.playerId===myPlayerId&&mine[ownField]===profile?.equippedAppearance?.[ownField]&&profile?.[owned]?.includes(mine[ownField]);
    const frozen=copy(snapshot);if(!validOwn)frozen[role==='cat'?'catPlayer':'policePlayer'][ownField]='default';
    return {matchId:message.matchId||roomCode,myPlayerId,role,participants:copy(people),snapshot:frozen};
  }
  function resolve(state,category){
    if(!state)return {status:'pending',id:'default'};
    const role=category==='catSkin'?'cat':category==='dogSkin'?'police':null;
    if(!role)return {status:'invalid',id:'default'};
    const entry=state.snapshot[role==='cat'?'catPlayer':'policePlayer'];
    const expected=role===state.role?state.myPlayerId:Object.values(state.participants).find(id=>id!==state.myPlayerId);
    if(!expected||entry?.playerId!==expected)return {status:'invalid',id:'default'};
    return {status:'ready',id:entry[role==='cat'?'catSkinId':'dogSkinId']||'default',playerId:expected};
  }
  return {accept,resolve};
});
