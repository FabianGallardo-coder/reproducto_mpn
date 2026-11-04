import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Route = "inicio" | "buscar" | "biblioteca" | "estadisticas" | "configuracion" | "reproduciendo";

export type LibrarySection = "pistas" | "favoritos" | "descargas" | "radio" | "playlist";

export interface RouteParams {
  /** Biblioteca: which collection to show. */
  section?: LibrarySection;
  /** Biblioteca > playlist: name of the custom playlist. */
  playlist?: string;
  /** Buscar: initial query. */
  query?: string;
}

interface NavigationValue {
  route: Route;
  params: RouteParams;
  navigate: (route: Route, params?: RouteParams) => void;
  /** Returns to the page that was open before "reproduciendo". */
  closeNowPlaying: () => void;
}

const NavigationContext = createContext<NavigationValue | null>(null);

export function NavigationProvider({ initialRoute = "inicio", children }: { initialRoute?: Route; children: ReactNode }) {
  const [state, setState] = useState<{ route: Route; params: RouteParams; previous: Route }>({
    route: initialRoute,
    params: {},
    previous: "inicio",
  });

  const navigate = useCallback((route: Route, params: RouteParams = {}) => {
    setState((current) => ({
      route,
      params,
      previous: route === "reproduciendo" && current.route !== "reproduciendo" ? current.route : current.previous,
    }));
  }, []);

  const closeNowPlaying = useCallback(() => {
    setState((current) => ({ route: current.previous, params: {}, previous: current.previous }));
  }, []);

  const value = useMemo(
    () => ({ route: state.route, params: state.params, navigate, closeNowPlaying }),
    [state.route, state.params, navigate, closeNowPlaying],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationValue {
  const value = useContext(NavigationContext);
  if (!value) throw new Error("useNavigation must be used within NavigationProvider");
  return value;
}
