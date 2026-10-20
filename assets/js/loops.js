/* VITRINA STUDIO · loops.js
   Higgsfield section clips (<video data-src> with a poster): the file only loads when the
   clip comes near the screen, plays while visible and pauses when it scrolls away.
   With "reduce motion" switched on, visitors just see the poster image. */
(() => {
  'use strict';

  const videos = Array.from(document.querySelectorAll('video[data-src]'));
  if (!videos.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const start = (v) => {
    if (!v.src) { v.src = v.dataset.src; v.load(); }
    const p = v.play();
    if (p && p.catch) p.catch(() => {}); // autoplay refused (e.g. low-power mode): the poster stays
  };

  if (!('IntersectionObserver' in window)) { videos.forEach(start); return; }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(({ target: v, isIntersecting }) => (isIntersecting ? start(v) : v.pause()));
  }, { rootMargin: '200px 0px', threshold: 0.01 });

  videos.forEach((v) => {
    v.addEventListener('playing', () => v.classList.add('is-playing'), { once: true });
    io.observe(v);
  });

  /* gentle parallax on the step visuals */
  const media = Array.from(document.querySelectorAll('[data-parallax]'));
  if (!media.length) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = window.innerHeight;
    media.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const t = (r.top + r.height / 2 - vh / 2) / vh; // -0.5 … 0.5 while on screen
      el.style.setProperty('--py', (t * -28).toFixed(1) + 'px');
    });
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();
