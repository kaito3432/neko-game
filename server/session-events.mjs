import {canUseOnlineSkillMode,validateSkillSelectionForMatch,validateSkillUseForMatch} from './skill-entitlements.mjs';

// Only public, whitelisted lobby/selection fields can leave this boundary.
export function sessionEvent(room,sender,p){
  const role=room.roles[sender];
  if(p.type==='ruleSelect'){
    if(sender!=='host'||room.started||room.ready?.host||room.ready?.guest||!['normal','ability'].includes(p.rule))return false;
    if(p.rule==='ability'&&!canUseOnlineSkillMode(room.profiles))return {skillError:'SKILL_MODE_LOCKED'};
    room.rule=p.rule;return {type:'ruleSelect',rule:p.rule};
  }
  if(['abilityReady','abilityRevealRequest','abilityReveal'].includes(p.type)){
    if(room.rule!=='ability'||room.started)return false;
    if(p.type==='abilityRevealRequest')return sender==='host'?{type:p.type}:false;
    if(p.type==='abilityReady'){
      const checked=validateSkillSelectionForMatch({role,skillId:p.ability,entitlements:room.profiles?.[sender]?.skillEntitlements});
      if(!checked.ok)return {skillError:checked.error};
      room.approvedSkills||={};
      if(room.approvedSkills[role]&&room.approvedSkills[role]!==checked.skillId)return {skillError:'MULTIPLE_SKILLS_NOT_ALLOWED'};
      room.approvedSkills[role]=checked.skillId;
      room.privateAbilities||={};room.privateAbilities[role]=checked.runtimeId;
      room.abilityReady||={};room.abilityReady[role]=true;return {type:p.type};
    }
    const checked=validateSkillUseForMatch({role,skillId:p.ability,approvedSkills:room.approvedSkills});
    if(!checked.ok)return {skillError:checked.error};
    room.abilities||={};if(room.abilities[role]&&room.abilities[role]!==checked.runtimeId)return {skillError:'MULTIPLE_SKILLS_NOT_ALLOWED'};
    room.abilities[role]=checked.runtimeId;return {type:p.type,ability:checked.runtimeId};
  }
  if(p.type==='ready'){
    if(room.requiresRuleSelection && (!room.rule || room.rule==='ability'&&(!room.abilities?.cat||!room.abilities?.police)))return false;
    room.ready||={};room.ready[sender]=true;return {type:'ready'};
  }
  if(p.type==='policeSelection'){
    if(role!=='police'||room.publicPhase!=='dogs'||!(p.dogIndex===null||Number.isInteger(p.dogIndex)&&p.dogIndex>=0&&p.dogIndex<3))return false;
    if(p.dogIndex!==null&&room.validationState?.dogAction[p.dogIndex])return false;
    return {type:'policeSelection',dogIndex:p.dogIndex};
  }
  return null;
}
