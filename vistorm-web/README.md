# vistorm-web

Sitio de Vistorm Labs listo para Vercel: landing de una sola acción («Pedí una demo»), política de privacidad, términos, página 404 y la función que recibe los pedidos de demo. Es HTML, CSS y JS sin framework ni paso de build obligatorio.

## Publicar en Vercel

1. Importar el repo en Vercel con **Root Directory** = `vistorm-web` y Framework = **Other** (sin build).
2. En **Settings → Domains**, agregar `vistormlabs.com` y `www.vistormlabs.com`. Vercel emite el certificado y fuerza HTTPS; `vercel.json` suma HSTS y redirige `www` a la raíz.
3. Cargar las variables de entorno (Settings → Environment Variables):

| Variable | Para qué | Ejemplo |
| --- | --- | --- |
| `RESEND_API_KEY` | Enviar los mails del pedido de demo | `re_…` (nunca en el frontend) |
| `DEMO_FROM` | Remitente verificado en Resend | `Vistorm Labs <hola@vistormlabs.com>` |
| `DEMO_INBOX` | Quién recibe los pedidos | `hola@vistormlabs.com` |
| `SITE_ORIGIN` | Origen permitido para el formulario | `https://vistormlabs.com` |

4. Analytics: reemplazar `G-XXXXXXXXXX` por el ID de medición de GA4 en la etiqueta `<meta name="vistorm:ga-id">` de `index.html`, `privacidad.html`, `terminos.html` y `404.html`. Con el ID de ejemplo no se carga nada y no aparece el banner de cookies.
5. Después de publicar: dar de alta `https://vistormlabs.com/sitemap.xml` en Google Search Console.

## Qué incluye y dónde

| Tema | Cómo está resuelto |
| --- | --- |
| Política de privacidad y términos | `privacidad.html` y `terminos.html`. **Son borradores** para que los revise Legal (Bloque 3); tienen datos a completar entre corchetes. |
| Secretos y claves | El frontend no tiene claves. La de Resend vive solo en Vercel y la usa `api/demo.js`. |
| HTTPS | Vercel lo fuerza; `vercel.json` agrega `Strict-Transport-Security` y `upgrade-insecure-requests`. |
| Encabezados de seguridad | CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy` en `vercel.json`. |
| Banner de cookies | `assets/js/consent.js`. Google Analytics se carga solo si la persona acepta (Consent Mode v2, IP anonimizada). «Configurar cookies» en el pie lo vuelve a abrir. |
| Metatítulos, descripciones, previsualización | En el `<head>` de cada página: título, descripción, canónica, Open Graph y Twitter. Imagen: `assets/img/og-image.jpg` (1200 × 630, 90 KB). |
| Favicon | `favicon.ico`, `favicon.svg`, PNG de 16/32/48, `apple-touch-icon.png`, `site.webmanifest` con íconos de 192 y 512, todos de la identidad nueva. |
| Sitemap y robots | `sitemap.xml` (inicio, privacidad, términos) y `robots.txt` (bloquea `/api/`). |
| Texto alternativo | Todas las imágenes tienen `alt`; la ilustración animada es decorativa (`aria-hidden`) y el panel de cifras es texto real. |
| Imágenes comprimidas | Logos SVG optimizados (−28 %), imagen social en JPG progresivo, JS y CSS minificados. |
| Velocidad | Lighthouse local, con la animación del hero corriendo: escritorio 100, celular 83–90 según la corrida (CLS 0). El relieve del hero se rehace una capa por cuadro y cada sección animada se configura en su propia tarea. Ilustraciones en WebP con carga diferida. |
| Contraste y accesibilidad | axe-core sin errores en todas las páginas; Lighthouse Accesibilidad 100. |
| Celular | Probado a 390 px: sin desborde lateral, botones de al menos 24 px. |
| Página 404 | `404.html`, con el botón de demo y la vuelta al inicio. |
| Enlaces rotos | Revisados todos los enlaces internos y anclas: ninguno roto. |
| Validación de formularios | En el navegador (mensajes por campo) y de nuevo en el servidor (`api/demo.js`). |
| Antispam | Campo trampa oculto, tiempo mínimo de 3 s, límite de 5 pedidos cada 10 minutos por IP y control de origen. |
| Analytics | GA4 con consentimiento. Eventos: `cta_click` y `generate_lead`. |
| CTA único | Todos los botones dicen «Agendá una demo» y llevan al agendador. No hay precios ni links que saquen de la página. |
| Sin vías de escape | El hero no tiene menú de navegación: la única acción es «Pedí una demo». Privacidad y términos quedan en el pie. |
| Contenido personalizado | Agregando `?rubro=` al enlace (tienda, bar, shopping, aeropuerto; también gastronomia, hoteles, transporte) el hero arranca en ese rubro y la sección «Para quién» abre su tarjeta. Útil para campañas por industria. |

## Estructura

Hero («Entendé qué pasa dentro de tu local.») → qué medimos (cinco cuadros de papel cortado; el activo se abre con su texto) → para quién (Retail y comercio; Centros comerciales; Gastronomía y hotelería; Servicios, salud y educación) → Vistorm en acción (la réplica del software con un local de ejemplo, arranca en Mesas; papel en capas alrededor y superficie lisa para los datos) → cómo funciona → demo («Conocé Vistorm.») → preguntas frecuentes. Todos los botones dicen «Agendá una demo» y abren el agendador en un pop-up.

Redes sociales: completar los enlaces de Instagram y LinkedIn en `SOCIAL` (en el generador) para que aparezcan en el pie.

## Movimiento

Scroll suave con Lenis 1.1.13 y escenas guiadas por scroll con GSAP 3.12.5 + ScrollTrigger, todo servido desde `assets/vendor/`. Con «reducir movimiento» activado en el sistema, la página muestra cada escena en su estado final, sin scroll suave ni escenas fijadas.

## Editar

Los archivos legibles están en `src/`. Los que se publican en `assets/` están minificados. Después de editar `src/`, correr:

```bash
npm install
npm run minify
```

## Pendientes antes de publicar

- Revisión legal de privacidad y términos, y completar razón social, CUIT y domicilio.
- Definir la herramienta de agenda (Google Calendar, Cal.com o Calendly). Hoy el formulario avisa por mail a `DEMO_INBOX` y le confirma a la persona; el link de la videollamada se manda a mano.
- Dominio `vistormlabs.com` apuntando a Vercel y mails `hola@` y `privacidad@` funcionando (verificar el dominio en Resend).
- ID de GA4.

## Panel

`panel-theme/vistorm-panel-theme.css` viste el panel actual con la identidad nueva, sin tocar componentes. Ver `panel-theme/README.md`.
