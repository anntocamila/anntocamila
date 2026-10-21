"""Tests de la fase 0: la CLI corre, la config sale de .env y no hay claves en el código."""

import re
import subprocess
import sys
from pathlib import Path

from typer.testing import CliRunner

from editor.cli import app
from editor.config import cargar_config

RAIZ = Path(__file__).resolve().parent.parent


def test_python_m_editor_help():
    resultado = subprocess.run(
        [sys.executable, "-m", "editor", "--help"],
        cwd=RAIZ,
        capture_output=True,
        text=True,
    )
    assert resultado.returncode == 0, resultado.stderr
    for comando in ("guion", "editar", "revisar", "render"):
        assert comando in resultado.stdout


def test_comando_pendiente_avisa_la_fase():
    resultado = CliRunner().invoke(app, ["editar", "clips"])
    assert resultado.exit_code == 1
    assert "fase 4" in resultado.output


def test_config_lee_variables_de_entorno(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)  # sin .env: solo variables de entorno
    monkeypatch.setenv("LLM_PROVIDER", "Gemini")
    monkeypatch.setenv("AGENTE_MAX_PASOS", "7")
    config = cargar_config()
    assert config.llm_provider == "gemini"
    assert config.agente_max_pasos == 7
    assert config.whisper_model == "small"


def test_no_hay_claves_en_el_codigo():
    # Patrones de claves de los proveedores que podemos usar.
    patron = re.compile(r"(sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,})")
    archivos = [
        p
        for p in RAIZ.rglob("*")
        if p.is_file()
        and p.suffix in {".py", ".md", ".txt", ".toml", ".json", ".example"}
        and ".venv" not in p.parts
    ]
    con_claves = [str(p) for p in archivos if patron.search(p.read_text(errors="ignore"))]
    assert not con_claves, f"Hay algo parecido a una clave en: {con_claves}"
