import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RadioPanel } from "../components/RadioPanel";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    listRadioStations: vi.fn(),
  },
}));

const mockStations = [
  { name: "SomaFM Groove", genre: "Electronic", url: "http://stream1", description: "Groove radio" },
  { name: "SomaFM DEF CON", genre: "Hacker", url: "http://stream2", description: "DEF CON" },
];

beforeEach(() => {
  vi.mocked(api.listRadioStations).mockResolvedValue(mockStations);
});

describe("RadioPanel", () => {
  it("shows loading state initially", () => {
    render(<RadioPanel onPlay={vi.fn()} />);
    expect(screen.getByText("Loading stations...")).toBeInTheDocument();
  });

  it("renders stations after load", async () => {
    render(<RadioPanel onPlay={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("SomaFM Groove")).toBeInTheDocument();
    });
    expect(screen.getByText("SomaFM DEF CON")).toBeInTheDocument();
    expect(screen.getByText("Radio")).toBeInTheDocument();
  });

  it("calls onPlay with station url", async () => {
    const onPlay = vi.fn();
    render(<RadioPanel onPlay={onPlay} />);
    await waitFor(() => screen.getByText("SomaFM Groove"));
    screen.getByText("SomaFM Groove").click();
    expect(onPlay).toHaveBeenCalledWith("http://stream1");
  });

  it("displays genre for each station", async () => {
    render(<RadioPanel onPlay={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Electronic")).toBeInTheDocument();
    });
    expect(screen.getByText("Hacker")).toBeInTheDocument();
  });

  it("handles empty stations list", async () => {
    vi.mocked(api.listRadioStations).mockResolvedValue([]);
    render(<RadioPanel onPlay={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByText("Loading stations...")).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
