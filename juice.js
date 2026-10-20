/**
 * Screen-space juice: a full-page particle canvas (sprite stars, glows, light rays, ribbon
 * confetti, dust puffs), floating labels, flying supply tokens from board to scene, and shake
 * helpers. v10 replaces the 2-10 px canvas dots with assetgen sprites (web/assets/vfx-*.webp)
 * drawn at phone-readable sizes; the vector shapes remain only as a fallback while sprites load.
 * Everything respects prefers-reduced-motion, never takes pointer input and only draws while active.
 */
export function createJuice() {
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'juice-layer';
  canvas.setAttribute('aria-hidden', 'true');
  // The layer never intercepts taps, even before the stylesheet applies.
  canvas.style.pointerEvents = 'none';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const particles = [], labels = [], flights = [], flares = [];
  const stats = { bursts: 0, confetti: 0, labels: 0, flights: 0, shakes: 0, celebrations: 0, spriteDraws: 0 };
  let raf = null, last = 0, dpr = 1;
  const palette = ['#FFD86B', '#FFB347', '#FFF3C4', '#F4A6B8', '#9ED6C2', '#8BAFC8'];
  const ribbonColors = ['#FFC93C', '#FF8FA3', '#7FD1B9', '#8EC5FF', '#FFB054', '#C9A7FF'];
  const resolve = path => window.__ASSETS__?.[path] || path;
  const sprites = {};
  const tints = [];
  function load(name, path) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { if (name === 'ribbon') for (const c of ribbonColors) tints.push(tint(img, c)); };
    img.src = resolve(path);
    sprites[name] = img;
  }
  load('star', 'assets/vfx-star.webp');
  load('glow', 'assets/vfx-glow.webp');
  load('rays', 'assets/vfx-rays.webp');
  load('ribbon', 'assets/vfx-ribbon.webp');
  load('dust', 'assets/vfx-dust.webp');
  const ready = name => sprites[name]?.complete && sprites[name].naturalWidth > 0;
  function tint(img, color) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0);
    return c;
  }

  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
  }
  addEventListener('resize', resize);
  resize();

  function ensure() {
    if (raf === null) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function center(el) {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height];
  }
  /** A single additive glow (and optional rotating rays) that swells and fades at a point. */
  function flare(x, y, size, { rays = false, core = true, ttl = .55, alpha = .9 } = {}) {
    flares.push({ x, y, size, rays, core, ttl, alpha, life: 0, spin: Math.random() * 6 });
  }
  /** Sparkle burst at an element (or [x,y]). kind: sparkle | dust | heart | confetti */
  function burst(target, kind = 'sparkle', count = 14) {
    if (reduced()) return;
    const [x, y, w = 40] = Array.isArray(target) ? target : center(target);
    stats.bursts++;
    // Point-sized targets (a cell, a landing spot) get a glow; a burst over the whole scene does
    // not, so a celebration never washes out the characters' faces.
    if (kind === 'sparkle' && w <= 140) flare(x, y, Math.max(70, w * 1.6), { ttl: .5, alpha: .8 });
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = (kind === 'dust' ? 40 : 120) + Math.random() * (kind === 'dust' ? 40 : 160);
      particles.push({
        x: x + (Math.random() - .5) * w * .5, y: y + (Math.random() - .5) * w * .3,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'dust' ? 20 : 90),
        life: 0, ttl: kind === 'dust' ? .8 + Math.random() * .4 : .6 + Math.random() * .5,
        // Sprite sizes in CSS px: stars 12-26, dust puffs 16-30 (vs. 2.5-6 px dots before).
        size: kind === 'dust' ? 16 + Math.random() * 14 : kind === 'heart' ? 7 + Math.random() * 5 : 12 + Math.random() * 14,
        color: kind === 'dust' ? '#d9c39e' : kind === 'heart' ? '#F4A6B8' : palette[i % palette.length],
        kind, spin: Math.random() * 6, drag: kind === 'dust' ? 2.2 : 3.2, gravity: kind === 'dust' ? 40 : 300,
      });
    }
    ensure();
  }
  /** Win cannons: ribbon sprites (tinted) plus larger paper chips from both sides. */
  function confetti(count = 90) {
    if (reduced()) return;
    stats.confetti++;
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0, ribbon = i % 3 !== 0;
      particles.push({
        x: fromLeft ? -10 : innerWidth + 10, y: innerHeight * (.35 + Math.random() * .3),
        vx: (fromLeft ? 1 : -1) * (260 + Math.random() * 340), vy: -420 - Math.random() * 260,
        life: 0, ttl: 2.4 + Math.random() * 1.2, size: ribbon ? 20 + Math.random() * 12 : 8 + Math.random() * 5,
        color: palette[i % palette.length], kind: ribbon ? 'ribbon' : 'confetti', tint: i % ribbonColors.length,
        spin: Math.random() * 6, drag: ribbon ? 1.7 : 1.4, gravity: ribbon ? 430 : 520,
        w: 1 + Math.random() * 1.2, phase: Math.random() * 6,
      });
    }
    ensure();
  }
  /** Big celebratory flash over an element (e.g. the scene at a win): faint rotating light rays
   *  and a ring of stars. No hot glow core: this page layer sits above the characters and a white
   *  core would wash out their faces at the emotional peak (the scene draws its own light behind them). */
  function celebrate(target, { size = 300, stars = 14 } = {}) {
    if (reduced()) return;
    const [x, y] = Array.isArray(target) ? target : center(target);
    stats.celebrations++;
    flare(x, y, size, { rays: true, core: false, ttl: 1.6, alpha: .42 });
    for (let i = 0; i < stars; i++) {
      const a = i / stars * Math.PI * 2, sp = 200 + Math.random() * 140;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, ttl: .9 + Math.random() * .4,
        size: 16 + Math.random() * 14, color: palette[i % palette.length], kind: 'sparkle', spin: Math.random() * 6, drag: 2.6, gravity: 160 });
    }
    ensure();
  }
  /** Floating label rising from an element. */
  function label(target, text, { color = '#7a4a12', size = 22, up = 54, tag = null } = {}) {
    if (reduced()) return;
    const [x, y] = Array.isArray(target) ? target : center(target);
    // A newer label with the same tag pushes the older one away and fades it, so text never double-exposes.
    if (tag) for (const l of labels) if (l.tag === tag) { l.life = Math.max(l.life, l.ttl * .72); l.up += 26; }
    labels.push({ x, y, text, color, size, up, tag, life: 0, ttl: 1.1 });
    stats.labels++;
    ensure();
  }
  /** Fly an image from one element to another; onArrive fires at the end. */
  function fly(from, to, image, { duration = .62, size = 44, onArrive } = {}) {
    if (reduced()) { onArrive?.(); return; }
    const [x0, y0] = center(from), [x1, y1] = Array.isArray(to) ? to : center(to);
    flights.push({ x0, y0, x1, y1, image, size, life: 0, ttl: duration, onArrive, done: false });
    stats.flights++;
    ensure();
  }
  function shake(el, strength = 6, ms = 260) {
    if (reduced() || !el?.animate) return;
    stats.shakes++;
    const frames = [];
    for (let i = 0; i <= 8; i++) {
      const k = 1 - i / 8, s = strength * k;
      frames.push({ transform: `translate(${(i % 2 ? -1 : 1) * s}px, ${(i % 3 ? 1 : -1) * s * .35}px)` });
    }
    frames.push({ transform: 'translate(0,0)' });
    el.animate(frames, { duration: ms, easing: 'ease-out' });
  }
  function bounce(el, peak = 1.14, ms = 320) {
    if (reduced() || !el?.animate) return;
    el.animate([{ scale: '1' }, { scale: `${peak} ${2 - peak}`, offset: .3 }, { scale: `${2 - peak * .96} ${peak * .96}`, offset: .6 }, { scale: '1' }], { duration: ms, easing: 'ease-out' });
  }
  function pulse(el, color = '#ffd86b') {
    if (reduced() || !el?.animate) return;
    el.animate([{ boxShadow: `0 0 0 0 ${color}00` }, { boxShadow: `0 0 0 10px ${color}aa`, offset: .35 }, { boxShadow: `0 0 0 22px ${color}00` }], { duration: 560, easing: 'ease-out' });
  }
  function sprite(name, x, y, w, h = w) {
    const img = name === 'ribbon-tint' ? null : sprites[name];
    if (img && !ready(name)) return false;
    ctx.drawImage(img, x, y, w, h); stats.spriteDraws++;
    return true;
  }

  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    // Glow flares and light rays sit under the particles and add light (hot overlapping cores).
    for (let i = flares.length - 1; i >= 0; i--) {
      const f = flares[i]; f.life += dt;
      if (f.life >= f.ttl) { flares.splice(i, 1); continue; }
      const u = f.life / f.ttl, env = u < .18 ? u / .18 : 1 - Math.pow((u - .18) / .82, 1.4);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(f.x, f.y);
      if (f.rays && ready('rays')) {
        const s = f.size * (1.1 + .25 * u); ctx.globalAlpha = f.alpha * .7 * env; ctx.rotate(f.spin + u * 1.1);
        sprite('rays', -s / 2, -s / 2, s); ctx.rotate(-(f.spin + u * 1.1));
      }
      if (f.core && ready('glow')) { const s = f.size * (.55 + .45 * Math.min(1, u * 3)); ctx.globalAlpha = f.alpha * env; sprite('glow', -s / 2, -s / 2, s); }
      ctx.restore();
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life += dt;
      if (p.life >= p.ttl) { particles.splice(i, 1); continue; }
      p.vx -= p.vx * p.drag * dt; p.vy += p.gravity * dt - p.vy * p.drag * dt * .5;
      p.x += p.vx * dt; p.y += p.vy * dt; p.spin += dt * 5;
      const u = p.life / p.ttl, alpha = u < .7 ? 1 : 1 - (u - .7) / .3;
      ctx.globalAlpha = alpha; ctx.fillStyle = p.color;
      ctx.save(); ctx.translate(p.x, p.y);
      if (p.kind === 'ribbon') {
        p.x += Math.sin(now / 240 + p.phase) * 50 * dt;
        const img = tints[p.tint];
        ctx.rotate(Math.sin(p.spin * .7 + p.phase) * .9); ctx.scale(Math.cos(p.spin * 1.3) * .85 + .15 * Math.sign(Math.cos(p.spin * 1.3) || 1), 1);
        if (img) { const h = p.size, w = h * img.width / img.height; ctx.drawImage(img, -w / 2, -h / 2, w, h); stats.spriteDraws++; }
        else ctx.fillRect(-p.size * .12, -p.size / 2, p.size * .24, p.size);
      } else if (p.kind === 'confetti') {
        p.x += Math.sin(now / 200 + p.phase) * 40 * dt;
        ctx.rotate(p.spin); ctx.scale(1, Math.cos(p.spin * 1.7) * .9 + .1); ctx.fillRect(-p.size / 2, -p.size * .3, p.size, p.size * .6);
      } else if (p.kind === 'sparkle') {
        const s = p.size * (.8 + .35 * Math.sin(now / 60 + p.spin));
        ctx.rotate(p.spin * .3); ctx.globalCompositeOperation = 'lighter';
        if (!sprite('star', -s / 2, -s / 2, s)) {
          const r = s / 2.2; ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.lineTo(0, -r); ctx.lineTo(r * .35, -r * .35); ctx.rotate(Math.PI / 2); } ctx.closePath(); ctx.fill();
        }
      } else if (p.kind === 'heart') {
        const s = p.size; ctx.beginPath(); ctx.moveTo(0, s * .6); ctx.bezierCurveTo(-s * 1.3, -s * .4, -s * .4, -s * 1.2, 0, -s * .4); ctx.bezierCurveTo(s * .4, -s * 1.2, s * 1.3, -s * .4, 0, s * .6); ctx.fill();
      } else {
        const s = p.size * (.7 + .6 * u); ctx.globalAlpha = alpha * .8;
        if (!sprite('dust', -s / 2, -s * .4, s, s * .8)) { ctx.beginPath(); ctx.arc(0, 0, s * .2, 0, 7); ctx.fill(); }
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (let i = labels.length - 1; i >= 0; i--) {
      const l = labels[i]; l.life += dt;
      if (l.life >= l.ttl) { labels.splice(i, 1); continue; }
      const u = l.life / l.ttl, ease = 1 - Math.pow(1 - u, 3), scale = u < .18 ? .6 + u / .18 * .55 : 1.15 - (u - .18) * .18;
      ctx.save(); ctx.translate(l.x, l.y - ease * l.up); ctx.scale(scale, scale);
      ctx.globalAlpha = u < .75 ? 1 : 1 - (u - .75) / .25;
      ctx.font = `800 ${l.size}px "Microsoft YaHei","PingFang SC",system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = '#fff8e6'; ctx.lineJoin = 'round'; ctx.strokeText(l.text, 0, 0);
      ctx.fillStyle = l.color; ctx.fillText(l.text, 0, 0); ctx.restore();
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]; f.life += dt;
      const u = Math.min(1, f.life / f.ttl), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(Math.PI * u) * 110;
      const s = f.size * (1 + .35 * Math.sin(Math.PI * u));
      // A soft glow trails the token so the flight reads as a light path, like the head games.
      if (ready('glow')) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55; sprite('glow', x - s, y - s, s * 2); ctx.restore(); }
      if (f.image?.naturalWidth) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(u * Math.PI * 2) * .25); ctx.shadowColor = '#00000055'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 6; ctx.drawImage(f.image, -s / 2, -s / 2, s, s); ctx.restore(); }
      if (u > .1) particles.push({ x, y: y + 4, vx: (Math.random() - .5) * 30, vy: 20, life: 0, ttl: .38, size: 10 + Math.random() * 6, color: '#ffe9a8', kind: 'sparkle', spin: Math.random() * 6, drag: 2, gravity: 40 });
      if (u >= 1) { flights.splice(i, 1); f.onArrive?.([f.x1, f.y1]); }
    }
    if (particles.length || labels.length || flights.length || flares.length) raf = requestAnimationFrame(tick);
    else { raf = null; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  return { burst, confetti, celebrate, label, fly, shake, bounce, pulse, center,
    stats: () => ({ ...stats, live: particles.length, flares: flares.length, spritesReady: Object.keys(sprites).filter(ready) }) };
}
