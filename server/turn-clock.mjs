export const TURN_MS=60000;
const ended=r=>['finished','invalid','cancelled'].includes(r.status);
export function syncTurnClock(room,now=Date.now()){
  if(ended(room)||!room.roles)return;
  let phase,seat;
  if(!room.rule){phase='rule';seat='host';}
  else if(!room.ready?.host||!room.ready?.guest){
    // Each outstanding lobby actor has its own deadline, including skill selection.
    phase='ready';
  }else{
    const s=room.validationState;
    phase=`${s?.phase||'dogSetup'}:${s?.turn||0}`;
    const role=['cat','catSetup'].includes(s?.phase)?'cat':'police';
    seat=Object.keys(room.roles).find(p=>room.roles[p]===role);
  }
  if(room.turnClock?.phase===phase){
    if(phase==='ready')for(const p of ['host','guest'])if(room.ready?.[p])delete room.turnClock.deadlines[p];
    return;
  }
  room.turnClock={phase,deadlines:phase==='ready'
    ?Object.fromEntries(['host','guest'].filter(p=>!room.ready?.[p]).map(p=>[p,now+TURN_MS]))
    :{[seat]:now+TURN_MS}};
}
export function turnTimeout(room,now=Date.now()){
  if(ended(room)||Object.keys(room.disconnects||{}).length)return null;
  const due=Object.entries(room.turnClock?.deadlines||{}).filter(([seat,t])=>now>=t&&!(room.turnClock.phase==='ready'&&room.ready?.[seat]));
  if(!due.length)return null;
  // Simultaneous lobby timeouts are ambiguous: do not pick an arbitrary winner.
  if(due.length>1)return {status:'invalid',finishReason:'serverInvalid',completedAt:now};
  const loser=due[0][0],other=loser==='host'?'guest':'host';
  return {status:'finished',finishReason:'turnTimeout',loser,winner:room.roles[other],completedAt:now};
}
