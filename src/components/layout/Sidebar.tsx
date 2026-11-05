import { memo, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Mode } from "../../types";
import { isModeAvailable } from "../../lib/startMode";
import { useNavigation, type LibrarySection, type Route } from "../../hooks/useNavigation";
import { usePlayerActions, usePlayerState } from "../../hooks/usePlayerStore";
import {
  DownloadIcon,
  FlowModeIcon,
  HeartIcon,
  HomeIcon,
  LibraryIcon,
  MiniModeIcon,
  NormalModeIcon,
  PlaylistIcon,
  PlusIcon,
  RadioIcon,
  SearchIcon,
  SettingsIcon,
  StatsIcon,
  ZenModeIcon,
} from "../ui/Icons";

type IconComponent = (props: { size?: number; className?: string }) => ReactNode;

const NAV_ITEMS: ReadonlyArray<{ route: Route; label: string; Icon: IconComponent }> = [
  { route: "inicio", label: "Inicio", Icon: HomeIcon },
  { route: "buscar", label: "Buscar", Icon: SearchIcon },
  { route: "biblioteca", label: "Biblioteca", Icon: LibraryIcon },
  { route: "estadisticas", label: "Estadísticas", Icon: StatsIcon },
  { route: "configuracion", label: "Configuración", Icon: SettingsIcon },
];

const MODES: ReadonlyArray<{ mode: Mode; label: string; shortcut: string; Icon: IconComponent }> = [
  { mode: "normal", label: "Normal", shortcut: "Alt+N", Icon: NormalModeIcon },
  { mode: "flow", label: "Flow", shortcut: "Alt+F", Icon: FlowModeIcon },
  { mode: "zen", label: "Zen", shortcut: "Alt+Z", Icon: ZenModeIcon },
  { mode: "mini", label: "Mini", shortcut: "Alt+M", Icon: MiniModeIcon },
];

interface Props {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

export function Sidebar({ mode, onModeChange }: Props) {
  const collapsed = mode === "flow";
  const { route, params, navigate: navigateTo } = useNavigation();
  const { favorites, customPlaylists } = usePlayerState();
  const { createPlaylist } = usePlayerActions();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  const navigate: typeof navigateTo = (target, targetParams) => {
    if (mode === "flow") onModeChange("normal");
    navigateTo(target, targetParams);
  };

  useEffect(() => {
    if (creating) nameInput.current?.focus();
  }, [creating]);

  const closeForm = () => {
    setCreating(false);
    setName("");
    setFormError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (customPlaylists.some((playlist) => playlist.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setFormError("Ya existe una playlist con ese nombre.");
      return;
    }
    try {
      await createPlaylist(trimmed);
      closeForm();
      navigate("biblioteca", { section: "playlist", playlist: trimmed });
    } catch (error) {
      setFormError(String(error));
    }
  };

  const isCollection = (section: LibrarySection, playlist?: string) =>
    route === "biblioteca" && params.section === section && (playlist === undefined || params.playlist === playlist);

  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`} aria-label="Navegación principal">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark" aria-hidden="true">
          <FlowModeIcon size={16} />
        </span>
        <span className="sidebar__title">FlowPlayer</span>
      </div>

      <nav className="sidebar__nav" aria-label="Secciones">
        {NAV_ITEMS.map(({ route: target, label, Icon }) => (
          <button
            key={target}
            type="button"
            className={`sidebar__nav-item ${!collapsed && route === target ? "sidebar__nav-item--active" : ""}`}
            aria-current={!collapsed && route === target ? "page" : undefined}
            aria-label={collapsed ? label : undefined}
            title={collapsed ? label : undefined}
            onClick={() => navigate(target)}
          >
            <Icon size={18} />
            <span className="sidebar__label">{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar__divider" role="presentation" />

      <button
        type="button"
        className="sidebar__new-playlist"
        aria-expanded={creating}
        aria-label="Nueva playlist"
        title={collapsed ? "Nueva playlist" : undefined}
        onClick={() => {
          if (collapsed) onModeChange("normal");
          if (creating) closeForm();
          else setCreating(true);
        }}
      >
        <PlusIcon size={16} />
        <span className="sidebar__label">Nueva playlist</span>
      </button>

      {creating && !collapsed && (
        <form className="sidebar__playlist-form" onSubmit={submit}>
          <input
            ref={nameInput}
            className="sidebar__playlist-input"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setFormError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") closeForm();
            }}
            placeholder="Nombre de la playlist…"
            aria-label="Nombre de la playlist"
            aria-invalid={formError ? true : undefined}
            autoComplete="off"
            maxLength={60}
          />
          {formError && <p className="sidebar__playlist-error" role="alert">{formError}</p>}
          <div className="sidebar__playlist-form-actions">
            <button type="submit" className="button button--primary">Crear playlist</button>
            <button type="button" className="button" onClick={closeForm}>Cancelar</button>
          </div>
        </form>
      )}

      <ul className="sidebar__playlists" aria-label="Playlists">
        <PlaylistLink
          title="Favoritos"
          subtitle={`${favorites.length} ${favorites.length === 1 ? "canción" : "canciones"}`}
          tone="favorites"
          active={!collapsed && isCollection("favoritos")}
          collapsed={collapsed}
          icon={<HeartIcon size={16} filled />}
          onClick={() => navigate("biblioteca", { section: "favoritos" })}
        />
        <PlaylistLink
          title="Descargas de YouTube"
          subtitle="Tu música guardada"
          tone="downloads"
          active={!collapsed && isCollection("descargas")}
          collapsed={collapsed}
          icon={<DownloadIcon size={16} />}
          onClick={() => navigate("biblioteca", { section: "descargas" })}
        />
        <PlaylistLink
          title="Radio"
          subtitle="Emisoras en línea"
          tone="radio"
          active={!collapsed && isCollection("radio")}
          collapsed={collapsed}
          icon={<RadioIcon size={16} />}
          onClick={() => navigate("biblioteca", { section: "radio" })}
        />
        {customPlaylists.map((playlist) => (
          <PlaylistLink
            key={playlist.name}
            title={playlist.name}
            subtitle={`${playlist.tracks.length} ${playlist.tracks.length === 1 ? "canción" : "canciones"}`}
            tone="custom"
            active={!collapsed && isCollection("playlist", playlist.name)}
            collapsed={collapsed}
            icon={<PlaylistIcon size={16} />}
            onClick={() => navigate("biblioteca", { section: "playlist", playlist: playlist.name })}
          />
        ))}
      </ul>

      <section className="sidebar__modes" aria-labelledby="sidebar-modes-title">
        <h2 id="sidebar-modes-title" className="sidebar__section-title">Modos</h2>
        <div className="sidebar__mode-list">
          {MODES.filter((entry) => isModeAvailable(entry.mode)).map((entry) => (
            <ModeButton
              key={entry.mode}
              label={entry.label}
              shortcut={entry.shortcut}
              Icon={entry.Icon}
              active={mode === entry.mode}
              collapsed={collapsed}
              onSelect={() => onModeChange(entry.mode)}
            />
          ))}
        </div>
      </section>
    </aside>
  );
}

function PlaylistLink({
  title,
  subtitle,
  tone,
  active,
  collapsed,
  icon,
  onClick,
}: {
  title: string;
  subtitle: string;
  tone: "favorites" | "downloads" | "radio" | "custom";
  active: boolean;
  collapsed: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`sidebar__playlist ${active ? "sidebar__playlist--active" : ""}`}
        aria-current={active ? "page" : undefined}
        aria-label={title}
        title={collapsed ? title : undefined}
        onClick={onClick}
      >
        <span className={`sidebar__tile sidebar__tile--${tone}`} aria-hidden="true">{icon}</span>
        <span className="sidebar__playlist-text">
          <span className="sidebar__playlist-title">{title}</span>
          <span className="sidebar__playlist-subtitle">{subtitle}</span>
        </span>
      </button>
    </li>
  );
}

const ModeButton = memo(function ModeButton({
  label,
  shortcut,
  Icon,
  active,
  collapsed,
  onSelect,
}: {
  label: string;
  shortcut: string;
  Icon: IconComponent;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`sidebar__mode-btn ${active ? "sidebar__mode-btn--active" : ""}`}
      aria-pressed={active}
      aria-label={collapsed ? `Modo ${label}` : undefined}
      title={`${label} (${shortcut})`}
      onClick={onSelect}
    >
      <Icon size={18} />
      <span className="sidebar__label">{label}</span>
    </button>
  );
});
