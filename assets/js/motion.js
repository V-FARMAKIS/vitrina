/* VITRINA STUDIO · motion.js
   The page's motion system, written by hand (Lenis is the only library):
   - one shared rAF ticker, and Lenis smooth scroll driven from it
   - a damped spring (react-spring's solver: tension, friction, mass 1, 1ms substeps)
   - text reveals: [data-split="words|letters"] — every unit springs from {0, 0.35em} to {1, 0}
   - block rises: [data-rise] — {0, 0.75rem} to {1, 0}
   - the loading veil, which lifts once the hero's first frame is drawn
   - the stack: the next block slides over the pinned hero, which shrinks to 0.9 and darkens
   - the chequered dissolve seams: <canvas data-cheq="dark|light">
   - contour backdrops (marching squares): <canvas data-contours="rgba(...)">
   - the "how it works" timeline: rail thread + turning marker, parallax layers, hover dim
   - the footer figure riding back into place as the page bottoms out
   Everything respects prefers-reduced-motion. */
(() => {
  'use strict';

  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The page opens behind the veil and always starts at the top (unless a link asked for a section).
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  /* ================= ticker ================= */
  const subs = new Set();
  let raf = 0;
  const loop = (t) => {
    for (const s of Array.from(subs)) {
      if (t - s.last > s.every) { s.last = t; s.cb(t); }
    }
    raf = subs.size ? requestAnimationFrame(loop) : 0;
  };
  const subscribe = (cb, every = 0) => {
    const s = { cb, every, last: -1e9 };
    subs.add(s);
    if (!raf) raf = requestAnimationFrame(loop);
    return () => subs.delete(s);
  };

  /* ================= spring ================= */
  const CFG = {
    REVEAL: [90, 26], ROW: [170, 24], FIGURE: [200, 24], TYPE: [210, 24], YEAR: [190, 24],
    COPY: [110, 26], COPY2: [150, 24], VEIL: [70, 24], CLEAR: [140, 26], SETTLE: [32, 26],
    PROGRESS_WAIT: [10, 30], PROGRESS_READY: [170, 26],
  };
  const springs = new Set();
  let springLoop = null;
  const stepSprings = (now) => {
    for (const s of Array.from(springs)) {
      if (now < s.startAt) continue;
      const dt = Math.min(64, now - (s.last || now)) || 16;
      s.last = now;
      for (let i = 0; i < dt; i += 1) {
        const force = -s.k * 0.000001 * (s.x - s.to);
        const damp = -s.c * 0.001 * s.v;
        s.v += force + damp;
        s.x += s.v;
      }
      if (Math.abs(s.x - s.to) < s.prec && Math.abs(s.v) < s.prec / 100) {
        s.x = s.to; s.v = 0; springs.delete(s);
        s.apply(s.x);
        if (s.onRest) s.onRest();
        continue;
      }
      s.apply(s.x);
    }
    if (!springs.size && springLoop) { springLoop(); springLoop = null; }
  };
  const spring = (from, cfg, apply, prec = 0.001) => ({
    x: from, v: 0, to: from, k: cfg[0], c: cfg[1], apply, prec, startAt: 0, last: 0,
  });
  const animate = (s, to, delay = 0) => {
    s.to = to;
    s.startAt = performance.now() + delay;
    s.last = 0;
    if (RM) { s.x = to; s.v = 0; s.apply(to); if (s.onRest) s.onRest(); return; }
    springs.add(s);
    if (!springLoop) springLoop = subscribe(stepSprings);
  };

  /* ================= Lenis ================= */
  let lenis = null;
  if (!RM) {
    import('https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.mjs').then(({ default: Lenis }) => {
      // Heavier than the default (lerp 0.1): the page glides and settles, so every block can be read.
      lenis = new Lenis({ smoothWheel: true, lerp: 0.065, wheelMultiplier: 0.8, touchMultiplier: 1 });
      window.vitrinaLenis = lenis; // handy from the console: vitrinaLenis.scrollTo(y, { immediate: true })
      document.documentElement.classList.add('lenis');
      subscribe((t) => lenis.raf(t));
    }).catch(() => { /* native scroll it is */ });
  }
  // In-page links glide with Lenis and still land under the sticky header.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || !lenis) return;
    const id = a.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    lenis.scrollTo(target, { offset: -margin, duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    history.replaceState(null, '', '#' + id);
  });

  /* ================= text engine ================= */
  const SR = 'sr-only';
  const splitUnits = (el, mode) => {
    const plain = el.textContent.replace(/\s+/g, ' ').trim();
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    visual.className = 'split';
    while (el.firstChild) visual.appendChild(el.firstChild);
    const units = [];
    const unit = (text, cls) => {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = text;
      units.push(s);
      return s;
    };
    const walk = (node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          // Split on ordinary whitespace only, so &nbsp; keeps its pair together.
          for (const part of child.textContent.split(/([ \t\r\n]+)/)) {
            if (!part) continue;
            if (/^[ \t\r\n]+$/.test(part)) { frag.append(' '); continue; }
            if (mode === 'letters') {
              const word = document.createElement('span');
              word.className = 'u-word';
              for (const ch of Array.from(part)) word.appendChild(unit(ch, 'u u--l'));
              frag.append(word);
            } else frag.append(unit(part, 'u u--w'));
          }
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.classList.contains('masthead__dot') && units.length) {
          // A closing full stop rides on the last word, so it can never wrap onto a line of its own.
          units[units.length - 1].appendChild(child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR' && child.tagName !== 'svg') walk(child);
      }
    };
    walk(visual);
    const sr = document.createElement('span');
    sr.className = SR;
    sr.textContent = plain;
    el.append(sr, visual);
    return units;
  };

  /** Each [data-split] / [data-rise] becomes a set of springs, played once when shown. */
  const reveals = [];
  const prepare = (el) => {
    const mode = el.dataset.split;
    const isRise = el.hasAttribute('data-rise');
    const cfg = CFG[el.dataset.cfg || (mode === 'letters' ? 'FIGURE' : isRise ? 'REVEAL' : 'REVEAL')];
    const stagger = +(el.dataset.stagger || (mode === 'letters' ? 26 : 110));
    const delay = +(el.dataset.delay || 0);
    const y = mode === 'letters' ? 0.3 : 0.35;
    const units = mode ? splitUnits(el, mode) : [el];
    const items = units.map((u, i) => {
      const s = spring(0, cfg, (p) => {
        u.style.opacity = p.toFixed(3);
        u.style.transform = isRise && !mode
          ? `translateY(${((1 - p) * 0.75).toFixed(3)}rem)`
          : `translateY(${((1 - p) * y).toFixed(3)}em)`;
      });
      s.apply(0);
      return { s, at: delay + i * stagger };
    });
    const r = { el, items, played: false, wait: el.dataset.wait || '' }; // '' | 'enter' (the veil) | 'beat' (a film line)
    // Optional settle: hold, then ease the block back to a resting opacity (timeline numbers).
    if (el.dataset.settle) {
      r.settle = spring(1, CFG.SETTLE, (v) => { el.style.opacity = v.toFixed(3); });
    }
    reveals.push(r);
    return r;
  };
  const play = (r) => {
    if (r.played) return;
    r.played = true;
    for (const { s, at } of r.items) animate(s, 1, at);
    if (r.settle) {
      const last = r.items.length ? r.items[r.items.length - 1].at : 0;
      animate(r.settle, +r.el.dataset.settle, last + 2200);
    }
  };

  const entered = { done: false };
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const r = reveals.find((x) => x.el === e.target);
          if (r && (!r.wait || (r.wait === 'enter' && entered.done))) { play(r); io.unobserve(e.target); }
        }
      }, { rootMargin: '0px 0px -14% 0px', threshold: 0.01 })
    : null;

  $$('[data-split], [data-rise]').forEach((el) => {
    const r = prepare(el);
    if (r.wait) return; // started by the veil
    if (io) io.observe(el); else play(r);
  });

  /* ================= the loading veil ================= */
  const veil = document.querySelector('[data-veil]');
  const enter = () => {
    if (entered.done) return;
    entered.done = true;
    document.documentElement.classList.add('is-entered');
    for (const r of reveals) if (r.wait === 'enter') play(r);
    window.dispatchEvent(new Event('vitrina:enter'));
  };
  if (!veil) enter();
  else {
    const fill = veil.querySelector('[data-veil-fill]');
    const meter = veil.querySelector('[data-veil-meter]');
    const content = veil.querySelector('[data-veil-content]');
    const name = veil.querySelector('[data-veil-name]');
    const setP = (p) => {
      fill.style.clipPath = `inset(0 0 ${((1 - p) * 100).toFixed(2)}% 0)`;
      meter.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    const progress = spring(0, CFG.PROGRESS_WAIT, setP);
    const nameIn = spring(0, CFG.COPY, (p) => {
      name.style.opacity = p; name.style.transform = `translateY(${(1 - p) * 0.6}rem)`;
    });
    nameIn.apply(0);
    animate(nameIn, 1, 260);
    animate(progress, 0.7);

    let ready = false;
    const finish = () => {
      if (ready) return;
      ready = true;
      veil.style.pointerEvents = 'none';
      veil.setAttribute('aria-label', 'Φορτώθηκε');
      progress.k = CFG.PROGRESS_READY[0]; progress.c = CFG.PROGRESS_READY[1];
      animate(progress, 1);
      // Beat 1: the veil's own content clears. Beat 2 (430 + 240 later): the veil lifts and the page enters.
      const clear = spring(1, CFG.CLEAR, (v) => {
        content.style.opacity = v; content.style.transform = `translateY(${(1 - v) * -0.75}rem)`;
        meter.parentNode.style.opacity = v;
      });
      animate(clear, 0, 120);
      setTimeout(() => {
        const lift = spring(1, CFG.VEIL, (v) => { veil.style.opacity = v; });
        animate(lift, 0);
        enter();
        const started = performance.now();
        const gone = () => {
          if (parseFloat(getComputedStyle(veil).opacity) <= 0.004 || performance.now() - started > 3000) {
            veil.remove();
          } else requestAnimationFrame(gone);
        };
        requestAnimationFrame(gone);
      }, 120 + 430 + 240);
    };
    window.addEventListener('vitrina:hero-ready', finish, { once: true });
    // Backstops: no hero on the page, or a very slow network.
    if (!document.querySelector('[data-scrolly]')) setTimeout(finish, 300);
    setTimeout(finish, 6000);
  }

  // A line of the hero film builds its words the first time it is properly on screen (scrolly.js).
  window.addEventListener('vitrina:beat', (e) => {
    for (const r of reveals) if (r.wait === 'beat' && e.detail.contains(r.el)) play(r);
  });

  /* ================= scroll triggers ================= */
  // progress of an element between two "<element edge>_<viewport edge>" positions
  const poses = (bb, vh) => ({
    top_top: bb.top, bottom_top: bb.bottom, top_bottom: bb.top - vh,
    bottom_bottom: bb.bottom - vh, top_center: bb.top - vh / 2,
    center_center: bb.top + bb.height / 2 - vh / 2, bottom_center: bb.bottom - vh / 2,
  });
  const progressOf = (el, start, end) => {
    const p = poses(el.getBoundingClientRect(), window.innerHeight);
    const a = p[start], b = p[end];
    const len = Math.abs(a - b) || 1;
    return clamp01(1 - (a + len) / len);
  };
  // Scroll readers run on one coalesced rAF, only while their element is (nearly) on screen.
  const readers = [];
  const visible = new WeakMap();
  const vio = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => { es.forEach((e) => visible.set(e.target, e.isIntersecting)); schedule(); }, { rootMargin: '25% 0px' })
    : null;
  const onScroll = (el, fn) => {
    readers.push({ el, fn });
    if (vio) vio.observe(el); else visible.set(el, true);
  };
  let scheduled = false;
  const runReaders = () => {
    scheduled = false;
    for (const r of readers) if (visible.get(r.el) !== false) r.fn();
  };
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(runReaders); } };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);

  /* ================= the stack: each pinned stage recedes as the next block covers it ================= */
  const phone = window.matchMedia('(max-width: 639px)');
  const pinned = [
    [document.querySelector('[data-scrolly] .scrolly__stage'), document.querySelector('[data-stack-next]')],
    [document.querySelector('[data-steps] .how__stage'), document.querySelector('#faq')],
  ].filter(([stage, next]) => stage && next);
  for (const [stage, next] of pinned) {
    const shade = document.createElement('div');
    shade.className = 'stack-shade';
    shade.setAttribute('aria-hidden', 'true');
    stage.appendChild(shade);
    const recede = () => {
      // 0 while the next block is a screen away, 1 once it has taken the whole viewport.
      const p = clamp01(1 - next.getBoundingClientRect().top / (window.innerHeight || 1));
      const shrink = phone.matches || RM ? 0 : 0.1;
      stage.style.transform = p > 0 && shrink ? `scale(${(1 - shrink * p).toFixed(4)})` : '';
      shade.style.opacity = (0.6 * p).toFixed(3);
      stage.style.visibility = p >= 1 ? 'hidden' : '';
    };
    readers.push({ el: next, fn: recede });
    recede();
  }

  /* ================= chequered dissolve ================= */
  const noise = (x, y) => {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  $$('canvas[data-cheq]').forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    const carry = canvas.dataset.cheq;
    const CELL = 24, SOLID = 0.16, LIFT = 2, ACCENT = 0.06;
    let last = -1;
    const render = (force) => {
      const p = RM ? 1 : progressOf(canvas, 'top_bottom', 'top_top');
      if (!force && Math.abs(p - last) < 0.002) return;
      last = p;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * ratio)) { canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const surface = token(carry === 'light' ? '--cream' : '--navy-900');
      const accent = token('--terra');
      const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL), lift = p * LIFT;
      for (let y = 0; y < rows; y += 1) {
        const depth = y / Math.max(1, rows - 1) + lift;
        if (depth > 1) break;
        const solid = depth <= SOLID;
        const fade = clamp01(1 - (depth - SOLID) / (1 - SOLID));
        if (!solid && fade <= 0) break;
        for (let x = 0; x < cols; x += 1) {
          if (!solid) {
            if ((x + y) % 2 !== 0) continue;
            if (noise(x, y) > fade) continue;
          }
          ctx.fillStyle = !solid && noise(x + 101, y + 57) < ACCENT ? accent : surface;
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
    };
    onScroll(canvas, () => render(false));
    window.addEventListener('resize', () => render(true));
    render(true);
  });

  /* ================= contour backdrops (marching squares) ================= */
  const field = (x, y, t) => {
    let f = Math.sin(x + t * 0.6) * 0.5;
    f += Math.sin(y * 0.85 - t * 0.45) * 0.45;
    f += Math.sin((x + y) * 0.65 + t * 0.35) * 0.35;
    f += Math.sin((x - y) * 0.95 - t * 0.55) * 0.25;
    return f * 0.5 + 0.5;
  };
  $$('canvas[data-contours]').forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    const colour = canvas.dataset.contours;
    const SCALE = 3.8, COUNT = 2.5, WAVE = 0.37, SPEED = 1.66, CELLS = 96;
    const start = performance.now();
    const draw = (now) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!width || !height) return;
      if (canvas.width !== Math.round(width * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const t = ((now - start) / 1000) * SPEED;
      const cols = width >= height ? CELLS : Math.max(8, Math.round((CELLS * width) / height));
      const rows = Math.max(8, Math.round((cols * height) / width));
      const sx = width / cols, sy = height / rows, aspect = width / height;
      const values = new Float32Array((cols + 1) * (rows + 1));
      for (let j = 0; j <= rows; j += 1) for (let i = 0; i <= cols; i += 1) {
        const nx = ((i / cols) * 2 - 1) * aspect * SCALE;
        const ny = ((j / rows) * 2 - 1) * SCALE;
        const qx = nx + Math.sin(ny * 0.8 + t * 0.7) * WAVE;
        const qy = ny + Math.cos(nx * 0.7 - t * 0.6) * WAVE;
        values[j * (cols + 1) + i] = field(qx, qy, t) * COUNT;
      }
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
      for (let level = 0.5; level < COUNT; level += 1) {
        for (let j = 0; j < rows; j += 1) for (let i = 0; i < cols; i += 1) {
          const a = values[j * (cols + 1) + i], b = values[j * (cols + 1) + i + 1];
          const c = values[(j + 1) * (cols + 1) + i + 1], d = values[(j + 1) * (cols + 1) + i];
          const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const x0 = i * sx, y0 = j * sy;
          const top = [x0 + sx * ((level - a) / (b - a)), y0];
          const right = [x0 + sx, y0 + sy * ((level - b) / (c - b))];
          const bottom = [x0 + sx * ((level - d) / (c - d)), y0 + sy];
          const left = [x0, y0 + sy * ((level - a) / (d - a))];
          switch (idx) {
            case 1: case 14: seg(left, bottom); break;
            case 2: case 13: seg(bottom, right); break;
            case 3: case 12: seg(left, right); break;
            case 4: case 11: seg(top, right); break;
            case 6: case 9: seg(top, bottom); break;
            case 7: case 8: seg(left, top); break;
            case 5: seg(left, top); seg(bottom, right); break;
            case 10: seg(left, bottom); seg(top, right); break;
            default: break;
          }
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    if (RM) { draw(performance.now()); return; }
    let stop = null;
    const cio = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !stop) stop = subscribe(draw, 24);
      else if (!e.isIntersecting && stop) { stop(); stop = null; }
    });
    cio.observe(canvas);
  });

  /* ================= HOW: one pinned scene, a step at a time ================= */
  const how = document.querySelector('[data-steps]');
  if (how) {
    const steps = $$('.how__step', how);
    const fills = $$('.how__fill', how);
    const ticks = $$('[data-tick]', how);
    const nowEl = how.querySelector('[data-step-now]');
    const bar = how.querySelector('[data-step-bar]');
    const rail = how.querySelector('.how__rail');
    const railSvg = rail.querySelector('svg');
    const thread = rail.querySelector('[data-thread]');
    const mark = rail.querySelector('[data-mark]');
    const videos = fills.map((f) => f.querySelector('video'));

    // Each step's words, and its big number, get their own springs.
    const words = steps.map((st) => $$('[data-step-split]', st).flatMap((el) => splitUnits(el, 'words'))
      .map((u) => {
        const sp = spring(0, CFG.COPY2, (v) => {
          u.style.opacity = v.toFixed(3);
          u.style.transform = `translateY(${((1 - v) * 0.45).toFixed(3)}em)`;
        });
        sp.apply(0);
        return sp;
      }));
    const nums = steps.map((st) => {
      const n = st.querySelector('.how__num');
      const sp = spring(0, CFG.YEAR, (v) => {
        n.style.opacity = v.toFixed(3);
        n.style.transform = `translateY(${((1 - v) * 0.2).toFixed(3)}em)`;
      });
      sp.apply(0);
      return sp;
    });
    // The photographs wipe up over one another; going back, they wipe down again.
    const wipes = fills.map((f, j) => {
      const v0 = j === 0 ? 1 : 0;
      const sp = spring(v0, [110, 26], (v) => {
        f.style.clipPath = `inset(${((1 - v) * 100).toFixed(2)}% 0 0 0)`;
        const vid = f.querySelector('video');
        if (vid) vid.style.transform = `scale(${(1.1 - 0.1 * v).toFixed(4)})`;
      });
      sp.apply(v0);
      return sp;
    });

    let active = -1;
    let inView = false;
    const syncVideos = () => videos.forEach((v, j) => {
      if (!v) return;
      if (j === active && inView && !RM) {
        if (!v.src) v.src = v.dataset.stepSrc;
        const pr = v.play();
        if (pr && pr.catch) pr.catch(() => {});
      } else if (!v.paused) v.pause();
    });
    const setActive = (i) => {
      if (i === active) return;
      active = i;
      steps.forEach((st, j) => {
        const on = j === i;
        st.classList.toggle('is-active', on);
        words[j].forEach((sp, k) => animate(sp, on ? 1 : 0, on ? 300 + k * 38 : 0));
        animate(nums[j], on ? 1 : 0, on ? 140 : 0);
      });
      wipes.forEach((sp, j) => { if (j > 0) animate(sp, i >= j ? 1 : 0); });
      ticks.forEach((t, j) => t.classList.toggle('is-on', j <= i));
      if (nowEl) nowEl.textContent = String(i + 1).padStart(2, '0');
      syncVideos();
    };

    let railH = 1;
    const measure = () => {
      railH = rail.clientHeight || 1;
      railSvg.setAttribute('viewBox', `0 0 16 ${railH}`);
      rail.querySelector('[data-track]').setAttribute('y2', railH);
    };
    const railSpring = spring(0, [170, 26], (v) => {
      const run = v * railH;
      thread.setAttribute('height', run.toFixed(1));
      mark.setAttribute('transform', `translate(8 ${run.toFixed(1)}) rotate(${(v * 1080).toFixed(1)})`);
      if (bar) bar.style.transform = `scaleX(${v.toFixed(4)})`;
    });

    const update = () => {
      const r = how.getBoundingClientRect();
      const vh = window.innerHeight;
      // Pinned from the moment the scene covers the screen until the next block starts to come up.
      const run = r.height - 2 * vh;
      const p = run > 0 ? clamp01(-r.top / run) : 0;
      animate(railSpring, p);
      setActive(p < 0.25 ? 0 : p < 0.75 ? 1 : 2);
    };
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; syncVideos(); }).observe(how);
    measure();
    window.addEventListener('resize', () => { measure(); update(); });
    readers.push({ el: how, fn: update });
    if (vio) vio.observe(how);
    update();
  }

  /* ================= FAQ: answers open and close on a spring ================= */
  $$('.faq details').forEach((d) => {
    const summary = d.querySelector('summary');
    const body = d.querySelector('.faq__a');
    if (!summary || !body) return;
    const sp = spring(d.open ? 1 : 0, [190, 26], (v) => {
      body.style.height = v >= 1 ? 'auto' : `${(v * body.scrollHeight).toFixed(1)}px`;
      body.style.opacity = Math.min(1, v * 1.4).toFixed(3);
    });
    sp.apply(sp.x);
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (d.open && sp.to === 1) {
        d.classList.remove('is-open');
        sp.onRest = () => { if (sp.to === 0) d.open = false; };
        if (sp.x >= 1) sp.x = 0.999; // leave height:auto so it can animate down
        animate(sp, 0);
      } else {
        d.open = true;
        d.classList.add('is-open');
        sp.onRest = null;
        animate(sp, 1);
      }
    });
  });

  /* ================= chapter guide ================= */
  const chapters = $$('[data-chapter]');
  if (chapters.length) {
    const targets = chapters.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
    let current = -1;
    const markChapter = () => {
      let idx = 0;
      targets.forEach((t, i) => { if (t && t.getBoundingClientRect().top <= window.innerHeight * 0.5) idx = i; });
      if (idx === current) return;
      current = idx;
      chapters.forEach((a, i) => a.classList.toggle('is-on', i === idx));
    };
    readers.push({ el: document.body, fn: markChapter });
    markChapter();
  }

  /* ================= the footer figure rides back into place ================= */
  const foot = document.querySelector('[data-foot]');
  const fig = document.querySelector('[data-foot-fig]');
  if (foot && fig && !RM) {
    const ride = () => {
      const p = progressOf(foot, 'top_bottom', 'bottom_bottom');
      fig.style.setProperty('--fy', `${((1 - p) * 60 * (foot.clientWidth / 1440)).toFixed(2)}px`);
    };
    onScroll(foot, ride);
    ride();
  }

  // Anything pinned to the very foot of the page can never cross the reveal line: at the bottom,
  // play whatever is on screen.
  window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) return;
    for (const r of reveals) {
      if (r.played || r.wait) continue;
      if (r.el.getBoundingClientRect().top < window.innerHeight) { play(r); if (io) io.unobserve(r.el); }
    }
  }, { passive: true });

  schedule();
})();
