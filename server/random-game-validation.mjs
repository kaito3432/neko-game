import './engine-environment.mjs';
import '../engine.js';
const E=globalThis.NyanEngine;

// Random rules reuse the same engine and existing room skill protocol.
// This shadow state validates events using the shared engine before the existing
// room handler applies secret-position/search logic and broadcasts the event.
export function acceptRandomAction(room, role, payload) {
  const state=room.validationState || (room.validationState=E.createState());
  const type=payload.type;
  const abilities=room.rule==='ability'?room.abilities||{}:{};
  state.selectedAbilities={cat:abilities.cat||null,police:abilities.police||null};
  if(type==='policeSkillUsed'){
    if(role!=='police'||state.phase!=='dogs'||payload.skill!==abilities.police||!['howl','dash','doubleSearch'].includes(payload.skill))return false;
    return !state.policeAbilities[`${payload.skill}Used`];
  }
  if(type==='howl'||type==='doubleSearch'){
    const i=type==='howl'?0:2;
    if(role!=='police'||state.phase!=='dogs'||abilities.police!==type||state.dogAction[i]||state.policeAbilities[`${type}Used`])return false;
    if(type==='howl'&&payload.node!==state.dogs[0])return false;
    if(type==='doubleSearch'&&(!Array.isArray(payload.targets)||payload.targets.length!==2||new Set(payload.targets).size!==2||!payload.targets.every(b=>E.getBoxesAroundNode(state.dogs[2]).includes(b))))return false;
    state.dogAction[i]=true;state.policeAbilities[`${type}Used`]=true;return true;
  }
  if(type==='ready') return true;
  if(type==='dogSetup') {
    const dogs=payload.dogs;
    if(role!=='police' || state.phase!=='dogSetup' || !Array.isArray(dogs) || dogs.length!==3 || new Set(dogs).size!==3 || !dogs.every(n=>Number.isInteger(n)&&E.isActiveDogNode(n))) return false;
    state.dogs=[...dogs];state.phase='catSetup';return true;
  }
  if(type==='catSetup') {
    if(role!=='cat' || state.phase!=='catSetup' || !Number.isInteger(payload.catPos) || payload.catPos<0 || payload.catPos>=E.BOX_COUNT) return false;
    state.catPos=payload.catPos;state.catHistory.set(payload.catPos,1);state.turn=1;state.phase='dogs';return true;
  }
  if(type==='dogMove' || type==='search') {
    const i=payload.dogIndex;
    if(role!=='police' || state.phase!=='dogs' || !Number.isInteger(i) || i<0 || i>2 || state.dogAction[i]!==false) return false;
    if(type==='dogMove') {
      if(!E.getDogLegalMoves(state,i).includes(payload.node)){
        if(i!==1||abilities.police!=='dash'||state.policeAbilities.dashUsed||!E.getDogDashMoves(state,i).includes(payload.node))return false;
        state.policeAbilities.dashUsed=true;
      }
      state.dogs[i]=payload.node;
    } else if(!E.getBoxesAroundNode(state.dogs[i]).includes(payload.box)) return false;
    state.dogAction[i]=true;return true;
  }
  if(type==='dogTurnEnd') {
    if(role!=='police' || state.phase!=='dogs' || !E.allDogsDone(state)) return false;
    if(state.turn===E.MAX_TURNS) state.phase='escaped';
    else {state.turn++;state.phase='cat';}
    return true;
  }
  if(type==='catMove') {
    if(role!=='cat' || state.phase!=='cat' || payload.turn!==state.turn || !E.getCatLegalMoves(state).includes(payload.catPos)) return false;
    if(payload.sneakUsed && (abilities.cat!=='sneak'||state.catAbilities.sneakUsed||payload.noTrackBox!==state.catPos))return false;
    if(payload.fakePawUsed && (abilities.cat!=='fakePaw'||state.catAbilities.fakePawUsed||!E.getCatLegalMoves(state).includes(payload.fakePawBox)||payload.fakePawBox===payload.catPos))return false;
    if(payload.sneakUsed)state.catAbilities.sneakUsed=true;
    if(payload.fakePawUsed)state.catAbilities.fakePawUsed=true;
    state.deadMove=E.isCatDeadEnd(state,payload.catPos);
    state.catPos=payload.catPos;state.catHistory.set(payload.catPos,state.turn);
    state.phase='dogs';state.dogAction=[false,false,false];return true;
  }
  if(type==='catEscaped') return role==='cat' && state.phase==='escaped';
  if(type==='catNoEscape') return role==='cat' && (state.phase==='cat' && E.getCatLegalMoves(state).length===0 || state.phase==='dogs' && state.deadMove===true);
  return false;
}
