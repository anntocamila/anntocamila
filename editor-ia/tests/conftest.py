"""Clips sintéticos para los tests, generados con ffmpeg en tests/clips_prueba/."""

import json
import subprocess
from pathlib import Path

import pytest

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
    return CARPETA_CLIPS
