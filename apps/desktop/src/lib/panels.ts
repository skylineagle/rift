export const PANEL_TITLES = {
  profiles: "Profiles",
  endpoints: "Endpoints",
  log: "Log",
  workflows: "Workflows",
  inject: "Inject",
} as const;

export type PanelId = keyof typeof PANEL_TITLES;

export const isPanelId = (value: unknown): value is PanelId =>
  typeof value === "string" && value in PANEL_TITLES;
