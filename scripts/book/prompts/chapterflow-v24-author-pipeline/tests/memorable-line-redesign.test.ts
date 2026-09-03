/**
 * MEMORABLE LINES — the grounding rule inverted (package 1B item c; register
 * R-060, R-071, R-076, R-281).
 *
 * The old rule: a selected memorable line had to carry TWO of one cited case's
 * hardSpecifics verbatim (SEC16), inside a <=14-word aphorism (SEC118). Those two
 * demands together are why the shipped lines are token pairs. Measured on the live
 * Franklin rev-6 package, 11 of the 12 shipped memorable lines carry two or more
 * source specifics:
 *
 *   "Three puffy rolls and one Dutch dollar bought him a fresh start."   (ch01)
 *   "Forty shillings joined you, ten shillings kept you in."             (ch03)
 *   "Lord Loudoun holds the ship in New York for weeks."                 (ch04)
 *
 * The twelfth is the one line a reader would actually keep — "A charter needs
 * subscribers before it needs permission." (ch03) — and it carries ZERO specifics,
 * so the old SEC16 is the rule that would have rejected it.
 *
 * The new rule: a line is grounded when it is DERIVABLE from the tiers (true by
 * construction — the selector only ever harvests sentences out of them, and A11
 * re-checks it at ship) AND carries AT MOST ONE specific. Selection ranks by
 * principle density (the share of words that are not part of any source specific)
 * ahead of the aphorism score, and two further constraints come straight from the
 * shipped book (R-281): ch02 spent two of its three lines on the same fact, and one
 * of them was a verbatim clone of the hook's second sentence.
 *
 * WHAT SEC16 STOPS BLOCKING: a principle-shaped line that names no case at all.
 * WHAT IT NOW CATCHES: the identifier pair. The rest of the family is untouched —
 * SEC17 still requires three harvestable candidates, SEC118 still requires clean
 * (<=14-word) lines (now counted over the SELECTED three, R-071), and ship-time A11
 * still requires every shipped line to appear verbatim in a tier.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { validateSummaryPack, type SectionFinding } from "../src/sections/sectionGate.js";
import {
  harvestMemorableCandidates,
  memorableLineProblems,
  principleDensity,
  selectMemorableCandidates,
  specificsPresentIn,
} from "../src/optimizers/memorableLines.js";
import type { ChapterBlueprintV1, SourcePacketV1, SummaryPackV1 } from "../src/artifacts/artifactTypes.js";
import type { SourceAnchorForPrompt } from "../src/types.js";

const CHID = "zz-memorable-ch01";
const BP = {
  chapterNumber: 1,
  chapterId: CHID,
  sections: { quiz: [], cards: [], examples: [] },
  constraints: { allowedFactIds: [], allowedCaseIds: [], forbiddenClaims: [], forbiddenLeakage: [], bannedHouseTics: [] },
} as unknown as ChapterBlueprintV1;

/** The live ch01 arrival case and the ch03 library case, verbatim from rev-6. */
const ARRIVAL: SourceAnchorForPrompt = {
  id: "ch01.case.arrival-philadelphia",
  kind: "named_example",
  label: "Arrival in Philadelphia",
  text: "A runaway apprentice reaches Philadelphia with one Dutch dollar and buys three puffy rolls.",
  hardSpecifics: ["three puffy rolls", "one Dutch dollar", "Market Street"],
  supportsClaimTypes: ["memorable_line", "breakdown_claim", "hook", "takeaway"],
};
const LIBRARY: SourceAnchorForPrompt = {
  id: "ch03.case.library",
  kind: "named_example",
  label: "Library Company subscription",
  text: "Members paid forty shillings to join and ten shillings a year after that.",
  hardSpecifics: ["forty shillings", "ten shillings"],
  supportsClaimTypes: ["memorable_line", "breakdown_claim", "hook", "takeaway"],
};

function packet(anchors: SourceAnchorForPrompt[]): SourcePacketV1 {
  return { allowedAnchors: anchors, facts: [], namedCases: [], allowedEntities: [], allowedPlaces: [] } as unknown as SourcePacketV1;
}

function byCheck(findings: SectionFinding[], id: string): SectionFinding[] {
  return findings.filter((f) => f.checkId === id);
}

type PackParts = { fast?: string; deep?: string; full?: string; hook?: string; counter?: string; takeaway?: string; ids?: string[] };

function summaryPack(parts: PackParts): SummaryPackV1 {
  const ids = parts.ids ?? [ARRIVAL.id];
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "summary-pack",
    chapterId: CHID,
    hook: {
      hook: parts.hook ?? "A runaway apprentice walks into a strange city with almost nothing in his pocket.",
      counterintuition: parts.counter ?? "The first purchase looks reckless and is the only one that keeps the week open.",
      sourceAnchorIds: ids,
      counterintuitionSourceAnchorIds: ids,
    },
    breakdown: {
      fastRead: parts.fast ?? "",
      deepRead: parts.deep ?? "",
      fullRead: parts.full ?? "",
      sourceAnchorIds: { fastRead: ids, deepRead: ids, fullRead: ids },
    },
    keyTakeaway: parts.takeaway ?? "Spend the first coin on what keeps you working tomorrow, not on what looks safe today.",
    keyTakeawaySourceAnchorIds: ids,
  } as unknown as SummaryPackV1;
}

// Live rev-6 shipped lines and their principle-shaped alternatives.
const TOKEN_PAIR = "Three puffy rolls and one Dutch dollar bought him a fresh start.";
const PRINCIPLE = "A charter needs subscribers before it needs permission.";
const PRINCIPLE_2 = "You spend the first coin on tomorrow, not on comfort tonight.";
const PRINCIPLE_3 = "The purchase you make first decides the week you get next.";
const ONE_SPECIFIC = "Three puffy rolls bought a working morning, not a comfortable one.";

// ── SEC16 — at most one specific ─────────────────────────────────────────────

test("SEC16 blocks a selected memorable line that stacks two source specifics (live rev-6 ch01)", () => {
  const pack = summaryPack({ fast: [TOKEN_PAIR, PRINCIPLE_2, PRINCIPLE_3].join(" ") });
  const findings = byCheck(validateSummaryPack(pack, BP, packet([ARRIVAL])), "SEC16.summary_memorable_anchor_specifics");
  assert.equal(findings.length, 1, `the identifier pair must block; got:\n${findings.map((f) => f.message).join("\n")}`);
  assert.equal(findings[0].severity, "blocker");
  assert.match(findings[0].message, /three puffy rolls/i);
  assert.match(findings[0].message, /one Dutch dollar/i);
});

test("SEC16 accepts the principle line the OLD two-specific rule would have rejected", () => {
  const pack = summaryPack({ fast: [PRINCIPLE, PRINCIPLE_2, PRINCIPLE_3].join(" ") });
  const findings = byCheck(validateSummaryPack(pack, BP, packet([ARRIVAL])), "SEC16.summary_memorable_anchor_specifics");
  assert.deepEqual(findings, [], `a line that states the principle carries no specifics quota; got:\n${findings.map((f) => f.message).join("\n")}`);
});

test("SEC16 accepts a line carrying exactly one specific", () => {
  const pack = summaryPack({ fast: [ONE_SPECIFIC, PRINCIPLE_2, PRINCIPLE_3].join(" ") });
  assert.deepEqual(byCheck(validateSummaryPack(pack, BP, packet([ARRIVAL])), "SEC16.summary_memorable_anchor_specifics"), []);
});

// ── selection: principle density over aphorism score ────────────────────────

test("selection ranks by principle density ahead of the aphorism score", () => {
  // The token pair scores HIGHER as an aphorism (it is 12 words and reads cleanly),
  // and the old ordering put it first. Principle density puts the principle line
  // first: none of its words belong to a source specific.
  const candidates = harvestMemorableCandidates({ fastRead: [TOKEN_PAIR, PRINCIPLE_2].join(" ") }, () => [ARRIVAL.id]);
  const specifics = ARRIVAL.hardSpecifics!;
  assert.ok(
    principleDensity(PRINCIPLE_2, specifics) > principleDensity(TOKEN_PAIR, specifics),
    "fixture must reproduce the shape: the token pair is the denser-in-specifics line",
  );
  const selected = selectMemorableCandidates(candidates, { specificsIn: (c) => specificsPresentIn(c.text, specifics) });
  assert.equal(selected[0].text, PRINCIPLE_2, "the principle line is selected first");
});

test("specificsPresentIn counts each distinct specific once, matching the gate", () => {
  assert.deepEqual(specificsPresentIn(TOKEN_PAIR, ARRIVAL.hardSpecifics!), ["three puffy rolls", "one Dutch dollar"]);
  assert.deepEqual(specificsPresentIn(PRINCIPLE, ARRIVAL.hardSpecifics!), []);
});

// ── SEC135 — the two selector constraints from the shipped book (R-281) ─────

test("SEC135 blocks a memorable line that duplicates the hook (live rev-6 ch02 shape)", () => {
  // rev-6 ch02's second line is verbatim the second sentence of its own hook.
  const clone = "The book was meant to teach the means and manner of building good habits.";
  const pack = summaryPack({
    hook: `Franklin sketched a separate book he never finished. ${clone}`,
    fast: [clone, PRINCIPLE_2, PRINCIPLE_3].join(" "),
  });
  const findings = byCheck(validateSummaryPack(pack, BP, packet([ARRIVAL])), "SEC135.summary_memorable_variety");
  assert.equal(findings.length, 0, "the SELECTOR drops it, so no blocker is needed on a fresh draft");
  const selected = selectMemorableCandidates(
    harvestMemorableCandidates({ fastRead: [clone, PRINCIPLE_2, PRINCIPLE_3].join(" ") }, () => [ARRIVAL.id]),
    { forbiddenDuplicates: [`Franklin sketched a separate book he never finished. ${clone}`] },
  );
  assert.ok(selected.every((c) => c.text !== clone), "a sentence the hook already carries is never selected");
});

test("SEC135 blocks two shipped lines that share their primary specific (live rev-6 ch02)", () => {
  // Both lines are built on the same two specifics; the shipped book spent two of
  // its three lines on one fact.
  const problems = memorableLineProblems(
    [
      { text: "Forty shillings joined you, ten shillings kept you in." },
      { text: "Forty shillings was the price of joining the subscription." },
      { text: PRINCIPLE_2 },
    ],
    { allSpecifics: LIBRARY.hardSpecifics!, forbiddenDuplicates: [], proseHaystack: null },
  );
  assert.ok(
    problems.some((p) => /share/i.test(p) && /forty shillings/i.test(p)),
    `two lines on one specific must be reported; got:\n${problems.join("\n")}`,
  );
});

// ── SEC118 — clean count over the SELECTED set (R-071) ──────────────────────

// 16-word candidates: harvestable (memorableLineScore admits 6-16 words) but NOT
// clean under the rubric's <=14-word rule — the exact band the pool-wide count let
// through on every rev-6 chapter.
const DIRTY_1 = "You spend the very first coin you have on the work that still waits tomorrow morning.";
const DIRTY_2 = "The purchase you make on the first day quietly decides the shape of the week following.";
const DIRTY_3 = "A person who buys comfort early has already spent the room needed for the second week.";
// Clean candidates the SELECTOR will not ship: both are sentences of the keyTakeaway,
// which a pinned line may not reproduce (R-281). The harvest POOL still contains them.
const CLEAN_TAKEAWAY_1 = "You act before the snapshot lands.";
const CLEAN_TAKEAWAY_2 = "You keep the room you will need.";

test("SEC118 counts clean lines among the three that SHIP, not across the harvest pool", () => {
  const pack = summaryPack({
    fast: [DIRTY_1, DIRTY_2, DIRTY_3, CLEAN_TAKEAWAY_1, CLEAN_TAKEAWAY_2].join(" "),
    takeaway: `${CLEAN_TAKEAWAY_1} ${CLEAN_TAKEAWAY_2}`,
  });
  const findings = byCheck(validateSummaryPack(pack, BP, packet([ARRIVAL])), "SEC118.summary_memorable_lines");
  assert.equal(findings.length, 1, `three 16-word selected lines must trip the clean floor even though the POOL holds two clean ones; got:\n${findings.map((f) => f.message).join("\n")}`);
  assert.equal(findings[0].severity, "blocker");
  assert.match(findings[0].message, /only 0 of the 3/);
});

test("SEC118 passes when two of the three shipped lines are clean", () => {
  const pack = summaryPack({ fast: [PRINCIPLE_2, PRINCIPLE_3, DIRTY_1].join(" ") });
  assert.deepEqual(byCheck(validateSummaryPack(pack, BP, packet([ARRIVAL])), "SEC118.summary_memorable_lines"), []);
});

// ── R-076 — the SHIPPED set is re-validated after a repair ──────────────────

test("memorableLineProblems catches the line the live repair shipped past every gate", () => {
  // repair-r7 ch04's third shipped line: 30 words, 176 characters. memorableLineScore
  // returns 0 above 150 chars or 16 words, so the deterministic selector could never
  // have produced it — a repair round rewrote the chapter and nothing re-derived or
  // re-checked the lines.
  const shipped = "Off Falmouth, poor visibility puts the ship close to the rocks, and only a last-moment signal from a warning light turns the vessel away from a wreck that night.";
  const problems = memorableLineProblems([{ text: shipped }], {
    allSpecifics: ["Falmouth", "warning light"],
    forbiddenDuplicates: [],
    proseHaystack: "The chapter's prose never carries this sentence.",
  });
  assert.ok(problems.some((p) => /not.*verbatim|appears nowhere/i.test(p)), `a line absent from the prose must be reported; got:\n${problems.join("\n")}`);
  assert.ok(problems.some((p) => /specific/i.test(p)), `and stacking two specifics must be reported; got:\n${problems.join("\n")}`);
});

test("memorableLineProblems is silent on a compliant shipped set", () => {
  const prose = `${PRINCIPLE} ${PRINCIPLE_2} ${ONE_SPECIFIC}`;
  const problems = memorableLineProblems(
    [{ text: PRINCIPLE }, { text: PRINCIPLE_2 }, { text: ONE_SPECIFIC }],
    { allSpecifics: ARRIVAL.hardSpecifics!, forbiddenDuplicates: [], proseHaystack: prose },
  );
  assert.deepEqual(problems, []);
});
