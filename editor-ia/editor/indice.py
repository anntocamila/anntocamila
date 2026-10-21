"""Índice de frases para buscar_tomas: embeddings y similitud coseno.

Por defecto los vectores son n-gramas de caracteres: corren local, no cuestan nada y
no hay que bajar ningún modelo. Para tomas repetidas sirven bien, porque cada toma
dice casi las mismas palabras; una toma trabada repite pedazos y una incompleta le
faltan, y las dos quedan más lejos de la línea del guion que la toma limpia. Un
modelo semántico (que entienda paráfrasis) se puede comparar en la fase 6.
"""

import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from typing import Protocol

from editor.ingesta import AnalisisClip

N_GRAMA = 3
PAUSA_MAX_ENTRE_FRASES_S = 1.0  # dos frases seguidas con menos pausa se indexan también juntas


class Embedder(Protocol):
    nombre: str

    def vector(self, texto: str) -> dict[str, float]: ...


def normalizar(texto: str) -> str:
    """Minúsculas, sin tildes ni puntuación: 'Ahí va, ¡YA!' -> 'ahi va ya'."""
    sin_tildes = unicodedata.normalize("NFKD", texto.lower())
    sin_tildes = "".join(c for c in sin_tildes if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^\w]+", " ", sin_tildes).split())


class EmbedderNgramas:
    nombre = "ngramas"

    def vector(self, texto: str) -> dict[str, float]:
        conteo: Counter[str] = Counter()
        for palabra in normalizar(texto).split():
            marcada = f" {palabra} "
            conteo.update(marcada[i:i + N_GRAMA] for i in range(len(marcada) - N_GRAMA + 1))
        norma = math.sqrt(sum(v * v for v in conteo.values())) or 1.0
        return {clave: v / norma for clave, v in conteo.items()}


def coseno(a: dict[str, float], b: dict[str, float]) -> float:
    if len(a) > len(b):
        a, b = b, a
    return sum(valor * b.get(clave, 0.0) for clave, valor in a.items())


def crear_embedder(proveedor: str = "") -> Embedder:
    if proveedor in ("", "ngramas"):
        return EmbedderNgramas()
    raise ValueError(
        f"El proveedor de embeddings {proveedor!r} no está implementado todavía "
        "(disponible: ngramas). Revisá EMBEDDINGS_PROVIDER en .env"
    )


@dataclass
class Toma:
    clip: str
    inicio: float
    fin: float
    texto: str
    similitud: float = 0.0


class Indice:
    """Frases de todos los clips (sueltas y de a dos seguidas) con su vector."""

    def __init__(self, analisis: dict[str, AnalisisClip], embedder: Embedder | None = None):
        self.embedder = embedder or EmbedderNgramas()
        self.tomas: list[Toma] = []
        for nombre, clip in analisis.items():
            frases = clip.frases
            for i, frase in enumerate(frases):
                self.tomas.append(Toma(nombre, frase.inicio, frase.fin, frase.texto))
                # Una línea del guion puede quedar partida en dos frases de Whisper.
                if i + 1 < len(frases) and frases[i + 1].inicio - frase.fin < PAUSA_MAX_ENTRE_FRASES_S:
                    siguiente = frases[i + 1]
                    self.tomas.append(Toma(nombre, frase.inicio, siguiente.fin, f"{frase.texto} {siguiente.texto}"))
        self._vectores = [self.embedder.vector(t.texto) for t in self.tomas]

    def buscar(self, frase: str, k: int = 3) -> list[Toma]:
        """Las k tomas más parecidas a la frase, sin devolver dos que se pisen en el mismo clip."""
        consulta = self.embedder.vector(frase)
        puntuadas = sorted(
            (Toma(t.clip, t.inicio, t.fin, t.texto, round(coseno(consulta, v), 3)) for t, v in zip(self.tomas, self._vectores)),
            key=lambda t: t.similitud,
            reverse=True,
        )
        elegidas: list[Toma] = []
        for toma in puntuadas:
            if len(elegidas) == k:
                break
            if not any(t.clip == toma.clip and t.inicio < toma.fin and toma.inicio < t.fin for t in elegidas):
                elegidas.append(toma)
        return elegidas
