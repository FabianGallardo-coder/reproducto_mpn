import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PlayerProvider } from "./hooks/usePlayerStore";
import { NavigationProvider } from "./hooks/useNavigation";
import "./styles/tokens.css";
import "./styles/components/base.css";
import "./styles/components/player-bar.css";
import "./styles/components/track-list.css";
import "./styles/components/flow.css";
import "./styles/components/mini-zen.css";
import "./styles/components/sources.css";
import "./styles/shell.css";
import "./styles/mobile.css";
import { isAndroid } from "./lib/platform";

if (isAndroid) document.documentElement.dataset.platform = "android";

window.addEventListener("error", (e) => {
  console.error("[global-error]", e.message, e.filename, e.lineno, e.error);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandled-rejection]", e.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PlayerProvider>
      <NavigationProvider>
        <App />
      </NavigationProvider>
    </PlayerProvider>
  </React.StrictMode>,
);
