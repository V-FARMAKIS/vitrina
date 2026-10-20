/* VITRINA STUDIO · scrolly.js
   Scroll-driven hero: a Higgsfield clip, exported as a WebP frame sequence
   (assets/media/hero/{d,m}/0001.webp …), is drawn to a canvas so the camera
   moves forward when you scroll down and rewinds when you scroll up.
   Text beats fade in and out at set points of the scroll (data-from / data-to, 0–1). */
(() => {
  'use strict';

  const root = document.querySelector('[data-scrolly]');
  if (!root) return;

  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const beats = Array.from(root.querySelectorAll('[data-from]'));
  const bar = root.querySelector('[data-scrolly-bar]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const sets = {
    d: { path: root.dataset.desktop, count: +root.dataset.desktopCount },
    m: { path: root.dataset.mobile, count: +root.dataset.mobileCount },
  };
  const pickSet = () => (window.innerWidth / window.innerHeight < 0.8 ? 'm' : 'd');

  /* Dwell: scroll progress → film progress through knots ("p:f, p:f, …", one list per set).
     Between two knots the camera eases out and in, so it all but stops while each line of
     text is on screen and travels in between. Without knots the film is linear. */
  const parseKnots = (v) => (v || '').split(',').map((k) => k.split(':').map(Number))
    .filter((k) => k.length === 2 && !k.some(Number.isNaN));
  const knots = { d: parseKnots(root.dataset.knots), m: parseKnots(root.dataset.knotsM || root.dataset.knots) };
  const film = (p) => {
    const k = knots[setKey];
    if (k.length < 2) return p;
    for (let i = 1; i < k.length; i += 1) {
      if (p <= k[i][0]) {
        const [p0, f0] = k[i - 1], [p1, f1] = k[i];
        const t = Math.min(1, Math.max(0, (p - p0) / ((p1 - p0) || 1)));
        return f0 + (f1 - f0) * t * t * (3 - 2 * t);
      }
    }
    return 1;
  };
  const src = (set, i) => `${sets[set].path}/${String(i + 1).padStart(4, '0')}.webp`;

  let setKey = pickSet();
  let frames = [];
  let target = 0;   // frame the scroll position asks for
  let shown = -1;   // frame currently on the canvas
  let current = 0;  // eased position between the two

  /* ---------- Loading: first frame now, last frame next, then the rest in order ---------- */
  function load(key) {
    const n = sets[key].count;
    const list = new Array(n);
    const order = [0, n - 1];
    for (let i = 1; i < n - 1; i++) order.push(i);
    let next = 0;
    const pump = () => {
      if (next >= order.length || key !== setKey) return;
      const i = order[next++];
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { list[i] = img; if (i === Math.round(current) || shown < 0) draw(true); pump(); };
      img.onerror = pump;
      img.src = src(key, i);
    };
    for (let k = 0; k < 4; k++) pump(); // a few requests in parallel
    return list;
  }

  /* nearest loaded frame, so the canvas never goes blank while frames stream in */
  function nearest(i) {
    if (frames[i]) return frames[i];
    for (let d = 1; d < frames.length; d++) {
      if (frames[i - d]) return frames[i - d];
      if (frames[i + d]) return frames[i + d];
    }
    return null;
  }

  /* ---------- Drawing (object-fit: cover) ---------- */
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    draw(true);
  }

  function draw(force) {
    const i = Math.round(current);
    if (!force && i === shown) return;
    const img = nearest(i);
    if (!img) return;
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    shown = i;
    if (!root.classList.contains('is-ready')) {
      root.classList.add('is-ready');
      window.dispatchEvent(new Event('vitrina:hero-ready')); // lifts the loading veil (motion.js)
    }
  }

  /* ---------- Scroll → progress → frame + text beats ---------- */
  function progress() {
    const r = root.getBoundingClientRect();
    // When the next block slides over the pinned stage (data-stacked), the film finishes one
    // screen early so the options are fully shown before anything covers them.
    const run = r.height - window.innerHeight * (root.hasAttribute('data-stacked') ? 2 : 1);
    return run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 1;
  }

  function update() {
    const p = progress();
    target = film(p) * (sets[setKey].count - 1);
    beats.forEach((el) => {
      const from = +el.dataset.from, to = +el.dataset.to, edge = 0.06;
      const fadeIn = from <= 0 ? 1 : (p - from) / edge;  // the first beat is already on at the top
      const fadeOut = to >= 1 ? 1 : (to - p) / edge;     // the last beat stays on at the end
      const o = Math.max(0, Math.min(1, fadeIn, fadeOut));
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translateY(${((1 - o) * 24).toFixed(1)}px)`;
      el.style.visibility = o > 0 ? 'visible' : 'hidden';
      // First time a line is properly on screen, motion.js builds its words in.
      if (o > 0.35 && !el.classList.contains('was-on')) {
        el.classList.add('was-on');
        window.dispatchEvent(new CustomEvent('vitrina:beat', { detail: el }));
      }
    });
    if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
    const last = beats[beats.length - 1];
    root.classList.toggle('at-end', !!last && p >= +last.dataset.from + 0.02);
  }

  let ticking = false;
  function loop() {
    current += (target - current) * 0.18; // a little easing makes scroll-wheel steps feel like a camera move
    if (Math.abs(target - current) < 0.01) current = target;
    draw(false);
    if (current !== target) requestAnimationFrame(loop);
    else ticking = false;
  }
  function onScroll() {
    update();
    if (!ticking) { ticking = true; requestAnimationFrame(loop); }
  }

  /* ---------- Reduced motion: one still (the last frame) and the final message ---------- */
  if (reduceMotion) {
    root.classList.add('is-static');
    frames = new Array(sets[setKey].count);
    const img = new Image();
    img.onload = () => { frames[frames.length - 1] = img; current = frames.length - 1; size(); };
    img.src = src(setKey, sets[setKey].count - 1);
    window.addEventListener('resize', size);
    return;
  }

  frames = load(setKey);
  size();
  update();
  current = target;
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    const k = pickSet();
    if (k !== setKey) { setKey = k; frames = load(k); shown = -1; }
    size();
    onScroll();
  });
})();
