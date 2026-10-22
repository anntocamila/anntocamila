"""Fase 6: plan básico sin LLM, métricas de evaluación y tabla por versión."""

import json
import shutil

import pytest
import typer
from typer.testing import CliRunner

from conftest import GUION_TOMAS, PALABRAS_VOZ, ProveedorGuionado, TranscriptorFalso, analisis_falso, proyecto_tomas
from editor import cli
from editor.basico import plan_basico
from editor.llm import factory
from editor.modelos import PlanEdicion
from editor.render import renderizar
from eval import evaluar
from eval.evaluar import (
    CARPETA_CASOS, Resultado, TomaEsperada, cobertura, error_duracion, evaluar_caso, guardar,
    silencios_en_video, tabla_por_version, toma_correcta, valido_primer_intento,
)
from test_agente import pide, plan


def plan_de(*segmentos) -> PlanEdicion:
    return PlanEdicion.model_validate(plan(*segmentos)["plan"])


# ---------- plan básico ----------

def test_plan_basico_con_guion_elige_las_tomas_limpias():
    resultado, avisos = plan_basico(proyecto_tomas(), "\n".join(GUION_TOMAS + ["Una línea que nunca se grabó."]))
    assert [(s.clip, s.inicio, s.fin) for s in resultado.segmentos] == [
        ("toma1.mp4", 5.42, 8.05), ("toma2.mp4", 2.92, 5.05), ("toma2.mp4", 5.92, 8.05),
    ]
    assert resultado.segmentos[0].zoom == "lento" and resultado.titulo == GUION_TOMAS[0]
    assert avisos == ["línea 4 sin toma parecida: «Una línea que nunca se grabó.»"]


def test_plan_basico_sin_guion_se_queda_con_la_ultima_toma():
    resultado, _ = plan_basico(proyecto_tomas())
    textos = [(s.clip, s.inicio) for s in resultado.segmentos]
    assert ("toma1.mp4", 1.92) not in textos   # la toma trabada se descarta
    assert ("toma2.mp4", 0.72) not in textos   # la incompleta también
    assert ("toma1.mp4", 0.42) in textos       # la toma falsa no se repite, así que queda (límite de la línea de base)


def test_plan_basico_sin_voz():
    with pytest.raises(ValueError, match="No hay ninguna frase"):
        plan_basico({"b.mp4": analisis_falso("b.mp4", 3, [], audio=False)})


# ---------- métricas ----------

def test_toma_correcta():
    esperadas = [TomaEsperada(linea=1, clip="toma1.mp4", inicio=5.5, fin=8.0), TomaEsperada(linea=2, clip="toma2.mp4", inicio=3.0, fin=5.0)]
    assert toma_correcta(plan_de(("toma1.mp4", 5.45, 8.05), ("toma2.mp4", 2.95, 5.05)), esperadas) == 1
    assert toma_correcta(plan_de(("toma1.mp4", 2.0, 4.5), ("toma2.mp4", 2.95, 5.05)), esperadas) == 0.5  # la trabada
    assert toma_correcta(plan_de(("toma1.mp4", 5.45, 6.0)), esperadas) == 0                            # muy recortada
    assert toma_correcta(plan_de(("toma1.mp4", 5.45, 6.0)), []) is None


def test_cobertura_del_guion():
    analisis = proyecto_tomas()
    guion = "\n".join(GUION_TOMAS)
    completo = plan_de(("toma1.mp4", 5.45, 8.05), ("toma2.mp4", 2.95, 8.05))   # dos líneas en un segmento
    assert cobertura(completo, guion, analisis) == 1
    assert cobertura(plan_de(("toma1.mp4", 5.45, 8.05)), guion, analisis) == pytest.approx(1 / 3)
    assert cobertura(plan_de(("toma2.mp4", 0.75, 1.85)), "El primero es no dar contexto.", analisis) == 0  # incompleta
    assert cobertura(completo, None, analisis) is None


def test_error_de_duracion():
    assert error_duracion(plan_de(("toma1.mp4", 5.45, 8.05)), 3) == 0.4
    assert error_duracion(plan_de(("toma1.mp4", 5.45, 8.05)), None) is None


def test_silencios_en_el_video(clips, tmp_path):
    con_silencio = renderizar(plan_de(("voz.mp4", 0.0, 6.0)), clips, tmp_path / "a.mp4", vista_previa=True)
    pegado = renderizar(plan_de(("voz.mp4", 1.15, 2.1), ("voz.mp4", 3.95, 5.4)), clips, tmp_path / "b.mp4", vista_previa=True)
    # voz.mp4 entero: 1,2 s antes de hablar, 1,9 s entre frases y 0,6 s al final.
    assert silencios_en_video(con_silencio) == pytest.approx(3.7, abs=0.3)
    assert silencios_en_video(pegado) == 0


def test_valido_al_primer_intento():
    entrega = lambda error: {"tipo": "herramienta", "nombre": "entregar_plan", "es_error": error}
    assert valido_primer_intento([{"tipo": "llm"}, entrega(False)]) is True
    assert valido_primer_intento([entrega(True), entrega(False)]) is False
    assert valido_primer_intento([{"tipo": "llm"}]) is None


# ---------- casos ----------

def test_los_casos_de_ejemplo_con_la_linea_de_base():
    con_guion = evaluar_caso(CARPETA_CASOS / "ejemplo_tomas_repetidas", "basica")
    assert (con_guion.toma_correcta, con_guion.cobertura, con_guion.error) == (1, 1, "")
    assert con_guion.silencios_s is None and con_guion.costo_usd is None   # sin video y sin API
    sin_guion = evaluar_caso(CARPETA_CASOS / "ejemplo_sin_guion", "basica")
    assert sin_guion.toma_correcta == 1 and sin_guion.cobertura is None
    assert sin_guion.error_duracion_s == pytest.approx(1.03)               # por la toma falsa que quedó


def test_caso_con_el_agente(tmp_path):
    shutil.copytree(CARPETA_CASOS / "ejemplo_tomas_repetidas", tmp_path / "caso")
    proveedor = ProveedorGuionado([
        pide(("entregar_plan", plan(("toma1.mp4", 5.45, 12.0)))),
        pide(("entregar_plan", plan(("toma1.mp4", 5.45, 8.05), ("toma2.mp4", 2.95, 5.05)))),
    ])
    r = evaluar_caso(tmp_path / "caso", "agente", proveedor=proveedor)
    assert r.error == ""
    assert r.valido_primer_intento is False
    assert r.toma_correcta == pytest.approx(2 / 3) and r.cobertura == pytest.approx(2 / 3)
    assert (r.costo_usd, r.tokens_entrada, r.tokens_salida) == (0.02, 2000, 200)


def test_caso_guardado_con_clips_reales(clips, tmp_path):
    caso = tmp_path / "caso"
    caso.mkdir()
    (caso / "guion.txt").write_text("Hello world.\nTesting subtitles.\n")
    (caso / "caso.json").write_text(json.dumps({
        "clips": str(clips), "guion": "guion.txt", "duracion_objetivo": 3,
        "tomas_esperadas": [{"linea": 1, "clip": "voz.mp4", "inicio": 1.22, "fin": 2.05}],
    }))
    (caso / "plan.json").write_text(json.dumps(plan(("voz.mp4", 1.15, 2.1), ("voz.mp4", 3.95, 5.4))["plan"]))
    (caso / "proyecto.json").write_text(json.dumps({"clips": str(clips), "analisis": {}, "cambios": ["más corto", "sacá la 3"]}))

    r = evaluar_caso(caso, "guardado", transcriptor=TranscriptorFalso())
    assert r.error == ""
    assert (r.toma_correcta, r.cobertura, r.retoques) == (1, 1, 2)
    assert r.error_duracion_s == pytest.approx(0.6, abs=0.04)   # se cuenta en cuadros
    assert r.silencios_s == 0


def test_un_caso_roto_no_frena_la_evaluacion(tmp_path):
    (tmp_path / "caso.json").write_text(json.dumps({"descripcion": "sin clips ni análisis"}))
    r = evaluar_caso(tmp_path, "basica")
    assert r.error == "ValueError: el caso necesita 'clips' o 'analisis'"


# ---------- resultados por versión ----------

def test_tabla_por_version(tmp_path):
    ruta = tmp_path / "resultados.csv"
    guardar([Resultado("a", toma_correcta=1, cobertura=1, segundos=2), Resultado("b", toma_correcta=0.5, segundos=4)], "v1", "basica", "", ruta)
    guardar([Resultado("a", toma_correcta=1, valido_primer_intento=False, costo_usd=0.12, segundos=30),
             Resultado("b", toma_correcta=1, valido_primer_intento=True, costo_usd=0.08, segundos=20)], "v2", "agente", "claude-opus-5-5", ruta)
    tabla = tabla_por_version(ruta).splitlines()
    assert len(tabla) == 4
    assert tabla[2] == "| v1 | basica | – | 2 | 0 | 75 % | 100 % | – | – | – | – | 3,0 | – |"
    assert tabla[3] == "| v2 | agente | claude-opus-5-5 | 2 | 0 | 100 % | – | – | – | 50 % | US$ 0,1000 | 25,0 | – |"


@pytest.fixture
def eval_aislada(monkeypatch, tmp_path):
    monkeypatch.setattr(evaluar, "RESULTADOS", tmp_path / "resultados.csv")
    monkeypatch.setattr(evaluar, "TABLA", tmp_path / "tabla.md")
    app = typer.Typer()
    app.command()(evaluar.main)
    return app, tmp_path


def test_comando_evaluar_basica(eval_aislada):
    app, tmp_path = eval_aislada
    resultado = CliRunner().invoke(app, ["--version", "linea-de-base", "--sin-render"])
    assert resultado.exit_code == 0, resultado.output
    assert "| ejemplo_tomas_repetidas | 100 % | 100 % |" in resultado.output
    assert "| linea-de-base | basica |" in (tmp_path / "tabla.md").read_text()


def test_el_agente_pide_confirmacion_antes_de_gastar(eval_aislada, monkeypatch):
    app, tmp_path = eval_aislada
    monkeypatch.setattr(factory, "get_provider", lambda config=None: pytest.fail("no tendría que llamar a la API"))
    resultado = CliRunner().invoke(app, ["--estrategia", "agente"], input="n\n")
    assert resultado.exit_code == 1
    assert "usa la API" in resultado.output and "Cancelado: no se llamó a la API." in resultado.output
    assert not (tmp_path / "resultados.csv").exists()


# ---------- editar --sin-llm ----------

def test_editar_sin_llm_no_usa_la_api(clips, monkeypatch, tmp_path):
    monkeypatch.setattr(cli, "_transcriptor", lambda: TranscriptorFalso())
    monkeypatch.setattr(factory, "get_provider", lambda config=None: pytest.fail("no tendría que llamar a la API"))
    guion = tmp_path / "guion.txt"
    guion.write_text("Hello world.\nEsto no se grabó nunca.\n")
    salida = tmp_path / "plan.json"
    resultado = CliRunner().invoke(cli.app, ["editar", str(clips), "--guion", str(guion), "--salida", str(salida), "--sin-llm", "--sin-vista-previa"])
    assert resultado.exit_code == 0, resultado.output
    assert "Aviso: línea 2 sin toma parecida: «Esto no se grabó nunca.»" in resultado.output
    segmentos = json.loads(salida.read_text())["segmentos"]
    assert len(segmentos) == 1
    assert segmentos[0]["inicio"] == pytest.approx(PALABRAS_VOZ[0].inicio - 0.08)
    assert (tmp_path / "decisiones.md").is_file() and (tmp_path / "proyecto.json").is_file()
