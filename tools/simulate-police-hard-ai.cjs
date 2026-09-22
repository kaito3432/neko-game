#!/usr/bin/env node
const AI=require('../police-hard-ai.js');
const RUNS=Number(process.argv[2]||10000),SEED=Number(process.argv[3]||1),POLICY=process.argv[4]||'both';
let seed=SEED>>>0;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const br=i=>Math.floor(i/5),bc=i=>i%5,nr=i=>Math.floor(i/6),nc=i=>i%6;
const boxNeighbors=i=>{const r=br(i),c=bc(i),a=[];if(r)a.push(i-5);if(r<4)a.push(i+5);if(c)a.push(i-1);if(c<4)a.push(i+1);return a;};
const around=n=>{const r=nr(n),c=nc(n),a=[];for(const [x,y] of [[r-1,c-1],[r-1,c],[r,c-1],[r,c]])if(x>=0&&x<5&&y>=0&&y<5)a.push(x*5+y);return a;};
const moves=(node,dogs,di)=>[[nr(node)-1,nc(node)],[nr(node)+1,nc(node)],[nr(node),nc(node)-1],[nr(node),nc(node)+1]].filter(([r,c])=>r>=1&&r<=4&&c>=1&&c<=4).map(([r,c])=>r*6+c).filter(n=>!dogs.some((p,j)=>j!==di&&p===n));
function route(){for(let attempt=0;attempt<50;attempt++){let pos=Math.floor(random()*25),out=[pos],seen=new Set(out);while(out.length<11){const next=boxNeighbors(pos).filter(x=>!seen.has(x));if(!next.length)break;pos=next[Math.floor(random()*next.length)];seen.add(pos);out.push(pos);}if(out.length===11)return out;}return route();}
function baselineAction(state,di){const boxes=around(state.dogs[di]),tracks=[...state.revealedTracks],searches=state.searchesThisTurn;
  if(searches<2&&boxes.length){let best=null;for(const b of boxes){let s=state.searchedBoxes.has(b)?-8:18;if(tracks.length)s+=Math.max(...tracks.map(([t])=>7-(Math.abs(br(t)-br(b))+Math.abs(bc(t)-bc(b)))))*4;if(state.emptyBoxes.has(b))s-=25;s+=random()*2;if(!best||s>best.score)best={type:'search',target:b,score:s};}return best;}
  const options=moves(state.dogs[di],state.dogs,di);if(!options.length)return null;return {type:'move',target:options[Math.floor(random()*options.length)],score:0};}
function play(kind){const cat=route(),state={turn:1,dogs:[7,16,28],revealedTracks:new Map(),searchedBoxes:new Set(),emptyBoxes:new Set(),emptyByTurn:new Map(),lastDogNodes:[null,null,null],reservedSearchTargets:new Set(),searchesThisTurn:0};let searches=0,repeats=0,waste=0;
  for(let turn=1;turn<=11;turn++){state.turn=turn;state.searchesThisTurn=0;const available=[0,1,2];
    while(available.length){let picked;if(kind==='improved')picked=AI.chooseDogAction(state,available);else{const di=available[0],action=baselineAction(state,di);picked=action?{dogIndex:di,action}:null;}if(!picked)break;const at=available.indexOf(picked.dogIndex);available.splice(at,1);const {action,dogIndex}=picked;
      if(action.type==='move'){state.lastDogNodes[dogIndex]=state.dogs[dogIndex];state.dogs[dogIndex]=action.target;continue;}
      searches++;state.searchesThisTurn++;if(state.searchedBoxes.has(action.target)){repeats++;waste++;}state.searchedBoxes.add(action.target);
      if(action.target===cat[turn-1])return {win:1,turn,searches,repeats,waste};
      const trackTurn=cat.indexOf(action.target)+1;if(trackTurn>0&&trackTurn<=turn)state.revealedTracks.set(action.target,trackTurn);else{state.emptyBoxes.add(action.target);if(!state.emptyByTurn.has(turn))state.emptyByTurn.set(turn,new Set());state.emptyByTurn.get(turn).add(action.target);}
    }
  }return {win:0,turn:null,searches,repeats,waste};}
function run(kind){const result={policy:kind,games:RUNS,wins:0,searches:0,repeats:0,waste:0,captureTurns:Array(12).fill(0),abilityUses:{howl:0,doubleSearch:0,dash:0}};for(let i=0;i<RUNS;i++){const r=play(kind);result.wins+=r.win;result.searches+=r.searches;result.repeats+=r.repeats;result.waste+=r.waste;if(r.turn)result.captureTurns[r.turn]++;}result.winRate=Number((result.wins/RUNS*100).toFixed(2));return result;}
const output=[];if(POLICY==='both'||POLICY==='baseline')output.push(run('baseline'));if(POLICY==='both'||POLICY==='improved')output.push(run('improved'));console.log(JSON.stringify({seed:SEED,results:output},null,2));
