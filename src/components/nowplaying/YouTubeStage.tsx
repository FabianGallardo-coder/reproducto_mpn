import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface StageValue {
  /** Element the persistent YouTube player must cover while the Now Playing page is open. */
  stage: HTMLElement | null;
  setStage: (element: HTMLElement | null) => void;
}

const NO_STAGE: StageValue = { stage: null, setStage: () => undefined };
const StageContext = createContext<StageValue>(NO_STAGE);

export function YouTubeStageProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ stage, setStage }), [stage]);
  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}

export function useYouTubeStage(): StageValue {
  return useContext(StageContext);
}
