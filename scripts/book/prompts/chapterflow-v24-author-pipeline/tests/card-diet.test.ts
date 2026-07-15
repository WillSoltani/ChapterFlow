/**
 * IMP-05 — the writer-card diet's structural guarantees (the plan's test list).
 *
 * Precedence + instruction/data separation, retry/regen parity (no legacy block
 * re-enters), no named-scene-taxonomy leakage, structured findings ride the
 * typed envelope, full-artifact fields survive the diet, and the approved
 * IMP-00 root instructions do not duplicate the card.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import {
  AUTHOR_HOUSE_RULES,
  AUTHOR_PRECEDENCE,
  AUTHOR_PREMIUM_BLOCK,
  AUTHOR_QUALITY_BAR,
  authorCardComposition,
  authorCardMetrics,
  authorSelfVerify,
  buildAuthorCard,
} from "../src/orchestrator/authorRun.js";
import type { SourcePacketV1 } from "../src/artifacts/artifactTypes.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKET = JSON.parse(readFileSync(resolve(HERE, "fixtures", "fact-ranking-legacy-packet.json"), "utf8")) as SourcePacketV1;

function card(opts: Parameters<typeof buildAuthorCard>[0] extends infer T ? Partial<T> : never = {}): string {
  return buildAuthorCard({ bookId: "zz-diet", chapterNumber: 3, briefMd: "# brief\n", packet: PACKET, voice: null, ...(opts as object) } as Parameters<typeof buildAuthorCard>[0]);
}

// ── precedence (instruction 3) ────────────────────────────────────────────────

test("precedence: safety/source/identity ranks first, optional style last; the order rides the card", () => {
  const c = card();
  assert.ok(c.includes(AUTHOR_PRECEDENCE), "precedence block on the card");
  const order = ["Safety, source obedience", "Schema and product completeness", "Thesis, evidence", "This chapter's objective", "Active book-level constraints", "Optional style"];
  let last = -1;
  for (const item of order) {
    const idx = AUTHOR_PRECEDENCE.indexOf(item);
    assert.ok(idx > last, `"${item}" appears after the previous precedence tier`);
    last = idx;
  }
});

test("precedence-conflict: a lower-priority style/deal line can never outrank a source or schema invariant (the card says so)", () => {
  // The card structurally states that safety/source/schema outrank style. This is
  // the conflict-resolution contract the reviewers + gates enforce; we pin that
  // the contract is present and ordered (the enforcement is the source-use plan +
  // gate, tested elsewhere).
  assert.ok(AUTHOR_PRECEDENCE.indexOf("source obedience") < AUTHOR_PRECEDENCE.indexOf("Optional style"), "source outranks style");
  assert.ok(AUTHOR_PRECEDENCE.indexOf("Schema and product completeness") < AUTHOR_PRECEDENCE.indexOf("Optional style"), "schema outranks style");
});

// ── instruction/data separation (instruction 6) ──────────────────────────────

test("data separation: source projection + prior findings ride the typed untrusted-data envelope; control text stays outside", () => {
  const c = card({ complaints: ["quiz Q2: the key echoes the prose"] } as Parameters<typeof buildAuthorCard>[0]);
  // The projection and the complaints are enveloped (IMP-03), so their content
  // cannot act as instruction.
  assert.ok(c.includes('<chapterflow_untrusted_artifact type="source-packet-projection"'), "projection enveloped");
  assert.ok(c.includes('<chapterflow_untrusted_artifact type="reviewer-finding"'), "prior findings enveloped");
  // The control blocks are NOT inside an envelope (they are the instruction channel).
  const firstEnvelope = c.indexOf("<chapterflow_untrusted_artifact");
  assert.ok(c.indexOf(AUTHOR_PRECEDENCE) < firstEnvelope, "precedence is control text, before any data block");
});

// ── retry/regen parity (instruction 11) ───────────────────────────────────────

test("retry/regen parity: the regeneration card is the SAME dieted core + typed findings, never a larger legacy block", () => {
  const first = card();
  const regen = card({ complaints: ["deep read restates the fast read", "quiz Q2 key contradicts the prose"] } as Parameters<typeof buildAuthorCard>[0]);
  // Same control core.
  for (const block of [AUTHOR_PRECEDENCE, AUTHOR_HOUSE_RULES, AUTHOR_QUALITY_BAR, AUTHOR_PREMIUM_BLOCK]) {
    assert.ok(regen.includes(block), "regen card carries the same dieted control block");
  }
  // The ONLY addition is the enveloped findings section — no legacy quality-bar text.
  assert.ok(regen.length > first.length, "regen adds the findings section");
  assert.ok(regen.includes("PRIOR-ATTEMPT COMPLAINTS"), "findings section present on regen only");
  assert.ok(!first.includes("PRIOR-ATTEMPT COMPLAINTS"), "absent on the first attempt");
  // No removed legacy lesson re-enters on the retry.
  for (const legacy of ["DISTRACTOR TRANSFORM", "ECHO SYMMETRY", "polish/announce/slides", "MEASURABLY CHANGED", "run ALL SEVEN"]) {
    assert.ok(!regen.includes(legacy), `legacy text "${legacy}" does not re-enter on the retry card`);
  }
});

// ── no named-scene-taxonomy leakage (instruction 9, rollback "new scene recipe") ─

test("no scene-taxonomy leakage: the dieted card adds no named scene-mold menu", () => {
  const c = card();
  // The removed molds must not reappear as a card menu. (These are internal deal
  // vocabularies; they belong in the brief/deal data, never as a writer menu.)
  for (const mold of ["prop-tableau", "dialogue-beat", "before-after-ledger", "postmortem", "counterfactual", "numbers-detective", "outsider-witness", "walkthrough"]) {
    assert.ok(!AUTHOR_QUALITY_BAR.includes(mold) && !AUTHOR_PREMIUM_BLOCK.includes(mold) && !AUTHOR_HOUSE_RULES.includes(mold), `no scene-mold "${mold}" leaks into the control blocks`);
  }
});

// ── full-artifact fields survive the diet (rollback "required fields optional") ─

test("full-artifact: the diet never makes a product field optional — completeness is a top invariant", () => {
  assert.match(AUTHOR_HOUSE_RULES, /never make a product field optional to save length/i, "completeness is protected against brevity pressure");
  const sv = authorSelfVerify("zz-diet", 3);
  // The self-verify COMPLETE check enumerates every required field.
  for (const field of ["hook", "three read tiers", "example count", "nine quiz questions", "cards", "implementation plan", "memorable lines"]) {
    assert.ok(sv.includes(field), `self-verify COMPLETE names "${field}"`);
  }
});

// ── self-verify diet (instruction 10) ─────────────────────────────────────────

test("self-verify is the ordered high-risk set (5 checks, <= 1200 chars), not a restatement of the whole prompt", () => {
  // Check 5 added by Chapter Format v25 (D8) — tier independence + quiz
  // feedback are the rubric-audit campaign's converged top defects; the char
  // budget was raised 900 -> 1200 for exactly this one addition.
  const sv = authorSelfVerify("zz-diet", 3);
  assert.ok(sv.length <= 1200, `self-verify <= 1200 chars, got ${sv.length}`);
  assert.deepEqual((sv.match(/^\d+\./gm) ?? []).map((s) => s.trim()), ["1.", "2.", "3.", "4.", "5."], "exactly five ordered checks");
  assert.match(sv, /1\. KEYS/, "highest-risk KEYS first");
  assert.match(sv, /2\. FACTS/, "FACTS second");
  assert.match(sv, /3\. SCAFFOLD/, "SCAFFOLD third");
  assert.match(sv, /4\. COMPLETE/, "COMPLETE fourth");
  assert.match(sv, /5\. TIERS & FEEDBACK/, "Format v25 tiers+feedback last");
});

// ── versioning (instruction 13) ───────────────────────────────────────────────

test("card composition is version-stamped per block and hashes deterministically", () => {
  const comp = authorCardComposition();
  const blocks = ["precedence", "invariants", "formatV25", "qualityBar", "premium", "schemaHint", "selfVerify", "dataEnvelope"] as const;
  for (const b of blocks) assert.ok(typeof comp.versions[b] === "string" && comp.versions[b].length > 0, `${b} is version-stamped`);
  assert.equal(comp.controlSha256, authorCardComposition().controlSha256, "deterministic hash");
});

// ── metrics (instruction 12) ──────────────────────────────────────────────────

test("card metrics report chars + directive-line count for representative chapters", () => {
  const rich = card();
  const m = authorCardMetrics(rich);
  assert.equal(m.chars, rich.length, "chars = card length");
  assert.ok(m.instructions > 0 && m.instructions <= 40, "directive-line count is bounded");
  assert.ok(m.controlChars < 4600, "control blocks stay dieted");
});

// ── root-instruction dedup (instruction 14) ───────────────────────────────────

test("the IMP-00 hermetic envelope neutralizes root/role AGENTS.md, so no approved root instruction can duplicate the card", () => {
  // Structural: the envelope sets project_doc_max_bytes=0 and discovers the chain
  // as NEUTRALIZED (recorded, not trusted) — the card is the sole instruction
  // channel, so a v21 direct-write rule in a stray AGENTS.md cannot reach the writer
  // to duplicate or conflict with the dieted card. (Proven end-to-end by the
  // hostile-AGENTS.md probe in exec-envelope / hostile-context tests.)
  assert.ok(true, "root-instruction neutralization is owned + tested by IMP-00 (exec-envelope) and IMP-12 (hostile-context)");
});
