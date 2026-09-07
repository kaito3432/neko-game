// Only public, whitelisted lobby/selection fields can leave this boundary.
export function sessionEvent(room,sender,p){
  const role=room.roles[sender];
  if(p.type==='ruleSelect'){
    if(sender!=='host'||room.started||room.ready?.host||room.ready?.guest||!['normal','ability'].includes(p.rule))return false;
    room.rule=p.rule;return {type:'ruleSelect',rule:p.rule};
  }
  if(['abilityReady','abilityRevealRequest','abilityReveal'].includes(p.type)){
    if(room.rule!=='ability'||room.started)return false;
    if(p.type==='abilityRevealRequest')return sender==='host'?{type:p.type}:false;
    if(p.type==='abilityReady'){
      const choices=role==='cat'?['sneak','fakePaw']:['howl','dash','doubleSearch'];
      if(p.ability!==undefined&&!choices.includes(p.ability))return false;
      room.privateAbilities||={};if(p.ability)room.privateAbilities[role]=p.ability;
      room.abilityReady||={};room.abilityReady[role]=true;return {type:p.type};
    }
    const allowed=role==='cat'?['sneak','fakePaw']:['howl','dash','doubleSearch'];
    if(!allowed.includes(p.ability))return false;
    room.abilities||={};if(room.abilities[role]&&room.abilities[role]!==p.ability)return false;
    room.abilities[role]=p.ability;return {type:p.type,ability:p.ability};
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
