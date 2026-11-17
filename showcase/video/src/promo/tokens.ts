export const color = {
  bg: "#000000",
  surface: "#0b0b0c",
  surface2: "#111113",
  surface3: "#18181b",
  surface4: "#222226",
  line: "#1e1e22",
  line2: "#2b2b30",
  fg: "#f4f4f5",
  fg2: "#a1a1aa",
  fg3: "#6e6e77",
  amber: "#f59e0b",
  amberText: "#fbbf24",
  amberSoft: "rgba(245, 158, 11, 0.14)",
  amberLine: "rgba(245, 158, 11, 0.4)",
  cyan: "#38bdf8",
  cyanSoft: "rgba(56, 189, 248, 0.14)",
  ok: "#22c55e",
  okSoft: "rgba(34, 197, 94, 0.14)",
  okRing: "rgba(34, 197, 94, 0.2)",
} as const;

export const font = {
  ui: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
} as const;

export const radius = 8;

export const easeOut = [0.23, 1, 0.32, 1] as const;
