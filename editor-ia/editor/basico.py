"""Plan sin LLM: gratis, determinístico y línea de base para la evaluación.

Con guion: por cada línea elige la toma más parecida (buscar_tomas) y la recorta a las
palabras, con un margen chico. Sin guion: usa las frases en orden de grabación y, si una
frase se repite, se queda con la última toma.
"""

from editor.indice import Embedder, Indice, coseno
from editor.ingesta import AnalisisClip
from editor.modelos import PlanEdicion, Segmento

MARGEN_S = 0.08
SIMILITUD_MINIMA = 0.5      # por debajo, la línea del guion no está grabada
SIMILITUD_REPETIDA = 0.6    # sin guion: dos frases así de parecidas son tomas de lo mismo
LARGO_MINIMO_S = 0.2        # el mismo mínimo que valida Segmento


def _recortar(analisis: AnalisisClip, inicio: float, fin: float) -> tuple[float, float]:
    """Ajusta el tramo a la primera y la última palabra, con MARGEN_S de aire."""
    palabras = [p for p in analisis.palabras if p.fin > inicio and p.inicio < fin]
    if palabras:
        inicio, fin = palabras[0].inicio, palabras[-1].fin
    return round(max(0.0, inicio - MARGEN_S), 3), round(min(analisis.info.duracion, fin + MARGEN_S), 3)


def plan_basico(
    analisis: dict[str, AnalisisClip], guion: str | None = None, embedder: Embedder | None = None
) -> tuple[PlanEdicion, list[str]]:
    """Devuelve el plan y la lista de avisos (líneas del guion que no encontró)."""
    indice = Indice(analisis, embedder)
    segmentos, avisos = [], []

    if guion:
        lineas = [l.strip() for l in guion.splitlines() if l.strip()]
        for n, linea in enumerate(lineas, start=1):
            tomas = indice.buscar(linea, k=1)
            if not tomas or tomas[0].similitud < SIMILITUD_MINIMA:
                avisos.append(f"línea {n} sin toma parecida: «{linea}»")
                continue
            toma = tomas[0]
            inicio, fin = _recortar(analisis[toma.clip], toma.inicio, toma.fin)
            if fin - inicio < LARGO_MINIMO_S:
                continue
            segmentos.append(Segmento(
                clip=toma.clip, inicio=inicio, fin=fin,
                nota=f"línea {n}: toma más parecida (similitud {toma.similitud:.2f})"[:120],
            ))
        titulo = lineas[0] if lineas else "Video"
    else:
        frases = [(nombre, f) for nombre, a in sorted(analisis.items()) for f in a.frases]
        vectores = [indice.embedder.vector(f.texto) for _, f in frases]
        for i, (nombre, frase) in enumerate(frases):
            # Si más adelante se repite la frase, esa toma es la buena (la última suele ser la mejor).
            if any(coseno(vectores[i], v) >= SIMILITUD_REPETIDA for v in vectores[i + 1:]):
                continue
            inicio, fin = _recortar(analisis[nombre], frase.inicio, frase.fin)
            if fin - inicio < LARGO_MINIMO_S:
                continue
            segmentos.append(Segmento(clip=nombre, inicio=inicio, fin=fin, nota="frase en orden de grabación"))
        titulo = frases[0][1].texto if frases else "Video"

    if not segmentos:
        raise ValueError("No hay ninguna frase para armar el plan (¿los clips tienen voz?)")
    segmentos[0] = segmentos[0].model_copy(update={"zoom": "lento"})  # gancho
    return PlanEdicion(titulo=titulo[:60], segmentos=segmentos), avisos
