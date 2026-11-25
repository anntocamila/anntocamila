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
      .then(function () { sendBtn.disabled = false; sendBtn.textContent = 'Pedí una demo'; });
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

/* ===== Vistorm Labs · panel de ejemplo (réplica del software, con datos simulados) ===== */
(function () {
  'use strict';
  var root = document.getElementById('sw'); if (!root) return;
  var view = document.getElementById('sw-view'), crumbs = document.getElementById('sw-crumbs');
  var items = Array.prototype.slice.call(root.querySelectorAll('.sw__item'));
  var NS = 'http://www.w3.org/2000/svg', fmt = new Intl.NumberFormat('es-AR');
  var C = { brand: '#542433', soft: '#8E5E69', caliza: '#C7BCAC', sunken: '#ECE7E2', line: '#DDD5CA', verde: '#8FB5AE', cobre: '#C1774B', deep: '#4A1F2D', heat4: '#E6DFD7', heat1: '#6A3243' };

  function h(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function svg(w, hh, cls, label) { var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 ' + w + ' ' + hh); s.setAttribute('class', cls); if (label) { s.setAttribute('role', 'img'); s.setAttribute('aria-label', label); } else s.setAttribute('aria-hidden', 'true'); return s; }
  function el(tag, a, p) { var n = document.createElementNS(NS, tag); for (var k in a) n.setAttribute(k, a[k]); if (p) p.appendChild(n); return n; }
  function tx(p, x, y, s, a) { var t = el('text', Object.assign({ x: x, y: y }, a || {}), p); t.textContent = s; return t; }

  /* ---------- piezas ---------- */
  function head(kick, title, sub, meta, seg) {
    return '<div class="sw__head"><div><p class="sw__kick">' + kick + '</p><h3 class="sw__h1">' + title + '</h3><p class="sw__sub">' + sub + '</p>' +
      (meta ? '<p class="sw__meta">' + meta + '</p>' : '') + '</div>' +
      (seg ? '<div class="sw__seg" aria-hidden="true">' + ['Hoy', '7 días', '28 días'].map(function (s) { return '<span' + (s === seg ? ' class="on"' : '') + '>' + s + '</span>'; }).join('') + '</div>' : '') + '</div>';
  }
  function kpi(label, value, unit, delta, extra) {
    return '<div class="sw__kpi"><span class="sw__kl">' + label + '</span><span class="sw__kv">' + value + (unit ? '<small>' + unit + '</small>' : '') + '</span>' +
      (delta ? '<span class="sw__kd">' + delta + '</span>' : '') + (extra || '') + '</div>';
  }
  // barritas chicas: la última (o la marcada) en granate
  function miniBars(vals, labels, hi) {
    var w = 200, hh = 58, n = vals.length, gap = 4, bw = (w - gap * (n - 1)) / n, max = Math.max.apply(null, vals), base = labels ? 44 : 56;
    var s = svg(w, hh, 'sw__mini');
    vals.forEach(function (v, i) {
      var bh = Math.max(3, v / max * (base - 4)), x = i * (bw + gap);
      el('rect', { x: x, y: base - bh, width: bw, height: bh, rx: 2, fill: i === hi ? C.brand : C.heat4 }, s);
      if (labels && labels[i]) tx(s, x + bw / 2, 57, labels[i], { 'text-anchor': 'middle' });
    });
    return s.outerHTML;
  }
  function ring(p, label) {
    var r = 19, c = 2 * Math.PI * r;
    return '<div class="sw__ring"><svg viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="' + r + '" fill="none" stroke="' + C.sunken + '" stroke-width="5"/>' +
      '<circle class="sw__ring-arc" cx="23" cy="23" r="' + r + '" fill="none" stroke="' + C.brand + '" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + (c * p).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 23 23)"/></svg><span>' + label + '</span></div>';
  }
  function split(p, left, right) { return '<div class="sw__split"><i><b style="width:' + (p * 100) + '%"></b></i><span><span>' + left + '</span><span>' + right + '</span></span></div>'; }
  // gráfico de barras con grilla, eje y etiqueta de pico
  function bars(o) {
    var W = narrow() ? 380 : (o.wide ? 1080 : 560), H = o.h || (narrow() ? 230 : o.wide ? 200 : 220), L = 40, R = 8, T = 22, B = 26, pw = W - L - R, ph = H - T - B;
    var s = svg(W, H, 'sw__chart', o.label);
    var y = function (v) { return T + ph - v / o.max * ph; };
    o.ticks.forEach(function (v) { el('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }, s); tx(s, L - 8, y(v) + 4, v + (o.unit || ''), { 'text-anchor': 'end' }); });
    var n = o.labels.length, step = pw / n, pair = !!o.prev, bw = step * (pair ? 0.32 : 0.56);
    o.labels.forEach(function (lb, i) {
      var cx = L + i * step + step / 2;
      if (pair) {
        el('rect', { x: cx - bw - 1, y: y(o.prev[i]), width: bw, height: y(0) - y(o.prev[i]), rx: 2, fill: C.verde }, s);
        if (o.vals[i] != null) el('rect', { x: cx + 1, y: y(o.vals[i]), width: bw, height: y(0) - y(o.vals[i]), rx: 2, fill: C.brand }, s);
      } else {
        var v = o.vals[i];
        el('rect', { x: cx - bw / 2, y: y(v), width: bw, height: Math.max(1, y(0) - y(v)), rx: 2, fill: o.first && i === 0 ? C.soft : (o.hi === i || o.hi == null ? C.brand : C.brand) }, s);
        if (o.hi === i) tx(s, cx, y(v) - 7, 'PICO', { class: 'peak', 'text-anchor': 'middle' });
      }
      tx(s, cx, H - 8, lb, { 'text-anchor': 'middle' });
    });
    if (o.axis) tx(s, L - 2, 10, o.axis, {});
    return s.outerHTML;
  }
  function card(title, sub, body, foot, wide) {
    return '<div class="sw__card' + (wide ? ' sw__card--wide' : '') + '"><p class="sw__ct">' + title + '</p><p class="sw__cs">' + sub + '</p>' + body + (foot ? '<div class="sw__cf">' + foot + '</div>' : '') + '</div>';
  }
  // en pantallas angostas los gráficos se dibujan a su ancho real, para que el texto se lea
  function narrow() { return (view.clientWidth || root.clientWidth) < 600; }
  var HRS = ['12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'];

  /* ---------- secciones ---------- */
  var VIEWS = {
    hoy: { crumb: 'Hoy', render: function () {
      return head('Hoy', 'Hoy', 'Lo que pasa en el local ahora.', 'Martes 24 de noviembre · actualizado 21:42 · sin contar al personal') +
        '<div class="sw__strip">' +
        kpi('Visitas hasta ahora', '386', '', '<b>+8 %</b> vs el martes pasado a esta hora', miniBars([22, 31, 28, 19, 14, 17, 26, 38, 51, 58], null, 9)) +
        kpi('Gente adentro ahora', '41', '', 'Pico del día: 58 a las 21 h') +
        kpi('Espera por una mesa', '6', 'min', '<b>−2 min</b> vs el martes pasado') +
        kpi('Permanencia media', '42', 'min', '<b>+3 min</b> vs el martes pasado') + '</div>' +
        '<div class="sw__cards">' + card('Visitas por hora', 'Hoy y el martes pasado',
          bars({ wide: true, labels: HRS, vals: [22, 31, 28, 19, 14, 17, 26, 38, 51, 58, null, null], prev: [20, 27, 25, 18, 15, 16, 22, 33, 45, 52, 41, 23], max: 60, ticks: [0, 20, 40, 60], label: 'Visitas por hora: hoy va por encima del martes pasado en casi todas las horas.' }),
          '<span class="sw__leg"><span><i style="background:' + C.brand + '"></i>Hoy</span><span><i style="background:' + C.verde + '"></i>Martes pasado</span></span><span>Pico esperado: <b>21 a 22 h</b></span>', true) + '</div>';
    } },
    hacer: { crumb: 'Qué hacer', render: function () {
      var O = [
        { n: 23, t: 'Sumá una persona en la barra de 21 a 23 h', d: 'El viernes, 23 personas se fueron sin que nadie las atendiera en ese horario.' },
        { n: 37, t: 'Abrí el sector del fondo antes de las 20 h', d: 'Queda vacío hasta las 21 h mientras 37 personas por noche esperan mesa en la entrada.' }
      ];
      return head('Qué hacer', 'Qué hacer', 'Sugerencias ordenadas por personas en juego.', 'Basadas en los últimos 7 días') +
        '<ul class="sw__opps">' + O.map(function (o) { return '<li class="sw__opp"><span class="sw__opp-n">' + o.n + '<small>personas</small></span><div><h4>' + o.t + '</h4><p>' + o.d + '</p></div><button class="sw__btn" type="button" aria-pressed="false">Probar y medir</button></li>'; }).join('') + '</ul>' +
        '<p class="sw__note">Cuando probás una sugerencia, Vistorm compara las dos semanas siguientes con las dos anteriores y te avisa en <b>Resultados</b>.</p>';
    } },
    mesas: { crumb: 'Mesas', render: function () {
      return head('Tus preguntas', 'Mesas', '¿Qué mesa espera? Cuánto se espera para sentarse y quién se va antes.', 'Últimos 7 días · comparado con los 7 días anteriores', '7 días') +
        '<div class="sw__strip sw__strip--3">' +
        kpi('Espera media por una mesa', '6', 'min', '<b>−2 min</b> vs período anterior') +
        kpi('Se fueron sin mesa', '23', 'personas', '<b>−9</b> vs período anterior') +
        kpi('Mesas ocupadas ahora', '14', 'de 18', 'La de la ventana se libera primero') + '</div>' +
        '<div class="sw__cards">' + card('Espera para sentarse', 'Minutos promedio por hora de llegada',
          bars({ wide: true, labels: HRS, vals: [1, 2, 3, 1, 0.5, 0.5, 1, 3, 7, 11, 8, 3], max: 12, ticks: [0, 4, 8, 12], hi: 9, label: 'Espera para sentarse por hora: el pico es a las 21 h, con 11 minutos.' }),
          '<span>Llegada 21:00–22:00 · espera media <b>11 min</b></span>', true) + '</div>';
    } },
    atencion: { crumb: 'Atención', tabs: true, render: function (tab) {
      tab = tab || 'permanencia';
      var t = '<div class="sw__tabs" role="tablist" aria-label="Atención">' + [['resumen', 'Resumen'], ['fila', 'Fila y espera'], ['permanencia', 'Permanencia']].map(function (x) {
        return '<button class="sw__tab" role="tab" type="button" data-tab="' + x[0] + '" aria-selected="' + (x[0] === tab) + '">' + x[1] + '</button>'; }).join('') + '</div>';
      if (tab === 'permanencia') return t + head('Atención', 'Permanencia', 'Cuánto se queda cada visita y cuántas llegan a atención.', 'Últimos 7 días · comparado con los 7 días anteriores · sin contar al personal', '7 días') +
        '<div class="sw__strip">' +
        kpi('Permanencia media', '42', 'min', '<b>+3 min</b> vs período anterior', miniBars([38, 47, 55, 41, 33, 36, 42], ['J', 'V', 'S', 'D', 'L', 'M', 'M'], 6)) +
        kpi('Llegan a atención', '86', '%', '<b>+4 %</b> vs período anterior', ring(0.86, 'Llegaron a un punto de atención')) +
        kpi('Visitas cortas', '9', '%', '<b>−3 %</b> vs período anterior', split(0.09, 'Menos de 5 min', '9 de cada 100')) +
        kpi('Permanencia en hora pico', '51', 'min · 21 h', '', miniBars([28, 35, 39, 31, 22, 19, 24, 33, 44, 51, 47, 36], null, 9) ) + '</div>' +
        '<div class="sw__cards">' +
        card('Distribución de permanencia', '% de visitas por duración', bars({ labels: ['< 5 min', '5–15', '15–30', '30–60', '60–90', '> 90'], vals: [9, 4, 14, 41, 22, 10], max: 50, ticks: [0, 25, 50], unit: ' %', first: true, label: 'Distribución de permanencia: la mayoría se queda entre 30 y 60 minutos (41 %).' }),
          '<span>30–60 min · <b>41 % de las visitas</b></span>') +
        card('Permanencia por hora de llegada', 'Minutos promedio', bars({ labels: HRS, vals: [28, 35, 39, 31, 22, 19, 24, 33, 44, 51, 47, 36], max: 60, ticks: [0, 30, 60], hi: 9, label: 'Permanencia por hora de llegada: quienes llegan a las 21 h se quedan más, 51 minutos.' }),
          '<span>Llegada 21:00–22:00 · permanencia media <b>51 min</b></span>') + '</div>';
      if (tab === 'fila') return t + head('Atención', 'Fila y espera', 'Cuánto se espera para pedir y cuánta gente se va antes.', 'Últimos 7 días · comparado con los 7 días anteriores', '7 días') +
        '<div class="sw__strip sw__strip--3">' +
        kpi('Espera para ser atendido', '3 min 40 s', '', '<b>−50 s</b> vs período anterior') +
        kpi('Se fueron sin atención', '23', 'personas', '<b>−6</b> vs período anterior') +
        kpi('Hora con más espera', '21', 'h', 'Viernes y sábado') + '</div>' +
        '<div class="sw__cards">' + card('Espera en la barra', 'Minutos promedio por hora',
          bars({ wide: true, labels: HRS, vals: [1, 1.5, 2, 1, 0.5, 0.5, 1, 2, 3.5, 5.5, 4.5, 2], max: 6, ticks: [0, 2, 4, 6], hi: 9, label: 'Espera en la barra por hora: el pico es a las 21 h, con 5 minutos y medio.' }),
          '<span>21:00–22:00 · <b>5 min 30 s</b> de espera</span>', true) + '</div>';
      return t + head('Atención', 'Resumen', '¿Quién se va sin atención? Lo importante de la semana.', 'Últimos 7 días · comparado con los 7 días anteriores', '7 días') +
        '<div class="sw__strip sw__strip--3">' +
        kpi('Llegan a atención', '86', '%', '<b>+4 %</b> vs período anterior', ring(0.86, '86 de cada 100 visitas')) +
        kpi('Se fueron sin atención', '23', 'personas', '<b>−6</b> vs período anterior') +
        kpi('Permanencia media', '42', 'min', '<b>+3 min</b> vs período anterior') + '</div>' +
        '<p class="sw__note">La mayoría de quienes se van sin atención llega <b>entre las 21 y las 22 h</b>, cuando hay una sola persona en la barra.</p>';
    } },
    personal: { crumb: 'Personal', render: function () {
      var DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'], base = [0.25, 0.35, 0.3, 0.2, 0.15, 0.2, 0.35, 0.55, 0.8, 1, 0.85, 0.5], dayF = [0.5, 0.55, 0.6, 0.7, 0.95, 1, 0.65];
      var cols = [C.heat4, C.caliza, C.soft, C.heat1, C.cobre];
      var t = '<div class="sw__week"><table><thead><tr><th></th>' + HRS.map(function (x) { return '<th scope="col">' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
      DAYS.forEach(function (d, di) { t += '<tr><th scope="row">' + d + '</th>' + base.map(function (b, hi) { var v = b * dayF[di]; return '<td style="background:' + cols[Math.min(4, Math.floor(v * 5))] + '" title="' + d + ' ' + HRS[hi] + ' h · ' + Math.round(v * 60) + ' personas"></td>'; }).join('') + '</tr>'; });
      t += '</tbody></table></div>';
      return head('Tus preguntas', 'Personal', '¿Cuándo reforzar? La semana típica, hora por hora.', 'Promedio de las últimas 4 semanas', '28 días') +
        '<div class="sw__card sw__card--wide"><p class="sw__ct">Gente en el local</p><p class="sw__cs">Cada cuadro es una hora; más oscuro, más gente. Cobre: horas pico.</p>' + t + '</div>' +
        '<p class="sw__note">Sugerido: <b>2 personas más en la barra los viernes y sábados de 20 a 23 h</b>. El resto de la semana alcanza con el equipo actual.</p>';
    } },
    salon: { crumb: 'Salón', render: function () {
      var s = svg(400, 260, '', 'Plano del salón: la barra y las mesas de la ventana concentran el tiempo; el fondo queda frío.');
      el('rect', { x: 0, y: 0, width: 400, height: 260, fill: C.deep }, s);
      [{ x: 14, y: 14, w: 230, h: 60, c: C.cobre, n: 'Barra', t: '#272124' }, { x: 258, y: 14, w: 128, h: 104, c: C.heat4, n: 'Ventana', t: '#272124' },
        { x: 14, y: 88, w: 230, h: 90, c: C.soft, n: 'Mesas del centro', t: '#F4F2F1' }, { x: 258, y: 132, w: 128, h: 114, c: C.heat1, n: 'Terraza', t: '#F4F2F1' },
        { x: 14, y: 192, w: 230, h: 54, c: C.deep, n: 'Fondo', t: C.caliza, dash: true }].forEach(function (z) {
        el('rect', { x: z.x, y: z.y, width: z.w, height: z.h, rx: 6, fill: z.c, stroke: z.dash ? C.soft : 'none', 'stroke-dasharray': z.dash ? '4 4' : '' }, s);
        tx(s, z.x + 10, z.y + 20, z.n, { fill: z.t });
      });
      return head('Tus preguntas', 'Salón', '¿Qué parte no se usa? Tiempo acumulado por zona.', 'Últimos 7 días · sin contar al personal', '7 días') +
        '<div class="sw__card sw__card--wide"><div class="sw__plan">' + s.outerHTML + '<ul class="sw__zones">' +
        '<li><i style="background:' + C.cobre + '"></i><span>Barra</span><b>31 %</b></li>' +
        '<li><i style="background:' + C.heat4 + ';box-shadow:inset 0 0 0 1px ' + C.caliza + '"></i><span>Ventana</span><b>24 %</b></li>' +
        '<li><i style="background:' + C.soft + '"></i><span>Mesas del centro</span><b>22 %</b></li>' +
        '<li><i style="background:' + C.heat1 + '"></i><span>Terraza</span><b>19 %</b></li>' +
        '<li><i style="background:' + C.deep + ';box-shadow:inset 0 0 0 1px ' + C.soft + '"></i><span>Fondo · <b>zona fría</b></span><b>4 %</b></li>' +
        '</ul></div></div>';
    } },
    resultados: { crumb: 'Resultados', render: function () {
      var R = [['Visitas por semana', 2540, 2810, '+11 %', 'visitas'], ['Permanencia media', 37, 42, '+5 min', 'minutos'], ['Visitas cortas', 13, 9, '−4 %', 'de las visitas']];
      return head('Tus preguntas', 'Resultados', '¿Funcionó el cambio? Moviste la barra de café a la entrada el 12 de noviembre.', 'Dos semanas antes contra dos semanas después') +
        '<div class="sw__card sw__card--wide"><p class="sw__ct">Antes y después del cambio</p><p class="sw__cs">Verde agua: antes · Granate: después</p><div class="sw__vs" style="margin-top:14px">' +
        R.map(function (r) { var m = Math.max(r[1], r[2]); return '<div class="sw__vs-row"><span>' + r[0] + '</span><span class="bars"><i style="width:' + (r[1] / m * 100) + '%"></i><i style="width:' + (r[2] / m * 100) + '%"></i></span><span class="d">' + r[3] + '<small>' + fmt.format(r[1]) + ' → ' + fmt.format(r[2]) + ' ' + r[4] + '</small></span></div>'; }).join('') +
        '</div></div><p class="sw__note"><b>Funcionó.</b> Entró más gente y se quedó más tiempo. Las visitas de menos de 5 minutos bajaron.</p>';
    } }
  };

  /* ---------- navegación ---------- */
  var current = null, curTab = 'permanencia';
  function show(name, opts) {
    opts = opts || {};
    var v = VIEWS[name]; if (!v) return;
    current = name;
    items.forEach(function (b) { if (b.dataset.view === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    // en celular la barra de secciones se desliza para mostrar la activa, sin mover la página
    var act = items.filter(function (b) { return b.dataset.view === name; })[0], nav = act && act.parentNode;
    if (nav && nav.scrollWidth > nav.clientWidth + 4) nav.scrollLeft = Math.max(0, act.offsetLeft - nav.offsetLeft - 12);
    view.innerHTML = v.render(curTab);
    crumbs.innerHTML = 'Local de ejemplo / ' + (name === 'atencion' ? 'Atención / <b>' + { resumen: 'Resumen', fila: 'Fila y espera', permanencia: 'Permanencia' }[curTab] + '</b>' : '<b>' + v.crumb + '</b>');
    if (opts.focus) { var f = view.querySelector('.sw__h1'); if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); } }
    root.dispatchEvent(new CustomEvent('sw:view', { detail: { name: name, user: !!opts.user } }));
  }
  items.forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.view, { user: !b._auto }); }); });
  view.addEventListener('click', function (e) {
    var t = e.target.closest('.sw__tab');
    if (t) { curTab = t.dataset.tab; show('atencion', { user: true }); var nt = view.querySelector('.sw__tab[data-tab="' + curTab + '"]'); if (nt) nt.focus(); return; }
    var b = e.target.closest('.sw__btn');
    if (b) { var on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); b.textContent = on ? 'Midiendo · día 1 de 14' : 'Probar y medir'; }
  });
  view.addEventListener('keydown', function (e) {
    var t = e.target.closest('.sw__tab'); if (!t) return;
    var tabs = Array.prototype.slice.call(view.querySelectorAll('.sw__tab')), i = tabs.indexOf(t);
    var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) { e.preventDefault(); curTab = tabs[(i + d + tabs.length) % tabs.length].dataset.tab; show('atencion', { user: true }); view.querySelector('.sw__tab[data-tab="' + curTab + '"]').focus(); }
  });
  show('atencion');
  var wasNarrow = narrow(), rzT;
  window.addEventListener('resize', function () { clearTimeout(rzT); rzT = setTimeout(function () { var n = narrow(); if (n !== wasNarrow) { wasNarrow = n; show(current); } }, 200); });
  window.VistormPanel = { show: show, items: items, current: function () { return current; } };
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
