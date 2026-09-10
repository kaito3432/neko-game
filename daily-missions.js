/* Match completion is persisted independently of result presentation or future ads. */
(function(root,factory){
  const model=typeof module==="object" && module.exports ? require("./progression-model.js") : root.NyanProgressionModel;
  const api=factory(root,model);
  if(typeof module==="object" && module.exports) module.exports=api;
  if(root) root.NyanDailyMissions=api;
})(typeof globalThis!=="undefined" ? globalThis : this,(root,Model)=>{
  "use strict";
  function createTracker(playerData,{now=()=>Date.now(),onChange=()=>{}}={}){
    const results=new Map();
    const failed=new Map();
    let sequence=0;
    function beginBattle(playMode,difficulty){
      const source=playMode==="cpuCat" || playMode==="cpuPolice" ? "cpu"
        : playMode.startsWith("online") ? "roomMatch" : "local";
      return {battleId:root?.crypto?.randomUUID?.() || `battle_${now()}_${++sequence}_${Math.random().toString(36).slice(2)}`,
        source,side:playMode==="cpuCat" ? "police" : "cat",difficulty,submitted:false};
    }
    function persist(event){
      const promise=playerData.recordDailyMissionBattle(event).then(data=>{
        failed.delete(event.battleId);
        results.set(event.battleId,{status:"saved",data});
        onChange();
        return data;
      }).catch(error=>{
        failed.set(event.battleId,event);
        results.set(event.battleId,{status:"pending",error});
        onChange();
        return null;
      });
      return promise;
    }
    function finishBattle(session,winner){
      if(!session || session.submitted || session.source!=="cpu" || !["cat","dogs"].includes(winner)) return Promise.resolve(null);
      session.submitted=true;
      const event={...session,won:winner===(session.side==="cat" ? "cat" : "dogs"),completed:true,completedAt:now()};
      results.set(session.battleId,{status:"saving"});
      return persist(event);
    }
    async function retry(){
      for(const event of [...failed.values()]) await persist(event);
      await playerData.retryPendingBattles();
      onChange();
    }
    function recordOnline(event){
      if(event?.source!=='randomMatch') return Promise.resolve(null);
      results.set(event.battleId,{status:'saving'});
      return persist(event);
    }
    return {beginBattle,finishBattle,recordOnline,retry,result:id=>results.get(id)};
  }
  function initialize(){
    const document=root?.document;
    const data=root?.NyanPlayerData;
    if(!document || !data) return null;
    const overlay=document.getElementById("dailyOverlay");
    const list=document.getElementById("dailyMissionList");
    const entry=document.getElementById("dailyOpenBtn");
    const notice=document.getElementById("dailyResultNotice");
    if(!overlay || !list || !entry) return null;
    let busy=false;
    let resultId=null;
    let dayTimer=null;
    let opener=entry;
    const status=document.getElementById("dailyStatus");
    const tracker=createTracker(data,{onChange:()=>{
      render();
      root.dispatchEvent(new root.CustomEvent("nyan-player-progress-changed"));
    }});
    function renderResult(){
      if(!notice) return;
      const result=tracker.result(resultId);
      const visible=document.getElementById("resultOverlay")?.classList.contains("show");
      notice.hidden=!result || !visible;
      if(notice.hidden) return;
      const snapshot=data.getSnapshot();
      const completed=snapshot?.dailyMissionProgress.missions.filter(m=>m.completed).length || 0;
      notice.textContent=result.status==="saved" ? `📅 デイリー ${completed}/3 達成・進捗を確認`
        : result.status==="pending" ? "📅 進捗の保存待ち・タップで再試行" : "📅 進捗を保存中…";
    }
    function render(){
      const snapshot=data.getSnapshot();
      if(!snapshot) return;
      const daily=snapshot.dailyMissionProgress;
      entry.textContent=`📅 デイリー ${daily.missions.filter(m=>m.completed).length}/3`;
      document.getElementById("dailyDate").textContent=`${daily.date || Model.jstDate()} · 日本時間0時更新`;
      document.getElementById("dailyCoins").textContent=String(root.NyanRankedUI?.totalCoins(snapshot.nyanCoins)??snapshot.nyanCoins);
      list.replaceChildren();
      Model.MISSIONS.forEach(rule=>{
        const mission=daily.missions.find(m=>m.id===rule.id);
        const card=document.createElement("article");
        card.className="daily-mission";
        const heading=document.createElement("h3");
        heading.textContent=rule.title;
        const progress=document.createElement("p");
        progress.textContent=`${mission.progress} / ${rule.target}　${mission.claimed ? "✓ 受取済み" : mission.completed ? "✓ 達成" : "挑戦中"}`;
        const bar=document.createElement("progress");
        bar.max=rule.target; bar.value=mission.progress;
        bar.setAttribute("aria-label",rule.title);
        const reward=document.createElement("button");
        reward.type="button";
        reward.textContent=mission.claimed ? "受取済み" : mission.completed ? `${rule.reward} にゃんコインを受け取る` : `報酬：${rule.reward} にゃんコイン`;
        reward.disabled=busy || !mission.completed || mission.claimed;
        reward.onclick=async()=>{
          if(busy) return;
          busy=true;status.textContent="保存中…";render();
          try{
            const saved=await data.claimDailyReward(daily.date,rule.id);
            const claimed=saved.dailyMissionProgress.date===daily.date && saved.dailyMissionProgress.missions.find(m=>m.id===rule.id)?.claimed;
            status.textContent=claimed ? "にゃんコインを受け取りました" : "受取を確認できませんでした。もう一度お試しください";
            root.dispatchEvent(new root.CustomEvent("nyan-player-progress-changed"));
          }catch(_){status.textContent="保存できませんでした。日付と接続を確認して、もう一度お試しください";}
          finally{busy=false;render();}
        };
        card.append(heading,progress,bar,reward);list.append(card);
      });
      renderResult();
    }
    async function refresh(){
      try{
        await tracker.retry();
        await data.refreshDailyMissions();
      }catch(_){status.textContent="進捗の保存を再試行できます。接続や端末の空き容量を確認してください";}
      render();
      root.clearTimeout(dayTimer);
      const nextDay=(Math.floor((Date.now()+32400000)/86400000)+1)*86400000-32400000;
      dayTimer=root.setTimeout(refresh,Math.max(1000,nextDay-Date.now()+50));
    }
    function open(event){
      opener=event?.currentTarget || entry;
      overlay.hidden=false;overlay.setAttribute("aria-hidden","false");
      render();refresh();document.getElementById("dailyCloseBtn").focus();
    }
    function close(){overlay.hidden=true;overlay.setAttribute("aria-hidden","true");opener.focus();}
    entry.addEventListener("click",open);
    notice?.addEventListener("click",open);
    document.getElementById("dailyCloseBtn").addEventListener("click",close);
    overlay.addEventListener("keydown",event=>{
      if(event.key==="Escape") close();
      if(event.key==="Tab"){
        const buttons=[...overlay.querySelectorAll("button:not(:disabled)")];
        if(event.shiftKey && document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus();}
        else if(!event.shiftKey && document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus();}
      }
    });
    root.addEventListener("focus",refresh);
    root.addEventListener("online",refresh);
    root.addEventListener("nyan-ranked-profile-changed",render);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden) refresh();});
    Promise.resolve(data.ready).then(refresh).catch(()=>{});
    return {...tracker,presentResult(id){resultId=id;renderResult();},hideResult(){resultId=null;if(notice) notice.hidden=true;}};
  }
  const browser=initialize();
  return Object.freeze({createTracker,beginBattle:(...a)=>browser?.beginBattle(...a),
    recordOnline:event=>browser?.recordOnline(event),
    finishBattle:(...a)=>browser?.finishBattle(...a),presentResult:id=>browser?.presentResult(id),hideResult:()=>browser?.hideResult()});
});
