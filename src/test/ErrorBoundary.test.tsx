import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
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
});
