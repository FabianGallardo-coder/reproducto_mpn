# YouTube y radio

## Reproducir un video

Estos pasos de búsqueda y descarga corresponden a escritorio. En Android se abre un enlace, como se explica a continuación.

1. Abrí **Buscar**.
2. Elegí **YouTube** y escribí una consulta.
3. Pulsá Reproducir en un resultado.
4. Usá el video flotante o abrí **Reproduciendo** para acoplarlo.

La reproducción usa la IFrame API oficial y conserva visible el video. No inicia una descarga. La barra inferior controla pausa, volumen, avance y cola; Autoplay permite continuar con el siguiente elemento.

El iframe se mantiene al cambiar entre Normal y Flow. Abrir Reproduciendo desde Flow vuelve a Normal para mostrar la página. Entrar en Zen o Mini pausa YouTube: esos modos no pueden mostrar el video con el espacio requerido.

YouTube decide si un video puede incrustarse, y puede mostrar anuncios o restricciones. Ante un error se informa el motivo y, cuando corresponde, se ofrece **Abrir en YouTube**. No se evaden bloqueos geográficos, requisitos de cuenta o restricciones del contenido.

## Android: abrir un enlace

En **Buscar**, pegá una URL de `youtube.com` o `youtu.be` en **Abrir enlace de YouTube**. El video usa el iframe oficial, flotante o acoplado a Reproduciendo; el audio local se detiene antes de iniciar el video. Al ocultar la app, entrar en Zen o en Mini, se solicita la pausa.

No hay reproducción de YouTube en el servicio nativo de segundo plano, extracción de audio, búsqueda integrada ni descargas Android. La búsqueda remota requiere una futura integración con la API oficial; no se incluye una clave API.

## Descargas de escritorio

1. Abrí **Descargas de YouTube**.
2. Usá **Agregar de YouTube** para buscar o inspeccionar un enlace.
3. Para un enlace con video y playlist, revisá la opción de incluir la playlist.
4. Revisá la colección y confirmá la descarga.

La cola es secuencial. Cada trabajo muestra progreso y permite cancelar o reintentar. Cambiar de pestaña o modo no debería iniciar reproducción ni interrumpir el trabajo. Tras reiniciar la app, los trabajos incompletos requieren reintento explícito.

Los archivos completos se reproducen sin conexión. Un archivo ausente o incompatible se indica como tal. No se exige ffmpeg: si no existe un formato compatible con el flujo disponible, la operación informa un error.

Descargá únicamente contenido propio o autorizado y respetá las condiciones del servicio y la normativa aplicable.

## Escuchar radio

Abrí **Radio** en la barra lateral, buscá por nombre o género y elegí una emisora. También podés agregar una URL de streaming con sus datos.

Los presets incluyen emisoras de SomaFM. La disponibilidad, el formato y la continuidad del stream dependen del proveedor. Una página web de una radio no necesariamente es una URL de audio reproducible.

Android incluye Groove Salad y permite agregar emisoras propias; requiere URLs de audio **HTTPS**. La sesión Media3 está preparada para continuar audio local y radio en segundo plano. La continuidad real de cada emisora, controles de notificación y restricciones de batería requieren comprobación en el dispositivo.

## Privacidad y conexión

La música local no necesita conexión para reproducirse. YouTube, radio y letras contactan sus respectivos servicios externos. La app no sincroniza automáticamente playlists remotas ni proporciona un catálogo mundial de emisoras.
