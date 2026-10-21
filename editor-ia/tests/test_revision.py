"""Fase 5: revisión humana, decisiones.md, vista previa y aprobación antes del render final."""

import json

import pytest
from typer.testing import CliRunner

from conftest import ProveedorGuionado, TranscriptorFalso, ffprobe, proyecto_tomas
from editor import cli
from editor.llm import factory
from editor.modelos import PlanEdicion
from editor.revision import Proyecto, cargar_proyecto, decisiones_md, guardar_proyecto, guardar_version, revisar_plan
from test_agente import pide, plan

PLAN = PlanEdicion.model_validate({
    "titulo": "Errores de prompts",
    "segmentos": [
        {"clip": "toma1.mp4", "inicio": 5.45, "fin": 8.05, "zoom": "lento", "texto": "3 errores de prompts", "nota": "gancho, toma limpia"},
        {"clip": "toma2.mp4", "inicio": 2.95, "fin": 5.05, "nota": "la completa, no la que se corta"},
        {"clip": "toma2.mp4", "inicio": 5.95, "fin": 8.05, "zoom": "golpe"},
    ],
})


def test_decisiones_md():
    assert decisiones_md(PLAN, ["más corto"]) == (
        "# Errores de prompts\n"
        "\n"
        "Duración: 6,80 s · 3 segmentos · subtítulos: sí\n"
        "\n"
        "## Cortes\n"
        "\n"
        "1. toma1.mp4 5,45–8,05 (2,60 s) · zoom lento · «3 errores de prompts» — gancho, toma limpia\n"
        "2. toma2.mp4 2,95–5,05 (2,10 s) — la completa, no la que se corta\n"
        "3. toma2.mp4 5,95–8,05 (2,10 s) · zoom golpe\n"
        "\n"
        "## Cambios pedidos\n"
        "\n"
        "1. más corto\n"
    )


def test_versiones_del_plan(tmp_path):
    ruta = tmp_path / "plan.json"
    assert guardar_version(ruta) is None
    ruta.write_text("uno")
    assert guardar_version(ruta).name == "plan.v1.json"
    ruta.write_text("dos")
    assert guardar_version(ruta).name == "plan.v2.json"
    assert (tmp_path / "plan.v1.json").read_text() == "uno"


def test_proyecto_se_guarda_y_se_lee(tmp_path):
    proyecto = Proyecto(clips="/clips", guion="hola", duracion_objetivo=30, analisis=proyecto_tomas())
    guardar_proyecto(proyecto, tmp_path)
    leido = cargar_proyecto(tmp_path)
    assert leido == proyecto
    assert leido.palabras()["toma1.mp4"][0].texto == "Ahí"
    with pytest.raises(FileNotFoundError, match="corré editar primero"):
        cargar_proyecto(tmp_path / "otra")


def test_revisar_plan_con_una_sola_llamada_y_correccion():
    proyecto = Proyecto(clips="/clips", duracion_objetivo=5, analisis=proyecto_tomas())
    sin_la_2 = {**json.loads(PLAN.model_dump_json()), "segmentos": [PLAN.segmentos[0].model_dump(), PLAN.segmentos[2].model_dump()]}
    imposible = json.loads(json.dumps(sin_la_2))
    imposible["segmentos"][1]["fin"] = 11.0
    proveedor = ProveedorGuionado([json.dumps(imposible), json.dumps(sin_la_2)])

    nuevo = revisar_plan(proveedor, proyecto, PLAN, "sacá la toma 2")

    assert [(s.clip, s.inicio) for s in nuevo.segmentos] == [("toma1.mp4", 5.45), ("toma2.mp4", 5.95)]
    pedido = proveedor.pedidos[0]
    assert pedido["herramientas"] is None and pedido["esquema"] == PlanEdicion.model_json_schema()
    texto = pedido["mensajes"][0]["content"]
    assert "2. toma2.mp4 2,95–5,05 (2,10 s) — la completa, no la que se corta" in texto
    assert "[5,50–8,00] Hoy te voy a mostrar tres errores de prompts." in texto
    assert "broll.mp4 (5,00 s): sin audio, sirve como b-roll" in texto
    assert "Duración objetivo: 5 s." in texto and texto.endswith("Cambios pedidos: sacá la toma 2")
    assert "toma2.mp4 dura 10 s y pediste fin=11" in proveedor.pedidos[1]["mensajes"][-1]["content"]


def test_revisar_sin_proyecto(tmp_path):
    ruta = tmp_path / "plan.json"
    ruta.write_text(PLAN.model_dump_json())
    resultado = CliRunner().invoke(cli.app, ["revisar", "--plan", str(ruta), "--cambios", "más corto"])
    assert resultado.exit_code == 1
    assert "proyecto.json: corré editar primero" in resultado.output


def _no_analizar(*_):
    raise AssertionError("no tendría que volver a analizar los clips")


def test_flujo_editar_revisar_aprobar(clips, monkeypatch, tmp_path):
    runner = CliRunner()
    monkeypatch.setattr(cli, "_transcriptor", lambda: TranscriptorFalso())
    salida = tmp_path / "proyecto" / "plan.json"
    carpeta = salida.parent

    # 1. editar: plan, proyecto.json, decisiones.md y vista previa a 540p.
    tres = plan(("voz.mp4", 1.15, 2.1), ("sin_audio.mp4", 0.0, 1.0), ("voz.mp4", 3.95, 5.4))
    monkeypatch.setattr(factory, "get_provider", lambda config=None: ProveedorGuionado([pide(("entregar_plan", tres))]))
    resultado = runner.invoke(cli.app, ["editar", str(clips), "--salida", str(salida)])
    assert resultado.exit_code == 0, resultado.output
    assert (carpeta / "proyecto.json").is_file() and (carpeta / "decisiones.md").is_file()
    v = next(s for s in ffprobe(carpeta / "vista_previa.mp4")["streams"] if s["codec_type"] == "video")
    assert (v["width"], v["height"]) == (540, 960)
    assert "render final: python -m editor render --plan" in resultado.output

    # 2. revisar: un plan nuevo sin volver a analizar; el anterior queda versionado.
    monkeypatch.setattr(cli, "_analizar_clips", _no_analizar)
    sin_la_2 = json.dumps(plan(("voz.mp4", 1.15, 2.1), ("voz.mp4", 3.95, 5.4))["plan"])
    monkeypatch.setattr(factory, "get_provider", lambda config=None: ProveedorGuionado([sin_la_2]))
    resultado = runner.invoke(cli.app, ["revisar", "--plan", str(salida), "--cambios", "sacá la toma 2"])
    assert resultado.exit_code == 0, resultado.output
    assert len(json.loads(salida.read_text())["segmentos"]) == 2
    assert len(json.loads((carpeta / "plan.v1.json").read_text())["segmentos"]) == 3
    assert "## Cambios pedidos\n\n1. sacá la toma 2" in (carpeta / "decisiones.md").read_text()
    assert float(ffprobe(carpeta / "vista_previa.mp4")["format"]["duration"]) == pytest.approx(2.4, abs=0.1)
    assert "Uso: 1 llamadas" in resultado.output

    # 3. render final: sin aprobación no se hace.
    resultado = runner.invoke(cli.app, ["render", "--plan", str(salida)], input="n\n")
    assert resultado.exit_code == 1
    assert "¿Aprobás el plan?" in resultado.output and "Render final cancelado" in resultado.output
    assert not (carpeta / "video_final.mp4").exists()

    # 4. con aprobación: 1080x1920, con los subtítulos del proyecto guardado.
    resultado = runner.invoke(cli.app, ["render", "--plan", str(salida)], input="sí\n")
    assert resultado.exit_code == 0, resultado.output
    v = next(s for s in ffprobe(carpeta / "video_final.mp4")["streams"] if s["codec_type"] == "video")
    assert (v["width"], v["height"]) == (1080, 1920)


def test_render_vista_previa_no_pide_aprobacion(clips, tmp_path):
    ruta = tmp_path / "plan.json"
    ruta.write_text(json.dumps({"titulo": "t", "subtitulos": False, "segmentos": [{"clip": "sin_audio.mp4", "inicio": 0, "fin": 1}]}))
    resultado = CliRunner().invoke(cli.app, ["render", "--plan", str(ruta), "--clips", str(clips), "--vista-previa"])
    assert resultado.exit_code == 0, resultado.output
    assert "¿Aprobás" not in resultado.output
    v = next(s for s in ffprobe(tmp_path / "vista_previa.mp4")["streams"] if s["codec_type"] == "video")
    assert (v["width"], v["height"]) == (540, 960)
