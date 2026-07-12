import { memo } from "react";
import type { Mode } from "../../types";

const MODES: readonly Mode[] = ["normal", "flow", "zen"];

interface Props {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  children: React.ReactNode;
}

export function Sidebar({ mode, onModeChange, children }: Props) {
  const collapsed = mode === "flow";

  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      <nav className="sidebar__nav">
        {!collapsed && <div className="sidebar__title">FlowPlayer</div>}
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
  return (
    <button
      className={`sidebar__mode-btn ${active ? "sidebar__mode-btn--active" : ""}`}
      onClick={() => onSelect(mode)}
      title={mode.toUpperCase()}
      aria-label={`${mode} mode`}
    >
      {mode === "normal" ? "N" : mode === "flow" ? "F" : "Z"}
    </button>
  );
});
