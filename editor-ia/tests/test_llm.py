"""Fase 3: LLMProvider, get_provider() y el ciclo generar, validar y corregir."""

import json
from types import SimpleNamespace

import pytest

from editor.config import cargar_config
from editor.llm.anthropic import ProveedorAnthropic, esquema_compatible
from editor.llm.base import ErrorLLM, ErrorSalidaInvalida, LLMProvider, Respuesta
from editor.llm.factory import get_provider
from editor.modelos import Guion, PlanEdicion, errores_de_contenido


class ProveedorGuionado(LLMProvider):
    """Devuelve respuestas escritas de antemano y guarda cada pedido."""

    nombre = "guionado"

    def __init__(self, respuestas: list[str], max_correcciones: int = 2):
        super().__init__("modelo-falso", max_correcciones)
        self.respuestas = list(respuestas)
        self.pedidos: list[dict] = []

    def _completar(self, system, mensajes, esquema):
        self.pedidos.append({"system": system, "mensajes": list(mensajes), "esquema": esquema})
        texto = self.respuestas.pop(0)
        return Respuesta(texto=texto, contenido=texto, tokens_entrada=100, tokens_salida=50, costo_usd=0.001)


def plan_json(fin: float) -> str:
    return json.dumps({"titulo": "t", "segmentos": [{"clip": "toma3.mp4", "inicio": 2.0, "fin": fin}]})


def validar_contra(duraciones: dict[str, float]):
    return lambda plan: errores_de_contenido(plan, duraciones)


# ---------- generar, validar y corregir ----------

def test_salida_valida_al_primer_intento():
    proveedor = ProveedorGuionado([plan_json(5.0)])
    plan = proveedor.generate_structured("armá el plan", PlanEdicion)
    assert plan.segmentos[0].fin == 5.0
    assert proveedor.uso.llamadas == 1
    assert proveedor.pedidos[0]["esquema"] == PlanEdicion.model_json_schema()


def test_un_plan_con_tiempos_imposibles_se_corrige_solo():
    proveedor = ProveedorGuionado([plan_json(9.1), plan_json(8.3)])
    plan = proveedor.generate_structured("armá el plan", PlanEdicion, validar=validar_contra({"toma3.mp4": 8.4}))

    assert plan.segmentos[0].fin == 8.3
    assert proveedor.uso.llamadas == 2
    # El segundo pedido lleva el intento fallido y el error con el dato exacto.
    _, intento, correccion = proveedor.pedidos[1]["mensajes"]
    assert intento == {"role": "assistant", "content": plan_json(9.1)}
    assert correccion["role"] == "user"
    assert "toma3.mp4 dura 8,4 s y pediste fin=9,1" in correccion["content"]


def test_un_error_de_estructura_tambien_vuelve_al_modelo():
    proveedor = ProveedorGuionado(["{no es json", plan_json(0.1), plan_json(3.0)])
    plan = proveedor.generate_structured("armá el plan", PlanEdicion)
    assert plan.segmentos[0].fin == 3.0
    segunda_correccion = proveedor.pedidos[2]["mensajes"][-1]["content"]
    assert "segmentos.0: cada segmento dura al menos 0,2 s" in segunda_correccion


def test_si_no_puede_corregir_falla_con_un_error_claro():
    proveedor = ProveedorGuionado([plan_json(9.1)] * 3, max_correcciones=2)
    with pytest.raises(ErrorSalidaInvalida) as error:
        proveedor.generate_structured("armá el plan", PlanEdicion, validar=validar_contra({"toma3.mp4": 8.4}))
    mensaje = str(error.value)
    assert "PlanEdicion sigue siendo inválido después de 3 intentos (2 correcciones)" in mensaje
    assert "toma3.mp4 dura 8,4 s y pediste fin=9,1" in mensaje
    assert proveedor.uso.llamadas == 3


def test_el_uso_acumula_tokens_y_costo():
    proveedor = ProveedorGuionado([plan_json(9.1), plan_json(8.0)])
    proveedor.generate_structured("x", PlanEdicion, validar=validar_contra({"toma3.mp4": 8.4}))
    assert (proveedor.uso.tokens_entrada, proveedor.uso.tokens_salida) == (200, 100)
    assert proveedor.uso.costo_usd == pytest.approx(0.002)
    assert proveedor.uso.resumen().startswith("2 llamadas, 200 tokens de entrada, 100 de salida, US$ 0.0020")


# ---------- proveedor de Anthropic (sin red: cliente falso) ----------

def mensaje_api(texto: str, stop: str = "end_turn", modelo: str = "claude-opus-5-5", detalles=None):
    return SimpleNamespace(
        content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=texto)],
        stop_reason=stop,
        stop_details=detalles,
        usage=SimpleNamespace(input_tokens=1000, output_tokens=200),
        model=modelo,
    )


class ClienteFalso:
    def __init__(self, respuestas):
        self.respuestas = list(respuestas)
        self.pedidos = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.pedidos.append({**kwargs, "messages": list(kwargs["messages"])})
        return self.respuestas.pop(0)


@pytest.fixture
def anthropic_falso(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "clave-de-prueba")

    def crear(*respuestas, **opciones):
        proveedor = ProveedorAnthropic(**opciones)
        proveedor._cliente = ClienteFalso(respuestas)
        return proveedor

    return crear


def _claves(esquema) -> set[str]:
    if isinstance(esquema, dict):
        return set(esquema) | {c for v in esquema.values() for c in _claves(v)}
    if isinstance(esquema, list):
        return {c for v in esquema for c in _claves(v)}
    return set()


def test_esquema_sin_restricciones_que_la_api_no_acepta():
    for modelo in (PlanEdicion, Guion):
        esquema = esquema_compatible(modelo.model_json_schema())
        assert not _claves(esquema) & {"maxLength", "minLength", "minimum", "maximum"}
    segmento = esquema_compatible(PlanEdicion.model_json_schema())["$defs"]["Segmento"]
    assert segmento["additionalProperties"] is False
    assert segmento["properties"]["texto"]["description"].endswith("(máximo 40 caracteres)")
    assert segmento["properties"]["inicio"]["description"].endswith("(mínimo 0)")


def test_pedido_a_la_api(anthropic_falso):
    proveedor = anthropic_falso(mensaje_api(plan_json(5.0)))
    proveedor.generate_structured("armá el plan", PlanEdicion, system="sos editor")
    pedido = proveedor._cliente.pedidos[0]
    assert pedido["model"] == "claude-opus-5-5"
    assert pedido["system"] == "sos editor"
    assert pedido["output_config"]["effort"] == "medium"
    assert pedido["output_config"]["format"] == {
        "type": "json_schema", "schema": esquema_compatible(PlanEdicion.model_json_schema())
    }
    assert pedido["fallbacks"] == "default"
    assert pedido["betas"] == ["server-side-fallback-2026-07-01"]
    assert proveedor.uso.costo_usd == pytest.approx((1000 * 4 + 200 * 20) / 1e6)


def test_la_correccion_reenvia_la_respuesta_completa(anthropic_falso):
    primera = mensaje_api(plan_json(9.1))
    proveedor = anthropic_falso(primera, mensaje_api(plan_json(8.0)))
    proveedor.generate_structured("x", PlanEdicion, validar=validar_contra({"toma3.mp4": 8.4}))
    mensajes = proveedor._cliente.pedidos[1]["messages"]
    # Se reenvían los bloques tal cual (con el de razonamiento), sin editar lo anterior.
    assert mensajes[1] == {"role": "assistant", "content": primera.content}
    assert "pediste fin=9,1" in mensajes[2]["content"]


def test_generate_sin_esquema(anthropic_falso):
    proveedor = anthropic_falso(mensaje_api("hola"))
    assert proveedor.generate("decí hola") == "hola"
    pedido = proveedor._cliente.pedidos[0]
    assert "format" not in pedido["output_config"]
    assert "system" not in pedido


def test_rechazo_y_respuesta_cortada(anthropic_falso):
    detalles = SimpleNamespace(category="cyber", explanation="")
    with pytest.raises(ErrorLLM, match="rechazó el pedido \\(categoría: cyber\\)"):
        anthropic_falso(mensaje_api("", stop="refusal", detalles=detalles)).generate("x")
    with pytest.raises(ErrorLLM, match="max_tokens=16000"):
        anthropic_falso(mensaje_api('{"titulo": "t", "seg', stop="max_tokens")).generate("x")


def test_modelo_sin_tarifa_conocida(anthropic_falso):
    proveedor = anthropic_falso(mensaje_api("hola", modelo="claude-otro"), modelo="claude-otro")
    proveedor.generate("x")
    assert "costo desconocido" in proveedor.uso.resumen()


# ---------- get_provider() ----------

def test_get_provider_lee_el_env(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "clave-de-prueba")
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("LLM_MODEL", "claude-sonnet-5-5")
    monkeypatch.setenv("LLM_ESFUERZO", "low")
    monkeypatch.setenv("LLM_MAX_CORRECCIONES", "1")
    proveedor = get_provider()
    assert isinstance(proveedor, ProveedorAnthropic)
    assert (proveedor.modelo, proveedor.esfuerzo, proveedor.max_correcciones) == ("claude-sonnet-5-5", "low", 1)


def test_get_provider_modelo_por_defecto(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "clave-de-prueba")
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    assert get_provider().modelo == "claude-opus-5-5"


def test_proveedor_no_implementado(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    with pytest.raises(ValueError, match="'gemini' no está implementado todavía"):
        get_provider(cargar_config())


def test_sin_credenciales_da_un_error_claro(anthropic_falso):
    proveedor = anthropic_falso()

    def sin_clave(**kwargs):
        raise TypeError('"Could not resolve authentication method. Expected one of api_key, ..."')

    proveedor._cliente.beta.messages.create = sin_clave
    with pytest.raises(ErrorLLM, match="Falta la clave de Anthropic"):
        proveedor.generate("x")
