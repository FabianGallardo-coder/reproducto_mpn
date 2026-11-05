# Desarrollo

## Arquitectura

FlowPlayer tiene dos rutas de reproducción:

- **Archivos y radio:** React envía comandos IPC a Rust. El motor de audio usa rodio y decodificación Symphonia cuando corresponde.
- **YouTube:** React controla la IFrame API oficial. Rust aporta búsqueda, inspección y gestión de descargas con yt-dlp, pero no extrae audio para el streaming del reproductor.

`src/main.tsx` monta los proveedores de reproducción y navegación. `src/App.tsx` coordina inicialización, modos y atajos. El modo decide si se muestra el enrutador de páginas, Flow, Zen o Mini.

| Área | Código |
|---|---|
| Navegación y estado de reproducción | `src/hooks/useNavigation.tsx`, `src/hooks/usePlayerStore.tsx` |
| Páginas | `src/pages/` |
| Layout y barra persistente | `src/components/layout/` |
| Iframe persistente y Reproduciendo | `src/components/nowplaying/`, `src/hooks/useYouTubePlayer.ts` |
| Puente IPC tipado | `src/lib/api.ts` |
| Comandos y permisos | `src-tauri/src/commands/`, `src-tauri/permissions/`, `src-tauri/capabilities/` |
| Audio, metadata e integraciones | `src-tauri/src/audio/`, `metadata/`, `youtube*.rs`, `lyrics.rs`, `radio.rs` |
| Historial y persistencia | `src-tauri/src/history.rs`, `src-tauri/src/config/` |

`src-tauri/src/lib.rs` selecciona el backend por plataforma: escritorio en `desktop.rs` y Android en `mobile.rs`. Agregar un comando requiere revisar registro, tipos frontend y permisos/capacidades, no solamente implementar la función Rust. En escritorio el escaneo usa un `Channel` para progreso; no se debe invocar sin ese argumento.

### Backend Android

`src/lib/platform.ts` redirige el IPC a `mobile_command`, registrado en Rust. Este llama al plugin Kotlin `MediaPlugin.kt` en `src-tauri/gen/android/app/src/main/java/com/flowplayer/app/`. El plugin usa el selector de documentos y Media3; `PlaybackService.kt` mantiene la sesión multimedia. No usa rodio, yt-dlp ni plugins exclusivos de escritorio.

El comando Android `scan_folder` devuelve `{ tracks, warnings }`. `api.scanFolder` adapta la respuesta al contrato frontend de pistas y comunica los archivos omitidos. Los errores de permisos y de carpeta siguen siendo errores explícitos. Las URI son sensibles a mayúsculas y no se normalizan como rutas Windows.

El catálogo compartido de radio está en `src-tauri/radio/stations.json`. Rust lo incluye en el ejecutable mediante `include_str!`; Gradle empaqueta ese mismo archivo como asset `stations.json`, que Kotlin lee para `list_radio_stations`. Ambos agregan las radios personales después de los presets. No mantengas listas separadas por plataforma. Si agregás una URL HTTP, revisá también `app/src/main/res/xml/network_security_config.xml`: la distribución solo permite HTTP en los hosts explícitos del catálogo; el recurso debug conserva el acceso HTTP necesario para desarrollo.

`src/styles/mobile.css` limita las adaptaciones a `html[data-platform="android"]`. El transporte se adapta al teclado y a pantallas horizontales; Reproduciendo usa desplazamiento vertical. Los modos móviles son vistas internas, no cambios de geometría de ventanas nativas.

## Comandos

Ejecutar desde la raíz en PowerShell:

```powershell
npm ci
npm run tauri dev
npm run typecheck
npm run typecheck:qa
npm run lint
npm test
npm run build
```

Vite solo es útil para la interfaz o pruebas con IPC simulado. La app de escritorio usa `http://127.0.0.1:52000` en desarrollo. Para backend:

```powershell
cargo test --manifest-path src-tauri\Cargo.toml
cargo clippy --manifest-path src-tauri\Cargo.toml -- -D warnings
```

## Ventanas y YouTube

Normal y Flow comparten el contenedor completo para conservar el iframe. Zen y Mini usan el layout simple y pausan YouTube. El iframe flotante debe medir al menos 200 × 200 píxeles por dentro de bordes y encabezado; un wrapper de ese tamaño no es suficiente.

El origen y la CSP cambian entre desarrollo y el paquete instalado. Probar YouTube en Vite/WebView2 dev no certifica el instalador.

## Iconos

El original vectorial es `public/favicon.svg`: fondo oscuro, barras de sonido y símbolo de reproducción violeta. También funciona como favicon.

Regenerar los tamaños de Tauri:

```powershell
npm run tauri icon -- public\favicon.svg --output src-tauri\icons
```

La herramienta genera PNG, `icon.ico` para Windows, `icon.icns` y variantes adicionales. La configuración de bundle enumera los archivos usados en escritorio. El icono de Windows puede seguir en la caché del shell hasta reinstalar o actualizar el acceso directo; no hace falta borrar cachés del sistema.

## Empaquetar

```powershell
npm run tauri build
```

Los bundles quedan en `src-tauri\target\release\bundle`. Comprobá el sidecar yt-dlp y probá el instalador en un equipo limpio. No se declara firma de código ni validación de macOS/Linux.

### APK ARM64 de desarrollo

Requisitos adicionales: JDK 21 (JDK 17 también compiló correctamente; Gradle 8.14 no admite JDK 25 o superior, así que definí `JAVA_HOME` en la terminal si tu JDK predeterminado es más nuevo), Android SDK con plataforma y Build Tools 36, NDK `27.2.12479018`, herramientas de plataforma y target Rust `aarch64-linux-android`. Android Studio puede instalar el SDK/NDK; revisá y aceptá las licencias desde sus herramientas oficiales.

Configurá las rutas para tu equipo en la misma terminal PowerShell (no hace falta cambiar el Java global):

```powershell
$env:JAVA_HOME = 'C:\ruta\a\jdk-21'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:NDK_HOME = "$env:ANDROID_HOME\ndk\27.2.12479018"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
rustup target add aarch64-linux-android
npm run tauri android build -- --debug --apk --target aarch64 --ci
```

El proyecto Android ya está inicializado; no lo regeneres para compilar. El comando aplica la configuración móvil `src-tauri/tauri.android.conf.json`, sin sidecar de escritorio. La salida habitual es `src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk`. Aunque el nombre diga «universal», este comando incluye únicamente ARM64.

Para instalarla en un teléfono autorizado, con depuración USB activada:

```powershell
adb devices
adb -s SERIAL install -r src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk
```

Reemplazá `SERIAL` por el identificador de tu dispositivo. La firma debug es solo para pruebas: una APK de distribución requiere firma de release propia y QA adicional. No subas keystores, contraseñas, `local.properties`, bibliotecas generadas ni APK al repositorio de código. La CI actual valida frontend y Rust de Windows, no compila Android.

### APK ARM64 de release firmado

Creá y respaldá una clave privada fuera del repositorio. En esa misma ubicación guardá un archivo de propiedades Java con `storeFile`, `storePassword`, `keyAlias` y `keyPassword`. Restringí su acceso al usuario que compila; no imprimas su contenido ni lo adjuntes a informes.

Con las rutas JDK/SDK/NDK anteriores configuradas:

```powershell
$env:FLOWPLAYER_SIGNING_PROPERTIES = 'C:\ruta\privada\signing.properties'
npm run tauri android build -- --apk --target aarch64 --ci
Remove-Item Env:\FLOWPLAYER_SIGNING_PROPERTIES
```

La salida es `src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release.apk`, solo ARM64. Sin las propiedades de firma, no se debe distribuir el APK: verificá siempre el certificado, versión, arquitectura y alineación de 16 KB con `apksigner`, `aapt` y `zipalign`. El release usa minificación y las restricciones HTTP de distribución, no el override de debug.

La clave debe conservarse para todas las futuras actualizaciones. Android no permite actualizar una instalación debug con una clave release diferente; no desinstales ni borres datos para resolverlo sin autorización explícita. Probá el APK release exacto antes de publicarlo, no solo la compilación debug.

## Cambios mantenibles

- Conservá los contratos IPC y propagá errores visibles.
- No subas datos del usuario, reportes, compilados ni credenciales.
- Agregá una regresión para cambios de comportamiento, no solamente una comprobación de clases CSS.
- Mantené la documentación junto con el cambio y diferenciá pruebas simuladas de ejecución nativa.
