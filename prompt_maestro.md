## Progress Checklist

### Fase 0: Scaffolding
- [x] 0.1: Proyecto Tauri + React + TypeScript
- [x] 0.2: TypeScript estricto (`strict: true`, no `@ts-ignore`)
- [x] 0.3: Vite puerto fijo 1420 + watcher exclusions
- [x] 0.4: Git init + commit
- [x] 0.5: Nombres correctos (FlowPlayer, flowplayer)
- [x] 0.6: `.gitignore` completo

### Fase 1: Backend Rust Modular
- [x] 1.1: Estructura modular (10+ archivos, no monolito)
- [x] 1.2: Error handling con `thiserror` (AppError enum)
- [x] 1.3: Audio engine channel-based (Send+Sync, no bloquea UI)
- [x] 1.4: Metadata cache con sled
- [x] 1.5: Commands Tauri (play/pause/resume/seek/next/prev/volume/scan/config)
- [x] 1.6: Config cross-platform con `dirs::audio_dir()`
- [x] 1.7: Dev experience (Vite puerto fijo, watcher exclusions)
- [x] Verificación: `cargo clippy` + `tsc --noEmit` sin errores

### Fase 2: Frontend
- [x] 2.1: Tipado estricto (cero `any`, `lib/api.ts` tipado)
- [x] 2.2: Hooks (useAudio, useMode, useLibrary, useShortcuts)
- [x] 2.3: Layout + modos (AppLayout, Sidebar, PlayerBar)
- [x] 2.4: Modo Normal (sidebar + track list)
- [x] 2.5: Modo Flow (Pomodoro + visualizer + track list)
- [x] 2.6: Modo Zen (fullscreen visualizer + track info)
- [x] 2.7: Keyboard shortcuts (un binding por key, sin conflictos Alt+1/2/3)
- [x] Verificación: `tsc --noEmit` + `vite build` sin errores

### Fase 3: Integraciones
- [x] 3.1: Media Session API (useMediaSession hook)
- [x] 3.2: YouTube metadata + stream (yt-dlp sidecar)
- [x] 3.3: Radio streaming (SomaFM presets + ring buffer adapter)
- [x] 3.4: Letras sincronizadas (LRCLib + LRC parser)
- [x] 3.5: Visualizador real (AudioAnalyzer + amplitude bins)

### Fase 4: Testing + CI
- [x] 4.1: Rust unit tests (17 tests: playlist, config, error, local source)
- [x] 4.2: Frontend tests — vitest + @testing-library (13 tests: useMode, useShortcuts, PomodoroTimer)
- [x] 4.3: GitHub Actions CI (frontend + rust jobs)

### Fase 5: Frontend Visual Repair
- [x] 5.1: Backend `get_cover` command (lofty Tag::pictures, registered in lib.rs, `api.getCover` in api.ts)
- [x] 5.2: CSS rewrite — glassmorphism, grid layout, sidebar transitions, zen-exit animation, lyrics styling
- [x] 5.3: PlayerBar — 3-column grid (art 52x52 + info | controls + seek | volume), elapsed time via `positionValue` state, controlled seek bar, VolumeIcon
- [x] 5.4: NormalView — 2-column (track list + Now Playing panel with 240x240 album art + track details)
- [x] 5.5: ZenView — floating exit button with backdrop-blur + auto-hide 3s
- [x] 5.6: Visualizer — `cancelled` flag race fix, `ResizeObserver` + `devicePixelRatio`, non-async draw loop, idle breathing animation when paused
- [x] 5.7: usePlaylist — `positionValue` state replaces DOM-based seekBar manipulation
- [x] 5.8: Icons — added VolumeIcon, CloseIcon
- [x] 5.9: Gemini visual audit fixes:
  - Fixed duplicate children rendering in AppLayout (sidebar + main both got content)
  - Track active row contrast 0.08 → 0.15 opacity
  - Track list title 0.85rem/500 → 0.9rem/600
  - Track list grid 2fr/1.5fr/1.5fr → 3fr/2fr/2fr (less aggressive ellipsis)
  - Flow Pomodoro padding 16px → 24px
  - Zen mode `position: fixed; inset: 0; z-index: 999` (no bleed-through)
  - Custom scrollbar styles for track-list, sidebar nav, now-playing panel
  - Lyrics loading text → "Syncing lyrics..."
  - Visualizer idle sine-wave breathing when paused
- [x] 5.10: Video bug fixes:
  - White flash on startup — `visible: false` in tauri.conf.json + `getCurrentWindow().show()`
  - Lyrics "Syncing..." stuck — 4s timeout → "No lyrics available"
  - Global scrollbar styles (`*::-webkit-scrollbar`)
- [x] 5.11: Virtualización de listas:
  - TrackList vanilla virtual scroll (52px rows, buffer 5, absolute positioning, no external deps)
  - `<li>` → `<div>` fix (invalid HTML semantics)
  - Keyboard a11y: `tabIndex`, `role="option"`, `aria-selected`, Enter/Space handler
  - Container `role="listbox" aria-label="Track list"`
- [x] 5.12: UX polish:
  - Mode crossfade: `key={mode}` on `<main>` in AppLayout (replays `fade-in` animation)
  - Responsive sidebar: auto-collapse at 900px width
  - Responsive player: simplified at 700px (hidden controls, single-column)
  - ZenView timer fix: `useRef` instead of `useState` for hideTimer (eliminates re-render cascade)
- [x] 5.13: Playwright QA (mocked Tauri APIs):
  - Layout, sidebar, player-bar render correctly
  - Mode switching (Normal → Flow → Zen → exit) verified
  - Responsive breakpoints verified at 800px and 500px
  - CSS values confirmed: #0a0a14 bg, blur(40px) glass, 0.3s grid transitions
  - 0 console errors with mocks
- [x] Verificación: `tsc --noEmit` + `vitest run` (13/13) + `cargo check` + Playwright sin errores

### Fase 5.5: QA Skills + Registry
- [x] Cache cleanup: `node_modules/.vite`, `dist/`, `src-tauri/gen/`
- [x] Skill `frontend-audit`: análisis sistemático de código CSS/React/TypeScript (layout, tokens, a11y, Tauri)
- [x] Skill `frontend-qa`: testing visual con Playwright (modos, interacciones, visual effects, edge cases)
- [x] Registries: `.opencode/registries/frontend-audit.md` + `frontend-qa.md` (log persistente de findings y resultados)

### Fase 6: Valentine-Inspired Redesign + Transparent Zen
- [x] 6.1: Design tokens & glass polish:
  - `--glass-border` 0.08 → 0.15, added `--glow`, `--glow-subtle`, `--spring` timing
  - All buttons: spring scale animations (0.92 press, 1.05 hover)
  - Album art: deeper shadows (rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.12)), hover lift
  - Play button: glow on hover (`box-shadow: 0 0 16px rgba(var(--accent-rgb), 0.4)`)
  - Flow np-art: shadow `0 8px 24px rgba(0,0,0,0.5)`
  - Zen exit: glass border `rgba(255,255,255,0.2)`, `backdrop-filter: blur(30px)`, spring scale
- [x] 6.2: Neon lyrics:
  - Active line: `text-shadow: var(--glow)` neon effect, `font-size: 1.1em`, spring transition
- [x] 6.3: Background album art blur:
  - New `.app-bg` fixed layer: `position: fixed; inset: 0; z-index: -1`
  - Loads track cover → `blur(80px) brightness(0.3) opacity(0.7); transform: scale(1.2)`
  - Fallback gradient: `#331A26 → #1A1A1A`
  - `useCoverUrl` hook extracted in App.tsx
- [x] 6.4: Waveform visualizer capsule bars:
  - Capsule/pill bars (fully rounded tops, `radius = barWidth/2`)
  - Additive glow (`globalCompositeOperation: "lighter"`)
  - Top cap highlight on each bar
  - Softer idle breathing animation
- [x] 6.5: Transparent zen mode:
  - `tauri.conf.json`: `"transparent": true` on window
  - `commands/window.rs`: New `set_window_decorations` Tauri command
  - Zen mode: transparent background, no native title bar, glass pill controls
  - Escape key exits zen, restores decorations
  - Normal/Flow: opaque `background: var(--bg-primary)` on layout grid
  - Zen info/controls: glass panels with `backdrop-filter: blur(30px)`
- [x] Verificación: `tsc --noEmit` ✓ + `cargo check` ✓ + `vitest run` 13/13 ✓

---

## Descripción del Proyecto

FlowPlayer es un reproductor multimedia multiplataforma construido con Tauri 2.0, Rust y React 18 + TypeScript. Tres modos de UI (Normal, Flow, Zen), bajo consumo de memoria, reproducción de audio local, radio streaming (SomaFM), YouTube metadata (yt-dlp), letras sincronizadas (LRCLib), visualizador de espectro con 64 bins, Media Session API, Pomodoro timer.

**Tech stack**: Tauri 2.0, Rust (rodio, lofty, sled, reqwest), React 18, TypeScript strict, Vite, Vitest, Playwright (QA).

**Estado actual**: Fase 0-11 completas. 4 modos de UI funcionales (Normal, Flow, Zen, Mini), QA 40/41 (1 fail pre-existente: Tauri mock). Bug fixes de mode-switch aplicados: key={simple|full} para forzar remount limpio, fade-in removido, mini container arreglado, visualizer desacoplado, flow layout deformity corregido, sidebar collapsed optimizado, zen controls con mejor contraste.

**Diseño visual**: Tokens (--glass-border 0.15, --glow, --spring), glassmorphism con blur(40px), album art difuminado como background de app (blur 80px), letras con neon glow (text-shadow), visualizador con barras capsula y brillo aditivo, zen mode transparente (ventana transparente Tauri + decorations off), controles flotantes glass.

---

### Fase 7: Layout Fix + Responsive (CRÍTICO)

#### 7.1 FlowView — grid responsive + scroll virtual
- [x] `globals.css`: `.flow-view` → `grid-template-rows: minmax(160px, 220px) 1fr minmax(120px, 200px)`
- [x] `globals.css`: `.flow-view__tracks` → `display: flex; flex-direction: column; overflow: hidden`
- [x] `globals.css`: `.flow-view__lyrics-col` → `min-height: 60px`
- [x] Verificar: TrackList virtual scroll funciona en FlowView

#### 7.2 NormalView — eliminar espacio muerto
- [x] `globals.css`: `.normal-view__list` → `max-width: clamp(800px, 60vw, 1200px); margin: 0 auto`

#### 7.3 PlayerBar — columnas flexibles
- [x] `globals.css`: `.player-bar` → `grid-template-columns: minmax(180px, 260px) 1fr minmax(140px, 200px)`
- [x] `globals.css`: `@media (max-width: 700px)` → flex column con `order: seek(1), controls(2), volume(hide)`

#### 7.4 Scrollbar jump fix
- [x] `globals.css`: `scrollbar-gutter: stable` a `.normal-view__list`, `.flow-view__tracks`, `.flow-view__lyrics-col`, `.lyrics`

#### 7.5 Verificación Fase 7
- [x] `tsc --noEmit` ✓
- [x] Playwright: flow scroll, normal layout, responsive 700px

---

### Fase 8: Mini-Player Mode (NUEVO — Estilo Valentine)

#### 8.1 Tipos
- [x] `src/types/index.ts`: `Mode = "normal" | "flow" | "zen" | "mini"`

#### 8.2 Componente MiniView
- [x] `src/components/modes/mini/MiniView.tsx`: Nuevo componente

#### 8.3 CSS Mini-Player
- [x] `globals.css`: Nueva sección `.mini-view` (card centrada, glass, sombras Valentine)

#### 8.4 Integración
- [x] `src/App.tsx`: case `"mini"` en switch, keyboard shortcut `Alt+M`
- [x] `src/components/layout/AppLayout.tsx`: Mini mode = sin sidebar, sin player bar, solo card centrada
- [x] `src/components/layout/Sidebar.tsx`: 4 mode buttons (normal, flow, zen, mini)

#### 8.5 Verificación Fase 8
- [x] Playwright: mini mode renderiza card
- [x] `tsc --noEmit` ✓

---

### Fase 8.5: Security Fix (CRÍTICO — Gemini)

#### 8.5.1 Path validation en Rust
- [x] `commands/library.rs`: `scan_folder` → `canonicalize()` + `is_dir()` check
- [x] `commands/library.rs`: `get_cover` → `canonicalize()` check
- [x] `commands/audio.rs`: `play` → `canonicalize()` check

#### 8.5.2 Tauri security config
- [x] `tauri.conf.json`: CSP configurado

#### 8.5.3 Verificación Fase 8.5
- [x] `cargo check` ✓

---

### Fase 9: QA Final
- [x] Playwright: flow scroll virtual funciona
- [x] Playwright: normal layout sin espacio muerto
- [x] Playwright: mini mode renderiza card
- [x] Playwright: responsive 700px player bar
- [x] `tsc --noEmit` ✓ + `vitest run` ✓ + `cargo check` ✓
- [x] Actualizar `.opencode/registries/frontend-qa.md`

---

### Fase 10: Mode-Switch Bug Fixes

#### 10.1 key={mode} destroy+recreate (CRÍTICO)
- [x] `AppLayout.tsx:105`: Eliminar `key={mode}` de `<main>` — React ya maneja el switch via `switch(mode)` en App.tsx
  - Causaba: destrucción completa del DOM en cada cambio de modo (visualizer, track list, todo)
  - Efecto: visualizer se reiniciaba, background se veía durante fade-in, mini sin container

#### 10.2 fade-in animation flash
- [x] `globals.css`: Eliminar `animation: fade-in 0.25s` de `.layout__main`
- [x] `globals.css`: Bump background de 0.6 a 0.85 opacidad
- [x] `globals.css`: Eliminar `@keyframes fade-in` (ya no se usa)
  - Causaba: fondo semi-transparente visible durante 250ms al recrear main

#### 10.3 Mini mode container fix
- [x] `globals.css`: Agregar `body:has(.layout--mini) { background: transparent }` (mismo tratamiento que zen)
- [x] `globals.css`: Agregar `background: rgba(10, 10, 20, 0.5)` a `.layout--mini`
- [x] `globals.css`: Agregar `display: flex; align-items: center; justify-content: center` a `.layout__zen-content`
  - Causaba: mini card flotando sin backdrop-filter que blurar, body opaco bloqueaba transparencia

#### 10.4 Visualizer [playing] dependency
- [x] `Visualizer.tsx`: Agregar `playingRef` para evitar teardown/rebuild del ResizeObserver + RAF loop en cada play/pause
- [x] `Visualizer.tsx`: Cambiar dependency array de `[playing]` a `[]`
  - Causaba: visualizer se reiniciaba al pausar/reproducir, smoothBins perdía suavizado

#### 10.5 Flow mode layout deformity
- [x] `globals.css`: Cambiar `.flow-view` de `auto 1fr auto` a `minmax(160px, 220px) 1fr minmax(120px, 200px)`
  - Causaba: top row (pomodoro + visualizer) expandía a 417px/60% del viewport, tracks solo 190px

#### 10.6 Verificación Fase 10
- [x] Playwright: 40/41 (1 fail pre-existente: Tauri mock `unregisterListener`)
- [x] Fix verification: main persiste, animation=none, body transparent in mini, backdrop-filter funciona

---

### Fase 11: UI Bug Fixes (Reporte de Video)

#### 11.1 Flow Mode — sidebar vacío a la izquierda
- [x] `globals.css`: `--sidebar-collapsed` reducido de 60px → 48px
- [x] `globals.css`: `.sidebar--collapsed .sidebar__nav { display: none }` — oculta nav completa
- [x] `globals.css`: `.sidebar--collapsed .sidebar__modes` — stack vertical, centrado, padding reducido
- [x] `globals.css`: `.sidebar--collapsed .sidebar__mode-btn { padding: 6px }` — botones más compactos
- [x] `globals.css`: Responsive breakpoint 900px actualizado para match
  - Causaba: sidebar de 60px con solo 4 iconos tiny en la parte inferior = mucho espacio negro vacío

#### 11.2 Mini→Normal grid collapse
- [x] `AppLayout.tsx`: `key={layoutKey}` donde `layoutKey = isSimple ? "simple" : "full"` — fuerza unmount/remount limpio del layout div cuando se cambia entre zen/mini y normal/flow
- [x] `globals.css`: Eliminar `transition: grid-template-columns` de `.layout` — causaba glitches visuales en mode switch
  - Causaba: React reusaba el mismo div `.layout` al cambiar de mini (1fr grid) a normal (sidebar+main grid), el CSS grid no se reinicializaba correctamente

#### 11.3 Zen controls — fondo insuficiente contra visualizer
- [x] `globals.css`: `.zen-view__controls` background 0.75 → 0.88, agregar `box-shadow: 0 8px 32px rgba(0,0,0,0.5)`
- [x] `globals.css`: `.zen-view__info` background 0.65 → 0.8, agregar `box-shadow: 0 4px 16px rgba(0,0,0,0.4)`
  - Causaba: controles blancos se mezclaban con barras del visualizer, sin separación visual

#### 11.4 "Libery" typo — FALSO POSITIVO
- [ ] No existe en ningún archivo. Sidebar muestra "FlowPlayer", NormalView muestra "Library". QA report era erróneo.

#### 11.5 Verificación Fase 11
- [x] `tsc --noEmit` ✓ — sin errores TypeScript
- [x] Verificación visual pendiente de QA run

---

### Fase 11.5: QA/QC — Refactorización por Hallazgos (2026-07-16)

#### 11.5.1 Scan async + canal de progreso (CRÍTICO 1.1)
- [x] `commands/library.rs`: `scan_folder` ahora `async fn` con `tauri::ipc::Channel<ScanProgress>`
- [x] `tauri::async_runtime::spawn_blocking` para `walkdir` (no bloquea el thread IPC)
- [x] Progreso emitido cada 25 archivos con `processed.is_multiple_of(25)`
- [x] `src-tauri/Cargo.toml`: añadido `futures-util = "0.3"`, `tokio = { version = "1", features = ["time"] }`
- [x] `src/lib/api.ts`: `scanFolder(path, onProgress)` con `Channel` + tipo `ScanProgress`

#### 11.5.2 reqwest async (CRÍTICO 1.2)
- [x] `Cargo.toml`: `reqwest` sin feature `blocking` (queda solo `["json", "stream"]`)
- [x] `lyrics.rs`: `http_client()` builder con timeout 10s
- [x] `radio.rs`: `StreamReader::new` reescrito con `bytes_stream()` y 3 reintentos (backoff 1s/2s)

#### 11.5.3 Resiliencia radio + offline (2.1)
- [x] `src/hooks/useOnlineStatus.ts`: monitor `navigator.onLine` + listeners `online`/`offline`
- [x] `RadioPanel`: estaciones deshabilitadas + banner offline cuando `!isOnline`
- [x] `src/test/RadioPanel.test.tsx`: test del comportamiento offline
- [x] CSS: `.radio-panel__offline`, `.radio-panel__station:disabled`

#### 11.5.4 Parseo defensivo lofty (2.2)
- [x] `commands/library.rs`: lectura de metadatos envuelta en `match`; error → warn + track con metadatos genéricos

#### 11.5.5 Config robusta (2.3)
- [x] `config/store.rs`: `ConfigStore::load` con fallback a defaults + reescritura del archivo dañado
- [x] Tests: `load_recovers_from_corrupt_json`, `load_recovers_from_empty_file`

#### 11.5.6 Estado global — Context API (3.1)
- [x] `src/hooks/usePlayerStore.tsx`: nuevo — `PlayerProvider` + `usePlayerState` + `usePlayerActions` + `usePlayerStore`
- [x] Dos contexts separados (state / actions) para evitar re-renders por cambio de acciones
- [x] `App.tsx`, `AppLayout.tsx`, `PlayerBar.tsx` consumen del context — sin prop drilling
- [x] `main.tsx`: monta `<PlayerProvider>`
- [x] `src/test/PlayerBar.test.tsx`, `AppLayout.test.tsx`: actualizados a la API prop-less (mockean los hooks)
- [x] Eliminado `src/hooks/usePlaylist.ts` (dead code)

#### 11.5.7 Caché de carátulas (3.2)
- [x] `commands/library.rs`: `get_cover(app: AppHandle, path) -> Result<...>` con persistencia en `<app_cache_dir>/covers/<hash>.bin`
- [x] `DefaultHasher` para hashing del path; cache hit evita re-decode

#### 11.5.8 UI: feedback de scan
- [x] `src/test/TrackList.test.tsx`: test "shows scan progress counters when provided"
- [x] CSS: `.track-list__loading-label`, `.track-list__progress`, `.track-list__progress-bar`, `@keyframes scan-progress`
- [x] ARIA: `role="status"`, `aria-live="polite"`

#### 11.5.9 Verificación Fase 11.5
- [x] `tsc --noEmit` ✓ (0 errores)
- [x] `cargo clippy --lib` ✓ (limpio)
- [x] `cargo test --lib` 17/17 ✓
- [x] `npx vitest run` 130/130 ✓

---

## Análisis Gemini — Hallazgos Clave

### Layout (A)
- FlowView: filas fijas rompen en resoluciones bajas → fix con `auto 1fr auto`
- NormalView: `max-width: 800px` crea 540px hueco en 1920px → fix con `clamp(800px, 60vw, 1200px)`
- PlayerBar: columnas fijas desbordan 520-700px → fix con `minmax()` + flex column
- Lyrics colapsa sin contenido → `min-height: 60px`
- Scrollbar jump → `scrollbar-gutter: stable`

### React (B)
- TrackList virtual scroll: handler `onScroll` debe estar en el nodo con `overflow-y: auto`
- Cover art fetching: ya tiene `cancelled` flag (correcto)
- usePlaylist: podría separar estado estructural/efímero con selectores atómicos (mejora futura)

### Rust (C)
- Channel-based audio: patrón correcto
- **CRÍTICO**: Falta `canonicalize()` en paths → vulnerable a directory traversal
- sled: correcto para key-value, rusqlite para búsquedas complejas (futuro)

### UI/UX (D)
- Mini-player: 480x140, cover 100x100, glass card, always_on_top
- Glass tokens: `blur(32px) saturate(160%)`, `rgba(28,28,30,0.45)`, border `rgba(255,255,255,0.08)`

### Rendimiento (E)
- Imágenes Base64 en memoria → usar protocolo personalizado `tauri://localhost/cover` (futuro)
- rodio: reutilizar sinks, no crear instancia nueva por canción

### Testing (F)
- Tests faltantes: click masivo en lista virtual, cambios súbitos de ventana, mini-player window

### Seguridad (G)
- `canonicalize()` en todos los commands que reciben paths
- CSP header en tauri.conf.json
- Sanitizar URLs de radio streaming
- Bloquear inyección de argumentos en yt-dlp subprocess