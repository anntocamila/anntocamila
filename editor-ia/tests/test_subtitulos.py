"""Fase 2: subtítulos palabra por palabra, alineados con la voz del video final."""

import re

import pytest

from conftest import PALABRAS_VOZ, ffprobe
from editor import ingesta
from editor.ingesta import Palabra, TranscriptorWhisper, analizar, tramos_con_voz
from editor.modelos import PlanEdicion
from editor.render import generar_ass, renderizar

# Dos cortes del clip con voz y un b-roll mudo en el medio, que corre la segunda frase.
PLAN = {
    "titulo": "Subtítulos",
    "segmentos": [
        {"clip": "voz.mp4", "inicio": 1.1, "fin": 2.2},
        {"clip": "sin_audio.mp4", "inicio": 0.0, "fin": 1.0},
        {"clip": "voz.mp4", "inicio": 3.9, "fin": 5.5},
    ],
}
RESALTADO = "{\\c&H0000D4FF&}"


def eventos_subtitulo(ass: str) -> list[tuple[float, float, str]]:
    """(inicio, fin, texto) de cada evento de subtítulo del ASS."""
    eventos = []
    for linea in ass.splitlines():
        m = re.match(r"Dialogue: 1,(\d+):(\d+):([\d.]+),(\d+):(\d+):([\d.]+),Subtitulo,,0,0,0,,(.*)", linea)
        if m:
            h1, m1, s1, h2, m2, s2, texto = m.groups()
            eventos.append((int(h1) * 3600 + int(m1) * 60 + float(s1), int(h2) * 3600 + int(m2) * 60 + float(s2), texto))
    return eventos


def palabra(texto: str, inicio: float, fin: float) -> Palabra:
    return Palabra(texto=texto, inicio=inicio, fin=fin)


def test_palabras_llevadas_al_tiempo_del_video_final():
    plan = PlanEdicion.model_validate(PLAN)
    eventos = eventos_subtitulo(generar_ass(plan, {"voz.mp4": PALABRAS_VOZ}))
    assert eventos == [
        (0.12, 0.54, f"{RESALTADO}Hello{{\\r}} world."),
        (0.54, 0.95, f"Hello {RESALTADO}world.{{\\r}}"),
        (2.19, 2.82, f"{RESALTADO}Testing{{\\r}} subtitles."),
        (2.82, 3.57, f"Testing {RESALTADO}subtitles.{{\\r}}"),
    ]


def test_bloques_de_tres_palabras_y_cortes_en_pausas():
    plan = PlanEdicion.model_validate({"titulo": "t", "segmentos": [{"clip": "a.mp4", "inicio": 0, "fin": 10}]})
    palabras = [palabra(f"p{i}", i * 0.3, i * 0.3 + 0.25) for i in range(5)]  # p0..p4 seguidas
    palabras.append(palabra("tarde", 3.0, 3.4))                                # pausa larga antes
    eventos = eventos_subtitulo(generar_ass(plan, {"a.mp4": palabras}))
    bloques = [re.sub(r"\{[^}]*\}", "", texto) for _, _, texto in eventos]
    assert bloques == ["p0 p1 p2"] * 3 + ["p3 p4"] * 2 + ["tarde"]


def test_palabras_fuera_del_segmento_se_descartan_y_las_del_borde_se_recortan():
    plan = PlanEdicion.model_validate({"titulo": "t", "segmentos": [{"clip": "a.mp4", "inicio": 1.0, "fin": 2.0}]})
    palabras = [palabra("antes", 0.2, 0.8), palabra("borde", 0.9, 1.3), palabra("adentro", 1.4, 1.8), palabra("despues", 2.1, 2.5)]
    eventos = eventos_subtitulo(generar_ass(plan, {"a.mp4": palabras}))
    assert [(a, b) for a, b, _ in eventos] == [(0.0, 0.4), (0.4, 0.8)]
    assert "antes" not in eventos[0][2] and "despues" not in eventos[0][2]


def test_sin_subtitulos_si_el_plan_no_los_pide():
    plan = PlanEdicion.model_validate({**PLAN, "subtitulos": False})
    assert generar_ass(plan, {"voz.mp4": PALABRAS_VOZ}) == ""


def test_los_subtitulos_coinciden_con_la_voz_del_video_final(clips, tmp_path, monkeypatch):
    # El primer corte deja solo 0,12 s de silencio antes de la voz: para medirlo hay que
    # detectar silencios más cortos que los 0,3 s que usa el análisis.
    monkeypatch.setattr(ingesta, "SILENCIO_MIN_S", 0.1)
    plan = PlanEdicion.model_validate(PLAN)
    video = renderizar(plan, clips, tmp_path / "subtitulado.mp4", {"voz.mp4": PALABRAS_VOZ})
    duracion = float(ffprobe(video)["format"]["duration"])
    voz = tramos_con_voz(video, duracion)
    eventos = eventos_subtitulo(generar_ass(plan, {"voz.mp4": PALABRAS_VOZ}))

    assert len(voz) == 2
    # Cada palabra resaltada cae sobre voz, y cada tramo con voz tiene subtítulos.
    for inicio, fin, _ in eventos:
        assert any(a <= (inicio + fin) / 2 <= b for a, b in voz)
    for a, b in voz:
        en_tramo = [(i, f) for i, f, _ in eventos if a <= (i + f) / 2 <= b]
        assert en_tramo[0][0] == pytest.approx(a, abs=0.1)   # arranca con la voz
        assert en_tramo[-1][1] == pytest.approx(b, abs=0.1)  # termina con la voz


def test_render_de_clip_hdr_sale_en_sdr(clips, tmp_path):
    plan = PlanEdicion.model_validate({"titulo": "hdr", "segmentos": [{"clip": "hdr.mp4", "inicio": 0, "fin": 1}]})
    video = renderizar(plan, clips, tmp_path / "sdr.mp4")
    v = next(s for s in ffprobe(video)["streams"] if s["codec_type"] == "video")
    assert v["pix_fmt"] == "yuv420p"
    assert v.get("color_transfer") not in ("arib-std-b67", "smpte2084")


def _modelo_whisper_local(nombre: str) -> bool:
    try:
        from faster_whisper.utils import download_model

        download_model(nombre, local_files_only=True)
        return True
    except Exception:
        return False


@pytest.mark.skipif(not _modelo_whisper_local("tiny"), reason="el modelo tiny de Whisper no está descargado")
def test_whisper_real_coincide_con_la_voz(clips, cache_aislada):
    # Con Whisper de verdad sobre la voz sintética en inglés.
    analisis, _ = analizar(clips / "voz.mp4", cache_aislada, TranscriptorWhisper("tiny", idioma="en"))
    texto = " ".join(p.texto.lower() for p in analisis.palabras)
    assert "hello" in texto and "testing" in texto
    for p in analisis.palabras:
        assert any(a - 0.3 <= (p.inicio + p.fin) / 2 <= b + 0.3 for a, b in analisis.tramos_voz)
