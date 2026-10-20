import { drawFamilyVideo, preloadFamilyVideo } from './family-video-actor.js';
import { actVideoEnabled, actVideoFrame, preloadActVideo, startActVideo, pauseActVideo, resetActVideo } from './attic-act-video.js';
import { FAMILY_FACES } from './family-faces.js';
const art={};
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const memory=new WeakMap();
const puppetSources=new Map();
let puppetSurface;
// ---- v10 repair reveal: sprites, camera, drop-in pieces, stepped warmth, frost, breath ----
const vfx={};
const VFX_NAMES=['vfx-glow','vfx-star','vfx-rays','vfx-dust','vfx-frost'];
// Share of the room's warmth each finished repair brings: sealed window, patched roof, fire, bed, soup.
const WARM_WEIGHTS=[.14,.14,.32,.2,.2];
// One look per home: snowy night, stormy night, mountain dusk, pre-dawn. Same room art, new weather and light.
const HOME_LOOKS=['snow','storm','dusk','dawn'];
// Each home is its own place: a painted room per home that keeps the window, roof hole, fireplace and bed
// geometry of room.webp, so every repair mask and the seated pose register unchanged.
// Home 1 is the attic (own layout: round skylight, stovepipe, iron stove, bed under the eaves; see ATTIC_GEO).
const HOME_ROOMS=[['room-attic','room-warm-attic'],['room-h1','room-warm-h1'],['room-h2','room-warm-h2'],['room-h3','room-warm-h3']];
let roomHome=0;
// ---- Painted acts: every home has three full paintings (cold / warming / warm) with the mother and
// daughter already painted in. Head boxes [x,y,w,h] and repair targets are measured in 900x600 scene space.
const ACT_KEYS=['attic','stone','lake','farm'];
const ACT_ART={
  // Six paintings per home: stage 0 = opening, stage k = k repairs finished (only the new repair changes).
  attic:{heads:[[[150,140,135,100],[230,190,75,80]],[[370,60,100,110],[330,190,70,75]],[[550,170,95,100],[470,190,75,80]],
      [[490,140,100,100],[560,215,75,75]],[[170,130,100,100],[260,175,70,70]],[[160,125,100,100],[260,165,70,75]]],
    targets:[[528,96],[746,70],[717,284],[230,322],[482,300]]},
  stone:{heads:[[[600,195,90,85],[665,250,65,60]],[[215,85,100,110],[290,195,70,75]],[[265,210,95,100],[140,320,85,85]],
      [[210,180,100,100],[315,315,80,85]],[[210,215,110,105],[330,310,80,85]],[[205,220,110,105],[335,315,80,85]]],
    targets:[[138,200],[372,250],[428,412],[645,255],[400,330]]},
  lake:{heads:[[[70,120,140,110],[145,190,90,85]],[[630,110,85,100],[170,195,80,80]],[[330,205,100,100],[550,225,75,80]],
      [[645,110,95,100],[690,225,75,75]],[[55,145,105,100],[175,200,75,75]],[[60,140,105,100],[170,200,75,75]]],
    targets:[[494,140],[565,415],[795,345],[130,345],[820,275]]},
  farm:{heads:[[[690,210,85,85],[750,255,65,65]],[[325,195,80,85],[380,260,65,65]],[[135,205,80,85],[205,250,65,65]],
      [[135,195,80,85],[225,250,65,65]],[[665,215,80,80],[730,255,60,60]],[[150,210,85,85],[245,245,65,65]]],
    targets:[[365,235],[60,245],[95,300],[700,320],[230,330]]}};
const ACT_STAGES=6;
// Repair-target glow (v2 "D · strong inner glow"): one outline per task in 900x600 scene space.
// Flat number lists are polygons; ['c',cx,cy,r] is a circle and ['e',cx,cy,rx,ry] an ellipse.
const ACT_OUTLINES={
  attic:[['c',529,104,114],
    [731,0,780,0,782,54,795,51,824,56,825,101,799,107,782,96,777,116,779,209,735,209,734,124,729,75],
    [683,212,731,204,734,183,769,183,770,204,825,212,828,225,822,227,822,330,816,338,810,371,795,371,789,347,701,347,696,371,679,371,681,338,680,326,689,321,687,227,681,225],
    [60,296,69,255,84,231,113,224,150,227,174,242,210,255,255,263,300,260,330,251,364,259,390,267,411,279,415,315,414,369,404,377,68,377,57,353],
    [416,302,450,296,525,299,536,305,534,318,528,321,534,386,518,392,491,390,489,371,453,371,450,392,431,393,414,386,420,323,415,318]],
  stone:[[18,300,16,125,32,85,62,62,100,52,140,52,180,60,214,80,238,110,250,150,252,300],
    [452,180,462,192,550,412,354,412,442,192],
    ['e',465,437,135,46],
    [548,142,806,142,806,388,548,388],
    [405,320,510,320,506,350,496,375,476,391,440,391,418,376,408,350]],
  lake:[[258,48,752,48,752,292,258,292],
    [400,430,520,422,640,425,690,450,700,500,670,560,560,575,450,570,410,530,395,480],
    [758,280,880,280,880,298,858,300,858,400,848,418,770,418,760,400,760,298],
    [0,320,135,318,140,285,290,282,300,290,305,320,320,335,322,385,310,395,20,400,0,395],
    ['e',820,262,52,30]],
  farm:[[333,150,450,150,450,386,333,386],
    [30,72,62,72,62,272,128,278,130,300,122,300,122,395,95,415,0,415,0,280,30,276],
    [80,295,125,295,125,370,80,370],
    [628,282,640,278,785,282,790,320,875,325,880,345,878,425,705,428,700,412,632,380,625,300],
    [104,322,358,322,358,348,342,350,342,450,330,450,330,352,132,352,132,450,118,450,118,352,104,348]]};
function outlinePath(c,s){
  c.beginPath();
  if(s[0]==='c')c.arc(s[1],s[2],s[3],0,Math.PI*2);
  else if(s[0]==='e')c.ellipse(s[1],s[2],s[3],s[4],0,0,Math.PI*2);
  else{c.moveTo(s[0],s[1]);for(let i=2;i<s.length;i+=2)c.lineTo(s[i],s[i+1]);c.closePath();}
}
function outlineBox(s){
  if(s[0]==='c')return [s[1]-s[3],s[2]-s[3],s[3]*2,s[3]*2];
  if(s[0]==='e')return [s[1]-s[3],s[2]-s[4],s[3]*2,s[4]*2];
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(let i=0;i<s.length;i+=2){x0=Math.min(x0,s[i]);x1=Math.max(x1,s[i]);y0=Math.min(y0,s[i+1]);y1=Math.max(y1,s[i+1]);}
  return [x0,y0,x1-x0,y1-y0];
}
// One soft layer. sigma is in scene units; k = device pixels per scene unit (canvas filters ignore the transform).
// Browsers without canvas filters get the same blur from a shadow cast by a copy drawn far off to the side.
function glowPass(c,s,sigma,k,alpha,paint){
  c.save();c.globalAlpha*=alpha;
  if(typeof c.filter==='string'){c.filter=`blur(${(sigma*k).toFixed(2)}px)`;outlinePath(c,s);paint(c,false);}
  else{const off=4000;c.shadowColor=paint.color;c.shadowBlur=sigma*k*2;c.shadowOffsetX=off;
    c.translate(-off/k,0);outlinePath(c,s);paint(c,true);}
  c.restore();
}
const strokeLayer=(color,width)=>{const p=(c)=>{c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.stroke();};p.color=color;return p;};
// Soft rim: a wide outer halo spreads the light, the core is a blurred warm line rather than a hard edge.
const GLOW_HALO=strokeLayer('#ff9f33',64),GLOW_WIDE=strokeLayer('#ffae3d',36),GLOW_MID=strokeLayer('#ffd27a',16),GLOW_CORE=strokeLayer('#fff1d2',5);
/** Glow for one repair target: 1.1 s fade-in, 3.4 s breathing (1 -> .72); a finished repair flares to 1.9 and fades over 1.4 s. */
function drawRepairGlow(c,s,g,now,reduced,k){
  let level;
  if(g.out!==undefined){const u=clamp((now-g.out)/1400);
    level=g.done&&!reduced?(u<.2?1+.9*(u/.2):1.9*(1-(u-.2)/.8)):1-u;
    if(g.at!==undefined)level*=reduced?1:clamp((g.out-g.at)/1100);}
  else{const t=now-g.at;level=reduced?1:clamp(t/1100)*(1-.28*(.5-.5*Math.cos(Math.max(0,t-1100)/3400*Math.PI*2)));}
  if(level<=.003)return;
  const a=Math.min(1,level),boost=Math.max(1,level);
  const [bx,by,bw,bh]=outlineBox(s),cx=bx+bw/2,cy=by+bh/2,r=Math.max(bw,bh)*.6;
  c.save();c.globalCompositeOperation='screen';c.globalAlpha=a;
  const inner=(cc,flat)=>{if(flat){cc.fillStyle='#ffd898';}else{const gr=cc.createRadialGradient(cx,cy,0,cx,cy,r);
    gr.addColorStop(0,'rgba(255,226,168,.5)');gr.addColorStop(1,'rgba(255,179,71,.05)');cc.fillStyle=gr;}cc.fill();};
  inner.color='rgba(255,216,152,.3)';
  glowPass(c,s,12,k,Math.min(1,.5*boost),inner);
  glowPass(c,s,30,k,Math.min(1,.34*boost),GLOW_HALO);
  glowPass(c,s,17,k,Math.min(1,.4*boost),GLOW_WIDE);
  glowPass(c,s,8,k,Math.min(1,.5*boost),GLOW_MID);
  glowPass(c,s,2.6,k,Math.min(1,.55*boost),GLOW_CORE);
  c.restore();
}
const actArtName=(home,stage)=>`act-${ACT_KEYS[home]}-${stage}`;
// Level-opening paintings: while a stage's repair is the current task, the pair stands by that repair
// (level 2 at the chimney, level 4 at the bed) instead of where the previous level's ending left them.
const ACT_OPEN={attic:{1:[[585,145,95,105],[495,195,70,80]],3:[[340,70,100,100],[428,175,68,80]]}};
const actOpenName=(home,stage)=>`act-${ACT_KEYS[home]}-${stage}-open`;
// Chapter 1 framing: art-space line kept at the middle of the band above the task strip (see renderScene).
// No zoom: the fitted painting only slides down; the gap it opens under the HUD is filled by actFeather.
// blur = how far the top fade reaches into the painting, as a fraction of its height (0 = hard edge).
// Picked in frame-preview.html (2026-10-19): character line 230, top fade 6% of the painting height.
const ATTIC_FRAME={focusY:230,blur:.06};
const FEATHER_TOP=.22;
const hasActArt=home=>Array.from({length:ACT_STAGES},(_,a)=>a).every(a=>art[actArtName(home,a)]?.naturalWidth);
function actGeo(home){
  const a=ACT_ART[ACT_KEYS[home]];if(a.geo)return a.geo;
  const t=a.targets,box=([x,y],s=92)=>[x-s/2,y-s*.45,s,s*.9];
  return a.geo={id:ACT_KEYS[home],act:true,targets:t,props:{0:box(t[0]),1:box(t[1]),2:box(t[2]),3:box(t[3]),4:box(t[4]),5:box(t[4],104)},
    install:()=>null,window:[],roof:[],bed:[],windowClip:[],windowBox:[0,0,0,0],fire:t[2],soupOff:[0,0],seat:false};
}
const roomArt=(warm)=>{const pair=HOME_ROOMS[roomHome]||HOME_ROOMS[0],n=pair[warm?1:0];return art[n]?.naturalWidth?n:warm?'room-warm':'room';};
const WINDOW_CLIP=[[657,93],[851,93],[851,303],[657,303]];
/** Window sky: drawn under the window repair so the planks still cover it. */
function drawSky(c,look,now,reduced,cold){
 if(look==='snow')return;
 // Painted home rooms already show their own sky; only the storm keeps its lightning flicker.
 if(art[HOME_ROOMS[roomHome][0]]?.naturalWidth){
   if(look==='storm'&&!reduced){const f=lightning(now);if(f>0){c.save();polygon(c,WINDOW_CLIP);c.clip();c.globalCompositeOperation='screen';c.fillStyle=`rgba(225,238,255,${(.55*f).toFixed(3)})`;c.fillRect(657,93,194,210);c.restore();}}
   return;
 }
 c.save();polygon(c,WINDOW_CLIP);c.clip();
 const g=c.createLinearGradient(0,93,0,303);
 if(look==='storm'){g.addColorStop(0,'rgba(40,52,60,.78)');g.addColorStop(1,'rgba(70,92,98,.62)');c.globalCompositeOperation='multiply';}
 else if(look==='dusk'){g.addColorStop(0,'rgba(110,70,160,.8)');g.addColorStop(.5,'rgba(215,100,130,.78)');g.addColorStop(1,'rgba(255,150,80,.85)');c.globalCompositeOperation='color';}
 else {g.addColorStop(0,'rgba(150,170,225,.7)');g.addColorStop(.55,'rgba(250,165,175,.8)');g.addColorStop(1,'rgba(255,195,130,.88)');c.globalCompositeOperation='color';}
 c.fillStyle=g;c.fillRect(657,93,194,210);
 c.globalCompositeOperation='screen';
 if(look==='dusk'){const h=c.createRadialGradient(760,300,10,760,300,170);h.addColorStop(0,'rgba(255,140,70,.45)');h.addColorStop(1,'rgba(255,150,80,0)');c.fillStyle=h;c.fillRect(657,93,194,210);}
 if(look==='dawn'){const h=c.createRadialGradient(800,300,6,800,300,200);h.addColorStop(0,'rgba(255,225,180,.6)');h.addColorStop(.3,'rgba(255,190,150,.32)');h.addColorStop(1,'rgba(255,190,150,0)');c.fillStyle=h;c.fillRect(657,93,194,210);}
 if(look==='storm'&&!reduced){const f=lightning(now);if(f>0){c.fillStyle=`rgba(225,238,255,${(.7*f).toFixed(3)})`;c.fillRect(657,93,194,210);}}
 c.restore();
}
/** Lightning pulse (0..1): a double flicker every ~6.5 s. */
function lightning(now){const u=(now/1000)%6.5;return Math.max(0,1-u/.14)+.6*Math.max(0,1-Math.abs(u-.32)/.1);}
/** Interior tint for the home's look, fading as the room warms. */
function tintRoom(c,look,amount,now,reduced){
 if(look==='snow'||amount<.01)return;
 // On a painted home room the grade is only an accent (the art carries the mood), so nothing washes out.
 if(art[HOME_ROOMS[roomHome][0]]?.naturalWidth)amount*=.28;
 c.save();
 if(look==='storm'){
   c.globalCompositeOperation='soft-light';c.fillStyle=`rgba(60,90,100,${(.5*amount).toFixed(3)})`;c.fillRect(0,0,900,600);
   c.globalCompositeOperation='multiply';c.fillStyle=`rgba(190,205,210,${(.35*amount).toFixed(3)})`;c.fillRect(0,0,900,600);
   if(!reduced){const f=lightning(now);if(f>0){c.globalCompositeOperation='screen';c.fillStyle=`rgba(200,220,255,${(.12*f*amount).toFixed(3)})`;c.fillRect(0,0,900,600);}}
 }else if(look==='dusk'){
   c.globalCompositeOperation='color';c.fillStyle=`rgba(150,90,160,${(.2*amount).toFixed(3)})`;c.fillRect(0,0,900,600);
   c.globalCompositeOperation='soft-light';c.fillStyle=`rgba(200,110,170,${(.6*amount).toFixed(3)})`;c.fillRect(0,0,900,600);
   c.globalCompositeOperation='screen';const g=c.createRadialGradient(760,260,20,760,260,560);
   g.addColorStop(0,`rgba(255,140,80,${(.38*amount).toFixed(3)})`);g.addColorStop(1,'rgba(255,140,90,0)');c.fillStyle=g;c.fillRect(0,0,900,600);
   // Low mountain fog drifting along the floor.
   const drift=reduced?0:Math.sin(now*.00035)*40;
   for(let k=0;k<3;k++){const fx=180+k*260+drift*(k%2?1:-1),fg=c.createRadialGradient(fx,560,10,fx,560,260);
     fg.addColorStop(0,`rgba(235,215,240,${(.34*amount).toFixed(3)})`);fg.addColorStop(1,'rgba(235,215,240,0)');c.fillStyle=fg;c.fillRect(0,0,900,600);}
 }else{
   c.globalCompositeOperation='color';c.fillStyle=`rgba(220,170,150,${(.24*amount).toFixed(3)})`;c.fillRect(0,0,900,600);
   c.globalCompositeOperation='soft-light';c.fillStyle=`rgba(255,190,150,${(.55*amount).toFixed(3)})`;c.fillRect(0,0,900,600);
   // Soft first light spilling from the window.
   c.globalCompositeOperation='screen';
   const g=c.createRadialGradient(760,210,20,760,210,560);
   g.addColorStop(0,`rgba(255,200,160,${(.3*amount).toFixed(3)})`);g.addColorStop(1,'rgba(255,200,160,0)');c.fillStyle=g;c.fillRect(0,0,900,600);
 }
 c.restore();
}
const PROP_RECTS={2:[98,357,106,106],4:[714,502,88,67],5:[704,493,106,78]};
const easeInOut=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const easeOut=t=>1-Math.pow(1-t,3);
function rng(seed){let s=(seed>>>0)||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function sprite(c,name,x,y,w,h=w){const im=vfx[name];if(!im?.naturalWidth)return false;c.drawImage(im,x,y,w,h);return true;}
// ---- Face bounds for UI placement (story bubbles). Art px (646x840) -> puppet rect (421,92 328x421).
const ART_SX=328/646,ART_SY=421/840;
/** Head box around a tracked face (hair and forehead included) in room coordinates. */
function headBox([x,y,w,h]){return [421+(x-.22*w)*ART_SX,92+(y-.5*h)*ART_SY,1.44*w*ART_SX,1.6*h*ART_SY];}
function faceTrack(state,clipTime){
 const t=FAMILY_FACES.clips[state];if(!t)return null;
 const k=Math.max(0,Math.min(t.mother.length-1,Math.round(clipTime*FAMILY_FACES.fps/FAMILY_FACES.step)));
 return {t,k};
}
/** Head boxes in VIEW coordinates (room seen through the reveal camera) for UI placement:
 *  `now` = this frame; `span` = union of where the head will be over the next `aheadMs`, using
 *  the clip's own face track at its playback rate AND the exact future reveal-camera path, so a
 *  bubble placed now stays clear for the whole line. Mesh fallback: rest pose + puppet joints. */
function faceBounds(pose,camAt,now,aheadMs=3300){
  if(pose.painted)return paintedFaceBounds(pose.painted,camAt,now,aheadMs);
  const v=pose.video,rest=FAMILY_FACES.rest,out={};
 const view=(b,cam)=>{const z=cam.zoom;return [(b[0]-cam.x)*z+450,(b[1]-cam.y)*z+300,b[2]*z,b[3]*z];};
 const stepMs=FAMILY_FACES.step*1000/FAMILY_FACES.fps/Math.max(.25,v?.rate||1);
 for(const who of ['mother','daughter']){
   const ft=v?faceTrack(v.state,v.clipTime):null;
   let boxAt,steps;
   if(ft){
     const list=ft.t[who],n=list.length;
     // After a one-shot ends it either holds its last frame (fail/win) or hands over to a loop
     // that starts in the rest pose: cover both.
     boxAt=i=>{let j=ft.k+i;if(j>=n){if(!v.loop){const a=headBox(list[n-1]),b=headBox(rest[who]);
       const x0=Math.min(a[0],b[0]),y0=Math.min(a[1],b[1]);return [x0,y0,Math.max(a[0]+a[2],b[0]+b[2])-x0,Math.max(a[1]+a[3],b[1]+b[3])-y0];}j%=n;}
       return headBox(list[j]);};
     steps=Math.ceil(aheadMs/stepMs);
   }else{
     const j=pose.joints?.[who==='mother'?'motherHead':'daughterHead']||[0,0],b=headBox(rest[who]);
     // The mesh puppet moves heads by at most ~12 scene px; pad for it.
     boxAt=()=>[b[0]+j[0]-12,b[1]+j[1]-12,b[2]+24,b[3]+24];
     steps=Math.ceil(aheadMs/100);
   }
   const cur=view(ft?boxAt(0):headBox(rest[who]).map((q,i)=>q+(i<2?(pose.joints?.[who==='mother'?'motherHead':'daughterHead']?.[i]||0):0)),camAt(now));
   let [x0,y0,x1,y1]=[cur[0],cur[1],cur[0]+cur[2],cur[1]+cur[3]];
   for(let i=0;i<=steps;i++){
     const t=now+i*(ft?stepMs:100),b=view(boxAt(i),camAt(t));
     x0=Math.min(x0,b[0]);y0=Math.min(y0,b[1]);x1=Math.max(x1,b[0]+b[2]);y1=Math.max(y1,b[1]+b[3]);
   }
   out[who]={now:cur,span:[x0,y0,x1-x0,y1-y0]};
 }
  return out;
}
/** Painted acts: fixed head boxes per act; `sets` lists the act(s) on screen (two during a crossfade). */
function paintedFaceBounds(sets,camAt,now,aheadMs){
  const view=(b,cam)=>{const z=cam.zoom;return [(b[0]-cam.x)*z+450,(b[1]-cam.y)*z+300,b[2]*z,b[3]*z];};
  const out={};
  ['mother','daughter'].forEach((who,i)=>{
    const boxes=sets.map(s=>s[i]),cur=view(boxes[0],camAt(now));
    let x0=cur[0],y0=cur[1],x1=cur[0]+cur[2],y1=cur[1]+cur[3];
    for(let k=0;k*100<=aheadMs;k++){const cam=camAt(now+k*100);
      for(const b of boxes){const v=view(b,cam);x0=Math.min(x0,v[0]);y0=Math.min(y0,v[1]);x1=Math.max(x1,v[0]+v[2]);y1=Math.max(y1,v[1]+v[3]);}}
    out[who]={now:cur,span:[x0,y0,x1-x0,y1-y0]};
  });
  return out;
}
export function preloadScene(){
  // Character clips stream in the background; the scene is playable with the mesh fallback first.
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)preloadFamilyVideo();
  // VFX sprites are optional polish: the scene never waits for them.
  for(const name of VFX_NAMES){const im=new Image();im.decoding='async';const path='assets/'+name+'.webp';im.src=window.__ASSETS__?.[path]||path;vfx[name]=im;}
  // Other homes' rooms load in the background; until ready the scene falls back to the first home's room.
  for(const name of HOME_ROOMS.flat()){const im=new Image();im.decoding='async';const path='assets/'+name+'.webp';im.src=window.__ASSETS__?.[path]||path;art[name]=im;}
  // Painted stages (6 per home) stream in the background; a home uses them once all six have loaded.
  for(const k of ACT_KEYS)for(let a=0;a<ACT_STAGES;a++){const name=`act-${k}-${a}`,im=new Image();im.decoding='async';const path='assets/'+name+'.webp';im.src=window.__ASSETS__?.[path]||path;art[name]=im;}
  for(const k of Object.keys(ACT_OPEN))for(const a of Object.keys(ACT_OPEN[k])){const name=`act-${k}-${a}-open`,im=new Image();im.decoding='async';const path='assets/'+name+'.webp';im.src=window.__ASSETS__?.[path]||path;art[name]=im;}
  return Promise.all(['room','room-warm','family','family-happy','prop-0','prop-1','prop-2','prop-3','prop-4','prop-5','flame'].map(name=>new Promise((resolve,reject)=>{
    const img=new Image();art[name]=img;img.onload=resolve;img.onerror=()=>reject(new Error('素材加载失败：'+name));
    const path='assets/'+name+'.webp';img.src=window.__ASSETS__?.[path]||path;
  })));
}
function image(c,name,x,y,w,h,alpha=1){
 const im=art[name];if(!im?.naturalWidth)return;
 c.save();c.globalAlpha*=alpha;c.drawImage(im,x,y,w,h);c.restore();
}
function prop(c,i,x,y,w,h,alpha=1){image(c,'prop-'+i,x,y,w,h,alpha);}
/** Fill around a fitted painting: the same art, tiny-sampled (soft blur on every browser), cover-scaled and dimmed. */
const backdropCache=new Map();
function actBackdrop(c,name,bw,bh,scale,ox,oy){
 const im=art[name];if(!im?.naturalWidth)return;
 if(Math.abs(bw-900*scale)<2&&Math.abs(bh-600*scale)<2)return;
 let small=backdropCache.get(name);
 if(!small){small=document.createElement('canvas');small.width=30;small.height=20;small.getContext('2d').drawImage(im,0,0,30,20);backdropCache.set(name,small);}
 const k=Math.max(bw/900,bh/600)*1.08,w=900*k,h=600*k;
 c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(small,(bw-w)/2,(bh-h)/2,w,h);
 c.fillStyle='rgba(12,20,34,.38)';c.fillRect(0,0,bw,bh);
 c.restore();
}
/** Seam option A: the painting's top and bottom edges dissolve into the same blurred fill, plus a soft shade under the HUD. */
const featherCache=new Map();
function actFeather(c,name,bw,bh,scale,ox,oy,dpr,top=FEATHER_TOP){
 const im=art[name];if(!im?.naturalWidth)return;
 if(Math.abs(bw-900*scale)<2&&Math.abs(bh-600*scale)<2)return;
 top=Math.max(0,Math.min(.6,+top||0));
 const ph=600*scale,key=`${name}|${bw}|${bh}|${Math.round(oy)}|${scale.toFixed(4)}|${top.toFixed(3)}`;
 let f=featherCache.get(key);
 if(!f){
  if(featherCache.size>8)featherCache.clear();
  f=document.createElement('canvas');f.width=bw;f.height=bh;const g=f.getContext('2d');
  actBackdrop(g,name,bw,bh,scale,ox,oy);
  // Keep the fill only over the painting's edges: opaque outside, clear across the middle.
  const m=g.createLinearGradient(0,oy,0,oy+ph);
  if(top>0){m.addColorStop(0,'#000');m.addColorStop(top*.27,'rgba(0,0,0,.72)');m.addColorStop(top,'rgba(0,0,0,0)');}
  // 0: hard edge, but the gap above the painting (gradient clamps to stop 0) stays fully blurred.
  else{m.addColorStop(0,'#000');m.addColorStop(.002,'rgba(0,0,0,0)');}
  m.addColorStop(.84,'rgba(0,0,0,0)');m.addColorStop(.95,'rgba(0,0,0,.7)');m.addColorStop(1,'#000');
  g.globalCompositeOperation='destination-in';g.fillStyle=m;g.fillRect(0,0,bw,bh);
  g.globalCompositeOperation='source-over';
  const hh=Math.round(120*dpr),sh=g.createLinearGradient(0,0,0,hh);
  sh.addColorStop(0,'rgba(8,14,26,.55)');sh.addColorStop(1,'rgba(8,14,26,0)');g.fillStyle=sh;g.fillRect(0,0,bw,hh);
  featherCache.set(key,f);
 }
 c.save();c.setTransform(1,0,0,1,0,0);c.drawImage(f,0,0);c.restore();
}
const windowShape=[[673,113],[847,70],[847,295],[673,295]];
// Coordinates are measured on the 1200×800 room art, mapped to 900×600.
const roofShape=[[442,0],[610,0],[596,18],[563,34],[529,48],[491,60],[449,48],[431,34]];
const bedShape=[[456,318],[590,320],[619,348],[763,360],[763,516],[487,442],[456,403]];
const targets=[[759,174],[513,31],[149,418],[646,419],[759,551]];
// ---- Per-home layout. Every repair mask, target, prop drop and cold dressing reads from `geo`.
const ellipsePts=(cx,cy,rx,ry,n=32)=>Array.from({length:n},(_,i)=>[cx+rx*Math.cos(i/n*Math.PI*2),cy+ry*Math.sin(i/n*Math.PI*2)]);
const BASE_GEO={id:'cottage',window:windowShape,roof:roofShape,bed:bedShape,targets,props:PROP_RECTS,seat:true,
  windowClip:WINDOW_CLIP,windowBox:[657,93,194,210],soupOff:[0,0],fire:[151,404],
  install:(task,part)=>task===0?[759,98+part*55]:task===1?[447+part*40,29]:task===3?[494+part*76,381+part*24]:null};
// Attic (room-attic.webp, measured in 900x600 scene space): round skylight top right, broken stovepipe
// above the iron stove on the left, bed under the eaves. The family keeps its seat on the mattress.
const ATTIC_GEO={id:'attic',window:ellipsePts(746,118,140,134),roof:[[94,0],[174,0],[174,270],[94,270]],
  stove:[[124,296],[208,296],[208,404],[124,404]],
  bed:[[456,316],[602,312],[628,350],[862,354],[880,470],[772,534],[486,442],[456,400]],
  targets:[[746,118],[134,120],[166,352],[660,420],[835,561]],props:{2:[131,338,70,62],4:[790,512,88,67],5:[780,503,106,78]},seat:false,
  windowClip:ellipsePts(746,118,104,104),windowBox:[640,12,214,214],soupOff:[76,10],fire:[166,352],
  install:(task,part)=>task===0?[746,40+part*52]:task===1?[134,30+part*66]:task===3?[520+part*90,370+part*30]:null};
let geo=BASE_GEO;
// ---- Three acts per home: cold (0-1 repairs done), warming (2-3), warm (4-5). Each act change gets a
// short title card: letterbox bars, a push-in on the pair, a light sweep and the act name.
const ACT_MS=2600;
export const ACT_NAMES={
  attic:[['第一幕','雪夜 · 漏风的阁楼','Act I','Snowy night · a drafty attic'],['第二幕','炉火 · 慢慢回暖','Act II','Firelight · warming up'],['第三幕','安睡 · 温暖的阁楼','Act III','Sound asleep · a warm attic']],
  stone:[['第一幕','风雪 · 冰冷的石屋','Act I','Blizzard · a frozen stone hut'],['第二幕','火塘 · 慢慢回暖','Act II','Hearth fire · warming up'],['第三幕','团圆 · 温暖的石屋','Act III','Together · a warm stone hut']],
  lake:[['第一幕','寒风 · 漏风的渔屋','Act I','Icy wind · a drafty fishing hut'],['第二幕','灯火 · 一起修补','Act II','Lamplight · mending together'],['第三幕','晚霞 · 温暖的渔屋','Act III','Sunset · a warm fishing hut']],
  farm:[['第一幕','破门 · 冰冷的农舍','Act I','Broken door · a frozen farmhouse'],['第二幕','灶火 · 慢慢回暖','Act II','Hearth · warming up'],['第三幕','清晨 · 温暖的家','Act III','Morning · a warm home']],
  cottage:[['第一幕','寒冷','Act I','Cold'],['第二幕','回暖','Act II','Warming up'],['第三幕','温暖','Act III','Warm at last']]};
const lerp=(a,b,t)=>a+(b-a)*t;
export function installationTarget(task,progress){
 const part=Math.min(3,Math.floor(Math.max(0,progress-.00001)*4));
 return geo.install(task,part)||[...geo.targets[task]];
}
function polygon(c,points){
 c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
}
function section(c,shape,index,count,progress,vertical=false){
 const a=clamp(progress*count-index);if(!a)return;
 const xs=shape.map(p=>p[0]),ys=shape.map(p=>p[1]);
 const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
 c.save();polygon(c,shape);c.clip();
 // Boards and quilt sections physically extend into their fitted silhouette.
 c.beginPath();
 if(vertical)c.rect(x+w*index/count,y,w/count+.7,h*a);
 else c.rect(x,y+h*index/count,w*a,h/count+.7);
 c.clip();image(c,roomArt(true),0,0,900,600);c.restore();
}
function shadow(c,x,y,rx,ry,alpha){
 c.save();c.translate(x,y);c.scale(1,ry/rx);
 const g=c.createRadialGradient(0,0,0,0,0,rx);
 g.addColorStop(0,`rgba(12,15,24,${alpha})`);g.addColorStop(1,'rgba(12,15,24,0)');
 c.fillStyle=g;c.beginPath();c.arc(0,0,rx,0,Math.PI*2);c.fill();c.restore();
}
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
function jointWeight(x,y,cx,cy,rx,ry){
 const r=Math.hypot((x-cx)/rx,(y-cy)/ry);
 return 1-smooth(r);
}
function puppetSource(happy){
 if(puppetSources.has(happy))return puppetSources.get(happy);
 const canvas=document.createElement('canvas');canvas.width=328;canvas.height=421;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 // Opaque selection, never alpha-blend mismatched silhouettes. Feet retain one source.
 ctx.drawImage(art[happy?'family-happy':'family'],0,0,328,421);
 ctx.clearRect(0,246,328,175);
 ctx.save();ctx.beginPath();ctx.rect(0,246,328,175);ctx.clip();
 ctx.drawImage(art.family,0,0,328,421);ctx.restore();
 const source=ctx.getImageData(0,0,328,421);
 puppetSources.set(happy,source);return source;
}
export const REACTION_MS={success:1800,combo:1600,win:5200,error:1000,fail:900,remove:900,hurry:1500,idle:0};
/** Burst envelope for cold shivers: 1.7 s slots, each with a 0.8-1.2 s tremble and a 0.5-0.9 s rest.
 *  `offset` (s) shifts the slot clock so two people shiver at different moments. */
function shiverBurst(t,offset){
 const slot=1.7,k=Math.floor((t+offset)/slot),u=(t+offset)-k*slot;
 const h=Math.abs(Math.sin(k*12.9898+offset*78.233)*43758.5453)%1,len=.8+.4*h;
 return smooth(u/.12)*(1-smooth((u-len+.15)/.15));
}
function actionPose(now,reduced,safe,kind,age){
 const t=now/1000,duration=REACTION_MS[kind]||1800,progress=clamp(age/duration);
 const pulse=Math.sin(Math.PI*progress),arrival=Math.sin(Math.PI*clamp((age-500)/1150));
 const cold=!safe,cycle=(t%7)/7;
 // Idle micro-acting: periodic glance toward the window when cold, the child looks up at her mother when warm.
 const glance=cold?smooth((Math.sin(t*.45)-.72)*4):0;
 const childLook=smooth((Math.sin(t*.31+1.3)-.78)*5);
 const rub=cold?smooth((Math.sin(t*.62+2.1)-.7)*4):0;
 // Cold shivering comes in bursts: ~1 s of a 6.5-8 Hz tremble, then a short rest, like real cold
 // shivers. Mother and daughter run on offset clocks at different rates so they never buzz in sync.
 // Amplitude is small (mother ~2.5 px, daughter ~3.5 px) and there is no whole-body scaling.
 const shudder=cold?Math.max(0,Math.sin(t*.37+2)-.9)/.1:0;
 const burstM=cold?shiverBurst(t,0):0,burstC=cold?shiverBurst(t,.63):0;
 const trem=(f,ph)=>Math.sin(2*Math.PI*f*t+ph+.55*Math.sin(2*Math.PI*1.3*t+ph));
 let shiver=cold?trem(6.6,0)*burstM*(2.5+.8*shudder)*(1-rub*.4):0;
 let shiverChild=cold?trem(7.8,1.9)*burstC*(3.5+.8*shudder)*(1-rub*.3):0;
 // Shoulders hunch up during a burst; the head gives a small nod at half the tremble rate.
 const hunch=cold?1.4*Math.max(burstM,burstC):0;
 const nodM=cold?.9*burstM*Math.sin(2*Math.PI*3.3*t):0,nodC=cold?1.1*burstC*Math.sin(2*Math.PI*3.9*t+1.2):0;
 let hands=cold?rub*Math.sin(t*15)*2.2:0;
 let action=cold?(shudder>.3?'打了个寒颤':glance>.3?'张望窗外':rub>.3?'搓热女儿的手臂':'抱紧发抖'):(childLook>.3?'女儿抬头看妈妈':'安心呼吸');
 let motherTurn=(cold?.006*Math.sin(t*1.1):.008*Math.sin(t*.7))+glance*.085;
 let childTurn=(cold?-.005*Math.sin(t*1.1+.8):.012*Math.sin(t*.8))-childLook*.07;
 let motherLift=-2*glance+(cold?-1.5*shudder+nodM:0),childLift=-4*childLook+nodC,hug=cold?2.6+1.5*shudder:.5+.4*Math.sin(t*1.1);
 let shoulder=cold?1.2+hunch+1.5*shudder:0,lean=cold?0:Math.sin(t*.5)*.6,bob=0;
 if(kind==='success'){
   action=age<650?'抬头迎接物资':'回应并松肩';
   motherTurn=-.065*pulse;childTurn=.065*pulse;
   motherLift=-9*pulse;childLift=-7*arrival;hug=-3.2*arrival;lean=2.4*pulse;
   bob=-8*Math.abs(Math.sin(Math.PI*2*progress))*(1-progress);shoulder=0;shiver*=1-pulse;shiverChild*=1-pulse;hands=0;
 }else if(kind==='combo'){
   action='母女一起雀跃';
   const hop=Math.abs(Math.sin(Math.PI*2*progress));
   bob=-16*hop*(1-progress*.4);motherTurn=-.08*pulse;childTurn=.13*Math.sin(Math.PI*2*progress);
   childLift=-13*hop;motherLift=-6*hop;hug=-3*pulse;lean=3.5*pulse;shoulder=0;shiver*=1-pulse;shiverChild*=1-pulse;hands=0;
 }else if(kind==='win'){
   action=age<1100?'惊喜抬头':age<2400?'相视欢笑并摇摆':'紧紧拥抱';
   const env=1-smooth((age-2600)/800);
   motherTurn=.1*Math.sin(t*3.2)*env*smooth(age/500);childTurn=-.11*Math.sin(t*3.2+.6)*env*smooth(age/500);
   bob=-13*Math.abs(Math.sin(t*4.6))*env;motherLift=-5*env;childLift=-10*env;hug=7*smooth(age/900);
   lean=5*pulse;shoulder=0;shiver=shiverChild=0;hands=0;
 }else if(kind==='error'){
   // A sharp flinch: quick recoil away from the board, both heads duck, then a slow settle.
   action='猛地缩肩护住女儿';
   const snap=Math.sin(Math.PI*clamp(age/260)),settle=smooth(age/duration);
   motherTurn=-.2*snap-.08*pulse;childTurn=.16*snap+.06*pulse;motherLift=9*snap+4*pulse;childLift=6*snap;
   hug=14*snap+7*pulse;lean=-14*snap-5*pulse;shoulder=3*snap+2*pulse*(1-settle);
 }else if(kind==='hurry'){
   // Panicked look toward the door: a big repeated head turn with a visible tremble.
   action='慌张回头看门';
   const look=Math.sin(Math.PI*2*clamp(age/duration)*1.5);
   motherTurn=.3*pulse+.08*look;childTurn=-.14*pulse;motherLift=-9*pulse;childLift=-4*pulse;
   hug=9*pulse;shoulder=3+3*pulse;lean=-7*pulse+3*look*pulse;
 }else if(kind==='fail'){
   action='低头垂肩仍抱着女儿';
   const sink=smooth(age/750);
   motherTurn=.085*sink;childTurn=-.055*sink;
   motherLift=11*sink;childLift=7*sink;hug=2*sink;lean=-2*sink;shoulder=3*sink;
 }else if(kind==='remove'){
   action='低头查看手边';motherTurn=.035*pulse;motherLift=4*pulse;childLift=2*pulse;
 }
 if(reduced){
   motherTurn=childTurn=motherLift=childLift=hug=shoulder=lean=bob=shiver=shiverChild=hands=0;
   action+='（静态）';
 }
 // Breathing stays a small chest movement: quick and shallow in the cold, slow and easy once warm.
 return {action,actionProgress:kind?progress:cycle,motherTurn,childTurn,motherLift,childLift,hug,shoulder,lean,bob,shiver,shiverChild,hands,
   breath:reduced?0:cold?Math.sin(t*2.6)*.35:Math.sin(t*1.8)*.8};
}
function displacement(x,y,p){
 // Smooth compact weights share one continuous deformation field, including clasped hands.
 const mother=jointWeight(x,y,137,86,121,122);
 const child=jointWeight(x,y,240,151,83,87);
 const shoulder=jointWeight(x,y,132,169,118,70);
 const embrace=jointWeight(x,y,202,226,139,59);
 const torso=jointWeight(x,y,168,191,147,114);
 const anchor=1-smooth((y-228)/53); // All seat/leg/foot pixels below 281 are immutable.
 // Shiver is a sideways tremor of each upper body on its own clock, with a faint vertical hitch.
 const shiver=p.shiver||0,shiverC=p.shiverChild??shiver*.7,hands=p.hands||0;
 const dx=(-p.motherTurn*(y-145)*mother-p.childTurn*(y-190)*child+
   p.lean*torso+(202-x)*p.hug*.035*embrace+p.shoulder*shoulder+
   shiver*(mother+.5*shoulder)+shiverC*child+hands*embrace)*anchor;
 const dy=(p.motherTurn*(x-137)*mother+p.motherLift*mother+
   p.childTurn*(x-240)*child+p.childLift*child-
   p.hug*.55*embrace+p.shoulder*.45*shoulder-p.breath*torso*.6+(p.bob||0)+
   (shiver*mother+shiverC*child)*.2)*anchor;
 return [dx,dy];
}
function drawPuppet(c,happy,x,y,p){
 const source=puppetSource(happy),w=328,h=421,step=16;
 if(!puppetSurface){
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   puppetSurface={canvas,ctx:canvas.getContext('2d'),pixels:new ImageData(w,h)};
 }
 const {canvas,ctx,pixels}=puppetSurface,input=source.data,out=pixels.data;
 const signature=[happy,p.motherTurn,p.childTurn,p.motherLift,p.childLift,p.hug,p.shoulder,p.lean,p.breath,p.bob,p.shiver,p.shiverChild,p.hands].join(',');
 if(puppetSurface.signature===signature){c.drawImage(canvas,x,y);return;}
 puppetSurface.signature=signature;
 out.set(input);
 // Inverse sample a shared grid into one bitmap: no overlapping triangles or cutout seams.
 const cols=Math.ceil(w/step)+1,rows=Math.ceil(282/step)+1,grid=[];
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)grid.push(displacement(i*step,j*step,p));
 for(let py=0;py<281;py++){
   const gy=Math.floor(py/step),v=(py%step)/step;
   for(let px=0;px<w;px++){
     const gx=Math.floor(px/step),u=(px%step)/step;
     const a=grid[gy*cols+gx],b=grid[gy*cols+gx+1],d=grid[(gy+1)*cols+gx],e=grid[(gy+1)*cols+gx+1];
     const sx=px-lerp(lerp(a[0],b[0],u),lerp(d[0],e[0],u),v);
     const sy=py-lerp(lerp(a[1],b[1],u),lerp(d[1],e[1],u),v);
     const dest=(py*w+px)*4;
     if(sx<0||sy<0||sx>=w-1||sy>=h-1){out.fill(0,dest,dest+4);continue;}
     const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
     const q=(iy*w+ix)*4,r=q+w*4;
     const wa=(1-fx)*(1-fy)*input[q+3],wb=fx*(1-fy)*input[q+7];
     const wc=(1-fx)*fy*input[r+3],wd=fx*fy*input[r+7];
     const alpha=wa+wb+wc+wd;
     out[dest+3]=alpha;
     // Premultiplied interpolation avoids dark/colored fringes at the transparent silhouette.
     for(let channel=0;channel<3;channel++){
       const value=input[q+channel]*wa+input[q+4+channel]*wb+input[r+channel]*wc+input[r+4+channel]*wd;
       out[dest+channel]=alpha>0?value/alpha:0;
     }
   }
 }
 ctx.putImageData(pixels,0,0);c.drawImage(canvas,x,y);
}
function family(c,happy,now,reduced,safe,kind,age,bedP,video=null){
 // Lift the seated hips onto the mattress, rather than suspending them below its edge.
 const x=421,y=92;
 // Cache identical samples at 30 Hz; the environment may continue rendering at display rate.
 const sampleTime=Math.floor(now/ (1000/30))*(1000/30);
 const sampleAge=Number.isFinite(age)?Math.max(0,age-(now-sampleTime)):age;
 const pose=actionPose(sampleTime,reduced,safe,kind,sampleAge);
 // Reuse the actual mattress textile as a visible load-bearing lip, behind both thighs.
 const seat=art[roomArt(bedP>.5)];
 if(geo.seat){c.save();polygon(c,[[469,383],[704,391],[718,405],[718,420],[469,410]]);c.clip();
 c.drawImage(seat,608*seat.naturalWidth/1200,482*seat.naturalHeight/800,
   190*seat.naturalWidth/1200,47*seat.naturalHeight/800,469,383,249,37);c.restore();}
 shadow(c,510,394,53,7,.58);
 shadow(c,688,400,35,7,.55);
 shadow(c,533,504,40,6,.64);
 shadow(c,685,499,38,6,.61);
 const name=happy?'family-happy':'family';
 // Real animation first: a keyed reference-to-video clip mapped onto the same 328x421 cutout
 // rectangle (seat, feet and hands register on the art). Reduced motion, a missing/undecodable
 // clip or the offline single file keep the continuous mesh deform below.
 const clip=!reduced&&video?drawFamilyVideo(c,{...video,rect:[x,y,328,421]}):null;
 if(!clip)drawPuppet(c,happy,x,y,pose);
 else if(clip.label)pose.action=clip.label;
 return {asset:name,...pose,upperBodyRecoil:kind==='error'?pose.hug:0,upperBodyShiver:pose.shiver,
   motionMethod:clip?'keyed-video':'continuous-inverse-mesh',fixedBelowY:373,
   video:clip?{state:clip.state,how:clip.how,clipTime:+clip.clipTime.toFixed(3),clipDuration:+clip.clipDuration.toFixed(3),
     loop:clip.loop,alpha:clip.alpha,decodedFrames:clip.decodedFrames,rate:clip.rate||1}:null,
   joints:{motherHead:displacement(137,86,pose),daughterHead:displacement(240,151,pose),
     joinedHands:displacement(202,226,pose),shoulder:displacement(110,164,pose),feet:displacement(112,412,pose)}};
}
/** One repair layer at a given progress (world coordinates). Soup is drawn after the family. */
function drawRepair(c,i,p,now,reduced){
 if(!(p>0))return;
 const attic=geo.id==='attic';
 if(i===0)for(let k=0;k<4;k++)section(c,geo.window,k,4,p);
 // The attic stovepipe is rebuilt joint by joint from the ceiling down.
 else if(i===1)for(let k=0;k<4;k++)section(c,geo.roof,k,4,p,!attic);
 else if(i===3)for(let k=0;k<4;k++)section(c,geo.bed,k,4,p,true);
 else if(i===2){
   // Fire is an actual independent existing flame asset, not a painted room swap.
   const [gx,gy]=geo.fire,glow=c.createRadialGradient(gx,gy,0,gx,gy,470);
   glow.addColorStop(0,`rgba(255,165,62,${.29*p})`);glow.addColorStop(1,'rgba(255,160,60,0)');
   c.fillStyle=glow;c.fillRect(0,0,900,600);
   const flicker=reduced?1:1+Math.sin(now*.007)*.055;
   if(attic){
     // The iron stove's own painted fire comes up, with a live flame licking inside the open door.
     c.save();c.globalAlpha*=Math.min(1,p*1.6);polygon(c,geo.stove);c.clip();image(c,roomArt(true),0,0,900,600);c.restore();
     const flameH=(22+50*p)*flicker;
     c.save();c.globalCompositeOperation='screen';image(c,'flame',140,398-flameH,54,flameH,Math.min(1,p*1.8)*.75);c.restore();
     return;
   }
   // Fuel settles inside the firebox, with the flame rooted on its hearth.
   prop(c,2,98,357,106,106,Math.min(1,p*4));
   const flameH=(55+100*p)*flicker;
   image(c,'flame',88,437-flameH,113,flameH,Math.min(1,p*1.8));
 }
}
function drawSoup(c,soupP,now,reduced){
 if(!soupP)return;
 const [ox,oy]=geo.soupOff;
 c.save();c.translate(ox,oy);
 shadow(c,759,567,41,6,.32);
 // Ingredients gather on the floor; the same spot becomes the finished bowl.
 const cooked=clamp((soupP-.15)/.65);
 prop(c,4,714,502,88,67,(1-cooked)*Math.min(1,soupP*5));
 const settle=reduced?0:(1-cooked)*3;
 prop(c,5,704,493-settle,106,78,cooked);
 if(cooked>0){
   c.save();c.lineWidth=2.5;c.lineCap='round';
   for(let i=0;i<4;i++){
     const strength=clamp(soupP*4-i);if(!strength)continue;
     const rise=reduced?.45:(now*.00045+i*.23)%1;
     const x=738+i*13,y=513-rise*(19+soupP*32);
     c.strokeStyle=`rgba(255,238,215,${strength*cooked*(1-rise)*.55})`;
     c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x-7,y-9,x+7,y-13,x,y-22);c.stroke();
   }c.restore();
 }
 c.restore();
}
/** The newly installed piece: exactly the repair-layer pixels between `from` and `to`
 *  (window boards, roof planks, quilt), or the prop that lands (firewood, soup). */
function revealPiece(task,from,to){
  // Painted acts: every repair lands as its supply sprite on the spot it fixes, then the act art takes over.
  if(task===2||task===4||geo.act){
    const key=task===4?(clamp((to-.15)/.65)>.5?5:4):task;
    return {prop:key,bbox:[...geo.props[key]]};
  }
 const cv=document.createElement('canvas');cv.width=900;cv.height=600;
 const g=cv.getContext('2d',{willReadFrequently:true});
 drawRepair(g,task,to,0,true);g.globalCompositeOperation='destination-out';drawRepair(g,task,from,0,true);
 const d=g.getImageData(0,0,900,600).data;let x0=900,y0=600,x1=-1,y1=-1;
 for(let y=0;y<600;y+=3)for(let x=0;x<900;x+=3)if(d[(y*900+x)*4+3]>40){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
 if(x1<0){const shape=task===0?geo.window:task===1?geo.roof:geo.bed,xs=shape.map(q=>q[0]),ys=shape.map(q=>q[1]);
   x0=Math.min(...xs);x1=Math.max(...xs);y0=Math.min(...ys);y1=Math.max(...ys);}
 return {canvas:cv,bbox:[x0,y0,x1-x0+3,y1-y0+3]};
}
/** Timeline (ms after the credit): the token flight lands at 650 (app.js juice.fly .64 s); a
 *  completion then pushes the camera in (650-1100), the piece falls (810-1130), squashes and
 *  bounces (1130-1510), glow/rays/stars/dust fire at impact, the room warms, and the camera
 *  eases back (2050-2750). An in-progress step has no camera and a lighter burst. Reduced motion:
 *  a 320 ms crossfade of the piece, nothing moves. */
function makeReveal(task,from,to,at,reduced){
 const complete=to>.995,piece=revealPiece(task,from,to);
 const r={task,from,to,at,complete,piece,reduced,seed:(Math.floor(at*7)^(task*7919))>>>0,
   focus:[piece.bbox[0]+piece.bbox[2]/2,piece.bbox[1]+piece.bbox[3]/2]};
 if(reduced){r.dropAt=r.impactAt=at;r.settleAt=at+320;r.end=at+360;}
 else{r.dropAt=at+(complete?810:650);r.impactAt=r.dropAt+(complete?320:300);r.settleAt=r.impactAt+380;r.end=at+(complete?2800:1950);}
 r.fall=complete?120:90;
 return r;
}
function pieceTransform(r,now){
 if(now<r.dropAt)return null;
 if(r.reduced)return now<r.settleAt?{alpha:clamp((now-r.at)/320),dy:0,sx:1,sy:1}:null;
 if(now<r.impactAt){const u=(now-r.dropAt)/(r.impactAt-r.dropAt);return {alpha:clamp(u*3.5),dy:-r.fall*(1-u*u),sx:1-.05*u,sy:1+.09*u};}
 if(now<r.settleAt){
   const k=(now-r.impactAt)/(r.settleAt-r.impactAt),e=Math.exp(-4.5*k),osc=Math.cos(Math.PI*2.5*k);
   return {alpha:1,dy:k<.4?-16*Math.sin(Math.PI*k/.4):0,sx:1+.11*e*osc,sy:1-.17*e*osc};
 }
 // Landed props crossfade into the base layer while the flame/soup settles in.
 if(r.piece.prop&&now<r.settleAt+380)return {alpha:1-easeOut((now-r.settleAt)/380),dy:0,sx:1,sy:1};
 return null;
}
function drawPiece(c,r,now){
 const t=pieceTransform(r,now);if(!t||t.alpha<=0)return;
 const [x,y,w,h]=r.piece.bbox,px=x+w/2,py=y+h;
 c.save();c.globalAlpha*=t.alpha;c.translate(px,py+t.dy);c.scale(t.sx,t.sy);c.translate(-px,-py);
 if(r.piece.canvas)c.drawImage(r.piece.canvas,0,0);else prop(c,r.piece.prop,x,y,w,h);
 c.restore();
}
/** Impact VFX from sprites. 'back' layer (glow, light rays, warm wave, dust) sits in the room
 *  behind the characters so faces never blow out; 'front' layer is the star burst. The soup
 *  lands in front of the family, so its whole burst is 'front'. */
function drawRevealFx(c,r,now,layer){
 if(r.reduced)return;
 const age=now-r.impactAt;if(age<0)return;
 const front=layer==='front',back=layer==='back';
 const [x,y,w,h]=r.piece.bbox,cx=x+w/2,cy=y+h/2,big=r.complete,R=rng(r.seed),t=age/1000;
 const gs=Math.max(150,Math.min(300,Math.max(w,h)*1.15))*(big?1.15:1);
 c.save();c.globalCompositeOperation='lighter';
 if(big&&back){
   const wu=age/1100;
   if(wu<1){const g=c.createRadialGradient(cx,cy,0,cx,cy,120+700*easeOut(wu));
     g.addColorStop(0,`rgba(255,196,120,${(.16*(1-wu)).toFixed(3)})`);g.addColorStop(1,'rgba(255,170,90,0)');c.globalAlpha=1;c.fillStyle=g;c.fillRect(0,0,900,600);}
   const ru=age/1500;
   if(ru<1){const env=ru<.2?ru/.2:1-(ru-.2)/.8,s=gs*2.1;c.save();c.globalAlpha=.5*env;c.translate(cx,cy);c.rotate(ru*.9);sprite(c,'vfx-rays',-s/2,-s/2,s);c.restore();}
 }
 const gu=age/(big?1150:780);
 if(back&&gu<1){const env=gu<.15?gu/.15:1-(gu-.15)/.85,s=gs*(.6+.4*Math.min(1,gu*4));c.globalAlpha=.62*env;sprite(c,'vfx-glow',cx-s/2,cy-s/2,s);}
 const stars=big?18:10;
 for(let k=0;front&&k<stars;k++){
   const a=-Math.PI/2+(R()-.5)*Math.PI*1.7,sp=(big?430:330)*(.45+R()*.55),ttl=.8+R()*.5,ox=(R()-.5)*w*.6,oy=(R()-.5)*h*.4,sz=(big?54:44)*(.6+R()*.7);
   if(t>ttl)continue;
   const f=(1-Math.exp(-2.4*t))/2.4,px=cx+ox+Math.cos(a)*sp*f,py=cy+oy+Math.sin(a)*sp*f+170*t*t,u=t/ttl;
   const s=sz*(1-.35*u)*(.85+.25*Math.sin(t*18+k));
   c.globalAlpha=u<.7?1:1-(u-.7)/.3;sprite(c,'vfx-star',px-s/2,py-s/2,s);
 }
 c.restore();
 if(!back)return;
 c.save();
 const puffs=big?8:5;
 for(let k=0;k<puffs;k++){
   const dir=k%2?1:-1,x0=cx+dir*w*(.15+R()*.35),vx=dir*(80+R()*110),vy=-(18+R()*40),sz=60+R()*50,ttl=.85+R()*.25;
   if(t>ttl)continue;
   const u=t/ttl,f=(1-Math.exp(-3*t))/3,s=sz*(.55+.9*easeOut(u));
   c.globalAlpha=.78*Math.pow(1-u,1.2);sprite(c,'vfx-dust',x0+vx*f-s/2,y+h-10+vy*f-s*.45,s,s*.8);
 }
 c.restore();
}
/** Chapter finale (all five repairs): slow light rays behind the family, a star shower in front. */
function drawChapterFx(c,at,now,layer){
 const age=now-at;if(age<0||age>3400)return;
 const u=age/3400,env=u<.12?u/.12:1-Math.pow((u-.12)/.88,1.5),R=rng(9173);
 c.save();c.globalCompositeOperation='lighter';
 if(layer==='back'){
   c.save();c.globalAlpha=.34*env;c.translate(585,215);c.rotate(u*.6);sprite(c,'vfx-rays',-520,-520,1040);c.restore();
   c.globalAlpha=.26*env;sprite(c,'vfx-glow',585-260,215-260,520);
   c.restore();return;
 }
 for(let k=0;k<26;k++){
   const x0=60+R()*780,delay=R()*1.6,ttl=1.3+R()*.6,sz=40+R()*40,sway=R()*6,t=age/1000-delay;
   if(t<0||t>ttl)continue;
   const v=t/ttl;c.globalAlpha=v<.2?v/.2:1-Math.max(0,v-.6)/.4;
   const s=sz*(.8+.3*Math.sin(t*16+sway));sprite(c,'vfx-star',x0+Math.sin(t*2.4+sway)*26-s/2,-30+t*300-s/2,s);
 }
 c.restore();
}
/** Warm colour grading of the room layer (before the characters): colour temperature + light. */
function gradeRoom(c,w,now=0,reduced=true){
 if(w<.002)return;
 c.save();
 c.globalCompositeOperation='soft-light';c.fillStyle=`rgba(255,150,60,${(.7*w).toFixed(3)})`;c.fillRect(0,0,900,600);
 c.globalCompositeOperation='screen';
 const g=c.createRadialGradient(330,380,20,330,380,600);
 g.addColorStop(0,`rgba(255,184,110,${(.42*w).toFixed(3)})`);g.addColorStop(1,'rgba(255,170,90,0)');
 c.fillStyle=g;c.fillRect(0,0,900,600);
 // Firelight pooling out of the hearth, breathing gently.
 const fl=reduced?1:1+.07*Math.sin(now*.006)+.04*Math.sin(now*.017);
 const f=c.createRadialGradient(160,390,10,160,390,420);
 f.addColorStop(0,`rgba(255,150,70,${(.4*w*fl).toFixed(3)})`);f.addColorStop(1,'rgba(255,140,60,0)');
 c.fillStyle=f;c.fillRect(0,0,900,600);
 c.restore();
}
// ---- Cold dressing: blue grade, icicles, snow caps and drifts. All of it thaws as the room warms. ----
function coldGrade(c,k){
 if(k<.01)return;
 c.save();
 c.globalCompositeOperation='multiply';c.fillStyle=`rgba(140,166,220,${(.55*k).toFixed(3)})`;c.fillRect(0,0,900,600);
 c.globalCompositeOperation='color';c.fillStyle=`rgba(90,128,188,${(.25*k).toFixed(3)})`;c.fillRect(0,0,900,600);
 c.globalCompositeOperation='source-over';
 const v=c.createRadialGradient(470,330,170,470,330,620);
 v.addColorStop(0,'rgba(10,24,56,0)');v.addColorStop(1,`rgba(10,24,56,${(.6*k).toFixed(3)})`);
 c.fillStyle=v;c.fillRect(0,0,900,600);
 c.restore();
}
function snowCrust(c,x0,x1,y,k,seed){
 // A soft rounded snow cap with a shaded underside.
 c.fillStyle=`rgba(176,204,236,${(.9*k).toFixed(3)})`;c.beginPath();c.moveTo(x0-6,y+5);
 for(let x=x0;x<x1;x+=22)c.quadraticCurveTo(x+11,y+9+3*Math.sin(x*.21+seed),Math.min(x1,x+22),y+5);
 c.lineTo(x1+6,y-2);c.lineTo(x0-6,y-2);c.closePath();c.fill();
 c.fillStyle=`rgba(244,250,255,${(.96*k).toFixed(3)})`;c.beginPath();c.moveTo(x0-6,y+4);
 for(let x=x0;x<x1;x+=18)c.quadraticCurveTo(x+9,y-8-4*Math.abs(Math.sin(x*.27+seed)),Math.min(x1,x+18),y+2);
 c.lineTo(x1+6,y+4);c.closePath();c.fill();
}
function icicleRow(c,x0,x1,y,len,n,k,seed,now,thaw){
 if(k<.02)return;
 const r=rng(seed);c.save();
 for(let i=0;i<n;i++){
   const big=r()<.3,x=x0+(x1-x0)*(i+.15+.7*r())/n,L=len*(big?.85+.4*r():.25+.45*r())*k,w=(big?6:3.5)+3*r(),per=900+700*r();
   if(L<2)continue;
   const g=c.createLinearGradient(x,y,x,y+L);
   g.addColorStop(0,'rgba(236,248,255,.96)');g.addColorStop(.6,'rgba(188,226,252,.82)');g.addColorStop(1,'rgba(160,210,248,.4)');
   c.fillStyle=g;c.beginPath();c.moveTo(x-w,y);c.quadraticCurveTo(x-w*.35,y+L*.55,x,y+L);c.quadraticCurveTo(x+w*.35,y+L*.55,x+w,y);c.closePath();c.fill();
   c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=1;c.beginPath();c.moveTo(x-w*.4,y+2);c.lineTo(x-w*.12,y+L*.6);c.stroke();
   // Melting: drops fall from the tips once the room starts warming.
   if(thaw>.01){const t=((now+i*337)%per)/per;if(t<.55){c.fillStyle=`rgba(205,234,255,${(.85*thaw).toFixed(3)})`;c.beginPath();c.arc(x,y+L+2+t*t*130,1.9,0,7);c.fill();}}
 }
 snowCrust(c,x0,x1,y,k,seed);
 c.restore();
}
function snowPile(c,x,y,w,h,k,seed){
 if(k<.02)return;
 const r=rng(seed),H=h*k,n=7;c.save();
 const g=c.createLinearGradient(0,y-H,0,y);
 g.addColorStop(0,'rgba(236,244,255,.95)');g.addColorStop(.5,'rgba(200,220,246,.93)');g.addColorStop(1,'rgba(138,170,214,.9)');
 c.fillStyle=g;c.beginPath();c.moveTo(x,y);
 let px=x,py=y;
 for(let i=0;i<n;i++){
   const nx=x+w*(i+1)/n,ny=i===n-1?y:y-H*Math.sin(Math.PI*(i+1)/n)*(.72+.28*r());
   c.quadraticCurveTo((px+nx)/2,Math.min(py,ny)-H*(.1+.14*r()),nx,ny);px=nx;py=ny;
 }
 c.closePath();c.fill();
 // Sparkles on the crest.
 c.fillStyle=`rgba(255,255,255,${(.9*k).toFixed(3)})`;
 for(let i=0;i<Math.round(w/40);i++){const sx=x+w*(.15+.7*r()),sy=y-H*Math.sin(Math.PI*(sx-x)/w)*.8;c.fillRect(sx,sy,1.6,1.6);}
 c.restore();
}
function windowFrost(c,k){
 if(k<.02)return;
 const [bx,by,bw,bh]=geo.windowBox;
 c.save();polygon(c,geo.windowClip);c.clip();
 for(const [x,y,rad] of [[bx,by,95],[bx+bw,by,80],[bx,by+bh,110],[bx+bw,by+bh,120],[bx+bw/2,by+bh,70]]){
   const g=c.createRadialGradient(x,y,4,x,y,rad);
   g.addColorStop(0,`rgba(236,246,255,${(.75*k).toFixed(3)})`);g.addColorStop(.55,`rgba(214,234,252,${(.35*k).toFixed(3)})`);g.addColorStop(1,'rgba(214,234,252,0)');
   c.fillStyle=g;c.fillRect(bx,by,bw,bh);
 }
 c.restore();
}
/** Attic cold dressing: snow on the stove top, trunk lid and the beam under the skylight, icicles on
 *  that beam and at the broken pipe joint, drifts on the floor and snow sifting in through the skylight. */
function drawColdDressingAttic(c,k,thaw,now,reduced,windowP,roofP){
 const kw=k*(1-.45*windowP),kp=k*(1-.5*roofP),drip=reduced?0:thaw;
 windowFrost(c,k);
 snowPile(c,70,268,134,11,kp,5);
 snowPile(c,264,324,158,12,k,7);
 snowPile(c,676,296,214,15,kw,23);
 icicleRow(c,680,886,296,54,10,kw,29,now,drip);
 icicleRow(c,106,170,118,30,4,kp,31,now,drip);
 icicleRow(c,266,420,330,22,6,k,37,now,drip);
 // Frozen melt-water in front of the trunk.
 const pk=k*(1-.5*windowP);
 if(pk>.02){c.save();const pg=c.createRadialGradient(400,522,4,400,522,72);pg.addColorStop(0,`rgba(205,232,255,${(.55*pk).toFixed(3)})`);pg.addColorStop(1,'rgba(180,215,250,0)');
   c.fillStyle=pg;c.beginPath();c.ellipse(400,522,76,14,0,0,7);c.fill();
   c.strokeStyle=`rgba(255,255,255,${(.6*pk).toFixed(3)})`;c.lineWidth=1.5;c.beginPath();c.moveTo(366,519);c.lineTo(398,516);c.moveTo(410,525);c.lineTo(434,522);c.stroke();c.restore();}
 snowPile(c,0,462,330,12,k,9);
 snowPile(c,-40,602,300,46,k,17);
 snowPile(c,700,602,240,58,kw,13);
 if(!reduced){
   c.save();c.fillStyle='rgba(236,246,255,1)';
   for(let i=0;i<26;i++){const t=(now*.03+i*53)%440,x=650+(i*41)%180+Math.sin(now*.0008+i)*18-t*.22,y=150+t;
     c.globalAlpha=k*(1-windowP)*(.45+(i%3)*.15)*(1-t/480);c.beginPath();c.arc(x,y,1.3+(i%3)*.6,0,7);c.fill();}
   c.restore();
 }
}
function drawColdDressing(c,k,thaw,now,reduced,windowP,roofP){
 if(k<.02)return;
 if(geo.id==='attic')return drawColdDressingAttic(c,k,thaw,now,reduced,windowP,roofP);
 const kw=k*(1-.45*windowP),drip=reduced?0:thaw;
 windowFrost(c,k);
 // Snow caps on ledges.
 snowPile(c,-4,193,322,13,k,5);
 snowPile(c,646,298,236,15,kw,7);
 snowPile(c,0,453,328,10,k,9);
 // Icicles under the mantel, the window sill and the broken roof edge.
 icicleRow(c,6,310,247,62,13,k,11,now,drip);
 icicleRow(c,648,880,321,56,10,kw,23,now,drip);
 // Frozen puddle where the roof leaks onto the floor.
 const pk=k*(1-.5*roofP);
 if(pk>.02){c.save();const pg=c.createRadialGradient(392,500,4,392,500,70);pg.addColorStop(0,`rgba(205,232,255,${(.55*pk).toFixed(3)})`);pg.addColorStop(1,'rgba(180,215,250,0)');
   c.fillStyle=pg;c.beginPath();c.ellipse(392,500,72,15,0,0,7);c.fill();
   c.strokeStyle=`rgba(255,255,255,${(.6*pk).toFixed(3)})`;c.lineWidth=1.5;c.beginPath();c.moveTo(360,497);c.lineTo(392,494);c.moveTo(402,503);c.lineTo(426,500);c.stroke();c.restore();}
 // Drifts piled against the walls and in the corners.
 snowPile(c,318,447,135,24,k,19);
 snowPile(c,-40,602,290,44,k,17);
 snowPile(c,690,602,250,56,kw,13);
 // Loose snow sifting down through the roof hole.
 if(!reduced){
   c.save();c.fillStyle='rgba(236,246,255,1)';
   for(let i=0;i<22;i++){const t=(now*.03+i*53)%560,x=450+(i*41)%170+Math.sin(now*.0008+i)*18-t*.14,y=50+t;
     c.globalAlpha=k*(1-roofP)*(.45+(i%3)*.15)*(1-t/600);c.beginPath();c.arc(x,y,1.3+(i%3)*.6,0,7);c.fill();}
   c.restore();
 }
}
// Mouths on the seated cutout (646x840 art mapped to 421,92 328x421): mother, daughter.
// Each exhales on its own rhythm; the vapour drifts up and away from the faces.
// Vapour leaves the mouth sideways and low (never across the eyes), then lifts as it thins.
const BREATH=[{x:568,y:193,period:2100,offset:0,dx:30,dy:6,size:1},{x:623,y:258,period:1750,offset:820,dx:32,dy:8,size:.85}];
function drawBreath(c,now,amount,pose){
 if(amount<.01)return;
 const head=pose?.motionMethod==='continuous-inverse-mesh'?pose.joints:null;
 c.save();
 BREATH.forEach((b,idx)=>{
   const age=(now+b.offset)%b.period,life=1500;if(age>life)return;
   const u=age/life,e=easeOut(u),j=head?(idx?head.daughterHead:head.motherHead):[0,0];
   // Mesh fallback reports head displacement in scene units; the video keeps heads near the art.
   const bx=b.x+j[0],by=b.y+j[1];
   // Sized for a 342 px wide phone scene (~0.38 css px per scene px): the cloud grows to ~20 css px.
   for(let k=0;k<4;k++){
     const kk=k/4,x=bx+b.dx*1.4*(e*(.45+kk*.85))+Math.sin(u*5+k)*3,y=by+b.dy*(e*(.5+kk*.8))-20*u*u*(.6+kk);
     const r=(8+32*e)*b.size*(1-kk*.2),a=amount*(u<.15?u/.15:1-(u-.15)/.85)*(.55-kk*.1);
     if(a<=0)continue;
     const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(240,248,255,${a.toFixed(3)})`);g.addColorStop(1,'rgba(240,248,255,0)');
     c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
   }
 });
 c.restore();
}
function cameraFor(m,now,reduced){
 let k=0,f=[450,300];
 if(!reduced)for(const r of m.reveals){
   if(!r.complete)continue;
   const a=now-r.at,kk=easeInOut(clamp((a-650)/450))*(1-easeInOut(clamp((a-2050)/700)));
   if(kk>k){k=kk;f=r.focus;}
 }
 // Act title card: a slower push onto the mother and daughter.
 if(!reduced&&m.actFx){
    const a=now-m.actFx.at,kk=easeInOut(clamp(a/600))*(1-easeInOut(clamp((a-ACT_MS+700)/700)));
    if(a>=0&&kk>k){k=kk;f=m.actFocus||[585,250];}
  }
 const z=1+.14*k,hw=450/z,hh=300/z;
 const x=Math.max(hw,Math.min(900-hw,lerp(450,f[0],.6*k))),y=Math.max(hh,Math.min(600-hh,lerp(300,f[1],.6*k)));
 return {x,y,zoom:z,push:k};
}
/** Act title card in screen space (above the camera): letterbox bars, a light sweep, act name. */
function drawActFx(c,fx,now,reduced){
 const a=now-fx.at;if(a<0||a>ACT_MS)return;
 const u=a/ACT_MS,env=reduced?1:smooth(a/380)*(1-smooth((a-ACT_MS+520)/520));
 const zh=(document.documentElement.lang||'zh').toLowerCase().startsWith('zh');
 const name=(ACT_NAMES[geo.id]||ACT_NAMES.cottage)[fx.act];
 const bar=78*env;
 c.save();
 if(!reduced){
   // Light sweep: cold moonlight for act I, firelight for the warm acts.
   const sx=-260+1420*easeInOut(clamp((a-250)/1700)),col=fx.act?'255,190,110':'200,225,255';
   const g=c.createLinearGradient(sx-160,0,sx+160,0);
   g.addColorStop(0,`rgba(${col},0)`);g.addColorStop(.5,`rgba(${col},${(.34*env).toFixed(3)})`);g.addColorStop(1,`rgba(${col},0)`);
   c.globalCompositeOperation='lighter';c.fillStyle=g;c.fillRect(0,0,900,600);c.globalCompositeOperation='source-over';
 }
 c.fillStyle='rgba(12,14,24,.9)';c.fillRect(0,0,900,bar);c.fillRect(0,600-bar,900,bar);
 const ta=reduced?1:smooth((a-260)/360)*(1-smooth((a-ACT_MS+620)/420));
 if(ta>.01){
   c.globalAlpha=ta;c.textAlign='center';c.textBaseline='middle';
   const font='"Microsoft YaHei","PingFang SC",system-ui,sans-serif';
   c.font=`700 30px ${font}`;c.fillStyle=fx.act?'#ffd9a0':'#cfe4ff';
   const kick=zh?name[0]:name[2];c.fillText(zh?kick.split('').join(' '):kick.toUpperCase(),450,bar/2+2);
   c.font=`800 46px ${font}`;c.fillStyle='#fff6e8';
   c.fillText(zh?name[1]:name[3],450,600-bar/2+(reduced?0:6*(1-smooth((a-260)/420))));
 }
 c.restore();
}
function delivery(c,event,now,reduced){
 if(reduced)return;
 const age=now-event.at,u=clamp(age/650),land=clamp((age-650)/500);
 const target=event.target,tx=target[0],ty=target[1];
 // The token itself flies on the page layer (app.js juice.fly); the scene only draws the landing ring.
 if(age>=650&&land<1){
   c.save();c.strokeStyle=`rgba(255,218,147,${.65*(1-land)})`;c.lineWidth=2;
   c.beginPath();c.ellipse(tx,ty,14+32*land,5+12*land,0,0,Math.PI*2);c.stroke();c.restore();
 }
}
export function renderScene(canvas,s={}){
 if(!art.room?.naturalWidth)return;
 const box=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
 if(!box.width||!box.height)return;
 const bw=Math.round(box.width*dpr),bh=Math.round(box.height*dpr);
 if(canvas.width!==bw||canvas.height!==bh){canvas.width=bw;canvas.height=bh;}
 const c=canvas.getContext('2d');
 c.setTransform(1,0,0,1,0,0);c.fillStyle='#24354F';c.fillRect(0,0,bw,bh);
 let m=memory.get(canvas);
 const now=Number.isFinite(s.time)?s.time:performance.now();
 const key=s.index??s.task??0,home=Math.floor(Number(s.index||0)/5),look=HOME_LOOKS[Math.max(0,Math.min(3,home))];
  roomHome=Math.max(0,Math.min(3,home));
  const actMode=hasActArt(roomHome);
  // Painted acts are fitted (whole house visible) over a blurred fill; the legacy room still covers the frame.
   // Chapter 1 focus framing (picked in frame-preview.html, 2026-10-19): the pair's line (focusY, 900×600 art space) sits
   // in the middle of the band above the task strip, so the empty floor runs on under the strip. The painting's top edge
   // Same scale as the plain fit (no zoom); the painting slides down and the gap above it gets a blurred
   // extension of the painting's own top edge. It never rises above the plain fit and its lower edge stays under the strip.
   // window.__SCENE_FRAME__ overrides it for the preview page ({focusY}, or false for the old framing).
   const frame=actMode&&roomHome===0?(window.__SCENE_FRAME__===undefined?ATTIC_FRAME:window.__SCENE_FRAME__):null;
   const th=actMode?canvas.closest('.story')?.querySelector('.task-heading')?.getBoundingClientRect():null;
   const strip=th&&th.height&&th.top<box.bottom&&th.bottom>box.top?Math.max(0,box.bottom-th.top+6)*dpr:0;
   let scale=actMode?Math.min(bw/900,bh/600):Math.max(bw/900,bh/600);
   // Fitted acts sit on the task strip (spare height goes up under the HUD pills), never under it when there is room.
   let oy=(bh-600*scale)/2;
   if(actMode&&oy>0)oy=Math.max(0,bh-600*scale-strip);
   let ox=(bw-900*scale)/2;
   if(frame){
     const vh=Math.max(1,bh-strip),fy=Math.max(60,frame.focusY??300);
     oy=Math.max(oy,vh/2-fy*scale);
   }
  c.setTransform(scale,0,0,scale,ox,oy);
  geo=actMode?actGeo(roomHome):roomHome===0&&art[HOME_ROOMS[0][0]]?.naturalWidth?ATTIC_GEO:BASE_GEO;
 const done=Array.isArray(s.completedTasks)?s.completedTasks:[];
 const task=Math.max(0,Math.min(4,Number(s.task)||0)),p=clamp(s.progress);
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const initial=Array.from({length:5},(_,i)=>done.includes(i)?1:task===i?p:0);
 if(!m||m.home!==home){
   m={key,home,last:now,p,stages:[...initial],installed:[...initial],seen:[...initial],events:[],
     happy:initial[2]>0?.82:initial[0]+initial[1]>0?.24:0,warm:0,reaction:null,reactionIds:new Set(),
     reveals:[],grade:null,chapterAt:null,allDoneSeen:initial.every(v=>v>.995),revealCount:0};
   memory.set(canvas,m);
   resetActVideo();
 }
 const dt=Math.min(60,Math.max(0,now-m.last));m.last=now;m.key=key;
 const reaction=s.reaction;
 if(reaction&&reaction.id!=null&&!m.reactionIds.has(reaction.id)){
   m.reactionIds.add(reaction.id);
   if(m.reactionIds.size>128)m.reactionIds.delete(m.reactionIds.values().next().value);
   m.reaction={id:reaction.id,kind:reaction.kind,at:Number.isFinite(reaction.at)?reaction.at:now};
 }
 // Credits are a high-water mark. Removal, redraw and replay cannot award them twice.
 for(let i=0;i<5;i++){
   const requested=done.includes(i)?1:i===task?p:m.seen[i];
   if(requested>m.seen[i]+.00001){
     const event={task:i,at:now,from:m.seen[i],to:requested,target:installationTarget(i,requested)};
     m.events.push(event);m.seen[i]=requested;
     // Every credited step gets a staged reveal; a completed repair gets the full camera push.
     m.reveals.push(makeReveal(i,event.from,requested,now,reduced));m.revealCount++;
     if(!reaction)m.reaction={id:`progress-${key}-${requested}`,kind:'success',at:now};
   }
 }
 m.events=m.events.filter(event=>now-event.at<1600);
 // Act changes (2 and 4 finished repairs) queue a title card once the reveal camera has eased back;
 // the reveal is held open meanwhile so the result card waits for the act title.
 const doneCount=m.seen.filter(v=>v>.995).length,act=doneCount>=4?2:doneCount>=2?1:0;
 // Background stage = finished repairs; it swaps once the falling supply has settled (~1.4 s).
 if(m.stage===undefined)m.stage=doneCount;else if(doneCount!==m.stage){m.stage=doneCount;m.stageAt=now+1400;}
 // Act title cards (letterbox bars + act name) are switched off: the paintings simply crossfade.
 if(m.act===undefined)m.act=act;else if(act>m.act)m.act=act;
  // Painted acts crossfade to the next painting under the act title card's letterbox.
  let bgK=1,shownAct=m.stage,actHeads=null;
  // A stage shows its opening painting while its own repair is the level being played.
  const openHeads=stage=>actMode&&stage===task?ACT_OPEN[ACT_KEYS[roomHome]]?.[stage]:null;
  const isOpen=stage=>!!openHeads(stage)&&!!art[actOpenName(roomHome,stage)]?.naturalWidth;
  const stageArt=stage=>isOpen(stage)?actOpenName(roomHome,stage):actArtName(roomHome,stage);
  if(actMode){
    if(m.bgAct===undefined)m.bgAct=m.stage;
    if(m.bgAct!==m.stage){m.bgFrom=m.bgAct;m.bgAct=m.stage;m.bgAt=reduced?now:(m.stageAt??now);}
    if(m.bgFrom!==undefined){bgK=reduced?1:clamp((now-m.bgAt)/900);if(bgK>=1)m.bgFrom=undefined;}
    shownAct=m.bgFrom!==undefined&&bgK<.5?m.bgFrom:m.bgAct;
    const H0=ACT_ART[ACT_KEYS[roomHome]].heads,H=new Proxy(H0,{get:(t,k)=>{const n=Number(k);return Number.isInteger(n)&&isOpen(n)?openHeads(n):t[k];}});
    actHeads=m.bgFrom!==undefined?[H[shownAct],H[shownAct===m.bgAct?m.bgFrom:m.bgAct]]:[H[shownAct]];
    const [mh,dh]=H[m.bgAct];m.actFocus=[(mh[0]+mh[2]/2+dh[0]+dh[2]/2)/2,(mh[1]+dh[1]+dh[3])/2+20];
  }else m.actFocus=null;
  // Chapter 1 (attic) paintings move: stage 0 loops the blizzard idle, each later stage plays its
  // chosen celebration once as the new painting fades in, then holds that clip's last frame.
  const actVid=actMode&&roomHome===0&&actVideoEnabled();
  if(actVid){
    preloadActVideo(m.bgAct);
    const due=m.bgFrom===undefined||now>=(m.bgAt??now);
    if(due&&m.vidStage!==m.bgAct){
      if(m.vidStage!==undefined)pauseActVideo(0);
      if(m.bgAct>0&&m.vidStage!==undefined)startActVideo(m.bgAct);
      m.vidStage=m.bgAct;
    }
  }
  const actLayer=(stage,alpha=1)=>{
    const v=actVid&&!isOpen(stage)?actVideoFrame(stage):null;
    if(!v)return image(c,stageArt(stage),0,0,900,600,alpha);
    c.save();c.globalAlpha*=alpha;c.drawImage(v,0,0,900,600);c.restore();
  };
  m.reveals=m.reveals.filter(r=>now<r.end);
 for(let i=0;i<5;i++){
   let installed=m.seen[i];
   // The base layer keeps the old state until the falling piece has settled onto it.
   for(const r of m.reveals)if(r.task===i&&now<r.settleAt)installed=Math.min(installed,r.from);
   m.installed[i]=Math.max(m.installed[i],installed);
   m.stages[i]=m.installed[i];
 }
 const stages=m.stages,[windowP,roofP,fireP,bedP,soupP]=stages;
 m.p=stages[task];
 // Stepped warmth: each finished repair adds its share (a partial step adds a little).
 const gradeTarget=stages.reduce((sum,v,i)=>sum+WARM_WEIGHTS[i]*(v>.995?1:v*.6),0);
 if(m.grade===null)m.grade=gradeTarget;
 m.grade+=(gradeTarget-m.grade)*(reduced?1:Math.min(1,dt/450));
 const cam=cameraFor(m,now,reduced);
 if(actMode){c.save();c.setTransform(1,0,0,1,0,0);actBackdrop(c,stageArt(m.bgAct),bw,bh,scale,ox,oy);c.restore();}
 // World layer: clipped to the room and seen through the reveal camera.
 c.save();c.beginPath();c.rect(0,0,900,600);c.clip();
  c.translate(450,300);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-cam.y);
  c.clearRect(0,0,900,600);
  if(actMode){
    if(m.bgFrom!==undefined)actLayer(m.bgFrom);
    actLayer(m.bgAct,m.bgFrom!==undefined?bgK:1);
    // A breathing firelight accent once the fire is lit; the painting carries the rest.
    if(fireP>0){const [gx,gy]=geo.fire,fl=reduced?1:1+.08*Math.sin(now*.006)+.05*Math.sin(now*.017),g=c.createRadialGradient(gx,gy,0,gx,gy,260);
      g.addColorStop(0,`rgba(255,170,80,${(.16*fireP*fl).toFixed(3)})`);g.addColorStop(1,'rgba(255,160,70,0)');
      c.save();c.globalCompositeOperation='lighter';c.fillStyle=g;c.fillRect(0,0,900,600);c.restore();}
    // The current repair target glows along its outline while it still needs fixing.
    const want=(s.phase==='playing'||s.phase==='tutorial')&&m.seen[task]<.995?task:-1;
    if(!m.glows)m.glows=[];
    const live=m.glows.find(g=>g.out===undefined);
    if(live&&live.task!==want){live.out=now;live.done=m.seen[live.task]>.995;}
    // The next target waits until the finished one has flared and faded.
    const flared=m.glows.filter(g=>g.done).at(-1);
    if(want>=0&&!m.glows.some(g=>g.out===undefined))m.glows.push({task:want,at:reduced||!flared?now:Math.max(now,flared.out+1600)});
    m.glows=m.glows.filter(g=>g.out===undefined||now-g.out<1400);
    const outlines=ACT_OUTLINES[ACT_KEYS[roomHome]];
    for(const g of m.glows)drawRepairGlow(c,outlines[g.task],g,now,reduced,scale*cam.zoom);
  }else{
  image(c,roomArt(false),0,0,900,600);
  drawSky(c,look,now,reduced);
 // Reveal perspective-matched replacement sections, not enlarged inventory icons.
 drawRepair(c,0,windowP,now,reduced);
 drawRepair(c,1,roofP,now,reduced);
 // A brief fitted seam highlight makes the ceiling repair legible at phone scale.
 const roofLanding=m.events.filter(e=>e.task===1&&now-e.at>=650&&now-e.at<1150).at(-1);
 if(roofLanding&&!reduced&&geo.id!=='attic'){
   const glow=1-clamp((now-roofLanding.at-650)/500);
   c.save();c.beginPath();c.rect(431,0,179*roofP,73);c.clip();
   polygon(c,roofShape);c.strokeStyle=`rgba(255,214,143,${glow*.85})`;
   c.lineWidth=3;c.stroke();c.restore();
 }
 drawRepair(c,2,fireP,now,reduced);
 // Dry bedding covers mattress before the foreground characters.
  drawRepair(c,3,bedP,now,reduced);
  }
  // Newly installed pieces drop in, squash and bounce on top of the not-yet-updated base.
 for(const r of m.reveals)if(r.task!==4)drawPiece(c,r,now);
 for(const r of m.reveals)drawRevealFx(c,r,now,'back');
 // Cold dressing: deep blue grade + snow and ice that melt away step by step as the room warms.
  const coldK=clamp(1-m.grade*1.1)*(1-m.warm)*(s.phase==='won'?0:1);
  if(!actMode){
    coldGrade(c,coldK*(look==='snow'||look==='storm'?1:.8));
    drawColdDressing(c,coldK,clamp(m.grade*4),now,reduced,windowP,roofP);
  }
  const allDone=stages.every(v=>v>.995);
  m.warm+=((allDone?1:0)-m.warm)*Math.min(1,dt/600);
  if(m.warm>.001&&!actMode)image(c,roomArt(true),0,0,900,600,m.warm);
  if(allDone&&!m.allDoneSeen){m.allDoneSeen=true;m.chapterAt=now;}
  gradeRoom(c,m.grade*(1-m.warm*.6)*(actMode?.3:1),now,reduced);
 tintRoom(c,look,(1-m.warm*.7)*(1-m.grade*.45),now,reduced);
 const frost=clamp(1-m.grade*1.8)*(1-m.warm)*(s.phase==='tutorial'?.6:.85)*(look==='dawn'?.55:look==='dusk'?.8:1);
  if(frost>.01&&!actMode){
   const im=vfx['vfx-frost'];
   if(im?.naturalWidth){
     // Corners frost over; the lower corners thaw first as the fire comes up.
     const w=260,h=w*im.naturalHeight/im.naturalWidth,low=frost*.55*(1-fireP);
     c.save();c.globalAlpha=frost;c.drawImage(im,0,0,w,h);c.translate(900,0);c.scale(-1,1);c.drawImage(im,0,0,w,h);c.restore();
     if(low>.01){c.save();c.globalAlpha=low;c.translate(0,600);c.scale(1,-1);c.drawImage(im,0,0,w*.7,h*.7);c.translate(900,0);c.scale(-1,1);c.drawImage(im,0,0,w*.7,h*.7);c.restore();}
   }
 }
 const snow= (1-windowP)*(s.phase==='tutorial'?.45:.5+.5*(1-clamp((s.remainingMs??180000)/(s.durationMs||180000))));
  if(m.chapterAt!==null&&!reduced)drawChapterFx(c,m.chapterAt,now,'back');
  if(actMode&&!reduced&&shownAct===0&&!(actVid&&actVideoFrame(0))){
    // Act I: loose snow drifting through the cold room.
    c.save();c.fillStyle='rgba(232,243,255,1)';
    for(let i=0;i<28;i++){const sp=.018+(i%4)*.006,t=(now*sp+i*83)%660,x=(i*137+Math.sin(now*.0007+i)*24)%900;
      c.globalAlpha=(.25+(i%3)*.15)*(1-t/660)*(m.bgFrom!==undefined?1-bgK:1);c.beginPath();c.arc(x,t-30,1.4+(i%3)*.7,0,7);c.fill();}
    c.restore();
  }
  if(!actMode&&!reduced&&snow>.01){
   const [wx,wy,ww,wh]=geo.windowBox;
   c.save();polygon(c,geo.windowClip);c.clip();
   if(look==='storm'){
     // Slanted rain, fast and dense.
     c.strokeStyle='rgba(200,222,235,.75)';c.lineWidth=1.6;
     for(let i=0;i<34;i++){const t=(now*.42+i*61)%260,x=870-(i*29)%230-t*.45,y=80+t;c.globalAlpha=snow*(.35+(i%3)*.18);c.beginPath();c.moveTo(x,y);c.lineTo(x-9,y+22);c.stroke();}
   }else{
     const n=look==='snow'?26:look==='dusk'?12:9,sp=look==='snow'?.025:.012;
     c.fillStyle=look==='dusk'?'rgba(255,230,215,.85)':look==='dawn'?'rgba(255,240,235,.8)':'rgba(224,241,255,.85)';
     for(let i=0;i<n;i++){const t=(now*sp+i*37)%wh;c.globalAlpha=snow*(.4+(i%3)*.15);c.beginPath();c.arc(wx+ww-16-(t*.75+i*13)%(ww-24)+(look==='snow'?0:Math.sin(now*.001+i)*6),wy+5+t,1.5+i%2,0,7);c.fill();}
   }
   c.restore();
   const gusts=look==='storm'?7:look==='snow'?4:2,speed=look==='storm'?.075:.04;
   c.save();c.translate(wx-657,wy-93);c.strokeStyle=look==='storm'?`rgba(190,210,220,${snow*.42})`:`rgba(200,226,243,${snow*.34})`;c.lineWidth=2;
   for(let i=0;i<gusts;i++){const t=(now*speed+i*54)%240;c.beginPath();c.moveTo(786-t,240+i*15);c.quadraticCurveTo(670-t,213+i*19,582-t,259+i*17);c.stroke();}c.restore();
 }
  if(actMode){}
  else if(roofP<1&&!reduced&&geo.id==='attic'){
   // Snow dribbling out of the broken pipe joint.
   c.fillStyle='rgba(230,242,255,1)';
   for(let i=0;i<5;i++){const covered=clamp(roofP*4-i*.8);if(covered>.995)continue;
     const t=(now*.06+i*61)%150;c.globalAlpha=.7*(1-covered)*(1-t/150);c.beginPath();c.arc(124+i*9+Math.sin(now*.002+i)*3,112+t,1.6,0,7);c.fill();}
   c.globalAlpha=1;
 }else if(roofP<1&&!reduced){
   c.lineWidth=2;
   for(let i=0;i<4;i++){
     const covered=clamp(roofP*4-i);if(covered>.995)continue;
     const x=449+i*37,y=58+(now*.13+i*107)%465;
     c.strokeStyle=`rgba(154,207,241,${.6*(1-covered)})`;
     c.beginPath();c.moveTo(x,y);c.lineTo(x,y+8);c.stroke();
   }
 }
 // Foreground pair is a single cutout: embracing hands cannot drift apart.
 const safe=fireP>.05;
 const reactionAge=m.reaction?Math.max(0,now-m.reaction.at):Infinity;
 const activeKind=reactionAge<(REACTION_MS[m.reaction?.kind]||1800)?m.reaction?.kind:null;
 const comfort=Math.max(fireP>0?.72+fireP*.2:0,windowP*.16+roofP*.16,bedP*.88,soupP*.98);
 let happyTarget=comfort,mood=safe?'安心':comfort>.1?'渐渐放松':'担心';
 if(activeKind==='success'||activeKind==='win'||activeKind==='combo'){
   happyTarget=Math.max(comfort,activeKind==='win'?1:.78);mood=activeKind==='win'?'喜悦':activeKind==='combo'?'雀跃':'受到安慰';
 }else if(activeKind==='error'){happyTarget=comfort*.25;mood='短暂担心';}
 else if(activeKind==='remove'){happyTarget=comfort*.7;mood='留意操作';}
 else if(activeKind==='hurry'){happyTarget=comfort*.3;mood='着急';}
 // After a win the pair stays joyful until the result dialog takes over; no relapse into the cold idle.
 if(s.phase==='won'&&activeKind!=='win'){happyTarget=1;mood='喜悦';}
 if(s.phase==='failed'||activeKind==='fail'){happyTarget=0;mood='悲伤';}
 m.happy+=(happyTarget-m.happy)*(reduced?1:Math.min(1,dt/240));
 // Immediate, unambiguous expressions; motion provides the transition without double exposure.
 const happyFace=happyTarget>=.45&&activeKind!=='error'&&activeKind!=='fail'&&activeKind!=='hurry'&&s.phase!=='failed';
  const urgent=s.phase==='playing'&&Number.isFinite(s.remainingMs)&&s.remainingMs<=30000;
  // Painted acts already show the pair; the animated cutout is only for the legacy rooms.
  const pose=actMode?{asset:stageArt(shownAct),painted:actHeads,video:null,joints:{},motionMethod:'painted-act'}:family(c,happyFace,now,reduced,safe||s.phase==='won',s.phase==='failed'?'fail':activeKind,reactionAge,bedP,
    {kind:s.phase==='failed'?'fail':activeKind==='remove'?null:activeKind,reactionId:m.reaction?.id??null,phase:s.phase,
      safe:safe||s.phase==='won'||happyFace,urgent});
  // Cold breath: puffs of white vapour from both mouths, gone once the room is warm.
  const breath=reduced||actMode?0:clamp(1-m.grade*1.6)*(1-m.warm)*(s.phase==='won'?0:1);
  if(!actMode){drawBreath(c,now,breath,pose);drawSoup(c,soupP,now,reduced);}
  for(const r of m.reveals)if(r.task===4)drawPiece(c,r,now);
  for(const r of m.reveals)drawRevealFx(c,r,now,'front');
  if(m.chapterAt!==null&&!reduced)drawChapterFx(c,m.chapterAt,now,'front');
  if(!actMode&&!safe&&!reduced&&windowP<1){
   c.save();c.strokeStyle=`rgba(235,246,255,${.15*(1-windowP)})`;c.lineWidth=4;
   c.beginPath();c.arc(591,264,12+4*Math.sin(now*.001),-.8,.8);c.stroke();c.restore();
 }
 // Warm flash + hearts on positive beats make each reaction legible at phone scale.
  // Emblems and hearts sit above the painted heads (legacy rooms keep their fixed spots).
  const [mHead,dHead]=actMode?actHeads[0]:[[560,104,60,0],[520,150,0,0]];
  if(!reduced&&(activeKind==='success'||activeKind==='combo'||activeKind==='win')){
   // The reveal now carries the light; this flash only tints the moment so faces never wash out.
   const u=reactionAge/(REACTION_MS[activeKind]||1800),flash=Math.max(0,1-u*2.2)*(activeKind==='win'?.26:.16);
   if(flash>0){const g=c.createRadialGradient(560,250,40,560,250,520);g.addColorStop(0,'rgba(255,224,160,'+flash.toFixed(3)+')');g.addColorStop(1,'rgba(255,200,120,0)');c.fillStyle=g;c.fillRect(0,0,900,600);}
   if(activeKind!=='success'){
     c.save();c.fillStyle='#F4A6B8';
      const hx0=actMode?dHead[0]-20:520,hy0=actMode?dHead[1]:150;
      for(let i=0;i<(activeKind==='win'?7:4);i++){const life=(reactionAge/1000+i*.37)%1.3,y=hy0-life*110,x=hx0+i*28+Math.sin(life*6+i)*12,sz=7+i%3*2;
       c.globalAlpha=Math.max(0,1-life/1.3)*.9;c.beginPath();c.moveTo(x,y+sz*.6);c.bezierCurveTo(x-sz*1.3,y-sz*.4,x-sz*.4,y-sz*1.2,x,y-sz*.4);c.bezierCurveTo(x+sz*.4,y-sz*1.2,x+sz*1.3,y-sz*.4,x,y+sz*.6);c.fill();}
     c.restore();
   }
 }
 // Error and hurry get an unmistakable emblem above the mother's head, readable at phone scale.
 if(!reduced&&(activeKind==='error'||activeKind==='hurry')){
   const u=reactionAge/(REACTION_MS[activeKind]||1000),pop=Math.min(1,u*6),fade=Math.max(0,1-Math.max(0,u-.6)/.4);
   // Springs in over the first sixth of the reaction and then hovers, roughly 1.7× the base glyph size.
   const scale=(1.1+.9*pop+.35*Math.sin(Math.PI*pop))*(1+.06*Math.sin(now/70));
    const bx=actMode?mHead[0]+mHead[2]/2:activeKind==='hurry'?500:590,by=actMode?Math.max(40,mHead[1]-30):104;
    const hx=bx,hy=by+(activeKind==='hurry'?-8*Math.abs(Math.sin(now/90)):-18*(1-pop));
   c.save();c.globalAlpha=fade;c.translate(hx,hy);c.scale(scale,scale);
   if(activeKind==='error'){
     // Cold-blue sweat drop plus a small "?" — "not there".
     c.fillStyle='#8fbfe8';c.beginPath();c.moveTo(0,-26);c.bezierCurveTo(14,-6,14,10,0,12);c.bezierCurveTo(-14,10,-14,-6,0,-26);c.fill();
     c.fillStyle='#fff8e6';c.beginPath();c.arc(-4,2,3.5,0,7);c.fill();
     c.font='800 30px "Microsoft YaHei",system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineWidth=5;c.strokeStyle='#fff8e6';c.strokeText('?',30,-8);c.fillStyle='#3d5a80';c.fillText('?',30,-8);
   }else{
     // Amber exclamation with a red sweat drop — "hurry".
     c.font='900 44px "Microsoft YaHei",system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineWidth=6;c.strokeStyle='#fff3c4';c.strokeText('!',0,-6);c.fillStyle='#e46a4c';c.fillText('!',0,-6);
     c.fillStyle='#e46a4c';c.beginPath();c.moveTo(30,-20);c.bezierCurveTo(41,-4,41,8,30,10);c.bezierCurveTo(19,8,19,-4,30,-20);c.fill();
   }
   c.restore();
 }
 if(s.phase==='failed'){c.fillStyle='rgba(38,59,94,.25)';c.fillRect(0,0,900,600);}
 for(const event of m.events)delivery(c,event,now,reduced);
 c.restore();
 if(actMode)actFeather(c,stageArt(m.bgAct),bw,bh,scale,ox,oy,dpr,frame?.blur);
 if(m.actFx)drawActFx(c,m.actFx,now,reduced);
 canvas.dataset.windowProgress=windowP.toFixed(3);
 canvas.dataset.sceneReady='true';
 canvas.dataset.mood=mood;
 const live=m.reveals.filter(r=>now<r.end).at(-1);
 // Head boxes for page UI (story bubbles), in CSS px relative to the #scene canvas box.
 const heads=faceBounds(pose,t=>cameraFor(m,t,reduced),now);
 const cssK=scale/dpr,cssOx=ox/dpr,cssOy=oy/dpr;
 const toCss=([x,y,w,h])=>[Math.round(x*cssK+cssOx),Math.round(y*cssK+cssOy),Math.round(w*cssK),Math.round(h*cssK)];
 const faces={space:'canvas',mother:toCss(heads.mother.now),daughter:toCss(heads.daughter.now),
   motherSpan:toCss(heads.mother.span),daughterSpan:toCss(heads.daughter.span),
   room:[Math.round(cssOx),Math.round(cssOy),Math.round(900*cssK),Math.round(600*cssK)],
    hug:s.phase==='won'||['win','combo','success'].includes(pose.video?.state)||activeKind==='win',source:actMode?'painted-act':pose.video?'video-track':'mesh-rest'};
  window.__RESCUE_SCENE__={home,homeLook:look,roomArt:actMode?[stageArt(shownAct)]:[roomArt(false),roomArt(true)],paintedActs:actMode,shownAct,task,progress:m.p,windowProgress:windowP,roofProgress:roofP,fireProgress:fireP,bedProgress:bedP,soupProgress:soupP,phase:s.phase,
   familyLayers:1,ready:true,mood,happyBlend:happyFace?1:0,comfort:m.happy,...pose,reaction:m.reaction?{...m.reaction}:null,
   installedStages:[...m.installed],creditedStages:[...m.seen],activeDeliveries:reduced?0:m.events.filter(e=>now-e.at<1150).length,
   deliveries:m.events.map(e=>({...e,target:[...e.target],ageMs:Math.max(0,now-e.at)})),
   reducedMotion:reduced,footAnchors:[[533,504],[685,499]],seatContacts:[[510,394],[688,400]],
    roofRepairPolygon:geo.roof.map(p=>[...p]),repairTargets:geo.targets.map(p=>[...p]),layout:geo.id,act:m.act,
    actTitle:m.actFx&&now>=m.actFx.at&&now-m.actFx.at<ACT_MS?m.actFx.act:null,
   camera:{x:+cam.x.toFixed(1),y:+cam.y.toFixed(1),zoom:+cam.zoom.toFixed(4),push:+cam.push.toFixed(4)},
   warmth:+m.grade.toFixed(4),warmthTarget:+gradeTarget.toFixed(4),frost:+frost.toFixed(4),breath:+breath.toFixed(4),
   chapterCelebration:m.chapterAt!==null&&now-m.chapterAt<3400,revealCount:m.revealCount,faces,
   reveal:live?{task:live.task,complete:live.complete,ageMs:Math.round(now-live.at),
     phase:now<live.dropAt?'approach':now<live.impactAt?'drop':now<live.settleAt?'bounce':'settle',
     focus:[...live.focus],bbox:[...live.piece.bbox],reduced:live.reduced}:null};
}
