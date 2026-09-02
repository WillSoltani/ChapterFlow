/**
 * P05 — the voice card: the register input the blind section writers otherwise
 * lack. A card teaches HOW to sound (register, rhythm, POV, diction, warmth) and
 * must never carry a sample sentence, a named case, or any paste-able phrase.
 * These tests pin: brief → card + guard line, specimen stripped; no voice signal
 * → section omitted; word budget; determinism; and that the task builder every
 * kind delegates to still emits a structurally valid task card.
 */

import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import { REGISTER_TEMPLATES, voiceCard, VOICE_CARD_GUARD_LINE } from "../src/lib/voiceCard.js";
import { loadBookScars } from "../src/lib/bookScars.js";
import { formatVoiceBible } from "../src/lib/voiceBible.js";
import { buildSectionTaskMarkdown } from "../src/sections/sectionTasks.js";
import { SECTION_KINDS, type ChapterBlueprintV1, type SectionKind, type SourcePacketV1 } from "../src/artifacts/artifactTypes.js";

// A brief-bearing book (fixture written to state/briefs, same pattern as
// qc-stats.test.ts), a book with a real author-voice profile but no brief (synth
// path), and a book with neither (null).
const BRIEF_BOOK = "zz-fixture-voicecard";
const PROFILE_BOOK = "deep-work"; // present in config/author-voice-profiles.json
const NOVOICE_BOOK = "zz-fixture-novoice-nowhere";

// A distinctive specimen sentence with content nouns; the card must NEVER carry it.
const SPECIMEN = "The kettle clicked off and Dana finally admitted the report was late.";

function briefPath(bookId: string): string {
  return resolve(PIPELINE_DIR, "state", "briefs", `${bookId}.brief.json`);
}

function writeBrief(bookId: string): void {
  mkdirSync(resolve(PIPELINE_DIR, "state", "briefs"), { recursive: true });
  writeFileSync(
    briefPath(bookId),
    JSON.stringify({
      bookId,
      voiceCharter: {
        register: "warm",
        person: "third",
        cadence: "medium",
        signatureMoves: ["open with a concrete scene before naming the principle", "turn findings into compact handles"],
        avoidMoves: ["no dense academic exposition", "no mystical language about meaning"],
      },
      voiceSpecimens: [SPECIMEN],
      forbiddenMoves: ["no war metaphors"],
    }),
    "utf8",
  );
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function blueprint(bookId: string): ChapterBlueprintV1 {
  return {
    chapterId: `${bookId}-ch01`,
    chapterNumber: 1,
    coreMove: "change the visible signal",
    reservedVariety: { hookShape: "direct_claim", answerIndexPattern: [0, 1, 2] },
    constraints: { forbiddenLeakage: [] },
    sections: { hook: {}, summaries: {}, examples: [], quiz: [], cards: [], action: {} },
  } as unknown as ChapterBlueprintV1;
}

const PACKET = { schemaVersion: "source-packet-v1", facts: [] } as unknown as SourcePacketV1;

function task(bookId: string, kind: SectionKind): string {
  return buildSectionTaskMarkdown({ bookId, kind, blueprint: blueprint(bookId), sourcePacket: PACKET, outputPath: `/tmp/${kind}.json`, context: { voiceCard: voiceCard(bookId), bookScars: loadBookScars(bookId) } });
}

test("voiceCard from a brief carries register + guard line and strips the specimen", () => {
  try {
    writeBrief(BRIEF_BOOK);
    const card = voiceCard(BRIEF_BOOK);
    assert.ok(card, "a brief-bearing book yields a card");
    assert.match(card!, /^voice: warm, third-person, medium cadence/, "leads with the register descriptor");
    assert.ok(card!.endsWith(VOICE_CARD_GUARD_LINE), "ends with the contamination guard line");
    // Contamination guard: no prose exemplar / paste-able sample sentence.
    assert.doesNotMatch(card!, /kettle|Dana/, "the specimen sentence must never appear in the card");
    assert.doesNotMatch(card!, /sounds like:/, "the specimen line must be dropped");
  } finally {
    rmSync(briefPath(BRIEF_BOOK), { force: true });
  }
});

test("voiceCard never exceeds the ~120-word budget (brief and synth paths)", () => {
  try {
    writeBrief(BRIEF_BOOK);
    assert.ok(wordCount(voiceCard(BRIEF_BOOK)!) <= 120, "brief card is within budget");
    const synth = voiceCard(PROFILE_BOOK);
    assert.ok(synth, "a profile-bearing book yields a synthesized card");
    assert.ok(wordCount(synth!) <= 120, "synth card is within budget");
    assert.match(synth!, /^voice: /, "synth card leads with a register descriptor");
    assert.ok(synth!.endsWith(VOICE_CARD_GUARD_LINE), "synth card carries the guard line");
  } finally {
    rmSync(briefPath(BRIEF_BOOK), { force: true });
  }
});

test("voiceCard is deterministic — same inputs, same card", () => {
  try {
    writeBrief(BRIEF_BOOK);
    assert.equal(voiceCard(BRIEF_BOOK), voiceCard(BRIEF_BOOK));
    assert.equal(voiceCard(PROFILE_BOOK), voiceCard(PROFILE_BOOK));
    assert.equal(task(BRIEF_BOOK, "summary-pack"), task(BRIEF_BOOK, "summary-pack"));
  } finally {
    rmSync(briefPath(BRIEF_BOOK), { force: true });
  }
});

test("a book with no brief and no profile yields null → no VOICE CARD section", () => {
  assert.equal(voiceCard(NOVOICE_BOOK), null);
  for (const kind of SECTION_KINDS) {
    const md = task(NOVOICE_BOOK, kind);
    assert.doesNotMatch(md, /VOICE CARD —/, `${kind}: card section must be omitted when there is no voice signal`);
    // P07: the contract's voice line is conditional/coherent even for voiceless books
    // ("when a VOICE CARD is shown below … with no card, use a plain register") — not the
    // pre-P07 dangling "Write in the VOICE CARD register;" prefix.
    assert.doesNotMatch(md, /Write in the VOICE CARD register;/, `${kind}: the pre-P07 dangling register prefix must be gone`);
    assert.match(md, /when a VOICE CARD(?: register note)? is shown below/, `${kind}: contract carries a coherent conditional voice line`);
    assert.match(md, /with no card, use a plain, concrete register/, `${kind}: voiceless books get the plain-register fallback`);
  }
});

test("section task markdown wires the card in the right shape per kind", () => {
  try {
    writeBrief(BRIEF_BOOK);
    const summary = task(BRIEF_BOOK, "summary-pack");
    assert.match(summary, /VOICE CARD — how THIS book sounds/, "summary writers get the full card");
    assert.match(summary, /voice: warm, third-person, medium cadence/);
    assert.ok(summary.includes(VOICE_CARD_GUARD_LINE), "card guard line rides into the task");
    assert.match(task(BRIEF_BOOK, "example-pack"), /VOICE CARD — how THIS book sounds/, "example writers get the full card");

    const learning = task(BRIEF_BOOK, "learning-pack");
    assert.match(learning, /VOICE CARD — register note/, "learning writers get the 2-line register note");
    assert.match(learning, /voice: warm, third-person, medium cadence/, "the register descriptor is surfaced");
    assert.doesNotMatch(learning, /how THIS book sounds/, "learning writers do NOT get the full card");
    assert.match(task(BRIEF_BOOK, "action-pack"), /VOICE CARD — register note/, "action writers get the register note");
  } finally {
    rmSync(briefPath(BRIEF_BOOK), { force: true });
  }
});

// ── R-004 — the curated Franklin profile (the released book the Phase A report
//    scored). Its scar file is the largest shipped one, so this is also the book
//    tests/contract-refactor.test.ts measures the honest length budget on. ────────

const FRANKLIN = "the-autobiography-of-benjamin-franklin";

test("the curated Franklin profile resolves a third-person card that the section task renders", () => {
  const card = voiceCard(FRANKLIN);
  assert.ok(card, "the released Franklin book must resolve a voice card, not null");
  assert.ok(wordCount(card!) <= 120, "the curated card stays inside the word budget");
  assert.ok(card!.endsWith(VOICE_CARD_GUARD_LINE), "the curated card carries the contamination guard");

  // The artifact is a retelling of someone else's book, and SEC7
  // (src/sections/sectionGate.ts) blocks "the author"/"the book"/"this chapter" in
  // every tier, so a card must never ask a writer for the source author's first person.
  assert.match(card!, /third-person retelling/, "the card names the person it can actually be written in");
  assert.doesNotMatch(card!, /first-person/, "no card may instruct first person");

  // The scar file's own style note: "vary sentence length; a run of sub-seven-word
  // declaratives is a spice, not a default register".
  assert.match(card!, /never a run of same-length declaratives/, "the card asks for varied cadence");

  const summary = task(FRANKLIN, "summary-pack");
  assert.match(summary, /VOICE CARD — how THIS book sounds/, "summary writers get the full card");
  assert.match(summary, /dry self-aware irony/, "the register reaches the writer prompt");
  const learning = task(FRANKLIN, "learning-pack");
  assert.match(learning, /VOICE CARD — register note/, "learning writers get the register note");
  assert.match(learning, /voice: plain, concrete register with dry self-aware irony/, "the register descriptor is surfaced");
});

// ── R-007 — a register template may only instruct things the artifact can be
//    written in. The artifact is a third-person retelling of someone else's book:
//    src/sections/sectionGate.ts:2253 (SEC7.meta_reference) blocks "the author",
//    "the book" and "this chapter" in every breakdown tier, and
//    src/sections/sectionTasks.ts repeats the ban in every task card's DO NOT block.
//    A template that tells the writer to use the source author's first person asks
//    for prose the writer then has to walk back. ──────────────────────────────────

test("R-007: no register template instructs a person or a move the artifact cannot use", () => {
  const registers = Object.keys(REGISTER_TEMPLATES);
  assert.ok(registers.length >= 7, `expected the shipped register templates, found ${registers.length}`);
  for (const [register, lines] of Object.entries(REGISTER_TEMPLATES)) {
    const text = lines.join("\n");
    assert.doesNotMatch(text, /first[- ]person/i, `${register}: a template must not instruct the source author's first person`);
    assert.doesNotMatch(text, /speak from lived experience/i, `${register}: "speak from lived experience" is the same first-person instruction in prose`);
    // Every template still leads with the register descriptor the learning/action
    // register note lifts (voiceRegisterLine).
    assert.match(lines[0]!, /^voice: /, `${register}: first line must be the register descriptor`);
  }
});

// ── P1 / Finding F-01: device-mandate signature moves never reach the card ──────

/** Write a brief with arbitrary signatureMoves (and optional avoidMoves) so we can
 *  exercise the sanitizer through the real formatVoiceBible → voiceCard path. */
function writeBriefWithMoves(bookId: string, signatureMoves: string[], avoidMoves: string[] = []): void {
  mkdirSync(resolve(PIPELINE_DIR, "state", "briefs"), { recursive: true });
  writeFileSync(
    briefPath(bookId),
    JSON.stringify({
      bookId,
      voiceCharter: { register: "plainspoken", person: "third", cadence: "medium", signatureMoves, avoidMoves },
    }),
    "utf8",
  );
}

test("P1/F-01: the start-with-why card carries no device-mandate text from the reverted brief", () => {
  // Reads the REAL state/briefs/start-with-why.manual-brief.json (the reverted
  // re-derivation whose signatureMoves re-mandate the mold). The sanitizer must
  // strip those before they reach the card.
  const card = voiceCard("start-with-why");
  if (!card) return; // brief absent on this checkout — nothing to assert
  assert.doesNotMatch(card, /opens with recognizable/i, "no opens-on-a-famous-case mandate reaches the card");
  assert.doesNotMatch(card, /three-part distinction/i, "no WHY/HOW/WHAT three-part mandate reaches the card");
  assert.doesNotMatch(card, /returns to Apple/i, "no recurring-named-anchor mandate reaches the card");
  // Sanitized, not nulled: the genuine second-person style move still flows through.
  assert.match(card, /second-person tests/i, "the real style move survives sanitization");
});

test("P1/F-01: formatVoiceBible emits a do: line when a style move survives, none when all are stripped", () => {
  const ALL_DEVICE = "zz-fixture-voice-alldevice";
  const MIXED = "zz-fixture-voice-mixed";
  try {
    // Every signature move is a device mandate → no do: line at all (never empty).
    writeBriefWithMoves(ALL_DEVICE, [
      "opens with recognizable business, aviation, civil-rights, or consumer-technology cases",
      "turns a case into a simple three-part distinction such as WHY, HOW, and WHAT",
      "returns to Apple, the Wright brothers, and Martin Luther King Jr. as recurring reference points",
    ]);
    const allDevice = formatVoiceBible(ALL_DEVICE);
    assert.ok(allDevice, "a charter with a register still yields a bible");
    assert.doesNotMatch(allDevice!, /\bdo:/, "no do: line when every signature move is a device mandate");
    assert.doesNotMatch(allDevice!, /^\s*do:\s*$/m, "never an empty do: line");
    assert.match(allDevice!, /^voice: plainspoken/, "the register line still leads");
    // Red-team: a book whose every move is stripped still gets a NON-NULL card
    // (the register line survives) — never a null card for a book that had a charter.
    assert.ok(voiceCard(ALL_DEVICE), "a charter book with all moves stripped still yields a card");

    // One device mandate + one style move → do: line carries ONLY the style move.
    writeBriefWithMoves(MIXED, [
      "opens with recognizable business, aviation, civil-rights, or consumer-technology cases",
      "uses plain verbs and short, common words",
    ]);
    const mixed = formatVoiceBible(MIXED);
    assert.ok(mixed, "mixed charter yields a bible");
    assert.match(mixed!, /do: uses plain verbs and short, common words/, "the style move survives on the do: line");
    assert.doesNotMatch(mixed!, /opens with recognizable/, "the device mandate is stripped from the do: line");
  } finally {
    rmSync(briefPath(ALL_DEVICE), { force: true });
    rmSync(briefPath(MIXED), { force: true });
  }
});

// ── R-006 — the word budget must not silently discard the plainness floor ───────
//
// src/lib/voiceBible.ts appends the catalog-wide plainness floor LAST, under a
// comment saying "every fanout prompt carries it". The card's word budget used to
// `break` on the first over-budget line, so a charter with a long do: or never:
// line dropped that line AND everything after it — the floor included.

/** ~60 words of pure style guidance: long enough to overflow the budget, and shaped
 *  so sanitizeVoiceMoves keeps it (no device-mandate shape). */
const LONG_STYLE_MOVE =
  "uses plain verbs and short common words, keeps the diction concrete, prefers the everyday word over the technical one, lets the tone stay measured and lightly wry, defines any term of art on first use, and makes each abstract claim visible within two sentences so the reader always has something they can picture";

test("R-006: an over-long line is skipped, not a truncation point — the plainness floor always survives", () => {
  const BOOK = "zz-fixture-voicecard-budget";
  try {
    writeBriefWithMoves(BOOK, [LONG_STYLE_MOVE], ["no jargon"]);
    const card = voiceCard(BOOK);
    assert.ok(card, "the charter still yields a card");
    assert.match(card!, /plain language beats abstraction/, "the plainness floor must survive the budget");
    assert.match(card!, /^never: no jargon$/m, "a short line AFTER the over-long one is still reached (continue, not break)");
    assert.doesNotMatch(card!, /prefers the everyday word over the technical one/, "the over-long line itself is the one dropped");
    assert.ok(wordCount(card!) <= 120, "the budget still holds");
  } finally {
    rmSync(briefPath(BOOK), { force: true });
  }
});

test("card insertion leaves every kind's task card structurally intact", () => {
  // No dealSectionTasks fixtures ship in the harness, so we assert the builder
  // dealSectionTasks delegates to still emits every required task section with a
  // card present — the VOICE CARD block must not clobber TASK/DO NOT/SCHEMA/etc.
  try {
    writeBrief(BRIEF_BOOK);
    for (const kind of SECTION_KINDS) {
      const md = task(BRIEF_BOOK, kind);
      for (const marker of ["ROLE", "INPUTS", "TASK", "VOICE CARD", "DO NOT", "OUTPUT SCHEMA HINT", "SOURCE PACKET", "VALIDATION"]) {
        assert.ok(md.includes(marker), `${kind} task missing ${marker}`);
      }
      // Order sanity: the card lands between TASK and DO NOT.
      assert.ok(md.indexOf("VOICE CARD") > md.indexOf("TASK") && md.indexOf("VOICE CARD") < md.indexOf("DO NOT"), `${kind}: card must sit between TASK and DO NOT`);
    }
  } finally {
    rmSync(briefPath(BRIEF_BOOK), { force: true });
  }
});
