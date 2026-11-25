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
