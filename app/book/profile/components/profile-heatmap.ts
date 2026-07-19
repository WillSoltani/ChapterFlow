

export type HeatmapCell = {
  key: string;
  dateLabel: string;
  minutes: number;
  chapters: number;
  level: number;
};

export const HEATMAP_COLORS = [
  "bg-(--cf-surface-muted)",
  "bg-blue-900/40",
  "bg-blue-700/50",
  "bg-blue-500/60",
  "bg-blue-400/80",
];

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
