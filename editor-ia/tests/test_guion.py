"""Fase 3: modelo Guion, su validación y el comando guion."""

import json
import os

import pytest
from pydantic import ValidationError
from typer.testing import CliRunner

from editor import cli
from editor.guion import generar_guion, guion_a_markdown
from editor.llm import factory
from editor.modelos import Escena, Guion, errores_de_guion
from conftest import ProveedorGuionado


def guion_dict(palabras_por_escena: int = 10, escenas: int = 3, textos: int = 1) -> dict:
    def escena(i: int, con_texto: bool) -> dict:
        return {
            "texto": " ".join(f"palabra{i}_{j}" for j in range(palabras_por_escena)),
            "plano": "primer plano",
            "texto_pantalla": f"Idea {i}" if con_texto else "",
        }

    return {
        "titulo": "Por qué tu prompt no funciona",
        "gancho": escena(0, True),
        "escenas": [escena(i, i <= textos) for i in range(1, escenas + 1)],
        "cierre": escena(99, False),
        "tomas": ["Gancho a cámara", "Escenas a cámara", "Pantalla con el prompt"],
        "copy_posteo": "Tu prompt no está mal, está incompleto. #ia #prompt #productividad",
    }


def test_texto_en_pantalla_de_mas_de_6_palabras():
    with pytest.raises(ValidationError, match="máximo 6 palabras"):
        Escena(texto="hola", plano="primer plano", texto_pantalla="uno dos tres cuatro cinco seis siete")


def test_duracion_estimada_por_palabras():
    guion = Guion.model_validate(guion_dict(palabras_por_escena=27, escenas=3))  # 5 escenas x 27
    assert guion.palabras_habladas() == 135
    assert guion.segundos_estimados() == pytest.approx(50)


def test_errores_de_guion():
    guion = Guion.model_validate(guion_dict(palabras_por_escena=27, escenas=3))  # unos 50 s
    assert errores_de_guion(guion, 45) == []
    assert errores_de_guion(guion, 30) == [
        "el guion tiene 135 palabras habladas (unos 50 s) y el objetivo es 30 s: recortá a unas 81 palabras"
    ]
    assert "alargalo a unas 216 palabras" in errores_de_guion(guion, 80)[0]
    muchos_textos = Guion.model_validate(guion_dict(palabras_por_escena=27, escenas=4, textos=4))
    assert "texto en pantalla en 4 escenas" in errores_de_guion(muchos_textos, 60)[0]


def test_generar_guion_corrige_la_duracion():
    largo = json.dumps(guion_dict(palabras_por_escena=40))   # 200 palabras: unos 74 s
    justo = json.dumps(guion_dict(palabras_por_escena=16))   # 80 palabras: unos 30 s
    proveedor = ProveedorGuionado([largo, justo])
    guion = generar_guion(proveedor, "por qué tu prompt no funciona", "Tono: directo, con voseo.", 30)

    assert guion.palabras_habladas() == 80
    primer_pedido = proveedor.pedidos[0]
    assert "Tono: directo, con voseo." in primer_pedido["system"]
    assert "Duración objetivo: 30 segundos, unas 81 palabras" in primer_pedido["mensajes"][0]["content"]
    correccion = proveedor.pedidos[1]["mensajes"][-1]["content"]
    assert "recortá a unas 81 palabras" in correccion


def test_guion_a_markdown():
    md = guion_a_markdown(Guion.model_validate(guion_dict()))
    assert md.startswith("# Por qué tu prompt no funciona\n")
    for seccion in ("## Gancho", "## Escena 1", "## Escena 3", "## Cierre", "## Tomas para grabar", "## Copy del posteo"):
        assert seccion in md
    assert "- Texto en pantalla: «Idea 0»" in md
    assert "3. Pantalla con el prompt" in md


def test_cli_guion(monkeypatch, tmp_path):
    proveedor = ProveedorGuionado([json.dumps(guion_dict(palabras_por_escena=24))])
    monkeypatch.setattr(factory, "get_provider", lambda: proveedor)
    marca = tmp_path / "marca.md"
    marca.write_text("Tono: directo.")
    salida = tmp_path / "out" / "guion.json"

    resultado = CliRunner().invoke(cli.app, [
        "guion", "por qué tu prompt no funciona", "--marca", str(marca), "--duracion", "45", "--salida", str(salida),
    ])
    assert resultado.exit_code == 0, resultado.output
    assert Guion.model_validate_json(salida.read_text()).titulo == "Por qué tu prompt no funciona"
    assert salida.with_suffix(".md").read_text().startswith("# Por qué tu prompt no funciona")
    assert "Uso: 1 llamadas" in resultado.output


def test_cli_guion_que_no_se_puede_corregir(monkeypatch, tmp_path):
    largo = json.dumps(guion_dict(palabras_por_escena=40))
    monkeypatch.setattr(factory, "get_provider", lambda: ProveedorGuionado([largo] * 3))
    resultado = CliRunner().invoke(cli.app, ["guion", "idea", "--duracion", "20", "--salida", str(tmp_path / "g.json")])
    assert resultado.exit_code == 1
    assert "Guion sigue siendo inválido después de 3 intentos" in resultado.output
    assert "Uso: 3 llamadas" in resultado.output
    assert not (tmp_path / "g.json").exists()


@pytest.mark.skipif(
    os.getenv("EDITOR_TEST_API") != "1",
    reason="llama a la API real (cuesta plata): correr con EDITOR_TEST_API=1",
)
def test_guion_con_la_api_real(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    proveedor = factory.get_provider()
    guion = generar_guion(proveedor, "tres errores al escribir prompts", "Tono cercano, con voseo.", 30)
    assert errores_de_guion(guion, 30) == []
    print(proveedor.uso.resumen())
