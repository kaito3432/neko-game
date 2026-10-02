export const ROOM_ROLE_PREFERENCE=Object.freeze({RANDOM:'random',CAT:'cat',POLICE:'police'});
const VALUES=new Set(Object.values(ROOM_ROLE_PREFERENCE));

export function parseRoomRolePreference(value){
  return value===undefined?ROOM_ROLE_PREFERENCE.RANDOM:VALUES.has(value)?value:null;
}

export function roomRoles(preference,randomHostIsCat){
  const hostIsCat=preference===ROOM_ROLE_PREFERENCE.CAT ||
    (preference===ROOM_ROLE_PREFERENCE.RANDOM && randomHostIsCat);
  return Object.freeze({host:hostIsCat?'cat':'police',guest:hostIsCat?'police':'cat'});
}

export function selectRoomRoles(room,seat,preference,bothConnected,randomHostIsCat){
  if(room?.matchType!=='roomMatch')return {error:'not_room_match'};
  if(seat!=='host')return {error:'host_only'};
  if(room.roles)return {error:'already_selected'};
  if(!bothConnected)return {error:'guest_not_connected'};
  const selectedRolePreference=parseRoomRolePreference(preference);
  if(!selectedRolePreference)return {error:'invalid_role_preference'};
  return {roles:roomRoles(selectedRolePreference,randomHostIsCat),selectedRolePreference,roleState:'selected'};
}
