/* Vistorm Labs · escena del hero (papel recortado + topografía). Sin dependencias. */
(function(){'use strict';
/* ===== Vistorm hero · núcleo de simulación (sin DOM) ===== */
const W = 12, D = 9, LOOP = 10;            // local de 12 × 9 u (1 u = 1 m) · bucle de 10 s
const V_IN = 1.6, V_OUT = 1.8;             // u/s adentro y en la vereda
const RAMP = 0.25, FADE = 0.4;             // s de aceleración/frenado y de aparición en la vereda
const GRID = 4;                            // celdas de calor por unidad (0,25 u)
const HEAT_TAU = 14;                       // s · decaimiento del calor
const ZONE_TAU = 60;                       // s · ventana de "zona más visitada"
const DEP_WALK = 1.3, DEP_STOP = 3;          // calor depositado por segundo
const HEAT_SIGMA = 0.42;                   // u · radio del núcleo gaussiano

const ZONES = [
  { name: 'Mesa central',       x0: 3.8, x1: 9.6,  y0: 3.3, y1: 7.6 },
  { name: 'Estantes del fondo', x0: 0.8, x1: 8.2,  y0: 0,   y1: 2.6 },
  { name: 'Estante lateral',    x0: 0,   x1: 2.6,  y0: 2.6, y1: 9 },
  { name: 'Mostrador',          x0: 8.2, x1: 11.4, y0: 0,   y1: 2.8 },
  { name: 'Vidriera',           x0: 9.6, x1: 12,   y0: 2.8, y1: 5.1 },
  { name: 'Entrada',            x0: 9.6, x1: 12,   y0: 5.1, y1: 9 },
];

function P(x, y, stop, e, z) { return { x, y, z: z || 0, stop: stop || 0, e: e || null }; }

/* Recorridos: se repiten cada 10 s. look = [cuerpo, alto, ancho] */
const ROUTES = [
  { id: 'R1', s: 0.0, look: ['granate', 1.0, 1.0], note: 'Entra, se detiene en la mesa y sale',
    pts: [P(13.4, 9.5), P(13.05, 6.6), P(11.3, 6.5, 0, 'in'), P(6.2, 6.5, 2.6), P(11.3, 6.3), P(13.05, 6.3, 0, 'out'), P(13.4, 9.5)] },
  { id: 'R2', s: 2.2, look: ['carbon', 1.08, 0.95], note: 'Mesa (costado), estante lateral y sale',
    pts: [P(13.6, 9.6), P(13.1, 6.7), P(11.3, 6.6, 0, 'in'), P(7.4, 6.3, 2.2), P(4.2, 6.4), P(1.35, 4.9, 1.4), P(4.6, 6.8), P(11.3, 6.6), P(13.1, 6.6, 0, 'out'), P(13.6, 9.6)] },
  { id: 'R3', s: 4.6, look: ['caliza', 0.92, 1.15], note: 'Estantes del fondo',
    pts: [P(13.3, 9.4), P(13.0, 6.3), P(11.3, 6.3, 0, 'in'), P(5.9, 1.3, 1.4), P(3.0, 1.3, 1.2), P(8.0, 3.15), P(11.3, 6.4), P(13.0, 6.4, 0, 'out'), P(13.3, 9.4)] },
  { id: 'R4', s: 6.4, look: ['perla', 1.0, 1.05], note: 'Mostrador',
    pts: [P(13.2, 0.4), P(13.05, 6.2), P(11.3, 6.2, 0, 'in'), P(10.1, 5.2), P(9.7, 2.05, 1.8), P(10.1, 5.2), P(11.3, 6.3), P(13.05, 6.3, 0, 'out'), P(13.3, 9.5)] },
  { id: 'P1', s: 3.0, look: ['caliza', 1.06, 1.0], note: 'Pasa por la vereda',
    pts: [P(13.85, 0.3), P(13.85, 9.7)] },
  { id: 'P2', s: 7.6, look: ['carbon', 0.95, 1.1], note: 'Se frena en la vidriera y sigue',
    pts: [P(13.5, 9.7), P(13.0, 3.7, 1.6), P(13.45, 0.3)] },
];

function buildRoute(r) {
  const segs = []; let t = 0, dist = 0; r.events = [];
  for (let i = 0; i < r.pts.length - 1; i++) {
    const a = r.pts[i], b = r.pts[i + 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const v = (a.x > 12.2 && b.x > 12.2) ? V_OUT : V_IN;
    const T = L / v + RAMP;
    segs.push({ k: 'm', a, b, L, v, t0: t, T, d0: dist }); t += T; dist += L;
    if (b.e) r.events.push({ e: b.e, t });
    if (b.stop) { segs.push({ k: 's', a: b, b, t0: t, T: b.stop, d0: dist }); t += b.stop; }
  }
  r.segs = segs; r.dur = t;
  const [body, hf, wf] = r.look; r.lk = { body, hf, wf };
  return r;
}
ROUTES.forEach(buildRoute);

function along(seg, tau) {
  const { L, v, T } = seg, r = RAMP;
  if (L < v * r) { const u = Math.min(1, Math.max(0, tau / T)); return L * u * u * (3 - 2 * u); }
  if (tau < r) return v * tau * tau / (2 * r);
  if (tau > T - r) { const q = T - tau; return L - v * q * q / (2 * r); }
  return v * r / 2 + v * (tau - r);
}

function posAt(r, tau, out) {
  let seg = r.segs[r.segs.length - 1];
  for (let i = 0; i < r.segs.length; i++) { const s = r.segs[i]; if (tau < s.t0 + s.T) { seg = s; break; } }
  const lt = Math.min(seg.T, Math.max(0, tau - seg.t0));
  if (seg.k === 's') { out.x = seg.a.x; out.y = seg.a.y; out.z = seg.a.z || 0; out.dist = seg.d0; out.moving = false; out.stopT = lt; out.stopDur = seg.T; }
  else {
    const d = along(seg, lt), f = seg.L ? d / seg.L : 1;
    out.x = seg.a.x + (seg.b.x - seg.a.x) * f; out.y = seg.a.y + (seg.b.y - seg.a.y) * f; out.z = (seg.a.z || 0) + ((seg.b.z || 0) - (seg.a.z || 0)) * f;
    out.dist = seg.d0 + d; out.moving = true; out.stopT = 0; out.stopDur = 0;
    out.dir = seg.b.x - seg.b.y - (seg.a.x - seg.a.y); // >0: va hacia la derecha en pantalla
  }
  out.alpha = Math.min(1, tau / FADE, (r.dur - tau) / FADE);
  return out;
}

function isInside(x, y) { return x > 0.05 && x < W && y > 0.05 && y < D; }

/* Todas las personitas visibles en el instante t (función pura de t) */
function instances(t, out, skip, routes) {
  out.length = 0;
  for (const r of (routes || ROUTES)) {
    if (skip && skip.indexOf(r.id) >= 0) continue;
    const kMax = Math.floor((t - r.s) / LOOP), kMin = Math.ceil((t - r.s - r.dur) / LOOP);
    for (let k = kMin; k <= kMax; k++) {
      const tau = t - r.s - k * LOOP; if (tau < 0 || tau >= r.dur) continue;
      const p = posAt(r, tau, {}); p.r = r; p.tau = tau; p.k = k; out.push(p);
    }
  }
  return out;
}

const DWELL_SAMPLES = [238, 265, 301, 214, 247, 276, 229, 258, 291, 236];

class Sim {
  constructor(t0, venue) {
    this.v = venue || { routes: ROUTES, zones: ZONES, samples: DWELL_SAMPLES, dwell0: 252 };
    this.t = t0; this.GX = W * GRID; this.GY = D * GRID;
    this.heat = new Float32Array(this.GX * this.GY); this.ver = 0;
    this.visits = 0; this.exits = 0; this.dwell = this.v.dwell0;
    this.zoneT = new Float64Array(this.v.zones.length); this.leader = 0; this.share = 0; this.nextZone = 0;
    this.inst = [];
  }
  step(dt) {
    const t0 = this.t, t1 = t0 + dt;
    for (const r of this.v.routes) for (const ev of r.events) {
      const k = Math.floor((t1 - r.s - ev.t) / LOOP), te = r.s + k * LOOP + ev.t;
      if (te > t0 && te <= t1) {
        if (ev.e === 'in') this.visits++;
        else { this.exits++; const smp = this.v.samples[this.exits % this.v.samples.length]; this.dwell = this.dwell * 0.85 + smp * 0.15; }
      }
    }
    this.t = t1;
    instances(t1, this.inst, null, this.v.routes);
    const dec = Math.exp(-dt / HEAT_TAU), h = this.heat;
    for (let i = 0; i < h.length; i++) h[i] *= dec;
    const zdec = Math.exp(-dt / ZONE_TAU);
    for (let i = 0; i < this.zoneT.length; i++) this.zoneT[i] *= zdec;
    for (const p of this.inst) {
      if (!isInside(p.x, p.y) || p.z > 0.1) continue;
      this.deposit(p.x, p.y, (p.moving ? DEP_WALK : DEP_STOP) * dt);
      for (let i = 0; i < this.v.zones.length; i++) { const z = this.v.zones[i]; if (p.x >= z.x0 && p.x < z.x1 && p.y >= z.y0 && p.y < z.y1) { this.zoneT[i] += dt; break; } }
    }
    this.ver++;
    if (t1 >= this.nextZone) { this.nextZone = t1 + 2; this.updateZone(); }
  }
  deposit(x, y, amt) {
    const G = GRID, R = Math.ceil(HEAT_SIGMA * 2.5 * G), cx = Math.floor(x * G), cy = Math.floor(y * G);
    const inv = 1 / (2 * HEAT_SIGMA * HEAT_SIGMA);
    for (let j = cy - R; j <= cy + R; j++) { if (j < 0 || j >= this.GY) continue;
      for (let i = cx - R; i <= cx + R; i++) { if (i < 0 || i >= this.GX) continue;
        const dx = (i + 0.5) / G - x, dy = (j + 0.5) / G - y;
        this.heat[j * this.GX + i] += amt * Math.exp(-(dx * dx + dy * dy) * inv);
      } }
  }
  updateZone() {
    let tot = 0, best = 0; for (let i = 0; i < this.v.zones.length; i++) { tot += this.zoneT[i]; if (this.zoneT[i] > this.zoneT[best]) best = i; }
    if (!tot) return;
    const sh = i => this.zoneT[i] / tot;
    if (best !== this.leader && sh(best) > sh(this.leader) + 0.05) this.leader = best;
    this.share = sh(this.leader);
  }
  run(toT, dt) { dt = dt || 1 / 30; while (this.t < toT - 1e-9) this.step(Math.min(dt, toT - this.t)); return this; }
  snapshot() {
    return { t: this.t, heat: this.heat.slice(), ver: Math.random(), visits: this.visits, dwell: this.dwell, leader: this.leader, share: this.share };
  }
}

/* Umbrales de los 4 pasos de marquetería, relativos al máximo del régimen estable */
const HEAT_STEPS = [0.07, 0.2, 0.4, 0.66];
function calibrate(venue) {
  const s = new Sim(0, venue); s.run(80);
  let mx = 0; for (let n = 0; n < 300; n++) { s.step(1 / 30); for (const v of s.heat) if (v > mx) mx = v; }
  return HEAT_STEPS.map(f => f * mx);
}


/* ===== Rubros del carrusel: guiones de 10 s, zonas y cifras de ejemplo ===== */
const S_IN = [P(13.4, 9.5), P(13.05, 6.6), P(11.3, 6.5, 0, 'in')];
const N_IN = [P(13.2, 0.4), P(13.05, 6.2), P(11.3, 6.2, 0, 'in')];
const OUT_S = [P(11.3, 6.4), P(13.05, 6.4, 0, 'out'), P(13.4, 9.5)];
const OUT_N = [P(11.3, 6.3), P(13.05, 6.3, 0, 'out'), P(13.25, 0.4)];
const PASSERS = () => [
  { id: 'P1', s: 3.0, look: ['caliza', 1.06, 1.0], pts: [P(13.85, 0.3), P(13.85, 9.7)] },
  { id: 'P2', s: 7.6, look: ['carbon', 0.95, 1.1], pts: [P(13.5, 9.7), P(13.0, 3.7, 1.6), P(13.45, 0.3)] },
];
const Z = (name, x0, x1, y0, y1) => ({ name, x0, x1, y0, y1 });
const samplesAround = (m, d) => [0, 0.6, -0.4, 1, -0.8, 0.2, -0.2, 0.8, -0.6, 0.4].map(f => Math.round(m + f * d));

const VENUE_DEFS = [
  { id: 'tienda', name: 'Tienda de ropa', group: 'Retail y comercio', visits0: 1248, dwell0: 252, samples: DWELL_SAMPLES,
    routes: ROUTES,
    zones: [Z('Mesa central', 3.8, 9.6, 3.3, 7.6), Z('Percheros', 0.8, 8.2, 0, 2.6), Z('Probadores', 0, 2.6, 2.6, 9), Z('Caja', 8.2, 11.4, 0, 2.8), Z('Vidriera', 9.6, 12, 2.8, 5.1), Z('Entrada', 9.6, 12, 5.1, 9)] },
  { id: 'bar', name: 'Bar', group: 'Gastronomía y hotelería', visits0: 386, dwell0: 2280, samples: samplesAround(2280, 420),
    routes: [
      { id: 'B1', s: 0.0, look: ['granate', 1.0, 1.0], pts: [...S_IN, P(7.2, 2.45, 3.4), ...OUT_S] },
      { id: 'B2', s: 2.4, look: ['perla', 1.08, 0.95], pts: [...N_IN, P(3.35, 4.5, 3.4), P(8.4, 6.3), ...OUT_N] },
      { id: 'B3', s: 5.0, look: ['caliza', 0.92, 1.15], pts: [...S_IN, P(9.6, 2.45, 2.4), P(5.7, 6.85, 2.2), ...OUT_S] },
      { id: 'B4', s: 7.2, look: ['carbon', 1.0, 1.05], pts: [...N_IN, P(6.0, 2.45, 2.6), P(3.4, 6.95, 1.6), P(5.2, 6.5), ...OUT_N] },
      ...PASSERS(),
    ],
    zones: [Z('Barra', 4.5, 11.6, 0, 3.3), Z('Mesas', 0, 4.3, 3.3, 9), Z('Entrada', 10.6, 12, 5.6, 7.4)] },
  { id: 'shopping', name: 'Shopping', group: 'Centros comerciales', visits0: 8420, dwell0: 2820, samples: samplesAround(2820, 600),
    routes: [
      { id: 'S1', s: 0.0, look: ['granate', 1.0, 1.0], pts: [...S_IN, P(8.4, 6.35), P(6.0, 6.15), P(6.0, 5.45), P(6.0, 1.75, 0, null, 2.2), P(6.0, 1.4, 0, null, 2.2), P(9.0, 1.4, 1.4, null, 2.2), P(11.6, 1.4, 0, null, 2.2)] },
      { id: 'S2', s: 2.5, look: ['perla', 1.08, 0.95], pts: [...N_IN, P(9.4, 1.95, 2.0), P(7.9, 1.95, 1.6), P(7.7, 5.9), ...OUT_N] },
      { id: 'S3', s: 5.0, look: ['caliza', 0.92, 1.15], pts: [...S_IN, P(7.8, 6.7), P(4.4, 6.7), P(1.95, 6.9, 1.8), P(1.95, 3.7, 1.6), P(3.2, 1.95, 1.6), P(4.6, 6.5), ...OUT_S] },
      { id: 'S4', s: 7.5, look: ['carbon', 1.0, 1.05], pts: [...S_IN, P(9.2, 5.5, 2.6), P(10.4, 1.95, 1.4), ...OUT_S] },
      ...PASSERS(),
    ],
    zones: [Z('Local 1', 0.3, 4.6, 1.3, 3.0), Z('Local 2', 7.6, 11.7, 1.3, 3.0), Z('Local 3', 1.3, 3.4, 3.0, 5.3), Z('Local 4', 1.3, 3.4, 5.3, 8.6), Z('Plaza central', 7.0, 10.6, 3.0, 6.0), Z('Escalera mecánica', 5.2, 6.8, 1.6, 6.4)] },
  { id: 'aeropuerto', name: 'Aeropuerto', group: 'Transporte y movilidad', visits0: 12840, dwell0: 5100, samples: samplesAround(5100, 900),
    labels: { visits: 'Pasajeros' },
    routes: [
      { id: 'A1', s: 0.0, look: ['granate', 1.0, 1.0], bag: '#C7BCAC', pts: [...S_IN, P(7.9, 3.1), P(4.4, 3.1, 1.0), P(3.4, 3.1), P(3.4, 2.15, 2.6), P(2.6, 5.85, 2.4), P(5.2, 6.0), ...OUT_S] },
      { id: 'A2', s: 2.5, look: ['perla', 1.08, 0.95], bag: '#542433', pts: [...N_IN, P(7.9, 3.1), P(5.2, 3.1, 1.4), P(3.3, 3.1), P(3.3, 2.15), P(5.6, 2.15, 2.8), P(3.3, 2.3), P(3.3, 4.2), P(8.4, 4.2), P(9.8, 1.4), P(9.8, 0.35)] },
      { id: 'A3', s: 5.0, look: ['caliza', 0.92, 1.15], bag: '#272124', pts: [...S_IN, P(8.6, 5.0), P(9.3, 2.5, 1.6), P(9.8, 1.4), P(9.8, 0.35)] },
      { id: 'A4', s: 7.5, look: ['carbon', 1.0, 1.05], bag: '#8E5E69', pts: [...S_IN, P(7.6, 6.75), P(3.2, 7.2, 3.2), P(5.2, 6.9), ...OUT_S] },
      ...PASSERS(),
    ],
    zones: [Z('Check-in', 1.2, 7.6, 1.5, 2.7), Z('Fila', 3.8, 7.8, 2.7, 3.5), Z('Sala de espera', 1.2, 4.8, 5.5, 8.6), Z('Embarque', 8.6, 11, 0, 3.0), Z('Entrada', 10.6, 12, 5.6, 7.4)] },
];
VENUE_DEFS.forEach(v => v.routes.forEach(r => { if (!r.segs) buildRoute(r); }));
const RUBRO_SECS = 10;   // cada rubro se muestra un bucle completo
const FADE_SECS = 0.9;   // transición entre rubros


/* ===== Vistorm hero · dibujo en canvas (papel recortado + marquetería) ===== */
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const COL = {
  granate: '#542433', granateSombra: '#431C29', granateLuz: '#6A3243', granateNicho: '#3A1823',
  cobre: '#C1774B', caliza: '#C7BCAC', calizaClaro: '#DDD5CA', calizaOscuro: '#A99D8C',
  perla: '#F4F2F1', carbon: '#272124', petroleo: '#2F5D5A', verdeAgua: '#8FB5AE', cabeza: '#E7DFD6',
};
const BODY_EDGE = { granate: '#38161F', carbon: '#120E10', caliza: '#968A79', perla: '#C9BFB3' };
const HEAT_RGB = [null, [0xDC, 0xC0, 0x9C], [0xD2, 0x9A, 0x6E], [0xC1, 0x77, 0x4B], [0x9C, 0x56, 0x31]];
const SEAM = [0x54, 0x24, 0x33];
let THRESH = null;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/* ---------- geometría del local ---------- */
function B(x0, x1, y0, y1, z0, z1) { return { x0, x1, y0, y1, z0, z1 }; }
const FIX = [];   // muebles (se ordenan con las personas)
(function buildFixtures() {
  const r = rng(7);
  const prodCols = [COL.granate, COL.caliza, COL.carbon, COL.perla, COL.granateLuz, COL.calizaOscuro];
  function faceProducts(axis, from, to, plane) {
    const out = [];
    for (const [za, zb] of [[0.1, 0.47], [0.6, 0.98]]) {
      let p = from + 0.08;
      while (p < to - 0.2) {
        const w = 0.16 + r() * 0.24, h = (zb - za) * (0.6 + r() * 0.4);
        if (p + w > to - 0.08) break;
        out.push({ axis, plane, a: p, b: p + w, z0: za, z1: za + h, c: prodCols[Math.floor(r() * prodCols.length)] });
        p += w + 0.05 + r() * 0.08;
      }
    }
    return out;
  }
  const wood = { top: COL.perla, fy: COL.calizaClaro, fx: COL.caliza, edge: '#FFFFFF' };
  const dark = { top: COL.perla, fy: COL.granate, fx: COL.granateSombra, edge: '#FFFFFF' };
  FIX.push({ name: 'shelfBack', b: B(1.2, 7.2, 0, 0.62, 0, 1.15), c: wood, split: 'x', face: faceProducts('x', 1.2, 7.2, 0.62), items: [] });
  FIX.push({ name: 'shelfLeft', b: B(0, 0.62, 1.4, 7.2, 0, 1.15), c: wood, split: 'y', face: faceProducts('y', 1.4, 7.2, 0.62), items: [] });
  const st = (x, y, w, d, n, c) => { const out = []; for (let i = 0; i < n; i++) out.push({ b: B(x, x + w, y, y + d, 0, 0), dz: i * 0.07, c }); return out; };
  function stacks(base, list) { return list.map(([x, y, w, d, h, c]) => ({ b: B(x, x + w, y, y + d, base, base + h), c })); }
  FIX.push({ name: 'table', b: B(4.6, 7.0, 4.0, 5.6, 0, 0.72), c: dark, split: 'x', face: [],
    items: stacks(0.72, [[4.8, 4.2, 0.5, 0.45, 0.2, COL.perla], [5.45, 4.2, 0.5, 0.45, 0.14, COL.caliza], [6.15, 4.25, 0.5, 0.45, 0.24, COL.carbon],
      [4.85, 4.95, 0.5, 0.45, 0.12, COL.granateLuz], [5.55, 4.95, 0.5, 0.45, 0.22, COL.perla], [6.2, 4.95, 0.5, 0.45, 0.16, COL.calizaOscuro]]) });
  FIX.push({ name: 'counter', b: B(8.6, 10.9, 0.5, 1.4, 0, 0.95), c: dark, split: 'x', face: [],
    items: stacks(0.95, [[9.1, 0.75, 0.42, 0.34, 0.1, COL.carbon], [10.1, 0.7, 0.3, 0.42, 0.3, COL.calizaClaro]]) });
  FIX.push({ name: 'podium', b: B(10.65, 11.55, 2.6, 4.6, 0, 0.42), c: wood, split: 'y', face: [],
    items: stacks(0.42, [[10.8, 2.8, 0.55, 0.5, 0.26, COL.granate], [10.85, 3.5, 0.5, 0.4, 0.62, COL.perla], [10.8, 4.05, 0.55, 0.42, 0.16, COL.caliza]]) });
  // muros bajos del frente (se ordenan con las personas)
  const fw = { top: COL.granateLuz, fy: COL.granate, fx: COL.granateSombra };
  FIX.push({ name: 'front1', b: B(12, 12.22, -0.25, 2.3, 0, 0.35), c: fw, split: 'y', face: [], items: [] });
  FIX.push({ name: 'sill', b: B(12, 12.22, 2.3, 4.9, 0, 0.16), c: fw, split: 'y', face: [], items: [] });
  FIX.push({ name: 'front2', b: B(12, 12.22, 4.9, 5.55, 0, 0.35), c: fw, split: 'y', face: [], items: [] });
  FIX.push({ name: 'jambA', b: B(12, 12.22, 5.55, 5.75, 0, 1.05), c: fw, split: 'y', face: [], items: [] });
  FIX.push({ name: 'jambB', b: B(12, 12.22, 7.15, 7.35, 0, 1.05), c: fw, split: 'y', face: [], items: [] });
  FIX.push({ name: 'front3', b: B(12, 12.22, 7.35, 9.22, 0, 0.35), c: fw, split: 'y', face: [], items: [] });
  FIX.push({ name: 'frontL', b: B(-0.25, 12, 9, 9.22, 0, 0.35), c: fw, split: 'x', face: [], items: [] });
})();

/* divide cada mueble en trozos de ≤ 1 u para ordenar bien con las personas */
const CHUNKS = [];
(function chunk() {
  for (const f of FIX) {
    const { x0, x1, y0, y1, z0, z1 } = f.b;
    const ax = f.split, a0 = ax === 'x' ? x0 : y0, a1 = ax === 'x' ? x1 : y1;
    const n = Math.max(1, Math.ceil((a1 - a0) / 0.9));
    for (let i = 0; i < n; i++) {
      const c0 = a0 + (a1 - a0) * i / n, c1 = a0 + (a1 - a0) * (i + 1) / n;
      const b = ax === 'x' ? B(c0, c1, y0, y1, z0, z1) : B(x0, x1, c0, c1, z0, z1);
      const last = i === n - 1;
      const inR = v => v >= c0 && v < c1 + (last ? 1e-6 : 0);
      CHUNKS.push({
        f, b, last, ax,
        face: f.face.filter(p => inR((p.a + p.b) / 2)),
        items: f.items.filter(it => inR(ax === 'x' ? (it.b.x0 + it.b.x1) / 2 : (it.b.y0 + it.b.y1) / 2))
          .sort((p, q) => (p.b.x0 + p.b.y0) - (q.b.x0 + q.b.y0)),
        d: (b.x0 + b.x1) / 2 + (b.y0 + b.y1) / 2,
      });
    }
  }
})();

/* ---------- textura de papel ---------- */
let PAPER = null;
function paperTile() {
  if (PAPER) return PAPER;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), img = x.createImageData(256, 256), r = rng(42);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 200 + r() * 55; img.data[i] = img.data[i + 1] = img.data[i + 2] = n; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  x.globalAlpha = 0.08; x.strokeStyle = '#000';
  for (let i = 0; i < 90; i++) { // fibras
    x.lineWidth = 0.4 + r() * 0.8; x.beginPath();
    const px = r() * 256, py = r() * 256, a = r() * Math.PI, l = 6 + r() * 18;
    x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + (r() - 0.5) * 6, py + Math.sin(a) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  PAPER = c; return c;
}

/* ---------- renderizador ---------- */
class Scene {
  constructor(canvas, L) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.L = L; this.heatVer = null; this.heatAt = 0; this.inst = []; }
  P(x, y, z) { const L = this.L; return [L.ox + (x - y) * C30 * L.k, L.oy + (x + y) * S30 * L.k - (z || 0) * L.k]; }
  resize(scale) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.px = scale * dpr;
    const w = Math.round(this.L.w * this.px), h = Math.round(this.L.h * this.px);
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    this.base = this.shadows = null; this.heatVer = null;
    this.res = Math.max(8, Math.min(20, Math.round(this.L.k * this.px / 2)));
  }
  layer() { const c = document.createElement('canvas'); c.width = this.cv.width; c.height = this.cv.height; const x = c.getContext('2d'); x.setTransform(this.px, 0, 0, this.px, 0, 0); return [c, x]; }
  poly(x, pts) { x.beginPath(); pts.forEach((p, i) => { const q = this.P(p[0], p[1], p[2]); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.closePath(); }
  fill(x, pts, c) { this.poly(x, pts); x.fillStyle = c; x.strokeStyle = c; x.lineWidth = 0.6; x.fill(); x.stroke(); }
  box(x, b, c, edges) {
    const { x0, x1, y0, y1, z0, z1 } = b;
    this.fill(x, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], c.fy);
    this.fill(x, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], c.fx);
    this.fill(x, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], c.top);
    if (c.edge && edges !== false) {
      x.save(); x.globalAlpha = 0.85; x.strokeStyle = c.edge; x.lineWidth = 1; x.beginPath();
      const a = this.P(x0, y1, z1), m = this.P(x1, y1, z1), e = this.P(x1, y0, z1);
      x.moveTo(a[0], a[1]); x.lineTo(m[0], m[1]);
      if (edges === undefined || edges === 'all') x.lineTo(e[0], e[1]);
      x.stroke(); x.restore();
    }
  }
  /* base estática: fondo, plataforma, vereda, piso y muros del fondo */
  buildBase() {
    const [c, x] = this.layer(), L = this.L;
    x.fillStyle = COL.perla; x.fillRect(0, 0, L.w, L.h);
    // sombra general de la pieza
    x.save(); x.shadowColor = 'rgba(39,33,36,0.28)'; x.shadowBlur = 34 * this.px; x.shadowOffsetY = 18 * this.px;
    this.poly(x, [[-0.45, -0.45, -0.5], [14.4, -0.45, -0.5], [14.4, 10.3, -0.5], [-0.45, 10.3, -0.5]]); x.fillStyle = COL.caliza; x.fill(); x.restore();
    // capas de la plataforma (papel apilado)
    this.box(x, B(-0.45, 12.42, -0.45, 9.42, -0.52, -0.3), { top: COL.granateSombra, fy: COL.granateNicho, fx: '#2E121B' }, false);
    this.box(x, B(-0.25, 12.22, -0.25, 9.22, -0.3, 0), { top: COL.calizaClaro, fy: COL.granate, fx: COL.granateSombra }, false);
    // vereda
    this.box(x, B(12.22, 14.4, -1.1, 10.3, -0.42, -0.06), { top: COL.calizaClaro, fy: COL.calizaOscuro, fx: '#988C7B' }, false);
    x.save(); x.strokeStyle = 'rgba(169,157,140,0.7)'; x.lineWidth = 1;
    for (let y = -0.4; y < 10.3; y += 1.15) { x.beginPath(); const a = this.P(12.3, y, -0.06), b = this.P(14.4, y, -0.06); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
    x.restore();
    // piso (caliza) y umbral
    this.fill(x, [[0, 0, 0], [12, 0, 0], [12, 9, 0], [0, 9, 0]], COL.caliza);
    this.fill(x, [[12, 5.75, 0], [12.22, 5.75, 0], [12.22, 7.15, 0], [12, 7.15, 0]], COL.calizaClaro);
    // muros del fondo
    const H = 2.0;
    this.box(x, B(-0.25, 12.22, -0.25, 0, 0, H), { top: COL.granateLuz, fy: COL.granate, fx: COL.granateSombra }, false);
    this.box(x, B(-0.25, 0, 0, 9.22, 0, H), { top: COL.granateLuz, fy: COL.granateSombra, fx: '#4B2030' }, false);
    // nichos en arco (capas recortadas)
    const arch = (cx, w, z0, z1, plane) => {
      const pts = [], r = w / 2;
      pts.push([cx - r, z0]); pts.push([cx - r, z1 - r]);
      for (let i = 0; i <= 16; i++) { const a = Math.PI - i * Math.PI / 16; pts.push([cx + Math.cos(a) * r, z1 - r + Math.sin(a) * r]); }
      pts.push([cx + r, z0]);
      return pts.map(([u, z]) => plane === 'y0' ? [u, 0, z] : [0, u, z]);
    };
    for (const cx of [2.3, 4.6, 6.9, 9.8]) {
      this.fill(x, arch(cx + 0.04, 1.5, 0.12, 1.86, 'y0'), COL.granateLuz);
      this.fill(x, arch(cx, 1.34, 0.12, 1.74, 'y0'), COL.granateNicho);
    }
    for (const cx of [2.6, 4.9, 7.2]) {
      this.fill(x, arch(cx + 0.04, 1.5, 0.12, 1.86, 'x0'), '#5A2838');
      this.fill(x, arch(cx, 1.34, 0.12, 1.74, 'x0'), '#2F121B');
    }
    // planta (apoyo, petróleo y verde agua a validar)
    this.plant(x, 0.62, 0.72);
    this.base = c;
  }
  plant(x, px, py) {
    const k = this.L.k, [sx, sy] = this.P(px, py, 0);
    x.save(); x.translate(sx, sy);
    x.fillStyle = COL.calizaOscuro; x.beginPath(); x.ellipse(0, 0, 0.3 * k, 0.15 * k, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = COL.calizaClaro; x.fillRect(-0.3 * k, -0.55 * k, 0.6 * k, 0.55 * k);
    x.beginPath(); x.ellipse(0, -0.55 * k, 0.3 * k, 0.15 * k, 0, 0, Math.PI * 2); x.fill();
    const leaves = [[-0.9, 1.1], [-0.4, 1.35], [0.1, 1.45], [0.55, 1.25], [0.95, 1.0], [-0.15, 1.05], [0.35, 0.95]];
    leaves.forEach(([a, l], i) => {
      x.save(); x.translate(0, -0.55 * k); x.rotate(a * 0.75);
      x.fillStyle = i % 2 ? COL.petroleo : '#3D716D';
      x.beginPath(); x.ellipse(0, -l * 0.42 * k, 0.11 * k, l * 0.42 * k, 0, 0, Math.PI * 2); x.fill();
      x.restore();
    });
    x.restore();
  }
  /* sombras de los muebles (encima del calor, debajo de los muebles) */
  buildShadows() {
    const [c, x] = this.layer();
    x.save(); x.shadowColor = 'rgba(39,33,36,0.30)'; x.shadowBlur = 10 * this.px; x.shadowOffsetX = 3 * this.px; x.shadowOffsetY = 4 * this.px;
    x.fillStyle = 'rgba(39,33,36,0.16)';
    for (const f of FIX) {
      if (f.name.startsWith('front') || f.name === 'sill' || f.name.startsWith('jamb') || f.name === 'frontL') continue;
      const { x0, x1, y0, y1 } = f.b, s = 0.14;
      this.poly(x, [[x0, y0, 0], [x1 + s, y0, 0], [x1 + s, y1 + s, 0], [x0, y1 + s, 0]]); x.fill();
    }
    // sombra de los muros del fondo sobre el piso
    x.shadowBlur = 16 * this.px; x.shadowOffsetX = 0; x.shadowOffsetY = 0;
    x.fillStyle = 'rgba(39,33,36,0.10)';
    this.poly(x, [[0, 0, 0], [12, 0, 0], [12, 0.25, 0], [0, 0.25, 0]]); x.fill();
    this.poly(x, [[0, 0, 0], [0.25, 0, 0], [0.25, 9, 0], [0, 9, 0]]); x.fill();
    x.restore();
    this.shadows = c;
  }
  /* incrustación de marquetería a partir del campo de calor */
  buildHeat(heat) {
    const res = this.res, w = 12 * res, h = 9 * res, GX = 48, GY = 36;
    if (!this.heatCv || this.heatCv.width !== w) { this.heatCv = document.createElement('canvas'); this.heatCv.width = w; this.heatCv.height = h; this.heatImg = this.heatCv.getContext('2d').createImageData(w, h); this.lv = new Uint8Array(w * h); }
    const T = THRESH, lv = this.lv, d = this.heatImg.data;
    for (let py = 0; py < h; py++) {
      const gy = ((py + 0.5) / res) * 4 - 0.5, j0 = Math.max(0, Math.min(GY - 1, Math.floor(gy))), j1 = Math.min(GY - 1, j0 + 1), fy = Math.max(0, Math.min(1, gy - j0));
      for (let px = 0; px < w; px++) {
        const gx = ((px + 0.5) / res) * 4 - 0.5, i0 = Math.max(0, Math.min(GX - 1, Math.floor(gx))), i1 = Math.min(GX - 1, i0 + 1), fx = Math.max(0, Math.min(1, gx - i0));
        const v = (heat[j0 * GX + i0] * (1 - fx) + heat[j0 * GX + i1] * fx) * (1 - fy) + (heat[j1 * GX + i0] * (1 - fx) + heat[j1 * GX + i1] * fx) * fy;
        lv[py * w + px] = v >= T[3] ? 4 : v >= T[2] ? 3 : v >= T[1] ? 2 : v >= T[0] ? 1 : 0;
      }
    }
    const ang = [0, 0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const i = py * w + px, l = lv[i], o = i * 4;
      if (!l) { d[o + 3] = 0; continue; }
      const u = px / res, v = py / res, a = ang[l];
      const g = 1 + 0.045 * Math.sin((u * Math.cos(a) + v * Math.sin(a)) * 34 + 1.6 * Math.sin((u * Math.sin(a) - v * Math.cos(a)) * 2.2 + l));
      const rgb = HEAT_RGB[l];
      const seam = (px + 1 < w && lv[i + 1] !== l) || (py + 1 < h && lv[i + w] !== l) || (px > 0 && lv[i - 1] < l) || (py > 0 && lv[i - w] < l);
      if (seam) { const m = 0.45; d[o] = rgb[0] * (1 - m) + SEAM[0] * m; d[o + 1] = rgb[1] * (1 - m) + SEAM[1] * m; d[o + 2] = rgb[2] * (1 - m) + SEAM[2] * m; }
      else { d[o] = Math.min(255, rgb[0] * g); d[o + 1] = Math.min(255, rgb[1] * g); d[o + 2] = Math.min(255, rgb[2] * g); }
      d[o + 3] = 255;
    }
    this.heatCv.getContext('2d').putImageData(this.heatImg, 0, 0);
  }
  personShadow(x, p) {
    const k = this.L.k, [sx, sy] = this.P(p.x, p.y, p.z || 0), wf = p.r.lk.wf;
    x.save(); x.globalAlpha = p.alpha; x.translate(sx + 0.12 * k, sy + 0.02 * k); x.scale(1, 0.42);
    const R = 0.42 * k * wf, g = x.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, 'rgba(39,33,36,0.30)'); g.addColorStop(0.6, 'rgba(39,33,36,0.14)'); g.addColorStop(1, 'rgba(39,33,36,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2); x.fill(); x.restore();
  }
  person(x, p) {
    const k = this.L.k, lk = p.r.lk, [sx, sy] = this.P(p.x, p.y, p.z || 0);
    const bw = 0.40 * lk.wf * k, bh = 0.80 * lk.hf * k, hd = 0.34 * lk.hf * k, gap = 0.06 * k;
    const ph = p.dist / 0.55 * Math.PI;
    const bob = p.moving ? Math.abs(Math.sin(ph)) * 0.045 * k : Math.sin(p.stopT * 2.4) * 0.008 * k;
    const tilt = p.moving ? Math.sin(ph) * 0.045 : 0;
    const capsule = (ox, oy) => {
      const r = bw / 2; x.beginPath();
      x.moveTo(ox - r, oy - bh + r); x.arc(ox, oy - bh + r, r, Math.PI, 0); x.lineTo(ox + r, oy - r); x.arc(ox, oy - r, r, 0, Math.PI); x.closePath();
    };
    const head = (ox, oy) => { x.beginPath(); x.arc(ox, oy - bh - gap - hd / 2, hd / 2, 0, Math.PI * 2); };
    x.save(); x.globalAlpha = p.alpha; x.translate(sx, sy - bob); x.rotate(tilt);
    const e = Math.max(1, 0.035 * k);
    // canto del papel
    x.fillStyle = BODY_EDGE[lk.body]; capsule(e, e * 0.6); x.fill(); x.fillStyle = '#B8ACA0'; head(e, e * 0.6); x.fill();
    // silueta
    x.shadowColor = 'rgba(39,33,36,0.22)'; x.shadowBlur = 4 * this.px; x.shadowOffsetX = 1.5 * this.px; x.shadowOffsetY = 1.5 * this.px;
    x.fillStyle = COL[lk.body]; capsule(0, 0); x.fill();
    x.fillStyle = COL.cabeza; head(0, 0); x.fill();
    x.shadowColor = 'transparent';
    if (lk.body === 'perla') { x.strokeStyle = 'rgba(169,157,140,0.8)'; x.lineWidth = 0.8; capsule(0, 0); x.stroke(); }
    x.restore();
  }
  chunk(x, ch) {
    const f = ch.f, b = ch.b;
    const edges = f.c.edge ? (ch.ax === 'x' ? (ch.last ? 'all' : 'front') : 'all') : false;
    this.box(x, b, f.c, edges);
    for (const p of ch.face) {
      if (p.axis === 'x') this.fill(x, [[p.a, p.plane, p.z0], [p.b, p.plane, p.z0], [p.b, p.plane, p.z1], [p.a, p.plane, p.z1]], p.c);
      else this.fill(x, [[p.plane, p.a, p.z0], [p.plane, p.b, p.z0], [p.plane, p.b, p.z1], [p.plane, p.a, p.z1]], p.c);
    }
    if (ch.face.length) { // listón del estante
      const z = 0.53, z2 = 0.57;
      if (ch.ax === 'x') this.fill(x, [[b.x0, b.y1, z], [b.x1, b.y1, z], [b.x1, b.y1, z2], [b.x0, b.y1, z2]], COL.perla);
      else this.fill(x, [[b.x1, b.y0, z], [b.x1, b.y1, z], [b.x1, b.y1, z2], [b.x1, b.y0, z2]], COL.perla);
    }
    for (const it of ch.items) {
      const c = it.c, dk = shade(c, -0.16), dk2 = shade(c, -0.28);
      this.box(x, it.b, { top: c, fy: dk, fx: dk2, edge: 'rgba(255,255,255,0.6)' });
    }
  }
  draw(state, t) {
    const x = this.ctx, L = this.L;
    if (!this.base) this.buildBase();
    if (!this.shadows) this.buildShadows();
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(this.base, 0, 0);
    x.setTransform(this.px, 0, 0, this.px, 0, 0);
    // calor
    const now = performance.now();
    if (this.heatVer !== state.ver && (now - this.heatAt > 150 || this.heatVer === null)) { this.buildHeat(state.heat); this.heatVer = state.ver; this.heatAt = now; }
    if (this.heatCv) {
      x.save(); const r = this.res, k = L.k;
      x.transform(C30 * k / r, S30 * k / r, -C30 * k / r, S30 * k / r, L.ox, L.oy);
      x.imageSmoothingEnabled = true; x.drawImage(this.heatCv, 0, 0); x.restore();
    }
    x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(this.shadows, 0, 0); x.setTransform(this.px, 0, 0, this.px, 0, 0);
    // personas + muebles ordenados por profundidad
    const inst = instances(t, this.inst, L.skip);
    for (const p of inst) this.personShadow(x, p);
    const list = CHUNKS.map(c => ({ d: c.d, c }));
    for (const p of inst) list.push({ d: p.x + p.y + 0.05, p });
    list.sort((a, b) => a.d - b.d);
    for (const it of list) it.c ? this.chunk(x, it.c) : this.person(x, it.p);
    // grano de papel encima de todo
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.1;
    x.fillStyle = x.createPattern(paperTile(), 'repeat'); x.fillRect(0, 0, this.cv.width, this.cv.height); x.restore();
  }
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = f < 0 ? 0 : 255, a = Math.abs(f); r = Math.round(r + (m - r) * a); g = Math.round(g + (m - g) * a); b = Math.round(b + (m - b) * a);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/* ===== Variaciones: topografía, líneas de flujo y vidriera ===== */
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function blurGrid(src, GX, GY, passes) {
  let a = Float32Array.from(src), b = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) { let s = 0, n = 0; for (let d = -1; d <= 1; d++) { const ii = i + d; if (ii >= 0 && ii < GX) { s += a[j * GX + ii]; n++; } } b[j * GX + i] = s / n; }
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) { let s = 0, n = 0; for (let d = -1; d <= 1; d++) { const jj = j + d; if (jj >= 0 && jj < GY) { s += b[jj * GX + i]; n++; } } a[j * GX + i] = s / n; }
  }
  return a;
}
function sampleGrid(g, x, y) {
  const GX = 48, GY = 36, gx = x * 4 - 0.5, gy = y * 4 - 0.5;
  const i0 = Math.max(0, Math.min(GX - 1, Math.floor(gx))), i1 = Math.min(GX - 1, i0 + 1), fx = clamp01(gx - i0);
  const j0 = Math.max(0, Math.min(GY - 1, Math.floor(gy))), j1 = Math.min(GY - 1, j0 + 1), fy = clamp01(gy - j0);
  return (g[j0 * GX + i0] * (1 - fx) + g[j0 * GX + i1] * fx) * (1 - fy) + (g[j1 * GX + i0] * (1 - fx) + g[j1 * GX + i1] * fx) * fy;
}
function chaikin(pts, it) {
  for (let n = 0; n < it; n++) {
    const o = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    o.push(pts[pts.length - 1]); pts = o;
  }
  return pts;
}

/* ---------- base común de las variantes isométricas ---------- */
class SceneVar extends Scene {
  constructor(cv, L, opt) { super(cv, L); this.opt = opt; this.since = -1e9; }
  isoT(x) { const L = this.L, k = L.k; x.transform(C30 * k, S30 * k, -C30 * k, S30 * k, L.ox, L.oy); }
  /* nichos en arco escalonados, con luz adentro (referencias: vidriera y shopping) */
  archLayers(x, plane, cx, w, z0, z1, lit) {
    const shape = (c, ww, zt) => {
      const r = ww / 2, pts = [[c - r, z0], [c - r, zt - r]];
      for (let i = 0; i <= 18; i++) { const a = Math.PI - i * Math.PI / 18; pts.push([c + Math.cos(a) * r, zt - r + Math.sin(a) * r]); }
      pts.push([c + r, z0]);
      return pts.map(([u, z]) => plane === 'y0' ? [u, 0, z] : [0, u, z]);
    };
    const side = plane === 'y0';
    this.fill(x, shape(cx + 0.05, w + 0.34, z1 + 0.17), side ? '#6A3243' : '#5A2838');
    this.fill(x, shape(cx + 0.03, w + 0.16, z1 + 0.08), side ? '#4B2030' : '#3E1A26');
    this.fill(x, shape(cx, w, z1), lit[0]);
    // capa curva interior (papel), como en las vidrieras de referencia
    const r = w / 2, inner = [];
    for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI / 2; inner.push([cx - r + Math.sin(a) * w * 0.95, z0 + (1 - Math.cos(a)) * (z1 - z0) * 0.62]); }
    inner.push([cx + r, z0]);
    this.fill(x, [[cx - r, z0], ...inner].map(([u, z]) => plane === 'y0' ? [u, 0, z] : [0, u, z]), lit[1]);
  }
  plantBig(x, px, py, s) {
    const k = this.L.k * (s || 1), [sx, sy] = this.P(px, py, 0);
    x.save(); x.translate(sx, sy);
    x.fillStyle = 'rgba(39,33,36,0.18)'; x.beginPath(); x.ellipse(0.1 * k, 0.02 * k, 0.42 * k, 0.17 * k, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = COL.calizaClaro; x.beginPath(); x.moveTo(-0.32 * k, -0.62 * k); x.lineTo(0.32 * k, -0.62 * k); x.lineTo(0.26 * k, 0); x.lineTo(-0.26 * k, 0); x.closePath(); x.fill();
    x.fillStyle = COL.caliza; x.beginPath(); x.ellipse(0, -0.62 * k, 0.32 * k, 0.12 * k, 0, 0, Math.PI * 2); x.fill();
    const L = [[-1.15, 1.5], [-0.75, 1.85], [-0.3, 2.0], [0.15, 1.9], [0.6, 1.75], [1.05, 1.45], [-0.5, 1.3], [0.4, 1.3]];
    L.forEach(([a, l], i) => {
      x.save(); x.translate(0, -0.62 * k); x.rotate(a * 0.62);
      const w = 0.24 * k, h = l * 0.5 * k;
      x.fillStyle = i % 3 === 0 ? COL.petroleo : i % 3 === 1 ? '#5E8F89' : COL.verdeAgua;
      x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(w, -h * 0.55, 0, -h); x.quadraticCurveTo(-w, -h * 0.55, 0, 0); x.fill();
      x.strokeStyle = 'rgba(39,33,36,0.25)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(0, -h * 0.1); x.lineTo(0, -h * 0.9); x.stroke();
      x.restore();
    });
    x.restore();
  }
  person(x, p) {
    if (p.moving && this.opt.ghost) {
      const lk = p.r.lk, k = this.L.k;
      for (const [dt, al] of [[0.16, 0.1], [0.08, 0.18]]) {
        const q = posAt(p.r, Math.max(0, p.tau - dt), {}); const [sx, sy] = this.P(q.x, q.y, q.z || 0);
        const bw = 0.40 * lk.wf * k, bh = 0.80 * lk.hf * k, hd = 0.34 * lk.hf * k, r = bw / 2;
        x.save(); x.globalAlpha = al * p.alpha; x.fillStyle = COL[lk.body];
        x.beginPath(); x.moveTo(sx - r, sy - bh + r); x.arc(sx, sy - bh + r, r, Math.PI, 0); x.lineTo(sx + r, sy - r); x.arc(sx, sy - r, r, 0, Math.PI); x.closePath(); x.fill();
        x.beginPath(); x.arc(sx, sy - bh - 0.06 * k - hd / 2, hd / 2, 0, Math.PI * 2); x.fill(); x.restore();
      }
    }
    super.person(x, p);
  }
  chunkStyled(x, ch) {
    const ov = this.opt.fix && this.opt.fix[ch.f.name];
    if (ov === null) return;
    if (ov) { const keep = ch.f.c; ch.f.c = ov; this.chunk(x, ch); ch.f.c = keep; } else this.chunk(x, ch);
    if (this.opt.fluted && this.opt.fluted.indexOf(ch.f.name) >= 0) this.flutes(x, ch.b);
  }
  flutes(x, b) {
    x.save(); x.strokeStyle = 'rgba(39,33,36,0.22)'; x.lineWidth = 1;
    const z0 = b.z0 + 0.04, z1 = b.z1 - 0.04;
    for (let u = b.x0 + 0.09; u < b.x1; u += 0.13) { const a = this.P(u, b.y1, z0), c = this.P(u, b.y1, z1); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(c[0], c[1]); x.stroke(); }
    for (let u = b.y0 + 0.09; u < b.y1; u += 0.13) { const a = this.P(b.x1, u, z0), c = this.P(b.x1, u, z1); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(c[0], c[1]); x.stroke(); }
    x.restore();
  }
  draw(state, t) {
    const x = this.ctx;
    if (!this.base) this.buildBase();
    if (!this.shadows) this.buildShadows();
    x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(this.base, 0, 0);
    x.setTransform(this.px, 0, 0, this.px, 0, 0);
    this.floorLayer(x, state, t);
    x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(this.shadows, 0, 0); x.setTransform(this.px, 0, 0, this.px, 0, 0);
    const inst = instances(t, this.inst, this.L.skip);
    for (const p of inst) this.personShadow(x, p);
    const list = CHUNKS.map(c => ({ d: c.d, c }));
    for (const p of inst) list.push({ d: p.x + p.y + 0.05, p });
    list.sort((a, b) => a.d - b.d);
    for (const it of list) it.c ? this.chunkStyled(x, it.c) : this.person(x, it.p);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.12;
    x.fillStyle = x.createPattern(paperTile(), 'repeat'); x.fillRect(0, 0, this.cv.width, this.cv.height); x.restore();
  }
  baseCommon(x, floorCol, slabTop) {
    const L = this.L;
    x.fillStyle = COL.perla; x.fillRect(0, 0, L.w, L.h);
    x.save(); x.shadowColor = 'rgba(39,33,36,0.28)'; x.shadowBlur = 34 * this.px; x.shadowOffsetY = 18 * this.px;
    this.poly(x, [[-0.45, -0.45, -0.5], [14.4, -0.45, -0.5], [14.4, 10.3, -0.5], [-0.45, 10.3, -0.5]]); x.fillStyle = COL.caliza; x.fill(); x.restore();
    this.box(x, B(-0.45, 12.42, -0.45, 9.42, -0.52, -0.3), { top: COL.granateSombra, fy: COL.granateNicho, fx: '#2E121B' }, false);
    this.box(x, B(-0.25, 12.22, -0.25, 9.22, -0.3, 0), { top: slabTop, fy: COL.granate, fx: COL.granateSombra }, false);
    this.box(x, B(12.22, 14.4, -1.1, 10.3, -0.42, -0.06), { top: COL.calizaClaro, fy: COL.calizaOscuro, fx: '#988C7B' }, false);
    x.save(); x.strokeStyle = 'rgba(169,157,140,0.7)'; x.lineWidth = 1;
    for (let y = -0.4; y < 10.3; y += 1.15) { x.beginPath(); const a = this.P(12.3, y, -0.06), b = this.P(14.4, y, -0.06); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
    x.restore();
    this.fill(x, [[0, 0, 0], [12, 0, 0], [12, 9, 0], [0, 9, 0]], floorCol);
    this.fill(x, [[12, 5.75, 0], [12.22, 5.75, 0], [12.22, 7.15, 0], [12, 7.15, 0]], COL.calizaClaro);
  }
  walls(x, H) {
    this.box(x, B(-0.25, 12.22, -0.25, 0, 0, H), { top: COL.granateLuz, fy: COL.granate, fx: COL.granateSombra }, false);
    this.box(x, B(-0.25, 0, 0, 9.22, 0, H), { top: COL.granateLuz, fy: COL.granateSombra, fx: '#4B2030' }, false);
  }
}

/* ---------- A · Topografía de papel ---------- */
const TOPO_COLS = ['#6A3243', '#8E5E69', '#C7BCAC', '#E6DFD7', '#C1774B'];
const TOPO_STEPS = [0.04, 0.1, 0.19, 0.31, 0.47];
class SceneTopo extends SceneVar {
  buildBase() {
    const [c, x] = this.layer();
    this.baseCommon(x, '#4A1F2D', '#4A1F2D');
    // veta de madera del piso (granate)
    x.save(); this.isoT(x); x.strokeStyle = 'rgba(106,50,67,0.55)'; x.lineWidth = 0.025; const r = rng(3);
    for (let y = 0.12; y < 9; y += 0.16 + r() * 0.1) { x.beginPath(); x.moveTo(0, y); for (let u = 0; u <= 12; u += 0.5) x.lineTo(u, y + Math.sin(u * 0.9 + y * 3) * 0.05); x.stroke(); }
    x.restore();
    this.walls(x, 2.2);
    for (const cx of [2.3, 4.6, 6.9, 9.8]) this.archLayers(x, 'y0', cx, 1.45, 0.12, 1.95, ['#E6DFD7', '#F4F2F1']);
    for (const cx of [2.6, 4.9, 7.2]) this.archLayers(x, 'x0', cx, 1.45, 0.12, 1.95, ['#C7BCAC', '#DDD5CA']);
    this.plantBig(x, 0.62, 0.72, 0.9);
    this.base = c;
  }
  floorLayer(x, state) {
    const now = performance.now();
    if (this.heatVer !== state.ver && (now - this.heatAt > 250 || this.heatVer === null)) { this.buildTopo(state.heat); this.heatVer = state.ver; this.heatAt = now; }
    if (this.topoCv) { x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(this.topoCv, 0, 0); x.setTransform(this.px, 0, 0, this.px, 0, 0); }
  }
  buildTopo(heat) {
    const res = this.res, w = 12 * res, h = 9 * res, g = blurGrid(heat, 48, 36, 2);
    const MAX = this.maxHeat || THRESH[3] / 0.66;
    if (!this.lvCv) { this.lvCv = TOPO_COLS.map(() => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }); }
    if (!this.topoCv) { this.topoCv = document.createElement('canvas'); }
    this.topoCv.width = this.cv.width; this.topoCv.height = this.cv.height;
    const vals = new Float32Array(w * h);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) { const u = (px + 0.5) / res, v = (py + 0.5) / res; vals[py * w + px] = this.masked && this.masked(u, v) ? 0 : sampleGrid(g, u, v); }
    const tx = this.topoCv.getContext('2d');
    TOPO_COLS.forEach((col, l) => {
      const T = TOPO_STEPS[l] * MAX, band = T * 0.1 + 1e-6, rgb = hexRgb(col);
      const cx = this.lvCv[l].getContext('2d'), img = cx.createImageData(w, h), d = img.data;
      for (let i = 0; i < vals.length; i++) {
        const a = clamp01((vals[i] - T) / band + 0.5); const o = i * 4;
        const u = (i % w) / res, v = Math.floor(i / w) / res;
        const gr = 1 + 0.035 * Math.sin((u + v * 0.35) * 30 + Math.sin(v * 2.1) * 2);
        d[o] = Math.min(255, rgb[0] * gr); d[o + 1] = Math.min(255, rgb[1] * gr); d[o + 2] = Math.min(255, rgb[2] * gr); d[o + 3] = a * 255;
      }
      cx.putImageData(img, 0, 0);
      tx.save(); tx.setTransform(this.px, 0, 0, this.px, 0, 0); this.isoT(tx); tx.scale(1 / res, 1 / res);
      tx.shadowColor = 'rgba(30,10,16,0.45)'; tx.shadowBlur = 5 * this.px; tx.shadowOffsetX = 1.5 * this.px; tx.shadowOffsetY = 2.5 * this.px;
      tx.drawImage(this.lvCv[l], 0, 0); tx.restore();
    });
  }
}

/* ---------- B · Líneas de flujo ---------- */
const FLOW_KEEP = 4;
const FLOW_PATHS = ROUTES.map(r => {
  const pts = chaikin(r.pts.map(p => [p.x, p.y]), 4);
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  let total = 0; for (let i = 0; i < r.pts.length - 1; i++) total += Math.hypot(r.pts[i + 1].x - r.pts[i].x, r.pts[i + 1].y - r.pts[i].y);
  const nrm = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
  return { r, pts, cum, len: cum[cum.length - 1], total, nrm };
});
class SceneFlow extends SceneVar {
  buildBase() {
    const [c, x] = this.layer();
    this.baseCommon(x, '#EAE4DD', '#EAE4DD');
    this.walls(x, 2.2);
    // percha con ropa colgada sobre el muro del fondo (referencia: boutique clara)
    x.save(); x.strokeStyle = '#B8ACA0'; x.lineWidth = 2;
    let p0 = this.P(1.0, 0, 1.62), p1 = this.P(8.0, 0, 1.62); x.beginPath(); x.moveTo(p0[0], p0[1]); x.lineTo(p1[0], p1[1]); x.stroke(); x.restore();
    const r = rng(11), cols = [COL.perla, '#E6DFD7', COL.caliza, COL.granateLuz, COL.perla, COL.calizaClaro, '#8E5E69'];
    for (let u = 1.15; u < 7.8;) {
      const w = 0.32 + r() * 0.16, len = 0.75 + r() * 0.45, c0 = cols[Math.floor(r() * cols.length)], m = u + w / 2;
      const hook = [this.P(m, 0.02, 1.62), this.P(m, 0.02, 1.55)];
      x.strokeStyle = '#9C8F80'; x.lineWidth = 1; x.beginPath(); x.moveTo(hook[0][0], hook[0][1]); x.lineTo(hook[1][0], hook[1][1]); x.stroke();
      this.fill(x, [[u + 0.06, 0.03, 1.55], [u + w - 0.06, 0.03, 1.55], [u + w, 0.03, 1.47], [u + w + 0.02, 0.03, 1.55 - len], [u - 0.02, 0.03, 1.55 - len], [u, 0.03, 1.47]], shade(c0, -0.12));
      this.fill(x, [[u + 0.06, 0.04, 1.55], [u + w - 0.06, 0.04, 1.55], [u + w - 0.02, 0.04, 1.47], [u + w - 0.01, 0.04, 1.57 - len], [u + 0.01, 0.04, 1.57 - len], [u + 0.02, 0.04, 1.47]], c0);
      u += w * 0.72 + 0.02;
    }
    // probadores en arco con cortina, muro izquierdo
    for (const cy of [3.2, 5.0]) {
      this.archLayers(x, 'x0', cy, 1.25, 0.0, 1.95, ['#3E1A26', '#3E1A26']);
      const cur = []; const rr = 0.62;
      for (let i = 0; i <= 12; i++) { const a = Math.PI - i * Math.PI / 12; cur.push([0, cy + Math.cos(a) * rr * 0.98, 1.95 - rr + Math.sin(a) * rr * 0.98]); }
      this.fill(x, [[0, cy - rr * 0.98, 0.02], ...cur, [0, cy + rr * 0.98, 0.02]], COL.perla);
      x.save(); x.strokeStyle = 'rgba(169,157,140,0.8)'; x.lineWidth = 1;
      for (let v = cy - 0.48; v < cy + 0.5; v += 0.16) { const a = this.P(0, v, 0.04), b = this.P(0, v, 1.55); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
      x.restore();
    }
    for (const cx of [9.8]) this.archLayers(x, 'y0', cx, 1.45, 0.12, 1.95, ['#E6DFD7', '#F4F2F1']);
    for (const cx of [7.0]) this.archLayers(x, 'x0', cx, 1.45, 0.12, 1.95, ['#C7BCAC', '#DDD5CA']);
    this.plantBig(x, 0.7, 8.2, 1.1);
    this.plantBig(x, 0.62, 0.72, 0.85);
    this.base = c;
  }
  floorLayer(x, state, t) {
    x.save(); this.isoT(x); x.lineCap = 'round'; x.lineJoin = 'round';
    for (const fp of FLOW_PATHS) {
      const r = fp.r, kNow = Math.floor((t - r.s) / LOOP);
      for (let k = kNow - FLOW_KEEP; k <= kNow; k++) {
        const start = r.s + k * LOOP; if (start < this.since) continue;
        const tau = t - start; if (tau < 0) continue;
        let alpha = 1;
        if (k === kNow - FLOW_KEEP) alpha = 1 - clamp01((t - r.s - kNow * LOOP) / 1.2);
        if (alpha <= 0) continue;
        const d = tau >= r.dur ? fp.total : posAt(r, tau, {}).dist;
        const L = fp.len * (d / fp.total), lane = (((k % 5) + 5) % 5 - 2) * 0.11;
        const pts = []; for (let i = 0; i < fp.pts.length && fp.cum[i] <= L; i++) pts.push([fp.pts[i][0] + fp.nrm[i][0] * lane, fp.pts[i][1] + fp.nrm[i][1] * lane]);
        if (pts.length < 2) continue;
        x.globalAlpha = alpha;
        x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0] + 0.02, p[1] + 0.03) : x.moveTo(p[0] + 0.02, p[1] + 0.03));
        x.strokeStyle = 'rgba(122,62,34,0.55)'; x.lineWidth = 0.075; x.stroke();
        x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]));
        x.strokeStyle = COL.cobre; x.lineWidth = 0.08; x.stroke();
      }
    }
    x.restore();
  }
}

/* ---------- C · La vidriera (vista frontal) ---------- */
const FAC = { x0: 628, top: 118, base: 600, w1: [690, 922], w2: [1106, 1338], door: [960, 1068], winTop: 182, winBot: 500, doorTop: 326 };
const DOOR_X = (FAC.door[0] + FAC.door[1]) / 2;
class FacadeSim {
  constructor(seed) { this.t = 0; this.r = rng(seed); this.people = []; this.marks = []; this.next = 0; this.pass = 0; this.stop = 0; this.enter = 0; this.ver = 0; this.id = 0; }
  spawn() {
    const r = this.r, u = r(), dir = r() < 0.5 ? 1 : -1;
    const type = u < 0.56 ? 'pass' : u < 0.8 ? 'stop' : 'enter';
    const y = 652 + r() * 124, s = 0.74 + 0.26 * (y - 640) / 150;
    const bodies = ['granate', 'carbon', 'caliza', 'perla', 'granate', 'carbon'];
    const p = { id: this.id++, type, dir, y, s, x: dir > 0 ? -50 : 1490, v: (58 + r() * 22) * s, dist: 0, st: 'walk', alpha: 1,
      body: bodies[Math.floor(r() * bodies.length)], hf: [0.92, 1, 1.08][Math.floor(r() * 3)], wf: [0.95, 1, 1.12][Math.floor(r() * 3)], counted: false };
    if (type === 'stop') { p.target = r() < 0.65 ? 760 + r() * 110 : 1120 + r() * 30; p.dur = 1.6 + r() * 1.2; }
    if (type === 'enter') { p.turn = DOOR_X - dir * (150 + r() * 70); p.trail = []; }
    this.people.push(p);
  }
  step(dt) {
    this.t += dt; this.ver++;
    while (this.t >= this.next) { this.spawn(); this.next += 1.0 + this.r() * 1.1; }
    for (const p of this.people) {
      const px = p.x;
      if (p.st === 'walk') {
        p.x += p.dir * p.v * dt; p.dist += p.v * dt;
        if (!p.counted && ((p.dir > 0 && p.x > FAC.x0) || (p.dir < 0 && p.x < 1380))) { p.counted = true; this.pass++; }
        if (p.type === 'stop' && !p.done && (p.x - p.target) * (px - p.target) <= 0) { p.st = 'stop'; p.stT = 0; p.done = true; this.stop++; this.marks.push({ k: 'stop', x: p.x, y: p.y, s: p.s, t: this.t }); }
        if (p.type === 'enter') {
          if (Math.abs(p.x - p.turn) < 170) p.trail.push([p.x, p.y]);
          if ((p.x - p.turn) * (px - p.turn) <= 0) {
            p.st = 'turn'; p.u = 0;
            const a = [p.x, p.y], d = [DOOR_X, FAC.base + 6];
            p.bz = [a, [a[0] + p.dir * 110, a[1]], [DOOR_X, a[1] - 20], d];
            p.blen = Math.hypot(d[0] - a[0], d[1] - a[1]) * 1.25;
            this.marks.push({ k: 'line', pts: p.trail, t: this.t, live: true });
          }
        }
        if (p.x < -80 || p.x > 1520) p.gone = true;
      } else if (p.st === 'stop') {
        p.stT += dt; if (p.stT > p.dur) p.st = 'walk';
      } else if (p.st === 'turn') {
        p.u = Math.min(1, p.u + p.v * dt / p.blen); const b = p.bz, u = p.u, m = 1 - u;
        p.x = m * m * m * b[0][0] + 3 * m * m * u * b[1][0] + 3 * m * u * u * b[2][0] + u * u * u * b[3][0];
        p.y = m * m * m * b[0][1] + 3 * m * m * u * b[1][1] + 3 * m * u * u * b[2][1] + u * u * u * b[3][1];
        p.dist += p.v * dt; p.trail.push([p.x, p.y]);
        if (u >= 1) { p.st = 'in'; p.inT = 0; this.enter++; }
      } else if (p.st === 'in') {
        p.inT += dt; p.y -= 26 * dt; p.alpha = 1 - p.inT / 0.7; p.dist += p.v * dt * 0.6;
        if (p.inT > 0.7) p.gone = true;
      }
    }
    this.people = this.people.filter(p => !p.gone);
    const lines = this.marks.filter(m => m.k === 'line'), stops = this.marks.filter(m => m.k === 'stop');
    if (lines.length > 14) lines[0].fadeFrom = lines[0].fadeFrom || this.t;
    if (stops.length > 10) stops[0].fadeFrom = stops[0].fadeFrom || this.t;
    this.marks = this.marks.filter(m => !(m.fadeFrom && this.t - m.fadeFrom > 1.2));
  }
  run(T) { while (this.t < T) this.step(1 / 30); return this; }
}

class SceneFacade {
  constructor(cv, L) { this.cv = cv; this.ctx = cv.getContext('2d'); this.L = L; }
  resize(scale) {
    const dpr = Math.min(2, window.devicePixelRatio || 1); this.px = scale * dpr;
    const w = Math.round(this.L.w * this.px), h = Math.round(this.L.h * this.px);
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    this.base = null;
  }
  rr(x, x0, y0, x1, y1, r) {
    x.beginPath(); x.moveTo(x0, y1); x.lineTo(x0, y0 + r); x.quadraticCurveTo(x0, y0, x0 + r, y0); x.lineTo(x1 - r, y0); x.quadraticCurveTo(x1, y0, x1, y0 + r); x.lineTo(x1, y1); x.closePath();
  }
  sh(x, c, b, ox, oy) { x.shadowColor = c; x.shadowBlur = b * this.px; x.shadowOffsetX = (ox || 0) * this.px; x.shadowOffsetY = (oy || 0) * this.px; }
  opening(x, x0, x1, y0, y1, inner) {
    const w = x1 - x0, R = w * 0.34;
    const steps = [[38, '#6A3243'], [24, '#5A2838'], [11, '#46202B']];
    for (const [o, c] of steps) { x.save(); this.sh(x, 'rgba(20,6,12,0.45)', 10, 3, 4); x.fillStyle = c; this.rr(x, x0 - o, y0 - o, x1 + o, y1 + (inner ? 0 : 0), R + o * 0.9); x.fill(); x.restore(); }
    x.save(); this.rr(x, x0, y0, x1, y1, R); x.clip(); inner(); x.restore();
    // sombra interior del marco
    x.save(); this.rr(x, x0, y0, x1, y1, R); x.clip(); x.strokeStyle = 'rgba(20,6,12,0.35)'; x.lineWidth = 18; this.sh(x, 'rgba(20,6,12,0.55)', 14, 4, 6); this.rr(x, x0 - 9, y0 - 9, x1 + 9, y1 + 9, R + 9); x.stroke(); x.restore();
  }
  form(x, cx, yb, h, top, bottom) { // maniquí sin cara: base, pie y prenda
    x.save();
    x.fillStyle = '#B8ACA0'; x.fillRect(cx - 2, yb - h * 0.25, 4, h * 0.25); x.beginPath(); x.ellipse(cx, yb, 22, 5, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#EFEAE5'; x.beginPath(); x.ellipse(cx, yb - h - 10, 9, 14, 0, 0, Math.PI * 2); x.fill();
    this.sh(x, 'rgba(39,33,36,0.25)', 6, 2, 3);
    if (bottom) { x.fillStyle = bottom; x.beginPath(); x.moveTo(cx - 20, yb - h * 0.55); x.lineTo(cx + 20, yb - h * 0.55); x.lineTo(cx + 30, yb - h * 0.22); x.lineTo(cx - 30, yb - h * 0.22); x.closePath(); x.fill(); }
    x.fillStyle = top; x.beginPath(); x.moveTo(cx - 12, yb - h); x.quadraticCurveTo(cx - 30, yb - h + 4, cx - 32, yb - h + 26); x.lineTo(cx - 26, yb - h * 0.5); x.lineTo(cx + 26, yb - h * 0.5); x.lineTo(cx + 32, yb - h + 26); x.quadraticCurveTo(cx + 30, yb - h + 4, cx + 12, yb - h); x.closePath(); x.fill();
    x.restore();
  }
  window(x, x0, x1, which) {
    const y0 = FAC.winTop, y1 = FAC.winBot, w = x1 - x0;
    this.opening(x, x0, x1, y0, y1, () => {
      const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#F4F2F1'); g.addColorStop(1, '#DDD5CA'); x.fillStyle = g; x.fillRect(x0, y0, w, y1 - y0);
      x.save(); this.sh(x, 'rgba(39,33,36,0.22)', 12, 4, 4);
      x.fillStyle = '#E6DFD7'; x.beginPath(); x.moveTo(x0 - 10, y0 + 40); x.quadraticCurveTo(x0 + w * 0.95, y0 + 30, x1 + 10, y1 - 20); x.lineTo(x1 + 10, y1); x.lineTo(x0 - 10, y1); x.closePath(); x.fill();
      x.fillStyle = '#EFEAE5'; x.beginPath(); x.moveTo(x0 - 10, y0 + 120); x.quadraticCurveTo(x0 + w * 0.7, y0 + 110, x1 - 20, y1); x.lineTo(x0 - 10, y1); x.closePath(); x.fill();
      x.fillStyle = '#C7BCAC'; x.fillRect(x1 - w * 0.2, y0, w * 0.2 + 2, y1 - y0);
      x.fillStyle = '#B5AA99'; x.fillRect(x1 - w * 0.2, y0, 3, y1 - y0);
      x.fillStyle = '#F4F2F1'; x.fillRect(x0, y1 - 34, w, 34); x.fillStyle = '#DDD5CA'; x.fillRect(x0, y1 - 34, w, 4);
      x.restore();
      const yb = y1 - 34;
      if (which === 1) {
        this.form(x, x0 + w * 0.34, yb, 190, '#F4F2F1', '#A99D8C');
        this.form(x, x0 + w * 0.6, yb, 196, '#542433', '#E6DFD7');
        this.vase(x, x0 + w * 0.13, yb);
      } else {
        x.save(); this.sh(x, 'rgba(39,33,36,0.25)', 8, 3, 3); x.fillStyle = '#E6DFD7'; x.fillRect(x0 + w * 0.48, yb - 50, w * 0.32, 50); x.fillStyle = '#C7BCAC'; x.fillRect(x0 + w * 0.48, yb - 50, w * 0.32, 5); x.restore();
        this.form(x, x0 + w * 0.64, yb - 50, 170, '#542433', null);
        this.form(x, x0 + w * 0.3, yb, 186, '#F4F2F1', '#8E5E69');
        this.vase(x, x0 + w * 0.1, yb);
      }
      // reflejo del vidrio
      x.save(); x.globalAlpha = 0.28; x.strokeStyle = '#FFFFFF'; x.lineWidth = 10;
      x.beginPath(); x.moveTo(x0 + w * 0.55, y0 - 10); x.lineTo(x0 + w * 0.15, y1 + 10); x.stroke(); x.lineWidth = 4;
      x.beginPath(); x.moveTo(x0 + w * 0.7, y0 - 10); x.lineTo(x0 + w * 0.3, y1 + 10); x.stroke(); x.restore();
    });
  }
  vase(x, cx, yb) {
    x.save(); this.sh(x, 'rgba(39,33,36,0.22)', 6, 2, 3);
    x.fillStyle = '#E6DFD7'; x.beginPath(); x.moveTo(cx - 12, yb); x.quadraticCurveTo(cx - 22, yb - 34, cx - 8, yb - 56); x.lineTo(cx + 8, yb - 56); x.quadraticCurveTo(cx + 22, yb - 34, cx + 12, yb); x.closePath(); x.fill();
    const lv = [[-0.5, 70], [-0.2, 95], [0.15, 85], [0.45, 70], [-0.35, 50], [0.3, 48]];
    lv.forEach(([a, l], i) => { x.save(); x.translate(cx, yb - 54); x.rotate(a); x.fillStyle = i % 2 ? COL.petroleo : COL.verdeAgua; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(9, -l * 0.5, 0, -l); x.quadraticCurveTo(-9, -l * 0.5, 0, 0); x.fill(); x.restore(); });
    x.restore();
  }
  buildBase() {
    const c = document.createElement('canvas'); c.width = this.cv.width; c.height = this.cv.height;
    const x = c.getContext('2d'); x.setTransform(this.px, 0, 0, this.px, 0, 0);
    const W = this.L.w, H = this.L.h;
    x.fillStyle = COL.perla; x.fillRect(0, 0, W, H);
    // vereda
    x.fillStyle = '#E6DFD7'; x.fillRect(0, FAC.base, W, H - FAC.base);
    x.save(); x.strokeStyle = 'rgba(169,157,140,0.45)'; x.lineWidth = 1;
    for (let i = -14; i <= 20; i++) { const xb = DOOR_X + i * 120; x.beginPath(); x.moveTo(DOOR_X + i * 62, FAC.base); x.lineTo(xb, H); x.stroke(); }
    x.beginPath(); x.moveTo(0, 700); x.lineTo(W, 700); x.stroke();
    x.restore();
    x.fillStyle = '#C7BCAC'; x.fillRect(0, FAC.base, W, 8);
    // fachada (capas de papel)
    x.save(); this.sh(x, 'rgba(39,33,36,0.35)', 28, -6, 10); x.fillStyle = '#542433'; x.fillRect(FAC.x0, FAC.top, W - FAC.x0 + 40, FAC.base - FAC.top); x.restore();
    x.save(); this.sh(x, 'rgba(20,6,12,0.4)', 10, 0, 5); x.fillStyle = '#6A3243'; x.fillRect(FAC.x0 - 12, FAC.top - 18, W - FAC.x0 + 60, 26); x.restore();
    x.save(); this.sh(x, 'rgba(20,6,12,0.35)', 8, 0, -3); x.fillStyle = '#46202B'; x.fillRect(FAC.x0, FAC.base - 30, W - FAC.x0 + 40, 30); x.restore();
    // grano vertical del papel granate
    x.save(); x.globalAlpha = 0.06; x.strokeStyle = '#000'; const r = rng(5);
    for (let i = 0; i < 160; i++) { const xx = FAC.x0 + r() * (W - FAC.x0), yy = FAC.top + r() * (FAC.base - FAC.top); x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + (r() - 0.5) * 4, yy + 10 + r() * 24); x.stroke(); }
    x.restore();
    this.window(x, FAC.w1[0], FAC.w1[1], 1);
    this.window(x, FAC.w2[0], FAC.w2[1], 2);
    // puerta
    this.opening(x, FAC.door[0], FAC.door[1], FAC.doorTop, FAC.base, () => {
      const g = x.createLinearGradient(0, FAC.doorTop, 0, FAC.base); g.addColorStop(0, '#A99D8C'); g.addColorStop(1, '#C7BCAC');
      x.fillStyle = g; x.fillRect(FAC.door[0], FAC.doorTop, FAC.door[1] - FAC.door[0], FAC.base - FAC.doorTop);
      x.fillStyle = 'rgba(244,242,241,0.5)'; x.fillRect(FAC.door[0] + 14, FAC.doorTop + 40, 22, FAC.base - FAC.doorTop - 40);
    });
    x.fillStyle = '#DDD5CA'; x.fillRect(FAC.door[0] - 10, FAC.base, FAC.door[1] - FAC.door[0] + 20, 8);
    this.base = c;
  }
  personAt(x, p, ox, oy, alpha, ghost) {
    const k = 66 * p.s, bw = 0.40 * p.wf * k, bh = 0.80 * p.hf * k, hd = 0.34 * p.hf * k, r = bw / 2;
    x.save(); x.globalAlpha = alpha; x.translate(ox, oy);
    const cap = (dx, dy) => { x.beginPath(); x.moveTo(dx - r, dy - bh + r); x.arc(dx, dy - bh + r, r, Math.PI, 0); x.lineTo(dx + r, dy - r); x.arc(dx, dy - r, r, 0, Math.PI); x.closePath(); };
    const head = (dx, dy) => { x.beginPath(); x.arc(dx, dy - bh - 0.06 * k - hd / 2, hd / 2, 0, Math.PI * 2); };
    if (ghost) { x.fillStyle = COL[p.body]; cap(0, 0); x.fill(); head(0, 0); x.fill(); x.restore(); return; }
    const ph = p.dist / (0.55 * k) * Math.PI, moving = p.st !== 'stop';
    const bob = moving ? Math.abs(Math.sin(ph)) * 0.045 * k : 0; x.translate(0, -bob); if (moving) x.rotate(Math.sin(ph) * 0.04);
    const e = 0.035 * k;
    x.fillStyle = BODY_EDGE[p.body]; cap(e, e * 0.6); x.fill(); x.fillStyle = '#B8ACA0'; head(e, e * 0.6); x.fill();
    this.sh(x, 'rgba(39,33,36,0.22)', 5, 2, 2);
    x.fillStyle = COL[p.body]; cap(0, 0); x.fill(); x.fillStyle = COL.cabeza; head(0, 0); x.fill();
    x.shadowColor = 'transparent';
    if (p.body === 'perla') { x.strokeStyle = 'rgba(169,157,140,0.8)'; x.lineWidth = 1; cap(0, 0); x.stroke(); }
    x.restore();
  }
  draw(st) {
    const x = this.ctx; if (!this.base) this.buildBase();
    x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(this.base, 0, 0); x.setTransform(this.px, 0, 0, this.px, 0, 0);
    // marcas cobre en la vereda: quienes entran dejan una línea; quienes se frenan, un arco
    x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
    for (const m of st.marks) {
      const a = m.fadeFrom ? clamp01(1 - (st.t - m.fadeFrom) / 1.2) : 1; if (a <= 0) continue; x.globalAlpha = a;
      if (m.k === 'line' && m.pts.length > 1) {
        for (const [col, w, dy] of [['rgba(122,62,34,0.5)', 4.5, 1.5], [COL.cobre, 3.5, 0]]) {
          x.strokeStyle = col; x.lineWidth = w; x.beginPath(); m.pts.forEach((p, i) => i ? x.lineTo(p[0], p[1] + dy) : x.moveTo(p[0], p[1] + dy)); x.stroke();
        }
      } else if (m.k === 'stop') {
        x.strokeStyle = COL.cobre; x.lineWidth = 3; x.beginPath(); x.ellipse(m.x, m.y + 2, 30 * m.s, 8 * m.s, 0, Math.PI * 1.05, Math.PI * 1.95, true); x.stroke();
      }
    }
    x.restore();
    const ps = st.people.slice().sort((a, b) => a.y - b.y);
    for (const p of ps) {
      x.save(); x.globalAlpha = 0.25 * p.alpha; x.fillStyle = 'rgba(39,33,36,0.5)'; x.beginPath(); x.ellipse(p.x + 6 * p.s, p.y + 2, 26 * p.s, 7 * p.s, 0, 0, Math.PI * 2); x.fill(); x.restore();
    }
    for (const p of ps) {
      if (p.st === 'walk') this.personAt(x, p, p.x - p.dir * 12 * p.s, p.y, 0.14 * p.alpha, true);
      this.personAt(x, p, p.x, p.y, p.alpha);
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.12;
    x.fillStyle = x.createPattern(paperTile(), 'repeat'); x.fillRect(0, 0, this.cv.width, this.cv.height); x.restore();
  }
}

/* ===== Escenas por rubro (topografía de papel) ===== */
const WOOD = { top: COL.perla, fy: COL.calizaClaro, fx: COL.caliza, edge: '#FFFFFF' };
const ROSE = { top: COL.perla, fy: '#8E5E69', fx: '#6A3243', edge: '#FFFFFF' };
const FRONT_FIX = FIX.filter(f => /^(front|sill|jamb)/.test(f.name));

function faceRows(seed, axis, from, to, plane, rows, cols) {
  const r = rng(seed), out = [];
  for (const [za, zb] of rows) {
    let p = from + 0.08;
    while (p < to - 0.2) {
      const w = 0.16 + r() * 0.24, h = (zb - za) * (0.6 + r() * 0.4);
      if (p + w > to - 0.08) break;
      out.push({ axis, plane, a: p, b: p + w, z0: za, z1: za + h, c: cols[Math.floor(r() * cols.length)] });
      p += w + 0.05 + r() * 0.08;
    }
  }
  return out;
}
const stacks = (base, list) => list.map(([x, y, w, d, h, c]) => ({ b: B(x, x + w, y, y + d, base, base + h), c }));
const fx = (name, b, c, split, extra) => Object.assign({ name, b, c, split, face: [], items: [] }, extra || {});
const cyl = (x, y, parts) => ({ kind: 'cyl', x, y, d: x + y, parts });
const stool = (x, y) => cyl(x, y, [{ r: 0.045, z0: 0, z1: 0.68, top: COL.carbon, side: COL.carbon }, { r: 0.21, z0: 0.66, z1: 0.75, top: COL.perla, side: '#6A3243' }]);
const chair = (x, y) => cyl(x, y, [{ r: 0.2, z0: 0, z1: 0.46, top: '#8E5E69', side: '#6A3243' }]);
const rtable = (x, y) => cyl(x, y, [{ r: 0.08, z0: 0, z1: 0.7, top: COL.calizaOscuro, side: COL.calizaOscuro }, { r: 0.55, z0: 0.69, z1: 0.76, top: COL.perla, side: COL.caliza }]);
const tires = (x, y, n) => cyl(x, y, Array.from({ length: n }, (_, i) => ({ r: 0.36, z0: i * 0.23, z1: i * 0.23 + 0.21, top: '#3A3134', side: COL.carbon, hole: true })));

const VENUE_ART = {
  tienda: {
    fixtures: [
      fx('table', B(4.6, 7.0, 4.0, 5.6, 0, 0.72), WOOD, 'x', { fluted: true, items: stacks(0.72, [[4.8, 4.2, 0.5, 0.45, 0.2, COL.perla], [5.45, 4.2, 0.5, 0.45, 0.14, COL.caliza], [6.15, 4.25, 0.5, 0.45, 0.24, COL.carbon], [4.85, 4.95, 0.5, 0.45, 0.12, COL.granateLuz], [5.55, 4.95, 0.5, 0.45, 0.22, COL.perla], [6.2, 4.95, 0.5, 0.45, 0.16, COL.calizaOscuro]]) }),
      fx('counter', B(8.6, 10.9, 0.5, 1.4, 0, 0.95), WOOD, 'x', { fluted: true, items: stacks(0.95, [[9.1, 0.75, 0.42, 0.34, 0.1, COL.carbon], [10.1, 0.7, 0.3, 0.42, 0.3, COL.calizaClaro]]) }),
      fx('podium', B(10.65, 11.55, 2.6, 4.6, 0, 0.42), WOOD, 'y', { items: stacks(0.42, [[10.8, 2.8, 0.55, 0.5, 0.26, COL.granate], [10.85, 3.5, 0.5, 0.4, 0.62, COL.perla], [10.8, 4.05, 0.55, 0.42, 0.16, COL.caliza]]) }),
    ],
    decor(s, x) {
      s.archLayers(x, 'y0', 9.8, 1.45, 0.12, 1.95, ['#E6DFD7', '#F4F2F1']);
      s.garments(x, 1.0, 7.8, 11);
      for (const cy of [3.2, 5.0]) s.fittingRoom(x, cy);
      s.archLayers(x, 'x0', 7.2, 1.45, 0.12, 1.95, ['#C7BCAC', '#DDD5CA']);
    },
    plants: [[0.62, 0.72, 0.9], [0.75, 8.25, 1.0]],
  },
  bar: {
    fixtures: [
      fx('barra', B(5.0, 11.0, 0.6, 1.55, 0, 1.05), WOOD, 'x', { fluted: true, items: stacks(1.05, [[6.4, 0.85, 0.3, 0.3, 0.32, COL.perla], [8.9, 0.8, 0.5, 0.35, 0.12, COL.carbon], [10.2, 0.85, 0.28, 0.28, 0.28, COL.granateLuz]]) }),
      stool(6.0, 2.05), stool(7.2, 2.05), stool(8.4, 2.05), stool(9.6, 2.05), stool(10.6, 2.05),
      rtable(2.4, 4.2), chair(1.65, 4.2), chair(2.4, 3.45),
      rtable(2.4, 7.4), chair(1.65, 7.4), chair(2.4, 8.15),
      rtable(4.8, 7.7), chair(4.05, 7.7), chair(4.8, 8.45),
    ],
    decor(s, x) {
      s.bottles(x, 5.3, 10.8);
      s.archLayers(x, 'y0', 2.6, 1.45, 0.12, 1.95, ['#E6DFD7', '#F4F2F1']);
      for (const cy of [2.8, 5.6]) s.archLayers(x, 'x0', cy, 1.45, 0.12, 1.95, ['#C7BCAC', '#DDD5CA']);
    },
    plants: [[0.62, 0.72, 1.0], [11.2, 8.35, 0.95]],
  },
  shopping: {
    wallH: 3.4,
    masked: [[0.3, 4.4, 0, 1.35], [7.6, 11.7, 0, 1.35], [0, 1.35, 2.4, 5.0], [0, 1.35, 5.6, 8.4]],
    fixtures: [
      fx('bench', B(8.5, 9.9, 4.75, 5.1, 0, 0.42), WOOD, 'x'),
      Object.assign(cyl(8.9, 3.4, [{ r: 0.5, z0: 0, z1: 0.55, top: '#46202B', side: COL.calizaClaro }]), { leaves: true }),
      Object.assign(cyl(3.1, 8.2, [{ r: 0.45, z0: 0, z1: 0.5, top: '#46202B', side: COL.calizaClaro }]), { leaves: true }),
      fx('escLanding', B(5.4, 6.6, 5.4, 5.95, 0, 0.03), { top: COL.calizaClaro, fy: COL.caliza, fx: COL.caliza }, 'x'),
      ...Array.from({ length: 6 }, (_, i) => { const ya = 1.7 + i * 3.7 / 6, yb = 1.7 + (i + 1) * 3.7 / 6; return { kind: 'esc', ya, yb, d: 6.0 + (ya + yb) / 2 + 0.3 }; }),
      ...[[0, 1.35], [1.35, 2.7], [2.7, 4.05], [4.05, 5.4], [6.6, 7.95], [7.95, 9.3], [9.3, 10.65], [10.65, 12]].map(([a, b]) => ({ kind: 'rail', x0: a, x1: b, d: (a + b) / 2 + 1.7 + 0.1 })),
    ],
    decor(s, x) {
      for (const cx of [1.4, 3.6, 8.4, 10.6]) s.archLayers(x, 'y0', cx, 1.3, 2.3, 3.25, ['#E6DFD7', '#F4F2F1']);
      for (const cy of [3.6, 6.9]) s.archLayers(x, 'x0', cy, 1.5, 2.3, 3.25, ['#C7BCAC', '#DDD5CA']);
      s.archLayers(x, 'y0', 6.0, 1.5, 0.05, 1.85, ['#E6DFD7', '#F4F2F1']);
      s.shopBox(x, 'y', 0.3, 4.4, 'bag', '#8E5E69');
      s.shopBox(x, 'y', 7.6, 11.7, 'rack', COL.caliza);
      s.shopBox(x, 'x', 2.4, 5.0, 'shoes', COL.perla);
      s.shopBox(x, 'x', 5.6, 8.4, 'lamp', '#8E5E69');
      s.box(x, B(-0.25, 12.22, -0.25, 1.7, 2.0, 2.2), { top: '#6A3243', fy: COL.perla, fx: COL.calizaClaro }, false);
    },
    plants: [],
  },
  aeropuerto: {
    fixtures: [
      fx('checkin', B(1.2, 7.4, 0.8, 1.5, 0, 1.0), WOOD, 'x', { fluted: true, items: stacks(1.0, [[1.9, 0.95, 0.32, 0.12, 0.3, COL.carbon], [3.4, 0.95, 0.32, 0.12, 0.3, COL.carbon], [5.5, 0.95, 0.32, 0.12, 0.3, COL.carbon], [6.8, 1.0, 0.4, 0.4, 0.06, COL.calizaOscuro]]) }),
      fx('beltA', B(3.8, 7.6, 2.68, 2.72, 0.8, 0.87), { top: '#6A3243', fy: COL.granate, fx: COL.granateSombra }, 'x'),
      fx('beltB', B(3.8, 7.6, 3.48, 3.52, 0.8, 0.87), { top: '#6A3243', fy: COL.granate, fx: COL.granateSombra }, 'x'),
      ...[3.8, 4.75, 5.7, 6.65, 7.6].flatMap(px => [cyl(px, 2.7, [{ r: 0.06, z0: 0, z1: 0.95, top: COL.carbon, side: COL.carbon }]), cyl(px, 3.5, [{ r: 0.06, z0: 0, z1: 0.95, top: COL.carbon, side: COL.carbon }])]),
      fx('seats1', B(1.4, 4.6, 6.2, 6.6, 0, 0.42), ROSE, 'x'), fx('back1', B(1.4, 4.6, 6.55, 6.65, 0.42, 0.85), ROSE, 'x'),
      fx('seats2', B(1.4, 4.6, 7.6, 8.0, 0, 0.42), ROSE, 'x'), fx('back2', B(1.4, 4.6, 7.95, 8.05, 0.42, 0.85), ROSE, 'x'),
      fx('gateDesk', B(10.3, 11.2, 1.7, 2.1, 0, 0.95), WOOD, 'x', { items: stacks(0.95, [[10.5, 1.8, 0.3, 0.12, 0.28, COL.carbon]]) }),
    ],
    decor(s, x) {
      s.board(x, 2.0, 6.6, 1.3, 2.05);
      s.archLayers(x, 'y0', 9.8, 1.4, 0.0, 1.95, ['#2F121B', '#2F121B']);
      s.fill(x, [[9.25, 0.02, 2.05], [10.35, 0.02, 2.05], [10.35, 0.02, 2.18], [9.25, 0.02, 2.18]], COL.caliza);
      s.planeWindow(x, 3.8);
      s.archLayers(x, 'x0', 7.6, 1.3, 0.12, 1.9, ['#C7BCAC', '#DDD5CA']);
    },
    plants: [[11.2, 8.35, 0.95], [0.7, 8.4, 0.9]],
  },
};

function makeChunks(list) {
  const out = [];
  for (const f of list) {
    if (f.kind) { out.push(f); continue; }
    const { x0, x1, y0, y1, z0, z1 } = f.b, ax = f.split;
    const a0 = ax === 'x' ? x0 : y0, a1 = ax === 'x' ? x1 : y1, n = Math.max(1, Math.ceil((a1 - a0) / 0.9));
    for (let i = 0; i < n; i++) {
      const c0 = a0 + (a1 - a0) * i / n, c1 = a0 + (a1 - a0) * (i + 1) / n, last = i === n - 1;
      const b = ax === 'x' ? B(c0, c1, y0, y1, z0, z1) : B(x0, x1, c0, c1, z0, z1);
      const inR = v => v >= c0 && v < c1 + (last ? 1e-6 : 0);
      out.push({ kind: 'chunk', f, b, last, ax, face: f.face.filter(p => inR((p.a + p.b) / 2)),
        items: f.items.filter(it => inR(ax === 'x' ? (it.b.x0 + it.b.x1) / 2 : (it.b.y0 + it.b.y1) / 2)).sort((p, q) => (p.b.x0 + p.b.y0) - (q.b.x0 + q.b.y0)),
        leaves: (f.leaves || []).filter(([lx, ly]) => inR(ax === 'x' ? lx : ly)),
        d: (b.x0 + b.x1) / 2 + (b.y0 + b.y1) / 2 });
    }
  }
  return out;
}

class SceneRubro extends SceneTopo {
  constructor(cv, L, venue) {
    super(cv, L, { ghost: true });
    this.venue = venue; this.art = VENUE_ART[venue.id]; this.maxHeat = venue.maxHeat;
    this.items = makeChunks(this.art.fixtures.concat(FRONT_FIX));
    const mk = this.art.masked; if (mk) this.masked = (u, v) => mk.some(([a, b, c, d]) => u >= a && u <= b && v >= c && v <= d);
  }
  release() { this.base = this.shadows = this.topoCv = this.lvCv = null; this.heatVer = null; }
  resize(scale) { super.resize(scale); this.topoCv = null; this.lvCv = null; }
  wp(plane, u, z, off) { return plane === 'y0' ? [u, off || 0.02, z] : [off || 0.02, u, z]; }
  buildBase() {
    const [c, x] = this.layer();
    this.baseCommon(x, '#4A1F2D', '#4A1F2D');
    x.save(); this.isoT(x); x.strokeStyle = 'rgba(106,50,67,0.55)'; x.lineWidth = 0.025; const r = rng(3);
    for (let y = 0.12; y < 9; y += 0.16 + r() * 0.1) { x.beginPath(); x.moveTo(0, y); for (let u = 0; u <= 12; u += 0.5) x.lineTo(u, y + Math.sin(u * 0.9 + y * 3) * 0.05); x.stroke(); }
    x.restore();
    this.walls(x, this.art.wallH || 2.2);
    this.art.decor(this, x);
    for (const [px, py, s] of this.art.plants) this.plantBig(x, px, py, s);
    this.base = c;
  }
  buildShadows() {
    const [c, x] = this.layer();
    x.save(); x.shadowColor = 'rgba(20,6,12,0.45)'; x.shadowBlur = 10 * this.px; x.shadowOffsetX = 3 * this.px; x.shadowOffsetY = 4 * this.px;
    x.fillStyle = 'rgba(20,6,12,0.22)';
    for (const f of this.art.fixtures) {
      if (f.kind && f.kind !== 'cyl') continue;
      if (f.kind === 'cyl') { const R = Math.max(...f.parts.map(p => p.r)), [sx, sy] = this.P(f.x + 0.08, f.y + 0.08, 0); x.beginPath(); x.ellipse(sx, sy, 1.2247 * R * this.L.k, 0.7071 * R * this.L.k, 0, 0, Math.PI * 2); x.fill(); continue; }
      const { x0, x1, y0, y1 } = f.b, s = 0.14; this.poly(x, [[x0, y0, 0], [x1 + s, y0, 0], [x1 + s, y1 + s, 0], [x0, y1 + s, 0]]); x.fill();
    }
    x.shadowBlur = 16 * this.px; x.shadowOffsetX = 0; x.shadowOffsetY = 0; x.fillStyle = 'rgba(20,6,12,0.18)';
    this.poly(x, [[0, 0, 0], [12, 0, 0], [12, 0.25, 0], [0, 0.25, 0]]); x.fill();
    this.poly(x, [[0, 0, 0], [0.25, 0, 0], [0.25, 9, 0], [0, 9, 0]]); x.fill();
    x.restore();
    this.shadows = c;
  }
  cylDraw(x, it) {
    const k = this.L.k;
    for (const p of it.parts) {
      const [ax, ay] = this.P(it.x, it.y, p.z0), [bx, by] = this.P(it.x, it.y, p.z1), rx = 1.2247 * p.r * k, ry = 0.7071 * p.r * k;
      x.fillStyle = p.side; x.beginPath(); x.moveTo(bx - rx, by); x.lineTo(ax - rx, ay); x.ellipse(ax, ay, rx, ry, 0, Math.PI, 0, true); x.lineTo(bx + rx, by); x.closePath(); x.fill();
      x.fillStyle = p.top; x.beginPath(); x.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2); x.fill();
      if (p.hole) { x.fillStyle = COL.calizaOscuro; x.beginPath(); x.ellipse(bx, by, rx * 0.42, ry * 0.42, 0, 0, Math.PI * 2); x.fill(); }
      else if (p.r > 0.15 && !it.leaves) { x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 1; x.beginPath(); x.ellipse(bx, by, rx, ry, 0, 0.1, Math.PI - 0.1); x.stroke(); }
    }
    if (it.leaves) this.leaves(x, it.x, it.y, it.parts[it.parts.length - 1].z1);
  }
  escDraw(x, it) {
    const X0 = 5.4, X1 = 6.6, BAL = 0.8, z = y => 2.2 * (5.4 - y) / 3.7, ya = it.ya, yb = it.yb, za = z(ya), zb = z(yb);
    this.fill(x, [[X0, ya, Math.max(0, za - 0.45)], [X0, yb, Math.max(0, zb - 0.45)], [X0, yb, zb], [X0, ya, za]], '#46202B');
    x.save(); x.globalAlpha = 0.4; this.fill(x, [[X0 + 0.06, ya, za], [X0 + 0.06, yb, zb], [X0 + 0.06, yb, zb + BAL], [X0 + 0.06, ya, za + BAL]], COL.perla); x.restore();
    this.fill(x, [[X0 + 0.08, ya, za], [X1 - 0.08, ya, za], [X1 - 0.08, yb, zb], [X0 + 0.08, yb, zb]], COL.caliza);
    x.save(); x.strokeStyle = COL.calizaOscuro; x.lineWidth = 1;
    for (let y = Math.ceil(ya / 0.2) * 0.2; y < yb; y += 0.2) { const a = this.P(X0 + 0.08, y, z(y)), b = this.P(X1 - 0.08, y, z(y)); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
    x.restore();
    x.save(); x.globalAlpha = 0.4; this.fill(x, [[X1 - 0.06, ya, za], [X1 - 0.06, yb, zb], [X1 - 0.06, yb, zb + BAL], [X1 - 0.06, ya, za + BAL]], COL.perla); x.restore();
    this.fill(x, [[X1, ya, Math.max(0, za - 0.45)], [X1, yb, Math.max(0, zb - 0.45)], [X1, yb, zb + 0.1], [X1, ya, za + 0.1]], '#5A2838');
    x.save(); x.strokeStyle = COL.carbon; x.lineWidth = 2.2; x.lineCap = 'round';
    for (const xx of [5.46, 6.54]) { const a = this.P(xx, ya, za + BAL), b = this.P(xx, yb, zb + BAL); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
    x.restore();
  }
  railDraw(x, it) {
    x.save(); x.globalAlpha = 0.42; this.fill(x, [[it.x0, 1.7, 2.2], [it.x1, 1.7, 2.2], [it.x1, 1.7, 2.75], [it.x0, 1.7, 2.75]], COL.perla); x.restore();
    x.save(); x.strokeStyle = COL.carbon; x.lineWidth = 2; x.lineCap = 'round';
    const a = this.P(it.x0, 1.7, 2.75), b = this.P(it.x1, 1.7, 2.75); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
    x.lineWidth = 1; for (const xx of [it.x0, it.x1]) { const c = this.P(xx, 1.7, 2.2), d = this.P(xx, 1.7, 2.75); x.beginPath(); x.moveTo(c[0], c[1]); x.lineTo(d[0], d[1]); x.stroke(); }
    x.restore();
  }
  board(x, a, b, z0, z1) {
    this.fill(x, [[a, 0.03, z0], [b, 0.03, z0], [b, 0.03, z1], [a, 0.03, z1]], COL.carbon);
    const r = rng(41), rows = 6, h = (z1 - z0 - 0.14) / rows;
    for (let i = 0; i < rows; i++) {
      const z = z1 - 0.07 - (i + 1) * h + h * 0.3;
      let u = a + 0.12;
      for (const w of [0.45, 0.9, 0.5, 0.35]) { const ww = w * (0.8 + r() * 0.3); if (u + ww > b - 0.1) break; this.fill(x, [[u, 0.04, z], [u + ww, 0.04, z], [u + ww, 0.04, z + h * 0.45], [u, 0.04, z + h * 0.45]], i % 3 === 1 ? COL.caliza : '#8A7F76'); u += ww + 0.18; }
    }
  }
  planeWindow(x, cy) {
    const w = 3.0, z0 = 0.15, z1 = 1.95, r = w / 2;
    this.archLayers(x, 'x0', cy, w, z0, z1, ['#E6DFD7', '#F4F2F1']);
    const m = (u, z) => [0.03, cy + u, z];
    const f = (pts, c) => this.fill(x, pts.map(([u, z]) => m(u, z)), c);
    f([[-r, z0], [r, z0], [r, z0 + 0.25], [-r, z0 + 0.25]], COL.calizaClaro);
    f([[-0.95, 0.95], [0.75, 0.95], [0.95, 1.02], [0.75, 1.1], [-0.85, 1.1], [-1.0, 1.25], [-1.1, 1.25], [-1.02, 1.02]], COL.calizaOscuro);
    f([[-0.15, 1.02], [0.2, 1.02], [-0.25, 0.7], [-0.4, 0.7]], COL.calizaOscuro);
    for (const u of [-0.9, -0.4, 0.1, 0.6]) f([[u, z0], [u + 0.04, z0], [u + 0.04, 1.6], [u, 1.6]], '#D9D1C7');
  }
  person(x, p) {
    super.person(x, p);
    const c = p.r.bag; if (!c) return;
    const k = this.L.k, [sx, sy] = this.P(p.x, p.y, p.z || 0), w = 0.24 * k, h = 0.36 * k, ox = sx + 0.26 * k;
    x.save(); x.globalAlpha = p.alpha;
    x.fillStyle = shade(c, -0.25); x.fillRect(ox + 1, sy - h + 1, w, h);
    x.fillStyle = c; x.fillRect(ox, sy - h, w, h);
    x.strokeStyle = COL.carbon; x.lineWidth = Math.max(1, 0.03 * k); x.beginPath(); x.moveTo(ox + w * 0.5, sy - h); x.lineTo(ox + w * 0.5, sy - h - 0.22 * k); x.stroke();
    x.restore();
  }
  goods(x, map, kind) {
    const f = (pts, col) => this.fill(x, pts.map(([u, z]) => map(u, z)), col);
    if (kind === 'bag') {
      f([[-0.35, 0], [0.35, 0], [0.35, 0.55], [-0.35, 0.55]], COL.calizaClaro);
      f([[-0.2, 0.55], [0.2, 0.55], [0.24, 0.9], [-0.24, 0.9]], COL.granate);
      f([[-0.12, 0.9], [-0.08, 0.9], [-0.06, 1.05], [0.06, 1.05], [0.08, 0.9], [0.12, 0.9], [0.1, 1.1], [-0.1, 1.1]], COL.granate);
      f([[0.55, 0], [0.62, 0], [0.62, 1.3], [0.55, 1.3]], COL.calizaOscuro);
    } else if (kind === 'rack') {
      f([[-0.7, 1.3], [0.7, 1.3], [0.7, 1.34], [-0.7, 1.34]], COL.calizaOscuro);
      [[-0.6, COL.perla], [-0.28, '#8E5E69'], [0.04, COL.caliza], [0.36, COL.granate]].forEach(([u, col]) => f([[u, 1.28], [u + 0.26, 1.28], [u + 0.28, 0.6], [u - 0.02, 0.6]], col));
    } else if (kind === 'lamp') {
      f([[-0.05, 0], [0.05, 0], [0.05, 1.1], [-0.05, 1.1]], COL.calizaOscuro);
      f([[-0.22, 1.1], [0.22, 1.1], [0.14, 1.35], [-0.14, 1.35]], COL.perla);
      f([[0.3, 0], [0.9, 0], [0.9, 0.5], [0.3, 0.5]], '#8E5E69');
      f([[0.3, 0.42], [0.42, 0.42], [0.42, 0.8], [0.3, 0.8]], '#8E5E69');
    } else if (kind === 'shelf') {
      for (const z of [0.5, 0.95, 1.4]) { f([[-0.7, z], [0.7, z], [0.7, z + 0.04], [-0.7, z + 0.04]], COL.calizaOscuro); [[-0.6, COL.granate], [-0.25, COL.perla], [0.1, COL.carbon], [0.4, COL.caliza]].forEach(([u, col], i) => f([[u, z + 0.04], [u + 0.2, z + 0.04], [u + 0.2, z + 0.24 + (i % 2) * 0.08], [u, z + 0.24 + (i % 2) * 0.08]], col)); }
    } else if (kind === 'shoes') {
      for (const z of [0.35, 0.8]) { f([[-0.65, z], [0.65, z], [0.65, z + 0.04], [-0.65, z + 0.04]], COL.calizaOscuro); [-0.5, -0.1, 0.3].forEach((u, i) => f([[u, z + 0.04], [u + 0.28, z + 0.04], [u + 0.28, z + 0.1], [u + 0.08, z + 0.16], [u, z + 0.16]], [COL.carbon, COL.granate, COL.perla][i])); }
    }
  }
  shopBox(x, axis, a0, a1, kind, sign) {
    const c = (a0 + a1) / 2, D2 = 1.3;
    const b = axis === 'y' ? B(a0, a1, 0, D2, 0, 2.0) : B(0, D2, a0, a1, 0, 2.0);
    this.box(x, b, { top: '#6A3243', fy: axis === 'y' ? '#5A2838' : '#46202B', fx: axis === 'y' ? '#46202B' : '#5A2838' }, false);
    const m = (u, z) => axis === 'y' ? [u, D2 + 0.01, z] : [D2 + 0.01, u, z];
    const q = pts => pts.map(([u, z]) => m(u, z));
    this.fill(x, q([[a0 + 0.14, 0.06], [a1 - 0.14, 0.06], [a1 - 0.14, 1.58], [a0 + 0.14, 1.58]]), '#EFEAE5');
    this.fill(x, q([[a0 + 0.14, 1.36], [a1 - 0.14, 1.36], [a1 - 0.14, 1.58], [a0 + 0.14, 1.58]]), '#F8F6F4');
    this.fill(x, q([[c + 0.55, 0.06], [c + 1.15, 0.06], [c + 1.15, 1.42], [c + 0.55, 1.42]]), '#D9D1C7');
    this.fill(x, q([[a0 + 0.35, 1.67], [a1 - 0.35, 1.67], [a1 - 0.35, 1.9], [a0 + 0.35, 1.9]]), sign);
    this.goods(x, (u, z) => m(c - 0.55 + u, z + 0.06), kind);
    x.save(); x.globalAlpha = 0.5; x.strokeStyle = '#FFFFFF'; x.lineWidth = 3;
    const g0 = this.P(...m(a0 + 0.6, 1.5)), g1 = this.P(...m(a0 + 1.1, 0.15)); x.beginPath(); x.moveTo(g0[0], g0[1]); x.lineTo(g1[0], g1[1]); x.stroke(); x.restore();
  }
  chunkDraw(x, ch) {
    this.chunk(x, ch);
    if (ch.f.fluted) this.flutes(x, ch.b);
    for (const [lx, ly] of ch.leaves) this.leaves(x, lx, ly, ch.b.z1);
  }
  leaves(x, px, py, z) {
    const k = this.L.k, [sx, sy] = this.P(px, py, z);
    const L = [[-1.2, 1.3], [-0.8, 1.7], [-0.35, 1.9], [0.1, 1.95], [0.55, 1.75], [1.0, 1.45], [-0.55, 1.2], [0.35, 1.25], [1.3, 1.1]];
    x.save(); x.translate(sx, sy);
    L.forEach(([a, l], i) => {
      x.save(); x.rotate(a * 0.6); const w = 0.24 * k, h = l * 0.5 * k;
      x.fillStyle = i % 3 === 0 ? COL.petroleo : i % 3 === 1 ? '#5E8F89' : COL.verdeAgua;
      x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(w, -h * 0.55, 0, -h); x.quadraticCurveTo(-w, -h * 0.55, 0, 0); x.fill(); x.restore();
    });
    x.restore();
  }
  /* --- decoración de muros --- */
  garments(x, from, to, seed) {
    let p0 = this.P(from, 0, 1.62), p1 = this.P(to, 0, 1.62);
    x.save(); x.strokeStyle = '#B8ACA0'; x.lineWidth = 2; x.beginPath(); x.moveTo(p0[0], p0[1]); x.lineTo(p1[0], p1[1]); x.stroke(); x.restore();
    const r = rng(seed), cols = [COL.perla, '#E6DFD7', COL.caliza, '#8E5E69', COL.perla, COL.calizaClaro, COL.carbon];
    for (let u = from + 0.15; u < to - 0.3;) {
      const w = 0.32 + r() * 0.16, len = 0.75 + r() * 0.45, c0 = cols[Math.floor(r() * cols.length)], m = u + w / 2;
      const h0 = this.P(m, 0.02, 1.62), h1 = this.P(m, 0.02, 1.55);
      x.strokeStyle = '#9C8F80'; x.lineWidth = 1; x.beginPath(); x.moveTo(h0[0], h0[1]); x.lineTo(h1[0], h1[1]); x.stroke();
      this.fill(x, [[u + 0.06, 0.03, 1.55], [u + w - 0.06, 0.03, 1.55], [u + w, 0.03, 1.47], [u + w + 0.02, 0.03, 1.55 - len], [u - 0.02, 0.03, 1.55 - len], [u, 0.03, 1.47]], shade(c0, -0.14));
      this.fill(x, [[u + 0.06, 0.04, 1.55], [u + w - 0.06, 0.04, 1.55], [u + w - 0.02, 0.04, 1.47], [u + w - 0.01, 0.04, 1.57 - len], [u + 0.01, 0.04, 1.57 - len], [u + 0.02, 0.04, 1.47]], c0);
      u += w * 0.72 + 0.02;
    }
  }
  fittingRoom(x, cy) {
    this.archLayers(x, 'x0', cy, 1.25, 0.0, 1.95, ['#3E1A26', '#3E1A26']);
    const rr = 0.6, cur = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI - i * Math.PI / 12; cur.push([0.02, cy + Math.cos(a) * rr, 1.95 - rr + Math.sin(a) * rr]); }
    this.fill(x, [[0.02, cy - rr, 0.02], ...cur, [0.02, cy + rr, 0.02]], COL.perla);
    x.save(); x.strokeStyle = 'rgba(169,157,140,0.85)'; x.lineWidth = 1;
    for (let v = cy - 0.46; v < cy + 0.5; v += 0.15) { const a = this.P(0.02, v, 0.04), b = this.P(0.02, v, 1.5); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
    x.restore();
  }
  bottles(x, from, to) {
    for (const z of [1.28, 1.72]) this.fill(x, [[from, 0.03, z], [to, 0.03, z], [to, 0.03, z + 0.04], [from, 0.03, z + 0.04]], COL.perla);
    const r = rng(17), cols = [COL.granate, COL.perla, COL.caliza, COL.carbon, '#8E5E69', COL.calizaClaro, COL.petroleo];
    for (const z of [1.32, 1.76]) for (let u = from + 0.1; u < to - 0.15;) {
      const w = 0.11 + r() * 0.06, h = 0.24 + r() * 0.12, c = cols[Math.floor(r() * cols.length)], m = u + w / 2;
      this.fill(x, [[u, 0.04, z], [u + w, 0.04, z], [u + w, 0.04, z + h * 0.62], [m + 0.025, 0.04, z + h * 0.75], [m + 0.025, 0.04, z + h], [m - 0.025, 0.04, z + h], [m - 0.025, 0.04, z + h * 0.75], [u, 0.04, z + h * 0.62]], c);
      u += w + 0.04 + r() * 0.06;
    }
  }
  storefront(x, plane, c, kind) {
    const w = plane === 'y0' ? 2.3 : 2.0;
    this.archLayers(x, plane, c, w, 0.0, 2.0, ['#F4F2F1', '#E6DFD7']);
    const f = (pts, col) => this.fill(x, pts.map(([u, z]) => this.wp(plane, c + u, z, 0.03)), col);
    f([[-w / 2, 0], [w / 2, 0], [w / 2, 0.06], [-w / 2, 0.06]], COL.caliza);
    if (kind === 'bag') {
      f([[-0.35, 0], [0.35, 0], [0.35, 0.55], [-0.35, 0.55]], COL.calizaClaro);
      f([[-0.2, 0.55], [0.2, 0.55], [0.24, 0.9], [-0.24, 0.9]], COL.granate);
      f([[-0.12, 0.9], [-0.08, 0.9], [-0.06, 1.05], [0.06, 1.05], [0.08, 0.9], [0.12, 0.9], [0.1, 1.1], [-0.1, 1.1]], COL.granate);
      f([[0.55, 0], [0.62, 0], [0.62, 1.3], [0.55, 1.3]], COL.calizaOscuro);
    } else if (kind === 'rack') {
      f([[-0.7, 1.45], [0.7, 1.45], [0.7, 1.49], [-0.7, 1.49]], COL.calizaOscuro);
      [[-0.6, COL.perla], [-0.28, '#8E5E69'], [0.04, COL.caliza], [0.36, COL.granate]].forEach(([u, col]) => f([[u, 1.43], [u + 0.26, 1.43], [u + 0.28, 0.75], [u - 0.02, 0.75]], col));
    } else if (kind === 'lamp') {
      f([[-0.05, 0], [0.05, 0], [0.05, 1.2], [-0.05, 1.2]], COL.calizaOscuro);
      f([[-0.22, 1.2], [0.22, 1.2], [0.14, 1.45], [-0.14, 1.45]], COL.perla);
      f([[0.3, 0], [0.9, 0], [0.9, 0.55], [0.3, 0.55]], '#8E5E69');
      f([[0.3, 0.45], [0.42, 0.45], [0.42, 0.85], [0.3, 0.85]], '#8E5E69');
    } else if (kind === 'shelf') {
      for (const z of [0.5, 0.95, 1.4]) { f([[-0.7, z], [0.7, z], [0.7, z + 0.04], [-0.7, z + 0.04]], COL.calizaOscuro); [[-0.6, COL.granate], [-0.25, COL.perla], [0.1, COL.carbon], [0.4, COL.caliza]].forEach(([u, col], i) => f([[u, z + 0.04], [u + 0.2, z + 0.04], [u + 0.2, z + 0.24 + (i % 2) * 0.08], [u, z + 0.24 + (i % 2) * 0.08]], col)); }
    } else if (kind === 'shoes') {
      for (const z of [0.4, 0.85]) { f([[-0.65, z], [0.65, z], [0.65, z + 0.04], [-0.65, z + 0.04]], COL.calizaOscuro); [-0.5, -0.1, 0.3].forEach((u, i) => f([[u, z + 0.04], [u + 0.28, z + 0.04], [u + 0.28, z + 0.1], [u + 0.08, z + 0.16], [u, z + 0.16]], [COL.carbon, COL.granate, COL.perla][i])); }
    }
  }
  draw(state, t) {
    const x = this.ctx;
    if (!this.base) this.buildBase();
    if (!this.shadows) this.buildShadows();
    x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(this.base, 0, 0);
    x.setTransform(this.px, 0, 0, this.px, 0, 0);
    this.floorLayer(x, state, t);
    x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(this.shadows, 0, 0); x.setTransform(this.px, 0, 0, this.px, 0, 0);
    const inst = instances(t, this.inst, null, this.venue.routes);
    for (const p of inst) this.personShadow(x, p);
    const list = this.items.map(it => ({ d: it.d, it }));
    for (const p of inst) list.push({ d: p.x + p.y + 0.05, p });
    list.sort((a, b) => a.d - b.d);
    for (const e of list) { const k2 = e.it && e.it.kind; if (e.p) this.person(x, e.p); else if (k2 === 'cyl') this.cylDraw(x, e.it); else if (k2 === 'esc') this.escDraw(x, e.it); else if (k2 === 'rail') this.railDraw(x, e.it); else this.chunkDraw(x, e.it); }
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.12;
    x.fillStyle = x.createPattern(paperTile(), 'repeat'); x.fillRect(0, 0, this.cv.width, this.cv.height); x.restore();
  }
}

/* ===== Hero v2: topografía + carrusel de rubros ===== */
THRESH = [1.204, 3.4401, 6.8802, 11.3524]; // calibrate() precalculado: la simulación es determinística
const MAX_HEAT = { tienda: 17.2006, bar: 19.0287, shopping: 15.6714, aeropuerto: 18.5363 };
const STEP = 1 / 30;
const LAYOUTS = {
  desk: { w: 1440, h: 810, k: 34, ox: 900, oy: 190 },
  mob: { w: 390, h: 693, k: 16.5, ox: 158, oy: 360 },
};
const fmtInt = new Intl.NumberFormat('es-AR');
function fmtDur(s) { if (s >= 3600) { const mm = Math.round(s / 60), h = Math.floor(mm / 60); return h + ' h ' + (mm - h * 60) + ' min'; } let m = Math.floor(s / 60), r = Math.round(s - m * 60); if (r === 60) { m++; r = 0; } return m + ' min ' + r + ' s'; }
const LOGO = document.getElementById('logo-src').getAttribute('src');
const ease = p => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

/* rubros: cada uno con su simulación en vivo, ya en régimen */
const VENUES = VENUE_DEFS.map(def => {
  const v = Object.assign({}, def);
  v.maxHeat = MAX_HEAT[v.id] || calibrate(v)[3] / 0.66;
  v.sim = new Sim(40, v); v.ready = false;
  return v;
});
const N = VENUES.length, CYCLE = N * RUBRO_SECS;
/* el piso de cada rubro se precalienta recién cuando hace falta (o en un momento libre) */
function ready(v) { if (!v.ready) { v.sim.run(140); v.base = v.visits0 - v.sim.visits; v.ready = true; } return v; }
/* precalentamiento en pedazos de 5 s de simulación, para no trabar el navegador */
function warm(v, done) {
  if (v.ready) { if (done) done(); return; }
  idle(() => { if (v.ready) { if (done) done(); return; } v.sim.run(Math.min(140, v.sim.t + 5)); if (v.sim.t >= 140) { v.base = v.visits0 - v.sim.visits; v.ready = true; if (done) done(); } else warm(v, done); });
}
const idle = window.requestIdleCallback ? (f => requestIdleCallback(f, { timeout: 2500 })) : (f => setTimeout(f, 200));
function values(v, st, base) {
  return { group: v.group, visitsLabel: (v.labels && v.labels.visits) || 'Visitas', rubro: v.name, visits: fmtInt.format(base + st.visits), dwell: fmtDur(st.dwell), zone: v.zones[st.leader].name, share: Math.round(st.share * 100) + ' % del tiempo en el salón', bar: Math.round(st.share * 100) };
}

const SB_SIMS = VENUES.map(v => ({ v, at: t => { const s = new Sim(0, v); s.run(60); const b = v.visits0 - s.visits; s.run(60 + t); const sn = s.snapshot(); sn.base = b; return sn; } }));

class Hero {
  constructor(frame, mode, live) {
    this.frame = frame; this.mode = mode; this.live = live; this.visible = true; this.vals = {}; this.cur = -1;
    const el = document.createElement('div'); el.className = 'hero hero--' + mode;
    el.innerHTML = `
      <canvas class="hero__scene" aria-hidden="true"></canvas>
      <div class="hero__nav">
        <img class="hero__logo" src="${LOGO}" alt="Vistorm Labs" width="${mode === 'desk' ? 156 : 128}" height="${mode === 'desk' ? 53 : 43}">
        ${mode === 'desk' ? '<nav class="hero__links" aria-label="Secciones"><a href="#medimos">Qué medimos</a><a href="#funciona">Cómo funciona</a><a href="#panel">El panel</a><a href="#privacidad">Privacidad</a></nav>' : ''}
      </div>
      <div class="hero__copy">
        <h1 class="hero__title">Que el mundo físico se mida como el digital.</h1>
        <p class="hero__sub">Mirá cuánta gente entra a tu local, qué hace adentro y qué cambiar. Medimos el comportamiento de tus consumidores.</p>
        <a class="hero__cta" href="#agendar">Pedí una demo</a>
      </div>
      <div class="panel" aria-label="Panel de un local de ejemplo">
        <div class="panel__head"><p class="panel__group" data-k="group"></p><p class="panel__rubro" data-k="rubro"></p></div>
        <div class="panel__row"><span class="panel__label" data-k="visitsLabel"></span><span class="panel__value" data-k="visits"></span><span class="panel__sub">Hoy, hasta ahora</span></div>
        <div class="panel__row"><span class="panel__label">Permanencia</span><span class="panel__value" data-k="dwell"></span><span class="panel__sub">Promedio por visita</span></div>
        <div class="panel__row panel__row--zone"><span class="panel__label">${mode === 'desk' ? 'Zona más visitada' : 'Zona top'}</span><span class="panel__value panel__value--zone" data-k="zone"></span><span class="panel__bar"><i></i></span><span class="panel__sub" data-k="share"></span></div>
      </div>
      <div class="rubros">
        ${live ? '<button class="rubros__pause" type="button" aria-label="Pausar animación"><span></span></button>' : ''}
        <div class="rubros__dots">${VENUES.map((v, i) => `<button type="button" class="rubros__dot" data-i="${i}" aria-label="Ver ${v.name.toLowerCase()}"><i></i></button>`).join('')}</div>
        <span class="rubros__legend"><span class="panel__dot"></span>Local de ejemplo · datos simulados</span>
      </div>`;
    frame.appendChild(el); this.el = el;
    this.cv = el.querySelector('canvas'); const L = LAYOUTS[mode];
    this.cv.style.width = L.w + 'px'; this.cv.style.height = L.h + 'px';
    this.scenes = VENUES.map(v => new SceneRubro(this.cv, Object.assign({}, L), v));
    this.slots = {}; el.querySelectorAll('[data-k]').forEach(n => (this.slots[n.dataset.k] = this.slots[n.dataset.k] || []).push(n));
    this.dots = [...el.querySelectorAll('.rubros__dot')]; this.bar = el.querySelector('.panel__bar i');
    this.prev = document.createElement('canvas');
    new ResizeObserver(() => this.fit()).observe(frame);
    if (live) new IntersectionObserver(es => { this.visible = es[0].isIntersecting; }, { rootMargin: '80px' }).observe(frame);
    this.fit();
  }
  fit() {
    const s = this.frame.clientWidth / LAYOUTS[this.mode].w; if (!s) return;
    this.el.style.transform = 'scale(' + s + ')';
    this.scenes.forEach(sc => sc.resize(s));
    if (this.lastSpec) this.paint(this.lastSpec, true);
  }
  /* spec = { idx, snap|state, t, base, trans?: { from, snap, t, p } , prog } */
  paint(spec, quiet) {
    this.lastSpec = spec;
    const sc = this.scenes[spec.idx], x = sc.ctx;
    if (spec.trans) {
      if (!this.prevReady || this.prevFrom !== spec.trans.from || !spec.liveTrans) {
        const fs = this.scenes[spec.trans.from]; fs.draw(spec.trans.st, spec.trans.t);
        this.prev.width = this.cv.width; this.prev.height = this.cv.height; this.prev.getContext('2d').drawImage(this.cv, 0, 0);
        fs.release(); this.prevReady = true; this.prevFrom = spec.trans.from;
      }
      sc.draw(spec.st, spec.t);
      const e = ease(Math.min(1, spec.trans.p));
      x.setTransform(1, 0, 0, 1, 0, 0); x.save(); x.globalAlpha = 1 - e; x.drawImage(this.prev, 0, 26 * e * sc.px); x.restore();
    } else { this.prevReady = false; sc.draw(spec.st, spec.t); }
    if (this.cur !== spec.idx) { this.scenes.forEach((s2, i) => { if (i !== spec.idx && !(spec.trans && i === spec.trans.from)) s2.release(); }); }
    this.cur = spec.idx;
    const v = VENUES[spec.idx], vals = values(v, spec.st, spec.base);
    for (const key in vals) {
      if (this.vals[key] === vals[key]) continue;
      if (key === 'bar') { this.bar.style.width = vals.bar + '%'; }
      else for (const n of this.slots[key] || []) {
        n.textContent = vals[key];
        if (!quiet && this.vals[key] !== undefined && n.classList.contains('panel__value')) { n.classList.remove('is-tick'); void n.offsetWidth; n.classList.add('is-tick'); }
      }
      this.vals[key] = vals[key];
    }
    this.dots.forEach((d, i) => { const on = i === spec.idx; d.classList.toggle('is-on', on); d.setAttribute('aria-current', on ? 'true' : 'false'); if (on) d.style.setProperty('--p', (spec.prog == null ? 1 : spec.prog).toFixed(3)); });
  }
}


/* ---- control de la landing ---- */
const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduced = mqReduce.matches, paused = false, acc = 0, last = 0, T = FADE_SECS, staticIdx = 0, curIdx = 0, transFrom = N - 1, running = false;
let heroes = [], heroMode = null;
const frame = document.getElementById('hero-frame');
function liveSpec() {
  const idx = Math.floor(T / RUBRO_SECS) % N, local = T % RUBRO_SECS, v = ready(VENUES[idx]);
  const spec = { idx, st: v.sim, t: v.sim.t + acc, base: v.base, prog: local / RUBRO_SECS };
  if (idx !== curIdx) { transFrom = curIdx; curIdx = idx; }
  if (local < FADE_SECS && transFrom !== idx) { const f = ready(VENUES[transFrom]); spec.trans = { from: transFrom, st: f.sim, t: f.sim.t, p: local / FADE_SECS }; spec.liveTrans = true; }
  return spec;
}
const STATIC_SNAPS = [];
function staticSpec(i) { const sn = STATIC_SNAPS[i] || (STATIC_SNAPS[i] = SB_SIMS[i].at(3.3)); return { idx: i, st: sn, t: sn.t, base: sn.base, prog: 1 }; }
function mount() {
  const mode = window.innerWidth >= 900 ? 'desk' : 'mob';
  if (mode === heroMode) return;
  heroMode = mode; frame.innerHTML = ''; frame.className = 'hero-frame hero-frame--' + mode;
  const h = new Hero(frame, mode, true); heroes = [h];
  h.el.querySelector('.rubros__pause')?.addEventListener('click', () => setPaused(!paused));
  h.dots.forEach(d => d.addEventListener('click', () => jump(+d.dataset.i)));
  h.el.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', goTo));
  if (paused) h.el.querySelector('.rubros__pause')?.classList.add('is-paused');
  if (booted) h.paint(reduced ? staticSpec(staticIdx) : liveSpec(), true);
}
let booted = false;
function boot() {
  booted = true;
  heroes.forEach(h => h.paint(reduced ? staticSpec(staticIdx) : liveSpec(), true));
  setReduced(reduced);
  // precalentar el resto de los rubros de a uno, en pedazos chicos
  let i = 1; const next = () => { if (i < N) warm(VENUES[i++], next); }; next();
}
function start() {
  mount();
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(mount, 150); });
  const tg = document.getElementById('rm-toggle');
  if (tg) tg.addEventListener('change', e => setReduced(e.target.checked || mqReduce.matches));
  mqReduce.addEventListener?.('change', e => setReduced(e.matches));
  // el texto del hero aparece enseguida; la escena arranca cuando el navegador está libre
  warm(VENUES[0], boot);
}
function jump(i) {
  if (reduced) { staticIdx = i; heroes.forEach(h => h.paint(staticSpec(i), false)); return; }
  T = Math.floor(T / CYCLE) * CYCLE + i * RUBRO_SECS + (i === Math.floor(T / RUBRO_SECS) % N ? T % RUBRO_SECS : 0);
  if (paused) heroes.forEach(h => h.paint(liveSpec()));
}
function setReduced(v) {
  if (!booted) { reduced = v; return; }
  reduced = v; document.documentElement.classList.toggle('is-reduced', v);
  if (v) heroes.forEach(h => h.paint(staticSpec(staticIdx), true));
  else { heroes.forEach(h => h.vals = {}); kick(); }
}
function setPaused(v) {
  paused = v;
  heroes.forEach(h => { const b = h.el.querySelector('.rubros__pause'); if (b) { b.classList.toggle('is-paused', v); b.setAttribute('aria-label', v ? 'Reanudar animación' : 'Pausar animación'); } });
  if (!v) kick();
}
function kick() { if (running) return; last = 0; running = true; requestAnimationFrame(tick); }
function tick(now) {
  if (paused || reduced) { running = false; return; }
  if (!last) last = now;
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  T += dt; acc += dt;
  const v = ready(VENUES[Math.floor(T / RUBRO_SECS) % N]);
  while (acc >= STEP) { v.sim.step(STEP); acc -= STEP; }
  const spec = liveSpec();
  for (const h of heroes) if (h.visible) h.paint(spec);
  requestAnimationFrame(tick);
}
function goTo(e) {
  const id = e.currentTarget.getAttribute('href').slice(1), t = document.getElementById(id); if (!t) return;
  e.preventDefault(); t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  if (id === 'agendar') setTimeout(() => document.querySelector('.cal__day:not([disabled])')?.focus({ preventScroll: true }), reduced ? 0 : 600);
}
window.VistormGoTo = goTo;
/* escenas estáticas de cada rubro, para otras secciones de la página */
window.VistormScene = function (canvas, id, cssW, cssH) {
  const i = VENUES.findIndex(v => v.id === id); if (i < 0) return false;
  const sn = STATIC_SNAPS[i] || (STATIC_SNAPS[i] = SB_SIMS[i].at(4.2));
  const k = Math.min(cssW / 23, cssH / 18.2);
  const L = { w: cssW, h: cssH, k, ox: cssW / 2 - 2.44 * k, oy: cssH / 2 - 4.4 * k };
  canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
  const sc = new SceneRubro(canvas, L, VENUES[i]);
  sc.resize(1); sc.draw(sn, sn.t); sc.release();
  return true;
};
window.dispatchEvent(new Event('vistorm:scene-ready'));
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

})();
