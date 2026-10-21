"""Trazas: un JSONL por corrida con cada llamada al LLM y a las herramientas.

Sirven para explicar por qué un caso falló y cuánto costó (tokens, costo y latencia).
"""

import json
import re
import time
from datetime import datetime
from pathlib import Path

LARGO_MAX_ARGUMENTOS = 500  # los argumentos largos (un plan entero) se recortan en la traza


class Traza:
    def __init__(self, carpeta: Path | None, nombre: str):
        self.eventos: list[dict] = []
        self.ruta: Path | None = None
        if carpeta is not None:
            carpeta.mkdir(parents=True, exist_ok=True)
            seguro = re.sub(r"[^\w-]+", "_", nombre).strip("_") or "corrida"
            self.ruta = carpeta / f"{datetime.now():%Y%m%d-%H%M%S}_{seguro}.jsonl"
        self._inicio = time.perf_counter()

    def registrar(self, tipo: str, **datos) -> None:
        evento = {"t": round(time.perf_counter() - self._inicio, 3), "tipo": tipo, **datos}
        self.eventos.append(evento)
        if self.ruta is not None:
            with self.ruta.open("a", encoding="utf-8") as archivo:
                archivo.write(json.dumps(evento, ensure_ascii=False) + "\n")

    def llamada_llm(self, modelo: str, respuesta, segundos: float) -> None:
        self.registrar(
            "llm",
            modelo=modelo,
            tokens_entrada=respuesta.tokens_entrada,
            tokens_salida=respuesta.tokens_salida,
            tokens_cache_leidos=respuesta.tokens_cache_leidos,
            tokens_cache_escritos=respuesta.tokens_cache_escritos,
            costo_usd=respuesta.costo_usd,
            segundos=round(segundos, 3),
            motivo_fin=respuesta.motivo_fin,
            herramientas=[llamada.nombre for llamada in respuesta.llamadas],
        )

    def llamada_herramienta(
        self, paso: int, nombre: str, argumentos: dict, resultado: str, es_error: bool, segundos: float
    ) -> None:
        texto = json.dumps(argumentos, ensure_ascii=False)
        if len(texto) > LARGO_MAX_ARGUMENTOS:
            texto = texto[:LARGO_MAX_ARGUMENTOS] + "…"
        self.registrar(
            "herramienta",
            paso=paso,
            nombre=nombre,
            argumentos=texto,
            es_error=es_error,
            resultado=resultado if es_error else f"{len(resultado)} caracteres",
            segundos=round(segundos, 3),
        )
