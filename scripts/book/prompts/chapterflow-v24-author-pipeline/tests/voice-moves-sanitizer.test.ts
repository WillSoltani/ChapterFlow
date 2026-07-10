/**
 * P1 / Finding F-01 — the voice-move sanitizer.
 *
 * A brief's signatureMoves must teach HOW a book sounds, never WHAT machinery to
 * build. `sanitizeVoiceMoves` strips content-DEVICE mandates (opens-on-a-famous-
 * case, WHY/HOW/WHAT triads, recurring-named-anchor, invented-proxy, return-proof,
 * second-setting) by SHAPE — never by a book's vocabulary — while keeping genuine
 * register/style guidance. These tests pin: every start-with-why device mandate is
 * stripped; the second-person + contrast style moves survive; a broad bank of real
 * style/register moves is never over-stripped; and each device family fires on a
 * representative mandate (incl. the "style-phrased" adversarial opener).
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { sanitizeVoiceMoves, classifyVoiceMove } from "../src/lib/voiceBible.js";

// ── The five start-with-why signature moves, verbatim from the frozen TOC /
//    the reverted manual brief (state/briefs/start-with-why.manual-brief.json). ──
const SWW_OPENS_CASE = "opens with recognizable business, aviation, civil-rights, or consumer-technology cases";
const SWW_THREE_PART = "turns a case into a simple three-part distinction such as WHY, HOW, and WHAT";
const SWW_SECOND_PERSON = "uses direct second-person tests that ask whether a decision feels aligned";
const SWW_CONTRAST = "contrasts an inspired organization with a technically capable but less trusted rival";
const SWW_RECURRING_ANCHOR = "returns to Apple, the Wright brothers, and Martin Luther King Jr. as recurring reference points";

const SWW_SIGNATURE_MOVES = [
  SWW_OPENS_CASE,
  SWW_THREE_PART,
  SWW_SECOND_PERSON,
  SWW_CONTRAST,
  SWW_RECURRING_ANCHOR,
];

// The three start-with-why avoidMoves — an avoid-rule is NEVER a device mandate.
const SWW_AVOID_MOVES = [
  "does not build dense academic literature reviews",
  "does not rely on statistical tables or formal proofs",
  "does not present leadership as charisma alone",
];

test("sanitizeVoiceMoves strips the three start-with-why device mandates (F-01)", () => {
  const { kept, stripped } = sanitizeVoiceMoves(SWW_SIGNATURE_MOVES);
  // The three mold-mandating moves F-01 names — gone.
  assert.ok(stripped.includes(SWW_OPENS_CASE), "opens-on-a-recognizable-case mandate is stripped");
  assert.ok(stripped.includes(SWW_THREE_PART), "WHY/HOW/WHAT three-part reflex is stripped");
  assert.ok(stripped.includes(SWW_RECURRING_ANCHOR), "recurring-named-anchor mandate is stripped");
  assert.equal(stripped.length, 3, "exactly the three device mandates are stripped");
});

test("sanitizeVoiceMoves keeps the second-person test + contrast style moves", () => {
  const { kept } = sanitizeVoiceMoves(SWW_SIGNATURE_MOVES);
  assert.ok(kept.includes(SWW_SECOND_PERSON), "second-person test survives (style, not device)");
  assert.ok(kept.includes(SWW_CONTRAST), "contrast-of-tone move survives (kept by the dae308a01 hand-edit too)");
  assert.equal(kept.length, 2, "exactly the two style moves survive");
});

test("sanitizeVoiceMoves never strips an avoid-rule (defense-in-depth)", () => {
  // avoidMoves are never fed through the sanitizer in production, but if they were,
  // none of them may be mistaken for a device mandate.
  const { kept, stripped } = sanitizeVoiceMoves(SWW_AVOID_MOVES);
  assert.equal(stripped.length, 0, "no avoid-rule is classified as a device mandate");
  assert.deepEqual(kept, SWW_AVOID_MOVES, "all avoid-rules pass through verbatim");
});

// ── Each device family fires on a representative mandate (shapes not present in
//    the start-with-why five). ──────────────────────────────────────────────────
test("sanitizeVoiceMoves catches every device-family mandate shape", () => {
  const mandates: Array<[string, string]> = [
    ["named-anchor-lead", "opens with recognizable business, aviation, civil-rights, or consumer-technology cases"],
    ["three-part-split", "turns a case into a simple three-part distinction such as WHY, HOW, and WHAT"],
    ["three-part-split", "splits every idea into three parts before explaining it"],
    ["recurring-anchor", "returns to Apple, the Wright brothers, and Martin Luther King Jr. as recurring reference points"],
    ["recurring-anchor", "keeps coming back to the same two founders as touchstones throughout"],
    ["proxy-cast", "follows an invented character through each chapter to carry the lesson"],
    ["proxy-cast", "uses a recurring composite persona as the protagonist"],
    ["return-proof", "closes each chapter on a proof that comes back as a receipt"],
    ["return-proof", "ends on a return-point reversal that pays off the opening"],
    ["second-setting", "always adds a second case that proves it travels to another setting"],
  ];
  for (const [family, move] of mandates) {
    const got = classifyVoiceMove(move);
    assert.ok(got, `should classify as a device mandate: "${move}"`);
    assert.equal(got, family, `"${move}" should be family ${family}, got ${got}`);
  }
});

test("RED-TEAM adversarial: a mandate phrased as STYLE is still caught", () => {
  // "sounds best when every chapter opens on a famous company" — dressed as a taste
  // note, but it still mandates the famous-anchor opening. Documented in the report.
  assert.ok(
    classifyVoiceMove("sounds best when every chapter opens on a famous company"),
    "style-phrased famous-anchor opener is caught",
  );
});

// ── RED-TEAM negatives: a broad bank of legitimate register/style moves must NEVER
//    be stripped (over-stripping recreates the one-house-voice problem). ──────────
const STYLE_MOVES_KEEP = [
  // The voiceCard register-template `do:` lines (config/author-voice-profiles paths).
  "state a claim plainly, then ground it in a concrete case or number",
  "hand the reader a move they can run today, in plain steps",
  "let an idea unfold, then anchor it in a concrete moment",
  "report what the evidence shows, then translate it into a plain takeaway",
  "show a concrete moment, then draw the point out of it",
  "speak from lived experience, then open it toward the reader",
  "make every abstract claim concrete within two sentences",
  // Generic opening guidance — the anti-template ALTERNATIVES we must preserve.
  "open with a concrete scene before naming the principle",
  "opens with the reader's own situation",
  "opens with a sharp, plain question",
  "open each chapter on an ordinary, everyday moment",
  // Rhythm / diction / person / warmth.
  "turn findings into compact handles",
  "varies sentence length — a short line set against a long one",
  "asks one or two rhetorical questions per chapter",
  "uses plain verbs and short, common words",
  "writes in a warm, direct second-person register",
  "keeps a measured, lightly wry tone",
  "defines any term of art in everyday words on first use",
  "contrasts an inspired organization with a technically capable but less trusted rival",
  "uses direct second-person tests that ask whether a decision feels aligned",
  "grounds each idea in a concrete case the reader can picture",
  "lands a takeaway the reader can repeat in one sentence",
];

test("RED-TEAM: no legitimate style/register move is over-stripped (22 fixtures)", () => {
  const { kept, stripped } = sanitizeVoiceMoves(STYLE_MOVES_KEEP);
  assert.deepEqual(
    stripped,
    [],
    `no style move may be stripped; over-stripped: ${JSON.stringify(stripped)}`,
  );
  assert.equal(kept.length, STYLE_MOVES_KEEP.length, "every style move is kept");
});

test("sanitizeVoiceMoves ignores blanks/non-strings and is order-preserving", () => {
  const { kept, stripped } = sanitizeVoiceMoves([
    "  ",
    SWW_OPENS_CASE,
    SWW_SECOND_PERSON,
    "",
    SWW_RECURRING_ANCHOR,
    SWW_CONTRAST,
  ]);
  assert.deepEqual(kept, [SWW_SECOND_PERSON, SWW_CONTRAST], "kept preserves input order, blanks dropped");
  assert.deepEqual(stripped, [SWW_OPENS_CASE, SWW_RECURRING_ANCHOR], "stripped preserves input order");
});
