export const FRAME = { width: 1920, height: 1080 } as const;

export type Placement = { x: number; y: number; scale: number };

export const app = {
  width: 880,
  height: 480,
  title: 36,
  sidebar: 212,
  header: 32,
  strip: 56,
  toolbar: 40,
  row: 22,
  inject: 47,
  rowSlots: 12,
  arrowX: 212 + 14 + 90 + 12 + 8,
  sidebarTop: 36 + 38 + 2,
  profileRow: 34,
  profileGap: 1,
  dotX: 6 + 8 + 4,
} as const;

const measuredRowShift = 5.5;

export const logTop = app.title + app.header + app.strip + app.toolbar + 1 + measuredRowShift;

export const inspectWindow: Placement = { x: (FRAME.width - app.width * 2) / 2, y: 60, scale: 2 };
export const profilesWindow: Placement = { x: (FRAME.width - app.width * 1.7) / 2, y: 70, scale: 1.7 };

export const toScreen = (placement: Placement, x: number, y: number) => ({
  x: placement.x + x * placement.scale,
  y: placement.y + y * placement.scale,
});

export const rowArrow = (slot: number) => toScreen(inspectWindow, app.arrowX, logTop + app.row / 2 + app.row * slot);

export const profileDot = (index: number) =>
  toScreen(profilesWindow, app.dotX, app.sidebarTop + app.profileRow / 2 + (app.profileRow + app.profileGap) * index);

export const lockup = { markX: 810, markY: 500, markScale: 6.4, wordX: 970, wordSize: 230, urlY: 720 } as const;

export const cli = {
  terminal: { x: 160, y: 110, w: 1600, h: 600 },
  streams: { from: 250, to: 1670, amberY: 878, cyanY: 928, labelY: 800 },
} as const;
