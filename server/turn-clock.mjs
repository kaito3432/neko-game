import {hasStarted} from './match-lifecycle.mjs';
export const TURN_MS=60000;
const ended=r=>['finished','invalid','cancelled'].includes(r.status);
export function syncTurnClock(room,now=Date.now()){
  if(ended(room)||!room.roles)return;
  if(!hasStarted(room)){delete room.turnClock;return;}
  const s=room.validationState;
  const phase=`${s?.phase||room.publicPhase||'dogSetup'}:${s?.turn||0}`;
  const role=['cat','catSetup'].includes(s?.phase||room.publicPhase)?'cat':'police';
  const seat=Object.keys(room.roles).find(p=>room.roles[p]===role);
  if(room.turnClock?.phase===phase)return;
  room.turnClock={phase,deadlines:{[seat]:now+TURN_MS}};
}
export function turnTimeout(room,now=Date.now()){
  if(ended(room)||!hasStarted(room)||Object.keys(room.disconnects||{}).length)return null;
  const due=Object.entries(room.turnClock?.deadlines||{}).filter(([seat,t])=>now>=t&&!(room.turnClock.phase==='ready'&&room.ready?.[seat]));
  if(!due.length)return null;
  // Simultaneous lobby timeouts are ambiguous: do not pick an arbitrary winner.
  if(due.length>1)return {status:'invalid',finishReason:'serverInvalid',completedAt:now};
  const loser=due[0][0],other=loser==='host'?'guest':'host';
  return {status:'finished',finishReason:'turnTimeout',loser,winner:room.roles[other],completedAt:now};
}
