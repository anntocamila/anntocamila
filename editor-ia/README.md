# editor-ia

Agente de edición de video con IA. Recibe una carpeta de clips y un guion (o
una idea), arma un plan de edición validado y devuelve un video 9:16 listo
para revisar. El LLM decide qué tomas usar y dónde cortar; el código hace los
cálculos y el render.

El diseño completo, las fases y la evaluación están en [PLAN.md](PLAN.md).

## Instalación

Requiere Python 3.11+ y `ffmpeg`/`ffprobe` en el PATH.

```bash
python -m venv .venv
source .venv/bin/activate        # en Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # completá proveedor, modelo y clave
```

## Uso

```bash
python -m editor --help
python -m editor analizar clips/
python -m editor guion "por qué tu prompt no funciona"
python -m editor editar clips/ --guion guion.txt
python -m editor revisar --cambios "más corto, sacá la toma 2"
python -m editor render --plan plan.json
```

Usan la API de Anthropic, y cuestan plata, `guion`, `editar` y `revisar`.
`analizar`, `render` y la vista previa corren en tu compu y son gratis.

### Edición con el agente

```bash
python -m editor editar clips/ --guion guion.txt --duracion 45
python -m editor revisar --plan clips/plan.json --cambios "más corto, sacá la toma 2"
python -m editor render --plan clips/plan.json
```

`editar` analiza los clips (con caché) y le pasa al agente el guion, `marca.md`
y 5 herramientas: `listar_clips`, `leer_transcripcion`, `buscar_tomas`,
`medir_plan` y `entregar_plan`. El agente busca la mejor toma para cada línea,
corta pegado a la voz y entrega un plan que el código valida contra los clips
reales; si falla, recibe el error y corrige. Si llega a `AGENTE_MAX_PASOS`
(15) sin un plan válido, corta con un error. El guion puede ser texto (una
línea por frase) o el `guion.json` del comando `guion`; sin guion, el agente
arma el video en el orden de grabación.

### Revisión y aprobación

`editar` deja junto al plan:

- `plan.json`: el plan, editable a mano.
- `decisiones.md`: cada corte en una línea, con su nota.
- `vista_previa.mp4`: render rápido a 540p para revisar.
- `proyecto.json`: el análisis de los clips, para no volver a analizarlos.

`revisar --cambios "..."` aplica cambios en lenguaje natural con una sola
llamada al modelo ("la toma 2" es el corte 2 de `decisiones.md`), guarda el
plan anterior como `plan.v1.json`, `plan.v2.json`... y genera una vista previa
nueva. También podés editar `plan.json` a mano y mirar el resultado gratis
con `render --vista-previa`.

`render` hace el video final 1080x1920 solo después de que apruebes el plan
(pregunta `¿Aprobás el plan? [s/N]`; con `--si` no pregunta).

`buscar_tomas` compara con n-gramas de caracteres y similitud coseno: corre
local, sin costo. Cada corrida deja una traza en `trazas/` (un `.jsonl` con
tokens, costo, latencia y cada llamada a herramienta) para entender qué hizo
el agente.

### Guion

`guion` escribe un guion desde una idea con el tono de `marca.md` y deja
`guion.json` y `guion.md` (para leer mientras grabás). El modelo devuelve un
`Guion` validado con Pydantic; el código estima la duración (unas 2,7 palabras
por segundo) y, si se pasa del objetivo, le devuelve la cuenta para que
recorte. Si no lo logra en `LLM_MAX_CORRECCIONES` intentos, falla con los
últimos errores.

```bash
python -m editor guion "tres errores al escribir prompts" --duracion 30
```

Necesita `ANTHROPIC_API_KEY` en `.env`. El modelo por defecto es
`claude-opus-5-5`; se cambia con `LLM_MODEL` y `LLM_ESFUERZO`. Al terminar
muestra los tokens usados y el costo en dólares.

### Análisis de clips

`analizar` lee cada clip (duración, tamaño, rotación, HDR), detecta los tramos
con voz y transcribe con faster-whisper, con tiempos por palabra. El resultado
queda en caché (`CACHE_DIR`, por defecto `.cache/`) por hash del archivo: la
segunda corrida no vuelve a transcribir, aunque renombres el clip. Si cambiás
`WHISPER_MODEL`, `WHISPER_IDIOMA` o `WHISPER_VOCABULARIO`, se retranscribe.

La primera vez, faster-whisper baja el modelo de Hugging Face (`small` pesa
unos 460 MB). Si Whisper confunde jerga, sumala a `WHISPER_VOCABULARIO` o
probá `WHISPER_MODEL=medium`.

### Plan de edición

`render` recibe un `plan.json` escrito a mano (más adelante lo arma el agente).
Los nombres de clip son relativos a `--clips`, que por defecto es la carpeta
del plan:

```json
{
  "titulo": "Por qué tu prompt no funciona",
  "segmentos": [
    {"clip": "toma1.mp4", "inicio": 0.4, "fin": 2.1, "zoom": "lento", "texto": "Tu prompt está mal"},
    {"clip": "toma3.mp4", "inicio": 5.0, "fin": 8.2, "zoom": "golpe"},
    {"clip": "broll.mov", "inicio": 0.0, "fin": 1.5, "nota": "b-roll mudo"}
  ]
}
```

- `zoom`: `ninguno`, `golpe` (acercamiento fijo de 115 %) o `lento` (de 100 % a 112 %).
- `texto`: hasta 40 caracteres, arriba al centro durante todo el segmento.
- `subtitulos` (por defecto `true`): `render` transcribe los clips usados (o los
  lee de la caché) y dibuja subtítulos de a 3 palabras, con la que suena resaltada.
- Salida: mp4 1080x1920, 30 fps, H.264 y AAC 48 kHz a -14 LUFS.
- Los clips horizontales se recortan al centro; la rotación de los celulares se respeta
  y los clips HDR (iPhone) se pasan a SDR.
- Los clips sin audio llevan silencio.

## Tests

```bash
python -m pytest
EDITOR_TEST_API=1 python -m pytest tests/test_guion.py tests/test_agente.py   # contra la API real (cuesta plata)
```
