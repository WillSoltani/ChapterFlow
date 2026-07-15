/**
 * B15 — cross-tier paraphrase-restate (the defect E2/B8/BP24 are blind to).
 *
 * The verbatim gates only see word-for-word reuse: E2 (identical first
 * sentence), B8 (one 4-word phrase), BP24 (≥150-char verbatim block). Once a
 * writer agent rewords the connectives while keeping every domain concept, all
 * three pass — yet a reader gets the same ideas twice across tiers. B15 is the
 * cheap content-lemma-Jaccard proxy that surfaces that candidate as ADVISORY
 * QC debt (minor — never blocks; the precise judgment is the prose_coherence
 * semantic axis).
 *
 * This suite is the executable calibration contract:
 *  - TRUE POSITIVES fire (a gate that flags nothing is useless), and
 *  - the GOLD corpus (synthetic gold + the real daring-greatly / start-with-why
 *    chapters, whose tiers genuinely LAYER) stays at ZERO. Calibration measured
 *    2026-06-25: real-gold cross-tier Jaccard tops out at 0.31, a reworded
 *    restate measures ~0.52; the 0.42 threshold sits in the gap.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, makeGateCleanChapter, goldChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import {
  findCrossTierContentOverlap,
  checkCrossTierContentOverlap,
  checkBreakdownCrossTierVerbatim,
} from "../src/critics/intraBookFieldSimilarity.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

function withTiers(fastRead: string, deepRead: string, fullRead: string): ChapterV21 {
  return makeChapter("zz-b15", 1, { overrides: { breakdown: { fastRead, deepRead, fullRead } as any } });
}

// ── TRUE POSITIVES: same ideas, reworded connectives, no verbatim block ───────
// deepRead restated as fullRead — every domain noun (record, note, owner,
// mismatch, trail…) survives, only the framing words change.
const DEEP_RESTATE =
  "When the intake record drifts from the signed note, the first honest move is to pause and compare the two before anyone acts on the wrong number. The owner closest to the source resolves it because that context is still fresh in memory. Early verification keeps the mismatch small enough for a single person to repair without a meeting. A visible owner turns scattered signals into one decision trail the next team can actually trust. The cost is a few minutes; the payoff is a record nobody has to reconstruct later under pressure.";
const FULL_RESTATE =
  "If the intake record drifts away from the signed note, the honest first step is simply to stop and check both versions before someone acts on a wrong number. The person nearest the source handles it, since that context remains fresh in their memory. Verifying early keeps the mismatch small enough that one individual can fix it without calling a meeting. When the owner is visible, scattered signals collapse into a single decision trail the next team can genuinely trust. It costs only a few minutes, and the reward is a record that nobody must rebuild later under pressure.";

// fastRead as a shrunk restate of deepRead — the "fastRead is just a shortened
// deepRead" failure the progression rule forbids.
const DEEP_FULLER =
  "A handoff is a chain of small permissions, and each owner trusts the prior record enough to act on it. When the source note and the live entry disagree, the cheap moment to repair the mismatch is right now, while the evidence is still local. A visible owner compares the two, names the divergence, fixes the one record, and writes the reason in plain language so the next reviewer never has to reconstruct the decision trail from memory. That habit turns verification into shared infrastructure instead of private heroics.";
const FAST_SHRUNK_RESTATE =
  "A handoff is a chain of small permissions where each owner trusts the prior record. When the source note and the live entry disagree, repair the mismatch now, while the evidence is still local. A visible owner compares the two, names the divergence, and writes the reason plainly so the next reviewer never rebuilds the decision trail from memory.";

const TRUE_POSITIVES: Array<[string, "fastRead↔deepRead" | "deepRead↔fullRead", string, string, string]> = [
  ["deepRead reworded into fullRead", "deepRead↔fullRead", "An orchard keeper prunes the trellis at dawn while the cider press cools nearby.", DEEP_RESTATE, FULL_RESTATE],
  ["fastRead is a shrunk deepRead", "fastRead↔deepRead", FAST_SHRUNK_RESTATE, DEEP_FULLER, "An entirely separate fullRead about a glacier expedition: the climbers fix crampons to the icefall, rope across the crevasse, and read the cairn line toward the summit ridge before the descent window closes for the season."],
];

// ── MUST NOT FIRE: genuinely layered tiers (different scenes / new concepts) ──
const LAYERED_DEEP =
  "Anika leans over the repair-bay clipboard at 8:10 a.m. and notices the torque log disagrees with the parts invoice. She holds the bay, traces the bolt batch, and finds the swapped pallet before a single car ships with the wrong fastener.";
const LAYERED_FULL =
  "Two states away, a hospital pharmacist named Devin scans a barcode that the cabinet refuses to recognize. The mismatch is not a typo; it is a recalled lot that slipped past intake. He freezes the drawer, pages the supervisor, and the recall notice surfaces a labeling error that three earlier shifts had quietly worked around. The lesson is not vigilance for its own sake. It is that the cheapest place to catch a defect is the boundary where evidence is still attached to the object, before a dozen downstream choices inherit the error and turn one bad label into a week of rework.";

test("B15: findCrossTierContentOverlap fires on every paraphrase-restate true-positive", () => {
  for (const [label, pair, fast, deep, full] of TRUE_POSITIVES) {
    const hits = findCrossTierContentOverlap(withTiers(fast, deep, full));
    const [a, b] = pair.split("↔");
    assert.ok(
      hits.some((h) => h.tierA === a && h.tierB === b),
      `expected a B15 hit on ${pair} for ${label}; got ${JSON.stringify(hits)}`,
    );
  }
});

test("B15: genuinely layered tiers (new scenes + concepts) do NOT fire", () => {
  const fast = "A line cook calls 'corner!' and the whole pass resets without a word — one shared signal, one safe handoff.";
  const hits = findCrossTierContentOverlap(withTiers(fast, LAYERED_DEEP, LAYERED_FULL));
  assert.equal(hits.length, 0, `false positive on layered tiers: ${JSON.stringify(hits)}`);
});

test("B15: a ≥150-char verbatim block is left to BP24, not double-reported", () => {
  // Same ideas AND a long verbatim block: Jaccard is sky-high but BP24 owns it,
  // so B15 must stay silent (it fires only BELOW the verbatim floor).
  const block = " The owner closest to the source resolves the mismatch because that context is still fresh in everyone's working memory, and the repair stays cheap, local, and quick to explain to the next reviewer on shift. ";
  assert.ok(block.length >= 150, `block must be ≥150 chars to test the BP24 floor; was ${block.length}`);
  const deep = DEEP_RESTATE + block;
  const full = FULL_RESTATE + block;
  const hits = findCrossTierContentOverlap(withTiers("Short clean opener about a harbor lantern swinging over the quay at dusk near the cargo crane.", deep, full));
  assert.ok(!hits.some((h) => h.tierA === "deepRead" && h.tierB === "fullRead"), `B15 double-reported a verbatim block BP24 owns: ${JSON.stringify(hits)}`);
});

test("B15: the ship gate surfaces a planted restate as a MINOR (wiring + severity)", () => {
  // Schema-valid lengths: deepRead ≥1000, fullRead ≥2400 chars, built from one
  // shared noun pool so the two tiers restate the same vocabulary.
  const POOL = ["intake", "record", "handoff", "owner", "source", "note", "mismatch", "trail", "evidence", "checkpoint", "queue", "repair", "context", "signal", "review", "drift"];
  const deepS = (i: number) => {
    const a = POOL[i % POOL.length], b = POOL[(i + 3) % POOL.length], c = POOL[(i + 7) % POOL.length];
    return `When the ${a} stops matching the ${b}, the honest move is to pause and check the ${c} before anyone acts on it.`;
  };
  const fullS = (i: number) => {
    const a = POOL[i % POOL.length], b = POOL[(i + 3) % POOL.length], c = POOL[(i + 7) % POOL.length];
    return `If the ${a} drifts from the ${b}, the careful step is simply stopping to verify the ${c} so nobody proceeds blindly here.`;
  };
  const deepRead = Array.from({ length: 13 }, (_, i) => deepS(i)).join(" ");
  const fullRead = Array.from({ length: 30 }, (_, i) => fullS(i)).join(" ");
  const fastRead = "A harbor keeper lifts the lantern over the quay while the cargo crane swings the last pallet onto the deck before the tide turns and the beacon blinks twice.";
  const ch = makeChapter("zz-b15-gate", 2, { overrides: { breakdown: { fastRead, deepRead, fullRead } as any } });
  const report = runShipGate(ch);
  assert.ok(
    report.minors.some((m) => m.catalogId === "B15.cross_tier_paraphrase"),
    `expected a B15 minor; got minors ${report.minors.map((m) => m.catalogId).join(", ")}`,
  );
  // It is advisory only — it must NOT show up as a blocker or major.
  assert.ok(!report.blockers.some((b) => b.catalogId === "B15.cross_tier_paraphrase"), "B15 must never block");
  assert.ok(!report.majors.some((m) => m.catalogId === "B15.cross_tier_paraphrase"), "B15 must never be a major");
});

// ── Re-orientation exemption (content-excellence Track B 2026-07-15) ──────────
// The app renders ONE read tier per mode, so a deeper tier may OPEN by
// re-orienting the reader with a standalone context sentence — even one that
// echoes the tier above. The cross-tier verbatim (BP24) + overlap (B15) MASS
// measures exempt exactly the FIRST sentence of deepRead and of fullRead;
// fastRead is never exempt, and a NON-first duplicate still trips.

// A single ≥150-char sentence, used both as a fastRead line and as a deeper
// tier's leading re-orientation sentence.
const REORIENT_LINE =
  "When the intake record drifts from the signed handoff note, the nearest owner pauses to compare both mismatched versions, verifies the divergence early, repairs the single record, and writes the reason so the following decision trail stays trustworthy for everyone downstream.";

test("BP24 exemption: a deepRead whose FIRST sentence re-states fastRead verbatim does NOT trip; the SAME block non-first still trips", () => {
  assert.ok(REORIENT_LINE.length >= 150, `re-orientation line must exceed the 150-char verbatim floor; was ${REORIENT_LINE.length}`);
  const fast = `A quick harbor lantern swings over the quay before the tide turns. ${REORIENT_LINE}`;
  // Exempt: the verbatim block is deepRead's leading (re-orientation) sentence.
  const exempt = withTiers(
    fast,
    `${REORIENT_LINE} Then a second workshop scene shows torque logs and pallet batches diverging before one owner traces the fault.`,
    "A wholly separate glacier expedition ropes across the crevasse toward the summit cairn while the descent window narrows for the season.",
  );
  assert.equal(
    checkBreakdownCrossTierVerbatim(exempt).filter((f) => /fastRead.*deepRead/.test(f.message)).length,
    0,
    "a deeper tier's leading re-orientation sentence is exempt from the cross-tier verbatim gate",
  );
  // Non-first: the SAME verbatim block sits AFTER a distinct first sentence → not exempt → trips.
  const tripped = withTiers(
    fast,
    `A distinct dawn workshop opens the deeper pass with its own scene. ${REORIENT_LINE}`,
    "A wholly separate glacier expedition ropes across the crevasse toward the summit cairn while the descent window narrows for the season.",
  );
  assert.ok(
    checkBreakdownCrossTierVerbatim(tripped).some((f) => /fastRead.*deepRead/.test(f.message)),
    "a duplicated verbatim block that is NOT the leading sentence still trips BP24",
  );
});

test("B15 exemption: a paraphrase concentrated in each deeper tier's FIRST sentence does NOT trip; the SAME sentence non-first still trips", () => {
  const SHARED_A = "When the intake record drifts from the signed handoff note, the nearest owner pauses to compare the two mismatched versions, verifies the divergence early, repairs the single record, names the reviewer, and writes the reason so the following decision trail stays trustworthy for everyone downstream.";
  const SHARED_B = "If the intake record diverges from the signed handoff note, the closest owner stops to compare the two mismatched versions, verifies the divergence early, repairs the single record, names the reviewer, and writes the reason so the next decision trail remains trustworthy for everybody downstream.";
  const TAIL_D = "Elsewhere a glacier expedition ropes across the crevasse toward the summit cairn.";
  const TAIL_F = "Nearby a desert caravan charts the shifting dune ridge toward the dusk oasis.";
  const fast = "A quick harbor lantern swings over the quay while the crane lowers one pallet before the tide turns.";
  // Exempt: the restated sentence LEADS both deepRead and fullRead → both leads stripped → silent.
  const exempt = withTiers(fast, `${SHARED_A} ${TAIL_D}`, `${SHARED_B} ${TAIL_F}`);
  assert.equal(
    findCrossTierContentOverlap(exempt).length, 0,
    "a re-orientation paraphrase carried by each deeper tier's leading sentence is exempt from B15",
  );
  // Non-first: the SAME restated sentence sits AFTER a distinct first sentence → not exempt → trips.
  const tripped = withTiers(fast, `${TAIL_D} ${SHARED_A}`, `${TAIL_F} ${SHARED_B}`);
  assert.ok(
    findCrossTierContentOverlap(tripped).some((h) => h.tierA === "deepRead" && h.tierB === "fullRead"),
    "the SAME paraphrase as a NON-leading sentence still trips B15",
  );
});

// ── Gold-corpus zero-FP calibration ───────────────────────────────────────────

test("B15: synthetic gold corpus has ZERO cross-tier-overlap findings", () => {
  for (const { bookId, files } of goldChapterFiles()) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const hits = checkCrossTierContentOverlap(ch);
      assert.equal(hits.length, 0, `B15 false positive on synthetic gold ${bookId} ${ch.chapterId}: ${hits.map((h) => h.message.slice(0, 100)).join(" | ")}`);
    }
  }
});

// makeGateCleanChapter is the per-chapter clean reference; it must stay silent.
test("B15: makeGateCleanChapter (layered reference tiers) is clean", () => {
  for (let n = 1; n <= 8; n++) {
    const ch = makeGateCleanChapter("zz-b15-clean", n);
    assert.equal(checkCrossTierContentOverlap(ch).length, 0, `B15 fired on a gate-clean chapter (ch${n})`);
  }
});

for (const bookId of ["daring-greatly", "start-with-why"]) {
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip(`B15 gold zero-FP: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`B15: real gold corpus ${bookId} (${files.length} ch) emits ZERO cross-tier-overlap findings`, () => {
    const offenders: string[] = [];
    for (const f of files) {
      const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
      for (const hit of checkCrossTierContentOverlap(ch)) offenders.push(`${ch.chapterId}: ${hit.message.slice(0, 120)}`);
    }
    assert.equal(offenders.length, 0, `B15 false-positives on reference-quality ${bookId} (miscalibrated):\n${offenders.join("\n")}`);
  });
}
