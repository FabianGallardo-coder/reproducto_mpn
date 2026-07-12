import type { Mode } from "../../types";

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
        {(["normal", "flow", "zen"] as const).map((m) => (
          <button
            key={m}
            className={`sidebar__mode-btn ${mode === m ? "sidebar__mode-btn--active" : ""}`}
            onClick={() => onModeChange(m)}
            title={m.toUpperCase()}
          >
            {m === "normal" ? "N" : m === "flow" ? "F" : "Z"}
          </button>
        ))}
      </div>
    </aside>
  );
}
