/**
 * Colored-region rescue engine, reused from the existing puzzle project.
 * The board data and constraint/search algorithms are preserved. A placement
 * is a flat index (row * n + column). Theme metadata is intentionally omitted.
 */
export const LEVELS = [
{"id":1,"n":4,"regions":[0,0,1,0,2,0,0,0,0,0,0,0,0,3,0,0],"solution":[2,4,11,13],"givens":[2]},
{"id":2,"n":4,"regions":[0,1,2,2,0,0,2,2,0,0,2,2,0,0,3,2],"solution":[1,7,8,14],"givens":[7]},
{"id":3,"n":5,"regions":[0,0,0,0,0,0,0,1,0,0,0,0,2,3,4,0,2,2,3,3,0,0,2,3,3],"solution":[0,7,14,16,23],"givens":[]},
{"id":4,"n":5,"regions":[0,0,0,0,0,1,0,0,0,0,1,2,2,0,3,2,2,2,3,3,4,4,2,3,3],"solution":[3,5,12,19,21],"givens":[]},
{"id":5,"n":5,"regions":[0,0,0,1,1,0,0,0,0,2,3,0,0,0,2,3,3,0,0,0,3,3,4,4,4],"solution":[3,6,14,15,22],"givens":[]},
{"id":6,"n":5,"regions":[0,0,0,1,1,0,0,0,1,1,0,2,2,1,1,3,2,2,2,1,3,3,4,4,1],"solution":[1,9,12,15,23],"givens":[]},
{"id":7,"n":5,"regions":[0,1,1,1,1,0,1,1,1,1,2,1,1,3,1,2,2,1,1,4,4,4,4,4,4],"solution":[2,5,13,16,24],"givens":[]},
{"id":8,"n":5,"regions":[0,0,0,1,1,0,0,0,1,1,0,2,0,1,1,0,2,0,0,3,4,4,4,3,3],"solution":[0,8,11,19,22],"givens":[]},
{"id":9,"n":6,"regions":[0,1,1,2,2,2,0,0,3,2,2,2,3,3,3,2,2,3,3,3,3,3,3,3,3,3,3,4,5,5,3,3,3,3,5,5],"solution":[2,6,16,19,27,35],"givens":[]},
{"id":10,"n":6,"regions":[0,0,1,1,1,1,2,0,1,1,1,1,0,0,0,1,1,1,0,0,0,1,3,3,0,4,0,1,3,5,4,4,0,3,3,5],"solution":[3,6,14,22,25,35],"givens":[]},
{"id":11,"n":6,"regions":[0,0,0,0,1,1,2,0,0,0,1,1,2,0,0,3,1,1,4,0,0,1,1,1,4,4,5,5,5,5,4,4,5,5,5,5],"solution":[2,6,15,23,25,34],"givens":[]},
{"id":12,"n":6,"regions":[0,0,0,1,2,2,0,0,0,0,2,2,0,0,0,0,0,2,3,3,0,0,0,0,4,4,0,0,5,5,4,4,0,5,5,5],"solution":[3,11,14,18,28,31],"givens":[]},
{"id":13,"n":7,"regions":[0,1,1,1,2,2,3,0,0,0,2,2,3,3,0,0,0,0,0,3,3,0,0,4,4,3,3,5,0,0,0,0,0,3,5,0,0,6,3,3,3,3,0,0,6,3,3,3,3],"solution":[1,11,14,24,34,37,47],"givens":[]},
{"id":14,"n":7,"regions":[0,0,0,1,1,2,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,4,4,5,5,1,1,1,6,5,5,5,1,1,1,6,5,5,5,5,5,1],"solution":[5,9,18,27,29,38,42],"givens":[]},
{"id":15,"n":7,"regions":[0,0,0,0,0,1,1,2,3,0,0,0,1,1,2,3,0,0,0,0,4,2,3,0,0,0,0,0,3,3,3,5,5,5,0,6,6,5,5,5,5,5,6,6,5,5,5,5,5],"solution":[5,10,20,21,30,39,43],"givens":[]},
{"id":16,"n":7,"regions":[0,0,0,0,0,0,0,0,1,1,0,0,0,2,1,1,1,3,0,0,0,1,1,1,3,0,1,0,4,5,1,1,1,1,6,4,4,4,4,1,6,6,4,4,4,4,4,4,6],"solution":[4,13,14,24,29,40,44],"givens":[]},
{"id":17,"n":8,"regions":[0,0,0,0,1,1,1,1,2,2,3,0,0,0,0,1,2,3,3,0,0,3,3,1,3,3,3,3,3,3,1,1,3,4,3,3,5,5,1,1,4,4,3,4,4,1,1,1,6,4,4,4,4,1,1,1,4,4,4,4,1,1,1,7],"solution":[6,9,20,26,37,43,48,63],"givens":[]},
{"id":18,"n":8,"regions":[0,0,0,0,1,2,3,3,0,1,1,1,1,2,2,3,1,1,1,2,2,2,2,3,1,1,1,2,2,2,2,3,1,4,4,4,4,2,5,5,1,1,4,1,2,2,2,5,1,6,1,1,2,2,2,5,1,1,1,1,7,2,2,5],"solution":[6,8,18,29,35,47,49,60],"givens":[]},
{"id":19,"n":8,"regions":[0,0,1,1,1,2,3,2,0,4,4,1,1,2,2,2,0,4,4,4,5,2,2,2,0,4,4,4,5,2,2,2,0,4,4,4,4,4,4,4,0,0,6,4,4,4,4,4,7,7,4,4,4,4,4,4,7,7,7,7,4,4,4,4],"solution":[6,11,23,28,32,42,53,57],"givens":[]},
{"id":20,"n":8,"regions":[0,0,0,0,1,0,0,0,2,0,0,0,0,0,3,3,2,0,0,4,4,5,3,3,2,2,4,4,4,3,3,3,2,6,6,4,4,3,3,3,2,2,2,2,4,3,3,3,2,2,2,2,3,3,3,3,2,2,2,2,7,7,7,3],"solution":[4,10,21,27,33,47,48,62],"givens":[]}
];
export const RULES=Object.freeze(['每行、每列、每个色区各放一份物资。','物资之间不能相邻，斜角也不行。','给定物资不能移动。']);
const rowOf=(n,i)=>Math.floor(i/n);
const validIndex=(board,i)=>Number.isInteger(i)&&i>=0&&i<board.n*board.n;
const allPlacements=(board,placements=[])=>[...new Set([...(board.givens||[]),...placements])];
function validBoard(board){return !!board&&Number.isInteger(board.n)&&board.n>=1&&board.n<=16&&Array.isArray(board.regions)&&board.regions.length===board.n*board.n&&board.regions.every(r=>Number.isInteger(r)&&r>=0&&r<board.n);}
function pairConflicts(board,a,b){
  const n=board.n,ar=rowOf(n,a),br=rowOf(n,b),ac=a%n,bc=b%n,out=[];
  const add=(type,message,detail)=>out.push({type,indices:[a,b],message,...detail});
  if(ar===br)add('row','每行只能放一份物资。',{row:ar});
  if(ac===bc)add('col','每列只能放一份物资。',{col:ac});
  if(board.regions[a]===board.regions[b])add('region','每个色区只能放一份物资。',{region:board.regions[a]});
  if(Math.abs(ar-br)<=1&&Math.abs(ac-bc)<=1)add('adjacent','物资不能相邻，斜角也不行。',{adjacent:true});
  return out;
}
export function getConflicts(board,placements=[],index){
  if(!validBoard(board))return [{type:'invalid',indices:[],message:'关卡数据不完整。'}];
  const anchors=allPlacements(board,placements),bad=anchors.filter(i=>!validIndex(board,i));
  if(bad.length||(index!==undefined&&!validIndex(board,index)))return [{type:'invalid',indices:bad.length?bad:[index],message:'位置必须在棋盘内。'}];
  const out=[];
  if(index!==undefined){for(const other of anchors)if(other!==index)out.push(...pairConflicts(board,index,other));}
  else for(let a=0;a<anchors.length;a++)for(let b=a+1;b<anchors.length;b++)out.push(...pairConflicts(board,anchors[a],anchors[b]));
  return out;
}
export function getCandidates(board,placements=[]){
  if(!validBoard(board)||getConflicts(board,placements).length)return [];
  const anchors=allPlacements(board,placements),occupied=new Set(anchors),cells=[];
  for(let i=0;i<board.n*board.n;i++)if(!occupied.has(i)&&!getConflicts(board,anchors,i).length)cells.push(i);
  return cells;
}
function solveInternal(board,placements,limit,stats){
  if(!validBoard(board)||getConflicts(board,placements).length||limit<1)return [];
  const n=board.n,anchors=allPlacements(board,placements),selected=new Array(n).fill(-1),columns=new Set(),regions=new Set(),answers=[];
  for(const i of anchors){selected[rowOf(n,i)]=i;columns.add(i%n);regions.add(board.regions[i]);}
  function candidates(row){
    const out=[];
    for(let col=0;col<n;col++){
      const i=row*n+col;
      if(columns.has(col)||regions.has(board.regions[i]))continue;
      if(row>0&&selected[row-1]>=0&&Math.abs(col-selected[row-1]%n)<=1)continue;
      if(row<n-1&&selected[row+1]>=0&&Math.abs(col-selected[row+1]%n)<=1)continue;
      out.push(i);
    }return out;
  }
  function visit(){
    stats.nodes++;if(answers.length>=limit)return;
    let row=-1,choices=null;
    for(let r=0;r<n;r++){
      if(selected[r]!==-1)continue;
      const cells=candidates(r);if(!cells.length){stats.deadEnds++;return;}
      if(!choices||cells.length<choices.length){row=r;choices=cells;}
    }
    if(row===-1){answers.push(selected.slice());return;}
    if(choices.length>1)stats.branches++;
    for(const i of choices){
      selected[row]=i;columns.add(i%n);regions.add(board.regions[i]);visit();
      selected[row]=-1;columns.delete(i%n);regions.delete(board.regions[i]);
      if(answers.length>=limit)return;
    }
  }visit();return answers;
}
export function solve(board,placements=[],limit=2){return solveInternal(board,placements,Number.isFinite(limit)?Math.max(0,Math.floor(limit)):2,{nodes:0,branches:0,deadEnds:0});}
export function analyze(board,placements=[]){const stats={nodes:0,branches:0,deadEnds:0},solutions=solveInternal(board,placements,2,stats);return {...stats,solutionCount:solutions.length,cappedAt:2,solutions};}
export function isSolved(board,placements=[]){return validBoard(board)&&allPlacements(board,placements).length===board.n&&getConflicts(board,placements).length===0;}
/** Compatible hint API: marks are notes, never solver constraints. */
export function getHint(board,placements=[],marks=[]){
  if(!validBoard(board))return {index:-1,kind:'invalid',reason:'关卡数据不完整。'};
  const anchors=allPlacements(board,placements),fixed=new Set(board.givens||[]);
  if(isSolved(board,anchors))return {index:-1,kind:'solved',reason:'已完成全部物资布局。'};
  const answers=solve(board,anchors,1);
  if(!answers.length){
    const owned=anchors.filter(i=>!fixed.has(i));let found=null;
    for(let size=1;size<=owned.length&&!found;size++){
      const visit=(start,removed)=>{
        if(found)return;
        if(removed.length===size){if(solve(board,anchors.filter(i=>!removed.includes(i)),1).length)found=removed;return;}
        for(let j=start;j<owned.length;j++)visit(j+1,[...removed,owned[j]]);
      };visit(0,[]);
    }
    return found?{index:found[0],removeIndex:found[0],kind:'undo',reason:'当前布局无法完成，先收回这个位置的物资。'}:{index:-1,kind:'invalid',reason:'给定线索无法完成。'};
  }
  const notes=marks instanceof Set?marks:new Set(marks.length===board.n*board.n&&marks.every(x=>typeof x==='boolean')?marks.flatMap((x,i)=>x?[i]:[]):marks);
  // Correct × marks count as reasoning already done; a wrong × never feeds a deduction.
  const candidates=getCandidates(board,anchors).filter(i=>!(notes.has(i)&&!answers[0].includes(i)));let single;
  for(const unit of [i=>rowOf(board.n,i),i=>i%board.n,i=>board.regions[i]]){
    for(let u=0;u<board.n;u++){
      if(anchors.some(i=>unit(i)===u))continue;
      const left=candidates.filter(i=>unit(i)===u);if(left.length===1)single=left[0];
    }
  }
  if(single===undefined){
    // Step-by-step reasoning before any guess: a color whose open cells all sit in one row/column empties the rest of that line
    // (and a row/column whose open cells all sit in one color empties the rest of that color). Points at a cell that can be ×.
    const n=board.n,open=candidates,row=i=>rowOf(n,i),col=i=>i%n,reg=i=>board.regions[i];
    for(const [inner,outer,from,by] of [[reg,row,'region','row'],[reg,col,'region','col'],[row,reg,'row','region'],[col,reg,'col','region']]){
      for(let u=0;u<n;u++){
        if(anchors.some(i=>inner(i)===u))continue;
        const left=open.filter(i=>inner(i)===u);if(!left.length)continue;
        const line=outer(left[0]);if(!left.every(i=>outer(i)===line))continue;
        const kill=open.filter(i=>outer(i)===line&&inner(i)!==u);
        if(kill.length)return {index:kill[0],cells:kill,source:left,from,by,kind:'confine',clearMark:false,reason:'这一组格子只能放在同一行、列或色区里，其它格子可以排除。'};
      }
    }
  }
  const index=single??answers[0].find(i=>!anchors.includes(i));
  return {index,kind:single===undefined?'choice':'single',clearMark:notes.has(index),reason:single===undefined?'这个位置能通向完整解。':'某行、列或色区只剩这个位置可放。'};
}
export function togglePlacement(board,placements=[],index){
  const current=allPlacements(board,placements);
  if((board.givens||[]).includes(index))return {placements:current,changed:false,action:'fixed',conflicts:[],message:'给定物资不能收回。'};
  if(current.includes(index))return {placements:current.filter(i=>i!==index),changed:true,action:'remove',conflicts:[],message:'已收回物资。'};
  const conflicts=getConflicts(board,current,index);
  if(conflicts.length)return {placements:current,changed:false,action:'conflict',conflicts,message:conflicts[0].message};
  return {placements:[...current,index],changed:true,action:'place',conflicts:[],message:'已放置物资。'};
}
