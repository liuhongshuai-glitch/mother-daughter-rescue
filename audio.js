/**
 * Layered game audio: music bed, two ambient loops, pooled one-shot sfx and a
 * single-slot voice channel with ducking. Everything is plain HTMLAudio so the
 * offline bundle keeps working; every play() call is guarded by enabled().
 */
// Side-effect import: registers the dialogue strip (window.__RESCUE_STORY__) without a new app.js import line.
import './story.js';

export function createAudio({ enabled = () => true, asset = p => p } = {}) {
  const SFX = {
    tap: .5, scribble: .42, 'mark-tap': .35, pop: .62, whoosh: .45, sparkle: .5, combo: .39, wrong: .5,
    // Confetti hiss removed from the game entirely; every win now uses the 'chapter-done' jingle.
    'hint-harp': .5, tick: .45, fanfare: .72, lose: .6, giggle: .6,
    'repair-0': .6, 'repair-1': .6, 'repair-2': .6, 'repair-3': .6, 'repair-4': .6,
    'level-start': .5, 'chapter-done': .7, 'coach-done': .6, 'combo-3': .44, 'combo-4': .46, 'combo-5': .5, bubble: .45,
  };
  const VOICES = {
    'voice-nice': .8, 'voice-wow': .8, 'voice-great': .8, 'voice-amazing': .8, 'voice-perfect': .8,
    'voice-nice-2': .8, 'voice-wow-2': .8, 'voice-great-2': .8, 'voice-amazing-2': .8, 'voice-perfect-2': .8,
    'voice-ohno': .7, 'voice-hurry': .78, 'voice-warm': .8, 'voice-notthere': .62,
  };
  /** Praise lines rotate between takes (never the same take twice in a row) and get a slight pitch wobble. */
  const TAKES = {
    'voice-nice': ['voice-nice', 'voice-nice-2'], 'voice-great': ['voice-great', 'voice-great-2'],
    'voice-wow': ['voice-wow', 'voice-wow-2'], 'voice-perfect': ['voice-perfect', 'voice-perfect-2'],
    'voice-amazing': ['voice-amazing', 'voice-amazing-2'],
  };
  const lastTake = {};
  const wobble = () => 1 + (Math.random() * 2 - 1) * .035;
  const LOOPS = { wind: .5, 'fire-loop': .5 };
  const MUSIC_VOLUME = .3;
  const pools = new Map();
  const loops = new Map();
  const timers = new Map(); // id -> kind ('sfx' | 'voice')
  const stats = { repairs: 0, cheers: 0, byTask: [0, 0, 0, 0, 0], played: 0, muted: 0, voices: {}, sfx: {}, takes: {}, stings: {}, lastRate: 1 };
  let music = null, unlocked = false, voiceBusy = false, voiceUntil = 0, lastVoice = -Infinity, duck = 1;
  let backgrounded = false, musicTarget = MUSIC_VOLUME, ladderAt = -Infinity;

  const on = () => { try { return !!enabled(); } catch { return false; } };
  const src = name => asset(`assets/${name}.ogg`);

  function element(name, volume) {
    const a = new Audio(src(name));
    a.preload = 'auto';
    a.volume = volume;
    return a;
  }
  function pool(name) {
    if (!pools.has(name)) pools.set(name, []);
    const list = pools.get(name);
    let free = list.find(a => a.paused || a.ended);
    if (!free) {
      if (list.length >= 3) return null;
      free = element(name, SFX[name] ?? VOICES[name] ?? .5);
      list.push(free);
    }
    return free;
  }
  /** Tagged timers so cancel({ voicesOnly }) can clear voice work while sfx keep their schedule. */
  function later(fn, ms, kind = 'sfx') {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.set(id, kind);
    return id;
  }
  const live = () => on() && !backgrounded && unlocked;
  function stopVoices() {
    for (const [name, list] of pools) if (name.startsWith('voice-')) list.forEach(a => { if (!a.paused) a.pause(); a.currentTime = 0; });
  }
  function applyVolumes() {
    if (music) music.volume = Math.min(1, musicTarget * duck);
    for (const [name, loop] of loops) loop.el.volume = Math.min(1, LOOPS[name] * loop.target * duck);
  }
  function setDuck(value, ms = 160) {
    const from = duck, to = value, start = performance.now();
    const step = now => {
      const u = Math.min(1, (now - start) / ms);
      duck = from + (to - from) * u;
      applyVolumes();
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    // Warm every cue once inside the gesture so first playback is instant.
    for (const name of [...Object.keys(SFX), ...Object.keys(VOICES)]) {
      const a = pool(name);
      if (!a) continue;
      const volume = a.volume;
      a.volume = 0;
      a.play().then(() => { a.pause(); a.currentTime = 0; a.volume = volume; }).catch(() => { a.volume = volume; });
    }
    for (const name of Object.keys(LOOPS)) {
      const el = element(name, 0);
      el.loop = true;
      loops.set(name, { el, target: 0 });
      el.play().catch(() => {});
    }
    playMusic();
  }
  function playMusic() {
    if (!on() || backgrounded) return;
    if (!music) { music = element('music', MUSIC_VOLUME); music.loop = true; }
    applyVolumes();
    music.play().catch(() => {});
    for (const loop of loops.values()) loop.el.play().catch(() => {});
  }
  function pauseAll() {
    music?.pause();
    for (const loop of loops.values()) loop.el.pause();
    // One-shots already sounding stop too: a hidden or muted tab must go fully silent at once.
    for (const list of pools.values()) list.forEach(a => { if (!a.paused) { a.pause(); a.currentTime = 0; } });
    cancel();
  }
  function play(name, { volume, rate = 1, delay = 0 } = {}) {
    // Gate before queueing too: a cue queued while muted must not leak out after unmute.
    if (!on() || backgrounded) { stats.muted++; return false; }
    if (!unlocked) return false;
    if (delay) { later(() => play(name, { volume, rate }), delay, 'sfx'); return true; }
    // From streak 3 the ladder sting takes the generic combo chime's slot instead of stacking on it.
    if (name === 'combo' && performance.now() - ladderAt < 80) return false;
    const a = pool(name);
    if (!a) return false;
    a.volume = Math.min(1, volume ?? (SFX[name] ?? .5));
    a.playbackRate = rate;
    a.currentTime = 0;
    a.play().catch(() => {});
    stats.played++;
    stats.sfx[name] = (stats.sfx[name] || 0) + 1;
    return true;
  }
  /** Voice lines never overlap; `priority` lines may cut the cooldown. */
  function say(name, { delay = 0, priority = false, cooldown = 2600, rate } = {}) {
    if (!live()) { stats.muted++; return false; }
    if (delay) { later(() => say(name, { priority, cooldown, rate }), delay, 'voice'); return true; }
    const now = performance.now();
    if (voiceBusy && now < voiceUntil && !priority) return false;
    if (!priority && now - lastVoice < cooldown) return false;
    // Never stack voices: a priority line cuts whatever is still talking.
    if (priority) stopVoices();
    const group = TAKES[name];
    let take = name;
    if (group) {
      // Strict alternation: the first line of a session is the original take, then never the same take twice running.
      take = lastTake[name] === undefined ? group[0] : group[(group.indexOf(lastTake[name]) + 1) % group.length];
      lastTake[name] = take;
    }
    const a = pool(take);
    if (!a) return false;
    a.volume = VOICES[take] ?? .8;
    // Pitch follows rate (preservesPitch off) so the wobble reads as a livelier delivery, not a time stretch.
    a.preservesPitch = false;
    a.playbackRate = rate ?? (group ? wobble() : 1);
    stats.lastRate = a.playbackRate;
    a.currentTime = 0;
    const ok = a.play();
    voiceBusy = true;
    lastVoice = now;
    const length = Number.isFinite(a.duration) && a.duration > 0 ? a.duration * 1000 / a.playbackRate : 1400;
    voiceUntil = now + length + 120;
    setDuck(.28, 120);
    later(() => { if (performance.now() >= voiceUntil - 5) { voiceBusy = false; setDuck(1, 420); } }, length + 120, 'voice');
    ok?.catch(() => { voiceBusy = false; setDuck(1, 200); });
    stats.cheers++;
    stats.voices[take] = (stats.voices[take] || 0) + 1;
    if (group) stats.takes[name] = [...new Set([...(stats.takes[name] || []), take])];
    return true;
  }
  /**
   * Short musical stings for story beats. Combo stings climb a 3/4/5 ladder; streaks past 5 reuse
   * the top sting a touch higher. Stings duck the music briefly so they read over the bed.
   */
  function sting(name, { delay = 0, streak = 0 } = {}) {
    let cue = name, rate = 1;
    if (name === 'combo') {
      if (streak < 3) return false;
      cue = `combo-${Math.min(5, streak)}`;
      rate = streak > 5 ? Math.min(1.12, 1 + (streak - 5) * .04) : 1;
      if (!delay) ladderAt = performance.now();
    }
    if (!(cue in SFX)) return false;
    const ok = play(cue, { delay, rate });
    if (ok) {
      stats.stings[cue] = (stats.stings[cue] || 0) + 1;
      if (cue === 'chapter-done' || cue === 'level-start' || cue === 'coach-done') later(() => { if (!voiceBusy) { setDuck(.45, 120); later(() => { if (!voiceBusy) setDuck(1, 500); }, 900, 'sfx'); } }, delay, 'sfx');
    }
    return ok;
  }
  /** Dialogue bubble pop: soft, slightly varied so a run of bubbles does not machine-gun. */
  function bubble() { return play('bubble', { rate: .96 + Math.random() * .08 }); }
  window.addEventListener('rescue-story-bubble', () => { if (unlocked) bubble(); });
  function repair(task, delay = 0) {
    if (!live()) return false;
    later(() => {
      if (!on() || backgrounded) return;
      play(`repair-${task}`);
      stats.repairs++;
      stats.byTask[task]++;
    }, delay, 'sfx');
    return true;
  }
  function ambient(name, target) {
    const loop = loops.get(name);
    if (!loop) return;
    loop.target = Math.max(0, Math.min(1, target));
    applyVolumes();
  }
  /**
   * Clear pending work. With `voicesOnly`, only voice timers and playing voice
   * lines are dropped; sfx timers (e.g. the last tile's repair sound) keep running.
   */
  function cancel({ voicesOnly = false } = {}) {
    for (const [id, kind] of timers) {
      if (voicesOnly && kind !== 'voice') continue;
      clearTimeout(id);
      timers.delete(id);
    }
    voiceBusy = false; voiceUntil = 0; duck = 1; applyVolumes();
    stopVoices();
  }
  function background(hidden) {
    backgrounded = hidden;
    if (hidden) pauseAll(); else playMusic();
  }
  function setMusicVolume(v) { musicTarget = v; applyVolumes(); }
  /** Music playbackRate (pitch preserved by default); used for the hurry-up push. */
  function setMusicRate(rate = 1) {
    if (!music) { music = element('music', MUSIC_VOLUME); music.loop = true; }
    music.playbackRate = Math.max(.5, Math.min(2, rate));
  }
  return {
    unlock, play, say, sting, bubble, repair, ambient, cancel, playMusic, pauseAll, background, setMusicVolume, setMusicRate,
    get unlocked() { return unlocked; },
    stats: () => ({ ...stats, byTask: [...stats.byTask], voices: { ...stats.voices }, sfx: { ...stats.sfx }, takes: { ...stats.takes }, stings: { ...stats.stings }, musicPlaying: !!music && !music.paused, musicRate: music?.playbackRate ?? 1, voiceBusy,
      pendingTimers: { sfx: [...timers.values()].filter(k => k === 'sfx').length, voice: [...timers.values()].filter(k => k === 'voice').length },
      loops: Object.fromEntries([...loops].map(([n, l]) => [n, { playing: !l.el.paused, volume: l.el.volume }])) }),
  };
}
