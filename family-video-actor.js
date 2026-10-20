/* Mother & daughter video actor (v9).
 * Eight reference-to-video clips generated from the in-game cutout art, keyed to real alpha:
 *   loops   : idle-cold, idle-warm, hurry
 *   one-shot: success, combo, error, fail, win
 * Each clip ships as VP9 alpha WebM (.webm.bin, fetched as a Blob so the browser decodes by
 * MIME type) plus a stacked colour|matte H.264 MP4 fallback for browsers without alpha VP9.
 * Clip canvas = 360x480; the original 646x840 cutout occupies ART_RECT inside it, so the
 * scene maps ART_RECT onto the puppet rectangle and seat/feet contacts stay identical.
 * Lessons carried over from king-video-actor.js:
 *  - a loop's end->start seek keeps showing the last decoded frame of the SAME clip;
 *  - a one-shot shows its own prepared first frame until decoding catches up;
 *  - never borrow an alternative pose; if nothing of the requested clip is decodable the
 *    caller draws the mesh-deform fallback for that frame.
 */
const ROOT='video/family/';
const CLIP_W=360,CLIP_H=480;
export const ART_RECT=[18.5,40,323,420]; // x,y,w,h of the 646x840 cutout inside the clip (0.5 scale)
const CLIPS={
  'idle-cold':{loop:true,label:'寒冷发抖·搓女儿手臂'},
  'idle-warm':{loop:true,label:'安心呼吸·女儿抬头看妈妈'},
  hurry:{loop:true,label:'焦急回头看门'},
  success:{loop:false,rate:1.35,label:'抬头望向修好的地方并露出笑容'},
  combo:{loop:false,rate:1.2,label:'母女雀跃·女儿拍手'},
  error:{loop:false,rate:1.3,label:'受惊缩肩护住女儿'},
  fail:{loop:false,holdEnd:true,label:'低头抱得更紧'},
  win:{loop:false,holdEnd:true,label:'喜极拥抱·亲吻额头'},
};
// Idle loops start first; reactions stream in right after the scene is visible.
const ORDER=['idle-cold','error','success','combo','hurry','idle-warm','fail','win'];
const LOOP_FRAME_HOLD_MS=250;
const START_HOLD_MS=500;
let support=null;
function alphaWebmSupported(){
  if(support!==null)return support;
  try{
    const v=document.createElement('video');
    const ok=v.canPlayType('video/webm; codecs="vp9"');
    const ua=navigator.userAgent;
    // Safari answers "maybe" for VP9 but drops the alpha plane.
    const safari=/Safari/.test(ua)&&!/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);
    support=!!ok&&!safari;
  }catch{support=false;}
  return support;
}
function resolve(path){
  return globalThis.window?.__ASSETS__?.[path]||globalThis.window?.__ASSET_BUNDLE__?.[path]||path;
}
function available(path){
  // The single-file offline build inlines only web/assets (<100KB rule); clips live beside the
  // multi-file release. A bundle without the clip means "draw the mesh-deform fallback".
  const bundle=globalThis.window?.__ASSETS__;
  return !bundle||!!bundle[path];
}
class Clip{
  constructor(name,spec){
    this.name=name;this.spec=spec;this.alpha=alphaWebmSupported();
    const el=document.createElement('video');
    // Muted AND zero volume: the clips carry no audio and must never count as a sound cue.
    el.muted=true;el.volume=0;el.playsInline=true;el.setAttribute('playsinline','');el.preload='auto';
    el.loop=!!spec.loop;el.crossOrigin='anonymous';
    el.defaultPlaybackRate=el.playbackRate=spec.rate||1;
    el.addEventListener('loadedmetadata',()=>{el.defaultPlaybackRate=el.playbackRate=spec.rate||1;});
    const webm=ROOT+name+'.webm.bin',mp4=ROOT+name+'.stacked.mp4';
    this.failed=false;
    const useMp4=()=>{this.alpha=false;if(!available(mp4)){this.failed=true;return;}el.src=resolve(mp4);el.load();};
    if(this.alpha&&available(webm)){
      const source=resolve(webm);
      if(source.startsWith('data:'))el.src=source.replace(/^data:[^;,]*/,'data:video/webm');
      else fetch(source).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.blob();})
        .then(b=>{el.src=URL.createObjectURL(new Blob([b],{type:'video/webm'}));el.load();})
        .catch(useMp4);
    }else useMp4();
    el.addEventListener('error',()=>{if(this.alpha)useMp4();else this.failed=true;});
    // Keep the decoder element inside the viewport: Chrome may pause muted media scrolled out of view.
    el.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0;z-index:-1';
    document.body.appendChild(el);
    this.el=el;this.ready=false;this.ended=false;
    el.addEventListener('loadeddata',()=>{this.ready=true;});
    el.addEventListener('ended',()=>{this.ended=true;});
    this.scratch=null;this.matte=null;
    this.cachedFrame=null;this.cachedAt=0;this.cachedMediaTime=-1;
    this.decodedSerial=0;this.cachedSerial=-1;this.cacheCopies=0;
    this.loopSeekAt=-Infinity;this.firstFrame=null;this.startRequestedAt=-Infinity;
    const prepareFirstFrame=()=>{
      // Keep the clip's own frame 0 (one-shots never play in advance; loops capture it on load).
      if(this.firstFrame||el.currentTime>.05||!this.playable)return;
      const src=this.decodedFrame();if(!src)return;
      this.firstFrame=document.createElement('canvas');
      this.firstFrame.width=src.width;this.firstFrame.height=src.height;
      const c=this.firstFrame.getContext('2d');c.clearRect(0,0,src.width,src.height);c.drawImage(src,0,0);
    };
    el.addEventListener('loadeddata',prepareFirstFrame);
    el.addEventListener('seeked',prepareFirstFrame);
    el.addEventListener('seeking',()=>{
      // Only this clip's own end->start wrap may reuse its last frame.
      this.loopSeekAt=spec.loop&&this.cachedMediaTime>el.duration-.3&&el.currentTime<.3?performance.now():-Infinity;
    });
    if(el.requestVideoFrameCallback){
      const decoded=()=>{this.decodedSerial++;el.requestVideoFrameCallback(decoded);};
      el.requestVideoFrameCallback(decoded);
    }
  }
  get width(){return this.alpha?this.el.videoWidth:this.el.videoWidth/2;}
  get height(){return this.el.videoHeight;}
  get playable(){return this.ready&&this.el.readyState>=2&&this.el.videoWidth>0;}
  restart(){
    this.ended=false;this.startRequestedAt=performance.now();
    if(this.el.currentTime>.001){this.cachedSerial=-1;try{this.el.currentTime=0;}catch{}}
    this.play();
  }
  play(){if(this.el.paused){const p=this.el.play();if(p&&p.catch)p.catch(()=>{});}}
  pause(){if(!this.el.paused)this.el.pause();}
  frameSource(){
    if(this.alpha)return this.el;
    const w=this.width,h=this.height;
    if(!(w>0&&h>0))return null;
    if(!this.scratch){
      this.scratch=document.createElement('canvas');this.matte=document.createElement('canvas');
      this.scratch.width=this.matte.width=w;this.scratch.height=this.matte.height=h;
    }
    const c=this.scratch.getContext('2d',{willReadFrequently:true});
    const m=this.matte.getContext('2d',{willReadFrequently:true});
    c.drawImage(this.el,0,0,w,h,0,0,w,h);m.drawImage(this.el,w,0,w,h,0,0,w,h);
    const col=c.getImageData(0,0,w,h),mat=m.getImageData(0,0,w,h),cd=col.data,md=mat.data;
    // Colour half is premultiplied; un-premultiply and move matte luma into alpha.
    for(let i=0;i<cd.length;i+=4){const a=md[i];if(a>0&&a<255){const k=255/a;cd[i]=Math.min(255,cd[i]*k);cd[i+1]=Math.min(255,cd[i+1]*k);cd[i+2]=Math.min(255,cd[i+2]*k);}cd[i+3]=a;}
    c.putImageData(col,0,0);
    return this.scratch;
  }
  decodedFrame(){
    if(!this.playable)return null;
    const serial=this.el.requestVideoFrameCallback?this.decodedSerial:
      this.el.getVideoPlaybackQuality?.().totalVideoFrames??Math.floor(this.el.currentTime*24);
    if(this.cachedFrame&&this.cachedSerial===serial)return this.cachedFrame;
    const src=this.frameSource();if(!src)return null;
    if(this.alpha){
      if(!this.cachedFrame)this.cachedFrame=document.createElement('canvas');
      const w=this.width,h=this.height;
      if(this.cachedFrame.width!==w||this.cachedFrame.height!==h){this.cachedFrame.width=w;this.cachedFrame.height=h;}
      const c=this.cachedFrame.getContext('2d');c.clearRect(0,0,w,h);c.drawImage(src,0,0,w,h);
    }else this.cachedFrame=src;
    this.cachedSerial=serial;this.cachedMediaTime=this.el.currentTime;
    this.cachedAt=performance.now();this.cacheCopies++;return this.cachedFrame;
  }
  loopFrame(){
    const now=performance.now();
    const loopStart=this.el.currentTime<.3&&this.cachedMediaTime>this.el.duration-.3;
    return this.spec.loop&&(this.el.seeking||loopStart)&&!this.el.paused&&
      (loopStart||now-this.loopSeekAt<=LOOP_FRAME_HOLD_MS)&&now-this.cachedAt<=LOOP_FRAME_HOLD_MS
      ?this.cachedFrame:null;
  }
  startFrame(){
    return this.el.currentTime<.1&&performance.now()-this.startRequestedAt<=START_HOLD_MS
      ?this.firstFrame:null;
  }
}
let clips=null,restStarted=false,lastDrawAt=0,diagnostic=null;
function clipSet(){
  if(!clips){
    clips={};
    clips[ORDER[0]]=new Clip(ORDER[0],CLIPS[ORDER[0]]);
  }
  return clips;
}
function startRest(){
  if(restStarted)return;restStarted=true;
  for(const name of ORDER.slice(1))if(!clips[name])clips[name]=new Clip(name,CLIPS[name]);
}
function clip(name){
  const set=clipSet();
  if(!set[name])set[name]=new Clip(name,CLIPS[name]);
  return set[name];
}
export function familyVideoEnabled(){
  if(typeof document==='undefined')return false;
  if(new URLSearchParams(location.search).get('familyVideo')==='0')return false;
  // Single-file offline build: clips are not inlined (>100KB each), so skip creating decoders.
  if(globalThis.window?.__ASSETS__&&!available(ROOT+ORDER[0]+'.webm.bin')&&!available(ROOT+ORDER[0]+'.stacked.mp4'))return false;
  return true;
}
export function preloadFamilyVideo(){
  if(!familyVideoEnabled())return;
  clipSet();
  // The first loop must win the network race; the rest follow once it can decode.
  const first=clips[ORDER[0]];
  if(first.playable)startRest();
  else{first.el.addEventListener('loadeddata',startRest,{once:true});setTimeout(startRest,2500);}
}
export function pauseFamilyVideo(){
  if(!clips)return;
  for(const c of Object.values(clips))c.pause();
}
if(typeof document!=='undefined'){
  // Stop decoding when the scene stops drawing (dialog over the scene, tab hidden).
  setInterval(()=>{if(clips&&lastDrawAt&&performance.now()-lastDrawAt>600)pauseFamilyVideo();},500);
}
const SWITCH_HOLD_MS=300;
const actor={state:null,reactionId:null,startedAt:0,lastPaint:null,lastSrc:null,lastPaintAt:-Infinity};
function targetFor(o){
  if(o.phase==='failed'||o.kind==='fail')return 'fail';
  if(o.kind==='win')return 'win';
  if(o.phase==='won')return 'win';
  if(o.kind&&CLIPS[o.kind])return o.kind;
  if(o.urgent)return 'hurry';
  return o.safe?'idle-warm':'idle-cold';
}
function switchTo(name,o){
  const c=clip(name);
  if(actor.state===name&&actor.reactionId===o.reactionId)return c;
  const old=actor.state?clips[actor.state]:null;
  // A repeat of the same one-shot early in its rise keeps playing instead of snapping back.
  const early=c.playable&&c.el.duration>0&&c.el.currentTime<c.el.duration*.35&&!c.ended;
  const sameOneShot=actor.state===name&&!c.spec.loop&&actor.reactionId!==o.reactionId&&!early;
  actor.state=name;actor.reactionId=o.reactionId;actor.startedAt=performance.now();
  if(old&&old!==c)old.pause();
  // One-shots end on the rest pose, so a loop entered from one restarts at its own rest frame.
  if(c.spec.loop)(old&&!old.spec.loop?c.restart():c.play());
  else if(sameOneShot||old!==c)c.restart();
  else c.play();
  return c;
}
/** Draws the family video frame so the cutout rectangle lands on `rect` ([x,y,w,h] in scene units,
 *  the same rectangle the mesh puppet uses). Options: kind (active reaction), reactionId, phase,
 *  safe, urgent. Returns null (caller draws the deform fallback) or {state,label,clipTime,...}. */
export function drawFamilyVideo(ctx,o){
  lastDrawAt=performance.now();
  if(!familyVideoEnabled())return null;
  clipSet();
  let name=targetFor(o);
  // A reaction one-shot plays to its end even after the scene's reaction window closes, then
  // hands over to the loop; a new reaction or a terminal phase interrupts it. fail/win hold
  // their last frame until the phase changes.
  const cur=actor.state?clips[actor.state]:null;
  if(cur&&!cur.spec.loop&&!cur.spec.holdEnd&&CLIPS[name].loop&&actor.reactionId===o.reactionId&&
    !cur.ended&&!cur.failed&&o.phase!=='won'&&o.phase!=='failed')name=actor.state;
  const c=switchTo(name,o);
  if(c.failed){diagnostic={state:name,failed:true};return null;}
  if(c.spec.loop&&c.el.paused)c.play();
  const held=!c.playable&&actor.lastPaint===name?c.loopFrame():null;
  const start=c.startFrame();
  let src=null,how='decoded';
  // After a (re)start, show the clip's own frame 0 until the seek lands.
  if(start&&(c.el.seeking||c.el.currentTime<.02||!c.playable)){src=start;how='first-frame';}
  else if(held){src=held;how='loop-hold';}
  else src=c.decodedFrame();
  if(!src&&c.spec.loop&&c.cachedFrame&&actor.lastPaint===name&&performance.now()-c.cachedAt<=LOOP_FRAME_HOLD_MS){src=c.cachedFrame;how='loop-hold';}
  // Across a clip switch, keep the last painted frame for a few frames instead of flashing the
  // static fallback while the new decoder seeks.
  if(!src&&actor.lastSrc&&performance.now()-actor.lastPaintAt<=SWITCH_HOLD_MS){src=actor.lastSrc;how='switch-hold';}
  diagnostic={state:name,how,alpha:c.alpha,decodedFrames:c.decodedSerial,cacheCopies:c.cacheCopies,
    clipTime:c.el.currentTime,clipDuration:c.el.duration||0,ready:c.playable};
  if(!src)return null;
  // Same (slightly anisotropic) mapping as the puppet cutout, so seat and feet coincide.
  const [rx,ry,rw,rh]=o.rect,kx=rw/ART_RECT[2],ky=rh/ART_RECT[3];
  const x=rx-ART_RECT[0]*kx,y=ry-ART_RECT[1]*ky,w=CLIP_W*kx,h=CLIP_H*ky;
  const sw=src.videoWidth||src.width,sh=src.videoHeight||src.height;
  ctx.drawImage(src,0,0,sw,sh,x,y,w,h);
  actor.lastPaint=name;actor.lastSrc=src;actor.lastPaintAt=performance.now();
  const finished=!c.spec.loop&&(c.ended||(c.el.duration>0&&c.el.currentTime>=c.el.duration-.05));
  return {state:name,label:c.spec.label,how,clipTime:c.el.currentTime,clipDuration:c.el.duration||0,finished,
    alpha:c.alpha,loop:!!c.spec.loop,decodedFrames:c.decodedSerial,rate:c.el.playbackRate||1,bounds:{x,y,width:w,height:h}};
}
drawFamilyVideo.diagnostics=()=>diagnostic;
