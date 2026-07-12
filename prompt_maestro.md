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

### Fase 3: Integraciones (pendiente)
- [ ] 3.1: Spotify OAuth completo (token storage + refresh)
- [ ] 3.2: YouTube metadata (una implementación)
- [ ] 3.3: Radio streaming (SomaFM presets)

### Fase 4: Testing + CI (pendiente)
- [ ] 4.1: Rust unit tests
- [ ] 4.2: Frontend tests (vitest)
- [ ] 4.3: GitHub Actions CI

---

 You are tasked with creating a modern, efficient multimedia player application called "FlowPlayer" (formerly
  reproductor_mpn) with the following specifications:

  CORE REQUIREMENTS

  1. Multiplatform Support: Must run on Windows 10+, macOS 12+, and Ubuntu 22.04+
  2. Three Distinct UI Modes:
    - Modo Normal: Complete interface with administration features, expanded sidebar, tabbed main view
    - Modo Flow: Productivity-focused with collapsible sidebar, minimal main view, integrated Pomodoro timer
    - Modo Zen: Immersive experience with auto-hiding title bar, full-screen visualizer, hidden controls on mouse
  movement
  3. Low RAM Usage: Target <150MB idle, <250MB during active playback with visualization
  4. Modern Technology Stack: Tauri 2.0 with Rust backend and React 18 + TypeScript 5.0 frontend

  TECHNICAL SPECIFICATIONS

  Architecture

  - Backend: Rust for system-level operations, audio processing, and security
  - Frontend: React 18 with TypeScript 5.0 (strict typing, no 'any' types)
  - Communication: Bidirectional IPC via Tauri command/event system
  - State Management:
    - Frontend: useReducer + Context API for global state
    - Backend: Thread-safe state management with appropriate locking
  - Audio Engine: rodio for playback and stream management
  - Metadata Caching: sled embedded database with LRU eviction policy

  Core Features to Implement

  1. Audio Playback:
    - Local file playback (MP3, FLAC, WAV, etc.)
    - Spotify integration (via official API)
    - YouTube audio streaming (via yt-dlp or similar)
    - Internet radio stream support
    - Playlist management (create, save, load, reorder, shuffle, repeat)
    - Basic controls: play/pause, seek, volume, next/previous
  2. Visualization:
    - Waveform display
    - Frequency spectrum visualization
    - Album art display
    - Mode-specific visualizers (minimal in Flow, immersive in Zen)
  3. Three UI Modes Implementation:
    - Normal Mode:
        - Expandable sidebar with full navigation (library, playlists, radios, settings)
      - Tabbed main interface (playlist, file explorer, settings)
      - Persistent PlayerBar with full controls
      - Detailed track information panel
      - Advanced visualization panel
    - Flow Mode:
        - Collapsible sidebar (icons-only, expands on hover)
      - Minimal main view (essential track info only)
      - Simplified PlayerBar (play/pause, compact seek, volume)
      - Subtle audio visualization
      - Integrated Pomodoro timer
      - Focus mode to block distractions
    - Zen Mode:
        - Auto-hiding custom title bar
      - Full-screen audio visualization/album art
      - Hidden controls (appear on mouse movement or Ctrl+Alt+H)
      - Minimal progress indicator
      - Optional taskbar/dock hiding
      - Dynamic background responding to audio
  4. Technical Excellence:
    - Strict TypeScript throughout frontend (zero 'any' types)
    - Proper Rust error handling (no unwrap()/expect(), use ? operator)
    - Component optimization (React.memo, useCallback, useMemo)
    - Lazy loading of routes and heavy components
    - Virtualized lists for large playlists
    - Efficient audio buffering to prevent xruns
    - Graceful degradation for failed services
    - Secure credential storage (system keychains)
    - Input validation and sanitization for all IPC

  File Structure

  src/
    ├── components/
    │   ├── layout/          # PlayerBar, Sidebar, etc.
    │   ├── ui/              # Generic UI components
    │   └── modes/           # Mode-specific components
    │       ├── normal/
    │       ├── flow/
    │       └── zen/
    ├── hooks/               # Custom React hooks
    ├── lib/                 # Domain logic
    │   ├── audio/
    │   ├── playlist/
    │   ├── providers/
    │   └── utils/
    ├── styles/              # CSS/SCSS and themes
    │   ├── themes/
    │   └── globals.css
    ├── App.tsx
    └── main.tsx

  src-tauri/
    └── src/
        ├── lib.rs           # Backend logic
        ├── commands.rs      # Tauri IPC commands
        ├── events.rs        # Tauri event handling
        └── main.rs          # Tauri entry point

  Key Technical Improvements Over Original

  1. Type Safety: Complete migration to strict TypeScript with proper interfaces
  2. Error Handling:
    - Frontend: Error boundaries + user-friendly messages
    - Backend: Result<T, E> propagation, custom error types
  3. Performance:
    - Lazy loading and code splitting
    - Efficient metadata caching with sled
    - Optimized audio buffers
    - Virtualized long lists
  4. Architecture:
    - Clear separation of concerns
    - Provider pattern for audio sources
    - Modular UI mode implementation
    - Efficient frontend-backend contracts

  Success Metrics

  - Memory Usage: <150MB RAM idle, <250MB max during playback
  - Startup Time: <2 seconds to first interactive UI
  - Response Latency: <100ms for basic commands (play/pause, seek)
  - Playlist Loading: <500ms for 1000-track playlist
  - Stability: <1 unexpected restart/month in normal use
  - User Satisfaction: Minimum 4/5 usability score after 1-week trial

  Implementation Approach

  This should be implemented as an evolution of the existing Tauri-based codebase rather than a complete rewrite,
  leveraging the existing project structure while implementing all the technical improvements outlined above. Focus on:
  1. First establishing code quality foundations (strict typing, proper error handling)
  2. Then implementing the three UI modes with their distinct characteristics
  3. Adding core audio functionality and visualization
  4. Implementing service integrations (Spotify, YouTube, radio)
  5. Optimizing performance and memory usage
  6. Adding polish and user experience refinements

  This prompt encapsulates the complete plan for reconstructing the reproductor_mpn project from scratch with the
  specified requirements and technical approach. You can use this as a starting point for implementation in a new
  directory.

  ## Ejemplos de repositorios útiles en GitHub

  - **tauri-apps/tauri** – Framework principal para construir aplicaciones de escritorio con Rust y frontend web.
  - **tauri-apps/create-tauri-app** – Plantilla para iniciar proyectos Tauri.
  - **rodio-rs/rodio** – Biblioteca de reproducción de audio en Rust utilizada en el backend.
  - **sled-db/sled** – Base de datos embebida rápida para caché de metadata.
  - **ahfarmer/react-player** – Componente React para reproducir multimedia desde múltiples fuentes.
  - **axios/axios** – Cliente HTTP para llamadas a APIs (Spotify, YouTube).
  - **mui/material-ui** – Biblioteca de componentes UI para React (opcional).
  - **pmndrs/zustand** – Gestión de estado ligera alternativa a Context API.
  - **yt-dlp/yt-dlp** – Herramienta para descargar audio de YouTube (uso mediante proceso hijo).

  ## Descripción para el repositorio en GitHub

  FlowPlayer es un reproductor multimedia multiplataforma construido con Tauri 2.0, Rust y React 18 + TypeScript. Ofrece tres modos de UI (Normal, Flow, Zen) para adaptarse a diferentes estados de enfoque y consumo de medios, con bajo consumo de memoria (<150 MB idle), reproducción de audio local, integración con Spotify y YouTube, visualizaciones de audio y gestión de listas de reproducción.