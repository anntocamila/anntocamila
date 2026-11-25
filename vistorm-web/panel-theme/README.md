# Tema Vistorm para el panel

El panel (`inbyra-panel`, Vite + React + Supabase) define sus colores y tipografías con variables CSS (`--bg`, `--surface`, `--accent`, `--c1`…`--c6`, `--t-*`). `vistorm-panel-theme.css` las reemplaza por la paleta de Vistorm Labs en modo claro y oscuro y pone los títulos `h1` y `h2` en Fraunces.

## Cómo aplicarlo

1. Copiar `vistorm-panel-theme.css` a `src/styles/` del repo del panel.
2. Importarlo **después** del CSS actual, al final de `src/main.tsx`:

   ```ts
   import './styles/vistorm-panel-theme.css';
   ```

3. Lo que el CSS no puede cambiar y hay que hacer en el código:
   - Reemplazar el logo «I Inbyra» por el símbolo `02-Simbolo/color.svg` (o `negativo.svg` sobre fondo oscuro) y el texto «Vistorm Labs».
   - Cambiar `<title>Inbyra Vision</title>` en `index.html` y los textos que digan «Inbyra».
   - Reemplazar el favicon por los de `03-Iconos` de la identidad nueva.
   - Revisar textos que muestren pesos, ventas o conversión en plata: la marca mide en personas y en tiempo.
4. En Vercel, cargar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`: hoy el panel publicado no las tiene. La clave anónima de Supabase es pública por diseño, pero solo es segura si todas las tablas tienen Row Level Security activado.

## Colores

| Uso | Claro | Oscuro |
| --- | --- | --- |
| Fondo | perla `#F4F2F1` | `#1E191B` |
| Tarjetas | `#FBFAF9` | carbón `#272124` |
| Acento (botones, foco, período actual) | granate `#542433` | `#C98A9A` |
| Serie 2: actividad | cobre `#C1774B` | `#D18A5E` |
| Series 3 y 4: comparación | petróleo `#2F5D5A`, verde agua `#8FB5AE` | `#6FA39D`, `#8FB5AE` |
| Texto | carbón `#272124` | `#E9E3DE` |
