import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  PlayIcon,
  PauseIcon,
  PrevIcon,
  NextIcon,
  ShuffleIcon,
  RepeatIcon,
  RepeatOneIcon,
  FolderIcon,
  SearchIcon,
  MusicIcon,
  LibraryIcon,
  VolumeIcon,
  CloseIcon,
} from "../components/ui/Icons";

const icons = [
  ["PlayIcon", PlayIcon],
  ["PauseIcon", PauseIcon],
  ["PrevIcon", PrevIcon],
  ["NextIcon", NextIcon],
  ["ShuffleIcon", ShuffleIcon],
  ["RepeatIcon", RepeatIcon],
  ["RepeatOneIcon", RepeatOneIcon],
  ["FolderIcon", FolderIcon],
  ["SearchIcon", SearchIcon],
  ["MusicIcon", MusicIcon],
  ["LibraryIcon", LibraryIcon],
  ["VolumeIcon", VolumeIcon],
  ["CloseIcon", CloseIcon],
] as const;

describe("Icons", () => {
  it.each(icons)("%s renders an SVG", (_name, Icon) => {
    const { container } = render(<Icon />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("respects size prop", () => {
    const { container } = render(<PlayIcon size={32} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("height", "32");
  });

  it("applies className", () => {
    const { container } = render(<PauseIcon className="my-icon" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("my-icon");
  });

  it("defaults size to 16", () => {
    const { container } = render(<NextIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "16");
  });
});
