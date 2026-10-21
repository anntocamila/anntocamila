"""Fase 4: loop del agente con límite de pasos, trazas y comando editar."""

import json
import os

import pytest
from typer.testing import CliRunner

from conftest import (
    GUION_TOMAS, TOMAS_ESPERADAS, PALABRAS_VOZ, ProveedorGuionado, TranscriptorFalso, proyecto_tomas,
)
from editor import cli
from editor.agente import RECORDATORIO, ErrorAgente, armar_plan, lineas_de_guion
from editor.llm import factory
from editor.llm.base import LlamadaHerramienta, Respuesta
from editor.trazas import Traza

_ids = iter(range(10_000))


def pide(*llamadas: tuple[str, dict]) -> Respuesta:
    """Respuesta del modelo que pide estas herramientas."""
    return Respuesta(
        texto="", contenido=[{"pide": [n for n, _ in llamadas]}], tokens_entrada=1000, tokens_salida=100, costo_usd=0.01,
        llamadas=[LlamadaHerramienta(f"llamada{next(_ids)}", nombre, args) for nombre, args in llamadas],
        motivo_fin="tool_use",
    )


def plan(*segmentos) -> dict:
    return {"plan": {"titulo": "Errores de prompts", "segmentos": [dict(zip(("clip", "inicio", "fin"), s)) for s in segmentos]}}


PLAN_BUENO = plan(("toma1.mp4", 5.45, 8.05), ("toma2.mp4", 2.95, 5.05), ("toma2.mp4", 5.95, 8.05))


def test_el_agente_busca_corrige_y_entrega(tmp_path):
    proveedor = ProveedorGuionado([
        pide(("listar_clips", {})),
        pide(*[("buscar_tomas", {"frase": linea}) for linea in GUION_TOMAS]),   # en paralelo
        pide(("entregar_plan", plan(("toma1.mp4", 5.45, 12.0)))),                 # tiempo imposible
        pide(("entregar_plan", PLAN_BUENO)),
    ])
    proveedor.traza = Traza(tmp_path, "prueba")
    resultado = armar_plan(proveedor, proyecto_tomas(), "\n".join(GUION_TOMAS), "Tono directo.", 8.0)

    assert [(s.clip, s.inicio, s.fin) for s in resultado.segmentos] == [
        ("toma1.mp4", 5.45, 8.05), ("toma2.mp4", 2.95, 5.05), ("toma2.mp4", 5.95, 8.05),
    ]
    primero = proveedor.pedidos[0]
    assert "Tono directo." in primero["system"]
    assert [h.nombre for h in primero["herramientas"]][-1] == "entregar_plan"
    pedido = primero["mensajes"][0]["content"]
    assert "1. Hoy te voy a mostrar tres errores de prompts." in pedido and "Duración objetivo: 8 s." in pedido

    # Los tres resultados de buscar_tomas vuelven juntos en un solo turno.
    resultados_busqueda = proveedor.pedidos[2]["mensajes"][-1]["content"]
    assert len(resultados_busqueda) == 3
    assert json.loads(resultados_busqueda[0]["texto"])[0]["inicio"] == 5.5

    # El error de entregar_plan vuelve al modelo como resultado con error.
    error = proveedor.pedidos[3]["mensajes"][-1]["content"][0]
    assert error["es_error"] and "toma1.mp4 dura 10 s y pediste fin=12" in error["texto"]

    tipos = [e["tipo"] for e in proveedor.traza.eventos]
    assert tipos.count("llm") == 4 and tipos.count("herramienta") == 6 and tipos[-1] == "fin"
    lineas = proveedor.traza.ruta.read_text().splitlines()
    assert len(lineas) == len(proveedor.traza.eventos)
    entrega_fallida = [e for e in proveedor.traza.eventos if e["tipo"] == "herramienta" and e["es_error"]]
    assert entrega_fallida[0]["nombre"] == "entregar_plan" and "fin=12" in entrega_fallida[0]["resultado"]


def test_si_responde_sin_herramientas_se_le_recuerda_entregar():
    texto_suelto = Respuesta(texto="Listo, ya está.", contenido="Listo, ya está.", tokens_entrada=10, tokens_salida=5, costo_usd=0.0)
    proveedor = ProveedorGuionado([texto_suelto, pide(("entregar_plan", PLAN_BUENO))])
    armar_plan(proveedor, proyecto_tomas())
    assert proveedor.pedidos[1]["mensajes"][-1] == {"role": "user", "content": RECORDATORIO}
    assert "No hay guion" in proveedor.pedidos[0]["mensajes"][0]["content"]


def test_limite_de_pasos_con_error_claro():
    malo = plan(("toma1.mp4", 5.45, 12.0))
    proveedor = ProveedorGuionado([pide(("entregar_plan", malo)) for _ in range(3)])
    with pytest.raises(ErrorAgente) as error:
        armar_plan(proveedor, proyecto_tomas(), max_pasos=3)
    mensaje = str(error.value)
    assert mensaje.startswith("El agente llegó a 3 pasos sin entregar un plan válido.")
    assert "Último error: entregar_plan: El plan no se puede renderizar" in mensaje
    assert proveedor.uso.llamadas == 3


def test_lineas_de_guion(tmp_path):
    texto = tmp_path / "guion.txt"
    texto.write_text("\nHoy te muestro algo.\n\nY esto es lo segundo.\n")
    assert lineas_de_guion(texto) == "Hoy te muestro algo.\n\nY esto es lo segundo."

    from test_guion import guion_dict
    guion_json = tmp_path / "guion.json"
    guion_json.write_text(json.dumps(guion_dict(palabras_por_escena=2, escenas=1)))
    lineas = lineas_de_guion(guion_json).splitlines()
    assert lineas == ["palabra0_0 palabra0_1  [texto en pantalla: Idea 0]", "palabra1_0 palabra1_1  [texto en pantalla: Idea 1]", "palabra99_0 palabra99_1"]


def test_cli_editar(clips, monkeypatch, tmp_path):
    proveedor = ProveedorGuionado([
        pide(("buscar_tomas", {"frase": "Hello world"})),
        pide(("entregar_plan", plan(("voz.mp4", 1.15, 2.1)))),
    ])
    monkeypatch.setattr(factory, "get_provider", lambda config=None: proveedor)
    monkeypatch.setattr(cli, "_transcriptor", lambda: TranscriptorFalso())
    guion = tmp_path / "guion.txt"
    guion.write_text("Hello world.")
    salida = tmp_path / "plan.json"

    resultado = CliRunner().invoke(cli.app, ["editar", str(clips), "--guion", str(guion), "--salida", str(salida)])
    assert resultado.exit_code == 0, resultado.output
    assert "paso 1: buscar_tomas" in resultado.output and "paso 2: entregar_plan" in resultado.output
    assert json.loads(salida.read_text())["segmentos"][0]["clip"] == "voz.mp4"
    assert "Uso: 2 llamadas" in resultado.output
    # La búsqueda encontró la frase transcripta (TranscriptorFalso da el mismo texto a cada clip con audio).
    tomas = json.loads(proveedor.pedidos[1]["mensajes"][-1]["content"][0]["texto"])
    assert (tomas[0]["texto"], tomas[0]["inicio"], tomas[0]["similitud"]) == ("Hello world.", PALABRAS_VOZ[0].inicio, 1.0)
    trazas = list((tmp_path / "trazas").glob("*_editar_clips_prueba.jsonl"))
    assert len(trazas) == 1


@pytest.mark.skipif(
    os.getenv("EDITOR_TEST_API") != "1",
    reason="llama a la API real (cuesta plata): correr con EDITOR_TEST_API=1",
)
def test_agente_real_elige_las_tomas_correctas(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    proveedor = factory.get_provider()
    proveedor.traza = Traza(tmp_path, "agente_real")
    plan_real = armar_plan(proveedor, proyecto_tomas(), "\n".join(GUION_TOMAS), duracion_objetivo=8.0)
    print(proveedor.uso.resumen())

    def cubre(clip, inicio, fin):
        # Algún segmento del mismo clip cubre al menos el 80 % de la toma esperada.
        return any(
            s.clip == clip and min(s.fin, fin) - max(s.inicio, inicio) >= 0.8 * (fin - inicio)
            for s in plan_real.segmentos
        )

    acertadas = sum(cubre(*esperada) for esperada in TOMAS_ESPERADAS)
    assert acertadas == len(TOMAS_ESPERADAS), plan_real.model_dump_json(indent=2)
