(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NyanPoliceHardAI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const BOX_ROWS=5,BOX_COLS=5,BOX_COUNT=25,NODE_COLS=6,MAX_TURNS=11;
  const boxRow=i=>Math.floor(i/BOX_COLS),boxCol=i=>i%BOX_COLS;
  const nodeRow=i=>Math.floor(i/NODE_COLS),nodeCol=i=>i%NODE_COLS;
  const boxDistance=(a,b)=>Math.abs(boxRow(a)-boxRow(b))+Math.abs(boxCol(a)-boxCol(b));
  const nodeDistance=(a,b)=>Math.abs(nodeRow(a)-nodeRow(b))+Math.abs(nodeCol(a)-nodeCol(b));
  function boxNeighbors(i){const r=boxRow(i),c=boxCol(i),out=[];if(r>0)out.push(i-5);if(r<4)out.push(i+5);if(c>0)out.push(i-1);if(c<4)out.push(i+1);return out;}
  function boxesAroundNode(i){const r=nodeRow(i),c=nodeCol(i),out=[];[[r-1,c-1],[r-1,c],[r,c-1],[r,c]].forEach(([br,bc])=>{if(br>=0&&br<5&&bc>=0&&bc<5)out.push(br*5+bc);});return out;}
  function nodeMoves(node,dogs,di){const r=nodeRow(node),c=nodeCol(node),out=[];[[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([nr,nc])=>{const n=nr*6+nc;if(nr>=1&&nr<=4&&nc>=1&&nc<=4&&!dogs.some((p,j)=>j!==di&&p===n))out.push(n);});return out;}
  const entries=value=>value instanceof Map?[...value.entries()]:Array.isArray(value)?value:[];
  const values=value=>value instanceof Set?value:new Set(Array.isArray(value)?value:[]);
  function inferCandidates(input){
    const turn=Math.max(1,Number(input.turn)||1);
    const tracks=entries(input.revealedTracks).filter(([,t])=>Number.isInteger(t)&&t<=turn).sort((a,b)=>a[1]-b[1]);
    if(!tracks.length)return new Set(Array.from({length:BOX_COUNT},(_,i)=>i));
    const byTurn=new Map(tracks.map(([box,t])=>[t,box]));
    const emptyByTurn=new Map(entries(input.emptyByTurn).map(([t,boxes])=>[Number(t),values(boxes)]));
    const [start,startTurn]=tracks[0];
    let states=[{pos:start,visited:new Set([start])}];
    for(let t=startTurn+1;t<=turn;t++){
      const known=byTurn.get(t),empty=emptyByTurn.get(t)||new Set(),next=[];
      for(const state of states)for(const box of boxNeighbors(state.pos)){
        if(state.visited.has(box)||empty.has(box)||(Number.isInteger(known)&&box!==known))continue;
        const visited=new Set(state.visited);visited.add(box);next.push({pos:box,visited});
      }
      const unique=new Map();for(const state of next){const key=`${state.pos}:${[...state.visited].sort((a,b)=>a-b).join(',')}`;if(!unique.has(key))unique.set(key,state);}
      states=[...unique.values()];if(!states.length)break;
    }
    if(states.length)return new Set(states.map(state=>state.pos));
    // Fake or contradictory tracks must not make the police omniscient. Fall
    // back to boxes reachable from the newest public track by elapsed turns.
    const [latest,trackTurn]=tracks[tracks.length-1],distance=Math.max(0,turn-trackTurn);
    return new Set(Array.from({length:BOX_COUNT},(_,i)=>i).filter(i=>boxDistance(latest,i)<=distance));
  }
  function probabilityMap(input){
    const turn=Math.max(1,Number(input.turn)||1),tracks=entries(input.revealedTracks),possible=inferCandidates(input),searched=values(input.searchedBoxes);
    const weights=new Map();
    for(let box=0;box<BOX_COUNT;box++){
      let weight=possible.has(box)?9:.08;
      for(const [track,trackTurn] of tracks){const age=Math.max(0,turn-trackTurn),distance=boxDistance(track,box);if(distance<=age)weight+=Math.max(.2,7-age)*Math.max(.3,1-distance/(age+1));}
      if(searched.has(box))weight*=.01;
      weight*=1+boxNeighbors(box).length*.06;weights.set(box,weight);
    }
    const total=[...weights.values()].reduce((a,b)=>a+b,0)||1;weights.forEach((v,k)=>weights.set(k,v/total));return weights;
  }
  function chooseAction(input,di){
    const dogs=input.dogs||[],node=dogs[di],searched=values(input.searchedBoxes),reserved=values(input.reservedSearchTargets),probs=probabilityMap(input),remaining=Math.max(1,MAX_TURNS-(Number(input.turn)||1)+1);
    const searchCandidates=boxesAroundNode(node).filter(box=>!searched.has(box)&&!reserved.has(box));
    let bestSearch=null;
    for(const box of searchCandidates){let score=(probs.get(box)||0)*240+8;for(const other of reserved)if(boxDistance(box,other)<=1)score-=7;if(remaining<=3)score+=(probs.get(box)||0)*180;if(!bestSearch||score>bestSearch.score)bestSearch={type:'search',target:box,score};}
    let bestMove=null;
    for(const move of nodeMoves(node,dogs,di)){
      const covered=boxesAroundNode(move);let score=covered.reduce((sum,b)=>sum+(probs.get(b)||0)*210,0);
      const unique=new Set(covered);for(let j=0;j<dogs.length;j++){if(j===di||dogs[j]===null)continue;for(const b of boxesAroundNode(dogs[j]))if(unique.has(b))score-=9;const d=nodeDistance(move,dogs[j]);if(d===1)score-=4;else score+=Math.min(3,d)*1.2;}
      if(input.lastDogNodes?.[di]===move)score-=16;
      if(remaining<=3){for(const box of covered){const p=probs.get(box)||0;score+=p*(5-boxNeighbors(box).length)*90;}}
      if(!bestMove||score>bestMove.score)bestMove={type:'move',target:move,score};
    }
    if(!bestSearch)return bestMove;
    if(!bestMove)return bestSearch;
    const candidateMass=searchCandidates.reduce((sum,b)=>sum+(probs.get(b)||0),0);
    return candidateMass>=.12||bestSearch.score>=bestMove.score+4?bestSearch:bestMove;
  }
  function chooseDogAction(input,availableDogs){
    let best=null;
    for(const di of availableDogs){const action=chooseAction(input,di);if(action&&(!best||action.score>best.action.score))best={dogIndex:di,action};}
    return best;
  }
  return Object.freeze({inferCandidates,probabilityMap,chooseAction,chooseDogAction});
});
