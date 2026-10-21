"""Revisión humana: proyecto guardado, decisiones.md y cambios pedidos en lenguaje natural.

editar deja junto al plan un proyecto.json con el análisis de los clips; revisar lo
usa para aplicar cambios sin volver a analizar nada. El render final se hace recién
cuando la persona aprueba el plan.
"""

import shutil
from pathlib import Path

from pydantic import BaseModel

from editor.ingesta import AnalisisClip, Palabra
from editor.llm.base import LLMProvider
from editor.modelos import PlanEdicion, errores_de_contenido
from editor.render import duracion_plan

ARCHIVO_PROYECTO = "proyecto.json"
ARCHIVO_DECISIONES = "decisiones.md"
ARCHIVO_VISTA_PREVIA = "vista_previa.mp4"


class Proyecto(BaseModel):
    clips: str                         # carpeta de los clips, ruta absoluta
    guion: str | None = None
    duracion_objetivo: float | None = None
    analisis: dict[str, AnalisisClip]
    cambios: list[str] = []            # pedidos de cambio ya aplicados, en orden

    def palabras(self) -> dict[str, list[Palabra]]:
        return {nombre: a.palabras for nombre, a in self.analisis.items()}

    def duraciones(self) -> dict[str, float]:
        return {nombre: a.info.duracion for nombre, a in self.analisis.items()}


def guardar_proyecto(proyecto: Proyecto, carpeta: Path) -> Path:
    ruta = carpeta / ARCHIVO_PROYECTO
    ruta.write_text(proyecto.model_dump_json(indent=1), encoding="utf-8")
    return ruta


def cargar_proyecto(carpeta: Path) -> Proyecto:
    ruta = carpeta / ARCHIVO_PROYECTO
    if not ruta.is_file():
        raise FileNotFoundError(f"No encontré {ruta}: corré editar primero")
    return Proyecto.model_validate_json(ruta.read_text(encoding="utf-8"))


def guardar_version(ruta_plan: Path) -> Path | None:
    """Antes de pisar un plan, lo copia a plan.v1.json, plan.v2.json... Devuelve la copia."""
    if not ruta_plan.is_file():
        return None
    n = 1
    while (copia := ruta_plan.with_name(f"{ruta_plan.stem}.v{n}{ruta_plan.suffix}")).exists():
        n += 1
    shutil.copy2(ruta_plan, copia)
    return copia


def _s(segundos: float) -> str:
    return f"{segundos:.2f}".replace(".", ",")


def decisiones_md(plan: PlanEdicion, cambios: list[str] | None = None) -> str:
    """Cada corte explicado en una línea, para revisar antes de aprobar."""
    lineas = [
        f"# {plan.titulo}",
        "",
        f"Duración: {_s(duracion_plan(plan))} s · {len(plan.segmentos)} segmentos · "
        f"subtítulos: {'sí' if plan.subtitulos else 'no'}",
        "",
        "## Cortes",
        "",
    ]
    for i, seg in enumerate(plan.segmentos, start=1):
        detalles = [f"{seg.clip} {_s(seg.inicio)}–{_s(seg.fin)} ({_s(seg.duracion)} s)"]
        if seg.zoom != "ninguno":
            detalles.append(f"zoom {seg.zoom}")
        if seg.texto:
            detalles.append(f"«{seg.texto}»")
        linea = f"{i}. " + " · ".join(detalles)
        if seg.nota:
            linea += f" — {seg.nota}"
        lineas.append(linea)
    if cambios:
        lineas += ["", "## Cambios pedidos", ""]
        lineas += [f"{i}. {cambio}" for i, cambio in enumerate(cambios, start=1)]
    return "\n".join(lineas) + "\n"


SISTEMA_REVISION = """Sos editor de videos cortos verticales. Te paso un plan de edición ya armado \
y los cambios que pidió la persona que lo revisó. Devolvé el plan completo con los cambios aplicados.

Reglas:
- Cambiá solo lo que se pide; todo lo demás queda igual, en el mismo orden.
- "La toma N", "el corte N" o "el segmento N" es el número N de la lista de cortes.
- Usá solo tiempos que existen en las transcripciones, con 0,05 a 0,1 s de margen antes y \
después de la voz. No cortes frases a la mitad.
- Si se pide más corto, sacá primero lo menos importante para la idea del video.
- En la nota de cada segmento que cambies, explicá el cambio en una línea.
- Texto en pantalla de máximo 6 palabras."""


def _transcripciones(proyecto: Proyecto) -> str:
    bloques = []
    for nombre, a in proyecto.analisis.items():
        if not a.info.tiene_audio:
            bloques.append(f"{nombre} ({_s(a.info.duracion)} s): sin audio, sirve como b-roll")
            continue
        frases = "\n".join(f"  [{_s(f.inicio)}–{_s(f.fin)}] {f.texto}" for f in a.frases) or "  (sin voz)"
        bloques.append(f"{nombre} ({_s(a.info.duracion)} s):\n{frases}")
    return "\n\n".join(bloques)


def revisar_plan(proveedor: LLMProvider, proyecto: Proyecto, plan: PlanEdicion, cambios: str) -> PlanEdicion:
    """Una sola llamada con salida estructurada (más barato que correr el agente de nuevo)."""
    cortes = decisiones_md(plan).split("## Cortes\n\n", 1)[1]
    partes = [
        f"Plan actual ({_s(duracion_plan(plan))} s):\n{plan.model_dump_json(indent=1)}",
        f"Cortes numerados:\n{cortes}",
        f"Transcripciones de los clips:\n{_transcripciones(proyecto)}",
    ]
    if proyecto.duracion_objetivo:
        partes.append(f"Duración objetivo: {proyecto.duracion_objetivo:g} s.")
    partes.append(f"Cambios pedidos: {cambios}")
    duraciones = proyecto.duraciones()
    return proveedor.generate_structured(
        "\n\n".join(partes), PlanEdicion, system=SISTEMA_REVISION,
        validar=lambda nuevo: errores_de_contenido(nuevo, duraciones),
    )
