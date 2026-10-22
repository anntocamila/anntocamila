# Casos de evaluación

Cada caso es una carpeta con un `caso.json`. Los dos `ejemplo_*` son sintéticos
(sin video) y sirven para ver el formato; los casos que importan son 6 a 10
proyectos tuyos de verdad.

## Formato de `caso.json`

```json
{
  "descripcion": "Gancho grabado 3 veces, una trabada",
  "clips": "clips",
  "guion": "guion.txt",
  "duracion_objetivo": 30,
  "tomas_esperadas": [
    {"linea": 1, "clip": "IMG_0412.MOV", "inicio": 12.4, "fin": 15.1},
    {"linea": 2, "clip": "IMG_0413.MOV", "inicio": 3.0, "fin": 6.2}
  ],
  "retoques": 2
}
```

- `clips`: carpeta con los videos, relativa al caso (o una ruta absoluta). Con
  clips se miden también los silencios que quedaron en el video.
- `analisis`: en vez de `clips`, un `proyecto.json` de `editar` (así se puede
  evaluar sin los videos, pero sin medir silencios).
- `guion`: opcional. Sin guion no se mide la cobertura.
- `tomas_esperadas`: la toma que marcaste a mano para cada línea del guion (o
  para cada frase, si no hay guion). Los tiempos los sacás de `python -m editor
  analizar` o mirando el clip.
- `retoques`: cuántos cambios tuviste que pedir antes de publicar. Si no lo
  ponés y en la carpeta hay un `proyecto.json` de `editar`, se cuentan los
  `revisar` que hiciste.
- `plan.json`: opcional, para la estrategia `guardado`.

## Casos que tiene que cubrir el dataset

- Una frase grabada 3 veces, con una toma trabada
- Un video con guion y otro sin guion
- Clips con silencios largos y muletillas
- Mezcla de clips horizontales y verticales
- Un clip sin audio usado como b-roll
- Un guion con jerga tech en inglés (prompt, deck, sprint)

Cada video real que tengas que corregir mucho es un caso nuevo para el dataset.
