"""Comandos del editor: guion, editar, revisar y render."""

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


@app.command()
def guion(
    idea: str = typer.Argument(..., help="Idea del video en una o dos frases."),
    marca: Path = typer.Option(Path("marca.md"), help="Archivo con el tono y estilo de la marca."),
):
    """Genera un guion desde una idea, con el tono de tu marca."""
    _pendiente(3)


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
    typer.echo(f"Renderizando {len(plan_validado.segmentos)} segmentos de {carpeta}...")
    try:
        renderizar(plan_validado, carpeta, salida)
    except ErrorRender as error:
        _fallar(str(error))
    typer.echo(f"Listo: {salida}")


def _fallar(mensaje: str) -> None:
    typer.echo(mensaje, err=True)
    raise typer.Exit(code=1)
