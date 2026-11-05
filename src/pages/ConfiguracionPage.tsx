import { useState } from "react";
import "../styles/pages/configuracion.css";
import { Page, Section } from "../components/ui/Page";
import { ConfirmAction } from "../components/ui/ConfirmAction";
import { ACCENTS, useAccentColor } from "../hooks/useAccentColor";
import { usePlayHistory } from "../hooks/usePlayHistory";
import { isModeAvailable, readStartMode, writeStartMode, type StartMode } from "../lib/startMode";
import { isAndroid } from "../lib/platform";
import { SHORTCUTS } from "../lib/shortcuts";
import type { PageProps } from "./pageTypes";

const START_MODES: ReadonlyArray<{ id: StartMode; label: string; hint: string }> = [
  { id: "normal", label: "Normal", hint: "Páginas completas con la barra lateral." },
  { id: "flow", label: "Flow", hint: "Barra lateral compacta, Pomodoro, visualizador y letras." },
];

export function ConfiguracionPage({ controls }: PageProps) {
  const [accent, setAccent] = useAccentColor();
  const [startMode, setStartMode] = useState<StartMode>(readStartMode);
  const { entries, clear } = usePlayHistory();

  const chooseStartMode = (mode: StartMode) => {
    writeStartMode(mode);
    setStartMode(mode);
  };

  return (
    <Page name="configuracion" title="Configuración" subtitle="Ajustá FlowPlayer a tu gusto. Los cambios se guardan en este equipo.">
      <Section id="library" title="Biblioteca">
        <div className="settings__row">
          <div className="settings__info">
            <p className="settings__label">Carpeta de música</p>
            <p className="settings__value">{controls.musicFolder || "Todavía no elegiste una carpeta."}</p>
          </div>
          <div className="settings__actions">
            <button type="button" className="button" onClick={controls.onSelectFolder}>Elegir carpeta</button>
            <button type="button" className="button" onClick={controls.onOpenFile}>Abrir archivo</button>
          </div>
        </div>
      </Section>

      <Section id="appearance" title="Apariencia">
        <div className="settings__group" role="radiogroup" aria-label="Color de acento">
          {ACCENTS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={accent === preset.id}
              className={`swatch ${accent === preset.id ? "swatch--active" : ""}`}
              onClick={() => setAccent(preset.id)}
            >
              <span className="swatch__dot" style={{ backgroundColor: preset.color }} aria-hidden="true" />
              {preset.label}
            </button>
          ))}
        </div>
      </Section>

      <Section id="modes" title="Modo al iniciar">
        <div className="settings__group" role="radiogroup" aria-label="Modo al iniciar">
          {START_MODES.filter((entry) => isModeAvailable(entry.id)).map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={startMode === entry.id}
              className={`option ${startMode === entry.id ? "option--active" : ""}`}
              onClick={() => chooseStartMode(entry.id)}
            >
              <span className="option__title">{entry.label}</span>
              <span className="option__hint">{entry.hint}</span>
            </button>
          ))}
        </div>
        <p className="settings__note">{isAndroid ? "Zen se activa desde la sección «Modos» de la barra lateral." : "Zen y Mini se activan desde la sección «Modos» de la barra lateral."}</p>
      </Section>

      <Section id="shortcuts" title="Atajos de teclado">
        <table className="settings__shortcuts">
          <caption className="visually-hidden">Atajos de teclado</caption>
          <thead>
            <tr><th scope="col">Atajo</th><th scope="col">Acción</th></tr>
          </thead>
          <tbody>
            {SHORTCUTS.map((shortcut) => (
              <tr key={shortcut.keys}>
                <th scope="row"><kbd>{shortcut.keys}</kbd></th>
                <td>{shortcut.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="data" title="Datos">
        <div className="settings__row">
          <div className="settings__info">
            <p className="settings__label">Historial de reproducción</p>
            <p className="settings__value">{entries.length} reproducciones guardadas en este equipo.</p>
          </div>
          <ConfirmAction label="Borrar historial" confirmLabel="Sí, borrar todo" disabled={!entries.length} onConfirm={clear} />
        </div>
      </Section>

      <Section id="about" title="Acerca de">
        <p className="settings__value">FlowPlayer 0.1.1 — reproductor de música hecho con Tauri 2, Rust y React.</p>
        <button type="button" className="button" onClick={controls.onShowAbout}>Ver detalles</button>
      </Section>
    </Page>
  );
}
