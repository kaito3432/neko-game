// Called only inside OnlinePlayers.blockConcurrencyWhile: pairing/cancel is serialized.
export async function matchmaking(storage, rooms, profile, action, now = Date.now()) {
  const key = `queue:${profile.playerId}`;
  const current = await storage.get(key);
  const matches = id => `match:${id}`;
  if (current?.matchId) {
    const match = await storage.get(matches(current.matchId));
    if(match && action==='cancel' && !['finished','cancelled','invalid'].includes(match.status)){
      const response=await rooms.get(rooms.idFromName(match.matchId)).fetch(new Request('https://room/internal/cancel',{method:'POST'}));
      if(response.ok){match.status='cancelled';await storage.put({[matches(match.matchId)]:match,[key]:{status:'cancelled'}});return {status:'cancelled'};}
    }
    if (match && !['finished','cancelled','invalid'].includes(match.status)) {
      const player = match.host.playerId === profile.playerId ? 'host' : 'guest';
      return {status: match.status, matchId: match.matchId, roomCode: match.matchId,
        player, token: match[`${player}Token`], role: match.roles[player]};
    }
    if (match?.status === 'finished' && action === 'status') {
      const seat=match.host.playerId===profile.playerId?'host':'guest';
      return {status:'finished',completedReceipt:{battleId:match.matchId,source:'randomMatch',side:match.roles[seat],
        won:match.result.winner===match.roles[seat],completed:true,completedAt:match.result.completedAt}};
    }
  }
  let queue = (await storage.get('queue')) || [];
  queue = queue.filter(entry => entry.expiresAt > now);
  if (action === 'cancel') {
    queue = queue.filter(entry => entry.profile.playerId !== profile.playerId);
    await storage.put({queue, [key]: {status: 'cancelled'}});
    return {status: 'cancelled'};
  }
  if (action === 'status' && current?.status !== 'waiting') return {status: current?.status || 'cancelled'};
  const existing = queue.find(entry => entry.profile.playerId === profile.playerId);
  if (existing) {
    existing.expiresAt = now + 120000;
    await storage.put('queue', queue);
    return {status: 'waiting'};
  }
  if (action === 'status') return {status: 'cancelled'};
  const peer = queue.shift();
  if (!peer) {
    queue.push({profile, enteredAt: now, expiresAt: now + 120000});
    await storage.put({queue, [key]: {status: 'waiting'}});
    return {status: 'waiting'};
  }
  const matchId = `rm_${crypto.randomUUID()}`;
  const hostIsCat = crypto.getRandomValues(new Uint8Array(1))[0] < 128;
  const match = {matchId, matchType: 'randomMatch', status: 'matched', createdAt: now,
    host: peer.profile, guest: profile,
    hostToken: crypto.randomUUID(), guestToken: crypto.randomUUID(),
    roles: {host: hostIsCat ? 'cat' : 'police', guest: hostIsCat ? 'police' : 'cat'}};
  // Persist reservation before creating the room. Retrying status reuses this match.
  await storage.put({queue, [matches(matchId)]: match,
    [`active:${peer.profile.playerId}`]:{roomCode:matchId},[`active:${profile.playerId}`]:{roomCode:matchId},
    [`queue:${peer.profile.playerId}`]: {status: 'matched', matchId},
    [key]: {status: 'matched', matchId}});
  return {status: 'matched', matchId, roomCode: matchId, player: 'guest', token: match.guestToken, role: match.roles.guest};
}

export async function ensureMatchRoom(storage, rooms, result) {
  if (!result.matchId) return result;
  const match = await storage.get(`match:${result.matchId}`);
  const room = rooms.get(rooms.idFromName(match.matchId));
  const response = await room.fetch(new Request('https://room/internal/random-init', {
    method: 'POST', body: JSON.stringify(match)
  }));
  if (!response.ok) throw new Error('room_initialization_failed');
  return result;
}
