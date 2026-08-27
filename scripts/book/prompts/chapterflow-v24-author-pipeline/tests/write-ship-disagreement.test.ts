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
 * CLASS 3 — MEMORABLE-LINE GROUNDING (SEC16 vs SC11.2). Both gates apply the SAME
 * rule to a memorable line: >=1 cited case grounded by 2 of its hardSpecifics
 * verbatim, OR-semantics. They disagreed anyway, because they were reading DIFFERENT
 * SENTENCES: the section gate ranked its candidates grounding-first and validated
 * its own top 3, while the assembler ranked the same candidate pool by pure aphorism
 * score and shipped a different top 3. Compile validated sentences that never
 * shipped. Fixed by giving both lanes ONE selection function.
 *
 * Every fixture below is the LIVE content or a byte-faithful reduction of it.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { sectionDoNotLines } from "../src/sections/sectionTasks.js";
import { checkNoEmDash } from "../src/critics/register.js";
import {
  harvestMemorableCandidates,
  selectMemorableCandidates,
  selectMemorableLinesDeterministic,
  type MemorableCandidate,
} from "../src/optimizers/memorableLines.js";
import { validateAnchorHardSpecifics } from "../src/sections/sectionGate.js";
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

/** The gate's own grounding predicate — the exact call SEC16 makes. */
function isGrounded(anchors: Map<string, SourcePacketV1["allowedAnchors"][number]>) {
  return (candidate: MemorableCandidate): boolean => validateAnchorHardSpecifics(
    candidate.ids,
    anchors,
    "memorable_line",
    candidate.text,
    `selected memorable line "${candidate.text.replace(/[.!?]+$/, "")}"`,
    2,
    "any",
  ).length === 0;
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
  const grounded = isGrounded(anchors);
  const breakdown = { fastRead: LIVE_FAST_READ, deepRead: "", fullRead: "" };
  const anchorIdsForTier = () => CH03_TIER_IDS;

  // What the section gate validates (SEC15/SEC16 read this set).
  const gateSelected = selectMemorableCandidates(
    harvestMemorableCandidates(breakdown, anchorIdsForTier),
    grounded,
  );
  // What the assembler writes into chapter.memorableLines.
  const shipped = selectMemorableLinesDeterministic(
    { breakdown } as never,
    { anchorIdsForTier, isGrounded: grounded },
  );

  assert.deepEqual(
    shipped.map((line) => line.text),
    gateSelected.map((candidate) => candidate.text),
    "the sentences SEC16 validates and the sentences that ship must be the same sentences; "
    + "when they diverge, a compile PASS says nothing about the shipped lines",
  );

  // And the set that ships is genuinely grounded — SEC16 raises nothing on it, which
  // is the property SC11.2 re-checks at ship on the same content.
  const sec16 = gateSelected.flatMap((candidate) => validateAnchorHardSpecifics(
    candidate.ids, anchors, "memorable_line", candidate.text, "selected memorable line", 2, "any",
  ));
  assert.deepEqual(sec16, [], `SEC16 must be clean on the shipped set; got:\n${sec16.join("\n")}`);
});

test("CLASS 3: the pure-score ordering is what shipped an ungroundable line while SEC16 passed", () => {
  // This pins the DEFECT itself, so the fix cannot be quietly reverted: with the
  // grounding predicate withheld (the assembler's old behaviour) the top-scoring
  // sentence is ungroundable, while the gate's grounding-aware order puts a
  // groundable one first. Same candidate pool, two answers.
  const anchors = ch03Anchors();
  const grounded = isGrounded(anchors);
  const candidates = harvestMemorableCandidates(
    { fastRead: LIVE_FAST_READ, deepRead: "", fullRead: "" },
    () => CH03_TIER_IDS,
  );
  const pureScore = selectMemorableCandidates(candidates);
  const groundingAware = selectMemorableCandidates(candidates, grounded);

  assert.ok(
    pureScore.some((candidate) => !grounded(candidate)),
    "fixture must reproduce the live shape: the pure-score top-3 carries an ungroundable line",
  );
  assert.ok(
    groundingAware.every((candidate) => grounded(candidate)),
    "the grounding-aware order must be able to fill all three slots from groundable candidates",
  );
  assert.notDeepEqual(
    pureScore.map((candidate) => candidate.text),
    groundingAware.map((candidate) => candidate.text),
    "if the two orderings agreed on this fixture it would not pin the divergence",
  );
});

test("CLASS 3: omitting the grounding wiring reproduces the previous pure-score selection exactly", () => {
  // Back-compatibility guard: every caller that has no source packet in hand
  // (generateChapter) must keep the byte-identical behaviour it had before.
  const breakdown = { fastRead: LIVE_FAST_READ, deepRead: "", fullRead: "" };
  const lines = selectMemorableLinesDeterministic({ breakdown } as never);
  const expected = selectMemorableCandidates(harvestMemorableCandidates(breakdown));
  assert.deepEqual(lines.map((line) => line.text), expected.map((candidate) => candidate.text));
  for (const line of lines) {
    assert.match(line.location, /^breakdown\.(fastRead|deepRead|fullRead)$/);
    assert.ok(line.why.startsWith("From the "), line.why);
  }
});

test("CLASS 3: a tier whose cited cases are all specifics-poor still selects (the vacuous case stays a no-op)", () => {
  // validateAnchorHardSpecifics skips anchors carrying fewer than `min` specifics, so
  // every candidate is vacuously grounded. The grounding key must then be inert and
  // the selection must collapse to pure score — otherwise wiring grounding in would
  // change selections on books it has nothing to say about.
  const thin = new Map<string, SourcePacketV1["allowedAnchors"][number]>([
    ["ch09.case.thin", { id: "ch09.case.thin", kind: "named_example", label: "thin", summary: "thin", hardSpecifics: ["only one"], supportsClaimTypes: ["memorable_line"], text: "thin" } as SourcePacketV1["allowedAnchors"][number]],
  ]);
  const breakdown = { fastRead: LIVE_FAST_READ, deepRead: "", fullRead: "" };
  const withGrounding = selectMemorableLinesDeterministic(
    { breakdown } as never,
    { anchorIdsForTier: () => ["ch09.case.thin"], isGrounded: isGrounded(thin) },
  );
  const without = selectMemorableLinesDeterministic({ breakdown } as never);
  assert.deepEqual(withGrounding.map((l) => l.text), without.map((l) => l.text));
});
