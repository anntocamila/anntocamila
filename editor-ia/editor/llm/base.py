"""Interfaz común de los proveedores de LLM: generar, validar y corregir, y llamar herramientas."""

import time
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from editor.modelos import describir_error

T = TypeVar("T", bound=BaseModel)


class ErrorLLM(Exception):
    """El proveedor no pudo responder (rechazo, respuesta cortada, error de la API)."""


class ErrorSalidaInvalida(ErrorLLM):
    """El modelo no logró una salida válida dentro del límite de correcciones."""


@dataclass
class Herramienta:
    nombre: str
    descripcion: str
    esquema: dict             # JSON Schema de los argumentos


@dataclass
class LlamadaHerramienta:
    id: str
    nombre: str
    argumentos: dict


@dataclass
class ResultadoHerramienta:
    id: str                   # el de la LlamadaHerramienta que responde
    texto: str
    es_error: bool = False


@dataclass
class Respuesta:
    texto: str
    contenido: Any            # lo que se reenvía como turno del asistente (formato del proveedor)
    tokens_entrada: int
    tokens_salida: int
    costo_usd: float | None   # None si no conocemos la tarifa del modelo
    tokens_cache_leidos: int = 0
    tokens_cache_escritos: int = 0
    llamadas: list[LlamadaHerramienta] = field(default_factory=list)
    motivo_fin: str = ""


@dataclass
class Uso:
    """Acumulado de todas las llamadas de un proveedor: para medir costo y latencia."""

    llamadas: int = 0
    tokens_entrada: int = 0
    tokens_salida: int = 0
    tokens_cache_leidos: int = 0
    tokens_cache_escritos: int = 0
    costo_usd: float = 0.0
    segundos: float = 0.0
    costo_desconocido: bool = False

    def sumar(self, respuesta: Respuesta, segundos: float) -> None:
        self.llamadas += 1
        self.tokens_entrada += respuesta.tokens_entrada
        self.tokens_salida += respuesta.tokens_salida
        self.tokens_cache_leidos += respuesta.tokens_cache_leidos
        self.tokens_cache_escritos += respuesta.tokens_cache_escritos
        self.segundos += segundos
        if respuesta.costo_usd is None:
            self.costo_desconocido = True
        else:
            self.costo_usd += respuesta.costo_usd

    def resumen(self) -> str:
        costo = "costo desconocido" if self.costo_desconocido else f"US$ {self.costo_usd:.4f}"
        cache = ""
        if self.tokens_cache_leidos or self.tokens_cache_escritos:
            cache = f" (más {self.tokens_cache_leidos} leídos y {self.tokens_cache_escritos} escritos en caché)"
        return (
            f"{self.llamadas} llamadas, {self.tokens_entrada} tokens de entrada{cache}, "
            f"{self.tokens_salida} de salida, {costo}, {self.segundos:.1f} s"
        )


class LLMProvider(ABC):
    """Cada proveedor implementa _completar; generate y generate_structured son comunes."""

    nombre: str = ""

    def __init__(self, modelo: str, max_correcciones: int = 3):
        self.modelo = modelo
        self.max_correcciones = max_correcciones
        self.uso = Uso()
        self.traza = None  # si se le asigna una Traza, registra cada llamada

    @abstractmethod
    def _completar(
        self,
        system: str,
        mensajes: list[dict],
        esquema: dict | None,
        herramientas: list[Herramienta] | None = None,
    ) -> Respuesta:
        """Una llamada al modelo. Con esquema, la respuesta tiene que ser JSON que lo cumpla;
        con herramientas, el modelo puede pedir llamadas (Respuesta.llamadas)."""

    def mensaje_resultados(self, resultados: list[ResultadoHerramienta]) -> dict:
        """Turno con los resultados de las herramientas, en el formato del proveedor."""
        raise NotImplementedError(f"El proveedor {self.nombre} no soporta herramientas")

    def _llamar(
        self,
        system: str,
        mensajes: list[dict],
        esquema: dict | None,
        herramientas: list[Herramienta] | None = None,
    ) -> Respuesta:
        inicio = time.perf_counter()
        respuesta = self._completar(system, mensajes, esquema, herramientas)
        segundos = time.perf_counter() - inicio
        self.uso.sumar(respuesta, segundos)
        if self.traza is not None:
            self.traza.llamada_llm(self.modelo, respuesta, segundos)
        return respuesta

    def generate_with_tools(self, system: str, mensajes: list[dict], herramientas: list[Herramienta]) -> Respuesta:
        """Un paso del loop de agente: el modelo responde o pide herramientas."""
        return self._llamar(system, mensajes, None, herramientas)

    def generate(self, prompt: str, system: str = "") -> str:
        return self._llamar(system, [{"role": "user", "content": prompt}], None).texto

    def generate_structured(
        self,
        prompt: str,
        modelo: type[T],
        system: str = "",
        validar: Callable[[T], list[str]] | None = None,
    ) -> T:
        """Genera un objeto del modelo Pydantic; si no valida, le devuelve el error y corrige.

        Valida en dos niveles: la estructura (Pydantic) y, si se pasa `validar`, el
        contenido (por ejemplo, tiempos contra la duración real de los clips).
        """
        mensajes: list[dict] = [{"role": "user", "content": prompt}]
        esquema = modelo.model_json_schema()
        problemas = ""
        for intento in range(1, self.max_correcciones + 2):
            respuesta = self._llamar(system, mensajes, esquema)
            try:
                objeto = modelo.model_validate_json(respuesta.texto)
                errores = validar(objeto) if validar else []
            except ValidationError as error:
                errores = describir_error(error).splitlines()
            if not errores:
                return objeto

            problemas = "\n".join(f"- {e}" for e in errores)
            # Se agrega el intento fallido y el error concreto; nunca se edita lo anterior.
            mensajes.append({"role": "assistant", "content": respuesta.contenido})
            mensajes.append({
                "role": "user",
                "content": (
                    f"La respuesta no pasó la validación:\n{problemas}\n\n"
                    "Corregí esos puntos y devolvé el JSON completo de nuevo, con el mismo esquema."
                ),
            })
        raise ErrorSalidaInvalida(
            f"{modelo.__name__} sigue siendo inválido después de {intento} intentos "
            f"({self.max_correcciones} correcciones). Últimos errores:\n{problemas}"
        )
