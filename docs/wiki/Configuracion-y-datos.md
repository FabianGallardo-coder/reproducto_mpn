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

## Almacenamiento Android

En Android la configuración no usa el `config.json` de escritorio: se guarda en SharedPreferences privadas, bajo `flowplayer-media`. El historial se guarda como `history.json` dentro de `filesDir`. Las preferencias visuales siguen en el almacenamiento local de la WebView.

El selector conserva permisos de lectura para las URI `content://` elegidas. Mover archivos, revocar permisos o desinstalar puede invalidar esas referencias. Volvé a elegir la carpeta si se perdió el permiso. No sustituyas la URI por una ruta `/sdcard` ni por una ruta Windows.

Desinstalar o borrar los datos de la app elimina preferencias, historial y permisos propios. No borra los archivos originales de la carpeta elegida. Una actualización instalada sobre la misma app y con la misma firma normalmente conserva los datos; no reemplaza un respaldo. No hay catálogo de descargas YouTube en Android.

## Historial compartido por plataforma

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

En Android, `.gradle` y los directorios `build` del proyecto generado también son reconstruibles. Antes de borrar compilaciones, conservá los instaladores que necesites. Las capturas de QA son evidencia, no una caché; no se borran junto con reportes temporales. No limpies el SDK, NDK, JDK ni los datos del teléfono para liberar caché del proyecto.
