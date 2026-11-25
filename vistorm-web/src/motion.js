/* Vistorm Labs · movimiento de la landing (Lenis + GSAP ScrollTrigger) */
/* ===== Vistorm Labs · movimiento de la landing v3 =====
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

  /* ---------- 4 · puntos de personas sobre el shopping ---------- */
  var dotsSvg = $('#brk-dots'), brkDots = [];
  if (dotsSvg) {
    [[31, 57], [44, 62], [60, 53], [87, 51], [96, 38], [107, 45], [105, 83], [147, 61], [135, 50], [14, 16], [43, 20], [68, 25], [78, 27], [117, 26], [133, 24], [148, 20], [86, 64], [61, 72]].forEach(function (p, i) {
      var g = document.createElementNS(NS, 'g');
      var r = document.createElementNS(NS, 'circle'); r.setAttribute('cx', p[0]); r.setAttribute('cy', p[1]); r.setAttribute('r', 3.2); r.setAttribute('fill', 'none'); r.setAttribute('stroke', '#F4F2F1'); r.setAttribute('stroke-width', '.5'); r.setAttribute('opacity', '.7');
      var c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', 1.5); c.setAttribute('fill', i % 3 === 0 ? '#C1774B' : '#F4F2F1');
      g.appendChild(r); g.appendChild(c); dotsSvg.appendChild(g); brkDots.push(g);
    });
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

  /* ---------- 3 · anatomía: qué se ilumina en cada medición ---------- */
  var anaItems = $$('#ana-list li'), anaGroups = $$('.ov g'), anaChips = $$('.chip'), anaIdx = -1;
  function anaSet(i) {
    if (i === anaIdx) return; anaIdx = i;
    anaItems.forEach(function (li, k) { li.classList.toggle('on', k === i); });
    anaGroups.forEach(function (g) { g.classList.toggle('on', +g.dataset.g === i); });
    anaChips.forEach(function (c) { c.classList.toggle('on', +c.dataset.c === i); });
  }
  anaSet(0);

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

  /* ---------- 5 · panel: secciones que se recorren solas ---------- */
  var tabs = $$('.tab'), pane = $('#pane'), autoTabs = true, tabTween = null, auto = false;
  function stopAuto() { autoTabs = false; if (tabTween) tabTween.kill(); tabs.forEach(function (t) { var p = $('.prog', t); if (p) p.style.transform = 'scaleX(0)'; }); }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { if (!auto) stopAuto(); });
    t.addEventListener('keydown', stopAuto);
  });

  /* ---------- sin movimiento: estados finales y listo ---------- */
  if (!motion) {
    anaItems.forEach(function (li, k) { li.addEventListener('click', function () { anaSet(k); }); });
    $$('.brk__steps li').forEach(function (l) { l.classList.add('on'); });
    var sc = $('#brk-scene'); if (sc) sc.style.transform = 'rotateX(50deg) rotateZ(-30deg) scale(.8)';
    $$('.plane').forEach(function (p) { p.style.transform = 'translateZ(' + (+p.dataset.p * 70) + 'px)'; });
    $$('.brk__labels li').forEach(function (t) { t.style.opacity = 1; });
    var up = $('#brk-up'); if (up) up.style.opacity = 1;
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
    /* ---------- cinta: se inclina con la velocidad del scroll ---------- */
    var mq = $('.marquee__track');
    if (mq && lenis) {
      var skewTo = G.quickTo(mq, 'skewX', { duration: 0.6, ease: 'power3' });
      lenis.on('scroll', function (e) { skewTo(clamp(-e.velocity * 0.35, -8, 8)); });
    }
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
      mm.add('(min-width: 1001px)', function () {
        ST.create({ trigger: '.cmp__pin', start: 'top top', end: '+=210%', pin: true, scrub: 0.8, animation: cmpTl() });
      });
      mm.add('(max-width: 1000px)', function () {
        ST.create({ trigger: cmpMedia, start: 'top 85%', end: 'bottom 45%', scrub: 0.6, animation: cmpTl() });
      });
    }
  });

  later(function () {
    /* ---------- 2 · el problema: tres preguntas sobre el local ---------- */
    var hots = $$('[data-hot]'), probImg = $('#prob-media img');
    if (hots.length) {
      var probTl = function () {
        var tl = G.timeline();
        tl.fromTo(probImg, { scale: 1.1, rotate: -1.5 }, { scale: 1, rotate: 0, duration: 3, ease: 'none' }, 0);
        hots.forEach(function (h, i) {
          var at = 0.3 + i * 0.85;
          tl.fromTo($('.hot__dot', h), { scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' }, at)
            .fromTo($('.hot__card', h), { y: 26, opacity: 0, rotate: i % 2 ? 2.5 : -2.5 }, { y: 0, opacity: 1, rotate: 0, duration: 0.45, ease: 'back.out(1.4)' }, at + 0.3);
        });
        return tl;
      };
      mm.add('(min-width: 1001px)', function () {
        ST.create({ trigger: '.prob__pin', start: 'top top', end: '+=170%', pin: true, scrub: 0.8, animation: probTl() });
      });
      mm.add('(max-width: 1000px)', function () {
        ST.create({ trigger: '#prob-media', start: 'top 85%', end: 'bottom 40%', scrub: 0.6, animation: probTl() });
      });
    }
  });

  later(function () {
    /* ---------- 3 · anatomía de un local ---------- */
    var anaPin = $('#ana-pin');
    if (anaPin) {
      var anaImg = $('.ana__stage img');
      mm.add('(min-width: 1001px)', function () {
        var st = ST.create({ trigger: anaPin, start: 'top top', end: '+=420%', pin: true, scrub: 0.6,
          animation: G.fromTo(anaImg, { scale: 1.12, xPercent: -2 }, { scale: 1, xPercent: 0, ease: 'none' }),
          onUpdate: function (s) { anaSet(Math.min(7, Math.floor(s.progress * 8))); } });
        var onClick = function (e) { var k = +e.currentTarget.dataset.i; scrollToY(st.start + (k + 0.5) / 8 * (st.end - st.start)); };
        anaItems.forEach(function (li) { li.addEventListener('click', onClick); });
        return function () { anaItems.forEach(function (li) { li.removeEventListener('click', onClick); }); };
      });
      mm.add('(max-width: 1000px)', function () {
        var k = 0, timer = null, vis = false;
        var next = function () { k = (k + 1) % 8; anaSet(k); };
        var io = new IntersectionObserver(function (es) {
          vis = es[0].isIntersecting; clearInterval(timer); if (vis) timer = setInterval(next, 2600);
        }, { threshold: 0.4 });
        io.observe($('.ana__stage'));
        var onClick = function (e) { k = +e.currentTarget.dataset.i; anaSet(k); clearInterval(timer); };
        anaItems.forEach(function (li) { li.addEventListener('click', onClick); });
        return function () { io.disconnect(); clearInterval(timer); anaItems.forEach(function (li) { li.removeEventListener('click', onClick); }); };
      });
    }
  });

  later(function () {
    /* ---------- 4 · cómo funciona: la escena se desarma en capas y vuelve ---------- */
    var scene = $('#brk-scene');
    if (scene) {
      var planes = $$('.plane', scene), labels = $$('.brk__labels li'), bSteps = $$('#brk-steps li');
      var bV = $('#brk-v'), bUp = $('#brk-up'), bZ = $('#brk-z');
      var tilt = { k: 0 }, stepK = -1;
      var paintTilt = function () {
        var k = tilt.k;
        scene.style.transform = 'rotateX(' + (54 * k).toFixed(2) + 'deg) rotateZ(' + (-32 * k).toFixed(2) + 'deg) scale(' + (1 - 0.16 * k).toFixed(3) + ')';
      };
      var setStep = function (k) {
        if (k === stepK) return; stepK = k;
        bSteps.forEach(function (s, i) { s.classList.toggle('on', i === k); });
        if (bV) { bV.textContent = k === 3 ? '1.461' : '1.248'; bZ.textContent = k === 3 ? 'Vidriera nueva' : 'Escalera mecánica'; bUp.style.opacity = k === 3 ? 1 : 0; }
      };
      G.set(planes.slice(1), { opacity: 0 });
      // los puntos solo se mueven mientras la sección está a la vista
    var dotsTl = G.timeline({ paused: true });
    brkDots.forEach(function (d, i) { dotsTl.to(d, { x: Math.sin(i * 1.3) * 3, y: Math.cos(i * 0.9) * 2, duration: 2.2 + (i % 4) * 0.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0); });
    ST.create({ trigger: '.brk', start: 'top bottom', end: 'bottom top', onToggle: function (st) { if (st.isActive) dotsTl.play(); else dotsTl.pause(); } });
      var brkTl = function (zk) {
        zk = zk || 1;
        var tl = G.timeline({ onUpdate: paintTilt });
        tl.to(tilt, { k: 1, duration: 1, ease: 'power2.inOut' }, 0)
          .fromTo(planes[1], { opacity: 0, z: 0 }, { opacity: 1, z: 90 * zk, duration: 0.7, ease: 'power2.out' }, 0.9)
          .fromTo(brkDots, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.35, stagger: 0.02, ease: 'back.out(2)' }, 1.0)
          .fromTo(planes[2], { opacity: 0, z: 0 }, { opacity: 1, z: 180 * zk, duration: 0.7, ease: 'power2.out' }, 1.6)
          .fromTo(planes[3], { opacity: 0, z: 0 }, { opacity: 1, z: 290 * zk, duration: 0.7, ease: 'back.out(1.2)' }, 2.2)
          .fromTo(labels[3], { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out' }, 0.55)
          .fromTo(labels[2], { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out' }, 1.1)
          .fromTo(labels[1], { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out' }, 1.7)
          .fromTo(labels[0], { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out' }, 2.3)
          .to({}, { duration: 0.5 })
          // vuelve todo a su lugar: queda la escena y, encima, el resultado
          .to(labels, { opacity: 0, x: 24, duration: 0.3, stagger: 0.04 }, 3.4)
          .to(tilt, { k: 0, duration: 0.8, ease: 'power3.inOut' }, 3.4)
          .to(planes[1], { z: 0, opacity: 0.85, duration: 0.8, ease: 'power3.inOut' }, 3.4)
          .to(planes[2], { z: 0, opacity: 0.55, duration: 0.8, ease: 'power3.inOut' }, 3.4)
          .to(planes[3], { z: 40 * zk, duration: 0.8, ease: 'back.out(1.3)' }, 3.4)
          .to({}, { duration: 0.6 });
        return tl;
      };
      mm.add('(min-width: 1001px)', function () {
        ST.create({ trigger: '#brk-pin', start: 'top top', end: '+=320%', pin: true, scrub: 0.8, animation: brkTl(),
          onUpdate: function (s) { var p = s.progress; setStep(p < 0.2 ? 0 : p < 0.45 ? 1 : p < 0.72 ? 2 : 3); } });
      });
      mm.add('(max-width: 1000px)', function () {
        bSteps.forEach(function (s) { s.classList.add('on'); }); stepK = 9;
        ST.create({ trigger: '.brk__stage', start: 'top 85%', end: 'bottom 15%', scrub: 0.6, animation: brkTl(window.innerWidth <= 640 ? 0.4 : 0.7),
          onUpdate: function (s) { if (bUp) bUp.style.opacity = s.progress > 0.8 ? 1 : 0; } });
      });
    }
  });

  later(function () {
    /* ---------- 5 · el panel gira y queda de frente ---------- */
    var dev = $('#device');
    if (dev) {
      G.fromTo(dev, { rotateX: 32, y: 90, scale: 0.88 }, { rotateX: 0, y: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: '.device-wrap', start: 'top 98%', end: 'top 22%', scrub: 0.7 } });
      $$('[data-float]').forEach(function (f) {
        G.fromTo(f, { y: 140, opacity: 0, rotate: -3 }, { y: +f.dataset.float, opacity: 1, rotate: 0, ease: 'none', scrollTrigger: { trigger: '.device-wrap', start: 'top 85%', end: 'bottom 30%', scrub: 0.9 } });
      });
      // cada cambio de sección entra en cascada
      var animPane = function () {
        var kids = $$('#pane > div > *');
        G.fromTo(kids, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.06, clearProps: 'transform,opacity' });
        var bars = $$('#pane .chart rect');
        if (bars.length) G.from(bars, { scaleY: 0, transformOrigin: '50% 100%', duration: 0.7, ease: 'power3.out', stagger: 0.015, delay: 0.1 });
        var fb = $$('#pane .ft i, #pane .opp__p');
        if (fb.length) G.from(fb, { scaleX: 0, transformOrigin: '0 50%', duration: 0.8, ease: 'power3.out', stagger: 0.08, delay: 0.1 });
        var cells = $$('#pane .week td');
        if (cells.length) G.from(cells, { scale: 0.2, opacity: 0, duration: 0.4, ease: 'back.out(1.6)', stagger: { each: 0.004, from: 'start' } });
      };
      if (pane && 'MutationObserver' in window) new MutationObserver(animPane).observe(pane, { childList: true });
      // recorrido automático de las secciones mientras el panel está a la vista
      var cur = 0;
      var cycle = function () {
        if (!autoTabs) return;
        var bar = $('.prog', tabs[cur]);
        tabTween = G.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 5, ease: 'none', onComplete: function () {
          bar.style.transform = 'scaleX(0)'; if (!autoTabs) return;
          cur = (cur + 1) % tabs.length; auto = true; tabs[cur].click(); auto = false; cycle();
        } });
      };
      ST.create({ trigger: dev, start: 'top 60%', end: 'bottom top', onEnter: function () { if (autoTabs && !tabTween) cycle(); },
        onLeave: function () { if (tabTween) tabTween.pause(); }, onEnterBack: function () { if (tabTween && autoTabs) tabTween.resume(); }, onLeaveBack: function () { if (tabTween) tabTween.pause(); } });
      var nav = $('.panelx__nav'); if (nav) nav.addEventListener('pointerdown', stopAuto);
    }
  });

  later(function () {
    /* ---------- 6 · privacidad ---------- */
    if (pc) {
      mm.add('(min-width: 1001px)', function () {
        ST.create({ trigger: '#priv-pin', start: 'top top', end: '+=150%', pin: true, scrub: 0.6, onUpdate: function (s) { privP = s.progress; } });
      });
      mm.add('(max-width: 1000px)', function () {
        ST.create({ trigger: '.priv__canvas', start: 'top 85%', end: 'bottom 25%', scrub: 0.6, onUpdate: function (s) { privP = s.progress; } });
      });
      G.from('.promises li', { y: 50, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1, scrollTrigger: { trigger: '.promises', start: 'top 85%' } });
    }
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
