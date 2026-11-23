import assert from "node:assert/strict";
import { test } from "node:test";
import type { ServerTier } from "@/hooks/book/useServerTier";
import { tierIdentity, tierPill } from "./progressTypes";

// C3 fixture: GET /app/api/book/me/tier for a reader 7 loops into the ladder.
const TIERS: ServerTier["tiers"] = [
  { name: "reader", displayName: "Reader", loopsRequired: 0, avgScoreRequired: 0, categoriesRequired: 0, identityStatement: "I'm engaging with ideas", reached: true },
  { name: "analyst", displayName: "Analyst", loopsRequired: 25, avgScoreRequired: 70, categoriesRequired: 2, identityStatement: "I understand what I read", reached: false },
  { name: "synthesizer", displayName: "Synthesizer", loopsRequired: 100, avgScoreRequired: 75, categoriesRequired: 5, identityStatement: "I connect ideas across domains", reached: false },
  { name: "polymath", displayName: "Polymath", loopsRequired: 300, avgScoreRequired: 80, categoriesRequired: 10, identityStatement: "I've built broad and deep knowledge", reached: false },
  { name: "luminary", displayName: "Luminary", loopsRequired: 750, avgScoreRequired: 85, categoriesRequired: 11, identityStatement: "I illuminate understanding for myself and others", reached: false },
];

const READER: ServerTier = {
  currentTier: "reader",
  currentTierDisplay: "Reader",
  loopsCompleted: 7,
  avgQuizScore: 90,
  categoriesExplored: 2,
  nextTier: {
    name: "analyst",
    displayName: "Analyst",
    loopsRequired: 25,
    loopsRemaining: 18,
    loopsPercent: 28,
    avgScoreRequired: 70,
    avgScoreMet: true,
    categoriesRequired: 2,
    categoriesRemaining: 0,
    categoriesPercent: 100,
  },
  tiers: TIERS,
};

const LUMINARY: ServerTier = {
  ...READER,
  currentTier: "luminary",
  currentTierDisplay: "Luminary",
  loopsCompleted: 800,
  nextTier: null,
  tiers: TIERS.map((t) => ({ ...t, reached: true })),
};

test("tierPill shows the server tier name and the loops percent toward the next tier", () => {
  assert.deepEqual(tierPill(READER), { label: "Reader", percent: 28, nextLabel: "Analyst" });
});

test("tierPill is hidden while the tier read is pending or failed", () => {
  assert.equal(tierPill(undefined), null);
  assert.equal(tierPill(null), null);
  assert.equal(tierPill({} as ServerTier), null);
});

test("tierPill at the top tier shows a full bar and no next tier", () => {
  assert.deepEqual(tierPill(LUMINARY), { label: "Luminary", percent: 100, nextLabel: null });
});

test("tierPill clamps an out-of-range percent", () => {
  const over = { ...READER, nextTier: { ...READER.nextTier!, loopsPercent: 140 } };
  const under = { ...READER, nextTier: { ...READER.nextTier!, loopsPercent: -5 } };
  assert.equal(tierPill(over)?.percent, 100);
  assert.equal(tierPill(under)?.percent, 0);
});

test("tierIdentity gives the current tier's name and identity statement plus the ladder", () => {
  const identity = tierIdentity(READER);
  assert.ok(identity);
  assert.equal(identity.displayName, "Reader");
  assert.equal(identity.identityStatement, "I'm engaging with ideas");
  assert.equal(identity.nextTier?.displayName, "Analyst");
  assert.equal(identity.ladder.length, 5);
  assert.deepEqual(identity.ladder.map((t) => t.status), ["current", "next", "ahead", "ahead", "ahead"]);
});

test("tierIdentity marks passed tiers and has no next tier at the top", () => {
  const identity = tierIdentity(LUMINARY);
  assert.ok(identity);
  assert.equal(identity.nextTier, null);
  assert.deepEqual(identity.ladder.map((t) => t.status), ["passed", "passed", "passed", "passed", "current"]);
});

test("tierIdentity is null without a tier read", () => {
  assert.equal(tierIdentity(undefined), null);
  assert.equal(tierIdentity({ currentTierDisplay: "Reader" } as ServerTier), null);
});
