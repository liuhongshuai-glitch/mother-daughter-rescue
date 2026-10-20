/**
 * Local, synthesized game feedback. Call unlock() directly from pointerdown
 * (or a keyboard gesture), then play(kind) from the accepted game action.
 * No listeners, storage, requests, or existing OGG playback are installed here.
 */
export function createFeedback({ enabled = () => true } = {}) {
  // [frequency Hz, start seconds, duration seconds, ending Hz, peak gain]
  const tones = {
    mark: [[390, 0, 0.07, 470, 0.11]],
    unmark: [[350, 0, 0.065, 255, 0.10]],
    place: [[260, 0, 0.105, 330, 0.13], [520, 0.035, 0.09, 520, 0.06]],
    remove: [[290, 0, 0.10, 180, 0.12]],
    undo: [[440, 0, 0.09, 370, 0.10], [294, 0.075, 0.10, 260, 0.09]],
    hint: [[440, 0, 0.13, 440, 0.10], [587, 0.11, 0.16, 587, 0.09]],
    reset: [[330, 0, 0.10, 280, 0.09], [220, 0.09, 0.14, 196, 0.09]],
    open: [[330, 0, 0.09, 392, 0.10], [494, 0.065, 0.11, 494, 0.08]],
    back: [[392, 0, 0.09, 330, 0.10], [247, 0.065, 0.11, 247, 0.08]],
    language: [[349, 0, 0.08, 349, 0.09], [466, 0.07, 0.10, 466, 0.08]],
    success: [[392, 0, 0.17, 392, 0.10], [494, 0.105, 0.17, 494, 0.09],
      [587, 0.21, 0.24, 587, 0.09]],
    error: [[175, 0, 0.095, 155, 0.10], [165, 0.115, 0.11, 140, 0.09]],
    step: [[523, 0, 0.095, 587, 0.08]],
  };
  const counters = {
    unlocks: 0, played: 0, muted: 0, throttled: 0, unavailable: 0,
    unknown: 0, errors: 0, presses: 0, pops: 0, reducedMotion: 0,
  };
  const byKind = Object.fromEntries(Object.keys(tones).map((kind) => [kind, 0]));
  const voices = new Set();
  const animations = new WeakMap();
  const lastKind = new Map();
  const root = globalThis;
  const motion = root.matchMedia?.("(prefers-reduced-motion: reduce)");
  let context;
  let output;
  let frame = null;
  let lastSound = -Infinity;
  let lastMark = -Infinity;

  function isEnabled() {
    try { return Boolean(enabled()); } catch { return false; }
  }

  function quiet() {
    if (!context) return;
    const now = context.currentTime;
    for (const voice of voices) {
      if (voice.stopping) continue;
      voice.stopping = true;
      // Master gating avoids replacing an attack with a discontinuous gain.
      try { voice.oscillator.stop(now + 0.015); } catch { /* Already ended. */ }
    }
    output.gain.cancelScheduledValues(now);
    output.gain.setTargetAtTime(0, now, 0.004);
  }

  function monitor() {
    frame = null;
    if (!voices.size) return;
    if (!isEnabled()) quiet();
    if (typeof root.requestAnimationFrame === "function") {
      frame = root.requestAnimationFrame(monitor);
    }
  }

  function unlock() {
    counters.unlocks++;
    if (!isEnabled()) {
      counters.muted++;
      quiet();
      return Promise.resolve(false);
    }
    try {
      if (!context || context.state === "closed") {
        const Audio = root.AudioContext || root.webkitAudioContext;
        if (!Audio) {
          counters.unavailable++;
          return Promise.resolve(false);
        }
        context = new Audio();
        output = context.createGain();
        output.gain.value = 0.32;
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1800;
        filter.Q.value = 0.5;
        output.connect(filter);
        filter.connect(context.destination);
      }
      // Invoke resume synchronously inside the caller's trusted gesture.
      const pending = context.state !== "running" ? context.resume() : undefined;
      return Promise.resolve(pending).then(() => {
        if (!isEnabled()) {
          quiet();
          return false;
        }
        return context.state === "running";
      }).catch(() => {
        counters.errors++;
        return false;
      });
    } catch {
      counters.errors++;
      return Promise.resolve(false);
    }
  }

  function play(kind) {
    if (!Object.prototype.hasOwnProperty.call(tones, kind)) {
      counters.unknown++;
      return false;
    }
    if (!isEnabled()) {
      counters.muted++;
      quiet();
      return false;
    }
    if (!context || context.state !== "running") {
      counters.unavailable++;
      return false;
    }
    const nowMs = root.performance?.now() ?? Date.now();
    const marking = kind === "mark" || kind === "unmark";
    const priority = kind === "back" || kind === "language";
    if ((!priority && nowMs - lastSound < 40) ||
        (marking && nowMs - lastMark < 65) ||
        nowMs - (lastKind.get(kind) ?? -Infinity) < (marking ? 65 : 100) ||
        voices.size + tones[kind].length > 8) {
      counters.throttled++;
      return false;
    }
    const created = [];
    try {
      const now = context.currentTime;
      output.gain.cancelScheduledValues(now);
      output.gain.setTargetAtTime(0.32, now, 0.006);
      for (const [frequency, delay, duration, endFrequency, peak] of tones[kind]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const voice = { oscillator, gain, stopping: false };
        created.push(voice);
        voices.add(voice);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          voices.delete(voice);
          if (!voices.size && frame !== null) {
            root.cancelAnimationFrame?.(frame);
            frame = null;
          }
        };
        oscillator.type = "sine";
        const start = now + delay;
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(peak, start + 0.009);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        gain.gain.linearRampToValueAtTime(0, start + duration + 0.008);
        oscillator.connect(gain);
        gain.connect(output);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.012);
      }
      lastSound = nowMs;
      lastKind.set(kind, nowMs);
      if (marking) lastMark = nowMs;
      counters.played++;
      byKind[kind]++;
      if (frame === null) monitor();
      return true;
    } catch {
      for (const voice of created) {
        try { voice.oscillator.stop(); } catch { /* May not have started. */ }
        voice.oscillator.disconnect();
        voice.gain.disconnect();
        voices.delete(voice);
      }
      counters.errors++;
      return false;
    }
  }

  function animate(element, kind) {
    if (!element || typeof element.animate !== "function") return false;
    animations.get(element)?.cancel();
    if (motion?.matches) {
      counters.reducedMotion++;
      return false;
    }
    try {
      // Individual scale leaves the element's CSS transform/layout intact.
      const base = root.getComputedStyle?.(element).scale || "none";
      const animation = element.animate(
        [{ scale: base }, { scale: kind === "press" ? "0.96" : "1.045", offset: 0.35 },
          { scale: base }],
        { duration: kind === "press" ? 150 : 220, easing: "ease-out", fill: "none" },
      );
      animations.set(element, animation);
      const cancelForMotion = (event) => { if (event.matches) animation.cancel(); };
      motion?.addEventListener?.("change", cancelForMotion);
      const clean = () => {
        motion?.removeEventListener?.("change", cancelForMotion);
        if (animations.get(element) === animation) animations.delete(element);
      };
      animation.onfinish = clean;
      animation.oncancel = clean;
      counters[kind === "press" ? "presses" : "pops"]++;
      return true;
    } catch {
      counters.errors++;
      return false;
    }
  }

  return {
    unlock,
    play,
    press: (element) => animate(element, "press"),
    pop: (element) => animate(element, "pop"),
    // Copies contain counters only: no identifiers, event logs, or persistence.
    stats: () => ({ ...counters, activeVoices: voices.size, byKind: { ...byKind } }),
  };
}
