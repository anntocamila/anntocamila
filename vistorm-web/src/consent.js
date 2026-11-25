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
