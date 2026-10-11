/* A recovery hint is not authority: the existing authenticated resume API decides. */
(function(root){
  'use strict';
  const KEY='nyanOnlineRecoveryV1';
  function read(){
    try{
      const value=JSON.parse(root.localStorage.getItem(KEY)||'null');
      if(!value||!value.matchId||!value.roomCode||!['roomMatch','randomMatch'].includes(value.matchType))return null;
      if(root.localStorage.getItem('nyanOnlineLastResultV1')===value.matchId)return null;
      return value;
    }catch(_){return null;}
  }
  function hasCandidate(){
    try{return /^[a-f0-9]{64}$/.test(root.localStorage.getItem('nyanChaseOnlineCredentialV1')||'')&&Boolean(read());}
    catch(_){return false;}
  }
  function save(value){
    if(!value?.matchId||!value.roomCode)return;
    try{root.localStorage.setItem(KEY,JSON.stringify({matchId:value.matchId,roomCode:value.roomCode,
      matchType:value.matchType||'roomMatch'}));}catch(_){}
  }
  function clear(){try{root.localStorage.removeItem(KEY);}catch(_) {}}
  root.NyanOnlineRecoveryState={read,hasCandidate,save,clear};
})(globalThis);
