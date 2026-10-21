"""Proveedor de Claude con el SDK oficial de Anthropic."""

import anthropic

from editor.llm.base import ErrorLLM, LLMProvider, Respuesta

MODELO_POR_DEFECTO = "claude-opus-5-5"

# US$ por millón de tokens (entrada, salida). Si el modelo no está, el costo queda desconocido.
TARIFAS = {
    "claude-opus-5-5": (4.00, 20.00),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-haiku-5-5": (0.10, 0.50),
}

# La API de salidas estructuradas no acepta estas restricciones: se sacan del esquema,
# se cuentan en la descripción para que el modelo las respete, y las valida Pydantic.
_RESTRICCIONES = {
    "minLength": "mínimo {} caracteres",
    "maxLength": "máximo {} caracteres",
    "minimum": "mínimo {}",
    "maximum": "máximo {}",
    "exclusiveMinimum": "mayor que {}",
    "exclusiveMaximum": "menor que {}",
    "multipleOf": "múltiplo de {}",
    "maxItems": "máximo {} elementos",
}


def esquema_compatible(esquema):
    """Adapta el JSON Schema de Pydantic a lo que aceptan las salidas estructuradas."""
    if isinstance(esquema, list):
        return [esquema_compatible(x) for x in esquema]
    if not isinstance(esquema, dict):
        return esquema
    limpio, notas = {}, []
    for clave, valor in esquema.items():
        if clave in _RESTRICCIONES:
            notas.append(_RESTRICCIONES[clave].format(valor))
        elif clave == "minItems" and valor > 1:
            notas.append(f"mínimo {valor} elementos")
        elif clave == "properties":
            limpio[clave] = {nombre: esquema_compatible(v) for nombre, v in valor.items()}
        else:
            limpio[clave] = esquema_compatible(valor)
    if notas:
        descripcion = limpio.get("description", "")
        limpio["description"] = f"{descripcion} ({', '.join(notas)})".strip()
    if limpio.get("type") == "object":
        limpio["additionalProperties"] = False
    return limpio


class ProveedorAnthropic(LLMProvider):
    nombre = "anthropic"

    def __init__(
        self,
        modelo: str = "",
        esfuerzo: str = "medium",
        max_reintentos: int = 3,
        max_correcciones: int = 3,
        max_tokens: int = 16000,
    ):
        super().__init__(modelo or MODELO_POR_DEFECTO, max_correcciones)
        self.esfuerzo = esfuerzo
        self.max_tokens = max_tokens
        # La clave sale de ANTHROPIC_API_KEY (o de `ant auth login`); nunca del código.
        # El SDK reintenta solo los errores de red, 429 y 5xx con backoff exponencial.
        self._cliente = anthropic.Anthropic(max_retries=max_reintentos)

    def _completar(self, system: str, mensajes: list[dict], esquema: dict | None) -> Respuesta:
        output_config: dict = {"effort": self.esfuerzo}
        if esquema is not None:
            output_config["format"] = {"type": "json_schema", "schema": esquema_compatible(esquema)}
        extra = {"system": system} if system else {}
        try:
            mensaje = self._cliente.beta.messages.create(
                model=self.modelo,
                max_tokens=self.max_tokens,
                messages=mensajes,
                output_config=output_config,
                # Si un clasificador de seguridad rechaza el pedido, la API lo reintenta en
                # el modelo de respaldo recomendado en vez de devolver el rechazo.
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                **extra,
            )
        except anthropic.AuthenticationError:
            raise ErrorLLM("La clave de Anthropic no es válida: revisá ANTHROPIC_API_KEY en .env")
        except (anthropic.CredentialsError, TypeError) as error:
            # Sin ninguna credencial, el SDK falla con un TypeError antes de mandar el pedido.
            if "authentication" not in str(error).lower():
                raise
            raise ErrorLLM("Falta la clave de Anthropic: poné ANTHROPIC_API_KEY en .env (mirá .env.example)")
        except anthropic.NotFoundError:
            raise ErrorLLM(f"El modelo {self.modelo} no existe o no está disponible para tu cuenta")
        except anthropic.APIConnectionError:
            raise ErrorLLM("No hay conexión con la API de Anthropic")
        except anthropic.APIStatusError as error:
            raise ErrorLLM(f"La API de Anthropic respondió {error.status_code}: {error.message}")

        if mensaje.stop_reason == "refusal":
            categoria = mensaje.stop_details.category if mensaje.stop_details else None
            raise ErrorLLM(f"El modelo rechazó el pedido (categoría: {categoria or 'sin categoría'})")
        if mensaje.stop_reason == "max_tokens":
            raise ErrorLLM(f"La respuesta se cortó al llegar a max_tokens={self.max_tokens}")

        texto = "".join(bloque.text for bloque in mensaje.content if bloque.type == "text")
        entrada, salida = mensaje.usage.input_tokens, mensaje.usage.output_tokens
        return Respuesta(
            texto=texto,
            contenido=mensaje.content,  # con los bloques de razonamiento, tal cual llegaron
            tokens_entrada=entrada,
            tokens_salida=salida,
            costo_usd=_costo(mensaje.model, entrada, salida),
        )


def _costo(modelo: str, entrada: int, salida: int) -> float | None:
    if modelo not in TARIFAS:
        return None
    precio_entrada, precio_salida = TARIFAS[modelo]
    return (entrada * precio_entrada + salida * precio_salida) / 1_000_000
