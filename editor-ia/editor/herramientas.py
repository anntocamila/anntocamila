"""Las 5 herramientas del agente y su despacho.

El modelo pide una herramienta con argumentos; acá se validan con Pydantic, se
ejecuta código determinístico y se devuelve JSON. Si algo falla, el error vuelve
al modelo con el dato exacto para que corrija.
"""

import json
from collections.abc import Callable
from dataclasses import dataclass, field

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from editor.indice import Indice, coseno
from editor.ingesta import AnalisisClip, Palabra
from editor.llm.base import Herramienta
from editor.modelos import PlanEdicion, describir_error, errores_de_contenido
from editor.render import FPS, cuadros

MARGEN_MAX_S = 0.25           # más aire que esto antes o después de la voz se avisa
SILENCIO_MAX_S = 0.4          # un silencio más largo dentro de un segmento se avisa
TOLERANCIA_PALABRA_S = 0.02   # cortar a menos de esto del borde de una palabra no cuenta
SIMILITUD_REPETIDA = 0.85     # dos segmentos tan parecidos son la misma frase dos veces


class ErrorHerramienta(Exception):
    """Error que vuelve al modelo como resultado de la herramienta."""


@dataclass
class Contexto:
    """Lo que las herramientas saben del proyecto y lo que el agente fue entregando."""

    analisis: dict[str, AnalisisClip]
    duracion_objetivo: float | None = None
    indice: Indice | None = None
    plan_entregado: PlanEdicion | None = None
    ultimo_error: str = ""
    _palabras: dict[str, list[Palabra]] = field(default_factory=dict)

    def __post_init__(self):
        if self.indice is None:
            self.indice = Indice(self.analisis)
        self._palabras = {nombre: a.palabras for nombre, a in self.analisis.items()}

    def clip(self, nombre: str) -> AnalisisClip:
        if nombre not in self.analisis:
            raise ErrorHerramienta(f"No existe el clip {nombre}. Clips disponibles: {', '.join(self.analisis)}")
        return self.analisis[nombre]

    def palabras_entre(self, clip: str, desde: float, hasta: float) -> list[Palabra]:
        return [p for p in self._palabras.get(clip, []) if p.fin > desde and p.inicio < hasta]


def _s(segundos: float) -> str:
    return f"{segundos:.2f}".replace(".", ",")


# ---------- argumentos ----------

class SinArgumentos(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ArgsLeer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clip: str = Field(description="Nombre del clip, como lo devuelve listar_clips")
    desde: float = Field(0, ge=0, description="Segundo desde el que leer")
    hasta: float | None = Field(None, description="Segundo hasta el que leer; vacío = hasta el final")
    con_palabras: bool = Field(False, description="Incluir cada palabra con sus tiempos, para cortar exacto")


class ArgsBuscar(BaseModel):
    model_config = ConfigDict(extra="forbid")

    frase: str = Field(min_length=1, description="Línea del guion a buscar")
    k: int = Field(3, ge=1, le=10, description="Cantidad de tomas candidatas")


class ArgsPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan: PlanEdicion


# ---------- herramientas ----------

def listar_clips(ctx: Contexto, _: SinArgumentos) -> list[dict]:
    return [
        {
            "clip": nombre,
            "duracion": round(a.info.duracion, 2),
            "formato": f"{'vertical' if a.info.alto > a.info.ancho else 'horizontal'} {a.info.ancho}x{a.info.alto}",
            "audio": a.info.tiene_audio,
            "tramos_voz": [[round(x, 2), round(y, 2)] for x, y in a.tramos_voz],
            "frases": len(a.frases),
        }
        for nombre, a in ctx.analisis.items()
    ]


def leer_transcripcion(ctx: Contexto, args: ArgsLeer) -> dict:
    clip = ctx.clip(args.clip)
    hasta = clip.info.duracion if args.hasta is None else args.hasta
    if hasta <= args.desde:
        raise ErrorHerramienta(f"hasta ({_s(hasta)}) tiene que ser mayor que desde ({_s(args.desde)})")
    frases = []
    for frase in clip.frases:
        if frase.fin <= args.desde or frase.inicio >= hasta:
            continue
        item: dict = {"inicio": frase.inicio, "fin": frase.fin, "texto": frase.texto}
        if args.con_palabras:
            item["palabras"] = [[p.texto, p.inicio, p.fin] for p in frase.palabras]
        frases.append(item)
    resultado: dict = {"clip": args.clip, "frases": frases}
    if not clip.info.tiene_audio:
        resultado["nota"] = "clip sin audio: sirve como b-roll"
    return resultado


def buscar_tomas(ctx: Contexto, args: ArgsBuscar) -> list[dict]:
    return [vars(toma) for toma in ctx.indice.buscar(args.frase, args.k)]


def _avisos(ctx: Contexto, plan: PlanEdicion) -> list[str]:
    avisos = []
    textos: list[tuple[int, str]] = []
    for i, seg in enumerate(plan.segmentos, start=1):
        if seg.clip not in ctx.analisis:
            continue
        palabras = ctx.palabras_entre(seg.clip, seg.inicio, seg.fin)
        if not palabras:
            if ctx.analisis[seg.clip].info.tiene_audio:
                avisos.append(f"segmento {i}: no tiene voz ({seg.clip} {_s(seg.inicio)}-{_s(seg.fin)})")
            continue
        for p in palabras:
            if p.inicio + TOLERANCIA_PALABRA_S < seg.inicio < p.fin - TOLERANCIA_PALABRA_S:
                avisos.append(f"segmento {i}: inicio={_s(seg.inicio)} corta la palabra «{p.texto}» ({_s(p.inicio)}-{_s(p.fin)})")
            if p.inicio + TOLERANCIA_PALABRA_S < seg.fin < p.fin - TOLERANCIA_PALABRA_S:
                avisos.append(f"segmento {i}: fin={_s(seg.fin)} corta la palabra «{p.texto}» ({_s(p.inicio)}-{_s(p.fin)})")
        antes = palabras[0].inicio - seg.inicio
        despues = seg.fin - palabras[-1].fin
        if antes > MARGEN_MAX_S:
            avisos.append(f"segmento {i}: arranca {_s(antes)} s antes de la primera palabra (en {_s(palabras[0].inicio)})")
        if despues > MARGEN_MAX_S:
            avisos.append(f"segmento {i}: termina {_s(despues)} s después de la última palabra (en {_s(palabras[-1].fin)})")
        for a, b in zip(palabras, palabras[1:]):
            if b.inicio - a.fin > SILENCIO_MAX_S:
                avisos.append(
                    f"segmento {i}: {_s(b.inicio - a.fin)} s de silencio entre «{a.texto}» y «{b.texto}» "
                    f"({_s(a.fin)}-{_s(b.inicio)}): partilo en dos"
                )
        textos.append((i, " ".join(p.texto for p in palabras)))

    vectores = [(i, texto, ctx.indice.embedder.vector(texto)) for i, texto in textos]
    for n, (i, texto, v) in enumerate(vectores):
        for j, _, w in vectores[n + 1:]:
            if coseno(v, w) >= SIMILITUD_REPETIDA:
                avisos.append(f"los segmentos {i} y {j} dicen casi lo mismo («{texto}»): quedate con una sola toma")
    return avisos


def medir_plan(ctx: Contexto, args: ArgsPlan) -> dict:
    plan = args.plan
    total = sum(cuadros(seg) for seg in plan.segmentos) / FPS
    resultado: dict = {"duracion_total": round(total, 2), "segmentos": len(plan.segmentos)}
    if ctx.duracion_objetivo:
        resultado["duracion_objetivo"] = ctx.duracion_objetivo
        resultado["diferencia"] = round(total - ctx.duracion_objetivo, 2)
    duraciones = {nombre: a.info.duracion for nombre, a in ctx.analisis.items()}
    resultado["errores"] = errores_de_contenido(plan, duraciones)
    resultado["avisos"] = _avisos(ctx, plan)
    return resultado


def entregar_plan(ctx: Contexto, args: ArgsPlan) -> dict:
    duraciones = {nombre: a.info.duracion for nombre, a in ctx.analisis.items()}
    errores = errores_de_contenido(args.plan, duraciones)
    if errores:
        raise ErrorHerramienta("El plan no se puede renderizar:\n" + "\n".join(f"- {e}" for e in errores))
    ctx.plan_entregado = args.plan
    total = sum(cuadros(seg) for seg in args.plan.segmentos) / FPS
    return {"estado": "plan recibido", "segmentos": len(args.plan.segmentos), "duracion_total": round(total, 2)}


# ---------- registro y despacho ----------

REGISTRO: dict[str, tuple[Callable, type[BaseModel], str]] = {
    "listar_clips": (
        listar_clips, SinArgumentos,
        "Lista los clips del proyecto: nombre, duración, formato, si tiene audio, tramos con voz "
        "(inicio y fin en segundos) y cantidad de frases transcriptas.",
    ),
    "leer_transcripcion": (
        leer_transcripcion, ArgsLeer,
        "Devuelve las frases de un clip entre dos segundos, con sus tiempos. Con con_palabras=true "
        "incluye cada palabra con su inicio y fin, para cortar pegado a la voz.",
    ),
    "buscar_tomas": (
        buscar_tomas, ArgsBuscar,
        "Busca las k tomas más parecidas a una línea del guion en todos los clips. Devuelve clip, "
        "inicio, fin, texto y similitud (1 = idéntica). Las tomas trabadas o incompletas dan más bajo.",
    ),
    "medir_plan": (
        medir_plan, ArgsPlan,
        "Mide un plan sin entregarlo: duración total, diferencia con el objetivo, errores que "
        "impiden renderizar y avisos (cortes en medio de una palabra, silencios largos, márgenes "
        "de más, tomas repetidas). Usala antes de entregar.",
    ),
    "entregar_plan": (
        entregar_plan, ArgsPlan,
        "Entrega el plan final. Si tiene errores los devuelve para que los corrijas; si está "
        "bien, termina el trabajo.",
    ),
}


def definiciones() -> list[Herramienta]:
    return [Herramienta(nombre, descripcion, modelo.model_json_schema()) for nombre, (_, modelo, descripcion) in REGISTRO.items()]


def ejecutar(ctx: Contexto, nombre: str, argumentos: dict) -> tuple[str, bool]:
    """Valida los argumentos, corre la herramienta y devuelve (resultado en JSON, si es error)."""
    try:
        if nombre not in REGISTRO:
            raise ErrorHerramienta(f"No existe la herramienta {nombre}. Disponibles: {', '.join(REGISTRO)}")
        funcion, modelo_args, _ = REGISTRO[nombre]
        try:
            args = modelo_args.model_validate(argumentos)
        except ValidationError as error:
            raise ErrorHerramienta(f"Argumentos inválidos para {nombre}:\n{describir_error(error)}")
        return json.dumps(funcion(ctx, args), ensure_ascii=False), False
    except ErrorHerramienta as error:
        ctx.ultimo_error = f"{nombre}: {error}"
        return str(error), True
