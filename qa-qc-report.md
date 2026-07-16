# Reporte de Auditoría QA/QC Fullstack - FlowPlayer

Este informe técnico documenta todos los errores, vulnerabilidades, cuellos de botella de rendimiento y malas prácticas arquitectónicas identificados en el proyecto **FlowPlayer** que impiden que sea un producto listo para producción (Production-Grade).

---

## 📊 Resumen Ejecutivo
*   **Plataforma**: Tauri v2 + React (TypeScript) + Rust (Rodio, Lofty).
*   **Estado General**: Funcional en desarrollo, pero con graves bloqueos de hilos (Thread Blocking) en el backend de Rust y carencia de resiliencia en red y almacenamiento local.
*   **Enfoque de este informe**: Servir como especificación técnica directa para que un agente de desarrollo (como Claude Code o un desarrollador senior) ejecute las refactorizaciones necesarias.

---

## 🟥 1. Bloqueadores Críticos de Producción (Severidad: Alta)

### 1.1 Escaneo de Biblioteca Síncrono y Bloqueante (`walkdir` sin concurrencia)
*   **Descripción**: La funcionalidad de escanear la carpeta de música utiliza `walkdir` de forma síncrona en el hilo principal de comandos IPC de Tauri.
*   **Impacto**: Si un usuario selecciona una carpeta con miles de archivos (ej: su carpeta `C:\` o un disco externo grande), la aplicación de escritorio se congelará por completo (estado *"No Responde"* en Windows) hasta que el escaneo termine.
*   **Solución Recomendada**:
    *   Reescribir el comando de escaneo para que sea asíncrono (`async fn`).
    *   Ejecutar el escaneo en un hilo de trabajo en segundo plano usando `tokio::task::spawn_blocking` o `rayon`.
    *   Implementar un canal de eventos de Tauri (`emit`) para reportar progreso progresivo (`scan-progress`) a la interfaz de usuario en lugar de devolver la lista completa al final de una sola llamada IPC bloqueante.

### 1.2 Uso de reqwest Síncrono (`reqwest/blocking` en el Backend)
*   **Descripción**: El archivo `Cargo.toml` incluye la característica `blocking` de `reqwest` y se utiliza para descargar la lista de radios y resolver metadatos de YouTube de forma síncrona.
*   **Impacto**: Las llamadas a redes externas (como listar emisoras de radio o resolver URLs de streaming de YouTube) bloquean el pool de ejecución de Tauri. Si la conexión a internet es lenta o falla, la UI experimenta lag severo e interrupciones en la animación del espectro rítmico.
*   **Solución Recomendada**:
    *   Remover la dependencia `"blocking"` de `reqwest`.
    *   Hacer que todos los comandos Tauri de red utilicen llamadas asíncronas de Rust con `await`.
    *   Implementar tiempos de espera límite (`timeout`) cortos (máximo 5-10 segundos) para evitar llamadas colgadas indefinidamente.

### 1.3 Extracción Frágil de Streams de YouTube (`youtube.rs`)
*   **Descripción**: La reproducción de audio desde YouTube depende de extraer directamente la URL del stream de audio. Los reproductores de audio que extraen streams crudos de YouTube sufren de roturas continuas debido a las actualizaciones periódicas de firmas y algoritmos de distribución de la plataforma.
*   **Impacto**: Sin un proxy intermedio, un sistema de descifrado dinámico de firmas o una librería robusta actualizada de forma continua (como `yt-dlp`), el soporte de YouTube dejará de funcionar en cuestión de semanas o meses.
*   **Solución Recomendada**:
    *   Agregar un mecanismo de fallback para intentar resolver la URL mediante una API puente configurable o levantar un servicio local ligero que maneje las firmas actualizadas de forma dinámica.
    *   Retornar códigos de error amigables en la UI (`STREAM_DECRYPTION_FAILED`) en lugar de fallar silenciosamente.

---

## 🟨 2. Fallas de Resiliencia y Manejo de Errores (Severidad: Media)

### 2.1 Cero Mecanismo de Reintento y Estado Offline (Red)
*   **Descripción**: La reproducción de radios por Internet (SomaFM, etc.) asume que la red está disponible al 100%. Si la red cae temporalmente, la reproducción se detiene sin intentar reconectar y la UI no muestra ningún mensaje indicando desconexión física.
*   **Impacto**: Mala experiencia de usuario al usar radios en conexiones inestables.
*   **Solución Recomendada**:
    *   Implementar un monitor de estado de red (`navigator.onLine`) en el frontend.
    *   En el backend, configurar `rodio` para manejar buffers de red de mayor capacidad y reintentar la conexión del flujo de datos hasta 3 veces antes de arrojar un error de decodificación.

### 2.2 Parseo de Metadatos de Archivos Dañados (Lofty)
*   **Descripción**: Al escanear canciones locales, la librería `lofty` lee las etiquetas ID3/Vorbis. Si un archivo de música está parcialmente corrupto o tiene etiquetas mal formadas, puede provocar errores que detienen todo el proceso de escaneo si no se atrapa el error individual por archivo.
*   **Impacto**: Un solo archivo de música corrupto en la carpeta del usuario puede arruinar la experiencia de escaneo de toda su librería.
*   **Solución Recomendada**:
    *   Envolver la llamada de lectura de metadatos de cada archivo en un bloque `match` o similar, registrando el error (`log::warn`) pero permitiendo que el bucle continúe agregando el archivo con metadatos genéricos (usando el nombre del archivo como título y sin artista) en lugar de cancelar el escaneo completo.

### 2.3 Ausencia de Validación de Configuración Local
*   **Descripción**: La configuración del reproductor (como la última carpeta de música abierta) se lee al iniciar. Si el archivo de configuración en disco se daña físicamente o contiene JSON inválido, el backend podría fallar al arrancar.
*   **Solución Recomendada**:
    *   Implementar un fallback automático: si la lectura de la configuración falla por cualquier motivo, se debe sobreescribir el archivo dañado con los valores de configuración por defecto y continuar la ejecución en lugar de propagar un error fatal.

---

## 🟦 3. Mejoras Arquitectónicas y UX (Severidad: Baja / Optimización)

### 3.1 Crecimiento y Escalabilidad de Estado en Frontend
*   **Descripción**: Actualmente se utiliza *Prop Drilling* para propagar el estado de reproducción (`currentTrack`, `volume`, `repeat`) desde `App.tsx` hacia los layouts y vistas secundarias.
*   **Impacto**: Difícil mantenimiento a largo plazo y propensión a renderizados redundantes.
*   **Solución Recomendada**:
    *   Migrar el estado global del reproductor a un manejador ligero como **Zustand** o utilizar un **React Context** específico para la sesión de audio.

### 3.2 Ausencia de Caching de Carátulas de Álbum
*   **Descripción**: El reproductor busca y lee las imágenes de portada integradas en los metadatos de los archivos locales cada vez que se selecciona una canción.
*   **Impacto**: Carga repetida de disco I/O y uso innecesario de memoria RAM al extraer la imagen repetidas veces.
*   **Solución Recomendada**:
    *   Crear una caché en segundo plano para las carátulas extraídas (ej: guardarlas temporalmente en el directorio de caché de la app como hashes md5 del path del archivo) y servir enlaces rápidos.

---

## 🛠️ Checklist Técnico para Refactorización (Claude Code)

- [ ] **1. Async Rust Refactor**: Cambiar hilos bloqueantes de `walkdir` y `reqwest` en `src-tauri` a firmas asíncronas (`async/await`) utilizando `tokio`.
- [ ] **2. Scan Progress Channel**: Configurar `tauri::ipc::Channel` o emitir eventos periódicos durante el escaneo de directorios masivos.
- [ ] **3. Resilience Wrapper**: Crear un manejador seguro en `audio/` para capturar errores de decodificación de `rodio` e informar de manera síncrona a la interfaz.
- [ ] **4. Zustand Migration**: Encapsular el estado de reproducción del frontend en un store unificado, aliviando la complejidad en `AppLayout.tsx`.
