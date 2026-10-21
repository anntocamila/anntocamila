"""Configuración del editor: todo sale de .env (o de variables de entorno)."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import find_dotenv, load_dotenv


@dataclass(frozen=True)
class Config:
    llm_provider: str
    llm_model: str
    llm_esfuerzo: str
    embeddings_provider: str
    embeddings_model: str
    whisper_model: str
    whisper_idioma: str
    whisper_vocabulario: str
    agente_max_pasos: int
    llm_max_reintentos: int
    llm_max_correcciones: int
    cache_dir: Path
    trazas_dir: Path


def _entero(nombre: str, por_defecto: int) -> int:
    valor = os.getenv(nombre, "").strip()
    if not valor:
        return por_defecto
    try:
        return int(valor)
    except ValueError:
        raise ValueError(f"{nombre} tiene que ser un número entero y vale {valor!r}")


def _cargar_env() -> None:
    # Se busca .env desde la carpeta donde se corre el comando (y hacia arriba).
    load_dotenv(find_dotenv(usecwd=True))


def cargar_config() -> Config:
    """Lee .env (si existe) y devuelve la configuración con valores por defecto."""
    _cargar_env()
    return Config(
        llm_provider=os.getenv("LLM_PROVIDER", "anthropic").strip().lower(),
        llm_model=os.getenv("LLM_MODEL", "").strip(),
        llm_esfuerzo=os.getenv("LLM_ESFUERZO", "medium").strip().lower(),
        embeddings_provider=os.getenv("EMBEDDINGS_PROVIDER", "").strip().lower(),
        embeddings_model=os.getenv("EMBEDDINGS_MODEL", "").strip(),
        whisper_model=os.getenv("WHISPER_MODEL", "small").strip(),
        whisper_idioma=os.getenv("WHISPER_IDIOMA", "es").strip(),
        whisper_vocabulario=os.getenv("WHISPER_VOCABULARIO", "").strip(),
        agente_max_pasos=_entero("AGENTE_MAX_PASOS", 15),
        llm_max_reintentos=_entero("LLM_MAX_REINTENTOS", 3),
        llm_max_correcciones=_entero("LLM_MAX_CORRECCIONES", 3),
        cache_dir=Path(os.getenv("CACHE_DIR", ".cache").strip()),
        trazas_dir=Path(os.getenv("TRAZAS_DIR", "trazas").strip()),
    )


def clave_api(proveedor: str) -> str:
    """Devuelve la clave del proveedor o falla con un error claro si falta."""
    nombre = f"{proveedor.upper()}_API_KEY"
    _cargar_env()
    clave = os.getenv(nombre, "").strip()
    if not clave:
        raise RuntimeError(f"Falta {nombre} en .env (mirá .env.example)")
    return clave
