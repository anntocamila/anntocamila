/* Vistorm Labs · movimiento de la landing (Lenis + GSAP ScrollTrigger) */
/* ===== Vistorm Labs · movimiento de la landing v5 =====
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
    /* ---------- 1 · qué medimos: cada tarjeta dibuja su propia medición ---------- */
    var cards = $$('.mcard');
    if (!cards.length) return;
    var draw = function (el) { var L = el.getTotalLength ? el.getTotalLength() : 300; return [{ strokeDasharray: L + ' ' + L, strokeDashoffset: L }, { strokeDashoffset: 0 }]; };
    var build = function (c) {
      var tl = G.timeline({ paused: true });
      var b = $$('.a-bars rect', c); if (b.length) tl.fromTo(b, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.6, ease: 'back.out(1.4)', stagger: 0.05 }, 0);
      var hb = $$('.a-hbars rect', c); if (hb.length) tl.fromTo(hb, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.7, ease: 'power3.out', stagger: 0.12 }, 0);
      ['.a-path', '.a-timer', '.a-line'].forEach(function (sel, k) {
        var p = $(sel, c); if (!p) return; var dd = draw(p);
        tl.fromTo(p, dd[0], Object.assign(dd[1], { duration: k === 1 ? 0.9 : 1.1, ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset' }), 0);
      });
      var fo = $('.a-fore', c); if (fo) tl.fromTo(fo, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' }, 0.9);
      var end = $('.a-end', c); if (end) tl.fromTo(end, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.35, ease: 'back.out(2)' }, 1);
      var tp = $$('.a-topo ellipse', c); if (tp.length) tl.fromTo(tp, { scale: 0.2, transformOrigin: '50% 50%', opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.3)', stagger: 0.07 }, 0);
      var arc = $('.a-arc', c); if (arc) tl.fromTo(arc, { attr: { 'stroke-dasharray': '0 264' } }, { attr: { 'stroke-dasharray': '190 264' }, duration: 1, ease: 'power2.inOut' }, 0);
      var hand = $('.a-hand', c); if (hand) tl.fromTo(hand, { rotation: 0, svgOrigin: '120 72' }, { rotation: 260, svgOrigin: '120 72', duration: 1, ease: 'power2.inOut' }, 0);
      var q = $$('.a-queue circle', c); if (q.length) tl.fromTo(q, { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.08 }, 0);
      return tl;
    };
    cards.forEach(function (c) {
      var tl = build(c); tl.progress(0);
      ST.create({ trigger: c, start: 'top 85%', once: true, onEnter: function () { tl.play(0); } });
      // al pasar el mouse, la tarjeta vuelve a dibujar su medición
      if (hover) c.addEventListener('pointerenter', function () { if (!tl.isActive()) tl.play(0); });
    });
    G.from(cards, { y: 60, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07, scrollTrigger: { trigger: '#mcards', start: 'top 88%' } });
  });

  later(function () {
    /* ---------- 2 · el panel gira y queda de frente; cada sección entra en cascada ---------- */
    var dev = $('#device');
    if (!dev || !P) return;
    G.fromTo(dev, { rotateX: 26, y: 80, scale: 0.9 }, { rotateX: 0, y: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: '.device-wrap', start: 'top 98%', end: 'top 28%', scrub: 0.7 } });
    var animView = function () {
      var v = $('#sw-view'); if (!v) return;
      G.fromTo(v.children, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.06, clearProps: 'transform,opacity' });
      var br = $$('.ic__chart .bar', v);
      if (br.length) G.from(br, { scaleY: 0, transformOrigin: '50% 100%', duration: 0.7, ease: 'power3.out', stagger: 0.025, delay: 0.12 });
      var tk = $$('.ic__chart .tickp', v);
      if (tk.length) G.from(tk, { opacity: 0, y: 8, duration: 0.4, ease: 'power2.out', stagger: 0.025, delay: 0.45 });
      var hb = $$('.ic__chart .hbar', v);
      if (hb.length) G.from(hb, { scaleX: 0, transformOrigin: '0 50%', duration: 0.8, ease: 'power3.out', stagger: 0.06, delay: 0.12 });
      var db = $$('.ic__chart .db', v);
      if (db.length) G.from(db, { opacity: 0, x: -14, duration: 0.5, ease: 'power3.out', stagger: 0.06, delay: 0.12 });
      var zn = $$('.ic__chart .zone', v);
      if (zn.length) G.from(zn, { opacity: 0, duration: 0.5, ease: 'power2.out', stagger: 0.06, delay: 0.1 });
      var cells = $$('.hm td', v);
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
      onEnter: function () { if (window.innerWidth < 1101) { autoOn = false; animView(); return; } if (autoOn && !cycleTween) { animView(); next(); } },
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
        tl.fromTo($('.n', li), { scale: 0.6, backgroundColor: '#542433', color: '#F4F2F1' }, { scale: 1, backgroundColor: '#C1774B', color: '#272124', duration: 0.12, ease: 'back.out(2)' }, i / lis.length)
          .fromTo($('div', li), { x: 28 }, { x: 0, duration: 0.18, ease: 'power2.out' }, i / lis.length);
      });
    }
    /* la ilustración se mueve un poco más lento que la tarjeta */
    var hi = $('#how-img');
    if (hi) G.fromTo(hi, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: '.howcard', start: 'top bottom', end: 'bottom top', scrub: true } });
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
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; ST.refresh(); } }, 250); });
  window.addEventListener('load', function () { ST.refresh(); });
})();
