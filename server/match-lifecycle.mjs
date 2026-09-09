import './engine-environment.mjs';
import '../engine.js';

// Legacy rooms did not persist hasStarted. Infer only an already started game.
export function hasStarted(room){
  return typeof room.hasStarted==='boolean' ? room.hasStarted :
    Boolean(room.started || room.ready?.host && room.ready?.guest);
}

export function startIfReady(room,connected,now=Date.now()){
  if(hasStarted(room)||['finished','invalid','cancelled'].includes(room.status))return false;
  if(!room.roles||!room.ready?.host||!room.ready?.guest||
      !['normal','ability'].includes(room.rule)||!['host','guest'].every(p=>connected.includes(p))||
      Object.keys(room.disconnects||{}).length)return false;
  if(room.rule==='ability'&&(!room.abilities?.cat||!room.abilities?.police))return false;
  room.validationState=globalThis.NyanEngine.createState();
  room.hasStarted=true;room.matchStartedAt=now;room.status='playing';
  room.publicPhase='dogSetup';room.selectedDog=null;
  return true;
}
