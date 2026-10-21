"""Contrato entre el agente y el render: el plan de edición validado."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

# Margen para errores de redondeo al comparar contra la duración real del clip.
TOLERANCIA_S = 0.01


class Segmento(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clip: str                       # nombre del archivo
    inicio: float = Field(ge=0)     # segundos dentro del clip
    fin: float
    zoom: Literal["ninguno", "golpe", "lento"] = "ninguno"
    texto: str = Field("", max_length=40)   # texto en pantalla
    nota: str = Field("", max_length=120)   # por qué este corte

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


def describir_error(error: ValidationError) -> str:
    """Una línea por error, con la ubicación en el plan: 'segmentos.2.fin: ...'."""
    lineas = []
    for detalle in error.errors():
        ubicacion = ".".join(str(parte) for parte in detalle["loc"]) or "plan"
        mensaje = detalle["msg"].removeprefix("Value error, ")
        lineas.append(f"{ubicacion}: {mensaje}")
    return "\n".join(lineas)


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
