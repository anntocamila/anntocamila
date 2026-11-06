# Brief: Prefoundly AI para pagos internacionales

Para: el equipo y el Claude de Nico, repo `nicoespa/hackatwin-treasury`.
Fecha: 6-11-2026. Presentación: 7-11-2026.
Nombre: Prefoundly AI.

Marcamos cada punto como **Decidido** u **Opción**. Las opciones son ideas para discutir, no tareas cerradas.

## 1. Qué es

**Decidido.** Lo presentamos como un **producto financiero**, no como "un agente de IA".

> Prefoundly AI es tesorería predictiva para fintechs que hacen pagos internacionales. Calcula cuánta plata dejar adelantada en cada partner y la envía sola, dentro de límites.

Por dentro combina cuatro piezas, y el valor está en la combinación:

1. **Segmentación de usuarios** con K-means: descubre grupos por cómo se comportan.
2. **Pronóstico** con LightGBM: cuánto va a salir por cada partner, día por día, por grupo.
3. **Escenarios** con Monte Carlo: miles de futuros posibles, incluidos los días en que todos se mueven juntos.
4. **Política de reposición** y **agente que ejecuta**: una regla decide el monto y el agente lo envía y lo explica.

Cómo nombrarlo: "política de reposición bajo incertidumbre", no "optimización". Hoy el nivel de protección y la frecuencia los fijamos nosotros. Ver la opción 3.6 si queremos poder decir "optimización".

## 2. El problema

**Decidido.** El planteo es general, sin depender de un país ni de un sistema de pagos:

- Cuando un usuario paga en otro país, alguien en ese país tiene que pagarle al comercio en su moneda. Ese "alguien" es un partner.
- Para que el partner pueda pagar en el momento, la fintech le deja plata adelantada. Eso es el prefondeo.
- Si deja de menos, el pago falla. Si deja de más, la plata queda parada en otra moneda y puede perder valor.
- Hoy se decide con una regla fija de "X días de gasto".

Lo que podemos contar de la entrevista con Juanma (30-10, según el resumen; en el pitch decir "según nuestra entrevista", sin comillas):

- Cada función tiene su partner y su prefondeo.
- Los partners se fondean cada 1, 2 o 3 días.
- Lo internacional es lo más caro: va por transferencia bancaria, tarda hasta 48 horas y no funciona 24/7.
- Con stablecoin se mueve 24/7 y las necesidades de fondos se acortan.
- Es un negocio de poco margen: cualquier ahorro de capital pesa.

No atribuirle: cuantiles, LightGBM, el agente, ejemplos semanales, montos en dólares, ni lo de otras fintechs usando stablecoins (el audio no deja confirmar quiénes).

**Ejemplo opcional para Belo** (hipótesis, no dato): un usuario argentino paga con un QR de Pix en Brasil. El comercio cobra en reales y la fintech necesita reales disponibles en el partner que paga ahí. Usarlo como "por ejemplo" y preguntarles cómo lo manejan.

## 3. Qué hay que cambiar en el modelo

En orden de prioridad.

### 3.1 Partners internacionales, rieles y frecuencia (Decidido)

- **Partners** (`config/partners.yaml`). Ejemplo de destinos, todos hipótesis a validar: un pagador en Brasil (reales), uno en Estados Unidos (dólares), remesas y una red de tarjetas internacional. Cada partner suma `currency`, `calendar`, `replenish_every_days` y `min_balance` (0 por defecto).
- **Rieles** (`config/rails.yaml`). Transferencia internacional: 48 horas hábiles, sin fines de semana, con horario de corte. Stablecoin: 24/7, unos 30 minutos más la conversión, costo 0,10 % (supuesto).
- **Frecuencia de reposición por partner: 1, 2 o 3 días.** Es una **variable de decisión que fijamos nosotros**, no la optimiza el modelo. En `policy.py`, `review_times` y `next_review` pasan a calcularse por partner. La ventana a cubrir es la demora del riel más esa frecuencia.

### 3.2 Agente que ejecuta solo, con límites (Decidido)

Reemplazar la cola de aprobación (`agent/queue.py`, `agent/tools.py`) por **ejecución simulada**:

- `execute_transfer`: registra la orden en un libro que no se puede editar y actualiza el saldo del partner cuando la plata llega.
- Topes por transferencia y por día, por partner. Si un monto pasa el tope, se ejecuta el tope y se genera una alerta.
- Solo partners autorizados y una orden por partner y por reposición.
- **Corte de emergencia:** si el error del pronóstico o la chance de quedarse corto pasan un umbral, vuelve a la regla fija conservadora y avisa.
- El LLM no decide montos: escribe la explicación de cada orden.
- Sin plata real ni conexión con bancos.

### 3.3 Segmentación con K-means (Decidido)

En la vida real los datos no vienen etiquetados por tipo de usuario.

1. El simulador sigue generando usuarios desde arquetipos, pero **la etiqueta queda oculta**: sirve solo para validar.
2. Variables por usuario, sobre la ventana de entrenamiento: volumen mensual (log), participación de cada producto o partner, transacciones por día, ticket promedio (log), concentración en los días de cobro, participación de fin de semana, sensibilidad al tipo de cambio y participación de pagos recurrentes.
3. K-means sobre variables estandarizadas, semilla fija. Elegir k entre 3 y 10 por silhouette, y reportar también k = cantidad de arquetipos.
4. Validar contra la verdad oculta con el **ARI** (Adjusted Rand Index).
5. El cluster reemplaza a `segment` en `SegmentLGBM`. Usuarios con poca historia van a un cluster "nuevo".
6. Ablación: cobertura del intervalo del 90 % con clusters, con arquetipos verdaderos y sin segmentar. Hoy el modelo segmentado cubre 89 % y los demás entre 73 % y 80 %.

Aclarar en el pitch que en datos simulados los grupos salen más limpios que en la realidad.

### 3.4 Tipo de cambio (Decidido: como costo y estrés)

- Trayectorias de ARS/USD y BRL/USD con variación diaria y saltos. Reutilizar el escenario `FxJump`.
- Los grupos sensibles al tipo de cambio mueven su volumen en días de salto.
- Reportar la **pérdida por tipo de cambio** de la plata adelantada en otra moneda.
- Todo en **USD**.
- No optimizar cuánto tener de cada moneda.

### 3.5 Calendarios por país y arquetipos internacionales (Decidido, si da el tiempo)

- Hoy hay un solo calendario (`config/calendar_ar.yaml`). Hace falta uno por país y que cada partner use el suyo.
- Arquetipos de ejemplo, hipótesis: freelancer que cobra del exterior, viajero, pyme importadora, remitente y ahorrista en dólares o cripto.
- En `simulate/events.py` hay efectos fijos en el código (`PAYDAY_PRODUCTS`, `ANSES_PRODUCTS`, `SAC_PRODUCTS`). Pasarlos a la config por arquetipo.

### 3.6 Elegir el nivel de protección por costos (Opción)

Si queremos decir "optimización": que el sistema elija el nivel de protección comparando el costo de la plata parada con el costo de un pago rechazado. Los dos costos ya están en `config/policy.yaml` (`cost_of_capital_annual`, `cost_per_usd_rejected`). Es la regla del fractil crítico. Hoy el 99 % está fijo.

## 4. Las variables

| Tipo | Cuáles | Quién las fija |
| --- | --- | --- |
| **Decisión** | Frecuencia por partner (1, 2 o 3 días), riel, nivel de protección, topes del agente | Nosotros, en config. Los experimentos muestran qué pasa con cada valor |
| **Parámetros** | Demora y horario de cada riel, calendario de cada país, moneda, saldo mínimo | Datos del partner. Todos son supuestos a validar |
| **Inciertas** | Cuánto sale por partner cada día, tipo de cambio, shock común, usuarios nuevos | Las modela el sistema |
| **Resultado** | Cuánto depositar en cada partner | La política de reposición |

## 5. Qué tiene que salir

Correr `treasury simulate` y `treasury experiments` con la nueva config y entregar:

1. Capital inmovilizado en **USD**: regla fija contra Prefoundly AI, por riel, con frecuencia de 1, 2 y 3 días.
2. Días con faltante de cada política.
3. Pérdida por tipo de cambio en el escenario de salto.
4. Clusters: ARI, descripción de cada grupo y ablación de cobertura.
5. `reports/demo/day.json` para la demo.
6. `uv run pytest -q` pasa, semillas fijas, README actualizado.

Campos mínimos de `day.json`:

```json
{
  "as_of": "2026-10-26",
  "partners": [
    {"id": "partner_brl", "currency": "BRL", "forecast_tomorrow": {"p50": 0, "p90": 0},
     "deposit": 0, "rail": "stablecoin", "sent_at": "...", "lands_at": "...",
     "guardrail": "dentro de tope", "rationale": "..."}
  ],
  "clusters": [{"id": 0, "share": 0.0, "label": "...", "traits": ["..."]}],
  "fx_stress": {"before": {}, "after": {}, "fx_loss_usd": 0},
  "results": {"fixed_usd": 0, "prefoundly_usd": 0, "shortfall_days": 0}
}
```

## 6. Cómo lo vamos a presentar

### Estructura del pitch

1. **El producto.** "Prefoundly AI: tesorería predictiva para pagos internacionales. Calcula cuánta plata dejar en cada partner y la envía sola."
2. **El problema.** El planteo general de la sección 2, con lo de Juanma.
3. **Por qué ahora.** Las redes de tarjetas ya liquidan en stablecoin, el negocio tiene poco margen y la plata en otra moneda tiene riesgo.
4. **Cómo funciona por dentro.** Las cuatro piezas de la sección 1, en una lámina.
5. **Resultados.** Los números nuevos en USD. Si no están, los actuales como "ejemplo en una billetera local".
6. **Demo.** Un día del sistema (ver abajo).

### Demo

No corre en vivo: lee `day.json`.

1. **"Mañana vas a tener que pagar esto":** pronóstico por partner para el día siguiente. Es el desafío que planteó Juanma.
2. **Lo que hizo el agente solo:** monto, riel, hora de envío, cuándo llega y qué tope aplicó.
3. **Los grupos que encontró:** tamaño y comportamiento de cada uno.
4. **Estrés:** salto del tipo de cambio y cómo cambian el pronóstico, los depósitos y la pérdida.
5. **Resultado:** regla fija contra Prefoundly AI en USD.

### Tracks (Opción: confirmado que se puede participar en más de uno)

| Track | Qué mira el jurado | Qué mostramos | Qué falta |
| --- | --- | --- | --- |
| **Fintech (Belo)**, principal | Producto financiero que resuelve un problema real | El producto entero y el caso de pagos internacionales | Nada esencial |
| **AI (Vercel y Firecrawl)** | "No human in the loop" | El agente que ejecuta solo, con topes y corte de emergencia | 3.2 implementado |
| **Stablecoins (Twin Finance)** | Stablecoins y pagos onchain | El ahorro con stablecoin como riel, y la comparación contra la transferencia bancaria | Nada onchain: la stablecoin es un supuesto de la simulación. Es el track más débil; decidir si participan |

### Qué no decir

- Que los números son ahorros reales: son simulados.
- Que sabemos cómo opera Belo: son hipótesis.
- Que el modelo "predice mejor": lo que hace mejor es medir el riesgo.
- Que hay optimización, salvo que se haga la opción 3.6.
- Que el agente decide cuánta plata mover: lo decide la regla, el agente la ejecuta y la explica.

## 7. Validaciones pendientes

**Con el CPO de Prex** (planteo del problema):

1. ¿Cómo deciden hoy cuánto prefondear y cada cuánto?
2. ¿De qué depende que un partner se reponga cada 1, 2 o 3 días?
3. ¿Hay saldos mínimos, colateral o reservas obligatorias?
4. ¿Lo internacional va por transferencia bancaria, con hasta 48 horas y sin operar 24/7?
5. ¿Qué harían con la plata que quedara libre, y a qué tasa?
6. ¿Cuánto cuesta un pago rechazado, y qué nivel de seguridad aceptan?

**Con Belo** (en la presentación): ¿dejan plata adelantada en cada destino? ¿Cuánto tarda y cuánto cuesta tener stablecoin usable en moneda local? ¿Cómo manejan el riesgo de cambio?

## 8. Orden y corte

1. Partners, rieles y frecuencia por partner (3.1).
2. Agente que ejecuta solo (3.2).
3. K-means (3.3).
4. Tipo de cambio (3.4).
5. Calendarios y arquetipos (3.5).
6. Opción: nivel de protección por costos (3.6).

Fijar una hora de corte. Si para entonces no hay una corrida completa con tests pasando, se presenta el modelo actual como "ejemplo en una billetera local" y lo internacional como diseño, sin porcentajes nuevos.
