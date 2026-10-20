/* Chapter 1 (attic) painted-act video.
 * stage 0 : idle loop (slanted blizzard, cold stove, seamless crossfaded loop)
 * stage 1-5: one-shot celebration that plays when that repair's painting comes in, then holds its last frame.
 * Clips are 3:2 like the 900x600 act paintings and start on that stage's painting, so they draw in its place.
 * If a clip is missing / not decodable yet, the caller keeps drawing the still painting. */
const ROOT='video/attic/';
const NAMES=['stage-0-idle','stage-1-cheer','stage-2-cheer','stage-3-cheer','stage-4-cheer','stage-5-cheer'];
// Per-stage playback speed: the quilt clip (stage 4) runs faster so the quilt appears and drops sooner.
const RATES={4:1.8};
const clips=new Map();
function resolve(path){
  const w=globalThis.window;
  return w?.__ASSETS__?.[path]||w?.__ASSET_BUNDLE__?.[path]||path;
}
function available(path){
  // Single-file offline build inlines only small assets; without the clip we fall back to stills.
  const bundle=globalThis.window?.__ASSETS__;
  return !bundle||!!bundle[path];
}
let enabled=null;
export function actVideoEnabled(){
  if(enabled!==null)return enabled;
  try{
    enabled=typeof document!=='undefined'
      &&new URLSearchParams(location.search).get('actVideo')!=='0'
      &&!window.matchMedia('(prefers-reduced-motion: reduce)').matches
      &&available(ROOT+NAMES[0]+'.mp4');
  }catch{enabled=false;}
  return enabled;
}
function clip(stage){
  if(clips.has(stage))return clips.get(stage);
  const path=ROOT+NAMES[stage]+'.mp4';
  if(!NAMES[stage]||!available(path)){clips.set(stage,null);return null;}
  const el=document.createElement('video');
  el.muted=true;el.volume=0;el.playsInline=true;el.setAttribute('playsinline','');
  el.preload='auto';el.loop=stage===0;el.crossOrigin='anonymous';
  // Keep the decoder inside the viewport: Chrome may pause muted media scrolled out of view.
  el.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0;z-index:-1';
  const c={el,ready:false,failed:false,started:false};
  el.addEventListener('loadeddata',()=>{c.ready=true;});
  const rate=RATES[stage]||1;
  el.defaultPlaybackRate=el.playbackRate=rate;
  el.addEventListener('loadedmetadata',()=>{el.defaultPlaybackRate=el.playbackRate=rate;});
  el.addEventListener('error',()=>{c.failed=true;});
  el.addEventListener('ended',()=>{c.endedAt=performance.now();});
  el.src=resolve(path);
  document.body.appendChild(el);
  el.load();
  clips.set(stage,c);
  return c;
}
/** Warm up the clip for the stage on screen and the next celebration. */
export function preloadActVideo(stage){
  if(!actVideoEnabled())return;
  clip(stage);
  if(stage<NAMES.length-1)clip(stage+1);
}
/** A fresh run of the chapter: celebrations have not played yet. */
export function resetActVideo(){
  for(const [stage,c] of clips)if(c&&stage>0){c.started=false;c.el.pause();try{c.el.currentTime=0;}catch{}}
}
/** The repair for `stage` just landed: play its celebration once from the start. */
export function startActVideo(stage){
  if(!actVideoEnabled()||stage<=0)return;
  const c=clip(stage);if(!c)return;
  c.started=true;c.endedAt=0;c.startedAt=performance.now();
  try{c.el.currentTime=0;}catch{}
  c.el.playbackRate=RATES[stage]||1;
  c.el.play().catch(()=>{});
}
export function pauseActVideo(stage){
  const c=clips.get(stage);
  if(c&&!c.el.paused)c.el.pause();
}
/** Drawable video for the stage, or null to draw the still painting. */
export function actVideoFrame(stage){
  if(!actVideoEnabled())return null;
  const c=clips.get(stage);
  if(!c||c.failed||!c.ready||c.el.readyState<2)return null;
  if(stage===0){
    if(c.el.paused)c.el.play().catch(()=>{});
    return c.el;
  }
  // Celebrations only show after they were triggered this run (a resumed save shows the still);
  // once ended the element keeps its last frame, which holds until the next repair.
  return c.started?c.el:null;
}
export function actVideoName(stage){return NAMES[stage]||null;}
// Celebrations the win card must not cut off: stage 4 (quilt drops onto the bed in its last second).
const HOLD_STAGES=new Set([4]);
/** True while a held celebration is still playing, or ended less than `holdMs` ago, so the result card waits for it.
 *  A missing / failed / stalled clip never blocks (the caller also caps the wait). */
export function actVideoBusy(holdMs=0){
  for(const stage of HOLD_STAGES){
    const c=clips.get(stage);
    if(!c||!c.started||c.failed)continue;
    // The quilt is already on the bed in the clip's final moments, so release ~0.15 s (real time) before the end.
    const left=c.el.duration>0?(c.el.duration-c.el.currentTime)/(c.el.playbackRate||1):Infinity;
    if(!c.el.ended&&!c.el.paused&&left>.15)return true;
    if(c.endedAt&&performance.now()-c.endedAt<holdMs)return true;
  }
  return false;
}
/** True if a held celebration (the quilt) started at or after `since` (performance.now() time) and can play,
 *  i.e. this win is the quilt level — used to give only that level the earlier result card. */
export function actVideoHeldSince(since){
  for(const stage of HOLD_STAGES){
    const c=clips.get(stage);
    if(c&&c.started&&!c.failed&&c.startedAt>=since)return true;
  }
  return false;
}
