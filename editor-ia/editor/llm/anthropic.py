"""Proveedor de Claude con el SDK oficial de Anthropic."""

import anthropic

from editor.llm.base import ErrorLLM, Herramienta, LlamadaHerramienta, LLMProvider, Respuesta, ResultadoHerramienta

MODELO_POR_DEFECTO = "claude-opus-5-5"

# US$ por millón de tokens: (entrada, salida, lectura de caché). Escribir en caché cuesta
# 1,25 veces la entrada. Si el modelo no está, el costo queda desconocido.
TARIFAS = {
    "claude-opus-5-5": (4.00, 20.00, 0.20),
    "claude-sonnet-5-5": (2.00, 10.00, 0.20),
    "claude-haiku-5-5": (0.10, 0.50, 0.01),
}
RECARGO_ESCRITURA_CACHE = 1.25

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


def sin_referencias(esquema: dict) -> dict:
    """Reemplaza cada $ref por su definición (los esquemas de herramientas van autocontenidos)."""
    definiciones = esquema.get("$defs", {})

    def resolver(nodo):
        if isinstance(nodo, list):
            return [resolver(x) for x in nodo]
        if not isinstance(nodo, dict):
            return nodo
        if "$ref" in nodo:
            return resolver(definiciones[nodo["$ref"].split("/")[-1]])
        return {clave: resolver(valor) for clave, valor in nodo.items() if clave != "$defs"}

    return resolver(esquema)


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

    def _completar(
        self,
        system: str,
        mensajes: list[dict],
        esquema: dict | None,
        herramientas: list[Herramienta] | None = None,
    ) -> Respuesta:
        output_config: dict = {"effort": self.esfuerzo}
        if esquema is not None:
            output_config["format"] = {"type": "json_schema", "schema": esquema_compatible(esquema)}
        extra: dict = {"system": system} if system else {}
        if herramientas:
            extra["tools"] = [
                {
                    "name": h.nombre,
                    "description": h.descripcion,
                    "input_schema": sin_referencias(esquema_compatible(h.esquema)),
                }
                for h in herramientas
            ]
            # El loop reenvía toda la conversación en cada paso: con caché, cada pedido
            # paga entero solo lo que se agregó desde el paso anterior.
            extra["cache_control"] = {"type": "ephemeral"}
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
        llamadas = [
            LlamadaHerramienta(id=bloque.id, nombre=bloque.name, argumentos=dict(bloque.input or {}))
            for bloque in mensaje.content
            if bloque.type == "tool_use"
        ]
        uso = mensaje.usage
        entrada, salida = uso.input_tokens, uso.output_tokens
        leidos = uso.cache_read_input_tokens or 0
        escritos = uso.cache_creation_input_tokens or 0
        return Respuesta(
            texto=texto,
            contenido=mensaje.content,  # con los bloques de razonamiento, tal cual llegaron
            tokens_entrada=entrada,
            tokens_salida=salida,
            costo_usd=_costo(mensaje.model, entrada, salida, leidos, escritos),
            tokens_cache_leidos=leidos,
            tokens_cache_escritos=escritos,
            llamadas=llamadas,
            motivo_fin=mensaje.stop_reason or "",
        )

    def mensaje_resultados(self, resultados: list[ResultadoHerramienta]) -> dict:
        # Todos los resultados van juntos en un solo turno, como pide la API.
        return {
            "role": "user",
            "content": [
                {"type": "tool_result", "tool_use_id": r.id, "content": r.texto, "is_error": r.es_error}
                for r in resultados
            ],
        }


def _costo(modelo: str, entrada: int, salida: int, leidos: int = 0, escritos: int = 0) -> float | None:
    if modelo not in TARIFAS:
        return None
    precio_entrada, precio_salida, precio_cache = TARIFAS[modelo]
    return (
        entrada * precio_entrada
        + escritos * precio_entrada * RECARGO_ESCRITURA_CACHE
        + leidos * precio_cache
        + salida * precio_salida
    ) / 1_000_000
