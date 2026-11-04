import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";

function ThrowingChild(): React.ReactNode {
  throw new Error("Test error");
}

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("catches errors and shows fallback UI", () => {
    const spy = console.error;
    console.error = () => {};

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
    console.error = spy;
  });

  it("recovers when Retry is clicked", () => {
    const spy = console.error;
    console.error = () => {};

    function Broken(): React.ReactNode {
      throw new Error("oops");
    }

    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    screen.getByText("Retry").click();

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    console.error = spy;
  });

  it("renders the child again after retry when the failure is transient", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    function RetryableChild({ failed }: { failed: boolean }): React.ReactNode {
      if (failed) {
        throw new Error("temporary failure");
      }
      return <div>Recovered screen content</div>;
    }

    function RetryHarness(): React.ReactNode {
      const [failed, setFailed] = useState(true);
      return (
        <div onClick={() => setFailed(false)}>
          <ErrorBoundary>
            <RetryableChild failed={failed} />
          </ErrorBoundary>
        </div>
      );
    }

    try {
      render(<RetryHarness />);

      expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      expect(screen.getByText("Recovered screen content")).toBeInTheDocument();
      expect(screen.queryByText("Something went wrong.")).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });
});
