// Implements §5.1 — Personalization themes, tier-gated frames, and Gift a Friend.
// Defines the full sink catalog for non-bridge redemptions.

import type { TierName } from "@/app/app/api/book/_lib/types";

export type PersonalizationItemType = "theme" | "frame" | "seasonal";

export type PersonalizationItem = {
  id: string;
  name: string;
  description: string;
  type: PersonalizationItemType;
  ipCost: number;
  /** If set, user must have reached this tier to purchase */
  tierGate: TierName | null;
  /** Available to all users (free + Pro) */
  availableToAll: boolean;
  /** Is this a one-time purchase per user? */
  oneTimePerUser: boolean;
};

// ── Themes (§5.1) ──────────────────────────────────────────────────────────

export const THEME_ITEMS: PersonalizationItem[] = [
  {
    id: "obsidian",
    name: "Obsidian",
    description: "Pure black tones with subtle geometric patterns.",
    type: "theme",
    ipCost: 400,
    tierGate: null,
    availableToAll: true,
    oneTimePerUser: true,
  },
  {
    id: "twilight",
    name: "Twilight",
    description: "Deep purple-blue gradient panels.",
    type: "theme",
    ipCost: 500,
    tierGate: null,
    availableToAll: true,
    oneTimePerUser: true,
  },
  {
    id: "ember",
    name: "Ember",
    description: "Warm amber-tinted dark panels.",
    type: "theme",
    ipCost: 500,
    tierGate: null,
    availableToAll: true,
    oneTimePerUser: true,
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Deep green-teal glassmorphic panels.",
    type: "theme",
    ipCost: 600,
    tierGate: null,
    availableToAll: true,
    oneTimePerUser: true,
  },
];

// ── Tier-gated Frames (§5.1) ───────────────────────────────────────────────

export const FRAME_ITEMS: PersonalizationItem[] = [
  {
    id: "analyst-frame",
    name: "Analyst Frame",
    description: "Clean geometric lines. Requires Analyst tier.",
    type: "frame",
    ipCost: 150,
    tierGate: "analyst",
    availableToAll: true,
    oneTimePerUser: true,
  },
  {
    id: "synthesizer-frame",
    name: "Synthesizer Frame",
    description: "Refracting light motif. Requires Synthesizer tier.",
    type: "frame",
    ipCost: 300,
    tierGate: "synthesizer",
    availableToAll: true,
    oneTimePerUser: true,
  },
  {
    id: "polymath-frame",
    name: "Polymath Frame",
    description: "Full spectrum geometric design. Requires Polymath tier.",
    type: "frame",
    ipCost: 500,
    tierGate: "polymath",
    availableToAll: true,
    oneTimePerUser: true,
  },
  {
    id: "luminary-frame",
    name: "Luminary Frame",
    description: "Radiant halo effect. Requires Luminary tier.",
    type: "frame",
    ipCost: 800,
    tierGate: "luminary",
    availableToAll: true,
    oneTimePerUser: true,
  },
];

// ── Gift a Friend (§5.1) ───────────────────────────────────────────────────

export const GIFT_A_FRIEND = {
  id: "gift_friend_pro_week",
  name: "Gift a Friend 1 Week Pro",
  description: "Give a friend a free week of Pro access.",
  ipCost: 800, // §5.1 amended — reduced from 1,200
  repeatable: true,
  availableToAll: true,
} as const;

// ── Combined catalog ───────────────────────────────────────────────────────

export const PERSONALIZATION_CATALOG: PersonalizationItem[] = [
  ...THEME_ITEMS,
  ...FRAME_ITEMS,
];

export function getPersonalizationItem(itemId: string): PersonalizationItem | null {
  return PERSONALIZATION_CATALOG.find((item) => item.id === itemId) ?? null;
}

// ── Tier gate check ────────────────────────────────────────────────────────

const TIER_ORDER: TierName[] = ["reader", "analyst", "synthesizer", "polymath", "luminary"];

export function meetsTeamGate(currentTier: TierName, requiredTier: TierName | null): boolean {
  if (!requiredTier) return true;
  return TIER_ORDER.indexOf(currentTier) >= TIER_ORDER.indexOf(requiredTier);
}
