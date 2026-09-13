/* Pure winner presentation policy. Online identity is playerId -> assigned role -> result winner. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NyanResultPresentation=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  function shouldCelebrate({playMode,winner,winnerPlayerId,session,resultStatus='finished',finishReason,official=false}={}){
    if(['invalid','cancelled'].includes(resultStatus)||finishReason==='serverInvalid'||!['cat','dogs'].includes(winner))return false;
    if(!official){return !['onlineCat','onlinePolice'].includes(playMode);}
    if(!session?.playerId||winnerPlayerId!==session.playerId||!['cat','police'].includes(session.role))return false;
    const winnerRole=winner==='cat'?'cat':'police';
    return session.role===winnerRole;
  }
  return {shouldCelebrate};
});
