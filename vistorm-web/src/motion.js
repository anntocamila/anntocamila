/* Vistorm Labs · movimiento de la landing (Lenis + GSAP ScrollTrigger) */
/* ===== Vistorm Labs · movimiento de la landing v4 =====
   Scroll suave (Lenis) + escenas guiadas por scroll (GSAP ScrollTrigger).
   Personalidad "premium": curvas suaves, nada lineal salvo el scrub, rebote de papel chico (3–5 %). */
(function () {
  'use strict';
  var fmt = new Intl.NumberFormat('es-AR');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var G = window.gsap, ST = window.ScrollTrigger;
  var motion = !!(G && ST) && !reduce;
  var hover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var smooth = function (x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  if (G && ST) G.registerPlugin(ST);
  if (!motion) document.documentElement.classList.add('is-reduced');

  /* ---------- scroll suave ---------- */
  var lenis = null;
  if (motion && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
    window.VistormLenis = lenis;
    lenis.on('scroll', ST.update);
    G.ticker.add(function (t) { lenis.raf(t * 1000); });
    G.ticker.lagSmoothing(0);
  }
  function scrollToY(y) { if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }); }

  /* ---------- enlaces a la demo ---------- */
  $$('a[data-go]').forEach(function (a) { a.addEventListener('click', function (e) { if (window.VistormGoTo) window.VistormGoTo(e); }); });

  /* ---------- 1 · gente que camina hacia la vidriera nueva ---------- */
  var walk = $('#cmp-walk'), walkers = [], walkOn = false;
  if (walk) {
    var PATHS = [
      'M 905 470 C 830 468 760 440 712 338',
      'M 880 515 C 790 492 700 452 655 338',
      'M 640 520 C 660 470 700 420 768 338',
      'M -20 446 C 150 446 300 446 470 446',
    ];
    PATHS.forEach(function (d, i) {
      var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', 'none'); walk.appendChild(p);
      var len = p.getTotalLength();
      for (var k = 0; k < (i === 3 ? 2 : 3); k++) {
        var c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 6.5);
        c.setAttribute('fill', i === 3 ? '#F4F2F1' : '#C1774B'); c.setAttribute('stroke', i === 3 ? '#542433' : '#FBFAF9'); c.setAttribute('stroke-width', 2.5);
        walk.appendChild(c);
        walkers.push({ p: p, len: len, c: c, off: k / 3 + i * 0.17, sp: i === 3 ? 0.07 : 0.11 });
      }
    });
    var walkT0 = performance.now();
    var walkTick = function (now) {
      var t = (now - walkT0) / 1000;
      walkers.forEach(function (w) {
        var u = (t * w.sp + w.off) % 1, pt = w.p.getPointAtLength(u * w.len);
        w.c.setAttribute('cx', pt.x.toFixed(1)); w.c.setAttribute('cy', pt.y.toFixed(1));
        w.c.setAttribute('opacity', (Math.min(1, u * 6, (1 - u) * 6)).toFixed(2));
      });
      if (walkOn && !reduce) requestAnimationFrame(walkTick);
    };
    walkTick(walkT0 + 2600);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
      var was = walkOn; walkOn = es[0].isIntersecting; if (walkOn && !was && !reduce) requestAnimationFrame(walkTick);
    }).observe(walk);
  }

  /* ---------- 6 · privacidad: la imagen se vuelve puntos ---------- */
  var pc = $('#priv-canvas'), pn = $('#priv-n'), privP = motion ? 0 : 1, pctx, pw = 0, ph = 0, cells = [], pimg = null, privDirty = true;
  var PEOPLE = [[45, 350, 60, 170], [160, 350, 55, 160], [385, 360, 60, 180], [585, 340, 50, 150], [750, 330, 55, 150], [808, 320, 55, 170], [870, 340, 60, 190], [270, 380, 0, 0]];
  function buildCells() {
    if (!pc || !pimg) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    pw = pc.clientWidth; ph = pc.clientHeight; if (!pw || !ph) return;
    pc.width = Math.round(pw * dpr); pc.height = Math.round(ph * dpr);
    pctx = pc.getContext('2d'); pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var step = pw < 560 ? 7 : 9, cols = Math.ceil(pw / step), rows = Math.ceil(ph / step);
    var off = document.createElement('canvas'); off.width = cols; off.height = rows;
    var o = off.getContext('2d'); o.drawImage(pimg, 0, 0, cols, rows);
    var data = o.getImageData(0, 0, cols, rows).data;
    cells = [];
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      var i = (y * cols + x) * 4, lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      var ix = (x + 0.5) / cols * 900, iy = (y + 0.5) / rows * 507, hot = false;
      for (var k = 0; k < PEOPLE.length; k++) { var q = PEOPLE[k]; if (q[2] && Math.abs(ix - q[0]) < q[2] / 2 && iy > q[1] - q[3] / 2 && iy < q[1] + q[3] / 2) { hot = true; break; } }
      cells.push({ x: (x + 0.5) * step, y: (y + 0.5) * step, r: step * 0.5 * (0.18 + lum * 0.82), hot: hot });
    }
    privDirty = true;
  }
  function drawPriv(now) {
    if (!pctx || !pimg) return;
    var s = smooth((privP - 0.05) / 0.75), sx = s * (pw + 40) - 20;
    pctx.fillStyle = '#3A1823'; pctx.fillRect(0, 0, pw, ph);
    // a la derecha de la línea, el video; a la izquierda, solo puntos
    if (sx < pw) {
      pctx.save(); pctx.beginPath(); pctx.rect(Math.max(0, sx), 0, pw, ph); pctx.clip();
      pctx.drawImage(pimg, 0, 0, pw, ph);
      pctx.fillStyle = 'rgba(58,24,35,' + (0.25 * s).toFixed(3) + ')'; pctx.fillRect(0, 0, pw, ph);
      pctx.restore();
    }
    var pulse = 0.5 + 0.5 * Math.sin((now || 0) / 380);
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i]; if (c.x > sx) continue;
      var age = clamp((sx - c.x) / 160, 0, 1);
      pctx.fillStyle = c.hot && age > 0.6 ? '#C1774B' : '#E6DFD7';
      pctx.globalAlpha = c.hot ? 1 : 0.55 + 0.35 * age;
      var r = c.hot && age > 0.6 ? c.r * (1.05 + 0.25 * pulse) : c.r * (0.6 + 0.4 * age);
      pctx.beginPath(); pctx.arc(c.x, c.y, Math.max(0.4, r), 0, 6.283); pctx.fill();
    }
    pctx.globalAlpha = 1;
    if (s > 0 && s < 1) {
      var gr = pctx.createLinearGradient(sx - 60, 0, sx + 2, 0);
      gr.addColorStop(0, 'rgba(193,119,75,0)'); gr.addColorStop(1, 'rgba(193,119,75,.55)');
      pctx.fillStyle = gr; pctx.fillRect(sx - 60, 0, 62, ph);
      pctx.fillStyle = '#C1774B'; pctx.fillRect(sx, 0, 2.5, ph);
    }
    if (pn) pn.textContent = fmt.format(Math.round(1248 * s));
  }
  var privVis = false;
  function privLoop(now) { drawPriv(now); if (privVis && motion) requestAnimationFrame(privLoop); }
  if (pc) {
    pimg = new Image(); pimg.decoding = 'async';
    pimg.onload = function () { buildCells(); drawPriv(0); };
    pimg.src = pc.dataset.src;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
      var was = privVis; privVis = es[0].isIntersecting; if (privVis && !was && motion) requestAnimationFrame(privLoop);
    }).observe(pc);
  }

  /* ---------- 7 · tarjetas que se abren con resorte ---------- */
  var kiln = $$('.kiln__card');
  function kOpen(card) {
    kiln.forEach(function (c) { var on = c === card; c.classList.toggle('is-open', on); c.setAttribute('aria-expanded', on); });
  }
  kiln.forEach(function (c) {
    c.addEventListener('click', function () { kOpen(c); });
    c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kOpen(c); } });
    c.addEventListener('focus', function () { kOpen(c); });
    if (hover) c.addEventListener('pointerenter', function () { kOpen(c); });
  });
  // con ?rubro= en el enlace, la tarjeta de ese rubro aparece abierta
  (function () {
    var al = { ropa: 'tienda', moda: 'tienda', retail: 'tienda', gastronomia: 'bar', restaurante: 'bar', restaurantes: 'bar', hotel: 'aeropuerto', hoteles: 'aeropuerto', shoppings: 'shopping', aeropuertos: 'aeropuerto', transporte: 'aeropuerto', universidad: 'aeropuerto', universidades: 'aeropuerto' };
    var q = ''; try { q = (new URLSearchParams(location.search).get('rubro') || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    q = al[q] || q;
    var card = kiln.filter(function (c) { return c.dataset.rubro === q; })[0];
    if (card) kOpen(card);
  })();


  /* ---------- panel: recorre sus secciones solo mientras está a la vista ---------- */
  var P = window.VistormPanel, sw = $('#sw'), autoOn = !!P, cycleTween = null, ORDER = ['atencion', 'hoy', 'hacer', 'salon', 'resultados'], ci = 0;
  function stopAuto() { autoOn = false; if (cycleTween) cycleTween.kill(); $$('.sw__prog').forEach(function (p) { p.style.transform = 'scaleX(0)'; }); }
  if (sw) {
    sw.addEventListener('sw:view', function (e) { if (e.detail.user) stopAuto(); });
    sw.addEventListener('pointerdown', stopAuto);
    sw.addEventListener('keydown', stopAuto);
  }

  /* ---------- sin movimiento: estados finales y listo ---------- */
  if (!motion) {
    privP = 1;
    return;
  }

  var Q = [], mm = G.matchMedia();
  function later(f) { Q.push(f); }

  later(function () {
    /* ---------- títulos palabra por palabra ---------- */
    $$('.split').forEach(function (el) {
      var words = el.textContent.trim().split(/\s+/);
      el.setAttribute('aria-label', el.textContent.trim());
      el.innerHTML = words.map(function (w) { return '<span class="w" aria-hidden="true"><span>' + w + '</span></span>'; }).join(' ');
      G.from($$('.w > span', el), { yPercent: 115, rotate: 4, duration: 1.1, ease: 'power4.out', stagger: Math.min(0.06, 0.45 / words.length), scrollTrigger: { trigger: el, start: 'top 86%' } });
    });
    ST.batch('[data-reveal]', { start: 'top 88%', once: true, onEnter: function (b) { G.from(b, { y: 44, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.1 }); } });
  });

  later(function () {
    /* ---------- botones con imán ---------- */
    if (hover) $$('.btn').forEach(function (b) {
      var xTo = G.quickTo(b, 'x', { duration: 0.5, ease: 'power3' }), yTo = G.quickTo(b, 'y', { duration: 0.5, ease: 'power3' });
      b.addEventListener('pointermove', function (e) { var r = b.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.22); yTo((e.clientY - r.top - r.height / 2) * 0.3); });
      b.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
  });

  later(function () {
    /* ---------- 1 · la vidriera: de tarjeta a pantalla completa ---------- */
    var cmpMedia = $('#cmp-media');
    if (cmpMedia) {
      var cImg = $('#cmp-frame'), tagA = $('.cmp__tag--a', cmpMedia), tagB = $('.cmp__tag--b', cmpMedia), stamp = $('.cmp__stamp', cmpMedia);
      var nA = $('b', tagA), nB = $('b', tagB), cnt = { a: 0, b: 0 };
      var paintCnt = function () { nA.textContent = fmt.format(Math.round(cnt.a)); nB.textContent = fmt.format(Math.round(cnt.b)); };
      var cmpTl = function () {
        var tl = G.timeline();
        tl.fromTo(cmpMedia, { clipPath: 'inset(16% 26% 16% 26% round 28px)' }, { clipPath: 'inset(0% 0% 0% 0% round 18px)', duration: 1.2, ease: 'power2.inOut' }, 0)
          .fromTo(cImg, { scale: 1.35 }, { scale: 1, duration: 1.4, ease: 'power2.out' }, 0)
          .fromTo('#cmp-walk', { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.9)
          .fromTo(tagA, { y: 70, opacity: 0, rotate: -3 }, { y: 0, opacity: 1, rotate: 0, duration: 0.5, ease: 'back.out(1.3)' }, 1.0)
          .fromTo(cnt, { a: 0 }, { a: 1022, duration: 0.6, ease: 'power2.out', onUpdate: paintCnt }, 1.0)
          .fromTo(tagB, { y: 70, opacity: 0, rotate: 3 }, { y: 0, opacity: 1, rotate: 0, duration: 0.5, ease: 'back.out(1.3)' }, 1.35)
          .fromTo(cnt, { b: 0 }, { b: 1197, duration: 0.6, ease: 'power2.out', onUpdate: paintCnt, immediateRender: false }, 1.35)
          .fromTo(stamp, { scale: 0.3, rotate: -22, opacity: 0 }, { scale: 1, rotate: -4, opacity: 1, duration: 0.55, ease: 'back.out(1.6)' }, 1.85)
          .to({}, { duration: 0.4 });
        return tl;
      };
      ST.create({ trigger: cmpMedia, start: 'top 88%', end: 'bottom 55%', scrub: 0.7, animation: cmpTl() });
    }
  });

  later(function () {
    /* ---------- 2 · el panel gira y queda de frente; cada sección entra en cascada ---------- */
    var dev = $('#device');
    if (!dev || !P) return;
    G.fromTo(dev, { rotateX: 26, y: 80, scale: 0.9 }, { rotateX: 0, y: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: '.device-wrap', start: 'top 98%', end: 'top 28%', scrub: 0.7 } });
    var animView = function () {
      var v = $('#sw-view'); if (!v) return;
      G.fromTo(v.children, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.06, clearProps: 'transform,opacity' });
      var br = $$('.sw__chart rect, .sw__mini rect', v);
      if (br.length) G.from(br, { scaleY: 0, transformOrigin: '50% 100%', duration: 0.7, ease: 'power3.out', stagger: 0.012, delay: 0.12 });
      var hb = $$('.sw__split b, .sw__vs-row .bars i', v);
      if (hb.length) G.from(hb, { scaleX: 0, transformOrigin: '0 50%', duration: 0.8, ease: 'power3.out', stagger: 0.06, delay: 0.12 });
      var arc = $$('.sw__ring-arc', v);
      arc.forEach(function (a) { var full = a.getAttribute('stroke-dasharray'); G.from(a, { attr: { 'stroke-dasharray': '0 ' + full.split(' ')[1] }, duration: 0.9, ease: 'power3.out', delay: 0.15 }); });
      var cells = $$('.sw__week td', v);
      if (cells.length) G.from(cells, { scale: 0.2, opacity: 0, duration: 0.35, ease: 'back.out(1.6)', stagger: 0.004 });
    };
    sw.addEventListener('sw:view', animView);
    // recorrido automático: 5 s por sección, con una barrita de progreso en la que está activa
    var next = function () {
      if (!autoOn) return;
      var cur = P.current(), btn = P.items.filter(function (b) { return b.dataset.view === cur; })[0], bar = btn && $('.sw__prog', btn);
      if (!bar) return;
      cycleTween = G.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 5, ease: 'none', onComplete: function () {
        bar.style.transform = 'scaleX(0)'; if (!autoOn) return;
        ci = (ORDER.indexOf(cur) + 1) % ORDER.length; P.show(ORDER[ci]); next();
      } });
    };
    ST.create({ trigger: dev, start: 'top 65%', end: 'bottom top',
      onEnter: function () { if (autoOn && !cycleTween) { animView(); next(); } },
      onLeave: function () { if (cycleTween) cycleTween.pause(); }, onEnterBack: function () { if (cycleTween && autoOn) cycleTween.resume(); }, onLeaveBack: function () { if (cycleTween) cycleTween.pause(); } });
    // qué medimos: los ocho ítems entran en cascada al abrirse
    var md = $('.metrics-detail');
    if (md) md.addEventListener('toggle', function () { if (md.open) G.from($$('dl > div', md), { y: 18, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.05 }); });
  });

  later(function () {
    /* ---------- 4 · cómo funciona: la línea baja y cada paso se enciende ---------- */
    var st = $('#steps4');
    if (st) {
      var rail = document.createElement('span'); rail.className = 'rail'; rail.setAttribute('aria-hidden', 'true'); st.appendChild(rail);
      var lis = $$('li', st);
      var tl = G.timeline({ scrollTrigger: { trigger: st, start: 'top 75%', end: 'bottom 55%', scrub: 0.6 } });
      tl.fromTo(rail, { scaleY: 0 }, { scaleY: 1, ease: 'none', duration: 1 }, 0);
      lis.forEach(function (li, i) {
        tl.fromTo($('.n', li), { scale: 0.6, backgroundColor: '#FBFAF9', color: '#542433' }, { scale: 1, backgroundColor: '#542433', color: '#F4F2F1', duration: 0.12, ease: 'back.out(2)' }, i / lis.length)
          .fromTo($('div', li), { x: 28 }, { x: 0, duration: 0.18, ease: 'power2.out' }, i / lis.length);
      });
    }
    /* privacidad: la línea cobre convierte la vidriera en puntos mientras la tarjeta pasa */
    if (pc) ST.create({ trigger: '.privcard', start: 'top 85%', end: 'center 35%', scrub: 0.6, onUpdate: function (s) { privP = s.progress; } });
    var pcard = $('.privcard');
    if (pcard) G.from($$('.privcard li', pcard), { x: 24, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.1, scrollTrigger: { trigger: pcard, start: 'top 60%' } });
  });

  later(function () {
    /* ---------- 7 · tarjetas: entran en abanico ---------- */
    if (kiln.length) G.from(kiln, { y: 90, opacity: 0, rotate: function (i) { return (i - 2) * 1.5; }, duration: 1.1, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: '#kiln', start: 'top 85%' } });
  });

  later(function () {
    /* ---------- cierre: la imagen se mueve más lento que la página ---------- */
    var cImgBg = $('#close-img');
    if (cImgBg) G.fromTo(cImgBg, { yPercent: -8, scale: 1.12 }, { yPercent: 8, scale: 1, ease: 'none', scrollTrigger: { trigger: '.close', start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  (function run() { var f = Q.shift(); if (f) { f(); setTimeout(run, 0); } else ST.refresh(); })();

  var rz, lastW = window.innerWidth;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; buildCells(); } drawPriv(performance.now()); ST.refresh(); }, 250); });
  window.addEventListener('load', function () { ST.refresh(); });
})();
