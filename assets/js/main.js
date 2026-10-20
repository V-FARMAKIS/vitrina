/* VITRINA STUDIO · main.js */
(() => {
  'use strict';

  const C = window.VITRINA_CONFIG || {};
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clean = (s) => String(s || '').replace(/[^\d+]/g, '');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const WA_GREETING = 'Γεια σας! Θα ήθελα να μάθω για ένα site για την επιχείρησή μου.';

  /* ---------- Contact links from config ---------- */
  const hrefFor = {
    tel: () => C.phone && 'tel:' + clean(C.phone),
    whatsapp: () => C.whatsapp && 'https://wa.me/' + clean(C.whatsapp).replace('+', '') + '?text=' + encodeURIComponent(WA_GREETING),
    viber: () => C.viber && 'viber://chat?number=' + encodeURIComponent(clean(C.viber)),
    email: () => C.email && 'mailto:' + C.email,
    instagram: () => C.instagram,
    tiktok: () => C.tiktok,
    facebook: () => C.facebook,
  };

  $$('[data-contact]').forEach((el) => {
    const kind = el.dataset.contact;
    const href = hrefFor[kind] && hrefFor[kind]();
    if (href) {
      el.href = href;
      if (/^https?:/.test(href)) { el.target = '_blank'; el.rel = 'noopener'; }
    } else {
      el.classList.add('is-todo');
      el.title = 'Συμπλήρωσε το "' + kind + '" στο assets/js/config.js';
    }
  });

  $$('[data-contact-text]').forEach((el) => {
    const kind = el.dataset.contactText;
    const value = kind === 'tel' ? (C.phoneDisplay || C.phone) : C[kind];
    if (value) el.textContent = value;
    else el.classList.add('todo');
  });

  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Header shadow ---------- */
  const header = document.querySelector('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Reveal on scroll ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- "Open now" badges (Europe/Athens time) ---------- */
  const toMinutes = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const athensMinutes = () => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (t) => Number(parts.find((p) => p.type === t).value);
    return get('hour') * 60 + get('minute');
  };
  const updateBadges = () => {
    const now = athensMinutes();
    $$('[data-open-badge]').forEach((el) => {
      const open = el.dataset.open || '06:00';
      const close = el.dataset.close || '21:00';
      const isOpen = now >= toMinutes(open) && now < toMinutes(close);
      el.textContent = isOpen ? 'Ανοιχτά τώρα · ως ' + close : 'Κλειστά · ανοίγει ' + open;
      el.classList.toggle('is-closed', !isOpen);
    });
  };
  updateBadges();
  setInterval(updateBadges, 60000);

  /* ---------- Before / After slider ---------- */
  $$('[data-ba]').forEach((ba) => {
    const range = ba.querySelector('.ba__range');
    const set = (v) => {
      const pos = Math.max(0, Math.min(100, v));
      ba.style.setProperty('--pos', pos + '%');
      if (range) range.value = String(Math.round(pos));
    };
    const fromPointer = (e) => {
      const r = ba.getBoundingClientRect();
      return ((e.clientX - r.left) / r.width) * 100;
    };
    let dragging = false;
    let touched = false;
    ba.addEventListener('pointerdown', (e) => {
      dragging = true; touched = true;
      ba.setPointerCapture(e.pointerId);
      set(fromPointer(e));
    });
    ba.addEventListener('pointermove', (e) => { if (dragging) set(fromPointer(e)); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => ba.addEventListener(t, () => { dragging = false; }));
    if (range) range.addEventListener('input', () => { touched = true; set(Number(range.value)); });

    // One gentle "nudge" the first time the slider scrolls into view
    if (!reduceMotion && 'IntersectionObserver' in window) {
      const nudge = () => {
        const frames = [[50, 0], [28, 700], [72, 1500], [50, 2100]];
        const start = performance.now();
        const step = (t) => {
          if (touched) return;
          const el = t - start;
          let i = 0;
          while (i < frames.length - 1 && el > frames[i + 1][1]) i++;
          if (i >= frames.length - 1) { set(50); return; }
          const [a, ta] = frames[i];
          const [b, tb] = frames[i + 1];
          const k = (el - ta) / (tb - ta);
          const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          set(a + (b - a) * ease);
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };
      const io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) { io.disconnect(); setTimeout(nudge, 500); }
      }, { threshold: 0.5 });
      io.observe(ba);
    }
  });

  /* ---------- Optional hero video (Higgsfield) ---------- */
  const glass = document.querySelector('[data-hero-glass]');
  if (glass && C.heroVideo && !reduceMotion) {
    const v = document.createElement('video');
    v.className = 'window__video';
    v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
    v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.poster = 'assets/media/hero.jpg';
    v.innerHTML = '<source src="assets/media/hero.webm" type="video/webm"><source src="assets/media/hero.mp4" type="video/mp4">';
    v.addEventListener('loadeddata', () => v.classList.add('is-ready'), { once: true });
    glass.prepend(v);
  }

  /* ---------- Option buttons in the shop pre-select the service in the form ---------- */
  $$('[data-pick]').forEach((a) => a.addEventListener('click', () => {
    const sel = document.getElementById('f-service');
    if (sel) sel.value = a.dataset.pick;
  }));

  /* ---------- Demo request form → WhatsApp / Viber / Email ---------- */
  const form = document.querySelector('[data-demo-form]');
  if (form) {
    const status = form.querySelector('[data-form-status]');
    const say = (msg, isError) => {
      if (!status) return;
      status.textContent = msg;
      status.classList.toggle('is-error', Boolean(isError));
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        say('Συμπλήρωσε όνομα, τηλέφωνο και όνομα επιχείρησης.', true);
        return;
      }
      const via = (e.submitter && e.submitter.value) || 'whatsapp';
      const f = new FormData(form);
      const lines = [
        'Γεια σας! Θα ήθελα ένα δωρεάν demo.',
        'Με ενδιαφέρει: ' + (f.get('service') || '-'),
        'Όνομα: ' + f.get('name'),
        'Επιχείρηση: ' + f.get('business'),
        'Τηλέφωνο: ' + f.get('phone'),
        f.get('area') ? 'Περιοχή: ' + f.get('area') : '',
      ];
      if (f.get('link')) lines.push('Link: ' + f.get('link'));
      if (f.get('message')) lines.push('Μήνυμα: ' + f.get('message'));
      const text = lines.filter(Boolean).join('\n');

      if (via === 'email') {
        if (!C.email) return say('Λείπει το email στο config.js.', true);
        // mailto: alone silently does nothing on devices with no default mail app,
        // so offer Gmail on the web, the device's mail app, and copy-paste.
        const subject = 'Δωρεάν demo: ' + f.get('business');
        const q = (k, v) => k + '=' + encodeURIComponent(v);
        const gmail = 'https://mail.google.com/mail/?view=cm&fs=1&' + [q('to', C.email), q('su', subject), q('body', text)].join('&');
        const mailto = 'mailto:' + C.email + '?' + [q('subject', subject), q('body', text)].join('&');
        const box = form.querySelector('[data-send-options]');
        box.innerHTML = '';
        const add = (label, cls, onClick, href) => {
          const el = document.createElement(href ? 'a' : 'button');
          el.className = 'btn ' + cls;
          el.textContent = label;
          if (href) { el.href = href; if (/^https/.test(href)) { el.target = '_blank'; el.rel = 'noopener'; } }
          else el.type = 'button';
          if (onClick) el.addEventListener('click', onClick);
          box.appendChild(el);
          return el;
        };
        add('Άνοιγμα στο Gmail', 'btn--primary', () => say('Στο Gmail πάτα «Αποστολή» και τελειώσαμε.'), gmail);
        add('Άλλη εφαρμογή email', 'btn--ghost', () => say('Αν δεν άνοιξε τίποτα, διάλεξε Gmail ή αντιγραφή.'), mailto);
        const copyBtn = add('Αντιγραφή μηνύματος', 'btn--ghost', () => {
          const all = 'Προς: ' + C.email + '\nΘέμα: ' + subject + '\n\n' + text;
          const done = () => { copyBtn.textContent = 'Αντιγράφηκε ✓'; say('Επικόλλησέ το σε ένα email προς ' + C.email + '.'); };
          if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(all).then(done, () => window.prompt('Αντέγραψε το μήνυμα:', all));
          else window.prompt('Αντέγραψε το μήνυμα:', all);
        });
        box.hidden = false;
        say('Το μήνυμα είναι έτοιμο. Διάλεξε πώς θες να το στείλεις:');
        box.querySelector('a').focus();
      } else if (via === 'viber') {
        if (!C.viber) return say('Λείπει ο αριθμός Viber στο config.js.', true);
        const open = () => { window.location.href = 'viber://chat?number=' + encodeURIComponent(clean(C.viber)); };
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(open, open);
          say('Το μήνυμα αντιγράφηκε. Στο Viber κάνε επικόλληση και αποστολή.');
        } else {
          open();
          say('Άνοιξε το Viber. Γράψε μας το όνομα της επιχείρησής σου.');
        }
      } else {
        if (!C.whatsapp) return say('Λείπει ο αριθμός WhatsApp στο config.js.', true);
        window.open('https://wa.me/' + clean(C.whatsapp).replace('+', '') + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
        say('Άνοιξε το WhatsApp με έτοιμο μήνυμα. Πάτα «Αποστολή».');
      }
    });
  }
})();
