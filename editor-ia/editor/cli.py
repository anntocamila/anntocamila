"""Comandos del editor: guion, analizar, editar, revisar y render."""

from pathlib import Path

import typer

app = typer.Typer(
    help="Agente de edición de video con IA: de clips y guion a un video 9:16.",
    no_args_is_help=True,
    add_completion=False,
)


def _pendiente(fase: int) -> None:
    typer.echo(f"Todavía no está implementado (fase {fase} de PLAN.md).", err=True)
    raise typer.Exit(code=1)


def _fallar(mensaje: str) -> None:
    typer.echo(mensaje, err=True)
    raise typer.Exit(code=1)


def _transcriptor():
    from editor.config import cargar_config
    from editor.ingesta import TranscriptorWhisper

    config = cargar_config()
    return TranscriptorWhisper(config.whisper_model, config.whisper_idioma, config.whisper_vocabulario)


def _analizar_clips(rutas: list[Path]) -> dict:
    """Analiza cada clip (o lo lee de la caché) e informa el resultado. Nombre -> AnalisisClip."""
    from editor.config import cargar_config
    from editor.ingesta import analizar

    cache_dir = cargar_config().cache_dir
    transcriptor = _transcriptor()
    analisis = {}
    for ruta in rutas:
        try:
            resultado, de_cache = analizar(ruta, cache_dir, transcriptor)
        except Exception as error:  # ffprobe, ffmpeg o Whisper: se informa y se corta
            _fallar(f"No se pudo analizar {ruta.name}: {error}")
        info = resultado.info
        origen = "caché" if de_cache else "analizado"
        typer.echo(
            f"{info.nombre}: {info.duracion:.1f} s, {info.ancho}x{info.alto}"
            f"{', HDR' if info.hdr else ''}{'' if info.tiene_audio else ', sin audio'}, "
            f"{len(resultado.tramos_voz)} tramos con voz, {len(resultado.frases)} frases ({origen})"
        )
        analisis[info.nombre] = resultado
    return analisis


@app.command()
def guion(
    idea: str = typer.Argument(..., help="Idea del video en una o dos frases."),
    marca: Path = typer.Option(Path("marca.md"), help="Archivo con el tono y estilo de la marca."),
    duracion: float = typer.Option(45, help="Duración objetivo en segundos."),
    salida: Path = typer.Option(Path("guion.json"), help="Guion en JSON; al lado se escribe la versión .md."),
):
    """Genera un guion desde una idea, con el tono de tu marca."""
    from editor.guion import generar_guion, guion_a_markdown
    from editor.llm.base import ErrorLLM
    from editor.llm.factory import get_provider

    if marca.is_file():
        texto_marca = marca.read_text(encoding="utf-8")
    else:
        typer.echo(f"No encontré {marca}: el guion sale con un tono neutro.", err=True)
        texto_marca = ""
    try:
        proveedor = get_provider()
    except ValueError as error:
        _fallar(str(error))

    typer.echo(f"Escribiendo el guion con {proveedor.modelo}...")
    try:
        resultado = generar_guion(proveedor, idea, texto_marca, duracion)
    except ErrorLLM as error:
        typer.echo(f"Uso: {proveedor.uso.resumen()}", err=True)
        _fallar(str(error))

    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(resultado.model_dump_json(indent=2), encoding="utf-8")
    markdown = salida.with_suffix(".md")
    markdown.write_text(guion_a_markdown(resultado), encoding="utf-8")
    typer.echo(f"Listo: {markdown} (unos {round(resultado.segundos_estimados())} s hablados)")
    typer.echo(f"Uso: {proveedor.uso.resumen()}")


@app.command()
def analizar(
    clips: Path = typer.Argument(..., help="Carpeta con los clips."),
):
    """Analiza los clips: duración, tramos con voz y transcripción por palabra (con caché)."""
    from editor.ingesta import clips_de

    if not clips.is_dir():
        _fallar(f"No existe la carpeta {clips}")
    rutas = clips_de(clips)
    if not rutas:
        _fallar(f"No hay videos en {clips}")
    _analizar_clips(rutas)


@app.command()
def editar(
    clips: Path = typer.Argument(..., help="Carpeta con los clips."),
    guion: Path = typer.Option(None, help="Guion en texto (opcional)."),
    marca: Path = typer.Option(Path("marca.md"), help="Archivo con el tono y estilo de la marca."),
):
    """Analiza los clips, arma el plan de edición y genera una vista previa."""
    _pendiente(4)


@app.command()
def revisar(
    plan: Path = typer.Option(Path("plan.json"), help="Plan de edición a revisar."),
    cambios: str = typer.Option(..., help='Cambios en lenguaje natural, por ejemplo "sacá la toma 2".'),
):
    """Aplica cambios pedidos en lenguaje natural sin volver a analizar los clips."""
    _pendiente(5)


@app.command()
def render(
    plan: Path = typer.Option(Path("plan.json"), help="Plan de edición en JSON."),
    clips: Path = typer.Option(None, help="Carpeta con los clips (por defecto, la carpeta del plan)."),
    salida: Path = typer.Option(Path("video_final.mp4"), help="Archivo de salida."),
):
    """Renderiza el video final 1080x1920 a partir de un plan."""
    from pydantic import ValidationError

    from editor.modelos import PlanEdicion, describir_error
    from editor.render import ErrorRender, renderizar

    if not plan.is_file():
        _fallar(f"No existe el plan {plan}")
    try:
        plan_validado = PlanEdicion.model_validate_json(plan.read_text(encoding="utf-8"))
    except ValidationError as error:
        _fallar(f"El plan {plan} no es válido:\n{describir_error(error)}")

    carpeta = clips or plan.parent
    palabras = None
    if plan_validado.subtitulos:
        # Los clips que no existen los informa el render con el resto de los errores.
        usados = sorted({seg.clip for seg in plan_validado.segmentos})
        analisis = _analizar_clips([carpeta / n for n in usados if (carpeta / n).is_file()])
        palabras = {nombre: a.palabras for nombre, a in analisis.items()}

    typer.echo(f"Renderizando {len(plan_validado.segmentos)} segmentos de {carpeta}...")
    try:
        renderizar(plan_validado, carpeta, salida, palabras)
    except ErrorRender as error:
        _fallar(str(error))
    typer.echo(f"Listo: {salida}")
