import { LEVELS, getConflicts, getHint, solve, isSolved } from './engine.js';
import { renderScene, preloadScene, installationTarget, ACT_NAMES } from './scene.js';
import { createFeedback } from './feedback.js';
import { createAudio } from './audio.js';
import { createJuice } from './juice.js';
import { actVideoBusy, actVideoHeldSince } from './attic-act-video.js';
import { generateEndless } from './endless.js';

const DURATION = 180000;
// P0 modes: 'warm' (default) never fails on time; 'challenge' has a per-board-size limit and pauses while a menu is open.
const WARM_MS = 3600000;
const TIME_LIMIT_MS = {4:60000,5:100000,6:160000,7:220000,8:300000};
// Third star: no dead end (and, in challenge mode, solved within this many seconds for the board size).
const STAR_SECONDS = {4:30,5:50,6:80,7:110,8:150};
// One hint per level is free; any further hint costs the "few hints" star.
const FREE_HINTS = 1;
const limitMs = () => mode==='challenge' ? (TIME_LIMIT_MS[board?.n]||DURATION) : WARM_MS;
const DOUBLE_TAP_MS = 420;
const STORAGE = 'mother-daughter-rescue-v1';
const $ = id => document.getElementById(id);
// Watercolor 06 grid (approved web page v10): 樱花粉/湖青/珊瑚玫瑰/矢车菊蓝/暖蜂蜜/丁香紫/栗木棕/鼠尾草绿.
const palette = ['#F2A6C8','#5FADB0','#E58A86','#7FA3D6','#EDB55A','#A98CCB','#B98A66','#9BBF7A'];
// Each colour has the 5 bloom shapes of the original 06 tiles (assets/cell-ov-<colour>-<0..4>.webp).
// A board gets one stable pick per cell; neighbouring cells of the same colour never share a bloom.
const TILE_VARIANTS=5,tilePicks=new WeakMap();
function boardTiles(b){
  if(tilePicks.has(b))return tilePicks.get(b);
  let seed=b.regions.reduce((h,r,i)=>(h*31+r*7+i)%2147483647,b.n*977+13)||1;
  const rnd=n=>{seed=(seed*16807)%2147483647;return seed%n;},out=[];
  b.regions.forEach((r,i)=>{
    const left=i%b.n&&b.regions[i-1]===r?out[i-1]:-1,up=i>=b.n&&b.regions[i-b.n]===r?out[i-b.n]:-1;
    let v,t=0;do{v=rnd(TILE_VARIANTS);t++}while(t<20&&(v===left||v===up));
    out.push(v);
  });
  tilePicks.set(b,out);return out;
}
// Region motifs: one game prop per region (quilt, towel, soup, window, campfire, kettle, firewood, spoon),
// drawn as low-contrast tone-on-tone masks. Injected as a stylesheet because data URIs carry quotes.
(()=>{
  const sv=b=>`url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>${b}</svg>`)}")`;
  const st="fill='none' stroke='#000' stroke-linecap='round' stroke-linejoin='round'";
  const motifs=[
    `<path fill-rule='evenodd' d='M4 8h24v17H4z M8 12h4v4H8z M20 12h4v4h-4z M14 18h4v4h-4z M14 10h4v1h-4z'/><path d='M4 25h24v3H4z'/>`,
    `<path d='M3 5h26v3H3z'/><path fill-rule='evenodd' d='M7 8h18v18a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z M7 19h18v2H7z M7 23h18v1H7z'/>`,
    `<path d='M3 16h26c0 6.5-5.5 11-13 11S3 22.5 3 16z M10 27h12v2H10z'/><path ${st} stroke-width='2' d='M11 12c-2-2 2-4 0-7 M16 12c-2-2 2-4 0-7 M21 12c-2-2 2-4 0-7'/>`,
    `<path fill-rule='evenodd' d='M5 4h22v24H5z M8 7h7v8H8z M17 7h7v8h-7z M8 17h7v8H8z M17 17h7v8h-7z'/><path d='M3 3h26v3H3z'/>`,
    `<path d='M16 2c1 5 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 3-7 0 3 1 4 2.5 4 0-4-1-7 1.5-10z'/><path d='M4 23l22 6 1-3L5 20z M28 23L6 29l-1-3 22-6z'/>`,
    `<path d='M7 14h16v8a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z M11 10h8v3h-8z M23 16l6-5v3l-6 6z'/><circle cx='15' cy='8' r='2'/><path ${st} stroke-width='2.5' d='M7 16c-4.5 0-4.5 7 0 7'/>`,
    `<path fill-rule='evenodd' d='M3 22a6 6 0 1 0 12 0a6 6 0 1 0-12 0z M7 22a2 2 0 1 0 4 0a2 2 0 1 0-4 0z M17 22a6 6 0 1 0 12 0a6 6 0 1 0-12 0z M21 22a2 2 0 1 0 4 0a2 2 0 1 0-4 0z M10 11a6 6 0 1 0 12 0a6 6 0 1 0-12 0z M14 11a2 2 0 1 0 4 0a2 2 0 1 0-4 0z'/>`,
    `<ellipse cx='10.5' cy='10.5' rx='5.5' ry='7.5' transform='rotate(-45 10.5 10.5)'/><path ${st} stroke-width='3.5' d='M14 14l13 13'/>`
  ];
  // Watercolor motif (same as the approved web page): the cell's own wash is multiplied onto the darkened colour,
  // a turbulence mask adds mottled pigment and a slight blur softens the edges.
  const noise=`url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.055' numOctaves='3' seed='7'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.25 -.02'/></filter><rect width='120' height='120' fill='#000' opacity='.62'/><rect width='120' height='120' filter='url(#n)'/></svg>`)}")`;
  const css=motifs.map((m,g)=>`.cell.rg-${g} .motif{-webkit-mask-image:${sv(m)},${noise};mask-image:${sv(m)},${noise};-webkit-mask-size:contain,cover;mask-size:contain,cover;-webkit-mask-composite:source-in;mask-composite:intersect;background-color:color-mix(in srgb,${palette[g]} 78%,#5A3410);background-image:var(--tile);background-size:180% 180%;background-position:center;background-blend-mode:multiply;filter:blur(.35px) saturate(1.08)}`).join('\n');
  const tag=document.createElement('style');tag.id='regionMotifs';tag.textContent=css;document.head.appendChild(tag);
})();
// × mark (option F, approved 2026-10-19): two cocoa brush strokes with a slight hand-drawn wobble, centred in the cell.
(()=>{
  const defs=`<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><filter id="xRough" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="3.2"/></filter></svg>`;
  const add=()=>document.body.insertAdjacentHTML('afterbegin',defs);
  if(document.body)add();else document.addEventListener('DOMContentLoaded',add,{once:true});
})();
const X_MARK_F=`<svg class="x-mark-f" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g filter="url(#xRough)" stroke="#5A3A2A" stroke-linecap="round" fill="none"><path d="M18 16 C40 40 62 60 84 86" stroke-width="13"/><path d="M20 19 C42 42 60 62 82 83" stroke-width="7.15" opacity=".45"/><path d="M83 15 C60 38 40 62 17 85" stroke-width="13"/><path d="M80 18 C58 40 42 60 20 82" stroke-width="7.15" opacity=".45"/></g></svg>`;
const SOFT_REGIONS=new Set([1,3,6]);
const HOME_TASKS = {
  zh: [['修好天窗','接通烟囱','点燃铁炉','铺好被褥','煮一碗热汤'],
       ['封住破窗洞','挂好吊锅','生起火塘','铺好床铺','熬一锅热汤'],
       ['挂上防水布','补好地板洞','点燃铁炉','铺好床铺','煮一锅鱼汤'],
       ['修好门板','清通灶台','生起灶火','铺好碎花被','做一顿早餐']],
  en: [['Fix the skylight','Mend the stovepipe','Light the stove','Make the bed','Cook warm soup'],
       ['Seal the broken window','Hang the cooking pot','Light the hearth','Make the bunk','Simmer warm soup'],
       ['Hang the tarp','Patch the floor hole','Light the stove','Make the bed','Cook fish stew'],
       ['Fix the door','Clear the hearth','Light the hearth fire','Lay the quilt','Cook breakfast']],
};
const tasks = {get zh(){return HOME_TASKS.zh[chapter()];},get en(){return HOME_TASKS.en[chapter()];}};
// Each home has its own two signature repairs: attic skylight/pipe, stone hut window/pot, lake tarp/floor, farm door/hearth.
const SHORT_TASKS = {zh:[['天窗','烟囱','生火','铺床','热汤'],['封窗','吊锅','火塘','铺床','热汤'],['防水布','地板','生炉','铺床','鱼汤'],['门板','灶台','灶火','铺床','早餐']],
  en:[['Skylight','Pipe','Fire','Bed','Soup'],['Window','Pot','Hearth','Bed','Soup'],['Tarp','Floor','Stove','Bed','Stew'],['Door','Hearth','Fire','Bed','Breakfast']]};
const shortTasks = {get zh(){return SHORT_TASKS.zh[chapter()];},get en(){return SHORT_TASKS.en[chapter()];}};
const chapters = {zh:['雪夜的阁楼','山间石屋','湖边渔屋','两间农舍'],en:['The snowy attic','The stone hut','The lakeside hut','The farmhouse']};
const ITEMS = {zh:[['玻璃','铁管','干柴','被片','食材'],['木板','铁钩','干柴','兽皮','食材'],['防水布','木板','干柴','被片','鲜鱼'],['门板','砖块','干柴','碎花被','食材']],
  en:[['glass','pipe','firewood','patches','ingredients'],['planks','hook','firewood','furs','ingredients'],['tarp','planks','firewood','patches','fish'],['door boards','bricks','firewood','quilt','ingredients']]};
const items = {get zh(){return ITEMS.zh[chapter()];},get en(){return ITEMS.en[chapter()];}};
const CAPTIONS = {zh:[['补好天窗，雪就不会再飘进阁楼。','接通烟囱，铁炉才能安全生火。','让铁炉烧起来，暖一暖小手。','换上干燥的被褥，今晚可以安心睡了。','热汤慢慢煮好，阁楼终于像家了。'],
  ['封住破窗洞，风雪就吹不进石屋了。','把吊锅挂上三脚架，等火一起就能煮汤。','火塘烧起来，石墙也慢慢变暖。','铺好床铺，今晚可以安心睡了。','热汤咕嘟咕嘟，石屋终于像家了。'],
  ['挂上防水布，湖上的寒风挡在外面。','补好地板洞，冷气不再往上冒。','点燃铁炉，渔屋亮起来了。','铺好床铺，今晚可以安心睡了。','鱼汤煮好了，看着晚霞一起喝。'],
  ['修好门板，雪就进不了屋。','清通灶台，烟能顺利排出去。','灶火烧旺，整间屋子都暖了。','铺好碎花被，今晚可以安心睡了。','一顿热早餐，迎来温暖的清晨。']],
  en:[['Fix the skylight so the snow stops falling in.','Reconnect the stovepipe so the stove can burn safely.','Get the stove going to warm their hands.','Dry bedding for a peaceful night.','A warm bowl of soup. The attic feels like home.'],
  ['Seal the window hole so the blizzard stays out.','Hang the pot so soup can cook once the fire is up.','The hearth burns and the stone walls warm up.','A made bunk for a peaceful night.','Soup is bubbling. The stone hut feels like home.'],
  ['The tarp keeps the lake wind outside.','Patch the floor so the cold stops rising.','The stove is lit and the hut glows.','A made bed for a peaceful night.','Fish stew, shared while the sun sets.'],
  ['Fix the door so the snow stays out.','Clear the hearth so the smoke can escape.','The hearth fire warms the whole house.','The quilt is laid for a peaceful night.','A warm breakfast for a warm morning.']]};
const captions = {get zh(){return CAPTIONS.zh[chapter()];},get en(){return CAPTIONS.en[chapter()];}};
const dict = {
  zh:{undo:'撤销',hint:'提示',reset:'重来',map:'小屋地图',settings:'设置',brand:'暖一点',level:'关卡',repair:'本次修复',board:'把物资放到正确位置',rules:'每行、每列、每个色区各放一个；物资之间不能相邻，斜角也不行。',help:'单击标 × · 双击放置 / 收回 · 拖动连续排除\n键盘：方向键移动，空格标 ×，Enter 放置，Z 撤销，H 提示',footer:'一点点推理，一点点温暖。',ready:'每一次正确选择，都让小屋暖一点。',fixed:'这是已给定的物资，不能收回，也不会重复获得修复进度。',conflict:'这里与已有物资冲突',dead:'这个位置暂时不冲突，但无法完成全盘。试试撤销或提示。',placed:'物资已送到，修复又前进了一点。',removed:'物资已收回；本次已获得的修复不会重复计数。',mark:'已记下排除标记。标记只是笔记，可随时清除。',undoDone:'已撤销上一步。',noneUndo:'还没有可以撤销的操作。',resume:'继续救援',close:'返回',next:'下一项修复',retry:'再试一次',won:'又暖了一点',homeWon:'这座小屋，安心了',allWon:'她们终于有了温暖的家',failed:'还差一点点',failedText:'时间到了，这次修复还没有完成。已修好的部分会保留，准备好后再试一次。',timeLabel:'用时',seconds:'秒',restartTitle:'重新开始这一关？',restartText:'本局落子与计时将重置，已通关的修复会保留。',cancel:'继续当前关',restart:'重新开始',saved:'进度会自动保存在这台设备上',noSave:'此浏览器无法保存进度。本次仍可正常游玩。',loading:'正在准备小屋…',errorTitle:'小屋素材尚未准备好',errorText:'请保留完整游戏文件后重新打开。计时尚未开始。',reload:'重新加载',sound:'音乐',soundOn:'开启',soundOff:'关闭',language:'语言',tutorial:'玩法说明',tutorialStart:'开始救援 · 180 秒',tutorialNext:'明白了，继续',protected:'教学期间不计时',tutorialTitles:['一份物资，一个位置','先排除，再做决定','把温暖送进小屋'],tutorialBodies:['每行、每列、每个色区各放一个物资。两个物资不能横、竖或斜角相邻。标「定」的物资是线索，不能移动。','单击空格标 ×；双击放置或收回物资。按住并拖过多个格子可以连续排除。键盘也能操作。','有效的新落子会推进修复，已给定物资不计奖励。完成整盘，修复永久保存。正式开始后有 180 秒，提示和撤销随时可用。'],hintRemove:'请考虑收回高亮位置：当前落子使全盘无解。',hintPlace:'高亮位置能通向完整解。双击该格放置物资；提示不会替你落子。',hintSingle:'高亮位置所在的某行、列或色区只剩这一格可放。',clearedMark:'已清除这个候选格的排除标记。',chapterDone:'五项修复已完成，母女终于可以安心休息。',taskDone:'整盘推理完成，这项修复已永久保存。',replay:'再玩一遍',finalMap:'查看所有小屋',optionalAudio:'音乐素材未包含；仍可安静游玩。'},
  en:{undo:'Undo',hint:'Hint',reset:'Retry',map:'Homes',settings:'Settings',brand:'A little warmer',level:'Level',repair:'This repair',board:'Find a place for each supply',rules:'One supply in each row, column and colored region. Supplies cannot touch, even diagonally.',help:'Tap to mark × · Double-tap to place / remove · Drag to exclude\nKeyboard: arrows to move, Space to mark, Enter to place, Z undo, H hint',footer:'A little thought. A little warmth.',ready:'Every right choice brings a little warmth.',fixed:'This is a fixed clue. It cannot be moved and earns no repair credit.',conflict:'That clashes with a supply',dead:'This move fits locally, but leaves no complete solution. Try Undo or Hint.',placed:'A supply delivered. A little closer to a warm home.',removed:'Supply removed. Previously earned repair credit cannot be earned twice.',mark:'Exclusion noted. Marks are only notes and can be cleared.',undoDone:'Last move undone.',noneUndo:'There is nothing to undo yet.',resume:'Continue rescue',close:'Back',next:'Next repair',retry:'Try again',won:'A little warmer',homeWon:'A home at last',allWon:'A warm home, together',failed:'So close',failedText:'Time is up. This repair is unfinished. Completed repairs are safe; try this puzzle again when you are ready.',timeLabel:'Time',seconds:'sec',restartTitle:'Restart this puzzle?',restartText:'This board and timer will reset. Completed repairs will stay.',cancel:'Keep playing',restart:'Restart puzzle',saved:'Progress saves automatically on this device',noSave:'Storage is unavailable in this browser. You can still play this session.',loading:'Preparing the room…',errorTitle:'Room assets are not ready',errorText:'Keep all game files together and reopen the game. The timer has not started.',reload:'Reload',sound:'Music',soundOn:'On',soundOff:'Off',language:'Language',tutorial:'How to play',tutorialStart:'Start rescue · 180 seconds',tutorialNext:'Got it, continue',protected:'No timer during the tutorial',tutorialTitles:['One supply, one place','Exclude, then decide','Bring warmth home'],tutorialBodies:['Place one supply in each row, column and colored region. Supplies cannot touch, even diagonally. Supplies marked “fixed” are clues and cannot move.','Tap an empty cell to mark ×. Double-tap to place or remove a supply. Hold and drag across cells to exclude several at once. Keyboard controls work too.','New viable placements advance the repair. Given clues earn no credit. Solve the full board to save the repair permanently. Each puzzle allows 180 seconds, with hints and undo available.'],hintRemove:'Consider removing the highlighted supply: these placements leave no complete solution.',hintPlace:'The highlighted cell leads to a complete solution. Double-tap to place it; hints do not place supplies for you.',hintSingle:'An unfilled row, column or region has only this candidate left.',clearedMark:'The exclusion mark on this candidate has been cleared.',chapterDone:'All five repairs are complete. They can finally rest.',taskDone:'Puzzle solved. This repair is saved permanently.',replay:'Play again',finalMap:'View all homes',optionalAudio:'Music is not included. You can keep playing quietly.'},
};

dict.zh.sound='音乐与音效';dict.en.sound='Music & sounds';
// P0: a placement no longer reveals right or wrong; the timer depends on the chosen mode.
Object.assign(dict.zh,{placed:'物资已放下。对不对，要靠你自己推理。',tutorialStart:'开始救援',
  tutorialBodies:[dict.zh.tutorialBodies[0],dict.zh.tutorialBodies[1],'每放下一份新物资，修复就前进一点，但游戏不会提前告诉你放得对不对。完成整盘，修复永久保存。每关开始时可以选择是否限时（也可在设置里修改）。每关有 1 次免费提示。'],
  modeLabel:'模式',modeWarm:'温暖 · 不限时',modeChallenge:'挑战 · 限时',untimed:'不限时',
  hintCost:'免费提示已用完，这关拿不到「少用提示」星了。'});
Object.assign(dict.en,{placed:'Supply placed. Whether it is right is up to your reasoning.',tutorialStart:'Start rescue',
  tutorialBodies:[dict.en.tutorialBodies[0],dict.en.tutorialBodies[1],'Each new supply advances the repair, but the game will not tell you early whether it is right. Solve the full board to save the repair permanently. Choose untimed or timed at the start of each puzzle (or change it in Settings). Each puzzle has 1 free hint.'],
  modeLabel:'Mode',modeWarm:'Warm · untimed',modeChallenge:'Challenge · timed',untimed:'Untimed',
  hintCost:'Free hint used up: this puzzle can no longer earn the “few hints” star.'});
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE) || '{}') || {}; } catch {}
let lang = saved.lang === 'en' ? 'en' : 'zh';
let mode = saved.mode === 'challenge' ? 'challenge' : 'warm';
// Per-level scoring: hints asked, whether the board was ever left unsolvable (never shown during play), active solve time.
let hintsUsed = 0, deadEnd = false, elapsedMs = 0, lastFrame = 0;
let musicEnabled = saved.music !== false;
let completed = new Set(Array.isArray(saved.completed) ? saved.completed.filter(i=>Number.isInteger(i)&&i>=0&&i<LEVELS.length) : []);
let index = Number.isInteger(saved.index) ? Math.max(0,Math.min(LEVELS.length-1,saved.index)) : 0;
// Endless mode (opens after all 20 repairs): generated boards, played in the last home; its five repairs cycle every five boards.
// `endless` is the active run {round, board}; `endlessBest` is the highest board cleared. Kept apart from `completed` / `index`.
const endlessIndex = round => LEVELS.length-5+(round-1)%5;
const validEndless = b => !!b&&Number.isInteger(b.n)&&b.n>=4&&b.n<=8&&Array.isArray(b.regions)&&b.regions.length===b.n*b.n&&b.regions.every(r=>Number.isInteger(r)&&r>=0&&r<b.n)&&Array.isArray(b.givens)&&b.givens.every(i=>Number.isInteger(i)&&i>=0&&i<b.n*b.n)&&Array.isArray(b.solution)&&b.solution.length===b.n;
let endlessBest = Number.isInteger(saved.endlessBest) ? Math.max(0,saved.endlessBest) : 0;
let endless = completed.size===LEVELS.length&&saved.endless&&Number.isInteger(saved.endless.round)&&saved.endless.round>0&&validEndless(saved.endless.board) ? {round:saved.endless.round,board:saved.endless.board} : null;
if(endless)index=endlessIndex(endless.round);
let board, placements = new Set(), marks = new Set(), credits = new Set(), history = [], phase = 'tutorial', remainingMs = DURATION;
let deadline = 0, tutorialStep = 0, hinted = -1, hintKill = [], hintSource = [], selected = 0, loaded = false, saveWarning = false, toastTimer, lastSaveSecond = -1;
let tutorialSeen = saved.tutorialSeen === true && (saved.tutorialVersion===5 || completed.size>0 || index>0);
let coach = null;
let practiceReturn=null;
// Set while "reset progress" wipes storage and reloads, so pagehide/visibility saves cannot write the old progress back.
let wipingProgress=false;
let reaction={id:0,kind:'idle',at:0};
const feedback=createFeedback({enabled:()=>musicEnabled});
Object.defineProperty(window,'__RESCUE_FEEDBACK__',{get:()=>feedback.stats()});
const audio=createAudio({enabled:()=>musicEnabled,asset:p=>window.__ASSETS__?.[p]||p});
const juice=createJuice();
Object.defineProperty(window,'__RESCUE_AUDIO__',{get:()=>audio.stats()});
Object.defineProperty(window,'__RESCUE_JUICE__',{get:()=>juice.stats()});
let pointer = null, lastTap = null, suppressClickUntil = 0;
let resultTimer=null, resultEpoch=0, streak=0, lastCredit=-Infinity, lastTickSecond=-1, hurried=false;
const praise=['voice-nice','voice-great','voice-wow','voice-perfect','voice-amazing'];
const praiseText={zh:['不错！','很好！','哇！','完美！','太棒了！'],en:['Nice!','Great!','Wow!','Perfect!','Amazing!']};
function react(kind){
  reaction={id:reaction.id+1,kind,at:performance.now()};
  if(kind==='success'||kind==='combo'){
    const level=index,kindTask=task();
    audio.repair(kindTask,620);
    // Praise escalates with the streak (the daughter's giggle was removed: it felt abrupt on taps).
    // Tier climbs one step per streak so "wow" is reachable on the small first boards.
    const tier=streak<=1?(Math.random()<.5?0:1):Math.min(praise.length-1,streak),count=streak;
    // Praise is the reward for every credited placement; only an identical line within 1.2s is skipped.
    audio.say(praise[tier],{delay:kind==='combo'?700:780,cooldown:1200});
    if(streak>=3)audio.sting?.('combo',{streak});
    if(streak>=2){const wrap=document.querySelector('.board-wrap');let chip=wrap.querySelector('.combo-chip');if(!chip){chip=document.createElement('div');chip.className='combo-chip';chip.setAttribute('aria-hidden','true');wrap.appendChild(chip);}chip.textContent=(lang==='zh'?'连击 ×':'Combo ×')+streak;chip.dataset.tier=String(Math.min(4,streak));chip.classList.remove('show');void chip.offsetWidth;chip.classList.add('show');}
    if(streak>=2)navigator.vibrate?.(18);
    setTimeout(()=>{if(index===level)sceneLabel(praiseText[lang][tier]+(count>=2?` ×${count}`:''),tier);},640);
  }
  if(kind==='win'){audio.say('voice-warm',{delay:3100,priority:true});navigator.vibrate?.([30,60,30,60,80]);}
  if(kind==='fail'){audio.say('voice-ohno',{delay:500,priority:true});navigator.vibrate?.(220);}
  if(kind==='hurry'){audio.say('voice-hurry',{priority:true});navigator.vibrate?.([40,80,40]);}
  if(kind==='error'){audio.say('voice-notthere',{delay:120,cooldown:5000});navigator.vibrate?.(35);}
}
/** Praise pops where it covers neither the story bubble (story.js .story-strip/.story-bubble) nor a face
 *  (__RESCUE_SCENE__.faces, CSS px relative to #scene). The label rises `up` px, so its whole travel is tested. */
const labelMeasure=document.createElement('canvas').getContext('2d');
function sceneLabel(text,tier){
  const box=$('scene').getBoundingClientRect(),size=Math.round((tier>=3?34:28)*Math.min(1,Math.max(.72,box.width/380)));
  labelMeasure.font=`800 ${size}px "Microsoft YaHei","PingFang SC",system-ui,sans-serif`;
  // juice draws the label up to 1.15x with a 5px halo while it rises `up` px.
  const w=Math.min(box.width*.92,labelMeasure.measureText(text).width*1.15+12),h=size*1.25;
  let up=Math.round(Math.min(70,box.height*.22));
  const blocks=[];
  const strip=document.querySelector('.story-strip:not([hidden])');
  const bubble=strip&&(strip.querySelector('.story-bubble')||strip).getBoundingClientRect();
  if(bubble&&bubble.width&&bubble.height)blocks.push([bubble.left-6,bubble.top-6,bubble.right+6,bubble.bottom+6]);
  // The win/repair line appears ~0.3 s after this label, placed by story.js clear of both faces; its likely slot is the
  // band just above the heads, so keep the label out of it whenever the bubble is not up yet.
  // A repair/win story line lands ~0.3 s after the final placement's label, somewhere in the scene clear of the faces.
  // Then the label rises from just above the board edge instead, outside the scene, so it can meet neither.
  const lineComing=!bubble?.width&&(phase==='won'||credits.size>=Math.max(1,board.n-board.givens.length));
  if(lineComing){
    const bt=$('board').getBoundingClientRect().top,sceneBottom=$('scene').closest('.scene-wrap')?.getBoundingClientRect().bottom??box.bottom;
    const rise=Math.max(0,Math.min(up,bt-h-sceneBottom-4)),cx=box.left+box.width*.5,cy=bt-h/2-2;
    juice.label([cx,cy],text,{color:tier>=3?'#b2431f':'#7a4a12',size,up:rise,tag:'scene'});
    const r=[cx-w/2,cy-rise-h/2,cx+w/2,cy+h/2];
    labelLog.push({t:Math.round(performance.now()),rect:r.map(Math.round),blocks:blocks.map(b=>b.map(Math.round)),clear:!blocks.some(b=>r[0]<b[2]&&b[0]<r[2]&&r[1]<b[3]&&b[1]<r[3]),edge:true});
    if(labelLog.length>40)labelLog.shift();
    return;
  }
  const f=window.__RESCUE_SCENE__?.faces;
  for(const k of ['motherSpan','daughterSpan','mother','daughter']){const r=f?.[k];if(Array.isArray(r)&&r[2]>0)blocks.push([box.left+r[0]-4,box.top+r[1]-4,box.left+r[0]+r[2]+4,box.top+r[1]+r[3]+4]);}
  // Label box for a centre point: its travel from y to y-up, clamped inside the scene frame.
  const rect=([x,y])=>[x-w/2,y-up-h/2,x+w/2,y+h/2];
  const hits=r=>blocks.some(b=>r[0]<b[2]&&b[0]<r[2]&&r[1]<b[3]&&b[1]<r[3]);
  const inside=r=>r[0]>=box.left+2&&r[2]<=box.right-2&&r[1]>=box.top+2&&r[3]<=box.bottom+2;
  // Opposite side from the bubble first, then just above the board edge (bottom of the scene), then below the bubble.
  const bubbleLeft=bubble&&bubble.width&&(bubble.left+bubble.right)/2<box.left+box.width/2;
  const L=box.left+w/2+8,R=box.right-w/2-8,C=box.left+box.width/2,sideX=bubbleLeft?R:L,otherX=bubbleLeft?L:R;
  const cands=()=>{const low=box.bottom-h/2-6,top=box.top+up+h/2+6;
    return [[sideX,top],[sideX,(top+low)/2],[sideX,low],[C,low],[otherX,low],[otherX,(top+low)/2],
      ...(bubble&&bubble.height?[[C,Math.min(low,bubble.bottom+up+h/2+8)],[sideX,Math.min(low,bubble.bottom+up+h/2+8)]]:[])];};
  let at=null;
  // A shorter rise is better than covering a face: shrink the travel until some spot is clear.
  for(const rise of [up,Math.round(up*.6),Math.round(up*.3),0]){up=rise;at=cands().find(p=>inside(rect(p))&&!hits(rect(p)));if(at)break;}
  if(!at){up=0;at=cands().find(p=>!hits(rect(p)))||[C,box.bottom-h/2-6];}
  juice.label(at,text,{color:tier>=3?'#b2431f':'#7a4a12',size,up,tag:'scene'});
  labelLog.push({t:Math.round(performance.now()),rect:rect(at).map(Math.round),blocks:blocks.map(b=>b.map(Math.round)),clear:!hits(rect(at))});
  if(labelLog.length>40)labelLog.shift();
}
const labelLog=[];
Object.defineProperty(window,'__RESCUE_LABELS__',{get:()=>labelLog.map(x=>({...x}))});
/** Map a point in the 900×600 scene design space to page coordinates (the room covers the canvas, centred). */
function scenePoint(sx,sy){
  const box=$('scene').getBoundingClientRect(),room=window.__RESCUE_SCENE__?.faces?.room;
  // The scene reports where the 900×600 room sits (painted acts are fitted, legacy rooms cover).
  if(room&&room[2]>0)return [box.left+room[0]+sx*room[2]/900,box.top+room[1]+sy*room[3]/600];
  const s=Math.max(box.width/900,box.height/600);
  return [box.left+(box.width-900*s)/2+sx*s,box.top+(box.height-600*s)/2+sy*s];
}
function cancelAudioEvents(){audio.cancel();}
/** Music mood follows the round: brisk when the clock is short, hushed under the result stings. */
function musicMood(mood){
  if(mood==='hurry'){audio.setMusicRate?.(1.09);audio.setMusicVolume(.36);}
  else if(mood==='win'){audio.setMusicRate?.(1);audio.setMusicVolume(.1);}
  else if(mood==='fail'){audio.setMusicRate?.(.9);audio.setMusicVolume(.12);}
  else{audio.setMusicRate?.(1);audio.setMusicVolume(.3);}
}
const t = key => dict[lang][key];
const task = () => index % 5;
const chapter = () => Math.floor(index/5);
const need = () => Math.max(1,board.n-board.givens.length);
const doneTasks = () => endless ? [...Array(task()+(phase==='won'?1:0)).keys()] : [...completed].filter(i=>Math.floor(i/5)===chapter()).map(i=>i%5).sort();
const levelName = () => endless ? (lang==='zh'?`无限 · 第 ${endless.round} 盘`:`Endless · Board ${endless.round}`) : (lang==='zh'?`第 ${index+1} 关`:`Level ${index+1}`);
const progress = () => (!endless&&completed.has(index)) || phase==='won' ? 1 : Math.min(.98,credits.size / Math.max(1,board.n-board.givens.length));
const asset = path => window.__ASSETS__?.[path] || path;
const uiAsset = name => asset(`assets/ui-${name}.webp`);
const uiImg = name => `<img class="ui-icon" src="${uiAsset(name)}" alt="" draggable="false">`;
// Every skinned container/button reads its assetgen bitmap through a CSS variable; asset() keeps the offline build self-contained.
Object.entries({'--ui-rays':'rays','--ui-step-silver':'step-silver','--ui-btn-green-gold':'btn-green-gold','--ui-ribbon-ice':'ribbon-ice','--ui-title-plate':'title-plate','--ui-level-medal':'level-medal','--ui-wood':'bg-wood','--ui-ice':'bg-ice','--ui-frost-edge':'frost-edge','--ui-panel':'panel','--ui-frame':'board-frame','--ui-tile':'tile','--ui-btn-cream':'btn-cream','--ui-btn-gold':'btn-gold','--ui-btn-green':'btn-green','--ui-plaque':'plaque-cream','--ui-plaque-wood':'plaque-wood','--ui-bar':'bar','--ui-banner':'banner','--ui-tag':'tag-gold','--ui-ribbon':'ribbon-gold','--ui-ribbon-blue':'ribbon-blue','--ui-round':'round-base','--ui-tail':'bubble-tail','--ui-step-done':'step-done','--ui-step-current':'step-current','--ui-step-locked':'step-locked','--ui-warning':'icon-warning','--ui-lock':'icon-lock','--ui-medallion':'medallion','--ui-hud-round':'hud-round','--ui-hud-pill':'hud-pill','--ui-hud-card':'hud-card','--ui-hud-map':'hud-map','--ui-hud-settings':'hud-settings','--ui-tool-undo':'tool-undo','--ui-tool-hint':'tool-hint','--ui-tool-restart':'tool-restart'})
  .forEach(([key,name])=>document.documentElement.style.setProperty(key,`url("${uiAsset(name)}")`));
document.querySelectorAll('img[data-ui]').forEach(img=>{img.src=uiAsset(img.dataset.ui);img.draggable=false;});
// Frost ferns on both page edges (variant D): 5 baked melt frames per side, frame k = k repairs done; after all 5 the frost is gone.
// Stacked with the later (smaller) frames underneath; renderText() fades between the two frames around the current thaw.
// v17: the corner branches were removed on request — no frost-side layers are created any more (renderText() just iterates an empty list).
const frostFrames=[];
// Player-selectable page background (Settings → 背景). Stored under its own key so "重置进度" keeps the look the player chose.
const BG_KEY='mother-daughter-rescue-bg';
const BACKGROUNDS=[
  {id:'ice',src:'assets/ui-bg-ice.webp',zh:'星空雪原',en:'Starry snowfield'},
  {id:'aurora',src:'assets/bg-options/1-aurora.webp',zh:'极光雪夜',en:'Aurora night'},
  {id:'dusk',src:'assets/bg-options/2-dusk-cabin.webp',zh:'暮色小屋',en:'Dusk cabin'},
  {id:'moon',src:'assets/bg-options/3-moon-forest.webp',zh:'月下雪林',en:'Moonlit forest'},
  {id:'window',src:'assets/bg-options/4-frost-window.webp',zh:'霜花窗景',en:'Frosted window'},
  {id:'morning',src:'assets/bg-options/5-pastel-morning.webp',zh:'晴雪清晨',en:'Snowy morning'},
  {id:'lantern',src:'assets/bg-options/6-lantern-night.webp',zh:'灯笼雪夜',en:'Lantern night'}];
let bgId=(()=>{try{return localStorage.getItem(BG_KEY)||'ice';}catch{return 'ice';}})();
const currentBg=()=>BACKGROUNDS.find(b=>b.id===bgId)||BACKGROUNDS[0];
function applyBackground(id){
  if(id&&BACKGROUNDS.some(b=>b.id===id))bgId=id;
  document.documentElement.style.setProperty('--ui-ice',`url("${asset(currentBg().src)}")`);
  try{localStorage.setItem(BG_KEY,bgId);}catch{}
}
applyBackground();
// The UI font is fixed to 寒蝉圆黑 in style.css; drop the key left by the short-lived font picker.
try{localStorage.removeItem('mother-daughter-rescue-font');localStorage.removeItem('mother-daughter-rescue-font-v2');}catch{}
// ?autostart=1 is the test seam that skips the level-start card; the timer then starts at once, as before.
const autostart=new URLSearchParams(location.search).get('autostart')==='1';
let sceneShot={before:'',after:'',fail:''},introPending=false,continueState='fresh',beatTimers=[],conflictCells=new Set(),conflictTimer=0;
const cloneState = () => ({placements:[...placements],marks:[...marks]});
function notify(text){$('toast').textContent=text;$('toast').toggleAttribute('data-short',[...text].length<=24);
  // A compact pill in the empty band between the task strip and the board frame's snowy top edge,
  // so it never covers board rows. Falls back to the frame's bottom rail when there is no task strip above the board.
  const board=$('board').getBoundingClientRect(),toastH=$('toast').offsetHeight||40,head=document.querySelector('.task-heading')?.getBoundingClientRect();
  const frameTop=board.top-board.height*.17;
  if(head&&head.height&&head.bottom<frameTop&&head.left<board.right&&head.right>board.left){
    const top=Math.max(head.bottom+4,(head.bottom+frameTop)/2-toastH/2);
    $('toast').style.top=`${Math.round(top)}px`;$('toast').style.bottom='auto';
  }else{
    $('toast').style.top='';
    $('toast').style.bottom=`${Math.max(16,innerHeight-board.bottom+Math.max(2,(parseFloat(getComputedStyle($('board')).borderBottomWidth)||14)-toastH/2))}px`;
  }$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2700);}
function message(text){$('message').textContent=text;if([t('conflict'),t('dead'),t('fixed'),t('hintRemove'),t('hintSingle'),t('hintPlace')].includes(text))notify(text);else{clearTimeout(toastTimer);$('toast').classList.remove('visible');$('toast').textContent='';}}
function persist(){
  if(practiceReturn||wipingProgress)return;
  try{localStorage.setItem(STORAGE,JSON.stringify({version:1,index,completed:[...completed],lang,mode,music:musicEnabled,tutorialSeen,tutorialVersion:5,endless:endless?{round:endless.round,board:endless.board}:null,endlessBest,current:{...cloneState(),credits:[...credits],phase,remainingMs,elapsedMs,hintsUsed,deadEnd,savedAt:Date.now(),continueUsed:continueState==='used'}}));}
  catch{if(!saveWarning){saveWarning=true;notify(t('noSave'));}}
}
function snapshot(){
  return Object.freeze({index,n:board.n,regions:[...board.regions],givens:[...board.givens],placements:[...placements],marks:[...marks],phase,remainingMs:phase==='playing'?Math.max(0,deadline-performance.now()):remainingMs,progress:progress(),completedTasks:doneTasks(),tutorialStep,mode,hintsUsed,elapsedMs:Math.round(elapsedMs)});
}
Object.defineProperty(window,'__RESCUE_STATE__',{configurable:false,get:snapshot});
function setBoard(next){
  cancelAudioEvents();
  react('idle');
  index=next;const source=endless&&next===endlessIndex(endless.round)?endless.board:LEVELS[index];
  board={id:source.id,n:source.n,regions:[...source.regions],givens:[...source.givens]};
  placements=new Set();marks=new Set();credits=new Set();history=[];hinted=-1;hintKill=[];hintSource=[];selected=0;remainingMs=limitMs();hintsUsed=0;deadEnd=false;elapsedMs=0;
  if(lastTap)clearTimeout(lastTap.timer);
  lastTap=null;pointer=null;streak=0;lastCredit=-Infinity;hurried=false;lastTickSecond=-1;
  musicMood('normal');
  renderBoard();renderText();
}
function cleanCells(value){return Array.isArray(value)?value.filter(i=>Number.isInteger(i)&&i>=0&&i<board.n*board.n&&!board.givens.includes(i)):[];}
function restoreCurrent(current){
  // A refreshed puzzle resumes straight into play (no start card); a continue is once per level, so one taken before the refresh stays taken.
  introPending=false;continueState=current.continueUsed?'used':'fresh';
  placements=new Set(cleanCells(current.placements));marks=new Set(cleanCells(current.marks).filter(i=>!placements.has(i)));
  if(getConflicts(board,[...placements]).length){placements.clear();marks.clear();}
  // A saved credit must itself be viable with the fixed clues; never trust arbitrary stored indices.
  // Credits are a high-water count of placed supplies (they no longer encode correctness), capped at the board's need.
  credits=new Set(cleanCells(current.credits).slice(0,need()));
  hintsUsed=Math.max(0,Number(current.hintsUsed)||0);deadEnd=current.deadEnd===true;elapsedMs=Math.max(0,Number(current.elapsedMs)||0);
  // The clock is paused while the game is closed; warm mode has no limit to run out.
  remainingMs=mode==='warm'?WARM_MS:Math.max(0,Math.min(limitMs()+60000,Number(current.remainingMs)||0));
  phase=current.phase==='won'&&isSolved(board,[...placements])?'won':current.phase==='failed'||remainingMs<=0?'failed':'playing';
  if(phase==='won')completed.add(index);
  deadline=performance.now()+remainingMs;
  renderBoard();renderText();
}
function stepMedals(done,active){
  return shortTasks[lang].map((name,i)=>`<span class="task-step ${done.includes(i)?'done':i===active?'active':''}" role="img" aria-label="${i+1} ${name}${done.includes(i)?lang==='zh'?' 已完成':' done':''}">${done.includes(i)?'':i+1}</span>`).join('');
}
function renderText(){
  document.documentElement.lang=lang==='zh'?'zh-CN':'en';
  document.title=lang==='zh'?'暖一点 · 母女救援':'A little warmer · Mother & daughter rescue';
  $('brand').innerHTML=`${endless?(lang==='zh'?'无限模式':'Endless'):lang==='zh'?`小屋 ${chapter()+1}/4`:`Home ${chapter()+1}/4`}<small>${chapters[lang][chapter()]}</small>`;$('brand').parentElement.setAttribute('aria-label',`${chapters[lang][chapter()]} · ${chapter()+1}/4`);
  $('quickLanguage').textContent=lang==='zh'?'EN':'中文';
  $('quickLanguage').setAttribute('aria-label',lang==='zh'?'Switch to English':'切换中文');
  $('board').setAttribute('aria-label',lang==='zh'?'救援数独棋盘':'Rescue puzzle board');
  $('scene').setAttribute('aria-label',lang==='zh'?'等待修复的小屋':'A family waiting for a warm home');
  $('mapButton').setAttribute('aria-label',t('map'));$('mapButton').querySelector('.sr-only').textContent=t('map');$('settingsButton').setAttribute('aria-label',t('settings'));
  $('chapterLabel').textContent=`${String(chapter()+1).padStart(2,'0')} / ${chapters[lang][chapter()]}`;
  $('levelLabel').textContent=levelName();
  $('eyebrow').textContent=`${t('repair')} ${task()+1} / 5${!endless&&completed.has(index)?lang==='zh'?' · 重温（修复已保存）':' · Replay (repair saved)':''}`;
  $('taskTitle').textContent=tasks[lang][task()];$('sceneCaption').textContent=captions[lang][task()];
  $('boardTitle').textContent=t('board');$('rules').textContent=t('rules');
  $('gestureHelp').innerText=t('help');$('footer').textContent=t('footer');
  document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  $('taskSteps').innerHTML=stepMedals(doneTasks(),task());
  const repairIcon=asset(`assets/prop-${task()}.webp`);if($('repairIcon').getAttribute('src')!==repairIcon)$('repairIcon').src=repairIcon;
  $('placedCount').textContent=`${placements.size+board.givens.length} / ${board.n}`;
  $('repairFill').style.width=`${progress()*100}%`;
  // Frost on the page edges thaws with the home: each of the 5 repairs (plus the current one's progress) melts a fifth.
  const thawed=(doneTasks().filter(i=>i!==task()).length+progress())/5;
  document.body.style.setProperty('--frost',Math.max(0,Math.min(1,1-thawed)).toFixed(3));
  // Melt frames are nested (frame k+1 is a subset of frame k): keep frame a+1 solid underneath and fade frame a out on top.
  const melt=Math.max(0,Math.min(5,thawed*5)),meltA=Math.min(4,Math.floor(melt)),meltP=melt-meltA;
  frostFrames.forEach(frames=>frames.forEach((layer,k)=>{const o=k===meltA?1-meltP:k===meltA+1?1:0;if(layer.style.opacity!==String(o))layer.style.opacity=o;}));
  $('repairText').textContent=`${Math.min(credits.size,need())} / ${need()}`;
  $('undoButton').disabled=(phase!=='playing'&&!coachFree())||!history.length;
  $('hintButton').disabled=phase!=='playing';
  $('resetButton').disabled=!loaded||phase==='tutorial';
  const intro=introPending&&phase==='playing'&&!coach;
  document.body.classList.toggle('intro-open',intro);
  if(intro){
    const need=board.n-board.givens.length;
    $('levelStart').innerHTML=`<span class="level-start-tag">${levelName()}</span><span class="level-start-medal"><img src="${asset(`assets/prop-${task()}.webp`)}" alt=""></span><span class="level-start-copy"><strong>${lang==='zh'?`目标：${tasks.zh[task()]}`:`Goal: ${tasks.en[task()]}`}</strong><span>${lang==='zh'?`放好 ${need} 份${items.zh[task()]}，${shortTasks.zh[task()]}就修好了`:`Place ${need} ${items.en[task()]} to finish the repair`}</span>${modePicker()}</span>`;
    $('playButton').textContent=lang==='zh'?'开始修复':'Play';
    fitIntroDim();
  }
  updateClock();
  renderCoach();
}
// 开局遮罩一直铺到屏幕底部，让「开始修复」按钮和遮罩在同一层（方案 B）
// 结算遮罩（修好了/时间到）也复用同一套：铺到屏幕底部 + 顶部接到任务卡下沿并渐隐
function fitIntroDim(layer=$('levelIntro')){
  const op=layer&&layer.offsetParent;if(!op)return;
  const r=op.getBoundingClientRect(),s=op.offsetHeight?r.height/op.offsetHeight:1;
  document.documentElement.style.setProperty('--dimB',`${Math.min(0,Math.round((r.bottom-innerHeight)/(s||1)))}px`);
  // 接缝柔化：遮罩顶部向上延伸到任务卡下沿，再用渐变从透明过渡到全暗，不再出现一条硬边
  const t=document.querySelector('.task-heading')?.getBoundingClientRect();
  const up=t&&t.height&&t.bottom<=r.top+4?Math.round((t.bottom-r.top)/(s||1)):0;
  document.documentElement.style.setProperty('--dimT',`${Math.min(0,up)}px`);
}
addEventListener('resize',()=>{if(document.body.classList.contains('intro-open'))fitIntroDim();else if(document.body.classList.contains('banner-on'))fitIntroDim($('resultBanner'));});
const clockText=ms=>{const s=Math.ceil(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
function timeTag(){
  if(mode!=='challenge')return lang==='zh'?'不限时 · 慢慢来':'Untimed · take your time';
  return lang==='zh'?`限时 ${clockText(limitMs())}`:`${clockText(limitMs())} to solve`;
}
/** Level-start mode picker: the player chooses untimed / timed for this board before pressing Play (the choice is remembered). */
function modePicker(){
  const zh=lang==='zh',challenge=mode==='challenge';
  const limit=clockText(mode==='challenge'?limitMs():(TIME_LIMIT_MS[board?.n]||DURATION));
  const opt=(id,on,label)=>`<button type="button" class="mode-opt${on?' on':''}" data-start-mode="${id}" role="radio" aria-checked="${on}">${label}</button>`;
  return `<span class="level-start-mode" role="radiogroup" aria-label="${zh?'是否限时':'Timer'}">${uiImg('icon-clock')}${opt('warm',!challenge,zh?'不限时':'Untimed')}${opt('challenge',challenge,zh?`限时 ${limit}`:`Timed ${limit}`)}</span>`;
}
function updateClock(){
  const seconds=Math.ceil(remainingMs/1000),warm=mode!=='challenge';
  $('time').textContent=phase==='tutorial'?(lang==='zh'?'练习中':'Practice'):warm?t('untimed'):clockText(remainingMs);
  $('clock').classList.toggle('urgent',!warm&&phase==='playing'&&remainingMs<=30000);
  $('clock').setAttribute('aria-label',warm?t('untimed'):`${lang==='zh'?'剩余':'Remaining'} ${seconds} ${t('seconds')}`);
}
// What each cell showed last render ('' / g / p / x), so only a cell whose token just changed replays its pop-in.
let shownBoard=null,shownTokens=[];
function renderBoard(){
  $('board').style.setProperty('--n',board.n);
  $('board').setAttribute('aria-rowcount',board.n);$('board').setAttribute('aria-colcount',board.n);
  const tiles=boardTiles(board),xMark=X_MARK_F;
  const sameBoard=shownBoard===board,prevTokens=shownTokens;shownBoard=board;shownTokens=[];
  $('board').innerHTML=board.regions.map((region,i)=>{
    const given=board.givens.includes(i),placed=placements.has(i),marked=marks.has(i),row=Math.floor(i/board.n),col=i%board.n;
    const token=given?'g':placed?'p':marked?'x':'';shownTokens[i]=token;
    const isNew=sameBoard&&token!==''&&prevTokens[i]!==token;
    const edgeRight=col<board.n-1&&region!==board.regions[i+1],edgeBottom=row<board.n-1&&region!==board.regions[i+board.n];
    const label=lang==='zh'?`第${row+1}行，第${col+1}列，色区${region+1}${given?'，给定物资':placed?'，已放置物资':marked?'，已排除':''}`:`Row ${row+1}, column ${col+1}, region ${region+1}${given?', fixed supply':placed?', supply placed':marked?', excluded':''}`;
    return `<button class="cell ${isNew?'fresh':''} ${given?'given':''} ${placed?'placed':''} ${marked?'marked':''} ${edgeRight?'r-edge':''} ${edgeBottom?'b-edge':''} ${hinted===i||hintKill.includes(i)?'hinted':''} ${hintSource.includes(i)?'hint-source':''} ${conflictCells.has(i)?'conflict-hit':''} rg-${region} ${SOFT_REGIONS.has(region)?'soft':''}" data-cell="${i}" role="gridcell" aria-label="${label}" aria-selected="${given||placed}" tabindex="${selected===i?0:-1}" style="--region:${palette[region]};--tile:url('${asset(`assets/cell-ov-${region}-${tiles[i]}.webp`)}')"><span class="motif" aria-hidden="true"></span><span class="token">${given||placed?`<img src="${asset(`assets/prop-${task()}.webp`)}" alt="" draggable="false">`:marked?xMark:''}</span></button>`;
  }).join('');
  renderCoach();
}
function remember(){history.push(cloneState());if(history.length>80)history.shift();}
function canAct(){
  if(introPending&&phase==='playing'&&!$('modal').open)beginPlay();
  if(phase==='tutorial'&&coach&&!$('modal').open)return coachFree()||(!coach.awaiting&&!!coachStep());
  if(phase!=='playing'||$('modal').open)return false;
  remainingMs=Math.max(0,deadline-performance.now());
  if(remainingMs<=0){finish(false);return false;}
  return true;
}
function updateAfterMove(){
  hinted=-1;hintKill=[];hintSource=[];
  const oldCredits=credits.size;
  // Progress is the high-water mark of supplies on the board: it rises for any legal placement, so it reveals nothing about correctness.
  for(const i of placements){if(credits.size>=placements.size)break;credits.add(i);}
  if(credits.size>oldCredits){
    const now=performance.now();streak=now-lastCredit<9000?streak+1:1;lastCredit=now;
    react(streak>=2?'combo':'success');
    if(streak>=2)audio.play('combo',{rate:Math.min(1.5,1+(streak-2)*.12)});
    juice.pulse($('repairTrack'),'#f2b441');juice.bounce($('repairFill'),1.06);
  }
  renderBoard();renderText();persist();
  if(isSolved(board,[...placements]))finish(true);
}
function place(i){
  if(!canAct())return;
  if(coach){
    const step=coachStep(),zh=lang==='zh';
    if(coachFree()){
      // Free phase: every move is allowed; only the move that completes the board also ends the tutorial.
      if(!board.givens.includes(i)&&!placements.has(i)&&!getConflicts(board,[...placements],i).length&&isSolved(board,[...placements,i])){
        const resume=!!practiceReturn;completeCoach(true);
        if(!resume)place(i);
        return;
      }
      coach.note='';coach.last=i;
    }else if(step?.kind==='finish'){
      // Last step: double-tapping the only open cell ends the tutorial and places the final plank in one go.
      if(!step.cells.includes(i)){
        coachNote(zh?'不是这一格。找唯一没打 × 的空位。':'Not this one. Find the only cell without an ×.');
        audio.play('wrong');juice.shake($('board').querySelector(`[data-cell="${i}"]`),4,200);return;
      }
      const resume=!!practiceReturn;completeCoach(true);
      if(!resume)place(i);
      return;
    }else if(step?.kind!=='place'||!coachTargets().includes(i)){message(zh?'先按提示处理亮起的格子，也可以点「跳过」。':'Follow the highlighted cells first, or skip.');return;}
  }
  if(board.givens.includes(i)){message(t('fixed'));return;}
  if(placements.has(i)){remember();placements.delete(i);react('remove');audio.play('whoosh',{volume:.35,rate:.8});message(t('removed'));const cellEl=$('board').querySelector(`[data-cell="${i}"]`);juice.burst(cellEl,'dust',8);updateAfterMove();feedback.pop(cellEl);return;}
  const conflicts=getConflicts(board,[...placements],i);
  if(conflicts.length){
    const cell=$('board').querySelector(`[data-cell="${i}"]`);cell?.classList.add('conflict');setTimeout(()=>cell?.classList.remove('conflict'),350);

    showConflict(i,conflicts);
    juice.shake($('board'),5,240);juice.shake(cell,4,200);
    react('error');message(t('conflict'));audio.play('wrong');streak=0;return;
  }
  remember();placements.add(i);marks.delete(i);
  // No free right/wrong verdict: a dead end is only recorded (it costs the third star) and never signalled during play.
  if(!solve(board,[...placements],1).length)deadEnd=true;
  audio.play('pop',{volume:.22});
  message(t('placed'));
  const cellEl=$('board').querySelector(`[data-cell="${i}"]`);
  {
    juice.burst(cellEl,'sparkle',14);juice.bounce(cellEl,1.1);
    const fresh=placements.size>credits.size;
    if(fresh&&cellEl){
      // One flight only: the token leaves the board and lands exactly where the scene installs it.
      const img=new Image();img.src=asset(`assets/prop-${task()}.webp`);
      const nextProgress=Math.min(.98,(credits.size+1)/Math.max(1,board.n-board.givens.length));
      const [sx,sy]=installationTarget(task(),nextProgress);
      audio.play('whoosh',{delay:60,volume:.15});
      juice.fly(cellEl,scenePoint(sx,sy),img,{duration:.64,size:Math.max(34,cellEl.getBoundingClientRect().width*.7),onArrive:pt=>{juice.burst(pt,'sparkle',18);audio.play('sparkle',{volume:.45});}});
    }
  }
  updateAfterMove();
  feedback.pop(cellEl?.querySelector('.token'));
  feedback.pop($('repairTrack'));
  if(coach&&!coachFree()&&coachStep()?.kind==='place'){coach.last=i;coachSuccess();}
}
function mark(i,force,record=true){
  if(!canAct()||board.givens.includes(i)||placements.has(i))return;
  if(coach&&!coachFree()){
    const step=coachStep();
    if(step?.kind==='finish')return;
    if(step?.kind==='place'||!coachTargets().includes(i))return;
  }
  const value=force===undefined?!marks.has(i):force;
  if(marks.has(i)===value)return;
  if(record)remember();
  if(value)marks.add(i);else marks.delete(i);
  if(coach)coach.note='';
  hinted=-1;hintKill=hintKill.filter(c=>!marks.has(c));if(!hintKill.length)hintSource=[];message(value?t('mark'):t('clearedMark'));renderBoard();persist();
  if(value)audio.play('mark-tap',{volume:.35,rate:.95+Math.random()*.1});else feedback.play('unmark');
  const markCell=$('board').querySelector(`[data-cell="${i}"]`);juice.bounce(markCell?.querySelector('.token'),1.2,220);
  $('undoButton').disabled=!history.length;
  if(coach&&!coachFree()&&value&&['line','ring','zone'].includes(coachStep()?.kind)&&!coachTargets().length)coachSuccess();
}
function undo(){
  if(phase!=='playing'&&!coachFree())return;
  if(!canAct())return;
  const old=history.pop();if(!old){message(t('noneUndo'));return;}
  placements=new Set(old.placements);marks=new Set(old.marks);hinted=-1;hintKill=[];hintSource=[];
  renderBoard();renderText();persist();message(t('undoDone'));streak=0;
  audio.play('whoosh',{volume:.4,rate:.75});feedback.play('undo');feedback.pop($('board'));
}
function hint(){
  if(phase!=='playing')return;
  if(!canAct())return;
  const suggestion=getHint(board,[...placements],[...marks]);hinted=suggestion.index;hintKill=[];hintSource=[];
  if(suggestion.kind==='confine'){
    // A reasoning step, not an answer: show the cells that force it (dashed) and the cells it rules out (glowing).
    hinted=-1;hintKill=suggestion.cells;hintSource=suggestion.source;hintsUsed++;
    const zh=lang==='zh';
    const from={region:zh?'虚线框里这个颜色':'This color (dashed)',row:zh?'虚线框里这一行':'This row (dashed)',col:zh?'虚线框里这一列':'This column (dashed)'}[suggestion.from];
    const by={row:zh?'一行':'row',col:zh?'一列':'column',region:zh?'一种颜色':'color'}[suggestion.by];
    const text=zh?`${from}剩下的空位都在同${by}里，它的木板一定在这几格中，所以同${by}里亮起的格子都可以标 ×。`:`${from} has all its open cells in one ${by}, so its plank must be there. Mark the other lit cells of that ${by} ×.`;
    message(text);notify(hintsUsed===FREE_HINTS+1?`${text} ${t('hintCost')}`:text);persist();renderBoard();
    audio.play('hint-harp');hintKill.forEach(c=>{const el=$('board').querySelector(`[data-cell="${c}"]`);juice.pulse(el,'#ffd86b');feedback.pop(el);});
    return;
  }
  if(suggestion.clearMark){remember();marks.delete(hinted);persist();}
  if(suggestion.kind!=='solved'&&suggestion.kind!=='invalid')hintsUsed++;
  const hintText=t(suggestion.kind==='undo'?'hintRemove':suggestion.kind==='single'?'hintSingle':'hintPlace');
  message(hintText);
  if(hintsUsed===FREE_HINTS+1)notify(`${hintText} ${t('hintCost')}`);
  persist();
  renderBoard();$('undoButton').disabled=!history.length;
  const hintCell=$('board').querySelector(`[data-cell="${hinted}"]`);
  audio.play('hint-harp');juice.pulse(hintCell,'#ffd86b');juice.burst(hintCell,'sparkle',10);feedback.pop(hintCell);
}
function cancelResult(){clearTimeout(resultTimer);resultTimer=null;resultEpoch++;beatTimers.forEach(clearTimeout);beatTimers=[];hideBanner();}
/** One beat of the win/fail sequence; any dialog, restart or level change (cancelResult) drops the pending beats. */
function later(ms,fn){const epoch=resultEpoch,id=setTimeout(()=>{beatTimers=beatTimers.filter(x=>x!==id);if(resultEpoch===epoch)fn();},ms);beatTimers.push(id);}
function showBanner(kind){
  const el=$('resultBanner');el.dataset.kind=kind;
  el.innerHTML=kind==='win'
    ?`<img class="banner-rays" src="${uiAsset('rays')}" alt=""><img class="banner-item" src="${asset(`assets/prop-${task()}.webp`)}" alt=""><strong class="banner-ribbon">${lang==='zh'?'修好了！':'Well Done!'}</strong><span class="banner-sub">${tasks[lang][task()]}</span>`
    :`<span class="banner-snow" aria-hidden="true">${'<i></i>'.repeat(10)}</span><img class="banner-item frost" src="${uiAsset('icon-frozen-clock')}" alt=""><strong class="banner-ribbon">${lang==='zh'?'时间到！':'Out of time!'}</strong>`;
  el.hidden=false;document.body.classList.add('banner-on');fitIntroDim(el);
}
function hideBanner(){const el=$('resultBanner');if(el&&!el.hidden){el.hidden=true;el.innerHTML='';}document.body.classList.remove('banner-on');}
/** Level-start card: the clock is frozen (deadline tracks now) until Play, or until the first board action. */
function beginPlay(){
  if(!introPending)return;
  introPending=false;remainingMs=limitMs();deadline=performance.now()+remainingMs;elapsedMs=0;lastSaveSecond=-1;
  renderText();persist();audio.play('whoosh',{volume:.35});juice.bounce($('board'),1.03,320);
}
function clearConflict(){
  clearTimeout(conflictTimer);conflictCells=new Set();
  const svg=$('conflictLinks');if(svg)svg.innerHTML='';
  $('board').querySelectorAll('.conflict-hit').forEach(c=>c.classList.remove('conflict-hit','conflict-origin'));
  $('board').querySelectorAll('.conflict-ghost').forEach(g=>g.remove());
}
/** Wrong move: every clashing supply gets a red frame, joined to the tapped cell by a short-lived red link. */
function showConflict(i,found){
  clearConflict();
  // getConflicts returns rule objects ({type,indices:[i,other]}); the marks need the distinct clashing cells.
  const others=[...new Set(found.flatMap(c=>Array.isArray(c?.indices)?c.indices:Number.isInteger(c)?[c]:[]))].filter(c=>c!==i&&Number.isInteger(c));
  conflictCells=new Set([i,...others]);
  const cells=[i,...others].map(c=>$('board').querySelector(`[data-cell="${c}"]`));
  cells.forEach((c,k)=>c?.classList.add('conflict-hit',...(k===0?['conflict-origin']:[])));
  const origin=cells[0],svg=$('conflictLinks');
  if(origin){
    origin.querySelector('.token')?.insertAdjacentHTML('beforeend',`<img class="conflict-ghost" src="${asset(`assets/prop-${task()}.webp`)}" alt="" draggable="false">`);
    const box=svg.parentElement.getBoundingClientRect(),pt=el=>{const r=el.getBoundingClientRect();return [r.left+r.width/2-box.left,r.top+r.height/2-box.top,r.width];};
    const [x0,y0,w]=pt(origin);
    svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
    // A gently bowed link from the tapped cell to each clashing supply, drawn in from the tapped end.
    svg.innerHTML=cells.slice(1).filter(Boolean).map(el=>{const [x1,y1]=pt(el),mx=(x0+x1)/2,my=(y0+y1)/2,dx=x1-x0,dy=y1-y0,len=Math.hypot(dx,dy)||1,k=Math.min(26,len*.22);
      const cx=mx-dy/len*k,cy=my+dx/len*k;return `<path d="M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}" style="--len:${Math.ceil(len*1.2)}"/><circle cx="${x1}" cy="${y1}" r="${w*.44}"/>`;}).join('')+`<circle class="origin" cx="${x0}" cy="${y0}" r="${w*.44}"/>`;
  }
  conflictTimer=setTimeout(clearConflict,900);
}
function continuePlay(){
  if(phase!=='failed'||continueState!=='offer')return;
  continueState='used';phase='playing';remainingMs=60000;deadline=performance.now()+60000;hurried=false;lastTickSecond=-1;lastSaveSecond=-1;
  closeModal();musicMood('normal');react('idle');renderText();persist();playMusic();
  juice.bounce($('clock'),1.2,420);juice.pulse($('clock'),'#9fd24a');
}
function openModal(html,kind='info'){
  cancelResult();
  // The running-timer reminder is a slim pill just above the buttons, as in the mockups; travel skips it (no timer shown there).
  const long=kind==='settings';
  // Challenge mode pauses its clock while any menu is open (see frame); warm mode has no clock to mention.
  const notice=mode==='challenge'&&phase==='playing'&&!introPending&&kind!=='travel'?`<p class="timer-notice${long?' long':''}">${uiImg('icon-clock')}${long?(lang==='zh'?'打开菜单时，挑战计时会暂停。':'The challenge timer pauses while a menu is open.'):(lang==='zh'?'计时已暂停':'Timer paused')}</p>`:'';
  // The world map is a full-screen page, not a card: entering / leaving it cross-fades instead of FLIP-morphing sizes.
  const wasMap=$('modal').dataset.kind==='map',pageSwap=$('modal').open&&(wasMap||kind==='map')&&wasMap!==(kind==='map');
  $('modal').dataset.kind=kind;
  const anchor=long&&/<p class="dialog-foot/.test(html)?/(<p class="dialog-foot)/:/(<div class="dialog-actions)/;
  // Card → card while the dialog stays open: remember the old size and hero spot so the new card can grow out of them.
  const box=$('modal'),calm=matchMedia('(prefers-reduced-motion: reduce)').matches,morph=box.open&&!pageSwap&&kind!=='map'&&!calm;
  const before=morph?{box:box.getBoundingClientRect(),hero:box.querySelector('.result-hero')?.getBoundingClientRect()}:null;
  $('modalContent').innerHTML=notice?(anchor.test(html)?html.replace(anchor,`${notice}$1`):html+notice):html;
  if(before)morphModal(box,before);
  else if(pageSwap&&!calm)box.animate([{opacity:0,transform:'scale(.97)'},{opacity:1,transform:'none'}],{duration:260,easing:'cubic-bezier(.22,.8,.3,1)'});
  if(!$('modal').open){$('modal').showModal();document.activeElement?.blur?.();}
}
/** FLIP between two cards of the open dialog: the panel eases to its new height, a shared hero picture glides from its
 *  old spot (same painting on the win and story cards, so it looks like it never moved), and the rest fades up. */
function morphModal(box,before){
  const ms=380,easing='cubic-bezier(.22,.8,.3,1)',after=box.getBoundingClientRect(),hero=box.querySelector('.result-hero');
  if(Math.abs(after.height-before.box.height)>2){
    box.classList.add('morphing');
    box.animate([{boxSizing:'border-box',height:`${before.box.height}px`},{boxSizing:'border-box',height:`${after.height}px`}],{duration:ms,easing})
      .finished.finally(()=>box.classList.remove('morphing'));
  }
  let fading=[...$('modalContent').children];
  if(hero&&before.hero){
    // Offsets are taken relative to the panel, because the panel itself is re-centred by the height animation.
    const now=hero.getBoundingClientRect(),s=before.hero.width/now.width;
    const dx=(before.hero.left-before.box.left)-(now.left-after.left),dy=(before.hero.top-before.box.top)-(now.top-after.top);
    hero.animate([{transformOrigin:'0 0',transform:`translate(${dx}px,${dy}px) scale(${s})`},{transformOrigin:'0 0',transform:'none'}],{duration:ms,easing});
    fading=fading.filter(el=>el!==hero);
  }
  fading.forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:300,delay:90+Math.min(i,5)*35,easing,fill:'backwards'}));
}
function closeModal(){if($('modal').open)$('modal').close();}
function actions(buttons,layout=''){return `<div class="dialog-actions ${layout}">${buttons.map(([id,label,primary,icon])=>`<button id="${id}" class="${primary?'primary':'secondary'}">${icon?uiImg(icon):''}<span>${label}</span></button>`).join('')}</div>`;}
function stepRow(){return `<div class="result-steps track" aria-hidden="true">${stepMedals(doneTasks(),phase==='won'?-1:task())}</div>`;}
function tutorial(revisit=false){
  window.__RESCUE_STORY__?.clear();
  if(revisit&&phase!=='tutorial'){
    remainingMs=phase==='playing'?Math.max(0,deadline-performance.now()):remainingMs;
    practiceReturn={index,current:{...cloneState(),credits:[...credits],phase,remainingMs,elapsedMs,hintsUsed,deadEnd,savedAt:Date.now()},history:[...history]};
    coach=null;
  }
  if(revisit){coach=null;tutorialStep=0;}
  closeModal();
  if(!coach){
    setBoard(0);phase='tutorial';tutorialStep=0;
    const steps=buildCoachSteps();
    coach={steps,awaiting:false};
    if(!steps.length){completeCoach();return;}
  }
  message(lang==='zh'?'直接在棋盘上试一试，教学期间不计时。':'Practice on the board. The timer is paused.');
  renderBoard();renderText();
}
/** Scripted walkthrough derived from the level itself: every placed supply first rules out its row and column,
 *  then the ring of 8 neighbours; the next supply is always the one a colour/row/column leaves no choice for. */
function buildCoachSteps(from){
  const n=board.n,sol=solve(board,[],1)[0];if(!sol||!board.givens.length)return [];
  const rc=i=>[Math.floor(i/n),i%n];
  const placed=new Set(from?from.placed:board.givens),ruled=new Set(from?from.ruled:[]),steps=[];
  const exclude=(p,first)=>{
    const [r,c]=rc(p),line=[],ring=[];
    for(let i=0;i<n*n;i++){
      if(placed.has(i)||ruled.has(i))continue;
      const [a,b]=rc(i);
      if(a===r||b===c)line.push(i);else if(Math.abs(a-r)<=1&&Math.abs(b-c)<=1)ring.push(i);
    }
    if(first){if(line.length)steps.push({kind:'line',reason:p,cells:line});if(ring.length)steps.push({kind:'ring',reason:p,cells:ring});}
    else if(line.length+ring.length)steps.push({kind:'zone',reason:p,cells:[...line,...ring].sort((x,y)=>x-y)});
    line.concat(ring).forEach(i=>ruled.add(i));
  };
  if(from)exclude(from.fresh,false);else board.givens.forEach((g,k)=>exclude(g,k===0));
  for(let guard=0;guard<n*n;guard++){
    if(sol.filter(i=>!placed.has(i)).length<=1){steps.push({kind:'finish',reason:-1,cells:sol.filter(i=>!placed.has(i))});return steps;}
    const open=[...Array(n*n).keys()].filter(i=>!placed.has(i)&&!ruled.has(i));
    let pick=null;
    for(const [by,key] of [['region',i=>board.regions[i]],['row',i=>rc(i)[0]],['col',i=>rc(i)[1]]]){
      const groups=new Map();open.forEach(i=>groups.set(key(i),[...(groups.get(key(i))||[]),i]));
      for(const [k,cells] of groups)if(cells.length===1&&![...placed].some(p=>key(p)===k)){pick={cell:cells[0],by};break;}
      if(pick)break;
    }
    if(!pick||!sol.includes(pick.cell))return [];
    steps.push({kind:'place',reason:-1,cells:[pick.cell],by:pick.by});
    placed.add(pick.cell);exclude(pick.cell,false);
  }
  return [];
}
function coachStep(){return coach?.steps?.[tutorialStep]||null;}
/** From the first "place" step on, the walkthrough drops the glove and highlights and guides with text only. */
function coachFree(){
  if(!coach)return false;
  // The first "place" step is still guided by glove + highlights; only the steps after it are text-only.
  if(coach.freeFrom===undefined){const first=coach.steps.findIndex(s=>s.kind==='place');coach.freeFrom=first<0?-1:first+1;}
  return coach.freeFrom>=0&&tutorialStep>=coach.freeFrom;
}
function coachSolution(){return coach.sol??=(solve(board,[],1)[0]||[]);}
function coachNote(text){if(!coach)return;coach.note=text;renderCoach();}
/** Free-phase guidance, read off the board as it is right now (the player may do anything, in any order). */
function coachGuide(zh){
  const n=board.n,sol=coachSolution(),rc=i=>[Math.floor(i/n),i%n];
  const planks=[...board.givens,...placements],isPlank=i=>planks.includes(i);
  const wrongPlank=[...placements].find(i=>!sol.includes(i));
  if(wrongPlank!==undefined)return zh?['这块木板放得不对','这样整盘会走不通。双击它拿掉，或者点「撤销」。']:['That plank won’t work','The board can’t be finished this way. Double-tap it to remove it, or Undo.'];
  const blocked=p=>{const [r,c]=rc(p);return [...Array(n*n).keys()].filter(i=>{if(isPlank(i))return false;const [a,b]=rc(i);return a===r||b===c||Math.abs(a-r)<=1&&Math.abs(b-c)<=1;});};
  const order=coach.last!==undefined&&isPlank(coach.last)?[coach.last,...planks.filter(p=>p!==coach.last)]:planks;
  for(const p of order){
    const left=blocked(p).filter(i=>!marks.has(i)).length;
    if(left)return zh?['新木板也一样排除',`把它的同行、同列和周围一圈都标上 ×，还剩 ${left} 格。`]:['The new plank rules out cells too',`Mark its row, column and surrounding ring ×. ${left} left.`];
  }
  if(sol.some(i=>!isPlank(i)&&marks.has(i)))return zh?['有一个 × 打错了','木板其实能放在某个打了 × 的格子里。再点一下可以取消 ×。']:['One × is wrong','A plank belongs under one of your ×. Tap a cell again to clear its ×.'];
  const remaining=sol.filter(i=>!isPlank(i));
  if(remaining.length===1)return zh?['只剩最后一格了！','其它格子都排除了。双击唯一没打 × 的格子完成修理。']:['Only one cell is left!','Everything else is ruled out. Double-tap the last open cell to finish.'];
  const open=[...Array(n*n).keys()].filter(i=>!isPlank(i)&&!marks.has(i));
  for(const [by,key] of [['region',i=>board.regions[i]],['row',i=>rc(i)[0]],['col',i=>rc(i)[1]]]){
    const groups=new Map();open.forEach(i=>groups.set(key(i),(groups.get(key(i))||0)+1));
    for(const [k,count] of groups)if(count===1&&!planks.some(p=>key(p)===k)){
      const who={region:zh?'有一种颜色':'One color',row:zh?'有一行':'One row',col:zh?'有一列':'One column'}[by];
      return zh?[`${who}只剩一格能放`,'找到那个还没打 × 的空位，双击放下木板。']:[`${who} has only one open cell`,'Find the cell without an ×, then double-tap it to place a plank.'];
    }
  }
  return zh?['找只剩一个空位的地方','看看哪种颜色、哪一行或哪一列只剩一格没打 ×。']:['Look for a single open cell','Find a color, row or column with only one cell left without an ×.'];
}
function coachTargets(){
  const step=coachStep();if(!step)return [];
  return step.kind==='place'?step.cells:step.cells.filter(i=>!marks.has(i));
}
function coachSuccess(){
  // No "Next" button and no pause: move straight on to the next step.
  tutorialStep++;coach.awaiting=false;coach.note='';lastTap=null;renderCoach();
}
function renderCoach(){
  if(!$('boardCoach'))return;
  $('boardCoach').hidden=!coach;
  document.body.classList.toggle('coaching',!!coach);
  const free=coachFree(),step=coachStep(),targets=free?[]:coachTargets();
  const zone=!free&&step&&step.kind!=='place'&&step.kind!=='finish'?step.cells:[];
  $('board').querySelectorAll('[data-cell]').forEach(cell=>{
    const id=Number(cell.dataset.cell),target=targets.includes(id),reason=!free&&!!step&&step.reason===id,inZone=zone.includes(id);
    cell.classList.toggle('coach-target',!!coach&&target);
    cell.classList.toggle('coach-reason',!!coach&&reason);
    cell.classList.toggle('coach-zone',!!coach&&inZone&&!target);
    cell.classList.toggle('coach-muted',!!coach&&!free&&!!step&&!target&&!reason&&!inZone);
    cell.querySelector('.coach-hand')?.remove();
    cell.classList.toggle('coach-hand-host',false);
    if(coach&&!coach.awaiting&&id===targets[0]){
      const hand=document.createElement('img');hand.className=`coach-hand ${step.kind==='place'||step.kind==='finish'?'double-hand':''}`;hand.src=uiAsset('glove-hand');hand.alt='';hand.draggable=false;cell.append(hand);cell.classList.add('coach-hand-host');
    }
  });
  if(!coach||(!step&&!free))return;
  const zh=lang==='zh';
  const by={region:zh?'这个颜色':'This color',row:zh?'这一行':'This row',col:zh?'这一列':'This column'}[step?.by]||'';
  const copy=free?coachGuide(zh):{
    line:zh?['同一行、同一列都不会再有木板','每行每列只放一块。点一下（或按住划过）亮起的格子，标上 ×。']:['Nothing else in this row or column','One plank per row and column. Tap (or swipe) the lit cells to mark ×.'],
    ring:zh?['周围一圈也不会有木板','木板不能挨着，斜角也算。把它四周亮起的格子标 ×。']:['Nothing in the ring around it','Planks never touch, not even diagonally. Mark the lit cells ×.'],
    place:zh?[`${by}只剩一格能放`,'每种颜色、每行、每列各一块。双击它放下木板。']:[`${by} has only one cell left`,'One per color, row and column. Double-tap it to place a plank.'],
    zone:zh?['新木板也一样排除','它的同行、同列和周围一圈都不会再有木板，把亮起的格子标 ×。']:['The new plank rules out cells too','Its row, column and surrounding ring are now empty. Mark the lit cells ×.'],
    finish:zh?['只剩最后一格了！','其它格子都排除了。点「开始本关」，双击它完成修理。']:['Only one cell is left!','Everything else is ruled out. Press Start, then double-tap it.']
  }[step?.kind];
  const success={
    line:zh?['整行整列排除了！','虚线框就是被这块木板“占住”的范围。']:['Row and column cleared!','The dashed cells are blocked by this plank.'],
    ring:zh?['周围一圈排除了！','以后每放一块，都先排除同行、同列和一圈。']:['Ring cleared!','After every plank: rule out its row, column and ring.'],
    place:zh?['木板送到了！','看，破窗补上了一块。']:['Plank delivered!','Look, the window is mending.'],
    zone:zh?['排除完成！','剩下没打 × 的格子，就是下一块的候选。']:['All ruled out!','Unmarked cells are the only candidates left.']
  }[step?.kind];
  const line=!free&&coach.awaiting&&success?success:copy;
  const note=coach.note?`<span class="coach-note">${coach.note}</span>`:`<span>${line[1]}</span>`;
  const placedCount=placements.size,needed=board.n-board.givens.length;
  const tag=free?(zh?`自由练习 · 木板 ${placedCount}/${needed}`:`Free practice · planks ${placedCount}/${needed}`):`${tutorialStep+1}/${coach.steps.length}`;
  $('coachText').innerHTML=`<small>${zh?'不计时练习':'Untimed practice'} · ${tag}</small><strong>${line[0]}</strong>${note}`;
  $('coachSkip').textContent=!free&&step?.kind==='finish'?(zh?'开始本关':'Start'):(zh?'跳过':'Skip');
  $('coachSkip').onclick=completeCoach;
}
function completeCoach(viaBoard){
  if(practiceReturn){
    const old=practiceReturn;practiceReturn=null;coach=null;tutorialStep=3;
    setBoard(old.index);restoreCurrent({...old.current,savedAt:Date.now()});history=old.history;
    renderText();persist();if(phase==='won'||phase==='failed')resultModal();return;
  }
  coach=null;tutorialStep=3;tutorialSeen=true;phase='playing';remainingMs=limitMs();deadline=performance.now()+remainingMs;elapsedMs=0;hintsUsed=0;deadEnd=false;
  lastTap=null;pointer=null;history=[];
  renderBoard();renderText();persist();playMusic();
  // Finished by placing the last plank: the win sequence follows at once, so the opening line would talk over it.
  if(viaBoard===true)return;
  message(lang==='zh'?'学会了！继续完成这一盘，正确放置会修好天窗。':'You are ready! Finish this puzzle to fix the skylight.');
  // The act I title card plays first (~2.6 s), then the opening lines.
  audio.sting?.('coach-done');window.__RESCUE_STORY__?.opening(chapter(),{delay:2900});
}
function start(next,{quiet=false}={}){
  cancelResult();
  practiceReturn=null;
  coach=null;
  closeModal();setBoard(next);phase='playing';sceneShot={before:'',after:'',fail:''};setTimeout(()=>{if(index===next&&!sceneShot.before)sceneShot.before=snapScene();},700);remainingMs=limitMs();deadline=performance.now()+remainingMs;
  // Level 1 is the tutorial board: its first real round starts without the card.
  introPending=!autostart&&next>0;continueState='fresh';clearConflict();
  message(t('ready'));renderText();persist();playMusic();
  if(!quiet)audio.sting?.('level-start');window.__RESCUE_STORY__?.clear();
  // Three acts per home: act I opens the home, acts II/III open after 2 and 4 finished repairs.
  // Endless boards skip the home's act openings (the story is over; only the per-repair lines stay).
  if(endless){}
  else if(next%5===0)window.__RESCUE_STORY__?.opening(chapter(),{delay:2900});
  else{const n=doneTasks().length;if(n===2||n===4)window.__RESCUE_STORY__?.act?.(chapter(),n/2,{delay:700});}
}
/** Story beats between levels: the home keeps every finished repair, so the card tells what that repair changed
 *  for the pair and why the next one comes next. Text lives in story.js (bridge / journey / prologue). */
function storyLines(story){
  return story?.lines?.length?`<div class="story-lines">${story.lines.map(l=>`<p class="story-line ${l.who}"><img src="${l.avatar}" alt=""><span><b>${l.name}</b>${l.text}</span></p>`).join('')}</div>`:'';
}
function storyCard(next){
  const story=window.__RESCUE_STORY__?.bridge?.(chapter(),task());
  if(!story){start(next);return;}
  const home=['attic','stone','lake','farm'][chapter()],done=doneTasks().length,nextTask=HOME_TASKS[lang][chapter()][next%5];
  // Same painting, same hero frame as the win card just before it (see morphModal), so the switch reads as one card turning its page.
  openModal(`<div class="result-hero"><img class="result-room" src="${asset(`assets/act-${home}-${done}.webp`)}" alt=""></div><h2>${story.title}</h2><div class="dialog-kicker wheat"><img src="${uiAsset('wheat')}" alt="">${lang==='zh'?`故事 · ${chapters.zh[chapter()]} ${done} / 5`:`Story · ${chapters.en[chapter()]} ${done} / 5`}<img src="${uiAsset('wheat')}" alt=""></div><p class="story-text-block">${story.text}</p>${storyLines(story)}<p class="story-next">${lang==='zh'?`下一项修复：<b>${nextTask}</b>`:`Next repair: <b>${nextTask}</b>`}</p>${actions([['storyButton',lang==='zh'?'继续修复':'Keep repairing',true]])}`,'story');
  // "Next repair" (which opens this card) and "Keep repairing" sound the same: just the button click, no level-start chime.
  $('storyButton').onclick=()=>start(next,{quiet:true});
}
/** The ending after all 20 repairs, then the map. */
function showEnding(){
  const story=window.__RESCUE_STORY__?.journey?.(3);
  if(!story){showMap();return;}
  openModal(`<div class="result-hero"><img class="result-room" src="${asset('assets/ending-lamp.webp')}" alt=""></div><h2>${story.title}</h2><div class="dialog-kicker wheat"><img src="${uiAsset('wheat')}" alt="">${lang==='zh'?'终章':'Epilogue'}<img src="${uiAsset('wheat')}" alt=""></div><p class="story-text-block">${story.text}</p>${storyLines(story)}${actions([['endingButton',t('finalMap'),false],['endlessButton',lang==='zh'?'开启无限模式':'Endless mode',true]])}`,'story');
  $('endingButton').onclick=showMap;
  $('endlessButton').onclick=showEndlessIntro;
}
/** Endless mode card (from the epilogue or the map): same hero / ribbon / kicker layout as the epilogue card. */
function showEndlessIntro(){
  const zh=lang==='zh',next=endlessBest+1,current=endless&&endless.round===next&&phase!=='won';
  const note=endlessBest?(zh?`已完成 ${endlessBest} 盘`:`${endlessBest} boards cleared`):(zh?'灯一直亮着，还会有人在雪夜里赶路。':'The lamp stays lit; more travellers are on the snowy road.');
  const go=current?(zh?`继续第 ${next} 盘`:`Resume board ${next}`):(zh?`开始第 ${next} 盘`:`Start board ${next}`);
  openModal(`<div class="result-hero"><img class="result-room" src="${asset(`assets/act-farm-${endlessBest%5}.webp`)}" alt=""></div><h2>${zh?'帮更多人修小屋':'Warm more homes'}</h2><div class="dialog-kicker wheat"><img src="${uiAsset('wheat')}" alt="">${zh?'无限模式':'Endless mode'}<img src="${uiAsset('wheat')}" alt=""></div><p class="story-text-block">${zh?'每一盘棋盘都会自动生成，答案只有一个。从 6×6 开始，越往后棋盘越大；每 5 盘修好一间小屋。':'Every board is generated for you and has exactly one answer. Boards start at 6×6 and grow; every 5 boards warm one home.'}</p><p class="dialog-note">${note}</p>${actions(endlessBest?[['endlessRestart',zh?'从第 1 盘开始':'From board 1',false],['endlessGo',go,true]]:[['endlessGo',go,true]],'row')}${actions([['endlessBack',zh?'返回地图':'Back to map',false]])}`,'story');
  $('endlessGo').onclick=()=>{if(current){closeModal();if(phase==='failed')resultModal();return;}startEndless(next);};
  if(endlessBest)$('endlessRestart').onclick=()=>startEndless(1);
  $('endlessBack').onclick=showMap;
}
function startEndless(round){
  endless={round,board:generateEndless(round)};
  start(endlessIndex(round));
}
/** Prologue before chapter 1: five illustrated cards (the night they were sent away), then `done`.
 *  Shown once on a fresh start before the tutorial, and re-readable from the story book. */
function showPrologue(done,i=0){
  const scenes=window.__RESCUE_STORY__?.prologueScenes?.()||[],zh=lang==='zh';
  if(i>=scenes.length){done();return;}
  const s=scenes[i],last=i===scenes.length-1;
  openModal(`<div class="dialog-kicker wheat"><img src="${uiAsset('wheat')}" alt="">${zh?`序章 · ${i+1} / ${scenes.length}`:`Prologue · ${i+1} / ${scenes.length}`}<img src="${uiAsset('wheat')}" alt=""></div><h2>${s.title}</h2><div class="result-art story-art"><img class="result-room" src="${asset(`assets/${s.img}.webp`)}" alt=""></div><p class="story-text-block">${s.text}</p>${storyLines(s)}${actions(last?[['prologueNext',zh?'进入第 1 章':'Begin chapter 1',true]]:[['prologueSkip',zh?'跳过':'Skip',false],['prologueNext',zh?'继续':'Next',true]])}`,'story');
  $('prologueNext').onclick=()=>showPrologue(done,i+1);
  if(!last)$('prologueSkip').onclick=()=>done();
}
/** Story so far: every bridge the player has unlocked, readable again from the map. */
function showStoryBook(){
  const S=window.__RESCUE_STORY__,zh=lang==='zh';
  const parts=[];
  const pro=S?.prologueScenes?.()||[];
  if(pro.length)parts.push(`<section class="story-book-home"><h3>${zh?'序章':'Prologue'}</h3><ol>${pro.map(p=>`<li><b>${p.title}</b>${p.text}</li>`).join('')}</ol></section>`);
  for(let ch=0;ch<4;ch++){
    if(ch>0&&!completed.has(ch*5-1)&&!(index>=ch*5))break;
    const open=S?.prologue?.(ch);
    const beats=[];
    if(open)beats.push(`<li><b>${open.title}</b>${open.text}</li>`);
    for(let k=0;k<4;k++)if(completed.has(ch*5+k)){const b=S?.bridge?.(ch,k);if(b)beats.push(`<li><b>${b.title}</b>${b.text}</li>`);}
    parts.push(`<section class="story-book-home"><h3>${chapters[lang][ch]}</h3><ol>${beats.join('')}</ol></section>`);
  }
  if(completed.size===LEVELS.length){const e=S?.journey?.(3);if(e)parts.push(`<section class="story-book-home"><h3>${zh?'终章':'Epilogue'}</h3><ol><li><b>${e.title}</b>${e.text}</li></ol></section>`);}
  openModal(`<h2>${zh?'我们的故事':'Our story'}</h2><div class="story-book">${parts.join('')}</div>${actions([['storyPrologue',zh?'重看序章':'Replay prologue'],['storyBack',zh?'返回地图':'Back to map',true]])}`,'story');
  $('storyPrologue').onclick=()=>showPrologue(showStoryBook);
  $('storyBack').onclick=showMap;
}
function travel(next){
  window.__RESCUE_STORY__?.clear();
  // Next level in the same home, straight after a win: a short story card bridges the two repairs.
  if(Math.floor(next/5)===chapter()){if(phase==='won'&&next===index+1&&completed.has(index))storyCard(next);else start(next);return;}
  const nextChapter=Math.floor(next/5);
  // Leaving a finished home for the next one: the journey between them replaces the generic note.
  const journey=phase==='won'&&nextChapter===chapter()+1?window.__RESCUE_STORY__?.journey?.(chapter()):null;
  const note=journey?`<p class="story-text-block"><b class="story-chapter-title">${journey.title}</b>${journey.text}</p>${storyLines(journey)}`:`<p class="dialog-note">${lang==='zh'?`新小屋 · ${['雪夜','暴风雨','山间黄昏','黎明前'][nextChapter]}，五项修复重新开始。`:`New home · ${['snowy night','storm','mountain dusk','before dawn'][nextChapter]}. Five new repairs.`}</p>`;
  openModal(`<div class="dialog-kicker wheat"><img src="${uiAsset('wheat')}" alt="">${lang==='zh'?'新小屋解锁！':'New home unlocked!'}<img src="${uiAsset('wheat')}" alt=""></div><h2>${chapters[lang][nextChapter]}</h2><div class="result-art chapter"><img class="result-room" src="${uiAsset(`chapter-${nextChapter}`)}" alt=""></div>${note}<div class="result-steps track" aria-hidden="true">${stepMedals([],-1)}</div>${actions([['travelButton',lang==='zh'?'前往新小屋':'Enter the next home',true]])}`,'travel');
  $('travelButton').onclick=()=>start(next);
}
function finish(won){
  if(phase!=='playing')return;
  remainingMs=Math.max(0,deadline-performance.now());phase=won?'won':'failed';introPending=false;clearConflict();
  if(!won&&continueState==='fresh')continueState='offer';
  // On a win the last placement's landing, repair sound and praise finish first; the fanfare joins after the token lands.
  // A win keeps the final placement's praise line; the priority "warm" line cuts in afterwards.
  if(!won)cancelAudioEvents();
  musicMood(won?'win':'fail');
  react(won?'win':'fail');
  if(won){
    if(endless)endlessBest=Math.max(endlessBest,endless.round);else completed.add(index);
    board.givens.forEach(i=>credits.delete(i));
    // The last placement's praise line (spoken at ~700ms, up to 1.3s long) finishes before the horn.
    const homeDone=doneTasks().length===5;
    if(homeDone&&!endless){audio.sting?.('chapter-done',{delay:1900});window.__RESCUE_STORY__?.chapterDone(chapter());}
  else{audio.sting?.('chapter-done',{delay:1900});window.__RESCUE_STORY__?.repaired(chapter(),task());}
    // The confetti hiss was removed from the win (felt noisy); the visual confetti stays.
  }
  else {audio.play('lose');juice.shake($('scene'),4,400);window.__RESCUE_STORY__?.comfort({delay:300});}
  closeModal();renderText();persist();
  cancelResult();
  const endedAt=performance.now();
  if(won){
    // Beat 1 (1.9 s, after the token lands): celebration flash + "Well Done" ribbon over the board, ~2.6 s like RM/RK.
    later(1900,()=>{
      juice.celebrate?.($('scene'),{size:Math.min(420,$('scene').getBoundingClientRect().width*1.2)});
      juice.confetti(110);juice.burst($('scene'),'heart',16);juice.bounce($('board'),1.04,500);
      showBanner('win');later(700,()=>juice.burst($('scene'),'sparkle',24));
    });
    // Beat 2: the reward popup, never over the scene's own 2.8 s repair reveal (capped so it always appears).
    // The attic quilt celebration (≈4.1 s, starting ≈1.4 s after the win) also holds the card until the quilt has landed; cap 10 s.
    // Only the quilt level opens early (3.5 s floor); every other level keeps the 4.5 s floor.
    const openWin=()=>{const waited=performance.now()-endedAt,busy=actVideoBusy(),floor=actVideoHeldSince(endedAt)?3500:4500;if(!$('modal').open&&(!window.__RESCUE_SCENE__?.reveal&&!busy&&waited>=floor||!busy&&waited>=6800||waited>=10000))resultModal();else if(!$('modal').open)later(100,openWin);};
    later(3500,openWin);
  }else{
    // Beat 1: "Out of time" ribbon. Beat 2: a free, once-per-level +60 s offer. Beat 3 (declined or used up): failed screen.
    later(250,()=>showBanner('fail'));
    later(2500,()=>{if(!$('modal').open)resultModal();});
  }
}
function snapScene(){try{return $('scene').toDataURL('image/webp',.72);}catch{return '';}}
function resultModal(){
  if(phase==='won'&&!sceneShot.after)sceneShot.after=snapScene();
  if(phase==='failed')sceneShot.fail=snapScene();
  const won=phase==='won',homeDone=!endless&&doneTasks().length===5,allDone=!endless&&completed.size===LEVELS.length;
  // Win card = web variant D (2026-10-16): no ribbon title on screen; the heading stays for screen readers only.
  const title=`<h2 class="sr-only">${t(won?allDone?'allWon':homeDone?'homeWon':'won':'failed')} · ${chapters[lang][chapter()]}</h2>`;
  if(won){
    // P0 stars reward reasoning, scaled to the board: ★ solved · ★ at most the free hint · ★ never left the board unsolvable
    // (challenge mode also needs the size-based target time). Time is active play only (menus and the start card excluded).
    const used=Math.max(1,Math.ceil(elapsedMs/1000)),target=STAR_SECONDS[board.n]||150,challenge=mode==='challenge';
    const fewHints=hintsUsed<=FREE_HINTS,clean=!deadEnd&&(!challenge||used<=target),stars=1+(fewHints?1:0)+(clean?1:0);
    const todo=[];
    if(!fewHints)todo.push(lang==='zh'?`提示不超过 ${FREE_HINTS} 次`:`use at most ${FREE_HINTS} hint`);
    if(!clean)todo.push(challenge?(lang==='zh'?`${target} 秒内完成且不走进死路`:`solve within ${target} s without a dead end`):(lang==='zh'?'全程不走进死路':'never hit a dead end'));
    const rule=stars===3?(lang==='zh'?'推理干净利落 · 满星！':'Clean reasoning · perfect!'):(lang==='zh'?`再拿星：${todo.join(' · ')}`:`For more stars: ${todo.join(' · ')}`);
    const starRow=`<div class="result-stars" role="img" aria-label="${stars} / 3">${[0,1,2].map(i=>`<img src="${uiAsset(i<stars?'star':'star-empty')}" alt="" draggable="false">`).join('')}</div>`;
    // Only the repaired painting is shown (no before/after pair): it fills the card top, fades into the parchment, stars on its lower edge.
    const room=asset(`assets/act-${['attic','stone','lake','farm'][chapter()]}-${doneTasks().length}.webp`);
    const art=`<div class="result-hero"><img class="result-room" src="${room}" alt="${homeDone?(lang==='zh'?'母女在温暖的小屋里':'Mother and daughter in the warm home'):tasks[lang][task()]}">${starRow}</div><p class="star-rule">${rule}</p>`;
    const info=`<p class="result-info"><img src="${asset(`assets/prop-${task()}.webp`)}" alt="">${endless?`${levelName()} · ${board.n}×${board.n} · `:''}${tasks[lang][task()]} · ${t('timeLabel')} ${used} ${t('seconds')}</p>`;
    openModal(`${title}${art}${info}${stepRow()}${homeDone?`<p class="dialog-foot">${t('chapterDone')}</p>`:''}${actions([['replayButton',t('replay'),false],['nextButton',endless?(lang==='zh'?'下一盘 →':'Next board →'):allDone?t('finalMap'):homeDone?(lang==='zh'?'前往新小屋 →':'Next home →'):t('next'),true]])}`,'win');
  }else{
    const pct=Math.round(progress()*100),got=Math.min(credits.size,need());
    const bar=`<div class="result-bar" role="img" aria-label="${got} / ${need()}"><span style="width:${Math.max(4,pct)}%"></span><b>${lang==='zh'?`已放 ${got} / ${need()}`:`Placed ${got} / ${need()}`}</b></div>`;
    if(continueState==='offer'){
      // Continue offer: free and once per level; the one-tap restart stays on this card as well.
      openModal(`<button id="offerClose" class="dialog-close" type="button" aria-label="${lang==='zh'?'关闭':'Close'}">${uiImg('icon-close')}</button><h2>${lang==='zh'?'继续吗？':'Continue?'}</h2><div class="offer-badge"><img class="offer-rays" src="${uiAsset('rays')}" alt=""><img class="offer-laurel" src="${uiAsset('medallion')}" alt=""><img src="${uiAsset('badge-time')}" alt=""><b>+60</b></div><p class="offer-tag">${lang==='zh'?'免费 · 每关一次':'Free · once per level'}</p>${bar}${actions([['continueButton',lang==='zh'?'继续 +60 秒':'Play on +60 s',true,'icon-clock'],['retryButton',lang==='zh'?'重新开始本关':'Restart level',false]])}`,'fail');
      $('continueButton').onclick=continuePlay;
      $('retryButton').onclick=()=>start(index);
      $('offerClose').onclick=()=>{continueState='declined';resultModal();};
      return;
    }
    openModal(`<h2>${t('failed')}</h2><div class="fail-hero family-moment"><img class="fail-room" src="${sceneShot.fail||asset('assets/room.webp')}" alt=""><img class="fail-clock" src="${uiAsset('frozen-hero')}" alt=""><span class="fail-bubble">${lang==='zh'?'妈妈，我们再试一次好吗？':'Mom, can we try again?'}</span></div><p class="dialog-note">${lang==='zh'?'时间到了，这次修复还没有完成。<br>已修好的部分会保留。':'Time is up and this repair is unfinished.<br>Completed repairs are safe.'}</p>${bar}${actions([['retryButton',t('retry'),true,'icon-refresh'],['resultMapButton',t('map'),false,'icon-map']])}`,'fail');
  }
  if(won){$('nextButton').onclick=()=>{if(endless)startEndless(endless.round+1);else if(allDone)showEnding();else travel(index<LEVELS.length-1?index+1:[...Array(LEVELS.length).keys()].find(i=>!completed.has(i)));};$('replayButton').onclick=()=>start(index);}
  else{$('retryButton').onclick=()=>start(index);$('resultMapButton').onclick=showMap;}
}
function requestReset(){
  if(phase!=='playing')return;
  openModal(`<h2>${t('restartTitle')}</h2><div class="dialog-medal">${uiImg('icon-restart')}</div><p class="dialog-note">${lang==='zh'?'本局落子与计时将重置，<br>已通关的修复会保留。':'This board and timer will reset.<br>Completed repairs will stay.'}</p>${actions([['cancelReset',t('cancel'),false],['confirmReset',lang==='zh'?t('restart'):'Restart',true]],'row')}`);
  $('confirmReset').onclick=()=>start(index);$('cancelReset').onclick=closeModal;
}
/** World-map geometry for assets/map-path.webp (941×1672), as 0..1 of the picture, bottom → top.
 *  MAP_PATH traces the painted footpath; MAP_HOMES is one label spot per home (attic, stone hut, lake hut, farm). */
const MAP_PATH=[[.46,.88],[.50,.81],[.53,.74],[.60,.68],[.66,.63],[.72,.58],[.70,.535],[.60,.50],[.56,.45],[.62,.41],[.70,.37],[.76,.33],[.72,.29],[.66,.255],[.72,.22],[.78,.19],[.72,.165],[.64,.15],[.58,.135],[.66,.12]];
const MAP_HOMES=[[.30,.66],[.78,.525],[.36,.25],[.42,.12]];
const MAP_ASPECT=1672/941;
let mapStoneCache=null;
/** One stone per level, spaced evenly by real distance along MAP_PATH (so the steep top stretch is not crowded). */
function mapStones(){
  if(mapStoneCache)return mapStoneCache;
  const n=LEVELS.length,px=MAP_PATH.map(([x,y])=>[x,y*MAP_ASPECT]),seg=[0];
  for(let i=1;i<px.length;i++)seg.push(seg[i-1]+Math.hypot(px[i][0]-px[i-1][0],px[i][1]-px[i-1][1]));
  const total=seg[seg.length-1];
  return mapStoneCache=Array.from({length:n},(_,k)=>{
    const d=total*k/Math.max(1,n-1);let j=1;while(j<seg.length-1&&seg[j]<d)j++;
    const f=(d-seg[j-1])/((seg[j]-seg[j-1])||1),a=MAP_PATH[j-1],b=MAP_PATH[j];
    return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
  });
}
function showMap(){
  cancelResult();
  if(!loaded)return;
  const maxOpen=Math.min(LEVELS.length-1,completed.size?Math.max(...completed)+1:0);
  // Snowy-path world map (picked "C · watercolour, plan 1"): 20 stones re-spaced evenly along the painted path,
  // one label per home, and the game's own mother + daughter portraits standing on the current level.
  const stones=mapStones(),pct=([x,y])=>`left:${(x*100).toFixed(2)}%;top:${(y*100).toFixed(2)}%`;
  const homes=chapters[lang].map((name,ch)=>{
    const done=[0,1,2,3,4].every(k=>completed.has(ch*5+k)),locked=ch*5>maxOpen;
    return `<div class="map-home ${locked?'locked':''}" style="${pct(MAP_HOMES[ch])}">${locked?`<img src="${uiAsset('icon-lock')}" alt="">`:''}<b>${name}</b><small>${lang==='zh'?`第 ${ch+1} 章`:`Chapter ${ch+1}`}${done?(lang==='zh'?' · 已完成':' · Done'):''}</small></div>`;}).join('');
  const levels=stones.map((p,i)=>{const ch=Math.floor(i/5),k=i%5;
    return `<button data-level="${i}" class="map-stone ${completed.has(i)?'complete':''} ${i===index?'current':''}" style="${pct(p)}" ${i>maxOpen?'disabled':''} aria-label="${t('level')} ${i+1}: ${HOME_TASKS[lang][ch][k]}${completed.has(i)?lang==='zh'?'，已完成':', done':''}"><span>${i+1}</span></button>`;}).join('');
  const duo=`<div class="map-duo" style="${pct(stones[Math.min(LEVELS.length-1,index)])}" aria-hidden="true"><i class="m" style="background-image:url(${asset('assets/avatar-mother.webp')})"></i><i class="d" style="background-image:url(${asset('assets/avatar-daughter.webp')})"></i></div>`;
  openModal(`<button id="mapX" class="dialog-close" type="button" aria-label="${lang==='zh'?'关闭':'Close'}">${uiImg('icon-close')}</button><h2>${t('map')}</h2><div class="map-counter">${completed.size} / ${LEVELS.length}</div><div class="map-path-scroll"><div class="map-path" style="background-image:url(${asset('assets/map-path.webp')})">${homes}${levels}${duo}</div></div><p class="dialog-foot">${t('saved')}</p>${actions([['mapStory',lang==='zh'?'我们的故事':'Our story',false,'icon-book'],['mapGallery',lang==='zh'?'回忆画廊':'Memories',false,'icon-book'],...(completed.size===LEVELS.length?[['mapEndless',lang==='zh'?'无限模式':'Endless',false]]:[]),['mapClose',t('resume'),true]],'row')}`,'map');
  if($('mapEndless'))$('mapEndless').onclick=showEndlessIntro;
  // Bring the current stone into view (the path runs bottom → top, so early levels sit at the bottom).
  // Full-screen page: the map sits under a floating title bar and button bar, so centre the pair in the open middle.
  const scroller=document.querySelector('.map-path-scroll'),here=document.querySelector('.map-duo'),path=document.querySelector('.map-path');
  if(scroller&&here&&path)requestAnimationFrame(()=>{scroller.scrollTop=path.offsetTop+here.offsetTop-scroller.clientHeight*.45;});
  $('mapStory').onclick=()=>showStoryBook();
  document.querySelectorAll('[data-level]').forEach(button=>button.onclick=()=>{const next=Number(button.dataset.level);if(endless){endless=null;start(next);return;}if(next===index){closeModal();if(phase==='won'||phase==='failed')resultModal();else if(phase==='tutorial')tutorial();}else travel(next);});
  $('mapGallery').onclick=()=>showGallery();
  $('mapClose').onclick=()=>{closeModal();if(phase==='won'||phase==='failed')resultModal();else if(phase==='tutorial')tutorial();};
  $('mapX').onclick=()=>$('mapClose').click();
}
/** CG gallery ("memories"): every painted act per home, plus the older room / family art, all unlocked for dev preview.
 *  Tapping a picture opens a full viewer with previous / next; back returns to the gallery, then to the map. */
const CG_HOMES=['attic','stone','lake','farm'];
function galleryItems(){
  const zh=lang==='zh',items=[];
  // Six stages per home: the opening, then one picture per finished repair.
  CG_HOMES.forEach((k,h)=>[0,1,2,3,4,5].forEach(a=>{const n=ACT_NAMES[k][0];items.push({group:chapters[lang][h],src:asset(`assets/act-${k}-${a}.webp`),
    title:a?(zh?`修好 ${a} / 5`:`Repair ${a} / 5`):(zh?'开局':'Opening'),sub:a?HOME_TASKS[lang][h][a-1]:(zh?n[1]:n[3])});}));
  // Prologue and ending art go first / last so the story reads in order.
  const pro=(window.__RESCUE_STORY__?.prologueScenes?.()||[]).map((s,i)=>({group:zh?'序章':'Prologue',src:asset(`assets/${s.img}.webp`),title:zh?`序章 ${i+1}`:`Prologue ${i+1}`,sub:s.title}));
  items.unshift(...pro);
  const endG=zh?'终章':'Epilogue';
  items.push({group:endG,src:asset('assets/ending-lamp.webp'),title:zh?'给下一个人留灯':'A lamp for the next one',sub:zh?'结局 ③（采用）':'Ending 3 (in use)'},
    {group:endG,src:asset('assets/ending-sign.webp'),title:zh?'谁也赶不走的家':'A home no one can take',sub:zh?'结局 ①（备选）':'Ending 1 (alternate)'},
    {group:endG,src:asset('assets/father-sheet.webp'),title:zh?'爸爸设定':'Dad character sheet',sub:zh?'仅序章出场':'Prologue only'});
  const other=zh?'早期画面（开发预览）':'Earlier art (dev preview)';
  [['room','冷屋（通用）','Cold room'],['room-warm','暖屋（通用）','Warm room'],['room-attic','阁楼 · 冷','Attic · cold'],['room-warm-attic','阁楼 · 暖','Attic · warm'],
   ['room-h1','小屋 2 · 冷','Home 2 · cold'],['room-warm-h1','小屋 2 · 暖','Home 2 · warm'],['room-h2','小屋 3 · 冷','Home 3 · cold'],['room-warm-h2','小屋 3 · 暖','Home 3 · warm'],
   ['room-h3','小屋 4 · 冷','Home 4 · cold'],['room-warm-h3','小屋 4 · 暖','Home 4 · warm'],['family','母女 · 寒冷','Family · cold'],['family-happy','母女 · 开心','Family · happy'],
   ['ui-chapter-0','地图封面 1','Map cover 1'],['ui-chapter-1','地图封面 2','Map cover 2'],['ui-chapter-2','地图封面 3','Map cover 3'],['ui-chapter-3','地图封面 4','Map cover 4']]
    .forEach(([f,z,e])=>items.push({group:other,src:asset(`assets/${f}.webp`),title:zh?z:e,sub:f,tall:f.startsWith('family'),square:f.startsWith('ui-')}));
  return items;
}
function showGallery(){
  cancelResult();
  if(!loaded)return;
  const zh=lang==='zh',items=galleryItems(),groups=[...new Set(items.map(x=>x.group))];
  openModal(`<h2>${zh?'回忆画廊':'Memories'}</h2><p class="gallery-note">${zh?`共 ${items.length} 张 · 开发预览：全部解锁`:`${items.length} pictures · dev preview: all unlocked`}</p><div class="gallery">${groups.map(g=>`<section class="gallery-group"><h3>${g}</h3><div class="gallery-grid">${items.map((x,i)=>x.group!==g?'':`<button class="gallery-card${x.tall?' tall':x.square?' square':''}" data-cg="${i}"><img src="${x.src}" alt="" decoding="async"><span><b>${x.title}</b><small>${x.sub}</small></span></button>`).join('')}</div></section>`).join('')}</div>${actions([['galleryBack',zh?'返回小屋地图':'Back to map',true]])}`,'gallery');
  document.querySelectorAll('[data-cg]').forEach(b=>b.onclick=()=>showCg(Number(b.dataset.cg)));
  $('galleryBack').onclick=showMap;
}
function showCg(i){
  const zh=lang==='zh',items=galleryItems(),n=items.length;i=(i+n)%n;const x=items[i];
  openModal(`<h2>${x.title}</h2><figure class="cg-view${x.tall?' tall':''}"><img src="${x.src}" alt="${x.sub}"><figcaption><em><b>${x.group}</b> · ${x.sub}</em><span>${i+1} / ${n}</span></figcaption></figure>${actions([['cgPrev',zh?'上一张':'Previous'],['cgNext',zh?'下一张':'Next']],'row')}${actions([['cgBack',zh?'返回画廊':'Back to gallery',true]])}`,'gallery');
  $('cgPrev').onclick=()=>showCg(i-1);$('cgNext').onclick=()=>showCg(i+1);$('cgBack').onclick=showGallery;
}
function showSettings(){
  cancelResult();
  if(!loaded)return;
  const row=(icon,label,button)=>`<div class="setting-row"><span class="setting-icon">${uiImg(icon)}</span><span class="setting-label">${label}</span>${button}</div>`;
  openModal(`<h2>${t('settings')}</h2>${row('icon-globe',t('language'),`<button id="languageButton">${lang==='zh'?'English':'简体中文'}</button>`)}${row('icon-music',t('sound'),`<button id="musicButton" class="${musicEnabled?'on':''}" aria-pressed="${musicEnabled}">${t(musicEnabled?'soundOn':'soundOff')}</button>`)}${row('icon-clock',t('modeLabel'),`<button id="modeButton" class="${mode==='challenge'?'on':''}" aria-pressed="${mode==='challenge'}">${t(mode==='challenge'?'modeChallenge':'modeWarm')}</button>`)}${row('icon-map',lang==='zh'?'背景':'Background',`<button id="bgButton">${lang==='zh'?currentBg().zh:currentBg().en}</button>`)}${row('icon-book',t('tutorial'),`<button id="helpButton">${t('tutorial')}</button>`)}${row('icon-refresh',lang==='zh'?'游戏进度':'Progress',`<button id="wipeButton" class="danger">${lang==='zh'?'重置进度':'Reset'}</button>`)}<p class="dialog-foot">${t('saved')}</p>${actions([['settingsClose',t('close'),true]])}`,'settings');
  $('modeButton').onclick=()=>{setMode(mode==='challenge'?'warm':'challenge');showSettings();};
  $('languageButton').onclick=()=>{switchLanguage();showSettings();};
  $('musicButton').onclick=()=>{musicEnabled=!musicEnabled;if(!musicEnabled){audio.pauseAll();}else audio.playMusic();persist();showSettings();};
  $('helpButton').textContent=lang==='zh'?'重玩教学':'Replay tutorial';
  $('helpButton').onclick=()=>{tutorialStep=0;tutorial(true);};
  $('wipeButton').onclick=confirmWipe;
  $('bgButton').onclick=showBackgrounds;
  $('settingsClose').onclick=()=>{closeModal();if(phase==='won'||phase==='failed')resultModal();else if(phase==='tutorial')tutorial();};
}
/** Background picker: tapping a card switches the page background live; the choice is saved at once. */
function showBackgrounds(){
  const zh=lang==='zh';
  openModal(`<h2>${zh?'更换背景':'Background'}</h2><div class="bg-grid">${BACKGROUNDS.map(b=>`<button class="bg-card${b.id===bgId?' on':''}" data-bg="${b.id}" aria-pressed="${b.id===bgId}"><img src="${asset(b.src)}" alt="" decoding="async"><span>${zh?b.zh:b.en}</span></button>`).join('')}</div>${actions([['bgBack',zh?'完成':'Done',true]])}`,'settings');
  document.querySelectorAll('[data-bg]').forEach(b=>b.onclick=()=>{applyBackground(b.dataset.bg);
    document.querySelectorAll('[data-bg]').forEach(x=>{const on=x.dataset.bg===bgId;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on);});});
  $('bgBack').onclick=showSettings;
}
/** Reset progress: asks once, then clears every saved level, star and setting and restarts from the tutorial. */
function confirmWipe(){
  const zh=lang==='zh';
  openModal(`<h2>${zh?'重置进度':'Reset progress'}</h2><p class="dialog-note">${zh?'所有关卡、星星和已修好的小屋都会清空，<br>游戏将从第 1 关和教学重新开始。<br><b>此操作无法撤销。</b>':'All levels, stars and repaired homes will be cleared,<br>and the game restarts from Level 1 and the tutorial.<br><b>This cannot be undone.</b>'}</p>${actions([['wipeCancel',zh?'取消':'Cancel'],['wipeConfirm',zh?'确认重置':'Reset']],'row')}`,'settings');
  $('wipeCancel').onclick=showSettings;
  $('wipeConfirm').onclick=()=>{
    wipingProgress=true;
    try{localStorage.removeItem(STORAGE);}catch{}
    try{sessionStorage.clear();}catch{}
    location.reload();
  };
}
/** Switching mode mid-level hands the current board a fresh clock for the new mode; stars use active time, so this cannot buy one. */
function setMode(next){
  mode=next==='challenge'?'challenge':'warm';
  if(phase==='playing'){remainingMs=limitMs();deadline=performance.now()+remainingMs;hurried=false;lastTickSecond=-1;lastSaveSecond=-1;musicMood('normal');}
  renderText();persist();
}
function playMusic(){audio.playMusic();}
function unlockAudio(){feedback.unlock();audio.unlock();}
document.addEventListener('pointerdown',unlockAudio,{once:true});
document.addEventListener('keydown',unlockAudio,{once:true});
function cellAt(event){const el=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-cell]');return el?Number(el.dataset.cell):null;}
$('board').addEventListener('pointerdown',event=>{
  if(event.button!==0||!canAct())return;
  const cell=event.target.closest('[data-cell]');if(!cell)return;
  const i=Number(cell.dataset.cell);selected=i;
  pointer={id:event.pointerId,start:i,x:event.clientX,y:event.clientY,drag:false,visited:new Set(),mode:!marks.has(i)};
  $('board').setPointerCapture(event.pointerId);event.preventDefault();
});
$('board').addEventListener('pointermove',event=>{
  if(!pointer||pointer.id!==event.pointerId)return;
  const i=cellAt(event);
  if(i===null)return;
  if(!pointer.drag&&i!==pointer.start&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>7){
    pointer.drag=true;remember();mark(pointer.start,pointer.mode,false);pointer.visited.add(pointer.start);if(lastTap)clearTimeout(lastTap.timer);lastTap=null;
  }
  if(pointer.drag&&!pointer.visited.has(i)){mark(i,pointer.mode,false);pointer.visited.add(i);}
});
$('board').addEventListener('pointerup',event=>{
  if(!pointer||pointer.id!==event.pointerId)return;
  const current=pointer;pointer=null;suppressClickUntil=performance.now()+500;
  if(current.drag){
    renderText();return;
  }
  const i=current.start,now=performance.now();
  if(lastTap&&lastTap.i===i&&now-lastTap.time<DOUBLE_TAP_MS){
    // A double-tap is one placement action: the × the first tap already drew is silently taken back
    // (state and undo history), then the plank goes down.
    const first=lastTap;lastTap=null;
    if(first.toggled){if(marks.has(i))marks.delete(i);else marks.add(i);history.length=first.hist;}
    place(i);
    if(first.toggled&&!placements.has(i)){renderBoard();persist();}
  }else{
    // During the tutorial's tap steps a double-tap is not expected.
    if(coach&&!coachFree()&&!['place','finish'].includes(coachStep()?.kind)){lastTap=null;mark(i);return;}
    // The × lands on the very first tap (no waiting for the double-tap window); a second tap undoes it and places.
    const hist=history.length,before=marks.has(i);
    mark(i);
    lastTap={i,time:now,hist,toggled:marks.has(i)!==before};
  }
});
$('board').addEventListener('pointercancel',()=>{pointer=null;if(lastTap)clearTimeout(lastTap.timer);lastTap=null;});
$('board').addEventListener('click',event=>{
  if(performance.now()<suppressClickUntil)return;
  const el=event.target.closest('[data-cell]');if(el)mark(Number(el.dataset.cell));
});
$('board').addEventListener('dblclick',event=>event.preventDefault());
$('board').addEventListener('keydown',event=>{
  const el=event.target.closest('[data-cell]');if(!el||!canAct())return;
  let i=Number(el.dataset.cell);
  const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-board.n,ArrowDown:board.n}[event.key];
  if(delta!==undefined){event.preventDefault();selected=Math.max(0,Math.min(board.n*board.n-1,i+delta));renderBoard();$('board').querySelector(`[data-cell="${selected}"]`).focus();}
  else if(event.key==='Enter'){event.preventDefault();place(i);$('board').querySelector(`[data-cell="${i}"]`)?.focus();}
  else if(event.key===' '||event.key.toLowerCase()==='x'){event.preventDefault();mark(i);$('board').querySelector(`[data-cell="${i}"]`)?.focus();}
});
document.addEventListener('keydown',event=>{
  if($('modal').open||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.key.toLowerCase()==='z'){event.preventDefault();undo();}
  if(event.key.toLowerCase()==='h'){event.preventDefault();hint();}
});
$('modal').addEventListener('cancel',event=>{event.preventDefault();if(phase==='playing')closeModal();});
function switchLanguage(){
  lang=lang==='zh'?'en':'zh';window.__RESCUE_STORY__?.clear();clearTimeout(toastTimer);$('toast').classList.remove('visible');message(t('ready'));renderBoard();renderText();persist();feedback.play('language');
}
$('quickLanguage').onclick=switchLanguage;
document.addEventListener('pointerdown',event=>{
  feedback.unlock();
  const button=event.target.closest('button');
  // Board cells do not get the press-shrink: a tap on an × or a placed supply must not make it dip.
  if(button&&!button.disabled&&!button.matches('[data-cell]'))feedback.press(button);
});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button||button.disabled||button.matches('[data-cell]'))return;
  const id=button.id;
  if(['undoButton','hintButton'].includes(id))return;
  // One click = one "tap" (tap.ogg trimmed to its first hit); the synthesized open/back/reset blips are no longer layered on top.
  audio.play('tap',{rate:/Close|cancel|resume|helpClose/i.test(id)?.9:1.05});
});
$('undoButton').onclick=undo;$('hintButton').onclick=hint;$('resetButton').onclick=requestReset;$('playButton').onclick=beginPlay;
$('levelStart').addEventListener('click',event=>{const b=event.target.closest('[data-start-mode]');if(!b||!introPending)return;event.stopPropagation();if(b.dataset.startMode!==mode)setMode(b.dataset.startMode);});
$('mapButton').onclick=showMap;$('settingsButton').onclick=showSettings;
window.addEventListener('pagehide',()=>{if(phase==='playing')remainingMs=Math.max(0,deadline-performance.now());persist();});
document.addEventListener('visibilitychange',()=>{audio.background(document.hidden);if(document.hidden){if(phase==='playing'){remainingMs=Math.max(0,deadline-performance.now());persist();}}});
function frame(now){
  const dt=lastFrame?Math.min(250,now-lastFrame):0;lastFrame=now;
  // The clock is frozen on the start card, in warm mode, and (challenge) while any menu is open.
  const paused=introPending||$('modal').open;
  if(phase==='playing'&&!paused)elapsedMs+=dt;
  if(phase==='playing'&&(paused||mode!=='challenge'))deadline=now+remainingMs;
  if(phase==='playing'){
    remainingMs=Math.max(0,deadline-now);
    if(remainingMs<=0)finish(false);
    const second=Math.ceil(remainingMs/1000);
    if(second!==lastSaveSecond){lastSaveSecond=second;updateClock();persist();}
    if(second<=15&&second>0&&second!==lastTickSecond&&!$('modal').open){lastTickSecond=second;audio.play('tick',{volume:.35+(15-second)*.02,rate:second<=5?1.15:1});juice.bounce($('clock'),1.08,240);}
    if(remainingMs<=30000&&!hurried){hurried=true;react('hurry');musicMood('hurry');juice.pulse($('clock'),'#e46a4c');}
  }
  if(loaded){
    renderScene($('scene'),{time:now,index,task:task(),progress:progress(),completedTasks:doneTasks(),phase,remainingMs,durationMs:limitMs(),reaction});
    const sc=window.__RESCUE_SCENE__;
    if(sc){audio.ambient('wind',(1-sc.windowProgress)*(phase==='failed'?.7:.9));audio.ambient('fire-loop',sc.fireProgress);}
  }
  requestAnimationFrame(frame);
}
setBoard(index);message(t('loading'));
if(new URLSearchParams(location.search).get('debug')==='1'){
  Object.defineProperty(window,'__RESCUE_DEBUG__',{value:Object.freeze({advanceTime(ms){if(introPending)beginPlay();if(phase==='playing'&&Number.isFinite(ms)&&ms>=0){elapsedMs+=ms;if(mode==='challenge')deadline-=ms;remainingMs=Math.max(0,deadline-performance.now());if(remainingMs<=0)finish(false);updateClock();}return snapshot();}})});
}
try{
  await preloadScene();loaded=true;requestAnimationFrame(frame);
  // A fresh start opens on the prologue (the night they were sent away), then the tutorial board.
  if(!tutorialSeen){tutorialStep=0;showPrologue(()=>tutorial());}
  else if(saved.current&&['playing','won','failed'].includes(saved.current.phase)){
    restoreCurrent(saved.current);message(t('ready'));
    if(phase==='won'||phase==='failed')resultModal();
    else{openModal(`<h2>${t('resume')}</h2><div class="dialog-medal hero"><img class="medal-rays" src="${uiAsset('rays')}" alt=""><img class="medal-chapter" src="${uiAsset(`chapter-${chapter()}`)}" alt=""></div><p class="dialog-note">${chapters[lang][chapter()]} · ${tasks[lang][task()]}</p>${actions([['resumeButton',t('resume'),true]])}`);$('resumeButton').onclick=()=>{closeModal();playMusic();};}
  }else start(index);
}catch(error){
  console.error('Room preload failed',error);phase='tutorial';
  openModal(`<h2>${t('errorTitle')}</h2><p>${t('errorText')}</p>${actions([['reloadButton',t('reload'),true]])}`);
  $('reloadButton').onclick=()=>location.reload();
}
