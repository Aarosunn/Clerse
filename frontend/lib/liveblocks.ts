// Liveblocks configuration for Clerse multiplayer
// Presence-only: cursors + user awareness, no storage sync

export const CURSOR_COLORS = [
  "#00BFFF",
  "#a43c12",
  "#4a7c59",
  "#7b5ea7",
  "#c89b3c",
  "#ff5f56",
];

// Global type declaration for Liveblocks presence
declare global {
  interface Liveblocks {
    Presence: {
      cursor: { x: number; y: number } | null;
      name: string;
      color: string;
    };
  }
}
