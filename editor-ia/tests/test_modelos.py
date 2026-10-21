"""Validación del plan en dos niveles: estructura (Pydantic) y contenido (contra los clips)."""

import pytest
from pydantic import ValidationError

from editor.modelos import PlanEdicion, Segmento, describir_error, errores_de_contenido


def plan_con(*segmentos: dict) -> PlanEdicion:
    return PlanEdicion.model_validate({"titulo": "prueba", "segmentos": list(segmentos)})


def test_plan_valido():
    plan = plan_con({"clip": "a.mp4", "inicio": 0, "fin": 1.5, "zoom": "golpe", "texto": "Hola"})
    assert plan.segmentos[0].duracion == 1.5
    assert plan.subtitulos is True


def test_campos_extra_prohibidos():
    with pytest.raises(ValidationError) as error:
        plan_con({"clip": "a.mp4", "inicio": 0, "fin": 1, "velocidad": 2})
    assert "segmentos.0.velocidad" in describir_error(error.value)


def test_segmento_demasiado_corto_o_invertido():
    for fin in (0.1, -1):
        with pytest.raises(ValidationError) as error:
            Segmento(clip="a.mp4", inicio=0, fin=fin)
        assert "al menos 0,2 s" in describir_error(error.value)


def test_zoom_solo_valores_permitidos():
    with pytest.raises(ValidationError):
        Segmento(clip="a.mp4", inicio=0, fin=1, zoom="rapido")


def test_plan_sin_segmentos():
    with pytest.raises(ValidationError):
        PlanEdicion(titulo="vacío", segmentos=[])


def test_errores_de_contenido_dan_el_dato_exacto():
    plan = plan_con(
        {"clip": "toma3.mp4", "inicio": 2, "fin": 9.1},
        {"clip": "no_existe.mp4", "inicio": 0, "fin": 1},
        {"clip": "toma3.mp4", "inicio": 0, "fin": 8.4},
    )
    errores = errores_de_contenido(plan, {"toma3.mp4": 8.4})
    assert errores == [
        "segmento 1: toma3.mp4 dura 8,4 s y pediste fin=9,1",
        "segmento 2: no existe el clip no_existe.mp4",
    ]
