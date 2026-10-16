// Pure server-clock lifecycle. No client-supplied deadline is accepted.
import {hasStarted} from './match-lifecycle.mjs';
import {publicPlayerProfiles} from './online-profile.mjs';
import {canUseOnlineSkillMode,resolveEffectiveSkillEntitlements} from './skill-entitlements.mjs';
import {actorState,syncTurnClock,turnTimeout} from './turn-clock.mjs';
import {ONLINE_BOARD_RULE_ID} from './online-board-rule.mjs';
export const GRACE_MS=15000;
export const terminal=room=>['finished','invalid','cancelled'].includes(room.status);
export function serverInvalid(room,now){
  if(terminal(room))return null;
  return {status:'invalid',finishReason:'serverInvalid',completedAt:now};
}
export function disconnected(room,seat,now){
  if(terminal(room))return;
  room.disconnects||={};
  room.disconnects[seat]??={playerId:room.profiles?.[seat]?.playerId||null,at:now,deadline:now+GRACE_MS};
  syncTurnClock(room,now);
  room.status='reconnecting';
}
export function deadlineResult(room,now){
  if(terminal(room))return null;
  const missing=Object.entries(room.disconnects||{});
  if(!missing.length)return null;
  if(!hasStarted(room))return {status:'cancelled',finishReason:'abortedBeforeStart',completedAt:now};
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
  syncTurnClock(room,now);
  room.status=Object.keys(room.disconnects||{}).length?'reconnecting':hasStarted(room)?'playing':'matched';
  return true;
}
// If an alarm is delayed, settle the first elapsed deadline rather than changing
// the outcome merely because both deadlines have passed by the time it runs.
export function lifecycleDeadlineResult(room,now){
  const disconnect=deadlineResult(room,now),turn=turnTimeout(room,now);
  if(!disconnect)return turn;
  if(!turn)return disconnect;
  const disconnectAt=Math.max(...Object.values(room.disconnects||{}).map(d=>d.deadline));
  const turnAt=Math.min(...Object.values(room.turnClock?.deadlines||{}));
  return turnAt<disconnectAt?turn:disconnect;
}
// Cat paths become public only after an authoritative, valid win/loss.
export function publicFinishedResult(room){
  if(room.status!=='finished'||!['cat','police'].includes(room.result?.winner))return room.result||null;
  const secret=room.secretCat||{};
  return {...room.result,boardRuleId:room.boardRuleId||ONLINE_BOARD_RULE_ID,
    route:(secret.history||[]).map(step=>({box:Number(step.box),turn:Number(step.turn)})),
    routeSkills:{sneakBoxes:(secret.noTrackBoxes||[]).map(Number),
      fakeTracks:(secret.fakeTracks||[]).map(step=>({box:Number(step.box),turn:Number(step.turn)}))}};
}
export function publicRecovery(room,seat){
  const role=room.roles?.[seat]||null,s=room.validationState||{};
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
  return {matchId:room.matchId,matchType:room.matchType,boardRuleId:room.boardRuleId||ONLINE_BOARD_RULE_ID,player:seat,role,
    roleState:room.roles?'selected':'waiting',selectedRolePreference:room.selectedRolePreference||null,
    roleSelectionReady:Boolean(room.guestToken&&!Object.keys(room.disconnects||{}).length),
    playerId:room.profiles?.[seat]?.playerId,appearanceSnapshot:room.appearanceSnapshot,
    participants:{host:room.profiles?.host?.playerId,guest:room.profiles?.guest?.playerId},
    playerProfiles:publicPlayerProfiles(room.profiles),skillModeAvailable:canUseOnlineSkillMode(room),
    effectiveSkillEntitlements:resolveEffectiveSkillEntitlements(room,seat),
    profile:room.profiles?.[seat],rule:room.rule||null,abilities:room.abilities||{},ready:room.ready||{},
    ownAbility:room.privateAbilities?.[role]||null,abilityReady:room.abilityReady||{},
    status:room.status,hasStarted:hasStarted(room),...actorState(room),matchStartedAt:room.matchStartedAt||null,
    result:publicFinishedResult(room),disconnects:room.disconnects||{},turnClock:hasStarted(room)?room.turnClock:null,serverTime:Date.now(),state};
}
