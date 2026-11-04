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

Los comandos se registran en `src-tauri/src/lib.rs`. Agregar uno requiere revisar registro, tipos frontend y permisos/capacidades, no solamente implementar la función Rust. El escaneo usa un `Channel` para progreso; no se debe invocar sin ese argumento.

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

## Cambios mantenibles

- Conservá los contratos IPC y propagá errores visibles.
- No subas datos del usuario, reportes, compilados ni credenciales.
- Agregá una regresión para cambios de comportamiento, no solamente una comprobación de clases CSS.
- Mantené la documentación junto con el cambio y diferenciá pruebas simuladas de ejecución nativa.
