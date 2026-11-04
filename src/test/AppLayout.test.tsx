import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockState: {
  currentTrack: { path: string; title: string; artist: string; album: string; duration: number } | null;
  playing: boolean;
  volume: number;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  positionValue: number;
  positionRef: { current: number };
  error: string | null;
  favorites: string[];
  customPlaylists: { name: string; tracks: string[] }[];
} = {
  currentTrack: null,
  playing: false,
  volume: 0.8,
  shuffle: false,
  repeat: "off",
  positionValue: 0,
  positionRef: { current: 0 },
  error: null,
  favorites: [],
  customPlaylists: [],
};

const mockActions = {
  toggle: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
  setVolume: vi.fn(),
  seek: vi.fn(),
  toggleShuffle: vi.fn(),
  cycleRepeat: vi.fn(),
  toggleFavorite: vi.fn(),
  createPlaylist: vi.fn(),
  clearError: vi.fn(),
  reportYouTubeState: vi.fn(),
  youtubeEnded: vi.fn(),
  registerYouTubeController: vi.fn(),
  stopYouTube: vi.fn(),
};

vi.mock("../hooks/usePlayerStore", () => ({
  usePlayerState: () => mockState,
  usePlayerActions: () => mockActions,
}));
vi.mock("../lib/useCoverArt", () => ({ useCoverArt: () => null }));

import { AppLayout } from "../components/layout/AppLayout";
import { NavigationProvider } from "../hooks/useNavigation";

function renderLayout(mode: "normal" | "flow" | "zen" | "mini", onModeChange = vi.fn()) {
  render(
    <NavigationProvider>
      <AppLayout mode={mode} onModeChange={onModeChange}>
        <div>Content</div>
      </AppLayout>
    </NavigationProvider>,
  );
  return onModeChange;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState.error = null;
});

describe("AppLayout", () => {
  it("renders the sidebar, the page content and the player bar in normal mode", () => {
    renderLayout("normal");
    expect(screen.getByRole("complementary", { name: "Navegación principal" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Content");
    expect(screen.getByText("Nada en reproducción")).toBeInTheDocument();
  });

  it("keeps the sidebar as a collapsed rail in flow mode", () => {
    renderLayout("flow");
    expect(screen.getByRole("complementary", { name: "Navegación principal" })).toHaveClass("sidebar--collapsed");
  });

  it.each(["zen", "mini"] as const)("renders %s mode without sidebar or player bar", (mode) => {
    renderLayout(mode);
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByText("Nada en reproducción")).not.toBeInTheDocument();
  });

  it("changes mode from the sidebar", () => {
    const onModeChange = renderLayout("normal");
    fireEvent.click(screen.getByRole("button", { name: "Mini" }));
    expect(onModeChange).toHaveBeenCalledWith("mini");
  });

  it("announces the app error and dismisses it with the accessible button", () => {
    mockState.error = "Error msg";
    renderLayout("normal");
    expect(screen.getByRole("alert")).toHaveTextContent("Error msg");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar error" }));
    expect(mockActions.clearError).toHaveBeenCalledOnce();
  });

  it("does not render an alert when there is no error", () => {
    renderLayout("normal");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
