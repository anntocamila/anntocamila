"""Fase 1: render sin IA a partir de un plan escrito a mano."""

import json
import subprocess
from array import array
from pathlib import Path

import pytest
from typer.testing import CliRunner

from conftest import ffmpeg, ffprobe
from editor.cli import app
from editor.ingesta import probar
from editor.modelos import PlanEdicion
from editor.render import ErrorRender, renderizar, generar_ass, tramos_en_timeline

PLAN = {
    "titulo": "Prueba de render",
    "segmentos": [
        {"clip": "horizontal.mp4", "inicio": 0.5, "fin": 2.0, "zoom": "lento", "texto": "Esto cambia todo"},
        {"clip": "vertical.mp4", "inicio": 1.0, "fin": 2.5, "zoom": "golpe"},
        {"clip": "sin_audio.mp4", "inicio": 0.0, "fin": 1.2, "nota": "b-roll"},
        {"clip": "rotado.mp4", "inicio": 0.3, "fin": 1.5},
        {"clip": "horizontal.mp4", "inicio": 2.0, "fin": 3.4, "zoom": "golpe", "texto": "Idea clave"},
    ],
}
CUADROS_ESPERADOS = 45 + 45 + 36 + 36 + 42


def muestras_mono(ruta: Path) -> array:
    crudo = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(ruta), "-vn", "-ac", "1", "-ar", "48000", "-f", "s16le", "-"],
        capture_output=True, check=True,
    ).stdout
    return array("h", crudo)


def salto_maximo_relativo(ruta: Path) -> float:
    """Mayor salto entre dos muestras seguidas, relativo al pico. Un clic da cerca de 1."""
    m = muestras_mono(ruta)
    pico = max(abs(x) for x in m)
    salto = max(abs(b - a) for a, b in zip(m, m[1:]))
    return salto / pico


def volumen_integrado(ruta: Path) -> float:
    stderr = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(ruta), "-af", "loudnorm=print_format=json", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    ).stderr
    return float(json.loads(stderr[stderr.rindex("{"): stderr.rindex("}") + 1])["input_i"])


@pytest.fixture(scope="module")
def video(clips, tmp_path_factory) -> Path:
    salida = tmp_path_factory.mktemp("render") / "video_final.mp4"
    return renderizar(PlanEdicion.model_validate(PLAN), clips, salida)


def test_formato_vertical_1080x1920_a_30_fps(video):
    datos = ffprobe(video)
    v = next(s for s in datos["streams"] if s["codec_type"] == "video")
    assert (v["width"], v["height"]) == (1080, 1920)
    assert v["r_frame_rate"] == "30/1"
    assert v["pix_fmt"] == "yuv420p"
    assert int(v["nb_read_frames"]) == CUADROS_ESPERADOS


def test_audio_continuo_y_sincronizado(video):
    datos = ffprobe(video)
    a = next(s for s in datos["streams"] if s["codec_type"] == "audio")
    assert a["codec_name"] == "aac"
    assert int(a["sample_rate"]) == 48000
    assert a["channels"] == 2
    assert float(a["duration"]) == pytest.approx(CUADROS_ESPERADOS / 30, abs=0.05)


def test_audio_normalizado_a_menos_14_lufs(video):
    assert volumen_integrado(video) == pytest.approx(-14, abs=1)


def test_sin_clics_en_los_cortes(video):
    # Un tono de 660 Hz salta como mucho un 9 % del pico entre muestras; un corte seco, cerca del 100 %.
    assert salto_maximo_relativo(video) < 0.2


def test_la_medicion_detecta_un_corte_seco(tmp_path):
    # Control: dos tonos unidos sin fundido, cortando el primero en su pico, tienen que dar un clic.
    corte = tmp_path / "corte_seco.wav"
    ffmpeg(
        "-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=48000",
        "-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=48000",
        "-filter_complex",
        "[0]atrim=end_sample=4812[a];[1]atrim=end_sample=48000[b];[a][b]concat=n=2:v=0:a=1",
        str(corte),
    )
    assert salto_maximo_relativo(corte) > 0.5


def test_textos_en_el_tiempo_del_video_final():
    plan = PlanEdicion.model_validate(PLAN)
    assert tramos_en_timeline(plan)[-1] == (5.4, 6.8)
    ass = generar_ass(plan)
    assert "Dialogue: 0,0:00:00.00,0:00:01.50,Texto,,0,0,0,,Esto cambia todo" in ass
    assert "Dialogue: 0,0:00:05.40,0:00:06.80,Texto,,0,0,0,,Idea clave" in ass
    assert ass.count("Dialogue:") == 2


def test_texto_sin_comandos_ass():
    plan = PlanEdicion.model_validate({"titulo": "t", "segmentos": [
        {"clip": "a.mp4", "inicio": 0, "fin": 1, "texto": "{\\b1}hola\\N  mundo"},
    ]})
    assert generar_ass(plan).endswith(",,b1holaN mundo\n")


def test_rotacion_de_celular(clips):
    info = probar(clips / "rotado.mp4")
    assert (info.ancho, info.alto) == (720, 1280)


def test_tiempos_imposibles_fallan_antes_de_renderizar(clips, tmp_path):
    plan = PlanEdicion.model_validate({"titulo": "t", "segmentos": [
        {"clip": "sin_audio.mp4", "inicio": 1, "fin": 9.1},
        {"clip": "toma9.mp4", "inicio": 0, "fin": 1},
    ]})
    with pytest.raises(ErrorRender) as error:
        renderizar(plan, clips, tmp_path / "x.mp4")
    assert "sin_audio.mp4 dura 3 s y pediste fin=9,1" in str(error.value)
    assert "no existe el clip toma9.mp4" in str(error.value)
    assert not (tmp_path / "x.mp4").exists()


def test_cli_render_de_un_video_mudo(clips, tmp_path):
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps({"titulo": "mudo", "segmentos": [
        {"clip": "sin_audio.mp4", "inicio": 0, "fin": 1, "texto": "Solo imagen"},
    ]}))
    salida = tmp_path / "mudo.mp4"
    resultado = CliRunner().invoke(app, ["render", "--plan", str(plan), "--clips", str(clips), "--salida", str(salida)])
    assert resultado.exit_code == 0, resultado.output
    tipos = {s["codec_type"] for s in ffprobe(salida)["streams"]}
    assert tipos == {"video", "audio"}


def test_cli_plan_invalido_explica_el_error(tmp_path):
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps({"titulo": "t", "segmentos": [{"clip": "a.mp4", "inicio": 0, "fin": 0.1}]}))
    resultado = CliRunner().invoke(app, ["render", "--plan", str(plan)])
    assert resultado.exit_code == 1
    assert "segmentos.0: cada segmento dura al menos 0,2 s" in resultado.output
