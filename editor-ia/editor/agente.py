"""Loop del agente: el modelo pide herramientas hasta entregar un plan válido.

Termina cuando entregar_plan acepta el plan. Si llega al límite de pasos sin un
plan válido, corta con un error que dice qué pasó en el último intento.
"""

import time
from collections.abc import Callable
from pathlib import Path

from editor.herramientas import Contexto, definiciones, ejecutar
from editor.indice import Embedder, Indice
from editor.ingesta import AnalisisClip
from editor.llm.base import LLMProvider, ResultadoHerramienta
from editor.modelos import Guion, PlanEdicion

SISTEMA = """Sos editor de videos cortos verticales (TikTok, Reels, Shorts). Armás el plan \
de edición: qué tramo de qué clip va, en qué orden, con qué zoom y qué texto en pantalla. \
Las herramientas te dan los datos reales y hacen las cuentas; vos decidís.

Cómo trabajar:
1. Llamá a listar_clips para ver el material.
2. Si hay guion, por cada línea llamá a buscar_tomas y elegí la mejor toma. Si no hay guion, \
leé las transcripciones y armá el video en el orden en que se grabó, sin tomas falsas ni repeticiones.
3. Usá leer_transcripcion con con_palabras=true en los tramos que elijas, para cortar exacto.
4. Medí el plan con medir_plan y corregí los errores y avisos que tengan sentido.
5. Entregalo con entregar_plan. Si devuelve errores, corregilos y entregá de nuevo.

Reglas de edición:
- Seguí el guion. Si una frase tiene varias tomas, elegí la completa y sin trabas; la última \
suele ser la mejor.
- Cortá pegado a la voz: entre 0,05 y 0,1 s antes de la primera palabra y después de la última.
- Sacá silencios, muletillas ("eh", "este", "o sea") y tomas falsas. Arrancá directo con el \
gancho: nada de "ahí va, ya grabo".
- Zoom lento en el gancho; zoom de golpe cada 2 o 3 cortes seguidos del mismo plano.
- Texto en pantalla de máximo 6 palabras, solo en el gancho y en 2 o 3 ideas clave.
- Usá solo tiempos que existen en las transcripciones. No calcules duraciones: para eso está \
medir_plan.
- Los clips sin audio son b-roll: usalos poco y cortos.
- En la nota de cada segmento explicá en una línea por qué elegiste ese corte.

Estilo de la marca:
<marca>
{marca}
</marca>"""

RECORDATORIO = "Todavía no entregaste el plan. Seguí con las herramientas y terminá con entregar_plan."


class ErrorAgente(Exception):
    """El agente no logró un plan válido dentro del límite de pasos."""


def lineas_de_guion(ruta: Path) -> str:
    """Texto del guion: un Guion en JSON (del comando guion) o texto libre."""
    contenido = ruta.read_text(encoding="utf-8")
    if ruta.suffix.lower() == ".json":
        guion = Guion.model_validate_json(contenido)
        lineas = []
        for escena in guion.todas_las_escenas():
            sugerido = f"  [texto en pantalla: {escena.texto_pantalla}]" if escena.texto_pantalla else ""
            lineas.append(f"{escena.texto}{sugerido}")
        return "\n".join(lineas)
    return contenido.strip()


def _pedido(guion: str | None, duracion_objetivo: float | None) -> str:
    partes = []
    if guion:
        numeradas = "\n".join(f"{i}. {linea}" for i, linea in enumerate((l for l in guion.splitlines() if l.strip()), start=1))
        partes.append(f"Guion, una línea por frase:\n{numeradas}")
    else:
        partes.append("No hay guion: armá el video con lo que se dijo en los clips, en orden de grabación.")
    if duracion_objetivo:
        partes.append(f"Duración objetivo: {duracion_objetivo:g} s.")
    partes.append("Armá el plan de edición y entregalo con entregar_plan.")
    return "\n\n".join(partes)


def armar_plan(
    proveedor: LLMProvider,
    analisis: dict[str, AnalisisClip],
    guion: str | None = None,
    marca: str = "",
    duracion_objetivo: float | None = None,
    max_pasos: int = 15,
    avisar: Callable[[str], None] | None = None,
    embedder: Embedder | None = None,
) -> PlanEdicion:
    """Corre el loop del agente y devuelve el plan que pasó la validación."""
    ctx = Contexto(analisis, duracion_objetivo, Indice(analisis, embedder))
    herramientas = definiciones()
    sistema = SISTEMA.format(marca=marca.strip() or "Sin guía de marca: ritmo ágil y cortes limpios.")
    mensajes: list[dict] = [{"role": "user", "content": _pedido(guion, duracion_objetivo)}]
    traza = proveedor.traza

    for paso in range(1, max_pasos + 1):
        respuesta = proveedor.generate_with_tools(sistema, mensajes, herramientas)
        # Se agrega la respuesta tal cual (con el razonamiento); nunca se edita lo anterior.
        mensajes.append({"role": "assistant", "content": respuesta.contenido})

        if not respuesta.llamadas:
            if avisar:
                avisar(f"paso {paso}: el modelo respondió sin usar herramientas")
            mensajes.append({"role": "user", "content": RECORDATORIO})
            continue

        resultados = []
        for llamada in respuesta.llamadas:
            if avisar:
                avisar(f"paso {paso}: {llamada.nombre}")
            inicio = time.perf_counter()
            texto, es_error = ejecutar(ctx, llamada.nombre, llamada.argumentos)
            if traza is not None:
                traza.llamada_herramienta(paso, llamada.nombre, llamada.argumentos, texto, es_error, time.perf_counter() - inicio)
            resultados.append(ResultadoHerramienta(llamada.id, texto, es_error))
        mensajes.append(proveedor.mensaje_resultados(resultados))

        if ctx.plan_entregado is not None:
            if traza is not None:
                traza.registrar("fin", pasos=paso, segmentos=len(ctx.plan_entregado.segmentos))
            return ctx.plan_entregado

    detalle = f" Último error: {ctx.ultimo_error}" if ctx.ultimo_error else ""
    if traza is not None:
        traza.registrar("fin", pasos=max_pasos, error="sin plan válido")
    raise ErrorAgente(f"El agente llegó a {max_pasos} pasos sin entregar un plan válido.{detalle}")
