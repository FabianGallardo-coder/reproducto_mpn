import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AppLayout } from "../components/layout/AppLayout";

vi.mock("../lib/api", () => ({
  api: { playUrl: vi.fn(), listRadioStations: vi.fn().mockResolvedValue([]) },
}));

const baseProps = {
  mode: "normal" as const,
  onModeChange: vi.fn(),
  currentTrack: null,
  playing: false,
  volume: 0.8,
  shuffle: false,
  repeat: "off" as const,
  positionValue: 0,
  error: null,
  onToggle: vi.fn(),
  onNext: vi.fn(),
  onPrevious: vi.fn(),
  onVolumeChange: vi.fn(),
  onSeek: vi.fn(),
  onToggleShuffle: vi.fn(),
  onCycleRepeat: vi.fn(),
  onClearError: vi.fn(),
};

describe("AppLayout", () => {
  it("renders children in normal mode", () => {
    render(
      <AppLayout {...baseProps}>
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders zen mode without sidebar", () => {
    render(
      <AppLayout {...baseProps} mode="zen">
        <div>Zen content</div>
      </AppLayout>,
    );
    expect(screen.getByText("Zen content")).toBeInTheDocument();
    expect(screen.queryByText("FlowPlayer")).not.toBeInTheDocument();
  });

  it("shows error toast when error present", () => {
    render(
      <AppLayout {...baseProps} error="Something broke">
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });

  it("calls onClearError when clicking error toast", () => {
    const onClearError = vi.fn();
    render(
      <AppLayout {...baseProps} error="Error msg" onClearError={onClearError}>
        <div>Content</div>
      </AppLayout>,
    );
    screen.getByText("Error msg").click();
    expect(onClearError).toHaveBeenCalledOnce();
  });

  it("shows Library and Radio tabs", () => {
    render(
      <AppLayout {...baseProps}>
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByText("Radio")).toBeInTheDocument();
  });

  it("renders player bar", () => {
    render(
      <AppLayout {...baseProps}>
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.getByText("No track playing")).toBeInTheDocument();
  });
});
