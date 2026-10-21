"""Fase 4: las 5 herramientas del agente."""

import json

import pytest

from conftest import proyecto_tomas
from editor.herramientas import Contexto, definiciones, ejecutar


@pytest.fixture
def ctx() -> Contexto:
    return Contexto(proyecto_tomas(), duracion_objetivo=8.0)


def correr(ctx, nombre, **argumentos):
    texto, es_error = ejecutar(ctx, nombre, argumentos)
    assert not es_error, texto
    return json.loads(texto)


def plan(*segmentos) -> dict:
    return {"titulo": "t", "segmentos": [dict(zip(("clip", "inicio", "fin"), s)) for s in segmentos]}


def test_son_las_5_herramientas_del_plan():
    assert [h.nombre for h in definiciones()] == [
        "listar_clips", "leer_transcripcion", "buscar_tomas", "medir_plan", "entregar_plan",
    ]
    leer = next(h for h in definiciones() if h.nombre == "leer_transcripcion")
    assert set(leer.esquema["properties"]) == {"clip", "desde", "hasta", "con_palabras"}


def test_listar_clips(ctx):
    clips = correr(ctx, "listar_clips")
    assert [c["clip"] for c in clips] == ["toma1.mp4", "toma2.mp4", "broll.mp4"]
    assert clips[0] == {
        "clip": "toma1.mp4", "duracion": 10.0, "formato": "vertical 1080x1920", "audio": True,
        "tramos_voz": [[0.5, 1.5], [2.0, 4.5], [5.5, 8.0]], "frases": 3,
    }
    assert clips[2]["audio"] is False


def test_leer_transcripcion_de_un_tramo(ctx):
    resultado = correr(ctx, "leer_transcripcion", clip="toma1.mp4", desde=5.0, hasta=9.0)
    assert [f["texto"] for f in resultado["frases"]] == ["Hoy te voy a mostrar tres errores de prompts."]
    assert "palabras" not in resultado["frases"][0]

    con_palabras = correr(ctx, "leer_transcripcion", clip="toma1.mp4", desde=5.0, con_palabras=True)
    assert con_palabras["frases"][0]["palabras"][0] == ["Hoy", 5.5, 5.748]


def test_leer_transcripcion_b_roll(ctx):
    assert correr(ctx, "leer_transcripcion", clip="broll.mp4") == {
        "clip": "broll.mp4", "frases": [], "nota": "clip sin audio: sirve como b-roll",
    }


def test_errores_de_argumentos_vuelven_al_modelo(ctx):
    texto, es_error = ejecutar(ctx, "leer_transcripcion", {"clip": "toma9.mp4"})
    assert es_error and "No existe el clip toma9.mp4. Clips disponibles: toma1.mp4, toma2.mp4, broll.mp4" in texto
    texto, es_error = ejecutar(ctx, "leer_transcripcion", {"clip": "toma1.mp4", "desde": 5, "hasta": 2})
    assert es_error and "hasta (2,00) tiene que ser mayor que desde (5,00)" in texto
    texto, es_error = ejecutar(ctx, "buscar_tomas", {"frase": "hola", "k": 50, "otro": 1})
    assert es_error and "k: " in texto and "otro: " in texto
    texto, es_error = ejecutar(ctx, "borrar_todo", {})
    assert es_error and "No existe la herramienta borrar_todo" in texto
    assert ctx.ultimo_error.startswith("borrar_todo:")


def test_buscar_tomas(ctx):
    tomas = correr(ctx, "buscar_tomas", frase="El primero es no dar contexto", k=2)
    assert [(t["clip"], t["inicio"], t["fin"]) for t in tomas] == [("toma2.mp4", 3.0, 5.0), ("toma2.mp4", 0.8, 1.8)]
    assert tomas[0]["similitud"] == pytest.approx(1)


def test_medir_plan_limpio(ctx):
    medido = correr(ctx, "medir_plan", plan=plan(("toma1.mp4", 5.45, 8.05), ("toma2.mp4", 2.95, 5.05)))
    assert medido == {
        "duracion_total": 4.7, "segmentos": 2, "duracion_objetivo": 8.0, "diferencia": -3.3,
        "errores": [], "avisos": [],
    }


def test_medir_plan_avisa_cortes_silencios_margenes_y_repetidas(ctx):
    medido = correr(ctx, "medir_plan", plan=plan(
        ("toma1.mp4", 5.6, 8.05),    # corta «Hoy»
        ("toma1.mp4", 3.5, 8.05),    # silencio entre la toma trabada y la limpia
        ("toma2.mp4", 2.5, 5.05),    # medio segundo de aire antes de hablar
        ("toma2.mp4", 2.95, 5.05),   # repite la frase del segmento 3
        ("toma2.mp4", 8.5, 9.5),     # sin voz
        ("toma1.mp4", 9.0, 12.0),    # se pasa del clip
    ))
    assert medido["errores"] == ["segmento 6: toma1.mp4 dura 10 s y pediste fin=12"]
    avisos = medido["avisos"]
    assert "segmento 1: inicio=5,60 corta la palabra «Hoy» (5,50-5,75)" in avisos
    assert any(a.startswith("segmento 2: 1,03 s de silencio entre «a» y «Hoy»") for a in avisos)
    assert "segmento 3: arranca 0,50 s antes de la primera palabra (en 3,00)" in avisos
    assert any(a.startswith("los segmentos 3 y 4 dicen casi lo mismo") for a in avisos)
    assert "segmento 5: no tiene voz (toma2.mp4 8,50-9,50)" in avisos


def test_entregar_plan(ctx):
    texto, es_error = ejecutar(ctx, "entregar_plan", {"plan": plan(("toma1.mp4", 5.45, 12.0))})
    assert es_error and "toma1.mp4 dura 10 s y pediste fin=12" in texto
    assert ctx.plan_entregado is None

    texto, es_error = ejecutar(ctx, "entregar_plan", {"plan": {"titulo": "t", "segmentos": [{"clip": "toma1.mp4", "inicio": 1, "fin": 1.1}]}})
    assert es_error and "plan.segmentos.0: cada segmento dura al menos 0,2 s" in texto

    assert correr(ctx, "entregar_plan", plan=plan(("toma1.mp4", 5.45, 8.05))) == {
        "estado": "plan recibido", "segmentos": 1, "duracion_total": 2.6,
    }
    assert ctx.plan_entregado.segmentos[0].fin == 8.05
