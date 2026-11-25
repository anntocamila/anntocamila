/* Vistorm Labs · captura, panel de ejemplo y agendador */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var fmt = new Intl.NumberFormat('es-AR');
  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function txt(parent, x, y, s, attrs) { var t = el('text', Object.assign({ x: x, y: y }, attrs || {}), parent); t.textContent = s; return t; }

  /* ---------- enlaces «Pedí una demo» ---------- */
  document.querySelectorAll('a[data-go]').forEach(function (a) { a.addEventListener('click', function (e) { if (window.vsTrack) window.vsTrack('cta_click', { location: a.closest('section') ? a.closest('section').getAttribute('aria-labelledby') || 'hero' : 'hero' }); if (window.VistormGoTo) window.VistormGoTo(e); }); });

  /* ---------- captura antes y después ---------- */
  function drawProof() {
    var svg = document.getElementById('proof-chart'); if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var before = [138, 147, 171, 129, 142, 151, 144], after = [163, 170, 198, 152, 168, 175, 171];
    var days = ['J 5', 'V 6', 'S 7', 'D 8', 'L 9', 'M 10', 'M 11', 'J 12', 'V 13', 'S 14', 'D 15', 'L 16', 'M 17', 'M 18'];
    var W = Math.max(300, Math.min(720, Math.round(svg.getBoundingClientRect().width) || 720)), narrow = W < 520;
    var H = narrow ? 250 : 300, L = 36, R = 6, T = 34, B = 30, max = 200, pw = W - L - R, ph = H - T - B;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var y = function (v) { return T + ph - v / max * ph; };
    [0, 50, 100, 150, 200].forEach(function (v) { el('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }, svg); txt(svg, L - 8, y(v) + 4, v, { 'text-anchor': 'end' }); });
    var all = before.concat(after), step = pw / all.length, bw = step * 0.62;
    all.forEach(function (v, i) {
      var x = L + i * step + (step - bw) / 2;
      el('rect', { class: i < 7 ? 'before' : 'after', x: x, y: y(v), width: bw, height: y(0) - y(v), rx: 2 }, svg);
      txt(svg, x + bw / 2, H - 10, narrow ? days[i].split(' ')[1] : days[i], { 'text-anchor': 'middle' });
    });
    var mx = L + 7 * step;
    el('line', { class: 'mark', x1: mx, x2: mx, y1: 14, y2: y(0) }, svg);
    txt(svg, mx + 6, 20, narrow ? 'Vidriera nueva' : 'Vidriera nueva · jueves 12', { class: 'mark-label' });
    txt(svg, L + 3.5 * step, 20, 'Antes', { 'text-anchor': 'middle', fill: '#2F5D5A', 'font-weight': 600 });
  }
  drawProof();

  /* ---------- panel: cinco secciones ---------- */
  var HOURS = ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
  var TODAY = [42, 61, 88, 104, 97, 86, 101, 132, 168, 174, 121];
  var LASTWEEK = [38, 55, 80, 96, 92, 81, 94, 118, 149, 160, 112];
  var NOW_IDX = 8;
  function hourChart() {
    var W = Math.max(300, Math.min(680, (paneEl && paneEl.clientWidth ? paneEl.clientWidth - 48 : 640))), H = 200, L = 34, R = 6, T = 10, B = 26, max = 180, pw = W - L - R, ph = H - T - B;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'chart'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Visitas por hora hoy comparadas con el martes pasado; hoy van por encima en todas las horas.');
    var y = function (v) { return T + ph - v / max * ph; };
    [0, 60, 120, 180].forEach(function (v) { el('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }, svg); txt(svg, L - 6, y(v) + 4, v, { 'text-anchor': 'end' }); });
    var step = pw / HOURS.length, bw = step * 0.36;
    HOURS.forEach(function (hh, i) {
      var x0 = L + i * step + step / 2 - bw - 1;
      el('rect', { x: x0, y: y(LASTWEEK[i]), width: bw, height: y(0) - y(LASTWEEK[i]), rx: 2, fill: '#8FB5AE' }, svg);
      if (i <= NOW_IDX) el('rect', { x: x0 + bw + 2, y: y(TODAY[i]), width: bw, height: y(0) - y(TODAY[i]), rx: 2, fill: '#542433' }, svg);
      txt(svg, L + i * step + step / 2, H - 8, step < 40 ? hh : hh + ' h', { 'text-anchor': 'middle' });
    });
    return svg;
  }
  var OPPS = [
    { p: 64, u: 'personas', t: 'Sumá una persona en la caja de 18 a 20 h', d: 'Esta semana 64 personas esperaron más de 5 minutos en la fila en ese horario.' },
    { p: 312, u: 'personas', t: 'Pasá la mesa de novedades al pasillo izquierdo', d: '312 personas por día caminan por ese pasillo y no se detienen en ningún lado.' },
    { p: 1940, u: 'personas', t: 'Probá la vidriera de invierno el sábado', d: 'Los sábados pasan 1.940 personas por la vereda y hoy frena a mirar el 9 %.' },
  ];
  function pane(name) {
    var b = document.createElement('div'); b.style.display = 'grid'; b.style.gap = '22px';
    function bar(title, meta) { var d = document.createElement('div'); d.className = 'pbar'; d.innerHTML = '<h3>' + title + '</h3><span>' + meta + '</span>'; b.appendChild(d); }
    if (name === 'hoy') {
      bar('Hoy', 'Martes 24 de noviembre · actualizado 18:42');
      var k = document.createElement('div'); k.className = 'kpis';
      k.innerHTML =
        '<div class="kpi"><span class="kpi__l">Visitas hasta ahora</span><span class="kpi__v">1.248</span><span class="kpi__n"><b>8 % más</b> que ayer a esta hora</span></div>' +
        '<div class="kpi"><span class="kpi__l">Gente adentro ahora</span><span class="kpi__v">23</span><span class="kpi__n">Pico del día: 31 a las 18 h</span></div>' +
        '<div class="kpi"><span class="kpi__l">Contra el martes pasado</span><span class="kpi__v">+12 %</span><span class="kpi__n"><b>134 visitas más</b> a la misma hora</span></div>';
      b.appendChild(k);
      b.appendChild(hourChart());
      var lg = document.createElement('div'); lg.className = 'leg';
      lg.innerHTML = '<span><i style="background:#542433"></i>Hoy</span><span><i style="background:#8FB5AE"></i>Martes pasado</span>';
      b.appendChild(lg);
    } else if (name === 'hacer') {
      bar('Qué hacer', 'Ordenado por personas en juego');
      var ul = document.createElement('ul'); ul.className = 'opps';
      OPPS.forEach(function (o, i) {
        var li = document.createElement('li'); li.className = 'opp';
        li.innerHTML = '<span class="opp__p">' + fmt.format(o.p) + '<small>' + o.u + '</small></span><div><h4>' + o.t + '</h4><p>' + o.d + '</p></div>';
        var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn-s'; btn.setAttribute('aria-pressed', 'false'); btn.textContent = 'Probar y medir';
        btn.addEventListener('click', function () { var on = btn.getAttribute('aria-pressed') !== 'true'; btn.setAttribute('aria-pressed', on); btn.textContent = on ? 'Midiendo · día 1 de 14' : 'Probar y medir'; });
        li.appendChild(btn); ul.appendChild(li);
      });
      b.appendChild(ul);
    } else if (name === 'recorrido') {
      bar('Recorrido', 'Hoy, de 10 a 18:42 h');
      var steps = [['Pasan por la vereda', '', 3412], ['Entran', '37 % de los que pasan', 1248], ['Se quedan más de 5 minutos', '49 % de los que entran', 612], ['Son atendidos', '32 % de los que entran', 398]];
      var f = document.createElement('ul'); f.className = 'funnel';
      steps.forEach(function (s) {
        var li = document.createElement('li');
        li.innerHTML = '<span class="fl">' + s[0] + (s[1] ? '<small>' + s[1] + '</small>' : '') + '</span><span class="ft"><i style="width:' + (s[2] / 3412 * 100).toFixed(1) + '%"></i></span><span class="fv">' + fmt.format(s[2]) + '</span>';
        f.appendChild(li);
      });
      b.appendChild(f);
    } else if (name === 'local') {
      bar('El local', 'Tiempo acumulado por zona, hoy');
      var wrap = document.createElement('div'); wrap.className = 'plan';
      var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 400 280'); svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Plano del local: la caja y la mesa central concentran más tiempo; el fondo izquierdo queda frío.');
      el('rect', { x: 0, y: 0, width: 400, height: 280, fill: '#4A1F2D' }, svg);
      var Z = [
        { x: 16, y: 16, w: 170, h: 70, c: '#6A3243', n: 'Percheros', t: '#F4F2F1' },
        { x: 200, y: 16, w: 110, h: 70, c: '#8E5E69', n: 'Probadores', t: '#F4F2F1' },
        { x: 322, y: 16, w: 62, h: 120, c: '#C1774B', n: 'Caja', t: '#272124' },
        { x: 16, y: 100, w: 110, h: 164, c: '#4A1F2D', n: 'Fondo izq.', t: '#C7BCAC', stroke: true },
        { x: 140, y: 100, w: 170, h: 100, c: '#E6DFD7', n: 'Mesa central', t: '#272124' },
        { x: 140, y: 214, w: 170, h: 50, c: '#C7BCAC', n: 'Pasillo', t: '#272124' },
        { x: 322, y: 150, w: 62, h: 114, c: '#8E5E69', n: 'Entrada', t: '#F4F2F1' },
      ];
      Z.forEach(function (z) {
        el('rect', { x: z.x, y: z.y, width: z.w, height: z.h, rx: 6, fill: z.c, stroke: z.stroke ? '#8E5E69' : 'none', 'stroke-dasharray': z.stroke ? '4 4' : '' }, svg);
        txt(svg, z.x + 10, z.y + 20, z.n, { fill: z.t });
      });
      wrap.appendChild(svg);
      var side = document.createElement('div');
      side.innerHTML = '<ul class="zones">' +
        '<li><i style="background:#C1774B"></i><span>Caja · <b>saturada</b> de 18 a 20 h</span><b>24 %</b></li>' +
        '<li><i style="background:#E6DFD7;box-shadow:inset 0 0 0 1px #C7BCAC"></i><span>Mesa central</span><b>21 %</b></li>' +
        '<li><i style="background:#8E5E69"></i><span>Probadores</span><b>15 %</b></li>' +
        '<li><i style="background:#6A3243"></i><span>Percheros</span><b>11 %</b></li>' +
        '<li><i style="background:#4A1F2D;box-shadow:inset 0 0 0 1px #8E5E69"></i><span>Fondo izquierdo · <b>zona fría</b></span><b>3 %</b></li>' +
        '</ul><p class="kpi__l" style="margin-top:14px">Del piso vacío a donde más gente se detiene</p>' +
        '<div class="heatscale" aria-hidden="true"><i style="background:#4A1F2D"></i><i style="background:#6A3243"></i><i style="background:#8E5E69"></i><i style="background:#C7BCAC"></i><i style="background:#E6DFD7"></i><i style="background:#C1774B"></i></div>';
      wrap.appendChild(side);
      b.appendChild(wrap);
    } else if (name === 'planificar') {
      bar('Planificar', 'Semana típica · promedio de las últimas 4 semanas');
      var DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      var base = [0.25, 0.35, 0.5, 0.6, 0.55, 0.5, 0.55, 0.7, 0.9, 1, 0.75];
      var dayF = [0.62, 0.66, 0.7, 0.74, 0.9, 1, 0.55];
      var cols = ['#E6DFD7', '#C7BCAC', '#8E5E69', '#6A3243', '#C1774B'];
      var t = '<div class="week"><table><caption class="kpi__l" style="text-align:left;caption-side:bottom;padding-top:10px">Cada cuadro es una hora; más oscuro, más gente. Cobre: horas pico.</caption><thead><tr><th></th>' + HOURS.map(function (h) { return '<th scope="col">' + h + '</th>'; }).join('') + '</tr></thead><tbody>';
      DAYS.forEach(function (d, di) {
        t += '<tr><th scope="row">' + d + '</th>';
        base.forEach(function (bv, hi) {
          var v = bv * dayF[di], lvl = Math.min(4, Math.floor(v * 5));
          var n = Math.round(v * 180);
          t += '<td style="background:' + cols[lvl] + '" title="' + d + ' ' + HOURS[hi] + ' h · ' + n + ' visitas"></td>';
        });
        t += '</tr>';
      });
      t += '</tbody></table></div>';
      var wk = document.createElement('div'); wk.innerHTML = t; b.appendChild(wk);
      var st = document.createElement('p'); st.className = 'staff';
      st.innerHTML = 'Personal sugerido para el sábado: <b>3 personas en el salón y 2 en la caja de 17 a 20 h</b>; el resto del día, 2 y 1.';
      b.appendChild(st);
    }
    return b;
  }
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab')), paneEl = document.getElementById('pane');
  function select(tab, focus) {
    tabs.forEach(function (t) { var on = t === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
    paneEl.setAttribute('aria-labelledby', tab.id); paneEl.innerHTML = ''; paneEl.appendChild(pane(tab.dataset.tab));
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(t); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });
  if (tabs.length) select(tabs[0]);
  var rz, lastW = window.innerWidth;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (Math.abs(window.innerWidth - lastW) < 40) return; lastW = window.innerWidth; drawProof(); var cur = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0]; if (cur) select(cur); }, 200); });

  /* ---------- agendador ---------- */
  var cal = document.getElementById('cal'), slotsEl = document.getElementById('slots'), chosen = document.getElementById('chosen');
  var form = document.getElementById('sched-form'), err = document.getElementById('f-err'), done = document.getElementById('sched-done');
  var SLOTS = ['10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00'];
  var dayFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'short' }), longFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  var days = [], d = new Date(); d.setHours(12, 0, 0, 0);
  while (days.length < 10) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) days.push(new Date(d)); }
  var sel = { day: null, slot: null };
  function renderChosen() {
    chosen.innerHTML = sel.day && sel.slot ? 'Videollamada el <b>' + longFmt.format(sel.day) + ' a las ' + sel.slot + ' h</b>.' : (sel.day ? 'Elegí un horario para el ' + longFmt.format(sel.day) + '.' : 'Elegí un día y un horario.');
  }
  function renderSlots() {
    slotsEl.innerHTML = '';
    SLOTS.forEach(function (s, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'slot'; b.textContent = s;
      var busy = sel.day ? ((sel.day.getDate() * 7 + i * 3) % 5 === 0) : false;
      b.disabled = busy || !sel.day; if (busy) { b.classList.add('is-busy'); b.setAttribute('aria-label', s + ', ocupado'); }
      b.setAttribute('aria-pressed', sel.slot === s ? 'true' : 'false');
      b.addEventListener('click', function () { sel.slot = s; renderSlots(); renderChosen(); });
      slotsEl.appendChild(b);
    });
  }
  days.forEach(function (day) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'cal__day'; b.setAttribute('aria-pressed', 'false');
    var parts = longFmt.format(day);
    b.innerHTML = '<small>' + dayFmt.format(day).replace('.', '') + '</small><b>' + day.getDate() + '</b><span class="sr"> · ' + parts + '</span>';
    b.addEventListener('click', function () {
      sel.day = day; sel.slot = null;
      cal.querySelectorAll('.cal__day').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      renderSlots(); renderChosen();
    });
    cal.appendChild(b);
  });
  renderSlots(); renderChosen();
  var started = Date.now(), sendBtn = form.querySelector('button[type="submit"]');
  var FIELDS = { name: 'Escribí tu nombre.', company: 'Escribí el nombre de tu empresa.', mail: 'Revisá el mail: tiene que ser como nombre@empresa.com.' };
  function setErr(field, msg) {
    var input = form[field], box = document.getElementById('e-' + field);
    if (!input || !box) return;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false'); box.textContent = msg || ''; box.hidden = !msg;
  }
  function iso(day) { var m = day.getMonth() + 1, dd = day.getDate(); return day.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; }
  ['name', 'company', 'mail'].forEach(function (f) { form[f].addEventListener('input', function () { if (form[f].getAttribute('aria-invalid') === 'true') setErr(f, ''); }); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = { name: form.name.value.trim(), company: form.company.value.trim(), mail: form.mail.value.trim() };
    var bad = {};
    if (v.name.length < 2) bad.name = FIELDS.name;
    if (v.company.length < 2) bad.company = FIELDS.company;
    if (!/^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/.test(v.mail)) bad.mail = FIELDS.mail;
    ['name', 'company', 'mail'].forEach(function (f) { setErr(f, bad[f]); });
    var msg = !sel.day || !sel.slot ? 'Elegí un día y un horario para la videollamada.' : '';
    err.textContent = msg; err.hidden = !msg;
    var first = !sel.day ? cal.querySelector('.cal__day') : !sel.slot ? slotsEl.querySelector('.slot:not(:disabled)') : form[Object.keys(bad)[0]];
    if (msg || Object.keys(bad).length) { if (first) first.focus(); return; }
    sendBtn.disabled = true; sendBtn.textContent = 'Enviando…';
    var payload = { name: v.name, company: v.company, mail: v.mail, day: iso(sel.day), slot: sel.slot, website: form.website.value, elapsed: Date.now() - started };
    fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; }); })
      .then(function (o) {
        if (o.res.ok && o.data.ok) {
          document.getElementById('done-when').innerHTML = 'Videollamada el <b>' + longFmt.format(sel.day) + ' a las ' + sel.slot + ' h</b>.';
          form.hidden = true; done.hidden = false; done.setAttribute('tabindex', '-1'); done.focus();
          if (window.vsTrack) window.vsTrack('generate_lead', { form: 'demo' });
          return;
        }
        if (o.data.errors) { Object.keys(o.data.errors).forEach(function (f) { if (FIELDS[f]) setErr(f, o.data.errors[f]); else { err.textContent = o.data.errors[f]; err.hidden = false; } }); return; }
        err.textContent = o.data.message || 'No pudimos registrar tu pedido. Probá de nuevo o escribinos a hola@vistormlabs.com.'; err.hidden = false;
      })
      .catch(function () { err.textContent = 'No pudimos conectarnos. Probá de nuevo o escribinos a hola@vistormlabs.com.'; err.hidden = false; })
      .then(function () { sendBtn.disabled = false; sendBtn.textContent = 'Agendá una demo'; });
  });
  document.getElementById('sched-again').addEventListener('click', function () { done.hidden = true; form.hidden = false; sel.slot = null; renderSlots(); renderChosen(); });
})();

/* ===== Vistorm Labs · pop-up para pedir la demo ===== */
(function () {
  'use strict';
  var dlg = document.getElementById('demo-modal');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  var html = document.documentElement, last = null;
  var reduce = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  // la rueda del mouse dentro del pop-up la maneja el navegador, no el scroll suave de la página
  dlg.setAttribute('data-lenis-prevent', '');
  function open(from) {
    if (dlg.open) return;
    last = from || document.activeElement;
    dlg.classList.remove('is-closing');
    dlg.showModal();
    html.classList.add('modal-open');
    if (window.VistormLenis) window.VistormLenis.stop();
    dlg.scrollTop = 0;
    var first = dlg.querySelector('.cal__day:not([disabled])');
    if (first) first.focus();
    if (window.vsTrack) window.vsTrack('demo_open', {});
  }
  function finish() { if (!dlg.open) return; dlg.classList.remove('is-closing'); dlg.close(); }
  function close() {
    if (!dlg.open) return;
    if (reduce()) { finish(); return; }
    dlg.classList.add('is-closing');
    dlg.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 400);
  }
  dlg.addEventListener('close', function () {
    html.classList.remove('modal-open');
    if (window.VistormLenis) window.VistormLenis.start();
    if (last && last.focus) last.focus({ preventScroll: true });
  });
  // Esc cierra con la misma animación
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
  // tocar fuera de la tarjeta (el fondo oscuro) también cierra
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
  document.getElementById('dm-close').addEventListener('click', close);
  window.VistormOpenDemo = open;
  window.VistormCloseDemo = close;
})();

/* ===== Vistorm Labs · "Qué medimos": cuadros superpuestos, el activo se abre =====
   El cuadro no se agranda: se ensancha y la ilustración se recorta distinto. */
(function () {
  'use strict';
  var root = document.getElementById('spot'); if (!root) return;
  var items = Array.prototype.slice.call(root.querySelectorAll('.spot__item'));
  var dots = Array.prototype.slice.call(root.querySelectorAll('.spot__dot'));
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cur = 0, auto = true, timer = null, visible = false;
  if ('IntersectionObserver' in window) root.classList.add('pre');
  function set(i, focus) {
    cur = (i + items.length) % items.length;
    items.forEach(function (it, k) {
      var dist = Math.abs(k - cur), on = k === cur;
      it.classList.toggle('is-on', on);
      it.style.zIndex = 10 - dist;
      it.style.setProperty('--dist', dist);
      it.style.setProperty('--side', k < cur ? -1 : k > cur ? 1 : 0);
      var b = it.querySelector('.spot__frame'); b.setAttribute('aria-expanded', on);
      it.querySelector('.spot__cap').setAttribute('aria-hidden', !on);
    });
    dots.forEach(function (d, k) { d.setAttribute('aria-current', k === cur ? 'true' : 'false'); });
    if (focus) items[cur].querySelector('.spot__frame').focus({ preventScroll: true });
  }
  function stop() { auto = false; clearInterval(timer); }
  function play() { clearInterval(timer); if (auto && visible && !reduce) timer = setInterval(function () { set(cur + 1); }, 3800); }
  items.forEach(function (it, k) {
    var b = it.querySelector('.spot__frame');
    b.addEventListener('click', function () { stop(); set(k); });
    b.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); stop(); set(cur + d, true); }
    });
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) it.addEventListener('pointerenter', function () { stop(); set(k); });
  });
  dots.forEach(function (d, k) { d.addEventListener('click', function () { stop(); set(k); }); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
    visible = es[0].isIntersecting; root.classList.toggle('is-live', visible);
    if (visible) { root.classList.add('is-in'); play(); } else clearInterval(timer);
  }, { threshold: .3 }).observe(root);
  set(cur);
})();

/* ===== Vistorm Labs · "Vistorm en acción": un local de ejemplo, una vista por vez =====
   Arriba el hallazgo, debajo el gráfico. Cada franja, día o zona se puede elegir. Datos simulados. */
(function () {
  'use strict';
  var root = document.getElementById('vx'); if (!root) return;
  var view = document.getElementById('vx-view');
  var tabs = Array.prototype.slice.call(root.querySelectorAll('.vx__tab'));
  var fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
  var C = { burg: '#542433', ink: '#272124', cop: '#C1774B', lim: '#C7BCAC', paper: '#FCFBF8', line: '#D8D1C9', grid: '#E3DBD2', mut: '#655B5D', wash: '#F0E7DF', ante: '#9D9691', anteLine: '#AB9E95' };
  var HEAT = ['#EFEAE4', '#E2CBBA', '#D3A282', '#C1774B'];
  var SIM = 'Local de ejemplo · datos simulados';
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  var signed = function (n, u) { return (n > 0 ? '+' : n < 0 ? '−' : '') + fmt.format(Math.abs(n)) + (u || ''); };
  function T(x, y, s, o) { o = o || {}; return '<text x="' + x + '" y="' + y + '" font-size="' + (o.size || 12) + '"' + (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + ' fill="' + (o.fill || C.mut) + '"' + (o.bold ? ' font-weight="600"' : '') + '>' + esc(s) + '</text>'; }
  function act(i, label, sel, inside, box) {
    return '<g class="act" role="button" tabindex="0" data-i="' + i + '" aria-label="' + esc(label) + '" aria-pressed="' + (sel === i) + '">' +
      '<rect x="' + box[0] + '" y="' + box[1] + '" width="' + box[2] + '" height="' + box[3] + '" rx="3" fill="#000" fill-opacity="0"/>' + inside +
      '<rect class="ring" x="' + box[0] + '" y="' + box[1] + '" width="' + box[2] + '" height="' + box[3] + '" rx="3" fill="none" stroke="' + C.burg + '" stroke-width="2.5"/></g>';
  }
  function svg(w, h, label, body) { return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="group" aria-label="' + esc(label) + '">' + body + '</svg>'; }
  function legend(list) {
    return '<div class="ic__legend">' + list.map(function (l) {
      var mk = l.kind === 'tick' ? '<i class="tick" style="background:' + l.c + '"></i>' : l.kind === 'ring' ? '<i class="ring" style="border-color:' + l.c + '"></i>' : l.kind === 'dia' ? '<i class="dia" style="background:' + l.c + '"></i>' : '<i style="background:' + l.c + '"></i>';
      return '<span>' + mk + esc(l.t) + '</span>'; }).join('') + '</div>';
  }

  /* ---------- gráficos ---------- */
  // columnas: barras caliza, la destacada en cobre, la comparación como raya granate
  function columns(o, sel, W) {
    var H = 236, L = 40, R = 8, T0 = 14, B = 30, pw = W - L - R, ph = H - T0 - B;
    var y = function (v) { return T0 + ph - v / o.max * ph; };
    var s = '';
    o.ticks.forEach(function (v) { s += '<path d="M' + L + ' ' + y(v) + 'H' + (W - R) + '" stroke="' + C.grid + '"/>' + T(L - 8, y(v) + 4, fmt.format(v) + (o.tickUnit || ''), { anchor: 'end', size: 11 }); });
    var n = o.labels.length, step = pw / n, bw = Math.min(40, step * 0.56), narrow = step < 46;
    o.labels.forEach(function (lb, i) {
      var cx = L + i * step + step / 2, v = o.vals[i], p = o.prev ? o.prev[i] : null, on = sel === i || (sel == null && i === o.hi);
      var inner = '<rect class="bar" x="' + (cx - bw / 2) + '" y="' + y(v) + '" width="' + bw + '" height="' + Math.max(1, y(0) - y(v)) + '" fill="' + (i === o.hi ? C.cop : C.lim) + '"/>';
      if (p != null) inner += '<path class="tickp" d="M' + (cx - bw / 2 - 4) + ' ' + y(p) + 'H' + (cx + bw / 2 + 4) + '" stroke="' + C.burg + '" stroke-width="2.3"/>';
      inner += T(cx, H - 9, narrow ? lb.split('–')[0] : lb, { anchor: 'middle', size: narrow ? 11 : 12.5, fill: on ? C.ink : C.mut, bold: on });
      s += act(i, o.aria(i), sel, inner, [cx - step / 2 + 1, T0 - 6, step - 2, H - T0]);
    });
    return svg(W, H, o.label, s);
  }
  // filas horizontales con letra, como las zonas del local
  function rows(o, sel, W) {
    var rh = 42, H = o.items.length * rh + 34, L = Math.min(210, Math.max(152, W * 0.42)), R = 56, pw = W - L - R;
    var s = '', x = function (v) { return L + v / o.max * pw; };
    o.items.forEach(function (it, i) {
      var yy = i * rh, on = sel === i;
      var inner = (on ? '<rect x="0" y="' + (yy + 2) + '" width="' + W + '" height="' + (rh - 4) + '" rx="3" fill="' + C.wash + '"/>' : '') +
        (it.k ? T(10, yy + 26, it.k, { size: 11.5, bold: true }) : '') + T(it.k ? 32 : 10, yy + 26, it.label, { size: 14, fill: C.ink, bold: on }) +
        '<rect class="hbar" x="' + L + '" y="' + (yy + 13) + '" width="' + Math.max(2, x(it.v) - L) + '" height="16" fill="' + (on ? C.cop : C.lim) + '"/>' +
        T(x(it.v) + 8, yy + 26, fmt.format(it.v) + (o.unit || ''), { size: 14, fill: C.ink, bold: true });
      s += act(i, it.label + ', ' + fmt.format(it.v) + (o.unitLong || ''), sel, inner, [0, yy + 2, W, rh - 4]);
    });
    var by = o.items.length * rh + 6;
    s += '<path d="M' + L + ' ' + by + 'H' + (L + pw) + '" stroke="' + C.line + '"/>';
    o.ticks.forEach(function (v) { s += '<path d="M' + x(v) + ' ' + by + 'v5" stroke="' + C.line + '"/>' + T(x(v), by + 22, fmt.format(v) + (o.unit || ''), { anchor: 'middle', size: 11 }); });
    return svg(W, H, o.label, s);
  }
  // antes y después por día: círculo hueco (antes) y rombo cobre (después)
  function dumbbell(o, sel, W) {
    var rh = 30, T0 = 8, H = o.items.length * rh + T0 + 30, L = 52, R = 40, pw = W - L - R;
    var x = function (v) { return L + (v - o.min) / (o.max - o.min) * pw; };
    var s = '';
    o.ticks.forEach(function (v) { s += '<path d="M' + x(v) + ' ' + T0 + 'V' + (H - 26) + '" stroke="' + C.grid + '"/>' + T(x(v), H - 8, fmt.format(v), { anchor: 'middle', size: 11 }); });
    o.items.forEach(function (it, i) {
      var yy = T0 + i * rh + rh / 2, a = x(it[1]), d = x(it[2]), on = sel === i, up = it[2] >= it[1];
      var inner = (on ? '<rect x="0" y="' + (yy - 13) + '" width="' + W + '" height="26" rx="3" fill="' + C.wash + '"/>' : '') +
        T(8, yy + 4, it[0], { size: 13, fill: C.ink, bold: on }) +
        '<g class="db"><path d="M' + a + ' ' + yy + 'H' + d + '" stroke="' + C.anteLine + '" stroke-width="2"/>' +
        '<circle cx="' + a + '" cy="' + yy + '" r="5" fill="' + C.paper + '" stroke="' + C.ante + '" stroke-width="2"/>' +
        '<path d="M' + d + ' ' + (yy - 5.8) + 'l5.8 5.8-5.8 5.8-5.8-5.8z" fill="' + C.cop + '"/></g>' +
        T(up ? a - 9 : a + 9, yy + 4, fmt.format(it[1]), { size: 12, fill: C.ink, anchor: up ? 'end' : 'start' }) +
        T(up ? d + 9 : d - 9, yy + 4, fmt.format(it[2]), { size: 12, fill: C.ink, anchor: up ? 'start' : 'end' });
      s += act(i, it[0] + ', ' + it[1] + ' antes y ' + it[2] + ' después', sel, inner, [0, yy - 13, W, 26]);
    });
    return svg(W, H, o.label, s);
  }
  function table(caption, head, body) {
    return '<details class="ic__table"><summary>Ver la tabla</summary><table><caption>' + esc(caption) + '</caption><thead><tr>' + head.map(function (h, i) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      body.map(function (r) { return '<tr>' + r.map(function (c, i) { return i ? '<td>' + esc(c) + '</td>' : '<th scope="row">' + esc(c) + '</th>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></details>';
  }

  var Z = [{ k: 'A', label: 'Barra', v: 62 }, { k: 'B', label: 'Ventana', v: 41 }, { k: 'C', label: 'Mesas del centro', v: 38 }, { k: 'D', label: 'Terraza', v: 27 }, { k: 'E', label: 'Fondo', v: 6 }];
  var band = function (v) { return v < 15 ? 0 : v < 30 ? 1 : v < 45 ? 2 : 3; };
  var plan = function (sel) {
    var shapes = [
      { d: 'M10 10H210V62H10Z', tag: [190, 46], deco: '<path d="M22 22H196V40H22Z" fill="#F3ECE2" stroke="#87695C" stroke-width="1.5"/>' + [40, 70, 100, 130, 160].map(function (x) { return '<circle cx="' + x + '" cy="52" r="5" fill="none" stroke="#87695C"/>'; }).join('') },
      { d: 'M226 10H312V120H226Z', tag: [292, 104], deco: '<path d="M309 22V100" stroke="#8C746B" stroke-width="3"/>' + [[248, 36], [248, 76]].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="11" fill="#F7F4EE" stroke="#8C746B" stroke-width="1.4"/>'; }).join('') },
      { d: 'M64 78H210V160H64Z', tag: [190, 146], deco: [[92, 104], [140, 104], [92, 140], [140, 140]].map(function (p) { return '<rect x="' + (p[0] - 12) + '" y="' + (p[1] - 10) + '" width="24" height="20" rx="3" fill="#F7F4EE" stroke="#8C746B" stroke-width="1.4"/>'; }).join('') },
      { d: 'M226 136H312V206H226Z', tag: [292, 190], deco: '<path d="M234 198H304" stroke="#8C746B" stroke-dasharray="3 4"/>' + '<circle cx="252" cy="162" r="10" fill="#F7F4EE" stroke="#8C746B" stroke-width="1.4"/>' },
      { d: 'M10 78H52V206H10Z', tag: [31, 190], deco: '<rect x="18" y="96" width="26" height="40" rx="3" fill="none" stroke="#A89A90" stroke-dasharray="3 3"/>' }
    ];
    var s = '<rect x="4" y="4" width="314" height="208" fill="#F6F3EE"/>';
    shapes.forEach(function (z, i) {
      var on = sel === i;
      var inner = '<path class="zone" d="' + z.d + '" fill="' + HEAT[band(Z[i].v)] + '" stroke="' + (on ? C.burg : '#D4C9BF') + '" stroke-width="' + (on ? 2.2 : 1) + '"/>' + z.deco +
        '<circle cx="' + z.tag[0] + '" cy="' + z.tag[1] + '" r="10.5" fill="' + (on ? C.burg : C.paper) + '" stroke="' + (on ? C.burg : '#9D8F83') + '"/>' + T(z.tag[0], z.tag[1] + 4, Z[i].k, { anchor: 'middle', size: 10.5, bold: true, fill: on ? C.paper : C.ink });
      var bb = z.d.match(/[\d.]+/g).map(Number);
      s += act(i, Z[i].label + ', ' + Z[i].v + ' por ciento de las visitas', sel, inner, [Math.min(bb[0], bb[2]), Math.min(bb[1], bb[3]), Math.abs(bb[2] - bb[0]) || 40, Math.abs((bb[5] || bb[3]) - bb[1]) || 40]);
    });
    s += '<path d="M120 212H4V4H318V212H172" fill="none" stroke="' + C.burg + '" stroke-width="6"/><path d="M122 210V174A48 48 0 0 1 170 210" fill="none" stroke="#8D817B"/>' + T(146, 230, 'Entrada', { anchor: 'middle', size: 11.5 });
    return '<svg viewBox="0 0 322 236" role="group" aria-label="Plano del salón">' + s + '</svg>';
  };
  /* ---------- vistas: arriba el hallazgo, debajo el gráfico ---------- */
  var HRS = ['12–13', '13–14', '14–15', '15–16', '16–17', '17–18', '18–19', '19–20', '20–21', '21–22', '22–23', '23–24'];
  var mmss = function (m) { var mm = Math.floor(m), ss = Math.round((m - mm) * 60); if (ss === 60) { mm++; ss = 0; } return mm + ':' + (ss < 10 ? '0' : '') + ss; };
  function stats(list) { return '<dl class="vx__stats">' + list.map(function (s) { return '<div><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>'; }).join('') + '</dl>'; }

  var VIEWS = {
    espera: {
      kick: 'Espera en la barra · últimos 7 días',
      find: 'Entre las 21 y las 22 h se registró la mayor espera en la barra.',
      big: ['5:30', 'de espera promedio'],
      legend: [{ t: 'Esta semana', c: C.lim }, { t: 'Mayor espera', c: C.cop }, { t: 'Semana anterior', c: C.burg, kind: 'tick' }],
      vals: [1, 1.5, 2, 1, 0.5, 0.5, 1, 2, 3.5, 5.5, 4.5, 2], prev: [1, 1.5, 2, 1, 1, 1, 1, 2.5, 4, 6.5, 5, 2.5],
      chart: function (sel, W) { var v = this; return columns({ labels: HRS, vals: v.vals, prev: v.prev, hi: 9, max: 7, ticks: [0, 2, 4, 6], label: 'Espera en la barra por hora', aria: function (i) { return HRS[i] + ' h, ' + mmss(v.vals[i]) + ' minutos de espera; la semana anterior, ' + mmss(v.prev[i]); } }, sel, W); },
      readout: function (i) { return HRS[i] + ' h · ' + mmss(this.vals[i]) + ' min de espera; la semana anterior, ' + mmss(this.prev[i]) + ' min.'; },
      hint: 'Elegí una franja para ver la diferencia.',
      stats: [['Espera hasta la primera atención', '2:40 <small>min</small>'], ['Se fueron sin atención', '23 <small>personas</small>'], ['La misma franja, semana anterior', '6:30 <small>min</small>']]
    },
    visitas: {
      kick: 'Visitas · últimos 7 días',
      find: 'El sábado fue el día con más visitas de la semana.',
      big: ['571', 'visitas el sábado'],
      legend: [{ t: 'Esta semana', c: C.lim }, { t: 'Día con más visitas', c: C.cop }, { t: 'Semana anterior', c: C.burg, kind: 'tick' }],
      days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'], vals: [350, 372, 401, 341, 525, 571, 290], prev: [320, 335, 360, 350, 480, 520, 255],
      chart: function (sel, W) { var v = this; return columns({ labels: v.days, vals: v.vals, prev: v.prev, hi: 5, max: 600, ticks: [0, 200, 400, 600], label: 'Visitas por día', aria: function (i) { return v.days[i] + ', ' + v.vals[i] + ' visitas; la semana anterior, ' + v.prev[i]; } }, sel, W); },
      readout: function (i) { var d = this.vals[i] - this.prev[i]; return this.days[i] + ' · ' + fmt.format(this.vals[i]) + ' visitas; la semana anterior, ' + fmt.format(this.prev[i]) + ' (' + signed(d) + ').'; },
      hint: 'Elegí un día para ver la diferencia.',
      stats: [['Visitas en la semana', '2.850 <small>+9 %</small>'], ['Hora pico', '21 a 22 <small>h</small>'], ['Tiempo promedio en mesa', '52 <small>min</small>']]
    },
    zonas: {
      kick: 'Zonas del salón · últimos 7 días',
      find: 'Seis de cada diez visitas pasaron por la barra.',
      big: ['62 %', 'de las visitas pasaron por la barra'],
      legend: [{ t: '0–14 %', c: HEAT[0] }, { t: '15–29 %', c: HEAT[1] }, { t: '30–44 %', c: HEAT[2] }, { t: '45–100 %', c: HEAT[3] }],
      sel: 0,
      chart: function (sel, W) {
        var wide = W > 640, listW = wide ? Math.round(W - 356) : W;
        return '<div class="vx__split' + (wide ? '' : ' is-stack') + '"><div class="vx__plan">' + plan(sel) + '</div><div><p class="vx__axis">Porcentaje de visitas que pasaron por cada zona</p>' +
          rows({ items: Z, max: 75, ticks: listW < 440 ? [0, 50] : [0, 25, 50, 75], unit: ' %', unitLong: ' por ciento de las visitas', label: 'Zonas del salón' }, sel, listW) + '</div></div>';
      },
      readout: function (i) { return Z[i].k + ' · ' + Z[i].label + ': ' + Z[i].v + ' de cada 100 visitas pasaron por acá' + (i === 4 ? ' · es la zona menos usada.' : '.'); },
      hint: 'Elegí una zona en el plano o en la lista.',
      stats: [['Zona menos usada', 'Fondo <small>6 %</small>'], ['Tiempo promedio en mesa', '52 <small>min</small>'], ['Base', '2.850 <small>visitas</small>']]
    },
    cambio: {
      kick: 'Antes y después · visitas por día',
      find: 'Hubo 230 visitas más la semana posterior al cambio.',
      big: ['+230', 'visitas · moviste la barra de café a la entrada el 9 de noviembre'],
      legend: [{ t: 'Antes · 2–8 nov · 2.620', c: C.ante, kind: 'ring' }, { t: 'Después · 9–15 nov · 2.850', c: C.cop, kind: 'dia' }],
      D: [['Lun', 320, 350], ['Mar', 335, 372], ['Mié', 360, 401], ['Jue', 350, 341], ['Vie', 480, 525], ['Sáb', 520, 571], ['Dom', 255, 290]],
      chart: function (sel, W) { return dumbbell({ items: this.D, min: 200, max: 600, ticks: [200, 300, 400, 500, 600], label: 'Visitas por día, antes y después del cambio' }, sel, W); },
      readout: function (i) { var d = this.D[i]; return d[0] + ' · ' + fmt.format(d[1]) + ' antes y ' + fmt.format(d[2]) + ' después (' + signed(d[2] - d[1]) + ').'; },
      hint: 'Elegí un día para ver la diferencia.',
      note: 'El jueves fue el único día con menos visitas.',
      caveat: 'La diferencia entre semanas, por sí sola, no establece qué causó el cambio.'
    }
  };

  var cur = null, sel = null;
  function draw(focusI) {
    var v = VIEWS[cur], box = view.querySelector('.vx__chart'), read = view.querySelector('.vx__read');
    var W = Math.max(280, Math.round(box.clientWidth || 600));
    box.innerHTML = v.chart(sel, W);
    read.textContent = sel == null ? v.hint : v.readout(sel);
    if (focusI != null) { var f = box.querySelector('.act[data-i="' + focusI + '"]'); if (f) f.focus(); }
  }
  function show(name, opts) {
    opts = opts || {};
    cur = name; var v = VIEWS[name]; sel = v.sel == null ? null : v.sel;
    tabs.forEach(function (t) { var on = t.dataset.tab === name; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; if (on) view.setAttribute('aria-labelledby', t.id); });
    view.innerHTML = '<p class="vx__kick">' + v.kick + '</p><h3 class="vx__find">' + v.find + '</h3>' +
      '<p class="vx__big"><b>' + v.big[0] + '</b><span>' + v.big[1] + '</span></p>' + legend(v.legend) +
      '<div class="vx__chart"></div><p class="vx__read" role="status" aria-live="polite"></p>' +
      (v.note ? '<p class="vx__note">' + v.note + '</p>' : '') + (v.caveat ? '<p class="vx__caveat">' + v.caveat + '</p>' : '') +
      (v.stats ? stats(v.stats) : '') + '<p class="vx__sim">' + SIM + '</p>';
    draw();
    view.classList.remove('is-anim'); void view.offsetWidth; view.classList.add('is-anim');
    if (opts.focus) { var t = tabs.filter(function (x) { return x.dataset.tab === name; })[0]; if (t) t.focus(); }
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { if (t.dataset.tab !== cur) show(t.dataset.tab); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); show(tabs[(i + d + tabs.length) % tabs.length].dataset.tab, { focus: true }); }
    });
  });
  var pick = function (i) { sel = sel === i && VIEWS[cur].sel == null ? null : i; draw(i); };
  view.addEventListener('click', function (e) { var g = e.target.closest('.act'); if (g) pick(+g.dataset.i); });
  view.addEventListener('keydown', function (e) { var g = e.target.closest('.act'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(+g.dataset.i); } });
  var lastW = 0, rzT;
  window.addEventListener('resize', function () { clearTimeout(rzT); rzT = setTimeout(function () { var w = view.clientWidth; if (Math.abs(w - lastW) > 24) { lastW = w; draw(); } }, 150); });
  show('espera');
  lastW = view.clientWidth;
})();

/* ===== Consentimiento de cookies y Google Analytics 4 (solo si la persona acepta) ===== */
(function () {
  'use strict';
  var meta = document.querySelector('meta[name="vistorm:ga-id"]');
  var GA_ID = meta ? meta.getAttribute('content').trim() : '';
  var enabled = /^G-[A-Z0-9]{6,}$/.test(GA_ID) && GA_ID !== 'G-XXXXXXXXXX';
  var KEY = 'vistorm-consent-v1';
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* sin almacenamiento: se vuelve a preguntar */ } }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.vsTrack = function (name, params) { if (loaded) gtag('event', name, params || {}); };
  var loaded = false;
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });

  function loadGA() {
    if (loaded || !enabled) return; loaded = true;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
  }
  function banner() {
    if (document.getElementById('consent')) return;
    var d = document.createElement('section');
    d.id = 'consent'; d.className = 'consent'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', 'Cookies');
    d.innerHTML = '<p class="consent__t">¿Nos dejás medir cómo se usa esta página?</p>' +
      '<p>Usamos cookies de Google Analytics para contar visitas y saber qué secciones se leen. No las usamos para publicidad. Podés cambiar de idea cuando quieras desde el pie de página. <a href="/privacidad#cookies">Ver la política de privacidad</a>.</p>' +
      '<div class="consent__row"><button type="button" class="btn" data-c="yes">Aceptar</button><button type="button" class="btn-ghost" data-c="no">Rechazar</button></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      var c = e.target.getAttribute && e.target.getAttribute('data-c'); if (!c) return;
      write(c === 'yes' ? 'granted' : 'denied');
      if (c === 'yes') loadGA();
      d.remove();
    });
  }
  window.vsOpenConsent = function () { if (!enabled) return; banner(); var b = document.querySelector('#consent .btn'); if (b) b.focus(); };
  var btn = document.getElementById('cookie-settings');
  if (btn) { if (!enabled) btn.hidden = true; else btn.addEventListener('click', window.vsOpenConsent); }
  if (!enabled) return;
  var v = read();
  if (v === 'granted') loadGA(); else if (v !== 'denied') banner();
})();
