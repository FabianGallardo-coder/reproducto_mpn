# FlowPlayer

> Reproductor multimedia multiplataforma con tres modos de UI (Normal, Flow, Zen) y bajo consumo de memoria.

## Descripción

FlowPlayer es un reproductor multimedia construido con Tauri 2.0, Rust y React 18 + TypeScript. Ofrece tres modos de UI diseñados para diferentes estados de enfoque y consumo de medios, manteniendo un bajo consumo de recursos (<150 MB de RAM en idle).

## Características

- **Multiplatform**: Windows 10+, macOS 12+, Ubuntu 22.04+
- **Tres modos de UI**:
  - **Modo Normal**: Interfaz completa con barra lateral expandible, vista de 2 columnas (track list + Now Playing) y PlayerBar persistente.
  - **Modo Flow**: Enfoque en productividad con barra lateral colapsable, Pomodoro timer, visualizador de espectro y letras sincronizadas.
  - **Modo Zen**: Experiencia inmersiva con visualizador a pantalla completa, fondo transparente (se ve el escritorio), controles flotantes en panel glass y salida con Escape.
- **Diseño visual** (inspirado en Valentine):
  - Glassmorphism profundo: `backdrop-filter: blur(40px)`, bordes glass `rgba(255,255,255,0.15)`.
  - Album art difuminado como fondo de toda la app (`blur(80px) brightness(0.3) opacity(0.7)`).
  - Letras sincronizadas con efecto neon glow (`text-shadow` con color accent).
  - Animaciones spring en botones (`cubic-bezier(0.34, 1.56, 0.64, 1)`).
  - Sombras profundas en album art (`rgba(0,0,0,0.6)`, radio 40px).
  - Tipografía monoespaciada en tiempos (`tabular-nums`).
- **Reproducción de audio**:
  - Archivos locales (MP3, FLAC, WAV, OGG, AAC, etc.)
  - Streaming de radio por Internet (SomaFM presets)
  - YouTube metadata + streaming (yt-dlp sidecar)
  - Letras sincronizadas (LRCLib API + parser LRC)
- **Gestión de listas de reproducción**: crear, guardar, cargar, reordenar, mezclar y repetir.
- **Visualizador de audio**: barras capsula/pill con brillo aditivo (`globalCompositeOperation: "lighter"`), 64 bins, idle breathing animation.
- **Media Session API**: controles del sistema operativo integrados.
- **Listas virtualizadas**: renderizado vano para colecciones grandes (52px rows, buffer 5, sin dependencias externas).
- **Keyboard shortcuts**: Space (play/pause), Alt+N/F/Z (modos), Escape (salir zen), Ctrl+arrows (seek/volume), Tab (cycle), S (shuffle), R (repeat), Ctrl+O (open folder).
- **Optimización de recursos**:
  - Tipado estricto de TypeScript (sin `any`).
  - Manejo adecuado de errores en Rust (sin `unwrap`/`expect`).
  - Caché eficiente de metadata con base de datos embebida `sled`.
- **Pruebas**: 130 tests frontend (vitest) + 17 tests backend (Rust) + Playwright QA.
- **QA Skills**: `frontend-audit` (análisis de código) + `frontend-qa` (testing visual con Playwright), con registries persistentes en `.opencode/registries/`.

## Estructura del proyecto

```
src/
  ├── components/
  │   ├── layout/              # AppLayout, PlayerBar, Sidebar
  │   ├── modes/
  │   │   ├── normal/          # NormalView (2-column: track list + now playing)
  │   │   ├── flow/            # FlowView (pomodoro + visualizer + lyrics + tracks)
  │   │   └── zen/             # ZenView (transparent background + capsule visualizer)
  │   ├── ui/                  # Icons (14 SVGs)
  │   ├── TrackList.tsx        # Virtual list (52px rows, absolute positioning)
  │   ├── Visualizer.tsx       # Canvas capsule bars with additive glow (64 bins)
  │   ├── Lyrics.tsx           # LRC parser + neon glow display
  │   ├── PomodoroTimer.tsx    # Focus timer
  │   ├── RadioPanel.tsx       # SomaFM stations
  │   └── ErrorBoundary.tsx    # React error boundary
  ├── hooks/                   # usePlayerStore (Context), useMode, useShortcuts, useMediaSession, useOnlineStatus, useCoverArt
  ├── lib/
  │   ├── api.ts               # Tauri IPC wrappers (typed invoke calls)
  │   └── events.ts            # Event name constants
  ├── types/                   # Track, PlaybackState, AppConfig, Mode, RepeatMode
  ├── styles/globals.css       # Design tokens, glassmorphism, neon lyrics, responsive
  ├── App.tsx                  # Main app + background album art blur layer
  └── main.tsx                 # Entry point

src-tauri/src/
  ├── lib.rs                   # Tauri builder, state setup, event bridge
  ├── main.rs                  # Entry point
  ├── audio/                   # player.rs, playlist.rs, analyzer.rs, track_info.rs
  ├── commands/                # audio.rs, config.rs, library.rs, integrations.rs, window.rs
  ├── config/                  # store.rs (sled), models.rs
  ├── metadata/                # id3.rs (lofty), cache.rs (sled)
  ├── lyrics.rs                # LRCLib API client
  ├── radio.rs                 # SomaFM presets
  ├── youtube.rs               # yt-dlp integration
  └── error.rs                 # AppError enum (thiserror)
```

## Tecnologías principales

- **Tauri 2.0** – Framework para aplicaciones de escritorio ligeras (ventana transparente).
- **Rust** – Lógica de backend, procesamiento de audio y seguridad.
- **React 18 + TypeScript 5.0** – Interfaz de usuario con tipado estricto.
- **rodio** – Biblioteca de reproducción de audio en Rust.
- **lofty** – Lectura de metadata de audio (ID3, Vorbis, etc.).
- **sled** – Base de datos embebida para caché de metadata y configuración.
- **reqwest** – HTTP client para LRCLib API.
- **yt-dlp** – Herramienta para obtener audio de YouTube.

## Cómo comenzar

### Requisitos previos

- [Rust](https://www.rust-lang.org/tools/install) (versión estable)
- [Node.js](https://nodejs.org/) (>= 18)
- [npm](https://www.npmjs.com/)
- Dependencias del sistema para Tauri (consultar [docs de Tauri](https://tauri.app/v2/guides/getting-started/prerequisites))

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/flowplayer.git
cd flowplayer

# Instalar dependencias del frontend
npm install

# Construir y ejecutar en modo desarrollo
npm run tauri dev
```

### Testing

```bash
# Frontend tests
npx vitest run

# Backend checks
cargo check --manifest-path src-tauri/Cargo.toml

# TypeScript typecheck
npx tsc --noEmit
```

### Empaquetado para producción

```bash
npm run tauri build
```

Los binarios se generarán en `src-tauri/target/release/bundle/`.

## Métricas de rendimiento (objetivo)

- **Memoria en reposo**: <150 MB RAM
- **Memoria máxima durante reproducción**: <250 MB
- **Tiempo de arranque**: <2 segundos hasta primera imagen renderizada
- **Latencia de respuesta a comandos**: <100 ms (play/pause, seek)
- **Carga de lista de reproducción**: <500 ms para 1000 pistas

## Contribuir

1. Fork el repositorio.
2. Crea una rama para tu característica (`git checkout -b feature/amazing-feature`).
3. Realiza tus cambios y confirma (`git commit -m 'Add amazing feature'`).
4. Push a la rama (`git push origin feature/amazing-feature`).
5. Abre un Pull Request.

Por favor, asegúrate de seguir las guías de estilo y pasar las pruebas antes de enviar.

## Licencia

Este proyecto está licenciado bajo los términos de la licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

## Agradecimientos

- [Tauri Team](https://tauri.app) por el excelente framework.
- [rodio-rs](https://github.com/rodio-rs/rodio) por la reproducción de audio.
- [lofty](https://github.com/Serial-ATA/lofty-rs) por la lectura de metadata.
- [sled-db](https://github.com/sled-db/sled) por la base de datos embebida.
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) por la extracción de audio de YouTube.
- [Valentine](https://github.com/JesusChapman/valentine) por inspiración de diseño (glassmorphism, neon lyrics, album art blur).

---  
*FlowPlayer – Enfócate en la música, no en la interfaz.*

## Estado actual (sesión 2026-07-16)

QA/QC del informe [`qa-qc-report.md`](./qa-qc-report.md) completado:

- **1.1 Scan async + canal de progreso** — `scan_folder` ahora `async` con `tauri::async_runtime::spawn_blocking` y `Channel<ScanProgress>`; emite progreso cada 25 archivos (`is_multiple_of`).
- **1.2 reqwest async** — eliminada la feature `blocking`; radio/lyrics usan `bytes_stream()` + `tokio::time::sleep` para reintentos.
- **2.1 Resiliencia radio + offline** — `useOnlineStatus` (navigator.onLine + listeners `online`/`offline`); `RadioPanel` deshabilita estaciones y muestra banner cuando está offline; reintentos 3x con backoff en `StreamReader`.
- **2.2 Parseo defensivo lofty** — errores por archivo se registran con `log::warn` y el escaneo continúa con metadatos genéricos.
- **2.3 Config robusta** — `ConfigStore::load` ahora hace fallback a defaults + reescritura si el JSON está corrupto o el archivo está vacío (con tests).
- **3.1 Estado global** — migrado de `usePlaylist` (prop drilling) a `usePlayerStore` con dos contexts separados (`usePlayerState` + `usePlayerActions`) para evitar re-renders innecesarios. `App`, `AppLayout`, `PlayerBar` consumen del context, sin prop drilling.
- **3.2 Caché de carátulas** — `get_cover` ahora persiste en `<app_cache_dir>/covers/<hash>.bin` con `DefaultHasher`.

Verificación final: `tsc --noEmit` 0 errores · `cargo clippy --lib` limpio · `cargo test --lib` 17/17 · `npx vitest run` 130/130.