# QA

## Capas de validación

| Capa | Verifica | No demuestra |
|---|---|---|
| Vitest | Componentes, hooks y lógica frontend. | Audio nativo o servicios externos. |
| Playwright navegador | Interacciones con IPC y YouTube simulados. | Reproducción real o descargas reales. |
| Rust | Motor, persistencia, validaciones y lógica backend. | Interfaz completa o audibilidad. |
| Playwright nativo | WebView2 e IPC reales de Tauri en desarrollo. | Instalador, diálogos OS o sonido audible. |

## Pruebas de desarrollo

```powershell
npm run typecheck
npm run typecheck:qa
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
cargo test --manifest-path src-tauri\Cargo.toml
cargo clippy --manifest-path src-tauri\Cargo.toml -- -D warnings
```

Para las regresiones de Flow y YouTube:

```powershell
npx playwright test shell.spec youtube.spec
```

## Tauri real con perfil aislado

Esta suite es para Windows con WebView2. Cerrá la instancia normal antes de arrancar la de QA para evitar conflictos del puerto de desarrollo.

En una terminal PowerShell:

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9223 --remote-debugging-address=127.0.0.1'
npm run tauri dev -- --config e2e\native\tauri.qa.json
```

Esperá la ventana. En otra terminal:

```powershell
npm run typecheck:qa
npm run test:qa:native
```

La suite rechaza modificar el perfil normal: exige `com.flowplayer.qa`. Cada caso reinicia preferencias e historial del perfil de prueba y usa tres WAV originales silenciosos. No cargues datos personales en ese perfil.

Los casos online se omiten salvo activación explícita:

```powershell
$env:FLOWPLAYER_QA_ONLINE = '1'
npm run test:qa:native
```

Se comprueban búsqueda y reproducción de YouTube y una emisora real. La disponibilidad depende de los servicios externos. Los casos de descargas son simulados; no descargan videos reales.

Al terminar, cerrá la app de QA y eliminá la variable en la terminal que usaste para iniciarla:

```powershell
Remove-Item Env:\WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
```

No dejes el puerto de depuración abierto ni lo expongas fuera de localhost.

## Matriz funcional

- Navegación de páginas; entrar y salir de Flow, incluida la ruta ya seleccionada.
- Biblioteca: escaneo real, metadatos y duración.
- Transporte: reloj, pausa, seek, volumen, siguiente/anterior, aleatorio y repetición.
- Colecciones: favoritos, archivos ausentes, playlists guardadas y descargas.
- Reproduciendo: cola, pestañas, detalles, autoplay, acoplar/desacoplar iframe.
- Historial y estadísticas: persistencia, rangos y borrado con confirmación.
- Configuración: acento y modo inicial.
- Modos: geometría nativa, restauración, opacidad de Mini y Pomodoro.
- Errores: avisos, acciones accesibles y controles no bloqueados.

## Evidencia y límites

El informe nativo queda en `playwright-report/native`; los adjuntos, en `test-results/native`. Abrilo con:

```powershell
npx playwright show-report playwright-report\native
```

Las capturas de presentación se conservan en `docs/assets`; los informes temporales se regeneran y no se versionan.

Antes de una distribución, verificá manualmente:

1. Abrir archivos y carpetas mediante diálogos del sistema.
2. Audio audible, cambio de dispositivo y recuperación de salida.
3. Controles multimedia del sistema y bandeja.
4. Instalación, desinstalación, iconos y arranque.
5. YouTube dentro del paquete instalado con su origen/CSP.
6. Descargas autorizadas reales, cancelación y recuperación.

No se declara cobertura completa, reordenamiento de playlists ni compatibilidad multiplataforma certificados por esta matriz.
