/* にゃんチェイス - ルールエンジン
   UIやアニメーションに依存しないルール処理だけを置く。
*/
window.NyanEngine = (() => {
  const BOX_ROWS = 5;
  const BOX_COLS = 5;
  const NODE_ROWS = 6;
  const NODE_COLS = 6;
  const BOX_COUNT = 25;
  const NODE_COUNT = 36;
  const MAX_TURNS = 11;

  const DOGS = [
    {name:"あか柴", label:"🟥", token:"dog-red"},
    {name:"あお柴", label:"🟦", token:"dog-blue"},
    {name:"しろ柴", label:"🟨", token:"dog-cream"}
  ];

  function createState(){
    return {
      turn:1,
      phase:"catSetup",
      catPos:null,
      catVisible:false,
      catHistory:new Map(),
      revealedTracks:new Map(),
      dogs:[null,null,null],
      dogSetupCount:0,
      selectedDog:null,
      dogAction:[false,false,false],
      actionLocked:false,
      gameOver:false
    };
  }

  const boxRow = i => Math.floor(i / BOX_COLS);
  const boxCol = i => i % BOX_COLS;
  const nodeRow = i => Math.floor(i / NODE_COLS);
  const nodeCol = i => i % NODE_COLS;

  function isActiveDogNode(i){
    const r=nodeRow(i), c=nodeCol(i);
    return r>=1 && r<=4 && c>=1 && c<=4;
  }

  function getBoxNeighbors(i){
    const r=boxRow(i), c=boxCol(i), a=[];
    if(r>0) a.push(i-BOX_COLS);
    if(r<BOX_ROWS-1) a.push(i+BOX_COLS);
    if(c>0) a.push(i-1);
    if(c<BOX_COLS-1) a.push(i+1);
    return a;
  }

  function getCatLegalMoves(state){
    if(state.catPos===null) return [];
    return getBoxNeighbors(state.catPos).filter(i => !state.catHistory.has(i));
  }

  function isCatDeadEnd(state,target){
    if(!getCatLegalMoves(state).includes(target)) return false;
    return getBoxNeighbors(target)
      .filter(n => n!==state.catPos && !state.catHistory.has(n))
      .length === 0;
  }

  function getNodeNeighbors(i){
    const r=nodeRow(i), c=nodeCol(i), a=[];
    if(r>0) a.push(i-NODE_COLS);
    if(r<NODE_ROWS-1) a.push(i+NODE_COLS);
    if(c>0) a.push(i-1);
    if(c<NODE_COLS-1) a.push(i+1);
    return a;
  }

  function getDogLegalMoves(state,di){
    const cur=state.dogs[di];
    if(cur===null) return [];
    return getNodeNeighbors(cur)
      .filter(isActiveDogNode)
      .filter(t => !state.dogs.some((p,j) => j!==di && p===t));
  }

  function getBoxesAroundNode(i){
    const r=nodeRow(i), c=nodeCol(i), out=[];
    [[r-1,c-1],[r-1,c],[r,c-1],[r,c]].forEach(([br,bc])=>{
      if(br>=0 && br<BOX_ROWS && bc>=0 && bc<BOX_COLS){
        out.push(br*BOX_COLS+bc);
      }
    });
    return out;
  }

  function allDogsDone(state){
    return state.dogAction.every(a => a!==false);
  }

  function manhattanNodeDistance(a,b){
    return Math.abs(nodeRow(a)-nodeRow(b))+Math.abs(nodeCol(a)-nodeCol(b));
  }

  function boxesAroundDogs(state){
    const set=new Set();
    state.dogs.forEach(node=>{
      if(node!==null){
        getBoxesAroundNode(node).forEach(b=>set.add(b));
      }
    });
    return [...set];
  }

  return {
    BOX_ROWS, BOX_COLS, NODE_ROWS, NODE_COLS,
    BOX_COUNT, NODE_COUNT, MAX_TURNS, DOGS,
    createState, boxRow, boxCol, nodeRow, nodeCol,
    isActiveDogNode, getBoxNeighbors, getCatLegalMoves,
    isCatDeadEnd, getNodeNeighbors, getDogLegalMoves,
    getBoxesAroundNode, allDogsDone,
    manhattanNodeDistance, boxesAroundDogs
  };
})();
