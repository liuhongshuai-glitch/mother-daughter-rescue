import { solve } from './engine.js';

/**
 * Endless mode (opens after all 20 repairs): every board is generated on the fly.
 * Same rules as LEVELS — one supply per row, column and colour region, supplies never touch (diagonals included) —
 * and every generated board has exactly one solution, checked with the engine's own solver.
 * On top of that, every board must be solvable from the opening without guessing, using only the two deductions the
 * in-game hint (engine.getHint) can explain: "a row/column/colour has one cell left" and "a colour's open cells all sit in
 * one row/column (or the reverse)". Boards that would need a guess are reshaped or rebuilt before the player sees them.
 * Output has the LEVELS shape: {id, n, regions, solution, givens}.
 */
const COUNT_CAP = 32;
const ATTEMPTS = 12;
const RESHAPE_STEPS = 2500;

/** Board size by round: two warm-up 6×6 boards, then 6/7 mixed, then mostly 7/8. */
export function endlessSize(round){
  if(round<=2)return 6;
  if(round<=6)return round%2?7:6;
  if(round<=12)return round%3===0?8:7;
  return round%2?8:7;
}

function shuffle(list,rand){
  for(let i=list.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
  return list;
}

/** A random answer: one cell per row and column, rows next to each other never in touching columns. */
function randomSolution(n,rand){
  const cols=new Array(n).fill(-1),used=new Set();
  const place=row=>{
    if(row===n)return true;
    for(const col of shuffle([...Array(n).keys()],rand)){
      if(used.has(col)||(row>0&&Math.abs(col-cols[row-1])<=1))continue;
      cols[row]=col;used.add(col);
      if(place(row+1))return true;
      used.delete(col);
    }
    cols[row]=-1;return false;
  };
  return place(0)?cols.map((col,row)=>row*n+col):null;
}

function neighbours(n,i){
  const r=Math.floor(i/n),c=i%n,out=[];
  if(r>0)out.push(i-n);if(r<n-1)out.push(i+n);if(c>0)out.push(i-1);if(c<n-1)out.push(i+1);
  return out;
}

/** Grow one connected colour region from each answer cell until the board is full. */
function growRegions(n,seeds,rand){
  const regions=new Array(n*n).fill(-1);
  seeds.forEach((cell,k)=>{regions[cell]=k;});
  let left=n*n-seeds.length;
  while(left>0){
    const edges=[];
    for(let i=0;i<n*n;i++)if(regions[i]>=0)for(const j of neighbours(n,i))if(regions[j]<0)edges.push([j,regions[i]]);
    const [cell,region]=edges[Math.floor(rand()*edges.length)];
    regions[cell]=region;left--;
  }
  return regions;
}

/** True when `region` stays in one piece after `skip` leaves it. */
function connectedWithout(n,regions,region,skip){
  let size=0,start=-1;
  for(let i=0;i<n*n;i++)if(regions[i]===region&&i!==skip){size++;if(start<0)start=i;}
  if(start<0)return false;
  const seen=new Set([start]),queue=[start];
  while(queue.length){
    const i=queue.pop();
    for(const j of neighbours(n,i))if(j!==skip&&regions[j]===region&&!seen.has(j)){seen.add(j);queue.push(j);}
  }
  return seen.size===size;
}

const countAnswers=board=>solve(board,[],COUNT_CAP).length;

/** Precomputed units and "placing i rules out j" masks for the deduction check. */
function deductionBoard(n,regions){
  const N=n*n,keyOf={row:i=>Math.floor(i/n),col:i=>i%n,region:i=>regions[i]},byType={};
  for(const t of ['row','col','region']){byType[t]=[];for(let k=0;k<n;k++)byType[t].push([]);}
  for(let i=0;i<N;i++)for(const t of ['row','col','region'])byType[t][keyOf[t](i)].push(i);
  const kill=[];
  for(let i=0;i<N;i++){
    const mask=new Uint8Array(N),ri=keyOf.row(i),ci=keyOf.col(i);
    for(let j=0;j<N;j++){
      if(j===i)continue;
      const rj=keyOf.row(j),cj=keyOf.col(j);
      if(ri===rj||ci===cj||regions[i]===regions[j]||(Math.abs(ri-rj)<=1&&Math.abs(ci-cj)<=1))mask[j]=1;
    }
    kill.push(mask);
  }
  return {n,N,keyOf,byType,units:[...byType.row,...byType.col,...byType.region],kill};
}

const CONFINE_PAIRS=[['region','row'],['region','col'],['row','region'],['col','region']];

/**
 * Plays the board with the hint's two deductions only. Returns {solved, left}: `left` shrinks as the deduction gets
 * further (open candidate cells plus a big weight per supply still missing), so the reshaping loop can climb on it.
 */
function deduce(B,givens=[]){
  const cand=new Uint8Array(B.N).fill(1),placed=new Uint8Array(B.N);let count=0;
  const place=i=>{placed[i]=1;cand[i]=0;count++;const mask=B.kill[i];for(let j=0;j<B.N;j++)if(mask[j])cand[j]=0;};
  const isOpen=cells=>!cells.some(i=>placed[i]);
  for(const g of givens)place(g);
  let stuck=false;
  while(count<B.n&&!stuck){
    let progressed=false;
    for(const cells of B.units){
      if(!isOpen(cells))continue;
      const left=cells.filter(i=>cand[i]);
      if(!left.length){stuck=true;break;}
      if(left.length===1){place(left[0]);progressed=true;break;}
    }
    if(stuck||progressed)continue;
    for(const [inner,outer] of CONFINE_PAIRS){
      for(const cells of B.byType[inner]){
        if(!isOpen(cells))continue;
        const left=cells.filter(i=>cand[i]);if(!left.length)continue;
        const line=B.keyOf[outer](left[0]);if(!left.every(i=>B.keyOf[outer](i)===line))continue;
        const own=new Set(cells);
        for(const i of B.byType[outer][line])if(cand[i]&&!own.has(i)){cand[i]=0;progressed=true;}
        if(progressed)break;
      }
      if(progressed)break;
    }
    if(!progressed)stuck=true;
  }
  let open=0;for(let i=0;i<B.N;i++)if(cand[i])open++;
  return {solved:count===B.n,left:open+(B.n-count)*B.N};
}

function score(n,regions){
  return {count:countAnswers({n,regions,givens:[]}),left:deduce(deductionBoard(n,regions)).left};
}

export function generateEndless(round,rand=Math.random){
  const n=endlessSize(round);
  let last=null;
  for(let attempt=0;attempt<ATTEMPTS;attempt++){
    const solution=randomSolution(n,rand);
    if(!solution)continue;
    const regions=growRegions(n,solution,rand),seeds=new Set(solution);
    let best=score(n,regions);
    // Reshape region borders one cell at a time (answer cells never move, regions stay connected), keeping any change
    // that does not add answers and does not make the no-guess deduction stop earlier, until the planted answer is the
    // only one and the deduction reaches it from the opening.
    for(let step=0;step<RESHAPE_STEPS&&!(best.count===1&&best.left===0);step++){
      const cell=Math.floor(rand()*n*n);
      if(seeds.has(cell))continue;
      const from=regions[cell],options=[...new Set(neighbours(n,cell).map(j=>regions[j]).filter(r=>r!==from))];
      if(!options.length||!connectedWithout(n,regions,from,cell))continue;
      regions[cell]=options[Math.floor(rand()*options.length)];
      const next=score(n,regions);
      if(next.count<best.count||(next.count===best.count&&next.left<=best.left))best=next;else regions[cell]=from;
    }
    if(best.count===1&&best.left===0)return {id:1000+round,n,regions:[...regions],solution,givens:[]};
    if(best.count===1||!last)last={regions:[...regions],solution};
  }
  // Very unlikely fallback: fix answer cells as clues until the board has one solution that the deduction reaches.
  const board={n,regions:[...last.regions],givens:[]};
  const B=deductionBoard(n,board.regions);
  for(const cell of shuffle([...last.solution],rand)){
    if(solve(board,[],2).length===1&&deduce(B,board.givens).solved)break;
    board.givens.push(cell);
  }
  return {id:1000+round,n,regions:board.regions,solution:last.solution,givens:board.givens.sort((a,b)=>a-b)};
}
