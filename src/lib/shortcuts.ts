export interface ShortcutInfo {
  keys: string;
  description: string;
}

export const SHORTCUTS: ReadonlyArray<ShortcutInfo> = [
  { keys: "Espacio", description: "Reproducir / pausar" },
  { keys: "Ctrl+K", description: "Ir a Buscar" },
  { keys: "Ctrl+O", description: "Abrir carpeta de música" },
  { keys: "Ctrl+Shift+O", description: "Abrir archivo" },
  isAndroid
    ? { keys: "Alt+N / Alt+Z", description: "Modos Normal / Zen" }
    : { keys: "Alt+N / Alt+F / Alt+Z / Alt+M", description: "Modos Normal / Flow / Zen / Mini" },
  { keys: "Esc", description: "Salir de Zen o cerrar Reproduciendo" },
  { keys: "Ctrl+→ / Ctrl+←", description: "Siguiente / anterior" },
  { keys: "Ctrl+↑ / Ctrl+↓", description: "Subir / bajar volumen" },
  { keys: "S", description: "Activar o desactivar aleatorio" },
  { keys: "R", description: "Cambiar modo de repetición" },
];

export function shortcutsText(): string {
  return ["Atajos de teclado", "", ...SHORTCUTS.map((shortcut) => `${shortcut.keys}: ${shortcut.description}`)].join("\n");
}
import { isAndroid } from "./platform";
