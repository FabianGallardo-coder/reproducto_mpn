export interface LibraryControls {
  musicFolder: string;
  onSelectFolder: () => void;
  onOpenFile: () => void;
  onShowShortcuts: () => void;
  onShowAbout: () => void;
}

export interface PageProps {
  controls: LibraryControls;
}
