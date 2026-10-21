"""Salidas estructuradas: el plan de edición (contrato con el render) y el guion."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

# Margen para errores de redondeo al comparar contra la duración real del clip.
TOLERANCIA_S = 0.01

# Ritmo de habla para estimar la duración de un guion (unas 160 palabras por minuto).
PALABRAS_POR_SEGUNDO = 2.7
MAX_PALABRAS_PANTALLA = 6
MAX_IDEAS_CON_TEXTO = 3


class Segmento(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clip: str = Field(description="Nombre del archivo del clip")
    inicio: float = Field(ge=0, description="Segundo del clip donde empieza el corte")
    fin: float = Field(description="Segundo del clip donde termina el corte")
    zoom: Literal["ninguno", "golpe", "lento"] = "ninguno"
    texto: str = Field("", max_length=40, description="Texto en pantalla; vacío si no lleva")
    nota: str = Field("", max_length=120, description="Por qué este corte, en una línea")

    @model_validator(mode="after")
    def largo_minimo(self):
        if self.fin - self.inicio < 0.2:
            raise ValueError("cada segmento dura al menos 0,2 s")
        return self

    @property
    def duracion(self) -> float:
        return self.fin - self.inicio


class PlanEdicion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    titulo: str = Field(max_length=60)
    segmentos: list[Segmento] = Field(min_length=1)
    subtitulos: bool = True


class Escena(BaseModel):
    model_config = ConfigDict(extra="forbid")

    texto: str = Field(description="Lo que se dice a cámara, palabra por palabra")
    plano: str = Field(description="Cómo se graba: primer plano, plano medio, pantalla, b-roll...")
    texto_pantalla: str = Field(
        "", max_length=40, description="Texto en pantalla de hasta 6 palabras; vacío si no lleva"
    )

    @field_validator("texto_pantalla")
    @classmethod
    def pocas_palabras(cls, valor: str) -> str:
        if len(valor.split()) > MAX_PALABRAS_PANTALLA:
            raise ValueError(f"el texto en pantalla tiene máximo {MAX_PALABRAS_PANTALLA} palabras")
        return valor


class Guion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    titulo: str = Field(max_length=60)
    gancho: Escena = Field(description="Los primeros 3 segundos: la frase que frena el scroll")
    escenas: list[Escena] = Field(min_length=1, description="El desarrollo, una escena por idea")
    cierre: Escena = Field(description="Remate y llamado a la acción")
    tomas: list[str] = Field(min_length=1, description="Lista de tomas para grabar, en orden")
    copy_posteo: str = Field(max_length=2200, description="Texto del posteo, con hashtags al final")

    def todas_las_escenas(self) -> list[Escena]:
        return [self.gancho, *self.escenas, self.cierre]

    def palabras_habladas(self) -> int:
        return sum(len(escena.texto.split()) for escena in self.todas_las_escenas())

    def segundos_estimados(self) -> float:
        return self.palabras_habladas() / PALABRAS_POR_SEGUNDO


def describir_error(error: ValidationError) -> str:
    """Una línea por error, con la ubicación en el plan: 'segmentos.2.fin: ...'."""
    lineas = []
    for detalle in error.errors():
        ubicacion = ".".join(str(parte) for parte in detalle["loc"]) or "plan"
        mensaje = detalle["msg"].removeprefix("Value error, ")
        lineas.append(f"{ubicacion}: {mensaje}")
    return "\n".join(lineas)


def errores_de_guion(guion: Guion, duracion_objetivo: float, tolerancia: float = 0.25) -> list[str]:
    """Valida el guion contra la duración objetivo y las reglas de texto en pantalla.

    Las cuentas las hace el código: el modelo recibe el número exacto para corregir.
    """
    errores = []
    estimado = guion.segundos_estimados()
    palabras = guion.palabras_habladas()
    objetivo_palabras = round(duracion_objetivo * PALABRAS_POR_SEGUNDO)
    if estimado > duracion_objetivo * (1 + tolerancia):
        errores.append(
            f"el guion tiene {palabras} palabras habladas (unos {_num(round(estimado))} s) y el "
            f"objetivo es {_num(duracion_objetivo)} s: recortá a unas {objetivo_palabras} palabras"
        )
    elif estimado < duracion_objetivo * (1 - tolerancia):
        errores.append(
            f"el guion tiene {palabras} palabras habladas (unos {_num(round(estimado))} s) y el "
            f"objetivo es {_num(duracion_objetivo)} s: alargalo a unas {objetivo_palabras} palabras"
        )
    con_texto = sum(1 for escena in guion.escenas if escena.texto_pantalla.strip())
    if con_texto > MAX_IDEAS_CON_TEXTO:
        errores.append(
            f"hay texto en pantalla en {con_texto} escenas del desarrollo: dejalo solo en "
            f"{MAX_IDEAS_CON_TEXTO} como máximo, en las ideas clave"
        )
    return errores


def _num(valor: float) -> str:
    """Formatea segundos con coma decimal: 8.4 -> '8,4'."""
    return f"{valor:.2f}".rstrip("0").rstrip(".").replace(".", ",")


def errores_de_contenido(plan: PlanEdicion, duraciones: dict[str, float]) -> list[str]:
    """Valida el plan contra el inventario real de clips (nombre -> duración en s).

    Devuelve una lista de errores concretos, pensados para volver al agente tal cual.
    """
    errores = []
    for i, seg in enumerate(plan.segmentos, start=1):
        if seg.clip not in duraciones:
            errores.append(f"segmento {i}: no existe el clip {seg.clip}")
            continue
        duracion = duraciones[seg.clip]
        if seg.fin > duracion + TOLERANCIA_S:
            errores.append(
                f"segmento {i}: {seg.clip} dura {_num(duracion)} s y pediste fin={_num(seg.fin)}"
            )
    return errores
