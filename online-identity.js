/* Online identity is deliberately separate from NyanPlayerData/provider and coins. */
(function(root) {
  'use strict';
  const KEY = 'nyanChaseOnlineCredentialV1';
  let active = null;
  async function request(apiBase,path,body,method='POST'){
    const headers=savedHeaders();if(!headers)throw new Error('online_credential_missing');
    const controller=new root.AbortController(),timeout=root.setTimeout(()=>controller.abort(),15000);
    try{
      const response=await root.fetch(`${apiBase}/api/online/${path}`,{method,headers,signal:controller.signal,body:method==='GET'?undefined:JSON.stringify(body||{})});
      const value=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(value.error||`online_profile_${response.status}`);error.status=response.status;throw error;}return value;
    }finally{root.clearTimeout(timeout);}
  }
  async function prepare(apiBase) {
    if (active) return active;
    active = (async () => {
      function getCredential(){
        let secret = root.localStorage.getItem(KEY);
        if (secret && !/^[a-f0-9]{64}$/.test(secret)) throw new Error('online_credential_corrupt');
        if (!secret) {
          secret = [...root.crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
          // Store before registration: retries reuse the same identity and migration.
          root.localStorage.setItem(KEY, secret);
        }
        return secret;
      }
      const secret=root.navigator?.locks?.request
        ? await root.navigator.locks.request(KEY,getCredential) : getCredential();
      const headers = {'Content-Type': 'application/json', Authorization: `Bearer ${secret}`};
      async function post(path, body) {
        const controller=new root.AbortController();
        const timeout=root.setTimeout(()=>controller.abort(),15000);
        try{
          const response = await root.fetch(`${apiBase}/api/online/${path}`, {method: 'POST', headers, body: JSON.stringify(body),signal:controller.signal});
          if (!response.ok) throw new Error(`online_profile_${response.status}`);
          return await response.json();
        }finally{root.clearTimeout(timeout);}
      }
      // Outbox replay can call this inside the player-data serial queue.
      // Avoid recursively enqueuing load when a snapshot is already available.
      const local = root.NyanPlayerData.getSnapshot() || await root.NyanPlayerData.load();
      // First-use migration only. Repeated registration never merges local claims.
      await post('register', {playerId: local.playerId, ownedCatSkins: local.ownedCatSkins,
        ownedDogSkins: local.ownedDogSkins, equippedAppearance: local.equippedAppearance});
      await root.NyanCpuUnlockSync.flush(root.NyanPlayerData,body=>post('cpu-unlock',body));
      const {profile} = await post('appearance', {equippedAppearance: local.equippedAppearance});
      if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')
        root.dispatchEvent(new root.CustomEvent('nyan-online-profile',{detail:{profile}}));
      return {headers, profile};
    })();
    try { return await active; } finally { active = null; }
  }
  function savedHeaders(){
    try{const secret=root.localStorage.getItem(KEY);return /^[a-f0-9]{64}$/.test(secret||'')?{'Content-Type':'application/json',Authorization:`Bearer ${secret}`}:null;}catch(_){return null;}
  }
  root.NyanOnlineIdentity = {prepare,request,savedHeaders,hasCredential:()=>Boolean(savedHeaders())};
})(globalThis);
