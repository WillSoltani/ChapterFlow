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
import { voiceCard, VOICE_CARD_GUARD_LINE } from "../src/lib/voiceCard.js";
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
  return buildSectionTaskMarkdown({ bookId, kind, blueprint: blueprint(bookId), sourcePacket: PACKET, outputPath: `/tmp/${kind}.json` });
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
    // The static contract line is still present regardless of voice data.
    assert.match(md, /Write in the VOICE CARD register;/, `${kind}: contract line is always present`);
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
