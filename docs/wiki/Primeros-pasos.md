# Primeros pasos

## Objetivo

Abrir FlowPlayer en Windows, elegir una carpeta y reproducir una pista. Si ya tenés un instalador generado desde este proyecto, podés empezar directamente por «Tu primera reproducción».

## Preparar el equipo

1. Instalá Node.js 22 o superior, npm y Git.
2. Instalá Rust estable para Windows MSVC.
3. Instalá Visual Studio Build Tools con C++ y Windows SDK.
4. Comprobá que Microsoft Edge WebView2 Runtime esté disponible.
5. Cloná el repositorio e instalá sus dependencias:

```powershell
git clone https://github.com/FabianGallardo-coder/reproducto_mpn.git
Set-Location reproducto_mpn
npm ci
npm run tauri dev
```

La primera compilación Rust puede tardar varios minutos. Esperá la ventana FlowPlayer; abrir solamente la dirección de Vite en un navegador no proporciona el backend.

La configuración espera un sidecar `yt-dlp` para las funciones de YouTube. En Windows está configurado como `src-tauri\binaries\yt-dlp-x86_64-pc-windows-msvc.exe`. No reemplaces ese ejecutable por descargas de origen desconocido.

## Tu primera reproducción

1. Abrí **Configuración** y seleccioná la carpeta de música.
2. Esperá a que termine el escaneo.
3. Entrá en **Biblioteca** y seleccioná una pista.
4. Usá la barra inferior para pausar, avanzar, cambiar volumen o buscar una posición.
5. Pulsá la información de la pista para abrir **Reproduciendo**.

El escaneo lee archivos; no importa ni mueve tu biblioteca. Los formatos habituales incluyen MP3, WAV, FLAC, OGG, M4A, AAC y Opus, sujetos a la compatibilidad del decodificador y a la integridad del archivo.

## Siguiente paso

Consultá [Biblioteca y playlists](Biblioteca-y-playlists.md), o [YouTube y radio](YouTube-y-radio.md) para fuentes en línea. Si no se oye audio, seguí [Solución de problemas](Solucion-de-problemas.md).
