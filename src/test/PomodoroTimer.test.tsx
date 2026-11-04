import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PomodoroTimer } from "../components/PomodoroTimer";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function start() {
  act(() => {
    screen.getByText("Iniciar").click();
  });
}

describe("PomodoroTimer", () => {
  it("renders 25:00 initially", () => {
    render(<PomodoroTimer />);
    expect(screen.getByText("25:00")).toBeInTheDocument();
    expect(screen.getByText("Enfoque")).toBeInTheDocument();
  });

  it("starts counting down", () => {
    render(<PomodoroTimer />);
    start();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText("24:57")).toBeInTheDocument();
  });

  it("pauses when clicking Pausar", () => {
    render(<PomodoroTimer />);
    start();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      screen.getByText("Pausar").click();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("24:58")).toBeInTheDocument();
  });

  it("resets to 25:00", () => {
    render(<PomodoroTimer />);
    start();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    act(() => {
      screen.getByText("Reiniciar").click();
    });

    expect(screen.getByText("25:00")).toBeInTheDocument();
    expect(screen.getByText("Enfoque")).toBeInTheDocument();
  });

  it("transitions to break after work completes", () => {
    const onComplete = vi.fn();
    render(<PomodoroTimer onComplete={onComplete} />);
    start();

    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });

    expect(onComplete).toHaveBeenCalledOnce();
    expect(screen.getByText("05:00")).toBeInTheDocument();
    expect(screen.getByText("Descanso")).toBeInTheDocument();
  });
});
