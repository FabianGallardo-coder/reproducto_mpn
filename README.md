# FlowPlayer

> Reproductor multimedia multiplataforma con tres modos de UI (Normal, Flow, Zen) y bajo consumo de memoria.

## Descripción

FlowPlayer es un reproductor multimedia construido con Tauri 2.0, Rust y React 18 + TypeScript. Ofrece tres modos de UI diseñados para diferentes estados de enfoque y consumo de medios, manteniendo un bajo consumo de recursos (<150 MB de RAM en idle).

## Características

- **Multiplatform**: Windows 10+, macOS 12+, Ubuntu 22.04+
- **Tres modos de UI**:
  - **Modo Normal**: Interfaz completa con barra lateral expandible, vista con pestañas y PlayerBar persistente.
  - **Modo Flow**: Enfoque en productividad con barra lateral colapsable, vista minimalista y temporizador Pomodoro integrado.
  - **Modo Zen**: Experiencia inmersiva con barra de título auto-ocultable, visualización a pantalla completa y controles ocultos.
- **Reproducción de audio**:
  - Archivos locales (MP3, FLAC, WAV, etc.)
  - Integración con Spotify (API oficial)
  - Streaming de YouTube (mediante yt-dlp)
  - Soporte para streams de radio por Internet
- **Gestión de listas de reproducción**: crear, guardar, cargar, reordenar, mezclar y repetir.
- **Visualizaciones de audio**: forma de onda, espectro de frecuencia y arte de álbum.
- **Optimización de recursos**:
  - Tipado estricto de TypeScript (sin `any`).
  - Manejo adecuado de errores en Rust (sin `unwrap`/`expect`).
  - Carga perezosa y división de código.
  - Caché eficiente de metadata con base de datos embebida `sled`.
  - Listas virtualizadas para grandes colecciones.
- **Seguridad**:
  - Almacenamiento seguro de credenciales mediante almacenes nativos del sistema.
  - Validación y saneamiento de entradas en la comunicación IPC.
- **Pruebas**: pruebas unitarias y de integración para frontend y backend.

## Estructura del proyecto

```
src/
  ├── components/
  │   ├── layout/          # PlayerBar, Sidebar, etc.
  │   ├── ui/              # Componentes UI genéricos
  │   └── modes/           # Componentes específicos de cada modo
  │       ├── normal/
  │       ├── flow/
  │       └── zen/
  ├── hooks/               # Hooks personalizados de React
  ├── lib/                 # Lógica de dominio
  │   ├── audio/
  │   ├── playlist/
  │   ├── providers/
  │   └── utils/
  ├── styles/              # Estilos y temas
  │   ├── themes/
  │   └── globals.css
  ├── App.tsx
  └── main.tsx

src-tauri/
  └── src/
      ├── lib.rs           # Lógica del backend Rust
      ├── commands.rs      # Comandos Tauri (IPC)
      ├── events.rs        # Manejo de eventos Tauri
      └── main.rs          # Punto de entrada de Tauri
```

## Tecnologías principales

- **Tauri 2.0** – Framework para aplicaciones de escritorio ligeras.
- **Rust** – Lógica de backend, procesamiento de audio y seguridad.
- **React 18 + TypeScript 5.0** – Interfaz de usuario con tipado estricto.
- **rodio** – Biblioteca de reproducción de audio en Rust.
- **sled** – Base de datos embebida para caché de metadata.
- **yt-dlp** – Herramienta para obtener audio de YouTube.

## Cómo comenzar

### Requisitos previos

- [Rust](https://www.rust-lang.org/tools/install) (versión estable)
- [Node.js](https://nodejs.org/) (>= 18)
- [pnpm](https://pnpm.io/) o [npm](https://www.npmjs.com/)
- Dependencias del sistema para Tauri (consultar [docs de Tauri](https://tauri.app/v1/guides/getting-started/prerequisites))

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/flowplayer.git
cd flowplayer

# Instalar dependencias del frontend
pnpm install   # o npm install

# Construir y ejecutar en modo desarrollo
pnpm tauri dev   # o npm run tauri dev
```

### Empaquetado para producción

```bash
pnpm tauri build   # o npm run tauri build
```

Los binarios se generarán en `src-tauri/target/release/bundle/`.

## Métricas de rendimiento (objetivo)

- **Memoria en reposo**: <150 MB RAM
- **Memoria máxima durante reproducción**: <250 MB
- **Tiempo de arranque**: <2 segundos hasta primera imagen renderizada
- **Latencia de respuesta a comandos**: <100 ms (play/pause, seek)
- **Carga de lista de reproducción**: <500 ms para 1000 pistas

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
- [sled-db](https://github.com/sled-db/sled) por la base de datos embebida.
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) por la extracción de audio de YouTube.
- La comunidad de código abierto por las bibliotecas y herramientas utilizadas.

---  
*FlowPlayer – Enfócate en la música, no en la interfaz.*