# TechPulse — Plan de evolución

Este documento tiene dos partes:

1. **Plan de diseño (UI/UX)**: qué cambiaría en la interfaz y por qué. Solo plan, sin implementar.
2. **Orquestador de búsqueda con LLM**: cómo llevar el input de "preguntá algo" de la
   versión actual (keywords + fan-out) a un agente real que planifica, busca, resume y cita.

---

## 1. Plan de diseño

### 1.1 Identidad visual y sistema de color
- **Color por categoría** en badges, avatar ring y línea lateral de la tarjeta, para que el ojo
  clasifique sin leer: IA violeta, Labs IA cian, Startups verde, Negocios ámbar, Eventos rosa,
  Tech azul. Hoy todos los badges son grises.
- **Tema claro/oscuro** con toggle y respeto a `prefers-color-scheme`. Hoy es solo oscuro.
- **Tipografía**: pasar de `system-ui` a Inter (Google Fonts) con jerarquía explícita: título 16px
  semibold, resumen 15px regular gris 400, metadatos 13px gris 500. Reducir el peso visual del
  nombre de la fuente (hoy compite con el titular).

### 1.2 Tarjetas del feed
- **Favicon real de cada fuente** en el avatar (`https://www.google.com/s2/favicons?domain=…&sz=64`)
  con fallback a las iniciales actuales. Es el cambio de mayor impacto visual por menor esfuerzo.
- **Línea lateral de color** (2px) según categoría, en lugar de solo el badge.
- **Acciones al hover** estilo X: guardar (bookmark), copiar link, compartir, "más de esta fuente".
- **Modo compacto** (solo título + fuente + tiempo) vs. cómodo (actual), recordado en localStorage.
- **Marcar leídos**: atenuar tarjetas ya abiertas (set de links en localStorage).
- **Agrupar duplicados**: cuando 3+ fuentes cubren la misma historia (títulos muy similares por
  Jaccard/trigramas), mostrar una sola tarjeta con "cubierto por TechCrunch, The Verge y 4 más".

### 1.3 Header y navegación
- **Banner "N noticias nuevas · ver"** al terminar un auto-refresh, en vez de reemplazar el feed en
  silencio (evita que el scroll salte). Comportamiento idéntico al de X.
- **Barra de progreso fina** (2px, sky-500) bajo el header mientras cargan fuentes, en lugar del
  texto "Cargando fuentes 12/34".
- **Sidebar con iconos SVG** (Lucide) en vez de emojis; los emojis renderizan distinto en cada SO.
- **Mobile: bottom navigation** (Inicio · Buscar · Guardados · Fuentes) + pull-to-refresh. Los tabs
  horizontales superiores quedan solo para categorías.

### 1.4 Panel derecho: de "lista de fuentes" a "qué está pasando"
- **Trending ahora**: top 8 entidades/keywords más mencionadas en las últimas 24 h (conteo simple
  sobre títulos, con lista de stopwords), clickeables para filtrar. Es el equivalente a los
  "Trends" de X y da valor real.
- **Fuentes colapsables con toggle on/off** por fuente, persistido. Hoy la lista es solo lectura.
- **Estado de fuentes** con semáforo (ok / lenta / caída) y "última vez que respondió".

### 1.5 Vistas nuevas
- **Guardados** (bookmarks en localStorage, exportable a JSON).
- **Fuente** (`/fuente/openai`): timeline de una sola fuente.
- **Briefing diario**: vista que agrupa por categoría lo más relevante del día (base para el
  orquestador de la parte 2).

### 1.6 Accesibilidad y detalles
- Focus rings visibles, `aria-label` en botones con solo icono, contraste AA en grises.
- `prefers-reduced-motion` para skeletons y spinner.
- Estados vacíos con ilustración y CTA (por ejemplo, "probá una pregunta" en Guardados vacío).

### Orden sugerido de implementación
1. Favicons reales + color por categoría + Inter (un día, alto impacto).
2. Banner "N nuevas" + barra de progreso.
3. Trending en panel derecho + toggles de fuentes.
4. Guardados + leídos + modo compacto.
5. Tema claro + bottom nav mobile.
6. Agrupado de duplicados.

---

## 2. Orquestador de búsqueda con LLM

### 2.1 Qué hay hoy
El input "Preguntá algo…" ya funciona **sin LLM** (`src/lib/search.ts`):

1. `questionToQuery()` saca stopwords (es/en) y deja hasta 6 keywords.
   Ej: "¿Qué está pasando con Anthropic y Claude esta semana?" → `anthropic claude`.
2. `liveSourcesFor()` arma 4 fuentes en vivo con esa query: Google News (EN), Google News (ES),
   Bing News RSS y Hacker News (Algolia, por fecha).
3. Se hace fan-out en paralelo con el mismo pipeline del feed (timeouts, dedupe, fallback a proxy).
4. `rankResults()` ordena por relevancia (términos en el título) + frescura.

Sirve para preguntas de entidad ("qué pasó con NVIDIA", "ronda de Mistral"). Falla en preguntas
que necesitan interpretación ("qué modelos salieron que compitan con GPT-5", "eventos de IA en
Buenos Aires este mes") y no resume nada: devuelve links.

### 2.2 A dónde ir: agente "pregunta → briefing con citas"

```
Usuario ─▶ /ask (backend) ─▶ 1. PLAN (LLM)        ─▶ sub-queries + fuentes + rango temporal
                            ─▶ 2. FETCH (paralelo)  ─▶ Google News · Bing · HN · RSS curados · API de búsqueda
                            ─▶ 3. DEDUPE + RANK     ─▶ misma lógica que hoy, server-side
                            ─▶ 4. SINTETIZAR (LLM)  ─▶ resumen en 5-8 bullets, cada uno con [n] → link
                            ─▶ stream SSE al cliente ─▶ UI muestra resumen arriba + tarjetas debajo
```

**Por qué backend**: la API key del modelo nunca debe estar en el navegador, y el fetch
server-side elimina la dependencia de rss2json/allorigins (CORS y rate limits de terceros).
Alcanza con una función serverless (Cloudflare Worker, Vercel Edge o Netlify Function) —
no hace falta un servidor persistente.

**Paso 1 — Planificar (LLM, tool-use / JSON estructurado).** Dada la pregunta, el modelo devuelve:
```json
{
  "queries": ["Anthropic Claude", "Anthropic funding", "Claude Code"],
  "languages": ["en", "es"],
  "since": "2026-09-01",
  "prefer_sources": ["anthropic", "techcrunch", "theverge"],
  "intent": "entity_update"
}
```
Intenciones a cubrir: `entity_update` (qué pasó con X), `comparison` (X vs Y), `event_lookup`
(eventos en lugar/fecha), `explain` (qué es X y por qué importa), `funding` (rondas/inversión).

**Paso 2 — Buscar.** Fan-out a: las 4 fuentes en vivo actuales + los ~34 feeds curados ya
descargados (cache server-side de 5 min) + opcionalmente una API de búsqueda web con resultados
recientes (Brave Search, Tavily, Exa o GDELT para cobertura global/ES). Timeout duro por fuente.

**Paso 3 — Dedupe + rank.** Igual que hoy, más: agrupar duplicados por similitud de título y
priorizar fuentes primarias (blog oficial del lab > medio > agregador).

**Paso 4 — Sintetizar (LLM).** Con los top 15-20 resultados (título + resumen + fecha + fuente)
generar un briefing corto con citas numeradas. Regla dura: solo afirmar lo que está en las
fuentes; si no hay cobertura, decirlo. Streaming para que el resumen aparezca en 1-2 s.

**UI.** Arriba del feed en modo búsqueda: tarjeta "Briefing" con los bullets y las citas
clickeables; debajo, las tarjetas de resultados (ya existen). Follow-ups sugeridos
("¿y la competencia?", "solo en español", "últimas 24 h").

### 2.3 Extensiones naturales
- **Alertas**: guardar una pregunta y correrla cada N horas (cron en el mismo backend);
  notificar por email/Telegram cuando hay resultados nuevos.
- **Ingesta programada + DB**: un cron que guarde todos los posts en SQLite/Postgres (Supabase)
  habilita historial, búsqueda full-text y "temas relacionados" vía embeddings.
- **Briefing diario automático**: la vista de la sección 1.5 alimentada por el mismo pipeline.

### 2.4 Costos y límites a tener en cuenta
- Dos llamadas al LLM por pregunta (plan + síntesis). Cachear por query normalizada 10-15 min.
- Rate-limit por IP en `/ask`; la búsqueda sin LLM (la actual) queda como fallback gratuito.
- Las APIs de búsqueda web tienen free tier limitado; se pueden activar solo para intenciones
  que las necesiten (`event_lookup`, `explain`).

---

## 3. Sobre las fuentes de los labs

Se agregaron 10 fuentes en la categoría **Labs IA**: OpenAI, Google DeepMind, Google AI, Meta AI,
Hugging Face, NVIDIA y Microsoft AI vía RSS oficial; **Anthropic, Mistral y xAI** no publican RSS,
así que se siguen vía Google News RSS con una query por empresa (cubre Reuters, Bloomberg, The
Verge, etc. y muestra "via <medio>" en la tarjeta).

Las URLs fueron elegidas de feeds conocidos, pero **no pudieron verificarse en vivo** desde el
entorno donde se desarrolló (sin salida a internet). Al correr la app, el panel derecho lista
en "Sin datos por ahora" cualquier fuente que no responda: esa es la lista a revisar.
