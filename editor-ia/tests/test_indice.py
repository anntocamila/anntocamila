"""Fase 4: índice de frases y búsqueda de tomas por similitud."""

import pytest

from conftest import GUION_TOMAS, TOMAS_ESPERADAS, analisis_falso, proyecto_tomas
from editor.indice import EmbedderNgramas, Indice, coseno, crear_embedder, normalizar


def test_normalizar():
    assert normalizar("Ahí va, ¡YA grabo!") == "ahi va ya grabo"


def test_misma_frase_da_similitud_1_y_distinta_da_baja():
    e = EmbedderNgramas()
    assert coseno(e.vector("El primero es no dar contexto."), e.vector("el primero es NO dar contexto")) == pytest.approx(1)
    assert coseno(e.vector("El primero es no dar contexto."), e.vector("pedir todo junto")) < 0.3


@pytest.mark.parametrize("linea, esperada", list(zip(GUION_TOMAS, TOMAS_ESPERADAS)))
def test_la_toma_limpia_queda_primera(linea, esperada):
    mejor = Indice(proyecto_tomas()).buscar(linea, k=3)[0]
    assert (mejor.clip, mejor.inicio, mejor.fin) == esperada


def test_las_tomas_trabadas_o_incompletas_quedan_detras():
    indice = Indice(proyecto_tomas())
    gancho = indice.buscar(GUION_TOMAS[0], k=3)
    assert gancho[1].texto == "Hoy te voy a mostrar eh hoy te voy a"
    assert gancho[0].similitud == pytest.approx(1) and gancho[1].similitud < 0.9

    segunda = indice.buscar(GUION_TOMAS[1], k=2)
    assert [t.texto for t in segunda] == ["El primero es no dar contexto.", "El primero es no"]


def test_una_linea_partida_en_dos_frases_se_encuentra_entera():
    analisis = {"a.mp4": analisis_falso("a.mp4", 5, [("Hoy te voy a mostrar", 1.0, 2.0), ("tres errores de prompts.", 2.3, 3.5)])}
    mejor = Indice(analisis).buscar("Hoy te voy a mostrar tres errores de prompts", k=1)[0]
    assert (mejor.inicio, mejor.fin) == (1.0, 3.5)


def test_no_devuelve_tomas_que_se_pisan():
    analisis = {"a.mp4": analisis_falso("a.mp4", 5, [("Hoy te voy a mostrar", 1.0, 2.0), ("tres errores de prompts.", 2.3, 3.5)])}
    tomas = Indice(analisis).buscar("Hoy te voy a mostrar tres errores de prompts", k=3)
    assert len(tomas) == 1  # la frase suelta y el par se pisan con la mejor


def test_embedder_no_implementado():
    assert crear_embedder("").nombre == "ngramas"
    with pytest.raises(ValueError, match="'voyage' no está implementado"):
        crear_embedder("voyage")
