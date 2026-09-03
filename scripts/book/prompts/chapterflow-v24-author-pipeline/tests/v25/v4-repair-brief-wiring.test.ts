/**
 * The repair brief, WIRED — the port-level half of the diagnosis channel.
 *
 * `v4-repair-brief.test.ts` pins how the brief is FRAMED (pure, no I/O). This
 * file pins that the framing reaches the model at all: that the round's WARN
 * findings survive the port boundary, arrive scoped to the right chapter, and
 * are rendered into a `repair_brief` prompt input beside the mandatory blockers
 * — while `qc_findings` stays blockers-only so a WARN can never read as a
 * mandate.
 *
 * Separate file, not more cases in `v4-candidate-repair-application-port.test.ts`:
 * every case here stages a full candidate to disk under real write-lock polling
 * (~16s each), and the v25 runner's per-file ceiling says in as many words that
 * that file must be SPLIT rather than grown. The rig both files drive is shared
 * in `repairPortRig.ts`.
 */

import assert from "node:assert/strict";

import { REPAIR_BRIEF_MAX_CHARS } from "../../src/app/candidateRepairBrief.js";
import type { QcIssue } from "../../src/qc/qcTypes.js";
import {
  READER_PANEL_BELOW_FLOOR_CODE,
  READER_PANEL_FACTOR_SCORES_CODE,
} from "../../src/review/readerPanelIssueCodes.js";
import { rig } from "./repairPortRig.js";
import { finishV25Tests, requiredTest } from "./harness.js";

requiredTest("a floor-only chapter reaches the writer with a brief naming the floor, its weakest factors, and only its own advisories", async (context) => {
  const subject = rig(context, {
    issueCode: `REVIEW.${READER_PANEL_BELOW_FLOOR_CODE}`,
    location: "ch01",
    extraIssues: [
      {
        code: `REVIEW.${READER_PANEL_FACTOR_SCORES_CODE}`,
        severity: "WARN",
        message: "reader-panel median composite 67.4; factor medians weakest-first: transfer 52, practical 58, retention 63, quizzes 70, summaries 71, tone 72, limits 74, insight 75, density 76, beginner 80",
        location: "ch01",
      },
      { code: "REVIEW.READER.ADVISORY.thin_example", severity: "WARN", message: "the worked example stops before the decision is made", location: "ch01/seat-0/example-2" },
      { code: "REVIEW.READER.ADVISORY.pacing", severity: "WARN", message: "the second chapter drags through its middle tier", location: "ch02/seat-1/tier-3" },
      { code: "CANDIDATE_QC_BLUEPRINT_MISMATCH", severity: "WARN", message: "compiler-owned advisory about the blueprint", location: "compiler/ch01/blueprint.json" },
    ],
  });
  const result = await subject.port.run(subject.request);
  assert.equal(result.ok, true, JSON.stringify(result));

  const brief = Buffer.from(subject.prompts[0].prompt.inputs.find((input) => input.name === "repair_brief")!.bytes).toString("utf8");
  // The whole point: the model is told there is no named defect, and is handed
  // the factor ordering plus the advisories INSTEAD of one bare number.
  assert.match(brief, /SCORE FLOOR ONLY/, brief);
  assert.match(brief, /transfer 52, practical 58/, brief);
  assert.match(brief, /the worked example stops before the decision is made/, brief);
  // Scoping is real: another chapter's advisory and a compiler-owned advisory
  // are not this chapter's diagnosis and must not appear.
  assert.doesNotMatch(brief, /the second chapter drags/, brief);
  assert.doesNotMatch(brief, /compiler-owned advisory/, brief);
  assert.ok(brief.length <= REPAIR_BRIEF_MAX_CHARS, `brief length ${brief.length}`);

  // qc_findings stays the machine-readable BLOCKER record — advisories never
  // leak into it, or a WARN would read as a mandatory fix.
  const findings = JSON.parse(Buffer.from(subject.prompts[0].prompt.inputs.find((input) => input.name === "qc_findings")!.bytes).toString("utf8")) as QcIssue[];
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "BLOCKER");

  const control = Buffer.from(subject.prompts[0].prompt.inputs[0].bytes).toString("utf8");
  assert.match(control, /Read repair_brief first/, control);
});

/**
 * The shape the LIVE path actually produces.
 *
 * A QC round only exists behind a PASSING canonical review, so the round repair
 * reads can never carry a reader BLOCKER: every reader signal on it is a WARN.
 * The blockers are the deterministic QC gates, and the only thing that can tell
 * the writer WHY readers found the chapter thin is the panel's factor line plus
 * the chapter's advisories. This is the round the canary produced for a dozen
 * rounds while repair was handed the gate blocker alone.
 */
requiredTest("the live round shape — gate blockers plus a PASSING panel's diagnosis — reaches the writer whole", async (context) => {
  const subject = rig(context, {
    extraIssues: [
      {
        code: `REVIEW.${READER_PANEL_FACTOR_SCORES_CODE}`,
        severity: "WARN",
        message: "reader-panel median composite 73 (chapter bar 70); factor medians weakest-first: transfer 55, practical 61, retention 68, quizzes 74, summaries 75, tone 76, limits 77, insight 78, density 79, beginner 82",
        location: "ch01",
      },
      { code: "REVIEW.READER.ADVISORY.thin_example", severity: "WARN", message: "the worked example stops before the decision is made", location: "ch01/seat-cold/deep read" },
      { code: "REVIEW.READER.ESCALATION.transfer", severity: "WARN", message: "the transfer prompt repeats the chapter instead of extending it", location: "ch01/seat-practitioner/tier-3" },
    ],
  });
  const result = await subject.port.run(subject.request);
  assert.equal(result.ok, true, JSON.stringify(result));

  const brief = Buffer.from(subject.prompts[0].prompt.inputs.find((input) => input.name === "repair_brief")!.bytes).toString("utf8");
  // Blockers still lead — they are the mandatory fixes.
  assert.match(brief, /MANDATORY FIXES — BLOCKERS \(1\)/, brief);
  assert.match(brief, /repair chapter opening/, brief);
  // …and the diagnosis that explains the chapter's quality now rides with them,
  // labelled as what it is: no reader blocking finding was attached here.
  assert.match(brief, /NO BLOCKING FINDING ON THIS CHAPTER/, brief);
  assert.match(brief, /transfer 55, practical 61/, brief);
  assert.match(brief, /the worked example stops before the decision is made/, brief);
  assert.match(brief, /the transfer prompt repeats the chapter/, brief);
  // Order: mandate first, diagnosis second, advisory list last.
  const blockerAt = brief.indexOf("MANDATORY FIXES");
  const factorAt = brief.indexOf("transfer 55");
  const advisoryAt = brief.indexOf("ADVISORIES CLUSTERED");
  assert.ok(blockerAt >= 0 && blockerAt < factorAt && factorAt < advisoryAt, brief);
  assert.ok(brief.length <= REPAIR_BRIEF_MAX_CHARS, `brief length ${brief.length}`);

  // The mandate boundary stays machine-readable too: qc_findings is blockers only.
  const findings = JSON.parse(Buffer.from(subject.prompts[0].prompt.inputs.find((input) => input.name === "qc_findings")!.bytes).toString("utf8")) as QcIssue[];
  assert.deepEqual(findings.map((finding) => finding.severity), ["BLOCKER"]);
});

requiredTest("an advisory that names no single chapter is dropped, never escalated into a repair refusal", async (context) => {
  const subject = rig(context, {
    extraIssues: [
      { code: "REVIEW.READER.ADVISORY.tone", severity: "WARN", message: "unlocated advisory with no chapter at all" },
      { code: "REVIEW.READER.ADVISORY.repetition", severity: "WARN", message: "advisory naming the whole book", location: "book" },
    ],
  });
  // A blocker-authorized repair must survive advisories the port cannot place:
  // the blocker path stays fail-closed, the diagnosis path stays lenient.
  const result = await subject.port.run(subject.request);
  assert.equal(result.ok, true, JSON.stringify(result));
  const brief = Buffer.from(subject.prompts[0].prompt.inputs.find((input) => input.name === "repair_brief")!.bytes).toString("utf8");
  assert.match(brief, /MANDATORY FIXES — BLOCKERS \(1\)/, brief);
  assert.doesNotMatch(brief, /unlocated advisory/, brief);
  assert.doesNotMatch(brief, /advisory naming the whole book/, brief);
});
/**
 * R-154 — a BOOK-WIDE advisory names every chapter it applies to
 * ("ch01,ch02"), and groupAdvisories required EXACTLY ONE match, so it was
 * dropped from every brief. A BLOCKER with the identical location is fanned out
 * to each named chapter (#501), so the two paths disagreed about what the same
 * string meant, and the class of finding that most needs stating (the same
 * defect in several chapters) was the one class nobody was told about.
 */
requiredTest("an advisory naming several chapters reaches each of them, labelled BOOK-WIDE", async (context) => {
  const subject = rig(context, {
    issueCode: `REVIEW.${READER_PANEL_BELOW_FLOOR_CODE}`,
    location: "ch01",
    extraIssues: [
      { code: "CM0.content_machinery_monoculture", severity: "WARN", message: "every chapter opens on the same machinery", location: "ch01,ch02" },
      { code: "REVIEW.READER.ADVISORY.tone", severity: "WARN", message: "only the second chapter is affected", location: "ch02/seat-1/tier-3" },
    ],
  });
  const result = await subject.port.run(subject.request);
  assert.equal(result.ok, true, JSON.stringify(result));

  const brief = Buffer.from(subject.prompts[0].prompt.inputs.find((input) => input.name === "repair_brief")!.bytes).toString("utf8");
  assert.match(brief, /every chapter opens on the same machinery/, brief);
  // It must arrive LABELLED, or the writer reads a book-wide defect as a local one.
  assert.match(brief, /BOOK-WIDE/, brief);
  assert.match(brief, /ch01, ch02/, brief);
  // Scoping is still real: a single-chapter advisory for ch02 stays out of ch01.
  assert.doesNotMatch(brief, /only the second chapter is affected/, brief);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
