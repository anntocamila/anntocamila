# editor-ia

Agente de edición de video: recibe clips y un guion (o una idea), arma un
`PlanEdicion` validado con Pydantic y renderiza un video 9:16 con ffmpeg.
El plan completo está en `PLAN.md`; leelo antes de empezar una fase.

## Regla principal

El LLM decide qué tomas usar y dónde cortar. Todo lo que es cálculo (tiempos,
duraciones, validación) o render lo hace el código, nunca el modelo.

## Estado

- [x] Fase 0. Base: repo, `requirements.txt`, `.env.example`, `.gitignore`, CLI vacía.
- [x] Fase 1. Render sin IA (`render --plan plan.json`): cortes, 9:16, zooms, textos (ASS),
  audio a -14 LUFS.
- [x] Fase 2. Ingesta (`analizar carpeta/`): ffprobe con HDR, tramos con voz, Whisper
  con tiempos por palabra, caché por hash en `CACHE_DIR`, subtítulos palabra por palabra
  y tonemapping HDR -> SDR en el render.
- [x] Fase 3. LLM y plan estructurado: `LLMProvider` (`editor/llm/base.py`) con
  `generate_structured` (generar, validar y corregir), `ProveedorAnthropic`, `get_provider()`,
  modelo `Guion` y comando `guion`. Solo está implementado Anthropic.
- [x] Fase 4. Agente con herramientas: `editar carpeta/` corre `armar_plan` (`agente.py`) con
  las 5 tools de `herramientas.py`, el índice de `indice.py` (n-gramas de caracteres y coseno,
  local) y trazas JSONL en `TRAZAS_DIR`. Límite de pasos en `AGENTE_MAX_PASOS`.
- [ ] Fase 5. Revisión humana.
- [ ] Fase 6. Evaluación.

## Convenciones

- Comentarios, docstrings, mensajes de error y nombres del dominio en español.
- Código simple: funciones chicas, sin abstracciones que la fase no necesite.
- Sin claves en el código. Todo sale de `.env` a través de `editor/config.py`;
  `.env` no se commitea, `.env.example` sí (sin valores reales).
- El render nunca recibe un dict crudo: siempre un `PlanEdicion` validado.
- Una fase por sesión: primero mostrar el plan de archivos, después los tests,
  después el código. Un commit por fase.
- Los clips de prueba se generan con ffmpeg en cada corrida (`tests/conftest.py`)
  dentro de `tests/clips_prueba/`; no se commitean videos.
- Los tests no usan Whisper: `TranscriptorFalso` (en `conftest.py`) devuelve tiempos
  conocidos de la voz sintética de `voz.mp4`. El test con Whisper real se saltea si el
  modelo `tiny` no está descargado.
- Si cambia el formato de `AnalisisClip`, subir `VERSION_ANALISIS` para invalidar la caché.
- Los tests no llaman a la API: usan `ProveedorGuionado` (`tests/conftest.py`) o un cliente
  falso. El test contra la API real solo corre con `EDITOR_TEST_API=1`.
- Las validaciones de contenido (duración del guion, tiempos del plan) son funciones
  `errores_de_*` en `modelos.py` que devuelven una lista de errores en español con el dato
  exacto; ese texto vuelve tal cual al modelo para que corrija.
- Cada herramienta tiene un modelo Pydantic de argumentos: el mismo valida lo que pide el
  modelo y genera el esquema que ve. Los errores vuelven como resultado con `es_error`.
- El loop solo agrega mensajes, nunca edita los anteriores (lo exige el razonamiento
  preservado de los modelos nuevos y mantiene la caché de prompts).
- El render arma todo en un solo grafo de ffmpeg: nada de archivos intermedios
  (los cortes de AAC entre partes meten huecos y clics).

## Comandos

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m editor --help      # CLI
python -m pytest             # tests (correr desde editor-ia/)
```

Requiere `ffmpeg` y `ffprobe` en el PATH.
