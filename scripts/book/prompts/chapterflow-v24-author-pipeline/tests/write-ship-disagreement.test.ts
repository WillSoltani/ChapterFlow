/**
 * WRITE/SHIP DISAGREEMENT — the two classes where the compiler passed content the
 * ship gate then blocked, both taken from the live Franklin canary
 * (run book-run-910febe1, QC round qc-29d119c59544a5d991c71c7c9fec04bb, 96 blockers).
 *
 * CLASS 2 — EM DASH (B5). The ship gate hard-bans the em dash on every reader-facing
 * field. Nothing at drafting time said so: the section-writer task card carried no
 * such rule and no section gate looked for one, so the fresh compile minted em dashes
 * freely and 68 of the round's 96 blockers were B5. Fixed on BOTH sides — the writer
 * is told (sectionDoNotLines, and the repair card's control text) and the compiler
 * refuses (SEC123, a mirror of B5 built on the same checkNoEmDash primitive).
 *
 * CLASS 3 — MEMORABLE-LINE SELECTION (write-time SEC16 vs ship-time SC11.2/A11).
 * The two lanes disagreed because they were reading DIFFERENT SENTENCES: the section
 * gate ranked its candidates one way and validated its own top 3, while the assembler
 * ranked the same candidate pool another way and shipped a different top 3. Compile
 * validated sentences that never shipped. Fixed by giving both lanes ONE selection
 * function — and package 1B changed the POLICY that function applies (at most one
 * source specific per line, ranked by principle density, no reproduction of the
 * hook/counterintuition/keyTakeaway, no two lines on one specific) on both sides at
 * once. What this file pins is the invariant, not the policy: whatever the policy is,
 * the sentences the gate validates are the sentences the assembler ships.
 *
 * Every fixture below is the LIVE content or a byte-faithful reduction of it.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { sectionDoNotLines } from "../src/sections/sectionTasks.js";
import { checkNoEmDash } from "../src/critics/register.js";
import {
  harvestMemorableCandidates,
  MEMORABLE_LINE_MAX_SPECIFICS,
  selectMemorableCandidates,
  selectMemorableLinesDeterministic,
  specificsPresentIn,
  type MemorableCandidate,
} from "../src/optimizers/memorableLines.js";
import type { SourcePacketV1 } from "../src/artifacts/artifactTypes.js";

const EM_DASH = "—";

// ── CLASS 2 ────────────────────────────────────────────────────────────────────

test("CLASS 2: the section-writer DO NOT block carries the em-dash prohibition the ship gate enforces", () => {
  const lines = sectionDoNotLines("compiler/ch01/summary-pack.json");
  const rule = lines.find((line) => line.includes(EM_DASH) || /em dash/i.test(line));
  assert.ok(
    rule,
    "no DO NOT line mentions the em dash, yet ship-gate B5 blocks the chapter on a single one — "
    + `that is the write/ship disagreement. Lines were:\n${lines.join("\n")}`,
  );
  // The character itself must be shown: "no em dash" without the glyph leaves the
  // writer guessing which of -, –, — is meant, and the gate only rejects U+2014.
  assert.ok(rule.includes(EM_DASH), `the rule must show the character it bans: ${rule}`);
  assert.match(rule, /B5/, `the rule should name the gate that enforces it: ${rule}`);
});

test("CLASS 2: the write-time rule and the ship gate ban the SAME character", () => {
  // The mirror is only worth anything if both sides key on U+2014 and nothing else.
  assert.equal(checkNoEmDash(`a ${EM_DASH} b`).length, 1, "B5's primitive must fire on U+2014");
  assert.equal(checkNoEmDash("a - b").length, 0, "a hyphen is not an em dash");
  assert.equal(checkNoEmDash("a – b").length, 0, "an en dash is not an em dash");
  const rule = sectionDoNotLines("x.json").find((line) => line.includes(EM_DASH))!;
  assert.equal(checkNoEmDash(rule).length, 1, "the rule quotes exactly the banned character");
});

// ── CLASS 3 ────────────────────────────────────────────────────────────────────

/**
 * The live Franklin ch03 case anchors, verbatim from
 * candidates/…-run-29d119c59544a5d991c71c7c9fec04bb-candidate/content/inputs/source/ch03.source.json.
 */
function ch03Anchors(): Map<string, SourcePacketV1["allowedAnchors"][number]> {
  const anchor = (id: string, hardSpecifics: string[]): SourcePacketV1["allowedAnchors"][number] => ({
    id,
    kind: "named_example",
    label: id,
    summary: id,
    hardSpecifics,
    supportsClaimTypes: ["memorable_line", "breakdown_claim", "example"],
    text: id,
  } as SourcePacketV1["allowedAnchors"][number]);
  return new Map([
    ["ch03.case.union-fire-company", anchor("ch03.case.union-fire-company", ["Union Fire Company", "1736", "thirty members"])],
    ["ch03.case.pennsylvania-hospital", anchor("ch03.case.pennsylvania-hospital", ["Pennsylvania Hospital", "1751", "Dr. Thomas Bond", "matching grant"])],
    ["ch03.case.kite-experiment", anchor("ch03.case.kite-experiment", ["1752", "kite experiment", "key and string"])],
  ].map(([id, a]) => [id as string, a as SourcePacketV1["allowedAnchors"][number]]));
}

const CH03_TIER_IDS = ["ch03.case.pennsylvania-hospital", "ch03.case.kite-experiment", "ch03.case.union-fire-company"];

/** The gate's own selection policy — the exact object SEC16's selection is built
 *  from (sectionGate.validateSummaryPack), and the one assembleSections hands the
 *  assembler. */
function policyFor(anchors: Map<string, SourcePacketV1["allowedAnchors"][number]>, forbiddenDuplicates: readonly string[] = []) {
  const specifics = [...anchors.values()]
    .flatMap((anchor) => anchor.hardSpecifics ?? [])
    .sort((a, b) => b.length - a.length);
  return {
    specificsIn: (candidate: MemorableCandidate) => specificsPresentIn(candidate.text, specifics),
    forbiddenDuplicates,
  };
}

/**
 * A fastRead assembled from the live ch03 tier's own sentences (the first four are
 * verbatim from the candidate; the fifth is written to the same shape so the tier
 * can fill all three groundable slots). The live shape it reproduces: the two
 * HIGHEST-scoring sentences are UNGROUNDABLE — they narrate the Academy, whose
 * anchor this tier does not cite — while three lower-scoring ones each carry two
 * verbatim hardSpecifics of a cited case. That is exactly the configuration in
 * which "rank by score" and "rank by grounding, then score" return different top-3
 * sets, which is what the live run shipped.
 */
const LIVE_FAST_READ = [
  "In 1749, backers paid for the Academy years before any charter was signed.",
  "Each man got a bucket and a bag before any fire broke out.",
  "In 1736, about thirty men formed the Union Fire Company.",
  "In 1752, Franklin ran the kite experiment during a storm.",
  "The 1751 matching grant for the Pennsylvania Hospital doubled every private gift.",
].join(" ");

test("CLASS 3: the compile-validated memorable lines are exactly the lines the assembler ships", () => {
  const anchors = ch03Anchors();
  const policy = policyFor(anchors);
  const breakdown = { fastRead: LIVE_FAST_READ, deepRead: "", fullRead: "" };
  const anchorIdsForTier = () => CH03_TIER_IDS;

  // What the section gate validates (SEC15/SEC16/SEC118/SEC135 read this set).
  const gateSelected = selectMemorableCandidates(harvestMemorableCandidates(breakdown, anchorIdsForTier), policy);
  // What the assembler writes into chapter.memorableLines.
  const shipped = selectMemorableLinesDeterministic({ breakdown } as never, { anchorIdsForTier, policy });

  assert.deepEqual(
    shipped.map((line) => line.text),
    gateSelected.map((candidate) => candidate.text),
    "the sentences SEC16 validates and the sentences that ship must be the same sentences; "
    + "when they diverge, a compile PASS says nothing about the shipped lines",
  );
});

test("CLASS 3: the shipped set obeys the specifics cap the gate blocks on", () => {
  // The live ch03 tier is exactly the shape package 1B is aimed at: its highest-
  // scoring sentences are identifier sentences ("In 1736, about thirty men formed the
  // Union Fire Company." carries two of that case's hardSpecifics). Selection now
  // ranks those BELOW anything that states the idea, and SEC16 blocks any that reach
  // the shipped three.
  const anchors = ch03Anchors();
  const policy = policyFor(anchors);
  const candidates = harvestMemorableCandidates({ fastRead: LIVE_FAST_READ, deepRead: "", fullRead: "" }, () => CH03_TIER_IDS);
  const specifics = [...anchors.values()].flatMap((anchor) => anchor.hardSpecifics ?? []);
  assert.ok(
    candidates.some((candidate) => specificsPresentIn(candidate.text, specifics).length > MEMORABLE_LINE_MAX_SPECIFICS),
    "fixture must reproduce the live shape: the pool carries identifier sentences",
  );
  // This live tier is FOUR identifier sentences and one bare scene line, so it cannot
  // fill three compliant slots at all: the selector ships what there is and SEC16
  // blocks the pack, which is the correct outcome — the fix is a breakdown that seeds
  // portable sentences, not a selector that pretends one exists.
  const selected = selectMemorableCandidates(candidates, policy);
  assert.ok(
    selected.some((candidate) => specificsPresentIn(candidate.text, specifics).length > MEMORABLE_LINE_MAX_SPECIFICS),
    "the live tier has nothing better to offer, so the over-cap line still reaches the set and SEC16 fires",
  );

  // Seed two portable sentences into the same tier and every identifier pair drops
  // out of the shipped three, even though several of them score HIGHER as aphorisms.
  const seeded = harvestMemorableCandidates(
    {
      fastRead: `${LIVE_FAST_READ} A charter needs subscribers before it needs permission. You fund the thing before you ask permission for it.`,
      deepRead: "",
      fullRead: "",
    },
    () => CH03_TIER_IDS,
  );
  const seededSelection = selectMemorableCandidates(seeded, policy);
  assert.equal(seededSelection.length, 3);
  assert.deepEqual(
    seededSelection.filter((candidate) => specificsPresentIn(candidate.text, specifics).length > MEMORABLE_LINE_MAX_SPECIFICS).map((c) => c.text),
    [],
    "with portable sentences on offer the identifier pairs are not shipped",
  );
  assert.ok(
    seededSelection.some((candidate) => /needs permission|ask permission/.test(candidate.text)),
    "and a seeded principle line is one of the three",
  );
});

test("CLASS 3: omitting the policy reproduces the pure-score selection exactly", () => {
  // Back-compatibility guard: every caller that has no source packet in hand
  // (generateChapter) must keep the behaviour it had before — with no specifics
  // supplied every candidate is grounded and every principle density is 1.0, so the
  // ordering collapses to the aphorism score.
  const breakdown = { fastRead: LIVE_FAST_READ, deepRead: "", fullRead: "" };
  const lines = selectMemorableLinesDeterministic({ breakdown } as never);
  const expected = selectMemorableCandidates(harvestMemorableCandidates(breakdown));
  assert.deepEqual(lines.map((line) => line.text), expected.map((candidate) => candidate.text));
  for (const line of lines) {
    assert.match(line.location, /^breakdown\.(fastRead|deepRead|fullRead)$/);
    assert.ok(line.why.startsWith("From the "), line.why);
  }
});

test("CLASS 3: a packet with no hard specifics leaves the ordering untouched", () => {
  // A book whose anchors carry no specifics has nothing for the density key to
  // measure, so wiring the policy in must not change which sentences it picks.
  const thin = new Map<string, SourcePacketV1["allowedAnchors"][number]>([
    ["ch09.case.thin", { id: "ch09.case.thin", kind: "named_example", label: "thin", summary: "thin", hardSpecifics: [], supportsClaimTypes: ["memorable_line"], text: "thin" } as SourcePacketV1["allowedAnchors"][number]],
  ]);
  const breakdown = { fastRead: LIVE_FAST_READ, deepRead: "", fullRead: "" };
  const withPolicy = selectMemorableLinesDeterministic(
    { breakdown } as never,
    { anchorIdsForTier: () => ["ch09.case.thin"], policy: policyFor(thin) },
  );
  const without = selectMemorableLinesDeterministic({ breakdown } as never);
  assert.deepEqual(withPolicy.map((l) => l.text), without.map((l) => l.text));
});
