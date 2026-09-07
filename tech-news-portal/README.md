# TechPulse 📡

Un portal de noticias tech estilo timeline (Twitter/X) que agrega en un solo lugar
lo último de **inteligencia artificial, startups, negocios, eventos y tecnología**
desde fuentes RSS públicas de todo internet.

No es un scraper propio: consume feeds RSS oficiales de medios como TechCrunch,
The Verge, VentureBeat, MIT Technology Review, Ars Technica, Wired, Hacker News,
Product Hunt, Crunchbase News y otros, los normaliza, los etiqueta por categoría
y los muestra como un feed único ordenado por fecha — con búsqueda, filtros y
auto-actualización cada 5 minutos.

## Funcionalidades

- **Feed estilo timeline**: tarjetas con avatar de la fuente, título, resumen,
  imagen (cuando el feed la trae), categoría y tiempo relativo ("hace 3h").
- **Categorías**: IA, Labs IA, Startups, Negocios, Eventos, Tech — un mismo
  artículo puede aparecer en más de una si el título/resumen matchea varias.
- **Labs IA**: seguimiento de las empresas que hacen los modelos (OpenAI,
  Anthropic, Google DeepMind, Meta AI, Mistral, xAI, Hugging Face, NVIDIA,
  Microsoft AI). Las que no publican RSS se siguen vía Google News.
- **"Preguntá algo"**: escribís una pregunta en lenguaje natural y el
  orquestador la convierte en keywords, consulta en paralelo Google News
  (EN/ES), Bing News y Hacker News, y devuelve los resultados rankeados por
  relevancia + frescura. Ver `src/lib/search.ts` y `docs/PLAN.md` para la
  versión con LLM.
- **Filtro local** por palabra clave sobre título, resumen y fuente.
- **Auto-refresh** cada 5 minutos + botón de actualizar manual, con render
  progresivo (las fuentes aparecen a medida que responden) y cache local
  para que el feed cargue al instante al volver a abrir.
- **100% client-side**: no hay backend ni base de datos, todo corre en el
  navegador. Se puede desplegar como sitio estático (GitHub Pages, Vercel,
  Netlify, etc.).
- Diseño responsive, tema oscuro inspirado en X/Twitter.

## Cómo funciona el agregador (`src/lib/rss.ts`)

Como los feeds RSS no tienen CORS habilitado para llamarlos directo desde el
navegador, cada fuente se intenta cargar en dos pasos:

1. **[rss2json.com](https://rss2json.com/)** (API gratuita, sin key) convierte
   el RSS a JSON con headers CORS abiertos.
2. Si falla, se usa un proxy CORS genérico
   (`api.allorigins.win`) para traer el XML crudo y parsearlo en el navegador
   con `DOMParser` (soporta RSS 2.0 y Atom).

Si ambas fallan para una fuente puntual, esa fuente simplemente no aporta
posts en ese ciclo (se loguea en consola y aparece listada en "Sin datos por
ahora" en el panel derecho) — el resto del feed sigue funcionando con
normalidad.

> Nota: estos proxies gratuitos pueden tener rate limits. Para un uso más
> intensivo/productivo, lo ideal es correr tu propio backend liviano que haga
> el fetch de los RSS server-side (evita CORS y rate limits de terceros).

## Agregar o quitar fuentes

Editá `src/data/feeds.ts`. Cada fuente es:

```ts
{ id: "techcrunch", name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "business" }
```

`category` es la categoría "primaria" de la fuente. Además, `src/lib/categorize.ts`
le agrega tags extra por keyword (por ejemplo, si el título menciona "startup"
o "funding", ese post también aparece en el filtro correspondiente aunque la
fuente sea de otra categoría).

## Desarrollo

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # build de producción en dist/
npm run preview   # sirve el build de producción
```

## Roadmap

En [`docs/PLAN.md`](docs/PLAN.md) está el plan de diseño (favicons reales,
color por categoría, trending, guardados, tema claro, mobile) y la
arquitectura del orquestador con LLM (planificar → buscar → rankear →
sintetizar con citas).

## Stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/)
- Sin dependencias de backend — 100% estático
