import { memo, useState, useCallback } from "react";
import type { Mode } from "../../types";
import { SearchIcon, MusicIcon } from "../ui/Icons";

const MODES: readonly Mode[] = ["normal", "flow", "zen", "mini"];
const MODE_ICONS: Record<Mode, typeof MusicIcon> = {
  normal: MusicIcon,
  flow: MusicIcon,
  zen: MusicIcon,
  mini: MusicIcon,
};
const MODE_LABELS: Record<Mode, string> = {
  normal: "Library",
  flow: "Flow",
  zen: "Zen",
  mini: "Mini",
};

interface Props {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onSearch?: (query: string) => void;
  children: React.ReactNode;
}

export function Sidebar({ mode, onModeChange, onSearch, children }: Props) {
  const collapsed = mode === "flow";
  const [query, setQuery] = useState("");

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setQuery(q);
      onSearch?.(q);
    },
    [onSearch],
  );

  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      <nav className="sidebar__nav">
        {!collapsed && <div className="sidebar__title">FlowPlayer</div>}
        {!collapsed && onSearch && (
          <div className="sidebar__search-wrap">
            <SearchIcon size={14} className="sidebar__search-icon" />
            <input
              type="search"
              className="sidebar__search"
              placeholder="Search..."
              value={query}
              onChange={handleSearch}
              aria-label="Search tracks"
            />
          </div>
        )}
        {children}
      </nav>
      <div className="sidebar__modes">
        {MODES.map((m) => (
          <ModeButton
            key={m}
            mode={m}
            active={mode === m}
            onSelect={onModeChange}
          />
        ))}
      </div>
    </aside>
  );
}

const ModeButton = memo(function ModeButton({
  mode,
  active,
  onSelect,
}: {
  mode: Mode;
  active: boolean;
  onSelect: (mode: Mode) => void;
}) {
  const Icon = MODE_ICONS[mode];
  return (
    <button
      className={`sidebar__mode-btn ${active ? "sidebar__mode-btn--active" : ""}`}
      onClick={() => onSelect(mode)}
      title={MODE_LABELS[mode]}
      aria-label={`${mode} mode`}
    >
      <Icon size={16} />
    </button>
  );
});
