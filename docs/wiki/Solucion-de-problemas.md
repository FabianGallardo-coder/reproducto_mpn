# Solución de problemas

## La página de Vite muestra errores IPC

El frontend necesita Tauri. Arrancá `npm run tauri dev` y usá la ventana de escritorio. Las pruebas en navegador instalan un mock; abrir Vite directamente no lo hace.

## Flow no abre una sección

La versión actual debe volver a Normal al pulsar Inicio, Buscar, Biblioteca, Estadísticas o Configuración. También debe abrir Reproduciendo desde el transporte y el iframe flotante. Si sigue en Flow, confirmá que ejecutás la versión actual y registrá el destino y la secuencia exacta.

## No se oye música

- Verificá volumen de la app, mezclador del sistema y dispositivo de salida.
- Probá un archivo local conocido, no un WAV silencioso de QA.
- Revisá el error mostrado; una radio caída o un archivo incompatible no son equivalentes a volumen cero.
- Si cambiaste o desconectaste el dispositivo, comprobá la recuperación y el estado de pausa.

## YouTube no reproduce

- Verificá conexión y que el video permita incrustación.
- Conservá visible el iframe; Zen y Mini pausan el video intencionalmente.
- Usá **Abrir en YouTube** si se ofrece; no garantiza que el video esté disponible.
- Un error 153 puede estar relacionado con el origen o identificación del cliente. Reportá si ocurre en desarrollo o en un instalador: son contextos distintos.
- Para errores de búsqueda o descarga, comprobá el sidecar yt-dlp y el mensaje completo.

No intentes resolver restricciones de YouTube desactivando indiscriminadamente la CSP.

## Una pista favorita o descargada desapareció

Las referencias dependen de la ubicación real del archivo. Revisá si se movió, borró o quedó en una unidad desconectada. No borres todo el catálogo para solucionar una sola entrada.

## Historial o preferencias vacíos

Comprobá el perfil: `com.flowplayer.qa` es independiente de `com.flowplayer.app`. QA reinicia sus propios datos. Antes de editar JSON, cerrá la app y hacé un respaldo.

## El icono anterior sigue en Windows

Recompilá el bundle y actualizá el acceso directo o reinstalá el paquete generado. Windows puede conservar el icono en caché. No borres perfiles de usuario ni cambies el identificador de la app para actualizar un icono.

## Informar un problema

Incluí versión o commit, Windows y WebView2, modo, fuente de audio, pasos, resultado esperado y real. Adjuntá una captura y errores relevantes sin tokens, rutas privadas ni datos personales.
