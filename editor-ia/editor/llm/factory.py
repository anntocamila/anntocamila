"""Elige el proveedor de LLM según LLM_PROVIDER en .env."""

from editor.config import Config, cargar_config
from editor.llm.base import LLMProvider

PROVEEDORES = ("anthropic",)


def get_provider(config: Config | None = None) -> LLMProvider:
    config = config or cargar_config()
    if config.llm_provider == "anthropic":
        from editor.llm.anthropic import ProveedorAnthropic

        return ProveedorAnthropic(
            modelo=config.llm_model,
            esfuerzo=config.llm_esfuerzo,
            max_reintentos=config.llm_max_reintentos,
            max_correcciones=config.llm_max_correcciones,
        )
    raise ValueError(
        f"El proveedor {config.llm_provider!r} no está implementado todavía "
        f"(disponibles: {', '.join(PROVEEDORES)}). Revisá LLM_PROVIDER en .env"
    )
