"""Clips sintéticos para los tests, generados con ffmpeg en tests/clips_prueba/."""

import json
import subprocess
from pathlib import Path

import pytest

from editor.ingesta import AnalisisClip, Frase, InfoClip, Palabra
from editor.llm.base import LLMProvider, Respuesta

CARPETA_CLIPS = Path(__file__).resolve().parent / "clips_prueba"


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y", *args], check=True)


def ffprobe(ruta: Path) -> dict:
    salida = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", "-count_frames", str(ruta)],
        capture_output=True, text=True, check=True,
    )
    return json.loads(salida.stdout)


@pytest.fixture(scope="session")
def clips() -> Path:
    """Genera los clips de prueba en cada corrida (tardan un par de segundos)."""
    CARPETA_CLIPS.mkdir(exist_ok=True)
    video_h264 = ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"]

    # Horizontal 16:9 a 30 fps, con un tono de 440 Hz mono a 44,1 kHz como "voz".
    ffmpeg(
        "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=4",
        "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=4",
        *video_h264, "-c:a", "aac", "-shortest", str(CARPETA_CLIPS / "horizontal.mp4"),
    )
    # Vertical a 25 fps (hay que pasarlo a 30), con tono de 660 Hz estéreo a 48 kHz.
    ffmpeg(
        "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=25:duration=4",
        "-f", "lavfi", "-i", "sine=frequency=660:sample_rate=48000:duration=4",
        *video_h264, "-c:a", "aac", "-ac", "2", "-shortest", str(CARPETA_CLIPS / "vertical.mp4"),
    )
    # Sin audio (b-roll), a 24 fps.
    ffmpeg(
        "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=24:duration=3",
        *video_h264, str(CARPETA_CLIPS / "sin_audio.mp4"),
    )
    # Como un iPhone: grabado en 1280x720 con la rotación de 90° marcada en la metadata.
    sin_rotar = CARPETA_CLIPS / "rotado_tmp.mp4"
    ffmpeg(
        "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=3",
        "-f", "lavfi", "-i", "sine=frequency=550:sample_rate=48000:duration=3",
        *video_h264, "-c:a", "aac", "-shortest", str(sin_rotar),
    )
    ffmpeg("-display_rotation", "90", "-i", str(sin_rotar), "-c", "copy", str(CARPETA_CLIPS / "rotado.mp4"))
    sin_rotar.unlink()
    # Voz sintética (flite) en dos frases: "hello world" desde 1,0 s y "testing subtitles"
    # desde 3,735 s. La voz suena en ~1,22-2,06 s y ~3,99-5,37 s (ver PALABRAS_VOZ).
    ffmpeg(
        "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=6",
        "-f", "lavfi", "-i", "flite=text='hello world':voice=slt",
        "-f", "lavfi", "-i", "flite=text='testing subtitles':voice=slt",
        "-filter_complex",
        "[1:a]adelay=1000:all=1[a];[2:a]adelay=3735:all=1[b];"
        "[a][b]amix=inputs=2:normalize=0,aresample=48000,apad[voz]",
        "-map", "0:v", "-map", "[voz]", "-t", "6",
        *video_h264, "-c:a", "aac", str(CARPETA_CLIPS / "voz.mp4"),
    )
    # HDR como el de iPhone: HLG, bt2020 y 10 bits.
    ffmpeg(
        "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=2",
        "-vf", "format=yuv420p10le", "-c:v", "libx264", "-preset", "ultrafast",
        "-color_primaries", "bt2020", "-color_trc", "arib-std-b67", "-colorspace", "bt2020nc",
        str(CARPETA_CLIPS / "hdr.mp4"),
    )
    return CARPETA_CLIPS


# Lo que devolvería un Whisper perfecto para voz.mp4.
PALABRAS_VOZ = [
    Palabra(texto="Hello", inicio=1.22, fin=1.62),
    Palabra(texto="world.", inicio=1.64, fin=2.05),
    Palabra(texto="Testing", inicio=3.99, fin=4.60),
    Palabra(texto="subtitles.", inicio=4.62, fin=5.37),
]


class TranscriptorFalso:
    """Devuelve PALABRAS_VOZ para cualquier clip y cuenta cuántas veces lo llamaron."""

    def __init__(self, nombre: str = "falso:v1"):
        self.nombre = nombre
        self.llamadas = 0

    def transcribir(self, clip: Path) -> list[Frase]:
        self.llamadas += 1
        a, b, c, d = PALABRAS_VOZ
        return [
            Frase(texto="Hello world.", inicio=a.inicio, fin=b.fin, palabras=[a, b]),
            Frase(texto="Testing subtitles.", inicio=c.inicio, fin=d.fin, palabras=[c, d]),
        ]


@pytest.fixture(autouse=True)
def cache_aislada(monkeypatch, tmp_path) -> Path:
    """Cada test usa su propia caché y sus trazas, nunca las del proyecto."""
    cache = tmp_path / "cache"
    monkeypatch.setenv("CACHE_DIR", str(cache))
    monkeypatch.setenv("TRAZAS_DIR", str(tmp_path / "trazas"))
    return cache


class ProveedorGuionado(LLMProvider):
    """Devuelve respuestas escritas de antemano (texto o Respuesta armada) y guarda cada pedido."""

    nombre = "guionado"

    def __init__(self, respuestas: list, max_correcciones: int = 2):
        super().__init__("modelo-falso", max_correcciones)
        self.respuestas = list(respuestas)
        self.pedidos: list[dict] = []

    def _completar(self, system, mensajes, esquema, herramientas=None):
        self.pedidos.append({"system": system, "mensajes": list(mensajes), "esquema": esquema, "herramientas": herramientas})
        siguiente = self.respuestas.pop(0)
        if isinstance(siguiente, Respuesta):
            return siguiente
        return Respuesta(texto=siguiente, contenido=siguiente, tokens_entrada=100, tokens_salida=50, costo_usd=0.001)

    def mensaje_resultados(self, resultados):
        return {"role": "user", "content": [vars(r) for r in resultados]}


def analisis_falso(nombre: str, duracion: float, frases: list[tuple[str, float, float]], audio: bool = True) -> AnalisisClip:
    """Análisis armado a mano: las palabras de cada frase se reparten parejo en su tramo."""
    armadas = []
    for texto, inicio, fin in frases:
        palabras = texto.split()
        paso = (fin - inicio) / len(palabras)
        armadas.append(Frase(
            texto=texto, inicio=inicio, fin=fin,
            palabras=[
                Palabra(texto=p, inicio=round(inicio + i * paso, 3), fin=round(inicio + (i + 1) * paso - 0.03, 3))
                for i, p in enumerate(palabras)
            ],
        ))
    return AnalisisClip(
        hash=nombre, transcriptor="falso",
        info=InfoClip(nombre=nombre, duracion=duracion, ancho=1080, alto=1920, tiene_audio=audio),
        tramos_voz=[(f.inicio, f.fin) for f in armadas],
        frases=armadas,
    )


# Proyecto con tomas repetidas: el gancho se grabó con una toma falsa, una trabada y una
# limpia; la segunda línea, primero incompleta y después completa.
GUION_TOMAS = [
    "Hoy te voy a mostrar tres errores de prompts.",
    "El primero es no dar contexto.",
    "El segundo es pedir todo junto.",
]
TOMAS_ESPERADAS = [("toma1.mp4", 5.5, 8.0), ("toma2.mp4", 3.0, 5.0), ("toma2.mp4", 6.0, 8.0)]


def proyecto_tomas() -> dict[str, AnalisisClip]:
    return {
        "toma1.mp4": analisis_falso("toma1.mp4", 10.0, [
            ("Ahí va, ya grabo.", 0.5, 1.5),
            ("Hoy te voy a mostrar eh hoy te voy a", 2.0, 4.5),
            ("Hoy te voy a mostrar tres errores de prompts.", 5.5, 8.0),
        ]),
        "toma2.mp4": analisis_falso("toma2.mp4", 10.0, [
            ("El primero es no", 0.8, 1.8),
            ("El primero es no dar contexto.", 3.0, 5.0),
            ("El segundo es pedir todo junto.", 6.0, 8.0),
        ]),
        "broll.mp4": analisis_falso("broll.mp4", 5.0, [], audio=False),
    }
