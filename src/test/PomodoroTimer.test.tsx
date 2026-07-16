import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PomodoroTimer } from "../components/PomodoroTimer";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PomodoroTimer", () => {
  it("renders 25:00 initially", () => {
    render(<PomodoroTimer />);
    expect(screen.getByText("25:00")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
  });

  it("starts counting down", () => {
    render(<PomodoroTimer />);

    act(() => {
      screen.getByText("Start").click();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText("24:57")).toBeInTheDocument();
  });

  it("pauses when clicking Pause", () => {
    render(<PomodoroTimer />);

    act(() => {
      screen.getByText("Start").click();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      screen.getByText("Pause").click();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("24:58")).toBeInTheDocument();
  });

  it("resets to 25:00", () => {
    render(<PomodoroTimer />);

    act(() => {
      screen.getByText("Start").click();
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    act(() => {
      screen.getByText("Reset").click();
    });

    expect(screen.getByText("25:00")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
  });

  it("transitions to break after work completes", () => {
    const onComplete = vi.fn();
    render(<PomodoroTimer onComplete={onComplete} />);

    act(() => {
      screen.getByText("Start").click();
    });

    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });

    expect(onComplete).toHaveBeenCalledOnce();
    expect(screen.getByText("05:00")).toBeInTheDocument();
    expect(screen.getByText("Break")).toBeInTheDocument();
  });
});
