"""Análisis de clips: ffprobe, tramos con voz, transcripción con tiempos por palabra y caché.

El análisis de cada clip se guarda en caché por hash del archivo: si el clip no
cambió, no se vuelve a transcribir aunque le cambies el nombre.
"""

import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel

# Subir este número invalida la caché cuando cambia el formato del análisis.
VERSION_ANALISIS = 1

EXTENSIONES_VIDEO = {".mp4", ".mov", ".m4v", ".mkv", ".webm"}
TRANSFERENCIAS_HDR = {"smpte2084", "arib-std-b67"}  # PQ y HLG (iPhone graba en HLG)

# Detección de silencios: por debajo de -35 dB durante 0,3 s cuenta como silencio.
UMBRAL_SILENCIO_DB = -35
SILENCIO_MIN_S = 0.3


class InfoClip(BaseModel):
    nombre: str
    duracion: float
    ancho: int          # con la rotación ya aplicada
    alto: int
    tiene_audio: bool
    hdr: bool = False


class Palabra(BaseModel):
    texto: str
    inicio: float
    fin: float
    prob: float = 1.0


class Frase(BaseModel):
    texto: str
    inicio: float
    fin: float
    palabras: list[Palabra]


class AnalisisClip(BaseModel):
    version: int = VERSION_ANALISIS
    hash: str
    transcriptor: str             # qué modelo y configuración generó las frases
    info: InfoClip
    tramos_voz: list[tuple[float, float]]
    frases: list[Frase]

    @property
    def palabras(self) -> list[Palabra]:
        return [p for frase in self.frases for p in frase.palabras]


class Transcriptor(Protocol):
    nombre: str  # entra en la clave de caché: si cambia, se retranscribe

    def transcribir(self, clip: Path) -> list[Frase]: ...


# ---------- ffprobe ----------

def probar(clip: Path) -> InfoClip:
    """Lee duración, tamaño (con la rotación aplicada), si hay audio y si es HDR."""
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
        hdr=video.get("color_transfer") in TRANSFERENCIAS_HDR,
    )


def _rotacion(video: dict) -> int:
    for lado in video.get("side_data_list", []):
        if "rotation" in lado:
            return int(lado["rotation"])
    return int(video.get("tags", {}).get("rotate", 0))


# ---------- tramos con voz ----------

def tramos_con_voz(clip: Path, duracion: float) -> list[tuple[float, float]]:
    """Tramos (inicio, fin) donde hay sonido: lo que queda al sacar los silencios."""
    resultado = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostdin", "-i", str(clip), "-vn",
         "-af", f"silencedetect=noise={UMBRAL_SILENCIO_DB}dB:d={SILENCIO_MIN_S}", "-f", "null", "-"],
        capture_output=True,
        text=True,
    )
    if resultado.returncode != 0:
        raise RuntimeError(f"ffmpeg no pudo analizar el audio de {clip.name}")
    inicios = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", resultado.stderr)]
    fines = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", resultado.stderr)]
    # Si el clip termina en silencio, ffmpeg no informa el silence_end.
    fines += [duracion] * (len(inicios) - len(fines))

    tramos, cursor = [], 0.0
    for inicio, fin in zip(inicios, fines):
        if inicio - cursor > 0.01:
            tramos.append((round(cursor, 3), round(inicio, 3)))
        cursor = fin
    if duracion - cursor > 0.01:
        tramos.append((round(cursor, 3), round(duracion, 3)))
    return tramos


# ---------- transcripción ----------

class TranscriptorWhisper:
    """Transcripción local con faster-whisper; el modelo se carga recién al primer uso."""

    def __init__(self, modelo: str = "small", idioma: str = "es", vocabulario: str = ""):
        self.modelo, self.idioma, self.vocabulario = modelo, idioma, vocabulario
        self.nombre = f"whisper:{modelo}:{idioma}:{vocabulario}"
        self._whisper = None

    def transcribir(self, clip: Path) -> list[Frase]:
        if self._whisper is None:
            from faster_whisper import WhisperModel

            self._whisper = WhisperModel(self.modelo, device="cpu", compute_type="int8")
        segmentos, _ = self._whisper.transcribe(
            str(clip),
            language=self.idioma or None,
            word_timestamps=True,
            vad_filter=True,                    # evita que invente texto en los silencios
            condition_on_previous_text=False,   # evita que repita frases en loop
            initial_prompt=self.vocabulario or None,  # jerga: "prompt, deck, sprint"
        )
        frases = []
        for s in segmentos:
            palabras = [
                Palabra(texto=p.word.strip(), inicio=round(p.start, 3), fin=round(p.end, 3), prob=round(p.probability, 3))
                for p in (s.words or [])
                if p.word.strip()
            ]
            if palabras:
                frases.append(Frase(texto=s.text.strip(), inicio=round(s.start, 3), fin=round(s.end, 3), palabras=palabras))
        return frases


# ---------- caché por hash ----------

def hash_archivo(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as archivo:
        for bloque in iter(lambda: archivo.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def analizar(clip: Path, cache_dir: Path, transcriptor: Transcriptor) -> tuple[AnalisisClip, bool]:
    """Analiza un clip o lo lee de la caché. Devuelve (análisis, si salió de la caché)."""
    huella = hash_archivo(clip)
    ruta_cache = cache_dir / f"{huella}.json"

    if ruta_cache.is_file():
        try:
            guardado = AnalisisClip.model_validate_json(ruta_cache.read_text(encoding="utf-8"))
        except ValueError:
            guardado = None  # caché rota o de otro formato: se rehace
        if guardado and guardado.version == VERSION_ANALISIS and guardado.transcriptor == transcriptor.nombre:
            # Mismo contenido con otro nombre de archivo: vale el análisis, cambia el nombre.
            guardado.info.nombre = clip.name
            return guardado, True

    info = probar(clip)
    tramos = tramos_con_voz(clip, info.duracion) if info.tiene_audio else []
    frases = transcriptor.transcribir(clip) if tramos else []
    analisis = AnalisisClip(hash=huella, transcriptor=transcriptor.nombre, info=info, tramos_voz=tramos, frases=frases)

    cache_dir.mkdir(parents=True, exist_ok=True)
    ruta_cache.write_text(analisis.model_dump_json(indent=1), encoding="utf-8")
    return analisis, False


def clips_de(carpeta: Path) -> list[Path]:
    return sorted(p for p in carpeta.iterdir() if p.is_file() and p.suffix.lower() in EXTENSIONES_VIDEO)
