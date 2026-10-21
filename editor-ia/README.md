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
python -m editor guion "por qué tu prompt no funciona"
python -m editor editar clips/ --guion guion.txt
python -m editor revisar --cambios "más corto, sacá la toma 2"
python -m editor render --plan plan.json
```

Por ahora funciona `render` (fase 1); el resto de los comandos avisa en qué
fase se implementa.

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
- Salida: mp4 1080x1920, 30 fps, H.264 y AAC 48 kHz a -14 LUFS.
- Los clips horizontales se recortan al centro; la rotación de los celulares se respeta.
- Los clips sin audio llevan silencio.

## Tests

```bash
python -m pytest
```
