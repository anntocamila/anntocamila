// Vercel Serverless Function: recibe el pedido de demo del agendador.
// Valida todo de nuevo en el servidor, filtra spam y avisa por mail con Resend.
// Las claves viven solo en variables de entorno de Vercel, nunca en el frontend.
//
// Variables de entorno:
//   RESEND_API_KEY   clave de Resend (obligatoria para enviar)
//   DEMO_FROM        remitente verificado, p. ej. "Vistorm Labs <hola@vistormlabs.com>"
//   DEMO_INBOX       quién recibe los pedidos, p. ej. "hola@vistormlabs.com"
//   SITE_ORIGIN      origen permitido, p. ej. "https://vistormlabs.com"

const SLOTS = ['10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00'];
const MAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
const hits = new Map(); // límite por IP, mejor esfuerzo (se reinicia con cada instancia)

function tooMany(ip) {
  const now = Date.now(), win = 10 * 60 * 1000, max = 5;
  const list = (hits.get(ip) || []).filter(t => now - t < win);
  list.push(now); hits.set(ip, list);
  return list.length > max;
}
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function validate(b) {
  const errors = {};
  const name = clean(b.name, 80), company = clean(b.company, 120), mail = clean(b.mail, 254).toLowerCase();
  const day = clean(b.day, 10), slot = clean(b.slot, 5);
  if (name.length < 2) errors.name = 'Escribí tu nombre.';
  if (company.length < 2) errors.company = 'Escribí el nombre de tu empresa.';
  if (!MAIL_RE.test(mail)) errors.mail = 'Revisá el mail: tiene que ser como nombre@empresa.com.';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(day + 'T12:00:00-03:00') : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const limit = new Date(today.getTime() + 45 * 864e5);
  if (!d || isNaN(d) || d < today || d > limit || d.getUTCDay() === 0 || d.getUTCDay() === 6) errors.day = 'Elegí un día hábil de las próximas semanas.';
  if (!SLOTS.includes(slot)) errors.slot = 'Elegí uno de los horarios disponibles.';
  return { errors, data: { name, company, mail, day, slot } };
}

async function send(to, subject, html, reply) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.DEMO_FROM, to: [to], subject, html, reply_to: reply }),
  });
  if (!r.ok) throw new Error('resend ' + r.status);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }
  const origin = req.headers.origin || '';
  if (process.env.SITE_ORIGIN && origin && origin !== process.env.SITE_ORIGIN) return res.status(403).json({ ok: false });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'sin-ip';
  if (tooMany(ip)) return res.status(429).json({ ok: false, message: 'Recibimos muchos pedidos seguidos. Probá de nuevo en unos minutos.' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object') return res.status(400).json({ ok: false });

  // Antispam: campo trampa vacío y un mínimo de 3 segundos para completar el formulario.
  // A un bot se le responde como si todo hubiera salido bien, para no darle pistas.
  if (clean(b.website, 200) || Number(b.elapsed) < 3000) return res.status(200).json({ ok: true });

  const { errors, data } = validate(b);
  if (Object.keys(errors).length) return res.status(422).json({ ok: false, errors });

  if (!process.env.RESEND_API_KEY || !process.env.DEMO_FROM || !process.env.DEMO_INBOX) {
    return res.status(503).json({ ok: false, message: 'Todavía no podemos recibir pedidos por acá. Escribinos a hola@vistormlabs.com.' });
  }
  const when = esc(data.day) + ' a las ' + esc(data.slot) + ' h (Buenos Aires)';
  try {
    await send(process.env.DEMO_INBOX, 'Pedido de demo: ' + data.company,
      '<p><b>' + esc(data.name) + '</b> de <b>' + esc(data.company) + '</b> pidió una demo para el ' + when + '.</p><p>Mail: ' + esc(data.mail) + '</p>', data.mail);
    await send(data.mail, 'Tu demo con Vistorm Labs',
      '<p>Hola, ' + esc(data.name) + '.</p><p>Recibimos tu pedido de demo para el ' + when + '. Te mandamos la invitación con el link de la videollamada.</p><p>Vistorm Labs</p>', process.env.DEMO_INBOX);
  } catch (e) {
    return res.status(502).json({ ok: false, message: 'No pudimos registrar tu pedido. Probá de nuevo o escribinos a hola@vistormlabs.com.' });
  }
  return res.status(200).json({ ok: true });
};
