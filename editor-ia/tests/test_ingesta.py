"""Fase 2: análisis de clips, tramos con voz y caché por hash."""

import shutil

import pytest
from typer.testing import CliRunner

from conftest import TranscriptorFalso
from editor import cli
from editor.ingesta import analizar, probar


def test_tramos_con_voz(clips, cache_aislada):
    analisis, _ = analizar(clips / "voz.mp4", cache_aislada, TranscriptorFalso())
    assert len(analisis.tramos_voz) == 2
    (a1, b1), (a2, b2) = analisis.tramos_voz
    assert a1 == pytest.approx(1.22, abs=0.1) and b1 == pytest.approx(2.06, abs=0.1)
    assert a2 == pytest.approx(3.99, abs=0.1) and b2 == pytest.approx(5.37, abs=0.1)


def test_un_tono_continuo_es_un_solo_tramo(clips, cache_aislada):
    analisis, _ = analizar(clips / "horizontal.mp4", cache_aislada, TranscriptorFalso())
    assert analisis.tramos_voz == [(0.0, pytest.approx(analisis.info.duracion, abs=0.05))]


def test_la_segunda_corrida_no_retranscribe(clips, cache_aislada):
    transcriptor = TranscriptorFalso()
    primero, de_cache_1 = analizar(clips / "voz.mp4", cache_aislada, transcriptor)
    segundo, de_cache_2 = analizar(clips / "voz.mp4", cache_aislada, transcriptor)
    assert (de_cache_1, de_cache_2) == (False, True)
    assert transcriptor.llamadas == 1
    assert segundo == primero
    assert [p.texto for p in segundo.palabras] == ["Hello", "world.", "Testing", "subtitles."]


def test_renombrar_el_clip_no_retranscribe(clips, cache_aislada, tmp_path):
    transcriptor = TranscriptorFalso()
    analizar(clips / "voz.mp4", cache_aislada, transcriptor)
    copia = tmp_path / "toma_final.mp4"
    shutil.copy(clips / "voz.mp4", copia)
    analisis, de_cache = analizar(copia, cache_aislada, transcriptor)
    assert de_cache and transcriptor.llamadas == 1
    assert analisis.info.nombre == "toma_final.mp4"


def test_otro_modelo_de_whisper_retranscribe(clips, cache_aislada):
    analizar(clips / "voz.mp4", cache_aislada, TranscriptorFalso("whisper:small:es:"))
    otro = TranscriptorFalso("whisper:medium:es:")
    _, de_cache = analizar(clips / "voz.mp4", cache_aislada, otro)
    assert not de_cache and otro.llamadas == 1


def test_cache_rota_se_rehace(clips, cache_aislada):
    analisis, _ = analizar(clips / "voz.mp4", cache_aislada, TranscriptorFalso())
    (cache_aislada / f"{analisis.hash}.json").write_text("{esto no es json")
    _, de_cache = analizar(clips / "voz.mp4", cache_aislada, TranscriptorFalso())
    assert not de_cache


def test_clip_sin_audio_no_se_transcribe(clips, cache_aislada):
    transcriptor = TranscriptorFalso()
    analisis, _ = analizar(clips / "sin_audio.mp4", cache_aislada, transcriptor)
    assert transcriptor.llamadas == 0
    assert analisis.tramos_voz == [] and analisis.frases == []


def test_detecta_hdr(clips):
    assert probar(clips / "hdr.mp4").hdr
    assert not probar(clips / "horizontal.mp4").hdr


def test_cli_analizar_usa_la_cache_en_la_segunda_corrida(clips, monkeypatch):
    transcriptor = TranscriptorFalso()
    monkeypatch.setattr(cli, "_transcriptor", lambda: transcriptor)
    runner = CliRunner()

    primera = runner.invoke(cli.app, ["analizar", str(clips)])
    assert primera.exit_code == 0, primera.output
    assert "voz.mp4: 6.0 s, 1280x720, 2 tramos con voz, 2 frases (analizado)" in primera.output
    assert "hdr.mp4: 2.0 s, 1920x1080, HDR, sin audio, 0 tramos con voz, 0 frases (analizado)" in primera.output
    llamadas = transcriptor.llamadas  # una por cada clip con audio

    segunda = runner.invoke(cli.app, ["analizar", str(clips)])
    assert segunda.exit_code == 0, segunda.output
    assert transcriptor.llamadas == llamadas
    assert "(analizado)" not in segunda.output
    assert segunda.output.count("(caché)") == 6
