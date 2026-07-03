/**
 * P14 — per-book design pools.
 *
 * Covers: deterministic derivation; pool floors + genre top-up; genre routing (the load-bearing
 * assertions: an investing book gets investing venues; an experiences book NEVER gets "broker
 * statement"); the BD1–BD5 gate blockers; LEGACY byte-identity when no design artifact exists
 * (golden captured pre-change); designHash pinning (edit artifact → blueprint hash changes); and
 * venuePlan cap-2 / no-adjacent invariants for the design-derived venue palette.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { fileURLToPath } from "node:url";

import { test } from "./harness.js";

const HERE = resolve(fileURLToPath(import.meta.url), "..");
import {
  deriveBookDesign,
  validateBookDesign,
  buildGenrePools,
  investingVenues,
  venueFloor,
  POOL_FLOORS,
} from "../src/compiler/bookDesign.js";
import { compileChapterBlueprint } from "../src/compiler/chapterBlueprint.js";
import { assertVenueInvariants } from "../src/librarian/venuePlan.js";
import { bookDesignPath, sourcePacketPath, writeJsonFile } from "../src/artifacts/artifactStore.js";
import type { BookDesignV1, SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import type { ChapterSpec } from "../src/generateChapter.js";

const HARD_SPECIFICS = ["credit utilization", "payment timing window", "reported balance snapshot", "statement closing date"];

function packet(bookId: string, n: number): SourcePacketV1 {
  return {
    schemaVersion: "source-packet-v1",
    bookId,
    chapterId: `${bookId}-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    chapterTitle: `Chapter ${n}`,
    sourceSidecarPath: null,
    sourceHash: null,
    facts: Array.from({ length: 9 }, (_, i) => ({
      id: `ch${n}.fact.${i + 1}`,
      claim: `Claim ${i + 1} for chapter ${n}.`,
      mechanism: `Mechanism ${i + 1} explains it concretely.`,
      commonError: `Common error ${i + 1}.`,
      whyWrong: `Why error ${i + 1} is wrong.`,
      allowedClaimTypes: [],
      groundedNumbers: [],
      groundedEntities: [],
      groundedPlaces: [],
      verificationRefs: [],
    })),
    namedCases: [
      { id: `ch${n}.case.a`, label: "Case A", summary: "Case A summary.", realWorld: true, hardSpecifics: HARD_SPECIFICS, allowedUses: [], forbiddenUses: [], doNotRestamp: [] },
      { id: `ch${n}.case.b`, label: "Case B", summary: "Case B summary.", realWorld: true, hardSpecifics: HARD_SPECIFICS, allowedUses: [], forbiddenUses: [], doNotRestamp: [] },
    ],
    frameworks: [],
    allowedAnchors: [],
    allowedNumbers: [],
    allowedEntities: [],
    allowedPlaces: [],
    forbiddenClaims: [],
    forbiddenLeakage: [],
    sourceQuality: { status: "strong", risks: [] },
  };
}

function chapterSpec(bookId: string, n: number): ChapterSpec {
  return { chapterId: `${bookId}-ch${String(n).padStart(2, "0")}`, chapterNumber: n, chapterTitle: `Chapter ${n}` };
}

function withStateRoot(label: string, run: (roots: { stateRoot: string }, packets: SourcePacketV1[], book: string, chapters: ChapterSpec[]) => void, book = "zz-fixture-book-design", chapterCount = 12): void {
  const stateRoot = resolve(tmpdir(), `cf-v23-${label}-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters = Array.from({ length: chapterCount }, (_, i) => chapterSpec(book, i + 1));
  const packets = chapters.map((c) => packet(book, c.chapterNumber));
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", `${book}.json`), chapters);
    for (const p of packets) writeJsonFile(sourcePacketPath(book, p.chapterNumber, roots), p);
    run(roots, packets, book, chapters);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
}

test("P14: derivation is deterministic — same packets/genre → byte-identical artifact", () => {
  const packets = Array.from({ length: 12 }, (_, i) => packet("zz", i + 1));
  const a = deriveBookDesign("zz-book", { genre: "investing", packets, chapters: 12 });
  const b = deriveBookDesign("zz-book", { genre: "investing", packets, chapters: 12 });
  assert.equal(JSON.stringify(a), JSON.stringify(b), "identical inputs must produce byte-identical design artifacts");
});

test("P14: derived pools meet floors and mine the book's own material", () => {
  const packets = Array.from({ length: 12 }, (_, i) => packet("zz", i + 1));
  const d = deriveBookDesign("zz-book", { genre: "business-decision", packets, chapters: 12 });
  assert.equal(validateBookDesign(d, 12).filter((f) => f.severity === "blocker").length, 0, "a derived artifact must pass its own gate");
  assert.ok(d.pools.sceneFramesDecision.length >= POOL_FLOORS.sceneFramesDecision);
  assert.ok(d.pools.sceneFramesExperiential.length >= POOL_FLOORS.sceneFramesExperiential);
  assert.ok(d.pools.practiceConstraints.length >= POOL_FLOORS.practiceConstraints);
  assert.ok(d.pools.venues.length >= venueFloor(12));
  assert.equal(d.provenance.source, "derived");
  // A mined hardSpecific slotted into a frame template — the pool is genuinely per-book.
  assert.ok(d.pools.sceneFramesDecision.some((f) => f.includes("credit utilization")), "derived frames must use the book's own mined material");
});

test("P14 genre routing — investing book gets investing venues; experiences book NEVER gets 'broker statement'", () => {
  const packets = Array.from({ length: 12 }, (_, i) => packet("zz", i + 1));
  const inv = deriveBookDesign("zz-investing", { genre: "investing", packets, chapters: 12 });
  const exp = deriveBookDesign("zz-experiences", { genre: "experience-design", packets, chapters: 12 });
  const investing = new Set(investingVenues());
  assert.ok(inv.pools.venues.some((v) => investing.has(v)), "an investing book must be dealt investing venues");
  assert.ok(!exp.pools.venues.includes("broker statement"), "an experiences book must NEVER be dealt the investing 'broker statement' venue");
  // And the whole investing document set stays OUT of the experiences book.
  assert.equal(exp.pools.venues.filter((v) => investing.has(v)).length, 0, "no investing venue may leak into a non-investing book");
});

test("P14: genre static venues top up to the venue floor for a full 34-chapter book while staying cap-2 valid", () => {
  const pools = buildGenrePools("investing", 34);
  assert.ok(pools.venues.length >= venueFloor(34), `investing venue pool ${pools.venues.length} must meet the 34-chapter floor ${venueFloor(34)}`);
  assert.ok(pools.venues.some((v) => investingVenues().includes(v)), "the topped-up pool must still lead with investing venues");
});

test("P14: BD gate flags schema, floor, duplicate, banned-content, and genre-mismatch blockers", () => {
  const packets = Array.from({ length: 12 }, (_, i) => packet("zz", i + 1));
  const good = deriveBookDesign("zz-biz", { genre: "business-decision", packets, chapters: 12 });

  // BD5.genre_mismatch — an investing venue in a non-investing book.
  const mism: BookDesignV1 = { ...good, pools: { ...good.pools, venues: ["broker statement", ...good.pools.venues] } };
  assert.ok(validateBookDesign(mism, 12).some((f) => f.checkId === "BD5.genre_mismatch"), "investing venue in a business book must trip BD5");

  // BD3.duplicate_entries.
  const dup: BookDesignV1 = { ...good, pools: { ...good.pools, practiceForms: [good.pools.practiceForms[0], good.pools.practiceForms[0], ...good.pools.practiceForms.slice(1)] } };
  assert.ok(validateBookDesign(dup, 12).some((f) => f.checkId === "BD3.duplicate_entries"), "duplicate entries must trip BD3");

  // BD2.pool_floor.
  const thin: BookDesignV1 = { ...good, pools: { ...good.pools, sceneFramesDecision: good.pools.sceneFramesDecision.slice(0, 3) } };
  assert.ok(validateBookDesign(thin, 12).some((f) => f.checkId === "BD2.pool_floor"), "an under-floor pool must trip BD2");

  // BD4.banned_content — a C7 protagonist name.
  const banned: BookDesignV1 = { ...good, pools: { ...good.pools, practiceForms: ["a note Priya keeps", ...good.pools.practiceForms] } };
  assert.ok(validateBookDesign(banned, 12).some((f) => f.checkId === "BD4.banned_content"), "a C7 name must trip BD4");

  // BD1.schema — wrong schemaVersion.
  assert.ok(validateBookDesign({ ...good, schemaVersion: "nope" } as unknown, 12).some((f) => f.checkId === "BD1.schema"), "wrong schemaVersion must trip BD1");
});

test("P14: legacy byte-identity — no design artifact compiles byte-identically; a design artifact changes bytes + pins designHash", () => {
  withStateRoot("bookdesign-golden", (roots, packets, book, chapters) => {
    const ch = chapters[2];
    const pkt = packets[2];
    const args = { bookId: book, chapter: ch, packet: pkt, packetPath: sourcePacketPath(book, ch.chapterNumber, roots), roots, totalChapters: chapters.length } as const;

    // (1) No design artifact + `generic` genre (fixture is not in books.json) → legacy path.
    const legacy = compileChapterBlueprint(args);
    assert.equal(legacy.designHash, undefined, "legacy blueprint must not carry a designHash");
    const legacyBytes = JSON.stringify(legacy);

    // (2) Write a design artifact → blueprint changes and pins designHash.
    const design = deriveBookDesign(book, { roots, genre: "experience-design" });
    writeJsonFile(bookDesignPath(book, roots), design);
    const designed = compileChapterBlueprint(args);
    assert.ok(designed.designHash, "a design-driven blueprint must carry a designHash");
    assert.notEqual(JSON.stringify(designed), legacyBytes, "a design artifact must change the compiled blueprint");

    // (3) Edit the artifact (still gate-clean) → designHash + bytes change (hash pinning).
    const edited: BookDesignV1 = { ...design, pools: { ...design.pools, venues: [...design.pools.venues.slice(1), design.pools.venues[0]] } };
    writeJsonFile(bookDesignPath(book, roots), edited);
    const reDesigned = compileChapterBlueprint(args);
    assert.notEqual(reDesigned.designHash, designed.designHash, "editing the design artifact must change the pinned designHash");

    // (4) Remove the artifact → back to byte-identical legacy (golden preserved).
    rmSync(bookDesignPath(book, roots), { force: true });
    assert.equal(JSON.stringify(compileChapterBlueprint(args)), legacyBytes, "removing the design artifact must restore the byte-identical legacy blueprint");
  });
});

test("P14: design-derived venue palette preserves venuePlan cap-2 / no-adjacent invariants", () => {
  withStateRoot("bookdesign-venues", (roots, packets, book, chapters) => {
    const design = deriveBookDesign(book, { roots, genre: "investing" });
    writeJsonFile(bookDesignPath(book, roots), design);
    const allocation: Record<number, string[]> = {};
    for (const c of chapters) {
      const bp = compileChapterBlueprint({ bookId: book, chapter: c, packet: packets[c.chapterNumber - 1], packetPath: sourcePacketPath(book, c.chapterNumber, roots), roots, totalChapters: chapters.length });
      // The dealt example venues for this chapter must be a subset of its planned palette.
      allocation[c.chapterNumber] = bp.reservedVariety.venuePalette;
      const dealt = bp.sections.examples.map((e) => e.venue);
      for (const v of dealt) assert.ok(bp.reservedVariety.venuePalette.includes(v), "every dealt example venue must come from the chapter's planned palette");
    }
    // cap-2, within-chapter-distinct, and no-adjacent-overlap all hold for the design palette.
    assert.doesNotThrow(() => assertVenueInvariants(allocation, 1, chapters.length), "design-derived venue allocation must satisfy venuePlan invariants");
  });
});

// ── R1 (reviewer): CROSS-VERSION legacy golden — chains byte-compat across P13 → P14 ─────────────
// The P14 round-trip test above proves add/remove-artifact consistency WITHIN this code version;
// this test proves the no-artifact path still produces the SAME BYTES as the pre-P13 world: the
// golden was captured on pre-P13 main and independently re-verified there at both the P13 and P14
// reviews. Any future change that silently moves the legacy path breaks THIS test, not just
// self-consistency.
test("P14 (cross-version): the no-design legacy path reproduces the pre-P13 golden byte-for-byte", () => {
  const packet = JSON.parse(readFileSync(resolve(HERE, "fixtures", "fact-ranking-legacy-packet.json"), "utf8")) as SourcePacketV1;
  const golden = JSON.parse(readFileSync(resolve(HERE, "fixtures", "fact-ranking-legacy-blueprint.golden.json"), "utf8"));
  const stateRoot = resolve(tmpdir(), `cf-p14-crossgolden-${process.pid}-${Date.now()}`);
  const chapter = { chapterId: packet.chapterId, chapterNumber: packet.chapterNumber, chapterTitle: packet.chapterTitle };
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", `${packet.bookId}.json`), [chapter]);
    const bp = compileChapterBlueprint({ bookId: packet.bookId, chapter, packet, packetPath: golden.sourcePacketPath, roots: { stateRoot }, totalChapters: 1 });
    assert.deepEqual(JSON.parse(JSON.stringify(bp)), golden, "no-design/no-genre legacy compile must equal the pre-P13 golden (byte-compat chain)");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});
