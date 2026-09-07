// Pure server-clock lifecycle. No client-supplied deadline is accepted.
export const GRACE_MS=15000;
export const terminal=room=>['finished','invalid','cancelled'].includes(room.status);
export function serverInvalid(room,now){
  if(terminal(room))return null;
  return {status:'invalid',finishReason:'serverInvalid',completedAt:now};
}
export function disconnected(room,seat,now){
  if(terminal(room)||!room.roles)return;
  room.disconnects||={};
  room.disconnects[seat]??={at:now,deadline:now+GRACE_MS};
  room.status='reconnecting';
}
export function deadlineResult(room,now){
  if(terminal(room))return null;
  const missing=Object.entries(room.disconnects||{});
  if(!missing.length)return null;
  if(missing.length===2){
    if(missing.every(([,d])=>now>=d.deadline))return {status:'invalid',finishReason:'serverInvalid',completedAt:now};
    return null;
  }
  const [loser,d]=missing[0];
  if(now<d.deadline)return null;
  const winnerSeat=loser==='host'?'guest':'host';
  return {status:'finished',finishReason:'disconnectForfeit',loser, winner:room.roles[winnerSeat],completedAt:now};
}
export function reconnected(room,seat,now){
  if(terminal(room)||room.disconnects?.[seat]&&now>=room.disconnects[seat].deadline)return false;
  if(room.disconnects)delete room.disconnects[seat];
  room.status=Object.keys(room.disconnects||{}).length?'reconnecting':room.started?'playing':'matched';
  return true;
}
export function publicRecovery(room,seat){
  const role=room.roles?.[seat],s=room.validationState||{};
  // Explicit allowlist, not spread/delete: police never receive hidden state.
  const state={turn:s.turn||0,phase:s.phase||'dogSetup',dogs:s.dogs||[null,null,null],
    dogAction:s.dogAction||[false,false,false],selectedDog:room.selectedDog??null,
    policeAbilities:s.policeAbilities||{},catAbilities:s.catAbilities||{},
    revealedTracks:room.revealedTracks||[],searchedBoxes:room.searchedBoxes||[]};
  if(role==='cat'){
    state.catPos=room.secretCat?.pos??null;
    state.catHistory=(room.secretCat?.history||[]).map(h=>[h.box,h.turn]);
    state.noTrackBoxes=room.secretCat?.noTrackBoxes||[];
    state.fakeTracks=(room.secretCat?.fakeTracks||[]).map(h=>[h.box,h.turn]);
  }
  if(role==='police'&&state.phase==='dogSetup'&&room.partialDogs)state.dogs=room.partialDogs;
  return {matchId:room.matchId,matchType:room.matchType,player:seat,role,
    playerId:room.profiles?.[seat]?.playerId,appearanceSnapshot:room.appearanceSnapshot,
    participants:{host:room.profiles?.host?.playerId,guest:room.profiles?.guest?.playerId},
    profile:room.profiles?.[seat],rule:room.rule||null,abilities:room.abilities||{},ready:room.ready||{},
    ownAbility:room.privateAbilities?.[role]||null,abilityReady:room.abilityReady||{},
    status:room.status,result:room.result||null,disconnects:room.disconnects||{},serverTime:Date.now(),state};
}
