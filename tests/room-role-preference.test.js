const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const load=()=>import('../server/room-role-preference.mjs');

test('Room host chooses cat, police, or the original fair random allocation',async()=>{
  const {ROOM_ROLE_PREFERENCE:P,parseRoomRolePreference:parse,roomRoles}=await load();
  assert.deepEqual(Object.values(P),['random','cat','police']);
  assert.equal(parse(undefined),P.RANDOM);
  assert.deepEqual(roomRoles(P.CAT,false),{host:'cat',guest:'police'});
  assert.deepEqual(roomRoles(P.POLICE,true),{host:'police',guest:'cat'});
  assert.deepEqual(roomRoles(P.RANDOM,true),{host:'cat',guest:'police'});
  assert.deepEqual(roomRoles(P.RANDOM,false),{host:'police',guest:'cat'});
  for(const bad of [null,'guest','Cat','',42,{}])assert.equal(parse(bad),null);
});

test('Selection requires both players, rejects guest and invalid values, and is idempotent',async()=>{
  const {selectRoomRoles:select}=await load();
  const pending={matchType:'roomMatch',roles:null};
  assert.equal(select(pending,'host','cat',false,true).error,'guest_not_connected');
  assert.equal(select(pending,'guest','cat',true,true).error,'host_only');
  assert.equal(select(pending,'host','bad',true,true).error,'invalid_role_preference');
  assert.deepEqual(select(pending,'host','cat',true,false),{roles:{host:'cat',guest:'police'},selectedRolePreference:'cat',roleState:'selected'});
  assert.deepEqual(select(pending,'host','police',true,true).roles,{host:'police',guest:'cat'});
  assert.deepEqual(select(pending,'host','random',true,true).roles,{host:'cat',guest:'police'});
  assert.deepEqual(select(pending,'host','random',true,false).roles,{host:'police',guest:'cat'});
  assert.equal(select({...pending,roles:{host:'cat',guest:'police'}},'host','police',true,false).error,'already_selected');
  assert.equal(select({...pending,matchType:'randomMatch'},'host','cat',true,true).error,'not_room_match');
});

test('Room creation has no role field; only the matched host WebSocket selects',()=>{
  const worker=fs.readFileSync(path.join(__dirname,'../server/worker.mjs'),'utf8');
  const online=fs.readFileSync(path.join(__dirname,'../online.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(worker,/body: JSON\.stringify\(\{profile,roomCode\}\)/);
  assert.match(worker,/body: JSON\.stringify\(\{profile\}\)/);
  assert.match(worker,/roleState:'waiting',selectedRolePreference:null/);
  assert.match(worker,/if\(room\?\.roles\)await this\.assignRoles\(\)/);
  assert.match(worker,/selectRoomRoles\(room,sender,data\.preference,ready,/);
  assert.match(worker,/room\.roles=selection\.roles/);
  assert.match(worker,/roles: match\.roles, profiles, matchId: match\.matchId, matchType: 'randomMatch'/);
  assert.doesNotMatch(online,/body:JSON\.stringify\(\{hostRolePreference\}\)/);
  assert.match(online,/type:'roleSelect',preference/);
  const firstScreen=html.slice(html.indexOf('<div class="online-actions">'),html.indexOf('<div id="onlineStatus"'));
  assert.doesNotMatch(firstScreen,/roomHostRole/);
  assert.match(html,/name="roomHostRole" value="random" checked/);
  assert.match(html,/name="roomHostRole" value="cat"/);
  assert.match(html,/name="roomHostRole" value="police"/);
});

test('Unassigned host recovery offers selection; assigned recovery retains the frozen role',async()=>{
  const {publicRecovery}=await import('../server/reconnection.mjs');
  const base={matchId:'room_recovery',matchType:'roomMatch',status:'matched',guestToken:'guest',profiles:{host:{playerId:'A'},guest:{playerId:'B'}}};
  const pending=publicRecovery({...base,roles:null,roleState:'waiting'},'host');
  assert.equal(pending.role,null);
  assert.equal(pending.roleSelectionReady,true);
  assert.equal(pending.roleState,'waiting');
  const guest=publicRecovery({...base,roles:null,roleState:'waiting'},'guest');
  assert.equal(guest.role,null);
  const disconnected=publicRecovery({...base,roles:null,disconnects:{guest:{}}},'host');
  assert.equal(disconnected.roleSelectionReady,false);
  const assigned=publicRecovery({...base,roles:{host:'cat',guest:'police'},selectedRolePreference:'cat'},'host');
  assert.equal(assigned.role,'cat');
  assert.equal(assigned.roleState,'selected');
  assert.equal(assigned.selectedRolePreference,'cat');
});

test('Snapshot and recovery retain assigned roles with role-specific shared skills',async()=>{
  const {roomRoles,ROOM_ROLE_PREFERENCE:P}=await load();
  const {captureMatchSkillEntitlements,resolveEffectiveSkillEntitlements}=await import('../server/skill-entitlements.mjs');
  const {publicRecovery}=await import('../server/reconnection.mjs');
  for(const preference of [P.CAT,P.POLICE]){
    const profiles={host:{playerId:'host',skillEntitlements:{skillModeUnlocked:true,ownedSkillIds:['CAT_FAKE_PAW']}},guest:{playerId:'guest',skillEntitlements:{skillModeUnlocked:true,ownedSkillIds:['POLICE_DASH']}}};
    const room={matchId:'room_test',matchType:'roomMatch',status:'matched',profiles,roles:roomRoles(preference,false),selectedRolePreference:preference};
    room.skillEntitlementSnapshot=captureMatchSkillEntitlements(room);
    for(const seat of ['host','guest']){
      const before=publicRecovery(room,seat);
      room.selectedRolePreference=seat==='host'?P.RANDOM:P.CAT;
      const after=publicRecovery(room,seat);
      assert.equal(after.role,before.role);
      const effective=resolveEffectiveSkillEntitlements(room,seat);
      assert.ok(effective.availableSkillIds.includes('CAT_FAKE_PAW'));
      assert.ok(effective.availableSkillIds.includes('POLICE_DASH'));
    }
  }
});
