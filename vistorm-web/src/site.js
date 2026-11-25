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

/* ===== Vistorm Labs · "Qué medimos": cuadros superpuestos, el activo se abre =====
   El cuadro no se agranda: se ensancha y la ilustración se recorta distinto. */
(function () {
  'use strict';
  var root = document.getElementById('spot'); if (!root) return;
  var items = Array.prototype.slice.call(root.querySelectorAll('.spot__item'));
  var dots = Array.prototype.slice.call(root.querySelectorAll('.spot__dot'));
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cur = 2, auto = true, timer = null, visible = false;
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

/* ===== Vistorm Labs · panel de ejemplo: la semana como un acordeón horizontal =====
   Cada día es una columna. Al abrir uno, la curva de gente de toda la semana se estira
   para hacerle lugar y el tramo de ese día se dibuja en cobre. Datos simulados. */
(function () {
  'use strict';
  var root = document.getElementById('ridge'); if (!root) return;
  var daysEl = document.getElementById('ridge-days'), svg = document.getElementById('ridge-svg');
  var tipEl = document.getElementById('ridge-tip'), countEl = document.getElementById('ridge-count');
  var fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  var D = [
    { k: 'Lun', name: 'Lunes', n: 9, v: 350, dw: 38, wait: 2.5, left: 3, peak: 24, ph: 21, lunch: .5, title: 'Un lunes tranquilo', tip: 'Con una persona en la barra alcanza hasta las 20 h.' },
    { k: 'Mar', name: 'Martes', n: 10, v: 372, dw: 40, wait: 3, left: 4, peak: 26, ph: 21, lunch: .5, title: 'Martes parejo', tip: 'Las mesas de la ventana se llenan primero: abrí la terraza desde las 20 h.' },
    { k: 'Mié', name: 'Miércoles', n: 11, v: 401, dw: 41, wait: 3.5, left: 5, peak: 29, ph: 21, lunch: .45, title: 'Miércoles en subida', tip: 'A las 21 h la espera en la barra pasó los 3 minutos.' },
    { k: 'Jue', name: 'Jueves', n: 12, v: 341, dw: 37, wait: 2.5, left: 3, peak: 25, ph: 20, lunch: .5, title: 'Jueves en baja', chip: 'Único día en baja', tip: 'Fue el único día con menos visitas que la semana anterior.' },
    { k: 'Vie', name: 'Viernes', n: 13, v: 525, dw: 46, wait: 5, left: 23, peak: 41, ph: 22, lunch: .35, title: 'Viernes de barra llena', chip: 'Más espera', tip: '23 personas se fueron sin atención de 21 a 23 h: sumá una persona en la barra.' },
    { k: 'Sáb', name: 'Sábado', n: 14, v: 571, dw: 48, wait: 5.5, left: 17, peak: 52, ph: 22, lunch: .4, title: 'Sábado récord', chip: 'El más concurrido', tip: 'Abrí el sector del fondo antes de las 20 h: hoy queda vacío mientras la gente espera mesa.' },
    { k: 'Dom', name: 'Domingo', n: 15, v: 290, dw: 35, wait: 2, left: 2, peak: 22, ph: 14, lunch: 1, title: 'Domingo de almuerzo', tip: 'El pico fue al mediodía: reforzá el salón de 13 a 15 h.' }
  ];
  // gente adentro, hora por hora: un pico al mediodía y otro a la noche
  var g = function (x, m, s) { return Math.exp(-((x - m) * (x - m)) / (2 * s * s)); };
  D.forEach(function (d) {
    var raw = HOURS.map(function (h) { return d.ph < 16 ? (g(h, d.ph, 1.4) + .35 * g(h, 21, 1.8) + .08) : (d.lunch * g(h, 13.5, 1.1) + g(h, d.ph, 1.6) + .1); });
    var mx = Math.max.apply(null, raw);
    d.curve = raw.map(function (r) { return r / mx * d.peak; });
  });
  var MAXP = 60;

  /* ---------- columnas ---------- */
  var cols = D.map(function (d, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'rd'; b.setAttribute('role', 'tab'); b.id = 'rd-' + i;
    b.setAttribute('aria-label', d.name + ' ' + d.n + ': ' + d.v + ' visitas, pico de ' + d.peak + ' personas a las ' + d.ph + ' h');
    b.innerHTML =
      '<span class="rd__mini"><span class="rd__k">D' + (i + 1) + (i === 5 ? ' <i class="rd__dot"></i>' : '') + '</span><span class="rd__n">' + d.n + '<small>' + d.k + '</small></span>' +
        '<span class="rd__s">' + fmt.format(d.v) + ' visitas</span><span class="rd__s2">pico a las ' + d.ph + ' h</span></span>' +
      '<span class="rd__full">' +
        '<span class="rd__row"><span class="rd__day">Día ' + (i + 1) + '</span><span class="rd__date">' + d.name + ' ' + d.n + ' nov</span>' + (d.chip ? '<span class="rd__chip">' + d.chip + '</span>' : '') +
          '<span class="rd__wx">Espera máx. ' + fmt.format(d.wait) + ' min</span></span>' +
        '<span class="rd__title">' + d.title + '<small>pico de ' + d.peak + ' personas a las ' + d.ph + ' h</small></span>' +
        '<span class="rd__stats">' +
          '<span><em>Visitas</em><b>' + fmt.format(d.v) + '</b></span>' +
          '<span><em>Permanencia</em><b>' + d.dw + '<small>min</small></b></span>' +
          '<span><em>Espera máx.</em><b>' + fmt.format(d.wait) + '<small>min</small></b></span>' +
          '<span><em>Sin atención</em><b>' + d.left + '<small>pers.</small></b></span>' +
        '</span>' +
      '</span>';
    daysEl.appendChild(b);
    return b;
  });

  /* ---------- curva ---------- */
  var openW = function () { return window.innerWidth < 760 ? 2.4 : 4.4; };
  var detail = document.getElementById('ridge-detail');
  var weights = D.map(function () { return 1; }), cur = 5, drawn = 0;
  function el(tag, a, p) { var n = document.createElementNS(NS, tag); for (var k in a) n.setAttribute(k, a[k]); if (p) p.appendChild(n); return n; }
  function draw() {
    var W = Math.max(300, svg.parentNode.clientWidth), H = window.innerWidth < 760 ? 170 : 230, T = 34, B = 26, ph = H - T - B;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('height', H);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var tot = weights.reduce(function (a, b) { return a + b; }, 0), xs = [0];
    weights.forEach(function (w, i) { xs.push(xs[i] + w / tot * W); });
    var y = function (v) { return T + ph - v / MAXP * ph; };
    // puntos de toda la semana, cada día ocupa el ancho de su columna
    var pts = [], segs = [];
    D.forEach(function (d, i) {
      var x0 = xs[i], x1 = xs[i + 1], seg = [];
      d.curve.forEach(function (v, k) { var p = [x0 + (k + .5) / d.curve.length * (x1 - x0), y(v)]; pts.push(p); seg.push(p); });
      segs.push(seg);
    });
    var line = function (P) { return P.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(''); };
    var smooth = function (P) {
      if (P.length < 3) return line(P);
      var s = 'M' + P[0][0].toFixed(1) + ' ' + P[0][1].toFixed(1);
      for (var i = 1; i < P.length - 1; i++) { var mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2; s += 'Q' + P[i][0].toFixed(1) + ' ' + P[i][1].toFixed(1) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1); }
      return s + 'L' + P[P.length - 1][0].toFixed(1) + ' ' + P[P.length - 1][1].toFixed(1);
    };
    // la columna abierta sigue hacia abajo, sobre la curva
    el('rect', { x: xs[cur], y: 0, width: xs[cur + 1] - xs[cur], height: H, fill: '#6A3243' }, svg);
    for (var i = 1; i < D.length; i++) el('path', { d: 'M' + xs[i] + ' 0V' + (H - B), stroke: 'rgba(244,242,241,.14)', 'stroke-dasharray': '2 4' }, svg);
    var all = [[0, H - B]].concat(pts, [[W, H - B]]);
    el('path', { d: smooth(all) + 'Z', fill: 'rgba(244,242,241,.07)' }, svg);
    el('path', { d: smooth(pts), fill: 'none', stroke: 'rgba(244,242,241,.42)', 'stroke-width': 1.6 }, svg);
    // el tramo del día abierto, en cobre
    var seg = segs[cur], d = D[cur];
    var segPath = smooth(seg);
    el('path', { d: segPath + 'L' + seg[seg.length - 1][0] + ' ' + (H - B) + 'L' + seg[0][0] + ' ' + (H - B) + 'Z', fill: 'rgba(193,119,75,.16)' }, svg);
    var hl = el('path', { class: 'ridge__line', d: segPath, fill: 'none', stroke: '#C1774B', 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
    var L = hl.getTotalLength(); hl.style.strokeDasharray = L; hl.style.strokeDashoffset = (1 - drawn) * L;
    // pico del día
    var pk = d.curve.indexOf(Math.max.apply(null, d.curve)), P = seg[pk];
    el('circle', { cx: P[0], cy: P[1], r: 5.5, fill: '#F4F2F1', stroke: '#C1774B', 'stroke-width': 2.5, opacity: drawn > .9 ? 1 : 0 }, svg);
    var lab = el('text', { x: Math.min(W - 64, Math.max(64, P[0])), y: P[1] - 14, 'text-anchor': 'middle', fill: '#F4F2F1', 'font-size': 12, 'font-weight': 600, opacity: drawn > .9 ? 1 : 0 }, svg); lab.textContent = d.peak + ' personas · ' + d.ph + ' h';
    // horas del día abierto
    [0, 6, 11].forEach(function (k) { var t = el('text', { x: seg[k][0], y: H - 8, 'text-anchor': 'middle', fill: 'rgba(244,242,241,.72)', 'font-size': 11 }, svg); t.textContent = HOURS[k] + ' h'; });
    el('path', { d: 'M0 ' + (H - B) + 'H' + W, stroke: 'rgba(244,242,241,.22)' }, svg);
  }

  /* ---------- abrir un día ---------- */
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); }, raf = null;
  function setFlex() { cols.forEach(function (c, i) { c.style.flexGrow = weights[i]; }); }
  function open(i, opts) {
    opts = opts || {};
    i = (i + D.length) % D.length;
    var from = weights.slice(), to = D.map(function (_, k) { return k === i ? openW() : 1; });
    cur = i; drawn = 0;
    cols.forEach(function (c, k) { var on = k === i; c.classList.toggle('is-open', on); c.setAttribute('aria-selected', on); c.tabIndex = on ? 0 : -1; });
    countEl.textContent = D[i].name + ' · ' + (i + 1) + ' de ' + D.length;
    tipEl.innerHTML = '<i aria-hidden="true"></i>' + D[i].tip;
    // en celular el detalle del día va debajo de la fila de días, a todo el ancho
    if (detail) detail.innerHTML = '<div class="rd__full">' + cols[i].querySelector('.rd__full').innerHTML + '</div>';
    if (opts.focus) cols[i].focus();
    if (raf) cancelAnimationFrame(raf);
    if (reduce || opts.instant) { weights = to; drawn = 1; setFlex(); draw(); return; }
    var t0 = performance.now(), dur = 700, dl = 650;
    var step = function (now) {
      var t = Math.min(1, (now - t0) / dur), e = ease(t);
      weights = from.map(function (f, k) { return f + (to[k] - f) * e; });
      drawn = ease(Math.max(0, Math.min(1, (now - t0 - dur * .55) / dl)));
      setFlex(); draw();
      if (t < 1 || drawn < 1) raf = requestAnimationFrame(step); else raf = null;
    };
    raf = requestAnimationFrame(step);
  }
  var auto = true, timer = null, visible = false;
  function stop() { auto = false; clearInterval(timer); }
  function play() { clearInterval(timer); if (auto && visible && !reduce) timer = setInterval(function () { open(cur + 1); }, 4800); }
  cols.forEach(function (c, i) { c.addEventListener('click', function () { stop(); if (i !== cur) open(i); }); });
  daysEl.addEventListener('keydown', function (e) {
    var dlt = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (dlt) { e.preventDefault(); stop(); open(cur + dlt, { focus: true }); }
  });
  document.getElementById('ridge-prev').addEventListener('click', function () { stop(); open(cur - 1); });
  document.getElementById('ridge-next').addEventListener('click', function () { stop(); open(cur + 1); });
  root.addEventListener('pointerdown', stop);
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
    var was = visible; visible = es[0].isIntersecting;
    if (visible && !was) { root.classList.add('is-in'); if (!root.dataset.played) { root.dataset.played = 1; open(cur); } play(); }
    if (!visible) clearInterval(timer);
  }, { threshold: .35 }).observe(root);
  if ('IntersectionObserver' in window) root.classList.add('pre');
  open(5, { instant: true });
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { weights = D.map(function (_, k) { return k === cur ? openW() : 1; }); setFlex(); draw(); }, 120); });
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
