# Brief: Prefoundly AI para pagos internacionales

Para: Nico (y su Claude), repo `nicoespa/hackatwin-treasury`.
Fecha: 6-11-2026. Presentación: 7-11-2026.
Nombre del producto: Prefoundly AI (provisorio).

## 1. La idea en tres líneas

Una fintech que hace pagos internacionales tiene que dejar plata adelantada en cada partner que paga en el país de destino. Hoy decide cuánta con una regla fija de "X días de gasto". Prefoundly AI descubre cómo se comportan sus usuarios, pronostica cuánto va a salir por cada partner y ejecuta solo el depósito justo, dentro de límites.

**Aclaración sobre los partners.** Los destinos concretos (Pix en Brasil, ACH en Estados Unidos, remesas, tarjetas) son un ejemplo armado a partir de lo que Belo ofrece públicamente. No salen de la entrevista con Juanma, que habló de pagos internacionales por transferencia bancaria sin nombrar destinos. Por ejemplo, un usuario argentino que paga con un QR de Pix en Brasil: el comercio cobra en reales y la fintech necesita reales disponibles en el partner que paga ahí. Qué destinos usa Belo y cómo maneja ese saldo hay que preguntarlo, no darlo por hecho.

## 2. Cómo contar el problema

- Cada pago internacional sale de un saldo que la fintech dejó adelantado en un partner del país de destino.
- Reponer ese saldo tarda: una transferencia internacional puede tardar hasta 48 horas y no funciona de noche ni los fines de semana. Por stablecoin se mueve 24/7.
- Los partners se fondean cada 1, 2 o 3 días, cada uno con su propio prefondeo.
- Es un negocio de poco margen: cualquier capital que no queda parado pesa.
- Además, la plata adelantada está en otra moneda (reales, pesos), así que un salto del tipo de cambio la hace perder valor.

Fuente de los puntos 2 a 4: entrevista con Juanma del 30-10, según el resumen (no es transcripción). En el pitch, citarlo como "según nuestra entrevista", sin comillas. No atribuirle lo de cuantiles, LightGBM, el agente, ejemplos semanales ni montos en dólares.

Que Belo opere exactamente así es una hipótesis: hay que presentarlo como "así se aplicaría" y preguntarlo.

## 3. Las variables, separadas

| Tipo | Qué es | Quién la fija |
| --- | --- | --- |
| **Decisión** | Cada cuánto se repone cada partner (1, 2 o 3 días), por qué riel (banco o stablecoin), nivel de protección (99 %), topes del agente | Nosotros, en config. **No se optimizan.** Los experimentos muestran qué pasa con cada valor |
| **Parámetros** | Demora de cada riel, horario de corte, calendario de cada país, moneda del partner, saldo mínimo del contrato | Datos del partner, en config. Todos son supuestos a validar |
| **Inciertas** | Cuánto sale por partner cada día, tipo de cambio, shock común, usuarios nuevos | Las modela el sistema |
| **Resultado** | Cuánto depositar en cada partner en cada reposición | La regla de cuantil sobre los escenarios |

## 4. Cambio central: los tipos de usuario se descubren, no se etiquetan

Hoy el modelo usa la etiqueta `segment` que pone el simulador. En la vida real los datos no vienen etiquetados. Nuevo flujo:

1. **El simulador sigue generando usuarios desde arquetipos**, pero la etiqueta queda oculta: es la "verdad" para validar y el modelo no la ve.
2. **Variables de comportamiento por usuario**, calculadas sobre la ventana de entrenamiento:
   - volumen mensual (log) y participación de cada producto o partner;
   - transacciones por día y ticket promedio (log);
   - concentración en el cobro: participación del volumen en los días hábiles 1 a 4;
   - participación de fin de semana;
   - sensibilidad al tipo de cambio: cuánto cambia su volumen en días de salto;
   - participación de pagos recurrentes.
3. **K-means** sobre esas variables estandarizadas, con semilla fija. Elegir k entre 3 y 10 por silhouette. Reportar también k = cantidad de arquetipos.
4. **Validar contra la verdad oculta** con el Adjusted Rand Index (ARI). Es un número para el pitch: "el sistema encuentra los grupos sin etiquetas". Aclarar que en datos simulados los grupos son más limpios que en la realidad.
5. **El cluster reemplaza a `segment`** en `SegmentLGBM`. Los nodos pasan a ser cluster × producto × partner. Usuarios con poca historia van a un cluster "nuevo" hasta tener N días.
6. **Ablación:** cobertura del intervalo del 90 % con clusters, con arquetipos verdaderos y sin segmentar. Hoy el modelo segmentado cubre 89 % y los demás entre 73 % y 80 %; ver si se sostiene.
7. Opcional: que el agente le ponga nombre a cada cluster a partir de su centroide ("paga por Pix en temporada de vacaciones").

## 5. Adaptación a pagos internacionales

### Partners (`config/partners.yaml`)

Propuesta de ejemplo. Son hipótesis, no datos de Belo: los destinos y sus parámetros hay que validarlos con ellos.

| Partner | Moneda | Calendario | Riel que acepta |
| --- | --- | --- | --- |
| `pix_brl`: pagos por Pix en Brasil | BRL | Brasil | stablecoin y transferencia |
| `ach_usd`: transferencias en dólares | USD | Estados Unidos | transferencia |
| `remesas`: pagador de remesas | moneda local | destino | stablecoin y transferencia |
| `tarjeta_intl`: Visa o Mastercard | USD | Estados Unidos | stablecoin y transferencia |

Cada partner suma: `currency`, `calendar`, `replenish_every_days` (1, 2 o 3) y `min_balance` (0 por defecto).

### Rieles (`config/rails.yaml`)

- Transferencia internacional: 48 horas hábiles, sin fines de semana, con horario de corte.
- Stablecoin: 24/7, unos 30 minutos más la conversión a moneda local, con costo de 0,10 % (supuesto).

### Calendarios

Hoy hay uno solo, `config/calendar_ar.yaml`. Hace falta uno por país (Argentina, Brasil, Estados Unidos) y que cada partner use el suyo. Implica tocar `calendar.py` y los lugares que reciben un único `Calendar`.

### Arquetipos (`config/archetypes.yaml`), verdad oculta del simulador

Hipótesis para validar con Belo:

- **Freelancer:** cobra del exterior y paga en el país; picos cuando cobra.
- **Viajero:** paga por Pix en Brasil; temporada de enero y febrero, y feriados largos.
- **Pyme importadora:** paga proveedores por ACH; ciclo mensual.
- **Remitente:** manda plata a su familia; sigue el día de cobro.
- **Ahorrista en dólares o cripto:** sensible al tipo de cambio.

En `simulate/events.py` hay efectos fijos en el código (`PAYDAY_PRODUCTS`, `ANSES_PRODUCTS`, `SAC_PRODUCTS`). Hay que moverlos a la config por arquetipo: día de cobro, temporada y sensibilidad al tipo de cambio.

### Tipo de cambio

- Simular las trayectorias de ARS/USD y BRL/USD: variación diaria más saltos ocasionales. Hay que reutilizar el escenario `FxJump`.
- Efecto en la demanda: los clusters sensibles mueven su volumen en días de salto.
- Efecto en el valor: la plata adelantada en BRL o ARS pierde valor si la moneda cae. Reportar "pérdida por tipo de cambio".
- Reportar todo en **USD**.
- No optimizar cuántas monedas tener: queda como costo y escenario de estrés.

## 6. Cuánto poner (la regla no cambia)

Se mantiene la regla actual: el depósito que cubre el 99 % de los escenarios desde que llega hasta que llega la próxima reposición.

El cambio es que **la ventana sale de la frecuencia fija de cada partner**: demora del riel más `replenish_every_days`. En `policy.py`, `review_times` y `next_review` pasan a calcularse por partner.

Se mantiene la comparación contra la regla fija ajustada al mismo nivel de seguridad (`reference_matched`).

## 7. Sin humano en el circuito: el agente ejecuta

Reemplazar la cola de aprobación (`agent/queue.py`, `agent/tools.py`) por **ejecución simulada**:

- `execute_transfer`: registra la orden en un libro que no se puede editar y actualiza el saldo simulado del partner cuando la plata llega.
- **Topes:** por transferencia y por día, por partner. Si un monto pasa el tope, se ejecuta el tope y se genera una alerta.
- Solo a partners autorizados, y una orden por partner y por reposición. La cola actual ya lo hace.
- **Corte de emergencia:** si el error del pronóstico de los últimos días o la chance de quedarse corto pasan un umbral, se vuelve a la regla fija conservadora y se avisa.
- El LLM sigue sin decidir montos: solo escribe la explicación de cada orden.
- Todo simulado: no hay plata real ni conexión con bancos.

## 8. Qué tiene que salir para el pitch

Correr `treasury simulate` y `treasury experiments` con la nueva config y entregar:

1. **Capital inmovilizado en USD**, regla fija contra Prefoundly AI, por riel, con frecuencia de 1, 2 y 3 días.
2. **Días con faltante** de cada política.
3. **Pérdida por tipo de cambio** en el escenario de salto.
4. **Clusters:** ARI contra la verdad oculta, descripción de cada cluster y ablación de cobertura.
5. **`reports/demo/day.json`** para la demo (ver abajo).
6. `uv run pytest -q` pasa, las semillas son fijas y el README está actualizado.

## 9. Demo

No corre en vivo: lee `reports/demo/day.json`. Un día del sistema, con estas pantallas:

1. **"Mañana vas a tener que pagar esto"**: pronóstico por partner para el día siguiente, con su rango. Es el desafío que planteó Juanma.
2. **Lo que hizo el agente solo**: por partner, monto, riel, hora de envío, cuándo llega y qué tope aplicó.
3. **Los grupos que encontró**: cada cluster con su tamaño y su comportamiento.
4. **Estrés**: salto del tipo de cambio, y cómo cambian el pronóstico, los depósitos y la pérdida por tipo de cambio.
5. **Resultado**: regla fija contra Prefoundly AI en USD, con frecuencia de 1 y 3 días.

Campos mínimos de `day.json`:

```json
{
  "as_of": "2026-10-26",
  "partners": [
    {"id": "pix_brl", "currency": "BRL", "forecast_tomorrow": {"p50": 0, "p90": 0},
     "deposit": 0, "rail": "stablecoin", "sent_at": "...", "lands_at": "...",
     "guardrail": "dentro de tope", "rationale": "..."}
  ],
  "clusters": [{"id": 0, "share": 0.0, "label": "...", "traits": ["..."]}],
  "fx_stress": {"before": {}, "after": {}, "fx_loss_usd": 0},
  "results": {"fixed_usd": 0, "prefoundly_usd": 0, "shortfall_days": 0}
}
```

## 10. Orden y corte

En orden de prioridad:

1. Partners, rieles y frecuencia por partner.
2. Ejecución autónoma con topes.
3. K-means y su validación.
4. Tipo de cambio.
5. Calendarios por país y arquetipos internacionales.

Si a la hora de corte que fijemos no hay una corrida completa y con tests pasando, se presenta el modelo actual como "ejemplo en una billetera local" y lo internacional como diseño, sin porcentajes nuevos.

## 11. Qué no decir

- Que los números son ahorros reales: son simulados.
- Que conocemos cómo opera Belo: son hipótesis.
- Que el modelo "predice mejor": lo que hace mejor es medir el riesgo (cobertura del intervalo).
- Que el agente decide cuánta plata mover: lo decide la regla, el agente la ejecuta y la explica.
