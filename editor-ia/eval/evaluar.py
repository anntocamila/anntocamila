"""Evaluación (fase 6): corre cada caso de eval/proyectos y mide calidad, costo y latencia.

    python -m eval.evaluar                          # estrategia básica, sin LLM (gratis)
    python -m eval.evaluar --estrategia guardado    # el plan.json de cada caso (gratis)
    python -m eval.evaluar --estrategia agente      # corre el agente: usa la API (cuesta)
    python -m eval.evaluar --tabla                  # compara las versiones ya medidas

Cada corrida agrega una fila por caso a eval/resultados.csv y regenera eval/tabla.md
con el promedio por versión, para saber qué cambio mejoró qué.
"""

import csv
import re
import subprocess
import tempfile
import time
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, fields
from datetime import datetime
from pathlib import Path

import typer
from pydantic import BaseModel, ConfigDict

from editor.agente import armar_plan, lineas_de_guion
from editor.basico import plan_basico
from editor.config import cargar_config
from editor.indice import normalizar
from editor.ingesta import AnalisisClip, Transcriptor, TranscriptorWhisper, analizar, clips_de
from editor.modelos import PlanEdicion
from editor.render import duracion_plan, renderizar
from editor.revision import ARCHIVO_PROYECTO, Proyecto
from editor.trazas import Traza

CARPETA_EVAL = Path(__file__).resolve().parent
CARPETA_CASOS = CARPETA_EVAL / "proyectos"
RESULTADOS = CARPETA_EVAL / "resultados.csv"
TABLA = CARPETA_EVAL / "tabla.md"

COBERTURA_MINIMA = 0.8     # una línea está en el video si suenan el 80 % de sus palabras
SOLAPE_TOMA = 0.8          # la toma es la correcta si un segmento cubre el 80 % de la esperada
SILENCIO_DB, SILENCIO_MIN_S = -35, 0.4
ESTRATEGIAS = ("basica", "guardado", "agente")


class TomaEsperada(BaseModel):
    model_config = ConfigDict(extra="forbid")

    linea: int
    clip: str
    inicio: float
    fin: float


class Caso(BaseModel):
    model_config = ConfigDict(extra="forbid")

    descripcion: str = ""
    clips: str | None = None               # carpeta con los clips, relativa al caso
    analisis: str | None = None            # un proyecto.json de editar (si no hay clips)
    guion: str | None = None               # archivo de guion, relativo al caso
    duracion_objetivo: float | None = None
    tomas_esperadas: list[TomaEsperada] = []
    retoques: int | None = None            # cambios que hubo que pedir antes de publicar


@dataclass
class Resultado:
    caso: str
    toma_correcta: float | None = None
    cobertura: float | None = None
    silencios_s: float | None = None
    error_duracion_s: float | None = None
    valido_primer_intento: bool | None = None
    costo_usd: float | None = None
    tokens_entrada: int | None = None
    tokens_salida: int | None = None
    segundos: float | None = None
    retoques: int | None = None
    error: str = ""


# ---------- métricas ----------

def toma_correcta(plan: PlanEdicion, esperadas: list[TomaEsperada]) -> float | None:
    """Fracción de las tomas marcadas a mano que algún segmento cubre en su mayor parte."""
    if not esperadas:
        return None
    acertadas = sum(
        any(
            s.clip == e.clip and min(s.fin, e.fin) - max(s.inicio, e.inicio) >= SOLAPE_TOMA * (e.fin - e.inicio)
            for s in plan.segmentos
        )
        for e in esperadas
    )
    return acertadas / len(esperadas)


def cobertura(plan: PlanEdicion, guion: str | None, analisis: dict[str, AnalisisClip]) -> float | None:
    """Fracción de líneas del guion cuyas palabras suenan en el video (aunque estén repartidas)."""
    lineas = [l for l in (guion or "").splitlines() if l.strip()]
    if not lineas:
        return None
    dichas: Counter[str] = Counter()
    for seg in plan.segmentos:
        if seg.clip in analisis:
            for p in analisis[seg.clip].palabras:
                if p.inicio >= seg.inicio - 0.02 and p.fin <= seg.fin + 0.02:
                    dichas.update(normalizar(p.texto).split())
    presentes = 0
    for linea in lineas:
        sin_sugerencia = linea.split("  [texto en pantalla:")[0]
        palabras = Counter(normalizar(sin_sugerencia).split())
        if palabras and sum((palabras & dichas).values()) >= COBERTURA_MINIMA * sum(palabras.values()):
            presentes += 1
    return presentes / len(lineas)


def error_duracion(plan: PlanEdicion, objetivo: float | None) -> float | None:
    return None if not objetivo else round(abs(duracion_plan(plan) - objetivo), 2)


def silencios_en_video(video: Path) -> float:
    """Segundos de silencio de más de 0,4 s que quedaron en el video, medidos con ffmpeg."""
    resultado = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostdin", "-i", str(video), "-vn",
         "-af", f"silencedetect=noise={SILENCIO_DB}dB:d={SILENCIO_MIN_S}", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    )
    return round(sum(float(x) for x in re.findall(r"silence_duration: ([\d.]+)", resultado.stderr)), 2)


def valido_primer_intento(eventos: list[dict]) -> bool | None:
    """Según la traza: la primera vez que el agente llamó a entregar_plan, ¿pasó?"""
    entregas = [e for e in eventos if e.get("tipo") == "herramienta" and e.get("nombre") == "entregar_plan"]
    return None if not entregas else not entregas[0]["es_error"]


# ---------- un caso ----------

def _analisis(caso: Caso, carpeta: Path, transcriptor: Transcriptor | None) -> tuple[dict[str, AnalisisClip], Path | None]:
    """Análisis de los clips (de un proyecto.json o analizando con caché) y carpeta de clips."""
    clips = (carpeta / caso.clips).resolve() if caso.clips else None
    if caso.analisis:
        return Proyecto.model_validate_json((carpeta / caso.analisis).read_text(encoding="utf-8")).analisis, clips
    if clips is None:
        raise ValueError("el caso necesita 'clips' o 'analisis'")
    config = cargar_config()
    transcriptor = transcriptor or TranscriptorWhisper(config.whisper_model, config.whisper_idioma, config.whisper_vocabulario)
    return {r.name: analizar(r, config.cache_dir, transcriptor)[0] for r in clips_de(clips)}, clips


def evaluar_caso(
    carpeta: Path,
    estrategia: str,
    con_render: bool = True,
    transcriptor: Transcriptor | None = None,
    proveedor=None,
) -> Resultado:
    caso = Caso.model_validate_json((carpeta / "caso.json").read_text(encoding="utf-8"))
    resultado = Resultado(caso=carpeta.name, retoques=caso.retoques)
    inicio = time.perf_counter()
    try:
        analisis, clips = _analisis(caso, carpeta, transcriptor)
        guion = lineas_de_guion(carpeta / caso.guion) if caso.guion else None

        if estrategia == "basica":
            plan, _ = plan_basico(analisis, guion)
        elif estrategia == "guardado":
            plan = PlanEdicion.model_validate_json((carpeta / "plan.json").read_text(encoding="utf-8"))
            if (carpeta / ARCHIVO_PROYECTO).is_file() and caso.retoques is None:
                proyecto = Proyecto.model_validate_json((carpeta / ARCHIVO_PROYECTO).read_text(encoding="utf-8"))
                resultado.retoques = len(proyecto.cambios)
        else:
            if proveedor is None:
                from editor.llm.factory import get_provider

                proveedor = get_provider()
            proveedor.traza = Traza(cargar_config().trazas_dir, f"eval_{carpeta.name}")
            plan = armar_plan(proveedor, analisis, guion, duracion_objetivo=caso.duracion_objetivo,
                              max_pasos=cargar_config().agente_max_pasos)
            resultado.valido_primer_intento = valido_primer_intento(proveedor.traza.eventos)
            resultado.costo_usd = round(proveedor.uso.costo_usd, 4)
            resultado.tokens_entrada = proveedor.uso.tokens_entrada + proveedor.uso.tokens_cache_leidos + proveedor.uso.tokens_cache_escritos
            resultado.tokens_salida = proveedor.uso.tokens_salida

        resultado.toma_correcta = toma_correcta(plan, caso.tomas_esperadas)
        resultado.cobertura = cobertura(plan, guion, analisis)
        resultado.error_duracion_s = error_duracion(plan, caso.duracion_objetivo)
        if con_render and clips is not None:
            with tempfile.TemporaryDirectory(prefix="eval-") as tmp:
                palabras = {n: a.palabras for n, a in analisis.items()}
                video = renderizar(plan, clips, Path(tmp) / "video.mp4", palabras, vista_previa=True)
                resultado.silencios_s = silencios_en_video(video)
    except Exception as error:  # un caso roto no frena la evaluación de los demás
        resultado.error = f"{type(error).__name__}: {error}"
    resultado.segundos = round(time.perf_counter() - inicio, 1)
    return resultado


# ---------- resultados y tablas ----------

COLUMNAS = ["fecha", "version", "estrategia", "modelo"] + [f.name for f in fields(Resultado)]


def guardar(resultados: list[Resultado], version: str, estrategia: str, modelo: str, ruta: Path | None = None) -> None:
    ruta = ruta or RESULTADOS
    nuevo = not ruta.is_file()
    with ruta.open("a", newline="", encoding="utf-8") as archivo:
        escritor = csv.DictWriter(archivo, fieldnames=COLUMNAS)
        if nuevo:
            escritor.writeheader()
        fecha = datetime.now().strftime("%Y-%m-%d %H:%M")
        for r in resultados:
            fila = {k: ("" if v is None else v) for k, v in asdict(r).items()}
            escritor.writerow({"fecha": fecha, "version": version, "estrategia": estrategia, "modelo": modelo, **fila})


def _pct(x: float | None) -> str:
    return "–" if x is None else f"{x * 100:.0f} %"


def _num(x: float | None, decimales: int = 1, prefijo: str = "") -> str:
    return "–" if x is None else f"{prefijo}{x:.{decimales}f}".replace(".", ",")


def _promedio(valores: list[str]) -> float | None:
    numeros = [float(v == "True") if v in ("True", "False") else float(v) for v in valores if v != ""]
    return sum(numeros) / len(numeros) if numeros else None


def tabla_por_version(ruta: Path | None = None) -> str:
    """Markdown con una fila por versión: promedio de cada métrica sobre sus casos."""
    ruta = ruta or RESULTADOS
    if not ruta.is_file():
        return "Todavía no hay resultados: corré python -m eval.evaluar"
    grupos: dict[str, list[dict]] = defaultdict(list)
    with ruta.open(encoding="utf-8") as archivo:
        for fila in csv.DictReader(archivo):
            grupos[fila["version"]].append(fila)
    lineas = [
        "| versión | estrategia | modelo | casos | errores | toma correcta | cobertura | silencios (s) | "
        "error duración (s) | válido 1er intento | costo por video | tiempo por video (s) | retoques |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for version, filas in grupos.items():
        m = {c: _promedio([f[c] for f in filas]) for c in (
            "toma_correcta", "cobertura", "silencios_s", "error_duracion_s", "valido_primer_intento",
            "costo_usd", "segundos", "retoques")}
        lineas.append(
            f"| {version} | {filas[0]['estrategia']} | {filas[0]['modelo'] or '–'} | {len(filas)} | "
            f"{sum(1 for f in filas if f['error'])} | {_pct(m['toma_correcta'])} | {_pct(m['cobertura'])} | "
            f"{_num(m['silencios_s'])} | {_num(m['error_duracion_s'])} | {_pct(m['valido_primer_intento'])} | "
            f"{_num(m['costo_usd'], 4, 'US$ ')} | {_num(m['segundos'])} | {_num(m['retoques'], 1)} |"
        )
    return "\n".join(lineas)


def tabla_por_caso(resultados: list[Resultado]) -> str:
    lineas = [
        "| caso | toma correcta | cobertura | silencios (s) | error duración (s) | válido 1er intento | costo | tiempo (s) | error |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for r in resultados:
        valido = "–" if r.valido_primer_intento is None else ("sí" if r.valido_primer_intento else "no")
        lineas.append(
            f"| {r.caso} | {_pct(r.toma_correcta)} | {_pct(r.cobertura)} | {_num(r.silencios_s)} | "
            f"{_num(r.error_duracion_s)} | {valido} | {_num(r.costo_usd, 4, 'US$ ')} | {_num(r.segundos)} | {r.error or ''} |"
        )
    return "\n".join(lineas)


def _version_por_defecto(estrategia: str) -> str:
    try:
        commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        commit = "sin-git"
    return f"{commit}-{estrategia}"


# ---------- comando ----------

def main(
    estrategia: str = typer.Option("basica", help="basica (sin LLM, gratis), guardado (plan.json de cada caso, gratis) o agente (usa la API)."),
    version: str = typer.Option(None, help="Nombre de la versión que se mide (por defecto, commit y estrategia)."),
    caso: list[str] = typer.Option(None, help="Correr solo estos casos (se puede repetir)."),
    sin_render: bool = typer.Option(False, "--sin-render", help="No renderizar: más rápido, pero sin medir silencios."),
    tabla: bool = typer.Option(False, "--tabla", help="Solo mostrar la tabla por versión."),
    si: bool = typer.Option(False, "--si", help="Con la estrategia agente, no pedir confirmación."),
):
    """Mide cada caso de eval/proyectos y guarda los resultados por versión."""
    if tabla:
        typer.echo(tabla_por_version())
        return
    if estrategia not in ESTRATEGIAS:
        typer.echo(f"Estrategia desconocida: {estrategia}. Opciones: {', '.join(ESTRATEGIAS)}", err=True)
        raise typer.Exit(code=1)

    carpetas = sorted(p for p in CARPETA_CASOS.iterdir() if (p / "caso.json").is_file())
    if caso:
        carpetas = [p for p in carpetas if p.name in caso]
    if not carpetas:
        typer.echo(f"No hay casos en {CARPETA_CASOS} (cada caso es una carpeta con caso.json)", err=True)
        raise typer.Exit(code=1)

    modelo = ""
    if estrategia == "agente":
        config = cargar_config()
        modelo = config.llm_model or "claude-opus-5-5"
        typer.echo(f"La estrategia agente usa la API ({modelo}): {len(carpetas)} casos, una corrida de editar cada uno.")
        if not si and typer.prompt("¿Seguimos? [s/N]", default="n", show_default=False).strip().lower() not in {"s", "si", "sí"}:
            typer.echo("Cancelado: no se llamó a la API.")
            raise typer.Exit(code=1)

    version = version or _version_por_defecto(estrategia)
    resultados = []
    for carpeta in carpetas:
        typer.echo(f"{carpeta.name}...")
        resultados.append(evaluar_caso(carpeta, estrategia, con_render=not sin_render))

    guardar(resultados, version, estrategia, modelo)
    TABLA.write_text(f"# Métricas por versión\n\n{tabla_por_version()}\n", encoding="utf-8")
    typer.echo(f"\nVersión {version} ({estrategia})\n\n{tabla_por_caso(resultados)}\n")
    typer.echo(f"Resultados: {RESULTADOS}\nTabla por versión: {TABLA}")


if __name__ == "__main__":
    typer.run(main)
