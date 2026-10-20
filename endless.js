import { solve } from './engine.js';

/**
 * Endless mode (opens after all 20 repairs): every board is generated on the fly.
 * Same rules as LEVELS — one supply per row, column and colour region, supplies never touch (diagonals included) —
 * and every generated board has exactly one solution, checked with the engine's own solver.
 * Output has the LEVELS shape: {id, n, regions, solution, givens}.
 */
const COUNT_CAP = 32;

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

export function generateEndless(round,rand=Math.random){
  const n=endlessSize(round);
  let last=null;
  for(let attempt=0;attempt<8;attempt++){
    const solution=randomSolution(n,rand);
    if(!solution)continue;
    const regions=growRegions(n,solution,rand),seeds=new Set(solution),board={n,regions,givens:[]};
    let count=countAnswers(board);
    // Reshape region borders one cell at a time (answer cells never move, regions stay connected), keeping any change
    // that does not add answers, until only the planted answer is left.
    for(let step=0;step<800&&count>1;step++){
      const cell=Math.floor(rand()*n*n);
      if(seeds.has(cell))continue;
      const from=regions[cell],options=[...new Set(neighbours(n,cell).map(j=>regions[j]).filter(r=>r!==from))];
      if(!options.length||!connectedWithout(n,regions,from,cell))continue;
      regions[cell]=options[Math.floor(rand()*options.length)];
      const next=countAnswers(board);
      if(next<=count)count=next;else regions[cell]=from;
    }
    if(count===1)return {id:1000+round,n,regions:[...regions],solution,givens:[]};
    last={regions,solution};
  }
  // Very unlikely fallback: fix answer cells as clues until the board has one solution.
  const board={n,regions:[...last.regions],givens:[]};
  for(const cell of shuffle([...last.solution],rand)){
    if(solve(board,[],2).length===1)break;
    board.givens.push(cell);
  }
  return {id:1000+round,n,regions:board.regions,solution:last.solution,givens:board.givens.sort((a,b)=>a-b)};
}
