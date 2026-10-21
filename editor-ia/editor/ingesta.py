"""Análisis de clips. Por ahora solo ffprobe; la transcripción y la caché llegan en la fase 2."""

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class InfoClip:
    nombre: str
    duracion: float
    ancho: int
    alto: int
    tiene_audio: bool


def probar(clip: Path) -> InfoClip:
    """Lee duración, tamaño (con la rotación aplicada) y si el clip tiene audio."""
    resultado = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(clip)],
        capture_output=True,
        text=True,
    )
    if resultado.returncode != 0:
        raise RuntimeError(f"ffprobe no pudo leer {clip.name}: {resultado.stderr.strip()}")
    datos = json.loads(resultado.stdout)
    video = next((s for s in datos["streams"] if s["codec_type"] == "video"), None)
    if video is None:
        raise RuntimeError(f"{clip.name} no tiene pista de video")

    ancho, alto = int(video["width"]), int(video["height"])
    # Los celulares graban en horizontal y marcan la rotación; ffmpeg la aplica al decodificar.
    if abs(_rotacion(video)) in (90, 270):
        ancho, alto = alto, ancho

    return InfoClip(
        nombre=clip.name,
        duracion=float(datos["format"]["duration"]),
        ancho=ancho,
        alto=alto,
        tiene_audio=any(s["codec_type"] == "audio" for s in datos["streams"]),
    )


def _rotacion(video: dict) -> int:
    for lado in video.get("side_data_list", []):
        if "rotation" in lado:
            return int(lado["rotation"])
    return int(video.get("tags", {}).get("rotate", 0))

