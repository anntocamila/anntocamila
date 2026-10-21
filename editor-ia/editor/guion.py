"""Comando guion: de una idea a un guion con el tono de la marca."""

from editor.llm.base import LLMProvider
from editor.modelos import MAX_PALABRAS_PANTALLA, PALABRAS_POR_SEGUNDO, Guion, errores_de_guion

SISTEMA = """Sos guionista de videos cortos verticales (TikTok, Reels, Shorts) para la marca \
que se describe abajo. Escribís para que se diga a cámara: frases cortas, naturales y fáciles \
de decir de corrido.

Reglas:
- El gancho son los primeros 3 segundos: arranca directo con la idea más fuerte, sin \
presentarse ni saludar.
- Una idea por escena. Nada de relleno.
- Texto en pantalla de máximo {max_palabras} palabras, solo en el gancho y en 2 o 3 ideas \
clave; en el resto de las escenas va vacío.
- La lista de tomas dice qué grabar, en orden; sumá b-roll solo si ayuda a entender.
- El copy del posteo es corto, con el mismo tono, y termina con 3 a 5 hashtags.
- Respetá el tono, las palabras y el formato de la marca.

<marca>
{marca}
</marca>"""


def generar_guion(proveedor: LLMProvider, idea: str, marca: str, duracion_objetivo: float) -> Guion:
    """Genera un Guion validado; si se pasa de duración, el modelo recibe la cuenta y corrige."""
    palabras = round(duracion_objetivo * PALABRAS_POR_SEGUNDO)
    prompt = (
        f"Idea del video: {idea}\n\n"
        f"Duración objetivo: {duracion_objetivo:g} segundos, unas {palabras} palabras habladas "
        "en total sumando gancho, escenas y cierre."
    )
    sistema = SISTEMA.format(max_palabras=MAX_PALABRAS_PANTALLA, marca=marca.strip() or "Sin guía de marca: tono cercano y claro.")
    return proveedor.generate_structured(
        prompt, Guion, system=sistema, validar=lambda g: errores_de_guion(g, duracion_objetivo)
    )


def guion_a_markdown(guion: Guion) -> str:
    """Versión para leer mientras grabás."""

    def escena(titulo: str, e) -> list[str]:
        lineas = [f"## {titulo}", "", f"> {e.texto}", "", f"- Plano: {e.plano}"]
        if e.texto_pantalla:
            lineas.append(f"- Texto en pantalla: «{e.texto_pantalla}»")
        return lineas + [""]

    lineas = [
        f"# {guion.titulo}",
        "",
        f"Duración estimada: unos {round(guion.segundos_estimados())} s ({guion.palabras_habladas()} palabras).",
        "",
    ]
    lineas += escena("Gancho", guion.gancho)
    for i, e in enumerate(guion.escenas, start=1):
        lineas += escena(f"Escena {i}", e)
    lineas += escena("Cierre", guion.cierre)
    lineas += ["## Tomas para grabar", ""]
    lineas += [f"{i}. {toma}" for i, toma in enumerate(guion.tomas, start=1)]
    lineas += ["", "## Copy del posteo", "", guion.copy_posteo, ""]
    return "\n".join(lineas)
