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

### Aceptación de paquetes v0.1.1 candidata

Se recompilaron los instaladores Windows x64 y el APK release ARM64 firmado tras limitar Android a Normal/Zen. El usuario aprobó el APK final, confirmó que Flow/Mini no aparecen y aprobó el instalador Windows v0.1.1 instalado conservando datos.

La validación final aprobó 317 tests frontend, 29 E2E, ambos typechecks y lint sin errores (4 advertencias preexistentes). Rust aprobó 110 tests con 1 prueba de dispositivo ignorada; Clippy Windows/Android pasó. La APK final declara versión 0.1.1/código 1001, SDK mínimo 26 y ARM64; firma v2 y alineación 16 KB verificadas. El catálogo de 92 emisoras coincide byte a byte en APK y ejecutable Windows; la CSP del APK permite `blob:` solo para imágenes.

El ejecutable instalado por NSIS coincide con el compilado salvo el marcador interno de tipo de paquete de Tauri (`NSS` frente a `UNK`), verificado mediante comparación binaria. La aceptación humana no certifica todos los dispositivos, todas las emisoras ni todas las funciones; se publica como candidata.

### Regresiones de PC verificadas manualmente con el ejecutable

Tras instalar o ejecutar el paquete Windows, comprobá estos casos, que ningún test automatizado cubre de punta a punta:

- Miniaturas: las portadas embebidas de las pistas locales se ven en Inicio, Biblioteca, barra de reproducción y Mini. Requieren `blob:` en `img-src` de la CSP (`src-tauri/tauri.conf.json`); `src/test/csp.test.ts` protege esa directiva.
- Buscar con enlace: pegar `https://www.youtube.com/watch?v=L50II6zJy9U&list=RDL50II6zJy9U&start_radio=1` devuelve exactamente ese video (ID `L50II6zJy9U`), no una búsqueda de texto. Un enlace solo de playlist lista sus videos disponibles y una URL que no sea de YouTube muestra un aviso. Verificá en `youtube/library.json` que una descarga conserve el ID pedido.
- Mini y Zen con YouTube: el reproductor oficial no existe en esos modos. Al pulsar reproducir debe verse el aviso «YouTube solo se reproduce en el modo Normal o Flow», el botón debe seguir en «Reproducir» y el reloj no debe avanzar.
- Mini con radio: la barra de posición queda deshabilitada y muestra «En vivo».
- Geometría: minimizar la ventana, activar Mini y expandir debe devolver una ventana de al menos 800 × 600 px lógicos, nunca una de 160 × 40.

### Adaptación Android en pruebas

Para el catálogo de radio, ejecutá `cargo test --manifest-path src-tauri/Cargo.toml radio::tests::preset`. Las regresiones comprueban las 92 emisoras, campos y URLs válidos, nombres sin duplicados y correspondencia entre los 6 hosts HTTP y las excepciones Android de distribución. Tras generar los paquetes, verificá que `assets/stations.json` en la APK coincida byte a byte con `src-tauri/radio/stations.json` y que el ejecutable Windows contenga ese catálogo. Esto verifica inclusión, no disponibilidad ni audibilidad de todas las transmisiones.

El APK de desarrollo usa el selector de documentos de Android y conserva permisos de lectura, sin convertir las URI `content://` a rutas de escritorio. Para probar el escaneo, seleccioná una carpeta de QA con audios válidos y un archivo de audio dañado: los válidos deben aparecer y el archivo omitido debe indicarse en un aviso. Un permiso revocado debe seguir produciendo un error, no una biblioteca vacía aparentemente correcta.

La compilación del APK no certifica reproducción, controles de notificación ni continuidad con pantalla bloqueada. Estas funciones requieren pruebas en un dispositivo real. La suite nativa de Windows no valida Android.

#### Regresiones comprobadas en un teléfono USB

El APK ARM64 debug se instaló sobre la app existente con `adb install -r`, conservando sus datos. En una biblioteca de 464 pistas se comprobó:

- Portadas `blob:` cargadas en Biblioteca, barra y Mini; la portada embebida de «Absolute Soul» se verificó visualmente en Mini. No se inspeccionaron individualmente las 464 pistas ni se exige portada a archivos sin imagen embebida.
- Reproducción local con posición nativa y reloj avanzando, pausa y cambio de fuente. Durante la carga de portadas, una consulta `get_state` tardó 683 ms tras corregir el puente; es una observación, no una garantía de rendimiento.
- El enlace con video `L50II6zJy9U` y parámetros de mix abrió el iframe oficial con ese ID y duración 3:39. Funcionaron pausa, reanudación, seek al 50 % y continuidad del mismo iframe en Flow.
- En Mini y Zen, YouTube quedó pausado; pulsar reproducir mostró el aviso de volver a Normal/Flow sin cambiar el botón a «Pausar». Mini mostró la miniatura del video.
- Se conservaron las 92 emisoras. Groove Salad reprodujo con posición nativa avanzando; Mini deshabilitó el seek y mostró «En vivo». El cambio YouTube → radio eliminó el iframe y radio → local recuperó la portada.

El puente `mobile_command` usa `run_mobile_plugin_async`: la variante síncrona bloqueaba los hilos del ejecutor mientras las solicitudes de portadas esperaban al plugin y retrasaba el transporte y la apertura de YouTube. Para repetir la regresión, abrir una biblioteca grande desde un arranque en frío y probar los controles mientras todavía se cargan las imágenes.

Estos resultados no certifican audibilidad física, todas las emisoras, notificaciones, pantalla bloqueada, descargas en Android ni todos los controles de YouTube. Android sigue usando enlaces oficiales, sin búsqueda integrada ni descargas.

#### Búsqueda y desplazamiento táctil

La revisión inicial no cubrió el gesto de desplazamiento de Biblioteca. La prueba posterior reprodujo una lista de casi 30.000 px recortada por la página: la regla móvil `flex: 1 0 auto` impedía limitar el cuerpo de Biblioteca y su lista virtualizada. El cuerpo ahora puede reducirse y la lista tiene `min-height: 0`. En el APK actualizado, la biblioteca de 464 pistas tiene un viewport de 213 px y renderiza inicialmente 9 filas; un swipe enviado por la entrada táctil de Android avanzó `scrollTop` de 0 a 173,5 px.

Mitre y Cadena 3 ya estaban en los resultados, pero el formulario de YouTube los desplazaba debajo del transporte visible. Ahora los resultados preceden al formulario, y Local/Radio no muestran ese formulario. Se comprobaron Mitre, las dos emisoras Cadena 3 y los filtros Todo/Local/YouTube/Radio en el teléfono. El filtro YouTube muestra el formulario oficial, no un falso «Sin resultados» de búsqueda online que Android no admite.

`e2e/mobile.spec.ts` contiene las regresiones «Android library scrolls by touch and reaches the last track without expanding every row» y «Android search finds Mitre and Cadena 3 and respects all source filters». La primera comprueba un gesto táctil, virtualización y acceso a la última pista; la segunda comprueba resultados y exclusión de fuentes. Ambas fallaron antes de la corrección y pasaron después. La suite móvil completa aprobó sus 8 casos; los 24 tests de `Pages.test.tsx` también pasaron. El APK se actualizó con `adb install -r`, sin limpiar datos; la publicación queda pendiente de aceptación del usuario.

La regresión visual móvil se ejecuta con `npx playwright test mobile.spec.ts`. Simula el puente Android y comprueba anchos de 320, 360 y 430 px, además de horizontal a 800 × 360 px: páginas sin desbordamiento horizontal, transporte dentro del viewport, objetivos táctiles de 44 px, creación de playlists accesible, paneles de Reproduciendo desplazables, salida de Zen visible sin mouse y tarjeta Mini compacta. También verifica que Buscar no enfoque automáticamente el teclado y que el iframe oficial conserve al menos 200 × 200 px.

Complementá estos casos con capturas del APK instalado: Inicio (incluido contenido inferior), Buscar con y sin teclado, Biblioteca y colecciones, formulario de radio y playlist, Estadísticas, Configuración, Cola/Letra/Detalles, Zen y YouTube flotante/acoplado. Desde v0.1.1 Android solo ofrece Normal y Zen; Flow y Mini quedan en escritorio. La prueba «Android only exposes Normal and Zen and ignores saved Flow and unavailable mode shortcuts» verifica opciones, preferencia antigua y atajos bloqueados. Las comprobaciones de Mini/Flow móvil anteriores documentan la versión previa, no funciones de la candidata actual. Los insets de Android, el teclado real y el servicio de YouTube no se certifican con simulaciones de navegador.

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
