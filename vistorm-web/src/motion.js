/* Vistorm Labs · movimiento de la landing (GSAP + ScrollTrigger) */
/* ===== Vistorm Labs · movimiento de la landing (GSAP + ScrollTrigger) ===== */
(function () {
  'use strict';
  var fmt = new Intl.NumberFormat('es-AR');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var G = window.gsap, ST = window.ScrollTrigger;
  var motion = !!(G && ST) && !reduce;
  var desk = function () { return window.innerWidth > 1000; };
  var phone = function () { return window.innerWidth <= 640; };
  if (G && ST) G.registerPlugin(ST);
  if (!motion) document.documentElement.classList.add('no-motion');

  /* ---------- escenas de cada rubro (motor del hero) y topografías ---------- */
  function topoSVG(seed) {
    var r = seed * 97.13, rand = function () { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    var cols = ['#6A3243', '#8E5E69', '#C7BCAC', '#E6DFD7', '#C1774B'];
    var s = '<svg class="topo" viewBox="0 0 440 280" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="440" height="280" fill="#4A1F2D"/>';
    for (var c = 0; c < 2 + seed % 2; c++) {
      var cx = 90 + rand() * 260, cy = 70 + rand() * 140, base = 120 + rand() * 60;
      for (var l = 0; l < 5; l++) {
        var k = 1 - l * 0.19, pts = [];
        for (var a = 0; a < 12; a++) {
          var ang = a / 12 * Math.PI * 2, rr = base * k * (0.8 + rand() * 0.35);
          pts.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.62]);
        }
        var mid = function (p, q) { return ((p[0] + q[0]) / 2).toFixed(1) + ' ' + ((p[1] + q[1]) / 2).toFixed(1); };
        var d = 'M' + mid(pts[pts.length - 1], pts[0]) + pts.map(function (p, i) { return ' Q' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ' ' + mid(p, pts[(i + 1) % pts.length]); }).join('') + 'Z';
        s += '<path d="' + d + '" fill="' + cols[l] + '" style="filter:drop-shadow(0 3px 3px rgba(20,6,12,.35))"/>';
      }
    }
    return s + '</svg>';
  }
  var arts = document.querySelectorAll('.rubro__art');
  function paintArt(el) {
    if (el.dataset.done) return; el.dataset.done = '1';
    if (el.dataset.topo) { el.innerHTML = topoSVG(+el.dataset.topo); return; }
    var c = document.createElement('canvas'), w = el.clientWidth || 440, h = el.clientHeight || 280;
    el.appendChild(c);
    var go = function () { if (window.VistormScene) window.VistormScene(c, el.dataset.scene, w, h); };
    (window.requestIdleCallback || setTimeout)(go);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { paintArt(e.target); io.unobserve(e.target); } }); }, { rootMargin: '600px 800px' });
    arts.forEach(function (a) { io.observe(a); });
  } else arts.forEach(paintArt);

  /* ---------- puntos del plano en capas ---------- */
  var dotsSvg = document.getElementById('iso-dots'), dots = [];
  if (dotsSvg) {
    var spots = [[52, 64], [48, 70], [57, 60], [44, 58], [60, 68], [74, 33], [70, 38], [28, 30], [36, 76], [64, 52], [82, 70], [55, 82], [40, 46]];
    spots.forEach(function (p, i) {
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', 1.8);
      c.setAttribute('fill', i % 4 === 0 ? '#542433' : '#FBFAF9'); c.setAttribute('stroke', '#542433'); c.setAttribute('stroke-width', '.5');
      dotsSvg.appendChild(c); dots.push(c);
    });
  }

  /* ---------- privacidad: siluetas que se vuelven puntos ---------- */
  var pc = document.getElementById('priv-canvas'), pn = document.getElementById('priv-n'), privP = reduce ? 1 : 0, crowd = [], pctx, pw = 0, ph = 0;
  function buildCrowd() {
    if (!pc) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    pw = pc.clientWidth; ph = pc.clientHeight; if (!pw || !ph) return;
    pc.width = Math.round(pw * dpr); pc.height = Math.round(ph * dpr);
    pctx = pc.getContext('2d'); pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    crowd = []; var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var narrow = pw < 760, x0 = narrow ? 0 : pw * 0.5, y0 = narrow ? ph * 0.6 : ph * 0.12, ww = narrow ? pw : pw * 0.48, hh = narrow ? ph * 0.36 : ph * 0.76;
    var n = narrow ? 70 : 150;
    for (var i = 0; i < n; i++) {
      var y = y0 + rnd() * hh, depth = (y - y0) / hh;
      crowd.push({ x: x0 + rnd() * ww, y: y, s: 0.75 + depth * 0.5, d: rnd() * 0.55, ph: rnd() * 6.28, sp: 0.4 + rnd() * 0.8, hot: rnd() < 0.16 });
    }
    crowd.sort(function (a, b) { return a.y - b.y; });
  }
  function drawCrowd(t) {
    if (!pctx) return;
    pctx.clearRect(0, 0, pw, ph);
    for (var i = 0; i < crowd.length; i++) {
      var c = crowd[i], m = Math.max(0, Math.min(1, (privP - c.d) / 0.35)), e = m * m * (3 - 2 * m);
      var sway = reduce ? 0 : Math.sin(t * 0.0012 * c.sp + c.ph) * 6 * (1 - e);
      var x = c.x + sway, y = c.y, s = c.s;
      var bw = 9 * s, bh = 24 * s * (1 - e) + 7 * s * e, hr = 4.6 * s * (1 - e);
      pctx.globalAlpha = 0.5 + 0.5 * e;
      pctx.fillStyle = e > 0.6 && c.hot ? '#C1774B' : '#F4F2F1';
      if (e < 0.98) {
        var r = bw / 2; pctx.beginPath();
        pctx.moveTo(x - r, y - bh + r); pctx.arc(x, y - bh + r, r, Math.PI, 0); pctx.lineTo(x + r, y - r); pctx.arc(x, y - r, r, 0, Math.PI); pctx.closePath(); pctx.fill();
        if (hr > 0.4) { pctx.beginPath(); pctx.arc(x, y - bh - 2 * s - hr, hr, 0, Math.PI * 2); pctx.fill(); }
      } else { pctx.beginPath(); pctx.arc(x, y - 3.5 * s, 3.6 * s, 0, Math.PI * 2); pctx.fill(); }
    }
    pctx.globalAlpha = 1;
    if (pn) pn.textContent = fmt.format(Math.round(1248 * Math.min(1, privP / 0.9)));
  }
  var privVisible = false;
  function privLoop(t) { drawCrowd(t); if (privVisible && !reduce) requestAnimationFrame(privLoop); }
  if (pc) {
    buildCrowd(); drawCrowd(0);
    new IntersectionObserver(function (es) { privVisible = es[0].isIntersecting; if (privVisible && !reduce) requestAnimationFrame(privLoop); }).observe(pc);
  }

  /* ---------- sin GSAP o con movimiento reducido: estados finales ---------- */
  if (!motion) {
    document.querySelectorAll('.tile').forEach(function (t) { t.classList.add('is-in'); });
    if (pc) { privP = 1; drawCrowd(0); }
    var tr = document.getElementById('who-track'); if (tr) { tr.style.width = 'auto'; tr.style.overflowX = 'auto'; tr.style.scrollSnapType = 'x mandatory'; }
    document.querySelectorAll('.layer').forEach(function (l) { l.style.transform = 'translateZ(' + (+l.dataset.z * 30) + 'px)'; });
    document.querySelectorAll('.steps li').forEach(function (l) { l.classList.add('on'); });
    return;
  }

  /* ---------- títulos palabra por palabra ---------- */
  document.querySelectorAll('.split').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map(function (w) { return '<span class="w" aria-hidden="true"><span>' + w + '</span></span>'; }).join(' ');
    G.from(el.querySelectorAll('.w > span'), { yPercent: 110, duration: 1, ease: 'power4.out', stagger: 0.06, scrollTrigger: { trigger: el, start: 'top 85%' } });
  });
  /* el problema: "casi nada" en cobre no; se mantiene el color de marca */

  /* ---------- revelados ---------- */
  ST.batch('[data-reveal]', { start: 'top 88%', once: true, onEnter: function (b) { G.from(b, { y: 48, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.12 }); } });

  /* ---------- contadores ---------- */
  document.querySelectorAll('[data-count]').forEach(function (el) {
    var end = +el.dataset.count, pre = el.dataset.prefix || '', o = { v: 0 };
    ST.create({ trigger: el, start: 'top 85%', once: true, onEnter: function () {
      G.to(o, { v: end, duration: 1.8, ease: 'power3.out', onUpdate: function () { el.textContent = pre + fmt.format(Math.round(o.v)); } });
    } });
  });

  /* ---------- barras del antes y después ---------- */
  var chart = document.getElementById('proof-chart');
  if (chart) ST.create({ trigger: chart, start: 'top 80%', once: true, onEnter: function () {
    G.from(chart.querySelectorAll('rect.before, rect.after'), { scaleY: 0, duration: 1, ease: 'power3.out', stagger: 0.05 });
  } });

  /* ---------- grilla de qué medimos ---------- */
  ST.batch('.tile', { start: 'top 85%', once: true, onEnter: function (b) {
    b.forEach(function (t) { t.classList.add('is-in'); });
    G.from(b, { y: 60, opacity: 0, rotateX: -8, transformPerspective: 900, duration: 1.1, ease: 'power3.out', stagger: 0.08 });
  } });
  if (window.matchMedia('(hover: hover)').matches) document.querySelectorAll('[data-tilt]').forEach(function (t) {
    t.addEventListener('pointermove', function (e) {
      var r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      G.to(t, { rotateY: x * 7, rotateX: -y * 7, transformPerspective: 900, duration: 0.5, ease: 'power2.out' });
    });
    t.addEventListener('pointerleave', function () { G.to(t, { rotateY: 0, rotateX: 0, duration: 0.7, ease: 'power3.out' }); });
  });

  /* ---------- cómo funciona: el local en capas ---------- */
  var iso = document.getElementById('iso');
  if (iso) {
    var layers = G.utils.toArray('.layer'), steps = G.utils.toArray('.steps li');
    var card = iso.querySelector('.layer--card'), heat = G.utils.toArray('.layer--heat'), dl = iso.querySelector('.layer--dots');
    var core = document.getElementById('iso-core'), isoV = document.getElementById('iso-v'), isoZ = document.getElementById('iso-z');
    G.set(layers, { z: function (i, l) { return +l.dataset.z * 3; } });
    G.set(heat, { opacity: 0 }); G.set(card, { opacity: 0 });
    dots.forEach(function (d, i) { G.to(d, { attr: { cx: '+=' + (Math.sin(i) * 6), cy: '+=' + (Math.cos(i * 1.7) * 5) }, duration: 2 + (i % 4) * 0.5, repeat: -1, yoyo: true, ease: 'sine.inOut' }); });
    var tl = G.timeline({ defaults: { ease: 'none' } });
    tl.to(iso, { rotateZ: -34, rotateX: 52, duration: 4 }, 0)
      .to(layers, { z: function (i, l) { return +l.dataset.z * 46; }, duration: 1.2 }, 0.8)
      .to(heat, { opacity: 1, duration: 0.8, stagger: 0.15 }, 1.0)
      .to(dl, { opacity: 0.25, duration: 0.6 }, 1.6)
      .to(card, { opacity: 1, z: '+=' + 40, duration: 0.8 }, 2.0)
      .to(core, { attr: { cx: 70, cy: 40 }, duration: 0.8 }, 3.0)
      .call(function () {}, null, 4);
    var setStep = function (p) {
      var k = p < 0.22 ? 0 : p < 0.48 ? 1 : p < 0.72 ? 2 : 3;
      steps.forEach(function (s, i) { s.classList.toggle('on', i === k); });
      if (isoV) { isoV.textContent = k === 3 ? '1.461' : '1.248'; isoZ.textContent = k === 3 ? 'Vidriera' : 'Mesa central'; }
    };
    ST.matchMedia({
      '(min-width: 1001px)': function () {
        ST.create({ trigger: '.how__pin', start: 'top top', end: '+=260%', pin: true, scrub: 0.6, animation: tl, onUpdate: function (s) { setStep(s.progress); } });
      },
      '(max-width: 1000px)': function () {
        steps.forEach(function (s) { s.classList.add('on'); });
        ST.create({ trigger: '.stage', start: 'top 80%', end: 'bottom 20%', scrub: 0.6, animation: tl });
      }
    });
  }

  /* ---------- el panel gira y queda de frente ---------- */
  var dev = document.getElementById('device');
  if (dev) {
    G.fromTo(dev, { rotateX: 30, y: 80, scale: 0.9 }, { rotateX: 0, y: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: '.device-wrap', start: 'top 95%', end: 'top 25%', scrub: 0.6 } });
    document.querySelectorAll('[data-float]').forEach(function (f) {
      G.fromTo(f, { y: 120, opacity: 0 }, { y: +f.dataset.float, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.device-wrap', start: 'top 85%', end: 'bottom 30%', scrub: 0.8 } });
    });
  }

  /* ---------- privacidad ---------- */
  if (pc) {
    var pinPriv = !phone();
    ST.create({ trigger: '.privacy__pin', start: pinPriv ? 'top top' : 'top 70%', end: pinPriv ? '+=140%' : 'bottom 30%', pin: pinPriv, scrub: 0.5,
      onUpdate: function (s) { privP = s.progress; if (reduce || !privVisible) drawCrowd(performance.now()); } });
  }

  /* ---------- para quién: recorrido horizontal ---------- */
  var track = document.getElementById('who-track'), bar = document.getElementById('who-bar');
  ST.matchMedia({
    '(min-width: 641px)': function () {
      if (!track) return;
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      G.to(track, { x: function () { return -dist(); }, ease: 'none', scrollTrigger: { trigger: '.who__pin', start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: 0.6, invalidateOnRefresh: true,
        onUpdate: function (s) { if (bar) bar.style.transform = 'scaleX(' + s.progress + ')'; } } });
    }
  });

  /* ---------- cierre: capas de papel ---------- */
  document.querySelectorAll('[data-par]').forEach(function (l) {
    G.fromTo(l, { y: 0 }, { y: +l.dataset.par, ease: 'none', scrollTrigger: { trigger: '.close', start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { buildCrowd(); drawCrowd(performance.now()); ST.refresh(); }, 250); });
  window.addEventListener('load', function () { ST.refresh(); });
})();
