import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Sidebar } from "../components/layout/Sidebar";

describe("Sidebar", () => {
  it("renders title in normal mode", () => {
    render(
      <Sidebar mode="normal" onModeChange={vi.fn()}>
        <div>child</div>
      </Sidebar>,
    );
    expect(screen.getByText("FlowPlayer")).toBeInTheDocument();
  });

  it("hides title in flow mode (collapsed)", () => {
    render(
      <Sidebar mode="flow" onModeChange={vi.fn()}>
        <div>child</div>
      </Sidebar>,
    );
    expect(screen.queryByText("FlowPlayer")).not.toBeInTheDocument();
  });

  it("shows search input when onSearch provided", () => {
    render(
      <Sidebar mode="normal" onModeChange={vi.fn()} onSearch={vi.fn()}>
        <div>child</div>
      </Sidebar>,
    );
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("hides search in collapsed mode", () => {
    render(
      <Sidebar mode="flow" onModeChange={vi.fn()} onSearch={vi.fn()}>
        <div>child</div>
      </Sidebar>,
    );
    expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
  });

  it("calls onSearch with query", () => {
    const onSearch = vi.fn();
    render(
      <Sidebar mode="normal" onModeChange={vi.fn()} onSearch={onSearch}>
        <div>child</div>
      </Sidebar>,
    );
    fireEvent.change(screen.getByPlaceholderText("Search..."), { target: { value: "test" } });
    expect(onSearch).toHaveBeenCalledWith("test");
  });

  it("renders all three mode buttons", () => {
    render(
      <Sidebar mode="normal" onModeChange={vi.fn()}>
        <div>child</div>
      </Sidebar>,
    );
    expect(screen.getByLabelText("normal mode")).toBeInTheDocument();
    expect(screen.getByLabelText("flow mode")).toBeInTheDocument();
    expect(screen.getByLabelText("zen mode")).toBeInTheDocument();
  });

  it("highlights active mode button", () => {
    render(
      <Sidebar mode="flow" onModeChange={vi.fn()}>
        <div>child</div>
      </Sidebar>,
    );
    expect(screen.getByLabelText("flow mode")).toHaveClass("sidebar__mode-btn--active");
    expect(screen.getByLabelText("normal mode")).not.toHaveClass("sidebar__mode-btn--active");
  });

  it("calls onModeChange when clicking a mode", () => {
    const onModeChange = vi.fn();
    render(
      <Sidebar mode="normal" onModeChange={onModeChange}>
        <div>child</div>
      </Sidebar>,
    );
    screen.getByLabelText("zen mode").click();
    expect(onModeChange).toHaveBeenCalledWith("zen");
  });

  it("renders children", () => {
    render(
      <Sidebar mode="normal" onModeChange={vi.fn()}>
        <div data-testid="custom-child">Custom</div>
      </Sidebar>,
    );
    expect(screen.getByTestId("custom-child")).toBeInTheDocument();
  });
});
