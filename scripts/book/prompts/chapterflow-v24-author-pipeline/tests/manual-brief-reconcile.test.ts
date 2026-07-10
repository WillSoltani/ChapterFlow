/**
 * P1 / Finding F-01 — non-clobbering manual-brief derivation.
 *
 * `derive-artifacts` is auto-run by book-gate and the QC entry; today it overwrites
 * state/briefs/<book>.manual-brief.json from the TOC every time, silently reverting
 * any reviewed hand-edit of the voiceCharter. `reconcileDerivedBrief` preserves a
 * diverged charter unless --force-voice, while re-deriving every other field. These
 * tests exercise the exact scenarios end-to-end via the pure reconciler — no real
 * state/ is touched (the choke-point wiring in cli.ts is a thin call around this).
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { reconcileDerivedBrief } from "../src/lib/manualBriefReconcile.js";

// The freshly-derived brief (from the TOC) the reconciler is handed each run. Its
// voiceCharter re-mandates the mold, exactly like the real start-with-why TOC.
function derived() {
  return {
    bookId: "zz-fixture-reconcile",
    title: "Fixture Book",
    author: "Fixture Author",
    thesisParagraph: "A thesis.",
    coreIdeas: [],
    targetReader: "",
    voiceCharter: {
      register: "plainspoken",
      person: "third",
      cadence: "medium",
      signatureMoves: [
        "opens with recognizable business, aviation, civil-rights, or consumer-technology cases",
        "turns a case into a simple three-part distinction such as WHY, HOW, and WHAT",
      ],
      avoidMoves: ["does not build dense academic literature reviews"],
    },
    teachingArc: "An arc.",
    forbiddenMoves: [],
    derivedFromInlineMode: true,
    derivedAt: "2026-07-07T00:00:00.000Z",
  };
}

// A reviewed hand-edit: the de-mandated charter (shape of the dae308a01 edit).
const REVIEWED_CHARTER = {
  register: "plainspoken",
  person: "third",
  cadence: "medium",
  signatureMoves: [
    "grounds ideas in real source-supported cases OR in the reader's own moment",
    "uses direct second-person tests that ask whether a decision feels aligned",
  ],
  avoidMoves: [
    "does not run the same body machinery in every chapter",
    "does not build dense academic literature reviews",
  ],
};

test("reconcile: no existing brief → derive exactly as today", () => {
  const r = reconcileDerivedBrief({ existing: null, derived: derived(), forceVoice: false });
  assert.equal(r.preservedVoice, false);
  assert.equal(r.forcedVoice, false);
  assert.deepEqual(r.brief, derived(), "brief is the derived object untouched");
});

test("reconcile: identical existing charter → derive as-is (idempotent, no preserve)", () => {
  const existing = { ...derived(), title: "stale title", derivedAt: "2020-01-01T00:00:00.000Z" };
  const r = reconcileDerivedBrief({ existing, derived: derived(), forceVoice: false });
  assert.equal(r.preservedVoice, false, "identical charter → nothing preserved");
  assert.deepEqual(r.brief.voiceCharter, derived().voiceCharter);
  assert.equal(r.brief.title, "Fixture Book", "other fields still come from the fresh derivation");
});

test("reconcile: diverged (reviewed) charter → PRESERVED; other fields re-derived", () => {
  const existing = { ...derived(), voiceCharter: REVIEWED_CHARTER, title: "an old title" };
  const r = reconcileDerivedBrief({ existing, derived: derived(), forceVoice: false });
  assert.equal(r.preservedVoice, true, "diverged charter is preserved");
  assert.equal(r.forcedVoice, false);
  assert.deepEqual(r.brief.voiceCharter, REVIEWED_CHARTER, "the reviewed charter survives verbatim");
  // Other fields re-derive from the fresh TOC-derived object, NOT the stale existing one.
  assert.equal(r.brief.title, "Fixture Book", "title re-derived");
  assert.equal(r.brief.derivedAt, "2026-07-07T00:00:00.000Z", "derivedAt re-derived");
  // The mold-mandating derived moves did NOT leak in.
  assert.ok(
    !JSON.stringify(r.brief.voiceCharter).includes("three-part distinction"),
    "no derived device mandate leaks into the preserved charter",
  );
});

test("reconcile: --force-voice overwrites a diverged charter", () => {
  const existing = { ...derived(), voiceCharter: REVIEWED_CHARTER };
  const r = reconcileDerivedBrief({ existing, derived: derived(), forceVoice: true });
  assert.equal(r.preservedVoice, false, "force → nothing preserved");
  assert.equal(r.forcedVoice, true, "force over a diverged charter reports forcedVoice");
  assert.deepEqual(r.brief.voiceCharter, derived().voiceCharter, "charter re-derived from the TOC");
});

test("reconcile: --force-voice with identical charter is not reported as a forced overwrite", () => {
  const existing = { ...derived() };
  const r = reconcileDerivedBrief({ existing, derived: derived(), forceVoice: true });
  assert.equal(r.forcedVoice, false, "no divergence → nothing was actually overwritten");
  assert.deepEqual(r.brief.voiceCharter, derived().voiceCharter);
});

test("reconcile: existing brief without a voiceCharter → derive as-is", () => {
  const existing = { bookId: "zz-fixture-reconcile", title: "partial" }; // no voiceCharter
  const r = reconcileDerivedBrief({ existing, derived: derived(), forceVoice: false });
  assert.equal(r.preservedVoice, false);
  assert.deepEqual(r.brief.voiceCharter, derived().voiceCharter);
});

test("reconcile: charter differing only by key order is treated as identical (not preserved)", () => {
  const reordered = {
    avoidMoves: derived().voiceCharter.avoidMoves,
    signatureMoves: derived().voiceCharter.signatureMoves,
    cadence: "medium",
    person: "third",
    register: "plainspoken",
  };
  const existing = { ...derived(), voiceCharter: reordered };
  const r = reconcileDerivedBrief({ existing, derived: derived(), forceVoice: false });
  assert.equal(r.preservedVoice, false, "key-order-only difference is not a real divergence");
});
