"""Render del plan de edición con ffmpeg: cortes, 9:16, zooms, textos y audio a -14 LUFS.

Todo el video se arma en un solo grafo de filtros (sin archivos intermedios), así
los cortes quedan exactos al cuadro y el audio no tiene huecos entre segmentos.
El audio se normaliza en dos pasadas: la primera mide, la segunda aplica.
"""

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from editor.ingesta import InfoClip, Palabra, probar
from editor.modelos import PlanEdicion, Segmento, errores_de_contenido

ANCHO, ALTO, FPS = 1080, 1920, 30
# Vista previa: la mitad de resolución y encoder rápido, para revisar antes del render final.
ANCHO_PREVIA, ALTO_PREVIA = 540, 960
AUDIO_HZ = 48000

LUFS_OBJETIVO = -14.0
PICO_MAX_DB = -1.0
RANGO_LRA = 11.0
UMBRAL_SILENCIO_LUFS = -60.0  # por debajo de esto no se normaliza (video mudo)

ZOOM_GOLPE = 1.15   # acercamiento fijo de todo el segmento
ZOOM_LENTO = 1.12   # zoom final al terminar el segmento, arrancando en 1.0
FUNDIDO_AUDIO_S = 0.01  # micro-fundido en cada borde para que no haya clics

# Clips HDR (HLG o PQ, como los de iPhone) a SDR bt709: sin esto se ven lavados.
TONEMAP_HDR = (
    "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,"
    "tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv"
)

PALABRAS_POR_BLOQUE = 3
PAUSA_ENTRE_BLOQUES_S = 0.6
COLOR_RESALTADO = "&H0000D4FF&"  # #FFD400 escrito como ASS: &H + azul, verde, rojo

FUENTE = "Inter"  # pendiente: tipografía de la marca (poner el archivo en fuentes/)
CARPETA_FUENTES = Path(__file__).resolve().parent.parent / "fuentes"


class ErrorRender(Exception):
    """El plan no se puede renderizar (clips faltantes, tiempos imposibles o falla de ffmpeg)."""


def cuadros(seg: Segmento) -> int:
    """Cantidad de cuadros del segmento a 30 fps: el tiempo real se redondea al cuadro."""
    return max(1, round(seg.duracion * FPS))


def duracion_plan(plan: PlanEdicion) -> float:
    """Duración del video final en segundos, contada en cuadros como la arma el render."""
    return sum(cuadros(seg) for seg in plan.segmentos) / FPS


def tramos_en_timeline(plan: PlanEdicion) -> list[tuple[float, float]]:
    """Inicio y fin de cada segmento dentro del video final, en segundos."""
    tramos, cuadro = [], 0
    for seg in plan.segmentos:
        n = cuadros(seg)
        tramos.append((cuadro / FPS, (cuadro + n) / FPS))
        cuadro += n
    return tramos


# ---------- textos y subtítulos (ASS) ----------

def _tiempo_ass(segundos: float) -> str:
    centesimas = round(segundos * 100)
    h, resto = divmod(centesimas, 360000)
    m, resto = divmod(resto, 6000)
    s, cs = divmod(resto, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _limpiar_texto(texto: str) -> str:
    # Llaves y barras son comandos de ASS: se sacan para que el texto salga tal cual.
    for caracter in "{}\\":
        texto = texto.replace(caracter, "")
    return " ".join(texto.split())


def _bloques(palabras: list[tuple[str, float, float]]) -> list[list[tuple[str, float, float]]]:
    """Agrupa palabras de a 3 como máximo; corta antes en pausas o al terminar una oración."""
    bloques: list[list[tuple[str, float, float]]] = []
    for palabra in palabras:
        actual = bloques[-1] if bloques else None
        if (
            actual is None
            or len(actual) == PALABRAS_POR_BLOQUE
            or palabra[1] - actual[-1][2] > PAUSA_ENTRE_BLOQUES_S
            or actual[-1][0].endswith((".", "?", "!"))
        ):
            bloques.append([palabra])
        else:
            actual.append(palabra)
    return bloques


def _eventos_subtitulos(plan: PlanEdicion, palabras_por_clip: dict[str, list[Palabra]]) -> list[str]:
    """Subtítulos palabra por palabra: se ve el bloque entero y se resalta la palabra que suena."""
    eventos = []
    for seg, (desde, hasta) in zip(plan.segmentos, tramos_en_timeline(plan)):
        # Palabras del clip que caen dentro del segmento, llevadas al tiempo del video final.
        en_video = []
        for p in palabras_por_clip.get(seg.clip, []):
            if p.fin <= seg.inicio or p.inicio >= seg.fin:
                continue
            a = desde + max(p.inicio, seg.inicio) - seg.inicio
            b = min(desde + min(p.fin, seg.fin) - seg.inicio, hasta)
            texto = _limpiar_texto(p.texto)
            if texto and b > a:
                en_video.append((texto, a, b))

        for bloque in _bloques(en_video):
            for k, (_, a, b) in enumerate(bloque):
                # Cada palabra queda resaltada hasta que arranca la siguiente del bloque.
                hasta_k = bloque[k + 1][1] if k + 1 < len(bloque) else b
                texto = " ".join(
                    f"{{\\c{COLOR_RESALTADO}}}{t}{{\\r}}" if j == k else t for j, (t, _, _) in enumerate(bloque)
                )
                eventos.append(f"Dialogue: 1,{_tiempo_ass(a)},{_tiempo_ass(hasta_k)},Subtitulo,,0,0,0,,{texto}")
    return eventos


def generar_ass(plan: PlanEdicion, palabras_por_clip: dict[str, list[Palabra]] | None = None) -> str:
    """Archivo ASS con textos en pantalla y subtítulos; vacío si no hay nada que dibujar."""
    eventos = [
        f"Dialogue: 0,{_tiempo_ass(desde)},{_tiempo_ass(hasta)},Texto,,0,0,0,,{_limpiar_texto(seg.texto)}"
        for seg, (desde, hasta) in zip(plan.segmentos, tramos_en_timeline(plan))
        if seg.texto.strip()
    ]
    if plan.subtitulos and palabras_por_clip:
        eventos += _eventos_subtitulos(plan, palabras_por_clip)
    if not eventos:
        return ""
    # Texto: arriba al centro (alineación 8). Subtítulo: abajo al centro (2), por encima
    # de la zona que tapan los botones de TikTok y Reels.
    return "\n".join([
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {ANCHO}",
        f"PlayResY: {ALTO}",
        "WrapStyle: 0",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
        "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Texto,{FUENTE},96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,"
        "-1,0,0,0,100,100,0,0,1,6,0,8,90,90,300,1",
        f"Style: Subtitulo,{FUENTE},80,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,"
        "-1,0,0,0,100,100,0,0,1,5,0,2,90,90,560,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
        *eventos,
        "",
    ])


# ---------- grafo de filtros ----------

def _par(valor: float) -> int:
    return int(round(valor / 2)) * 2


def _filtro_video(seg: Segmento, entrada: int, salida: str, hdr: bool, ancho: int, alto: int) -> str:
    n = cuadros(seg)
    pasos = [
        "setpts=PTS-STARTPTS",
        f"fps={FPS}",
        # Si el clip termina un cuadro antes de lo pedido, se repite el último.
        "tpad=stop_mode=clone:stop_duration=1",
        f"trim=end_frame={n}",
        "setpts=PTS-STARTPTS",
        # Reencuadre a 9:16: llenar 1080x1920 y recortar al centro.
        f"scale={ancho}:{alto}:force_original_aspect_ratio=increase",
        f"crop={ancho}:{alto}",
        "setsar=1",
    ]
    if hdr:
        pasos.append(TONEMAP_HDR)
    if seg.zoom == "golpe":
        pasos += [f"scale={_par(ancho * ZOOM_GOLPE)}:{_par(alto * ZOOM_GOLPE)}", f"crop={ancho}:{alto}"]
    elif seg.zoom == "lento":
        # Se agranda al doble antes de zoompan para que el movimiento no tiemble.
        pasos += [
            f"scale={ancho * 2}:{alto * 2}",
            f"zoompan=z='1+{ZOOM_LENTO - 1}*on/{max(n - 1, 1)}'"
            ":x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2'"
            f":d=1:s={ancho}x{alto}:fps={FPS}",
        ]
    pasos.append("format=yuv420p")
    return f"[{entrada}:v]{','.join(pasos)}[{salida}]"


def _filtro_audio(seg: Segmento, entrada: int, salida: str) -> str:
    duracion = cuadros(seg) / FPS
    muestras = cuadros(seg) * AUDIO_HZ // FPS
    pasos = [
        "asetpts=PTS-STARTPTS",
        f"aresample={AUDIO_HZ}",
        "aformat=sample_fmts=fltp:channel_layouts=stereo",
        "apad",
        f"atrim=end_sample={muestras}",
        f"afade=t=in:d={FUNDIDO_AUDIO_S}",
        f"afade=t=out:st={duracion - FUNDIDO_AUDIO_S:.4f}:d={FUNDIDO_AUDIO_S}",
    ]
    return f"[{entrada}:a]{','.join(pasos)}[{salida}]"


def _entradas_y_filtros(
    plan: PlanEdicion, carpeta: Path, infos: dict[str, InfoClip], con_video: bool,
    ancho: int = ANCHO, alto: int = ALTO,
) -> tuple[list[str], list[str]]:
    """Arma las entradas de ffmpeg y los filtros por segmento, más la unión final."""
    args, filtros, etiquetas = [], [], []
    indice = 0
    for i, seg in enumerate(plan.segmentos):
        # Se lee medio segundo de más para que tpad/apad no tengan que inventar nada.
        largo = cuadros(seg) / FPS + 0.5
        args += ["-ss", f"{seg.inicio:.3f}", "-t", f"{largo:.3f}", "-i", str((carpeta / seg.clip).resolve())]
        entrada_video = indice
        indice += 1
        if infos[seg.clip].tiene_audio:
            entrada_audio = entrada_video
        else:
            # Clip mudo (b-roll): se le pone silencio para que la unión tenga audio continuo.
            args += ["-f", "lavfi", "-t", f"{largo:.3f}", "-i", f"anullsrc=r={AUDIO_HZ}:cl=stereo"]
            entrada_audio = indice
            indice += 1

        if con_video:
            filtros.append(_filtro_video(seg, entrada_video, f"v{i}", infos[seg.clip].hdr, ancho, alto))
            etiquetas.append(f"[v{i}]")
        filtros.append(_filtro_audio(seg, entrada_audio, f"a{i}"))
        etiquetas.append(f"[a{i}]")

    v = 1 if con_video else 0
    filtros.append(f"{''.join(etiquetas)}concat=n={len(plan.segmentos)}:v={v}:a=1" + ("[vc][ac]" if con_video else "[ac]"))
    return args, filtros


def _correr_ffmpeg(args: list[str], cwd: Path) -> str:
    resultado = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostdin", "-y", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
    )
    if resultado.returncode != 0:
        ultimas = "\n".join(resultado.stderr.strip().splitlines()[-15:])
        raise ErrorRender(f"ffmpeg falló:\n{ultimas}")
    return resultado.stderr


def _loudnorm(medido: dict | None) -> str:
    base = f"loudnorm=I={LUFS_OBJETIVO}:TP={PICO_MAX_DB}:LRA={RANGO_LRA}"
    if medido is None:
        return base + ":print_format=json"
    return (
        f"{base}:measured_I={medido['input_i']}:measured_TP={medido['input_tp']}"
        f":measured_LRA={medido['input_lra']}:measured_thresh={medido['input_thresh']}"
        f":offset={medido['target_offset']}:linear=true"
    )


def _medir_volumen(plan: PlanEdicion, carpeta: Path, infos: dict[str, InfoClip], tmp: Path) -> dict | None:
    """Primera pasada: mide el volumen del audio unido. None si es todo silencio."""
    args, filtros = _entradas_y_filtros(plan, carpeta, infos, con_video=False)
    filtros.append(f"[ac]{_loudnorm(None)}[ao]")
    stderr = _correr_ffmpeg([*args, "-filter_complex", ";".join(filtros), "-map", "[ao]", "-f", "null", "-"], tmp)
    medido = json.loads(stderr[stderr.rindex("{"): stderr.rindex("}") + 1])
    if float(medido["input_i"]) < UMBRAL_SILENCIO_LUFS:
        return None
    return medido


# ---------- punto de entrada ----------

def renderizar(
    plan: PlanEdicion,
    carpeta_clips: Path,
    salida: Path,
    palabras_por_clip: dict[str, list[Palabra]] | None = None,
    vista_previa: bool = False,
) -> Path:
    """Renderiza el plan a un mp4 1080x1920 a 30 fps con audio normalizado a -14 LUFS.

    Los subtítulos se dibujan si el plan los pide y se pasan las palabras de cada clip.
    Con vista_previa sale a 540x960 y mucho más rápido, para revisar antes de aprobar.
    """
    infos = {}
    for nombre in {seg.clip for seg in plan.segmentos}:
        ruta = carpeta_clips / nombre
        if ruta.is_file():
            infos[nombre] = probar(ruta)
    errores = errores_de_contenido(plan, {nombre: info.duracion for nombre, info in infos.items()})
    if errores:
        raise ErrorRender("El plan no coincide con los clips:\n- " + "\n- ".join(errores))

    salida = salida.resolve()
    salida.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="editor-") as nombre_tmp:
        tmp = Path(nombre_tmp)
        medido = _medir_volumen(plan, carpeta_clips, infos, tmp)

        ancho, alto = (ANCHO_PREVIA, ALTO_PREVIA) if vista_previa else (ANCHO, ALTO)
        args, filtros = _entradas_y_filtros(plan, carpeta_clips, infos, True, ancho, alto)
        calidad = ["-preset", "veryfast", "-crf", "28"] if vista_previa else ["-preset", "medium", "-crf", "20"]

        ass = generar_ass(plan, palabras_por_clip)
        if ass:
            # ffmpeg corre dentro de tmp para pasar rutas relativas al filtro ass
            # (las rutas absolutas con ":" o "\" rompen la sintaxis de filtros).
            (tmp / "textos.ass").write_text(ass, encoding="utf-8")
            if CARPETA_FUENTES.is_dir():
                shutil.copytree(CARPETA_FUENTES, tmp / "fuentes")
            else:
                (tmp / "fuentes").mkdir()
            filtros.append("[vc]ass=textos.ass:fontsdir=fuentes[vo]")
        else:
            filtros.append("[vc]null[vo]")

        audio_final = _loudnorm(medido) + "," if medido else ""
        filtros.append(f"[ac]{audio_final}aresample={AUDIO_HZ}[ao]")

        _correr_ffmpeg([
            *args,
            "-filter_complex", ";".join(filtros),
            "-map", "[vo]", "-map", "[ao]",
            "-c:v", "libx264", *calidad, "-pix_fmt", "yuv420p", "-r", str(FPS),
            "-c:a", "aac", "-b:a", "192k", "-ar", str(AUDIO_HZ), "-ac", "2",
            "-movflags", "+faststart",
            str(salida),
        ], tmp)
    return salida
