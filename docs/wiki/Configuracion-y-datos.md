# Configuración y datos

## Qué se guarda

| Dato | Ubicación lógica |
|---|---|
| Carpeta, volumen, aleatorio, repetición, favoritos, playlists y radios propias | `app_config_dir/config.json` |
| Historial de reproducciones | `app_config_dir/history.json` |
| Catálogo y archivos descargados | `app_data_dir/youtube/` |
| Acento, modo de inicio y autoplay | Almacenamiento local del WebView |
| Caché anterior de YouTube, cuando existe | `app_cache_dir/youtube/` |

Tauri resuelve esas carpetas según el sistema y el identificador de la app. El perfil normal es `com.flowplayer.app`; QA usa `com.flowplayer.qa`. En Windows buscá esos identificadores bajo las carpetas de datos de aplicación del usuario. No supongas que todos los datos están en la carpeta del ejecutable.

El volumen, aleatorio y repetición se guardan al cambiar. Configuración permite seleccionar acento y modo de inicio (Normal o Flow).

## Historial

Se conservan hasta 2000 entradas. Una repetición inmediata de la misma ruta dentro de cinco segundos se trata como duplicado accidental. Estadísticas trabaja sobre el historial conservado, no sobre todas las reproducciones de la vida de la app.

El borrado del historial requiere confirmación. No borra los archivos de música ni las descargas.

## Respaldar

1. Cerrá FlowPlayer.
2. Copiá la carpeta de configuración y la de datos del perfil normal a una ubicación segura.
3. Si necesitás conservar todas las preferencias visuales, respaldá también el perfil WebView correspondiente.
4. Conservá por separado tu biblioteca original: las playlists guardan referencias, no copias.

No edites JSON mientras la app está abierta. Un JSON de configuración ilegible puede restaurar valores predeterminados y un historial ilegible puede iniciarse vacío; respaldá antes de intentar reparaciones.

## Limpiar sin perder música

Los directorios `node_modules/.vite`, `node_modules/.vite-temp`, `dist`, `test-results`, `playwright-report`, `coverage` y `src-tauri/target` son salidas reconstruibles del entorno de desarrollo.

No confundas esos directorios con `app_data_dir/youtube`, `config.json`, `history.json` o tu carpeta de música. Limpiar Rust fuerza una recompilación completa; no es una operación necesaria para el uso normal.
