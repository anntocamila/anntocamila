# Plan: agente de edición de video con IA

21 oct 2026 · @anto

## Qué vamos a construir

Un agente de edición que recibe tus clips y un guion (o una idea), arma un plan de edición validado y devuelve un video 9:16 listo para revisar. El LLM decide qué tomas usar y dónde cortar; el código hace todo lo que es cálculo o render. Es la misma regla de tu curso: lo determinístico no depende de una predicción de texto.

**Entrada:** una carpeta con clips (celular, horizontal o vertical), un guion en texto o una idea, y un archivo `marca.md` con tu estilo.

**Salida:** `video_final.mp4` (1080x1920, 30 fps, audio normalizado para redes), `plan.json` editable y `decisiones.md` con cada corte explicado en una línea.

**Alcance de la v1:**

- Elegir la mejor toma cuando una frase se grabó varias veces
- Cortar silencios, muletillas y tomas falsas; unir clips en el orden del guion
- Reencuadrar a 9:16
- Zoom de golpe (jump cut) y zoom lento (gancho)
- Texto en pantalla corto en el gancho y en ideas clave
- Subtítulos palabra por palabra con la palabra actual resaltada
- Normalización de audio y música de fondo opcional que baja cuando hablás
- Generar un guion desde una idea, con el tono de tu marca
- Pedir cambios en lenguaje natural ("más corto, sacá la toma 2") sin rehacer todo

**Fuera de la v1:** b-roll buscado en internet, transiciones y efectos complejos, corrección de color, publicar automáticamente y editar desde el celular. Corre local en tu computadora.

No puede ser tu TP integrador, porque el corpus del TP lo fija la cátedra. Sí usa la misma arquitectura, así que sirve para practicar cada checkpoint con un caso propio.

## Arquitectura

El sistema tiene seis etapas en fila y dos ciclos de corrección; solo una etapa usa el LLM para decidir, el resto es código.

El agente vuelve a trabajar en dos casos: cuando la validación encuentra un error y cuando pedís cambios. Las trazas registran tokens, costo, latencia y cada llamada a una herramienta en todas las etapas que usan el LLM.

Casi cada pieza es un tema de tu curso, así que cada fase te sirve de práctica:

| Concepto del curso | Clase | Dónde aparece en el editor |
|---|---|---|
| LLMClient con reintentos y backoff | 2 | Todas las llamadas al modelo |
| LLMProvider y `get_provider()` | 3 | Cambiar de proveedor desde `.env` |
| Salidas estructuradas con Pydantic | 3 | `PlanEdicion` y `Guion` |
| Generar, validar y corregir | 3 | El error de validación vuelve al agente |
| Tool calling y loop de agente | 3 | Las 5 herramientas del agente |
| Observabilidad | 3 | Trazas de tokens, costo, latencia y tools |
| Embeddings, similitud coseno y hashes | 4 | Índice de frases para buscar tomas y caché de análisis |
| Dataset de evaluación | Checkpoint 8 | Proyectos de prueba y métricas |
| Workflow con aprobación humana | Checkpoint 10 | Aprobás el plan antes del render final |
| FastAPI y Streamlit | Checkpoint 11 | Interfaz opcional |

## El agente: herramientas, loop y prompt

El agente es un LLM con 5 herramientas en un loop de hasta 15 pasos, que termina cuando entrega un plan que pasa la validación. El modelo solicita las herramientas; tu código valida los argumentos y las ejecuta, como en el ejemplo del ticket de la Clase 3.

| Herramienta | Qué hace | Quién la resuelve |
|---|---|---|
| `listar_clips()` | Devuelve nombre, duración y tramos con voz de cada clip. | Código (lee el análisis) |
| `leer_transcripcion(clip, desde, hasta)` | Devuelve las frases con tiempos de un tramo. | Código |
| `buscar_tomas(frase, k=3)` | Devuelve las k tomas más parecidas a una línea del guion, con clip y tiempos. | Código con embeddings y similitud coseno |
| `medir_plan(plan)` | Devuelve duración total, segmentos inválidos y saltos raros. | Código |
| `entregar_plan(plan)` | Valida el plan con Pydantic y lo guarda; si falla, devuelve el error al agente. | Código |

Opcional para más adelante: `ver_fotograma(clip, segundo)` con un modelo con visión, para elegir entre tomas que dicen lo mismo según la mirada o el encuadre.

**El loop:**

1. Se envían el guion, el estilo de `marca.md` y las herramientas.
2. El agente lista los clips y, por cada línea del guion, busca las tomas candidatas.
3. Lee las transcripciones que necesite y arma el plan.
4. Mide el plan; si se pasa de la duración objetivo, recorta.
5. Entrega el plan. Si la validación falla, recibe el error concreto y corrige (patrón generar, validar y corregir).
6. Si llega a 15 pasos sin un plan válido, el sistema corta y avisa con un error claro.

**Reglas del prompt del sistema (resumen):**

- Seguir el guion; si una frase tiene varias tomas, elegir la completa y sin trabas (la última suele ser la mejor).
- Cortar pegado a la voz, con 0,05 a 0,1 s de margen.
- Arrancar directo con el gancho: nada de "ahí va, ya grabo".
- Zoom lento en el gancho, zoom de golpe cada 2 o 3 cortes del mismo plano.
- Texto en pantalla de máximo 6 palabras, solo en el gancho y en 2 o 3 ideas.
- Usar solo tiempos que existen; las cuentas las hace `medir_plan`, no el modelo.

**Elección de modelos (matriz de la Clase 1):** son dos decisiones separadas. El generativo necesita tool calling confiable y contexto largo; el de embeddings tiene que funcionar bien en español rioplatense. Compará al menos tres opciones (por ejemplo Claude, Gemini y uno local con Ollama para pruebas baratas) midiendo con tu dataset de prueba, no por marca.

**Transcripción:** faster-whisper corre local y gratis, y los clips no salen de tu computadora. Con el modelo `small` alcanza para empezar; si falla con jerga tech, probá `medium` o pasale un vocabulario inicial.

## Contrato del plan de edición

El plan de edición es el contrato entre el agente y el render: un modelo Pydantic con campos cerrados, sin campos extra, validado siempre antes de renderizar. Así el render nunca recibe texto crudo ni un diccionario sin validar (criterio de éxito de la Clase 3).

```python
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Segmento(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clip: str                       # nombre del archivo
    inicio: float = Field(ge=0)     # segundos dentro del clip
    fin: float
    zoom: Literal["ninguno", "golpe", "lento"] = "ninguno"
    texto: str = Field("", max_length=40)   # texto en pantalla
    nota: str = Field("", max_length=120)   # por qué este corte

    @model_validator(mode="after")
    def largo_minimo(self):
        if self.fin - self.inicio < 0.2:
            raise ValueError("cada segmento dura al menos 0,2 s")
        return self


class PlanEdicion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    titulo: str = Field(max_length=60)
    segmentos: list[Segmento] = Field(min_length=1)
    subtitulos: bool = True
```

**Validación en dos niveles:**

1. **Estructura (Pydantic):** tipos, valores permitidos, largos.
2. **Contenido (código, con el inventario de clips):** que cada clip exista y que `fin` no supere la duración real. El error vuelve al agente con el dato exacto, por ejemplo: "toma3.mp4 dura 8,4 s y pediste fin=9,1".

Un plan válido no garantiza un buen video, igual que en la clase: objeto válido no significa información correcta. Eso lo mide la evaluación.

**Segundo modelo estructurado:** `Guion`, con gancho, escenas (texto hablado, plano, texto en pantalla), cierre, lista de tomas y copy del posteo. Lo genera el comando `guion` desde una idea.

## Stack y estructura del repo

Todo en Python con ffmpeg, siguiendo las convenciones del curso: entorno virtual, `requirements.txt`, credenciales en `.env` y proveedor elegido con `LLM_PROVIDER`.

| Pieza | Herramienta | Para qué |
|---|---|---|
| Video y audio | ffmpeg y ffprobe | Cortes, 9:16, zooms, subtítulos, música, normalización |
| Transcripción | faster-whisper | Palabras con tiempos, local |
| LLM | Tu LLMProvider (Clase 3) | Agente, guion, revisiones |
| Embeddings | Proveedor elegido o un modelo local multilingüe | `buscar_tomas` |
| Validación | Pydantic v2 | Plan y guion |
| Configuración | python-dotenv | `.env` con proveedor, modelos y claves |
| Interfaz | Typer (CLI); más adelante FastAPI y Streamlit | Usarlo fuera de un notebook |
| Pruebas | pytest | Render y validación |

```
editor-ia/
├── CLAUDE.md              # contexto para Claude Code: este plan resumido
├── README.md
├── requirements.txt
├── .env.example           # sin claves reales; .env va en .gitignore
├── marca.md               # tono y estilo de tu marca
├── editor/
│   ├── cli.py             # comandos: guion, editar, revisar, render
│   ├── config.py          # lee .env
│   ├── llm/
│   │   ├── base.py        # LLMProvider: generate, generate_structured
│   │   ├── anthropic.py   # un archivo por proveedor
│   │   └── factory.py     # get_provider()
│   ├── ingesta.py         # ffprobe, silencios, Whisper, caché por hash
│   ├── indice.py          # embeddings de frases y búsqueda por similitud
│   ├── modelos.py         # PlanEdicion, Segmento, Guion
│   ├── herramientas.py    # las 5 tools y su despacho
│   ├── agente.py          # loop del agente con límite de pasos
│   ├── render.py          # ffmpeg y subtítulos ASS
│   └── trazas.py          # log de tokens, costo, latencia y llamadas a tools
├── tests/
│   ├── clips_prueba/      # clips sintéticos generados con ffmpeg
│   └── test_*.py
└── eval/
    ├── proyectos/         # tus casos reales con lo esperado
    └── evaluar.py
```

El análisis de cada clip se guarda en caché por hash de archivo, como el control de cambios del corpus de la Clase 4: si el clip no cambió, no se vuelve a transcribir.

## Fases de construcción con Claude Code

Construilo en 7 fases, de lo determinístico a lo inteligente: primero que el render funcione con un plan escrito a mano, recién después agregar el agente. Si el render falla, ningún agente lo arregla; y así cada fase se prueba sola.

| Fase | Qué queda funcionando | Terminado cuando |
|---|---|---|
| 0. Base | Repo, entorno virtual, `requirements.txt`, `.env.example`, `.gitignore`, `CLAUDE.md`. | `python -m editor --help` corre y no hay claves en el código. |
| 1. Render sin IA | `render --plan plan.json`: cortes, 9:16, zoom de golpe y lento, textos, unión, audio a -14 LUFS. | Con 3 clips de prueba (horizontal, vertical, sin audio) sale un mp4 1080x1920 a 30 fps, sin clics en los cortes. |
| 2. Ingesta | Duración, tramos con voz, transcripción con tiempos por palabra, caché por hash, subtítulos. | La segunda corrida no retranscribe; los subtítulos coinciden con la voz. |
| 3. LLM y plan estructurado | LLMProvider, `get_provider()`, `generate_structured` con reintentos y realimentación, modelos `PlanEdicion` y `Guion`, comando `guion`. | Un plan con tiempos imposibles se corrige solo; si no puede, falla con un error claro. |
| 4. Agente con herramientas | Las 5 tools, índice de embeddings para `buscar_tomas`, loop con límite de pasos y trazas. | En tus casos de prueba con tomas repetidas elige la toma correcta en la mayoría (fijá el umbral en la fase 6). |
| 5. Revisión humana | Vista previa rápida a 540p, `decisiones.md`, comando `revisar --cambios`; el render final solo se hace después de tu aprobación. | Un pedido como "sacá la toma 2" genera un plan nuevo sin volver a analizar los clips. |
| 6. Evaluación | Dataset de proyectos y script que mide calidad, costo y latencia. | Tenés una tabla de métricas por versión y sabés qué cambio la mejoró. |

Opcional después: API con FastAPI y una interfaz en Streamlit para subir clips, ver el plan y aprobarlo (como los checkpoints 11 y 12 del curso), y exportar el plan a FCPXML para terminar en DaVinci Resolve o Premiere.

**Cómo trabajar con Claude Code:**

1. Exportá este doc a Markdown y guardalo como `PLAN.md` en el repo; en `CLAUDE.md` poné un resumen, las convenciones (español en comentarios, código simple, sin claves en el código) y el comando para correr los tests.
2. Una fase por sesión. Empezá cada una con "Leé PLAN.md y hacé la fase N; antes de codear, mostrame el plan de archivos".
3. Pedí primero los tests de la fase (por ejemplo, generar clips sintéticos con ffmpeg y verificar resolución y duración) y después el código.
4. Revisá cada diff y corré los tests vos antes de pasar a la siguiente fase. Hacé un commit por fase.

Ya hay un prototipo de un solo archivo (`editor.py`) armado en esta conversación con el render, la detección de silencios y los subtítulos. Sirve como referencia para las fases 1 y 2, pero no se probó todavía.

## Cómo evaluarlo

Armá un dataset de 6 a 10 proyectos reales y medí cada versión con las mismas métricas; sin eso no sabés si un cambio de prompt o de modelo mejoró algo. Es la misma lógica del dataset de evaluación del TP: casos representativos y métricas de calidad, costo y latencia.

**Casos que tiene que cubrir el dataset:**

- Una frase grabada 3 veces, con una toma trabada
- Un video con guion y otro sin guion
- Clips con silencios largos y muletillas
- Mezcla de clips horizontales y verticales
- Un clip sin audio usado como b-roll
- Un guion con jerga tech en inglés (prompt, deck, sprint)

Por cada proyecto anotá a mano lo esperado: qué toma corresponde a cada línea del guion y la duración objetivo.

| Métrica | Cómo se mide |
|---|---|
| Toma correcta | % de líneas del guion donde eligió la toma que marcaste |
| Cobertura del guion | % de líneas del guion presentes en el video |
| Silencios que quedaron | Segundos de silencio mayor a 0,4 s en el video final, medidos con ffmpeg |
| Error de duración | Diferencia en segundos contra la duración objetivo |
| Plan válido al primer intento | % de planes que pasan la validación sin corrección |
| Costo por video | Tokens de entrada y salida por la tarifa del proveedor |
| Tiempo por video | Minutos desde que corrés el comando hasta el mp4 |
| Retoques manuales | Cuántos cambios tuviste que pedir antes de publicar |

Las trazas de la fase 4 (llamadas a tools, tokens, latencia) son las que permiten explicar por qué un caso falló. Pasar las pruebas no garantiza acertar siempre: cada video real que tengas que corregir mucho es un caso nuevo para el dataset.

## Riesgos, costos y decisiones abiertas

El riesgo principal no es el LLM sino el video: clips de celular con formatos raros rompen el render antes de que el agente haga nada.

| Riesgo | Mitigación |
|---|---|
| Clips de iPhone con HDR, rotación o fps variable | Normalizar cada clip al importarlo: 30 fps constantes, SDR, rotación aplicada |
| El modelo inventa tiempos | Herramientas que devuelven tiempos reales, validación contra el inventario y realimentación del error |
| Whisper se equivoca con jerga o inglés | Modelo más grande o vocabulario inicial; los subtítulos se pueden corregir en el plan |
| Transcripciones largas encarecen cada llamada | Mandar frases y no palabras sueltas, usar `buscar_tomas` en vez de pasar todo, y caché del contexto estable |
| Render lento (sobre todo el zoom lento) | Vista previa a 540p para revisar; render final solo al aprobar |
| Fuentes que no están instaladas | Carpeta `fuentes/` en el repo con la tipografía de tu marca |
| Derechos de la música | Usar música libre de derechos, o agregar la música dentro de TikTok |
| Reintentos que multiplican el costo | Límite de pasos del agente y de reintentos, y registro de tokens por video |

**Costos:** el render y la transcripción local no cuestan nada más que tiempo de tu computadora. El costo variable es el del LLM: varias llamadas por video (cada paso del loop más las correcciones). Medilo con las trazas desde la fase 4 en vez de estimarlo ahora.

**Decisiones abiertas:**

- [ ] Proveedor del LLM y del modelo de embeddings (con tu matriz de selección)
- [ ] Whisper local o transcripción por API
- [ ] Empezar solo con la CLI o sumar Streamlit antes de la evaluación
- [ ] Si vale la pena exportar a FCPXML para terminar en un editor profesional
- [ ] Tipografía y colores fijos para subtítulos y textos (del manual de marca)
