// Implements §5.1 — Seasonal rotating items.
// Quarterly rotation (4 sets per year). Available for ~8 weeks, then replaced.
// Each item is one-time per user. Costs 500–1,000 IP.

export type SeasonalItem = {
  id: string;
  name: string;
  description: string;
  type: "theme" | "frame";
  ipCost: number;
  /** ISO date when the item becomes available */
  availableFrom: string;
  /** ISO date when the item is no longer purchasable */
  availableUntil: string;
  /** Season identifier (e.g., "2026-Q1") */
  season: string;
};

// ── Seasonal rotation schedule ──────────────────────────────────────────────

// Each quarter has 2 items. Available for ~8 weeks starting from quarter start.
// These are the first set — new seasons should be added ahead of each quarter.

export const SEASONAL_ITEMS: SeasonalItem[] = [
  // 2026 Q2 (Apr–Jun)
  {
    id: "seasonal-equinox-2026q2",
    name: "Spring Equinox",
    description: "Soft dawn gradients with warm undertones. Limited edition.",
    type: "theme",
    ipCost: 600,
    availableFrom: "2026-04-01",
    availableUntil: "2026-05-27",
    season: "2026-Q2",
  },
  {
    id: "seasonal-bloom-frame-2026q2",
    name: "Bloom Frame",
    description: "Organic flowing lines inspired by spring growth. Limited edition.",
    type: "frame",
    ipCost: 500,
    availableFrom: "2026-04-01",
    availableUntil: "2026-05-27",
    season: "2026-Q2",
  },
  // 2026 Q3 (Jul–Sep)
  {
    id: "seasonal-solstice-2026q3",
    name: "Summer Solstice",
    description: "Golden hour warmth with long-shadow geometry. Limited edition.",
    type: "theme",
    ipCost: 700,
    availableFrom: "2026-07-01",
    availableUntil: "2026-08-26",
    season: "2026-Q3",
  },
  {
    id: "seasonal-horizon-frame-2026q3",
    name: "Horizon Frame",
    description: "Layered depth with atmospheric perspective. Limited edition.",
    type: "frame",
    ipCost: 500,
    availableFrom: "2026-07-01",
    availableUntil: "2026-08-26",
    season: "2026-Q3",
  },
];

/**
 * Get currently available seasonal items based on today's date.
 */
export function getActiveSeasonalItems(): SeasonalItem[] {
  const now = new Date().toISOString().slice(0, 10);
  return SEASONAL_ITEMS.filter(
    (item) => now >= item.availableFrom && now <= item.availableUntil
  );
}

/**
 * Get a seasonal item by ID, regardless of availability window.
 */
export function getSeasonalItem(itemId: string): SeasonalItem | null {
  return SEASONAL_ITEMS.find((item) => item.id === itemId) ?? null;
}

/**
 * Check if a seasonal item is currently purchasable.
 */
export function isSeasonalItemAvailable(itemId: string): boolean {
  const item = getSeasonalItem(itemId);
  if (!item) return false;
  const now = new Date().toISOString().slice(0, 10);
  return now >= item.availableFrom && now <= item.availableUntil;
}
