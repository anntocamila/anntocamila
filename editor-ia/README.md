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

Por ahora solo está la fase 0: los comandos existen pero avisan en qué fase
se implementan.

## Tests

```bash
python -m pytest
```
