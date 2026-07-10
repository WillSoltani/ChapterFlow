/**
 * B1 — v24 chapter briefs (one page of reservations + intent per chapter).
 *
 * Pins: byte-determinism; coreMove PARITY with the blueprint's P13 rule (against the pre-P13
 * legacy golden AND a ranked packet); the ownedCases/notYours partition; cast reuse of the
 * blueprint name deal (disjoint across chapters, real source-person names excluded book-wide);
 * answerIndexPattern reuse of the BP14-safe quiz-key deal; the avoid list (sibling openers on
 * regen, bounded at 6); design-pool flavor; the BR1–BR5 gate blockers firing on crafted bad
 * briefs and staying silent on good ones; and the rendered md staying compact (≤ 4300 chars)
 * with every section present.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

import { test } from "./harness.js";
import {
  BRIEF_QUIZ_SLOT_COUNT,
  DEFAULT_LENGTH_BUDGET_CHARS,
  LENGTH_BUDGET_TOLERANCE,
  compileChapterBriefs,
  renderBriefMd,
  validateChapterBriefs,
  writeChapterBriefs,
} from "../src/compiler/chapterBrief.js";
import {
  CHALLENGE_FRAMES,
  OPENER_TYPES,
  PRACTICE_SHAPES,
  dealBriefRotations,
} from "../src/compiler/briefRotation.js";
import { compileChapterBlueprint } from "../src/compiler/chapterBlueprint.js";
import { applyTeachingRanking } from "../src/compiler/sourcePacketFacts.js";
import { deriveBookDesign } from "../src/compiler/bookDesign.js";
import {
  bookDesignPath,
  chapterBriefMdPath,
  chapterBriefPath,
  readJsonFile,
  sourcePacketPath,
  writeJsonFile,
} from "../src/artifacts/artifactStore.js";
import { chapterFileName } from "../src/lib/chapterPaths.js";
import {
  SOURCE_PACKET_SCHEMA_VERSION,
  type ChapterBriefV1,
  type SourcePacketV1,
  type SourcePacketFact,
} from "../src/artifacts/artifactTypes.js";
import type { ChapterSpec } from "../src/generateChapter.js";

const BOOK = "zz-fixture-chapter-brief";

// Distinct case labels per chapter — the partition the briefs must reserve.
const CASE_LABELS: Record<number, string[]> = {
  1: ["Marshmallow Study", "Andon Cord Line Stop"],
  2: ["Ericsson Violin Study", "Semmelweis Ward Audit"],
  3: ["Framingham Heart Cohort"],
};

const HARD_SPECIFICS = ["credit utilization", "payment timing window", "reported balance snapshot", "statement closing date"];

// A distinct learning JOB per chapter — a good brief set teaches distinct capabilities,
// so the coreMove (facts[0].mechanism) must diverge across chapters or CF-C's LJ1
// adjacent-learning-job advisory legitimately fires. Templated "Mechanism i of chapter n"
// text (identical modulo the chapter number) is what LJ1 is designed to catch.
const CHAPTER_MOVE: Record<number, string> = {
  1: "verify a live handoff against its signed source note",
  2: "pace deliberate practice against honest outside feedback",
  3: "read a cohort study without overclaiming its finding",
};

function fact(n: number, i: number, over: Partial<SourcePacketFact> = {}): SourcePacketFact {
  return {
    id: `ch${n}.fact.${i}`,
    claim: `Claim ${i} for chapter ${n} about a concrete decision moment.`,
    mechanism: `Mechanism ${i}: ${CHAPTER_MOVE[n] ?? `handle case ${i} of chapter ${n}`}, and the effect follows.`,
    commonError: `Common error ${i} for chapter ${n}.`,
    whyWrong: `Why error ${i} is wrong in chapter ${n}.`,
    allowedClaimTypes: [],
    groundedNumbers: [],
    groundedEntities: [],
    groundedPlaces: [],
    verificationRefs: [`ref.${n}.${i}`],
    ...over,
  };
}

function packetFor(n: number, over: Partial<SourcePacketV1> = {}): SourcePacketV1 {
  const labels = CASE_LABELS[n] ?? [];
  return {
    schemaVersion: SOURCE_PACKET_SCHEMA_VERSION,
    bookId: BOOK,
    chapterId: `${BOOK}-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    chapterTitle: `Chapter ${n} Title`,
    sourceSidecarPath: null,
    sourceHash: null,
    facts: Array.from({ length: 6 }, (_, i) => fact(n, i + 1)),
    namedCases: labels.map((label, i) => ({
      id: `ch${n}.case.${i + 1}`,
      label,
      summary: `${label} summary for chapter ${n}.`,
      realWorld: true,
      hardSpecifics: HARD_SPECIFICS,
      allowedUses: [],
      forbiddenUses: [],
      doNotRestamp: [],
    })),
    frameworks: [],
    allowedAnchors: [],
    allowedNumbers: [],
    allowedEntities: [],
    allowedPlaces: [],
    forbiddenClaims: [],
    forbiddenLeakage: [],
    sourceQuality: { status: "strong", risks: [] },
    ...over,
  };
}

function chapterSpec(n: number): ChapterSpec {
  return { chapterId: `${BOOK}-ch${String(n).padStart(2, "0")}`, chapterNumber: n, chapterTitle: `Chapter ${n} Title` };
}

type Roots = { stateRoot: string };

function withBook(
  label: string,
  run: (roots: Roots, packets: SourcePacketV1[], chapters: ChapterSpec[]) => void,
  opts: { mutatePackets?: (packets: SourcePacketV1[]) => void } = {},
): void {
  const stateRoot = resolve(tmpdir(), `cf-b1-${label}-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters = [1, 2, 3].map(chapterSpec);
  const packets = chapters.map((c) => packetFor(c.chapterNumber));
  opts.mutatePackets?.(packets);
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", `${BOOK}.json`), chapters);
    for (const p of packets) writeJsonFile(sourcePacketPath(BOOK, p.chapterNumber, roots), p);
    run(roots, packets, chapters);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
}

// ── determinism ─────────────────────────────────────────────────────────────────────
test("B1: two compiles are byte-identical (json AND rendered md)", () => {
  withBook("determinism", (roots) => {
    const a = compileChapterBriefs(BOOK, { roots });
    const b = compileChapterBriefs(BOOK, { roots });
    assert.equal(JSON.stringify(a.briefs), JSON.stringify(b.briefs), "brief JSON must be deterministic");
    assert.deepEqual(a.briefs.map(renderBriefMd), b.briefs.map(renderBriefMd), "rendered md must be deterministic");
    assert.equal(a.briefs.length, 3);
    assert.deepEqual(a.findings, []);
  });
});

// ── coreMove parity with the blueprint's P13 rule ───────────────────────────────────
test("B1: legacy packet coreMove/quiz-key/cast match the pre-P13 blueprint golden", () => {
  const legacyPacket = JSON.parse(readFileSync(resolve(HERE, "fixtures", "fact-ranking-legacy-packet.json"), "utf8")) as SourcePacketV1;
  const golden = JSON.parse(readFileSync(resolve(HERE, "fixtures", "fact-ranking-legacy-blueprint.golden.json"), "utf8"));
  const stateRoot = resolve(tmpdir(), `cf-b1-legacy-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapter: ChapterSpec = { chapterId: legacyPacket.chapterId, chapterNumber: legacyPacket.chapterNumber, chapterTitle: legacyPacket.chapterTitle };
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", `${legacyPacket.bookId}.json`), [chapter]);
    writeJsonFile(sourcePacketPath(legacyPacket.bookId, legacyPacket.chapterNumber, roots), legacyPacket);
    const { briefs } = compileChapterBriefs(legacyPacket.bookId, { roots });
    assert.equal(briefs.length, 1);
    const brief = briefs[0];
    assert.equal(brief.coreMove, golden.coreMove.statement, "brief coreMove must equal the blueprint's legacy coreMove (P13 parity)");
    assert.equal(brief.thesis, legacyPacket.facts[0].claim, "legacy thesis falls back to the first fact's claim");
    assert.deepEqual(brief.answerIndexPattern, golden.reservedVariety.answerIndexPattern, "brief quiz key must be the SAME dealt pattern the blueprint pinned");
    assert.deepEqual(brief.cast, golden.reservedVariety.allowedNames.slice(0, 4), "brief cast must be drawn from the blueprint's own name deal");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("B1: ranked packet coreMove matches compileChapterBlueprint's statement", () => {
  withBook("ranked-parity", (roots, packets, chapters) => {
    // Rank ch1's packet (sets teachingPriority + coreMoveFactId), re-write it, recompile briefs.
    applyTeachingRanking(packets[0]);
    assert.ok(packets[0].coreMoveFactId, "fixture must gain a coreMoveFactId");
    writeJsonFile(sourcePacketPath(BOOK, 1, roots), packets[0]);
    const bp = compileChapterBlueprint({
      bookId: BOOK,
      chapter: chapters[0],
      packet: packets[0],
      packetPath: sourcePacketPath(BOOK, 1, roots),
      roots,
      totalChapters: chapters.length,
    });
    const { briefs } = compileChapterBriefs(BOOK, { roots });
    assert.equal(briefs[0].coreMove, bp.coreMove.statement, "ranked coreMove must mirror the blueprint's P13 rule");
    // thesis = highest-teachingPriority fact's claim.
    const top = [...packets[0].facts].sort((a, b) => a.teachingPriority! - b.teachingPriority!)[0];
    assert.equal(briefs[0].thesis, top.claim.replace(/\s+/g, " ").trim());
  });
});

test("B1: readerPromise is the deterministic template over coreMove", () => {
  withBook("promise", (roots) => {
    const { briefs } = compileChapterBriefs(BOOK, { roots });
    for (const brief of briefs) {
      const move = brief.coreMove.replace(/\s+/g, " ").trim();
      assert.equal(
        brief.readerPromise,
        `After this chapter, a reader can ${move.charAt(0).toLowerCase()}${move.slice(1)}`,
      );
    }
  });
});

// ── ownedCases / notYours partition ─────────────────────────────────────────────────
test("B1: ownedCases/notYours partition the book's case labels", () => {
  withBook("partition", (roots, packets) => {
    const { briefs } = compileChapterBriefs(BOOK, { roots });
    for (const brief of briefs) {
      const n = brief.chapterNumber;
      const ownLabels = CASE_LABELS[n];
      assert.deepEqual(
        brief.ownedCases,
        packets[n - 1].namedCases.map((c) => ({ id: c.id, label: c.label })),
        `ch${n} ownedCases must be its packet's namedCases`,
      );
      const otherLabels = Object.entries(CASE_LABELS).filter(([k]) => Number(k) !== n).flatMap(([, ls]) => ls);
      for (const label of otherLabels) assert.ok(brief.notYours.includes(label), `ch${n} notYours must include "${label}"`);
      for (const label of ownLabels) assert.ok(!brief.notYours.includes(label), `ch${n} notYours must NOT include its own "${label}"`);
      assert.deepEqual(brief.notYours, [...brief.notYours].sort(), `ch${n} notYours must be alphabetical`);
      assert.ok(brief.notYours.length <= 20, "notYours capped at 20");
    }
  });
});

// ── cast reservations ───────────────────────────────────────────────────────────────
test("B1: cast is 2-4 names per chapter, disjoint across the book, never a reserved source figure", () => {
  withBook("cast", (roots) => {
    const { briefs } = compileChapterBriefs(BOOK, { roots });
    const seen = new Set<string>();
    for (const brief of briefs) {
      assert.ok(brief.cast.length >= 2 && brief.cast.length <= 4, `ch${brief.chapterNumber} cast size ${brief.cast.length} outside 2-4`);
      for (const name of brief.cast) {
        assert.ok(!seen.has(name), `cast name "${name}" reused across chapters`);
        seen.add(name);
        assert.ok(!["Benjamin", "Graham", "Dodd", "Buffett", "Warren"].includes(name), `cast contains reserved source figure "${name}"`);
      }
    }
  });
});

test("B1: a real source-person name in ANY packet is evicted from every chapter's cast", () => {
  // First compile without protection to find a name that IS dealt into a cast…
  let dealtName = "";
  withBook("cast-probe", (roots) => {
    const { briefs } = compileChapterBriefs(BOOK, { roots });
    dealtName = briefs[0].cast[0];
    assert.ok(dealtName, "probe compile must deal at least one cast name");
  });
  // …then inject that name as a real person in a DIFFERENT chapter's packet and recompile.
  withBook(
    "cast-protected",
    (roots) => {
      const { briefs } = compileChapterBriefs(BOOK, { roots });
      for (const brief of briefs) {
        assert.ok(!brief.cast.includes(dealtName), `ch${brief.chapterNumber} cast still contains protected source person "${dealtName}"`);
        assert.ok(brief.cast.length >= 2, "eviction must not drop a chapter below the 2-name floor");
      }
    },
    {
      mutatePackets: (packets) => {
        packets[2].facts[0] = { ...packets[2].facts[0], groundedEntities: [`${dealtName} Kross`] };
      },
    },
  );
});

// ── answerIndexPattern reuse ─────────────────────────────────────────────────────────
test("B1: answerIndexPattern equals the blueprint's dealt pattern for every chapter", () => {
  withBook("quiz-key", (roots, packets, chapters) => {
    const { briefs } = compileChapterBriefs(BOOK, { roots });
    for (const brief of briefs) {
      const bp = compileChapterBlueprint({
        bookId: BOOK,
        chapter: chapters[brief.chapterNumber - 1],
        packet: packets[brief.chapterNumber - 1],
        packetPath: sourcePacketPath(BOOK, brief.chapterNumber, roots),
        roots,
        totalChapters: chapters.length,
      });
      assert.deepEqual(brief.answerIndexPattern, bp.reservedVariety.answerIndexPattern, `ch${brief.chapterNumber} quiz key must be the compiler's own deal`);
      assert.equal(brief.answerIndexPattern.length, BRIEF_QUIZ_SLOT_COUNT);
    }
  });
});

// ── length budget ───────────────────────────────────────────────────────────────────
test("B1: lengthBudget defaults to 16000/0.2 and honors opts.lengthBudget", () => {
  withBook("budget", (roots) => {
    const dflt = compileChapterBriefs(BOOK, { roots });
    for (const brief of dflt.briefs) {
      assert.deepEqual(brief.lengthBudget, { renderedChars: DEFAULT_LENGTH_BUDGET_CHARS, tolerance: LENGTH_BUDGET_TOLERANCE });
    }
    const custom = compileChapterBriefs(BOOK, { roots, lengthBudget: 12000 });
    for (const brief of custom.briefs) assert.equal(brief.lengthBudget.renderedChars, 12000);
  });
});

// ── flavor + avoid ──────────────────────────────────────────────────────────────────
test("B1: flavor is empty without a design artifact, and 1-5 pool suggestions with one", () => {
  withBook("flavor", (roots, packets, chapters) => {
    const bare = compileChapterBriefs(BOOK, { roots });
    for (const brief of bare.briefs) assert.deepEqual(brief.flavor, [], "no design artifact → no flavor");
    for (const brief of bare.briefs) assert.deepEqual(brief.avoid, [], "fresh book, no artifact → empty avoid");

    const design = deriveBookDesign(BOOK, { roots, genre: "business-decision", packets, chapters: chapters.length });
    assert.equal(design.provenance.source, "derived", "fixture must derive real pools");
    writeJsonFile(bookDesignPath(BOOK, roots), design);
    const flavored = compileChapterBriefs(BOOK, { roots });
    for (const brief of flavored.briefs) {
      assert.ok(brief.flavor.length >= 1 && brief.flavor.length <= 5, `flavor size ${brief.flavor.length} outside 1-5`);
      for (const f of brief.flavor) assert.match(f, /^(venue|frame): /, `flavor entry "${f}" must be a venue/frame suggestion`);
    }
  });
});

test("B1: avoid picks up sibling openers on regen and is bounded at 6", () => {
  withBook("avoid", (roots, packets, chapters) => {
    // Regen case: sibling chapter files already on disk for ch1 + ch2.
    const chaptersDir = resolve(roots.stateRoot, "chapters");
    mkdirSync(chaptersDir, { recursive: true });
    const opener = (n: number) =>
      `The ch${n} morning audit began with one missing signature and nobody wanted to say so out loud.`;
    for (const n of [1, 2]) {
      writeFileSync(
        resolve(chaptersDir, chapterFileName(chapters[n - 1].chapterId)),
        JSON.stringify({ chapterId: chapters[n - 1].chapterId, examples: [{ scenario: opener(n) }] }),
      );
    }
    // Design artifact too, so sibling flavor picks overflow the cap.
    writeJsonFile(bookDesignPath(BOOK, roots), deriveBookDesign(BOOK, { roots, genre: "business-decision", packets, chapters: chapters.length }));

    const { briefs } = compileChapterBriefs(BOOK, { roots });
    for (const brief of briefs) assert.ok(brief.avoid.length <= 6, `ch${brief.chapterNumber} avoid has ${brief.avoid.length} lines (cap 6)`);
    const ch3 = briefs.find((b) => b.chapterNumber === 3)!;
    const sig1 = opener(1).split(/\s+/).slice(0, 8).join(" ");
    assert.ok(ch3.avoid.includes(`opener (ch01): "${sig1}"`), `ch3 avoid must carry ch1's first-example opening signature; got ${JSON.stringify(ch3.avoid)}`);
    assert.ok(ch3.avoid.some((a) => a.startsWith("opener (ch02):")), "ch3 avoid must carry ch2's opener too");
    assert.equal(ch3.avoid.length, 6, "openers + sibling flavor picks must saturate the cap at exactly 6");
  });
});

// ── write + gate (good path) ─────────────────────────────────────────────────────────
test("B1: writeChapterBriefs persists json+md and the gate passes on a good set", () => {
  withBook("good-gate", (roots) => {
    const { written, findings } = writeChapterBriefs(BOOK, { roots });
    assert.deepEqual(findings, []);
    assert.equal(written.length, 6, "3 chapters × (json + md)");
    for (const n of [1, 2, 3]) {
      const onDisk = readJsonFile<ChapterBriefV1>(chapterBriefPath(BOOK, n, roots));
      assert.equal(onDisk.schemaVersion, "chapterflow-brief-v1");
      assert.equal(onDisk.chapterNumber, n);
      const md = readFileSync(chapterBriefMdPath(BOOK, n, roots), "utf8");
      assert.ok(md.includes("## THE MOVE"), "md written next to json");
    }
    const report = validateChapterBriefs(BOOK, roots);
    assert.equal(report.passed, true, `good briefs must pass, got: ${JSON.stringify(report.findings)}`);
    assert.deepEqual(report.findings, []);
  });
});

// ── CF-C: learning-job separation (adjacentJobs + NOT-THIS card line + LJ1 advisory) ──
test("CF-C: each brief carries its neighbours' learning jobs (adjacentJobs) and renders a NOT-THIS-CHAPTER line", () => {
  withBook("cfd-jobs", (roots) => {
    const { briefs } = compileChapterBriefs(BOOK, { roots });
    const byN = new Map(briefs.map((b) => [b.chapterNumber, b]));
    // ch1 (first) has next only; ch2 (middle) has prev+next; ch3 (last) has prev only.
    assert.equal(byN.get(1)!.adjacentJobs?.prev, undefined, "first chapter has no prev job");
    assert.equal(byN.get(1)!.adjacentJobs?.next, byN.get(2)!.coreMove, "ch1's next job is ch2's coreMove");
    assert.equal(byN.get(2)!.adjacentJobs?.prev, byN.get(1)!.coreMove, "ch2's prev job is ch1's coreMove");
    assert.equal(byN.get(2)!.adjacentJobs?.next, byN.get(3)!.coreMove, "ch2's next job is ch3's coreMove");
    assert.equal(byN.get(3)!.adjacentJobs?.next, undefined, "last chapter has no next job");
    // The rendered card VARIETY line names THIS job and the neighbour it must not re-teach.
    const md2 = renderBriefMd(byN.get(2)!);
    assert.match(md2, /THIS CHAPTER'S JOB:/, "the job line renders");
    assert.match(md2, /NOT THIS CHAPTER:/, "the neighbour-job separation renders");
    assert.match(md2, /prev ch owns/, "names the previous chapter's job");
    assert.match(md2, /next ch owns/, "names the next chapter's job");
  });
});

test("CF-C: LJ1 fires (advisory, not blocker) when adjacent chapters declare near-duplicate learning jobs", () => {
  withBook(
    "cfd-lj1",
    (roots) => {
      const { findings } = writeChapterBriefs(BOOK, { roots });
      assert.deepEqual(findings, []);
      const report = validateChapterBriefs(BOOK, roots);
      // ADVISORY only — the gate still PASSES (adjacent overlap is never a blocker).
      assert.equal(report.passed, true, `LJ1 must never block: ${JSON.stringify(report.findings)}`);
      const lj1 = report.findings.filter((f) => f.checkId === "LJ1.adjacent_learning_job");
      assert.equal(lj1.length, 1, `expected exactly one LJ1 advisory, got: ${JSON.stringify(report.findings)}`);
      assert.equal(lj1[0].severity, "advisory");
      assert.match(lj1[0].message, /chapters 1 and 2/, "names both offending chapters");
    },
    { mutatePackets: (packets) => { packets[1].facts[0].mechanism = packets[0].facts[0].mechanism; } },
  );
});

test("CF-C: LJ1 stays SILENT on the distinct-job fixture (adjacent coreMoves diverge)", () => {
  withBook("cfd-lj1-silent", (roots) => {
    writeChapterBriefs(BOOK, { roots });
    const report = validateChapterBriefs(BOOK, roots);
    assert.deepEqual(report.findings.filter((f) => f.checkId === "LJ1.adjacent_learning_job"), [], "distinct adjacent jobs must not fire LJ1");
    assert.equal(report.passed, true);
  });
});

// ── gate blockers on crafted bad briefs ──────────────────────────────────────────────
function corruptBrief(roots: Roots, n: number, mutate: (brief: ChapterBriefV1) => void): void {
  const p = chapterBriefPath(BOOK, n, roots);
  const brief = readJsonFile<ChapterBriefV1>(p);
  mutate(brief);
  writeJsonFile(p, brief);
}

test("B1 gate: BR1 fires when two chapters own the same case label", () => {
  withBook("br1", (roots) => {
    writeChapterBriefs(BOOK, { roots });
    corruptBrief(roots, 2, (b) => { b.ownedCases = [...b.ownedCases, { id: "ch2.case.dup", label: "Marshmallow Study" }]; });
    const report = validateChapterBriefs(BOOK, roots);
    assert.equal(report.passed, false);
    assert.ok(report.findings.some((f) => f.checkId === "BR1.case_collision" && f.severity === "blocker"), JSON.stringify(report.findings));
  });
});

test("B1 gate: BR2 fires on a cast collision AND on a real source-person cast name", () => {
  withBook(
    "br2",
    (roots) => {
      writeChapterBriefs(BOOK, { roots });
      const first = readJsonFile<ChapterBriefV1>(chapterBriefPath(BOOK, 1, roots));
      corruptBrief(roots, 2, (b) => { b.cast = [first.cast[0], "Ethan"]; }); // collision + protected (ch3 packet carries "Ethan Kross")
      const report = validateChapterBriefs(BOOK, roots);
      assert.equal(report.passed, false);
      assert.ok(report.findings.some((f) => f.checkId === "BR2.cast_collision"), JSON.stringify(report.findings));
      assert.ok(report.findings.some((f) => f.checkId === "BR2.cast_source_person" && f.message.includes("Ethan")), JSON.stringify(report.findings));
    },
    {
      mutatePackets: (packets) => {
        packets[2].facts[0] = { ...packets[2].facts[0], groundedEntities: ["Ethan Kross"] };
      },
    },
  );
});

test("B1 gate: BR3 fires on missing, short, out-of-range, and all-identical answer patterns", () => {
  withBook("br3", (roots) => {
    writeChapterBriefs(BOOK, { roots });
    corruptBrief(roots, 1, (b) => { (b as Partial<ChapterBriefV1>).answerIndexPattern = undefined as unknown as number[]; });
    corruptBrief(roots, 2, (b) => { b.answerIndexPattern = [0, 1, 2, 0, 3]; }); // short AND out-of-range
    corruptBrief(roots, 3, (b) => { b.answerIndexPattern = [1, 1, 1, 1, 1, 1, 1, 1, 1]; });
    const report = validateChapterBriefs(BOOK, roots);
    assert.equal(report.passed, false);
    const br3 = report.findings.filter((f) => f.checkId === "BR3.answer_pattern");
    assert.ok(br3.some((f) => f.message.includes("no answerIndexPattern")), "missing pattern must fire");
    assert.ok(br3.some((f) => f.message.includes("5 slots")), "wrong slot count must fire");
    assert.ok(br3.some((f) => f.message.includes("outside 0..2")), "out-of-range values must fire");
    assert.ok(br3.some((f) => f.message.includes("all-identical")), "all-identical key must fire");
  });
});

test("B1 gate: BR4 fires when lengthBudget.renderedChars leaves [8000, 30000]", () => {
  withBook("br4", (roots) => {
    writeChapterBriefs(BOOK, { roots });
    corruptBrief(roots, 1, (b) => { b.lengthBudget = { renderedChars: 5000, tolerance: 0.2 }; });
    corruptBrief(roots, 2, (b) => { b.lengthBudget = { renderedChars: 45000, tolerance: 0.2 }; });
    const report = validateChapterBriefs(BOOK, roots);
    assert.equal(report.passed, false);
    assert.equal(report.findings.filter((f) => f.checkId === "BR4.length_budget").length, 2, JSON.stringify(report.findings));
  });
});

test("B1 gate: BR5 fires on empty coreMove/thesis; BR0 on a missing brief", () => {
  withBook("br5", (roots) => {
    writeChapterBriefs(BOOK, { roots });
    corruptBrief(roots, 1, (b) => { b.coreMove = "   "; b.thesis = ""; });
    rmSync(chapterBriefPath(BOOK, 3, roots), { force: true });
    const report = validateChapterBriefs(BOOK, roots);
    assert.equal(report.passed, false);
    assert.equal(report.findings.filter((f) => f.checkId === "BR5.core_move").length, 2, JSON.stringify(report.findings));
    assert.ok(report.findings.some((f) => f.checkId === "BR0.missing" && f.message.includes("chapter 3")), JSON.stringify(report.findings));
  });
});

// ── rendered md ─────────────────────────────────────────────────────────────────────
test("B1: rendered md contains every section and stays ≤ 9200 chars on the fixture (design pools + regen avoid active)", () => {
  withBook("md", (roots, packets, chapters) => {
    // Worst realistic case: design flavor present + sibling openers on disk.
    writeJsonFile(bookDesignPath(BOOK, roots), deriveBookDesign(BOOK, { roots, genre: "business-decision", packets, chapters: chapters.length }));
    const chaptersDir = resolve(roots.stateRoot, "chapters");
    mkdirSync(chaptersDir, { recursive: true });
    for (const n of [1, 2]) {
      writeFileSync(
        resolve(chaptersDir, chapterFileName(chapters[n - 1].chapterId)),
        JSON.stringify({ chapterId: chapters[n - 1].chapterId, examples: [{ scenario: `Chapter ${n} opens on a quiet loading dock where the count is already wrong.` }] }),
      );
    }
    const { briefs } = compileChapterBriefs(BOOK, { roots });
    const SECTIONS = ["## THE MOVE", "## PROMISE", "## VARIETY", "## YOUR CASES", "## NOT YOURS", "## CAST", "## QUIZ KEY PATTERN", "## AVOID", "## LENGTH", "## FLAVOR"];
    for (const brief of briefs) {
      const md = renderBriefMd(brief);
      for (const section of SECTIONS) assert.ok(md.includes(section), `ch${brief.chapterNumber} md missing "${section}"`);
      // Cap raised 2700 → 3900 (S-tier) → 8200 (STIER-2 2026-07-03, deliberate — plan
      // docs/v24/STIER2-PLAN-2026-07-03.md §B): the VARIETY section gained the per-slot
      // example ARC table, lead thread, quiz stem/failure-mode/order deals, per-slot
      // practice shapes, memorable shapes, limits placement, and grounding form
      // (fixture measures ~7.8k). The CARD no longer pays this twice — B0 strips the
      // md's VARIETY section when the machine brief renders the explicit block, so the
      // card's ≤25k budget holds (real-size pin lives in stier2-levers.test.ts).
      assert.ok(md.length <= 9600, `ch${brief.chapterNumber} md is ${md.length} chars (cap 9600)`); // 8200 → 9200 (STIER-3 v4) → 9600: CF-C THIS-CHAPTER'S-JOB / NOT-THIS-CHAPTER line in VARIETY (fixture measures ~9.5k)
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// W4 — brief-level variety rotation (openerType / challengeFrame / practiceShape)
// ════════════════════════════════════════════════════════════════════════════

test("W4: every brief carries a dealt openerType/challengeFrame/practiceShape from the pools", () => {
  withBook("w4-fields", (roots) => {
    const { briefs } = compileChapterBriefs(BOOK, { roots });
    assert.ok(briefs.length >= 1);
    for (const brief of briefs) {
      assert.ok((OPENER_TYPES as readonly string[]).includes(brief.openerType), `ch${brief.chapterNumber} openerType ${brief.openerType}`);
      assert.ok((CHALLENGE_FRAMES as readonly string[]).includes(brief.challengeFrame), `ch${brief.chapterNumber} challengeFrame ${brief.challengeFrame}`);
      assert.ok((PRACTICE_SHAPES as readonly string[]).includes(brief.practiceShape), `ch${brief.chapterNumber} practiceShape ${brief.practiceShape}`);
    }
  });
});

test("W4 rotation is DETERMINISTIC (fnv1a-seeded, no Math.random) and per-book distinct", () => {
  const a = dealBriefRotations("some-book", 12);
  const b = dealBriefRotations("some-book", 12);
  for (let n = 1; n <= 12; n++) assert.deepEqual(a.get(n), b.get(n), `ch${n} must be byte-stable across calls`);
  const other = dealBriefRotations("other-book", 12);
  const differs = Array.from({ length: 12 }, (_, i) => i + 1).some((n) => a.get(n)!.openerType !== other.get(n)!.openerType || a.get(n)!.challengeFrame !== other.get(n)!.challengeFrame);
  assert.ok(differs, "different books get different deals");
});

test("W4 challengeFrame is DISJOINT (no repeat) while N <= pool size", () => {
  const n = CHALLENGE_FRAMES.length; // exactly the pool size
  const deal = dealBriefRotations("frames-book", n);
  const frames = Array.from({ length: n }, (_, i) => deal.get(i + 1)!.challengeFrame);
  assert.equal(new Set(frames).size, n, "every challengeFrame is unique up to pool exhaustion");
});

test("W4 challengeFrame pool EXHAUSTION (N > pool): wraps but honors the ceil(1/3·N) spread cap", () => {
  const n = CHALLENGE_FRAMES.length * 2 + 3; // well past the pool
  const deal = dealBriefRotations("exhaust-book", n);
  const counts = new Map<string, number>();
  for (let i = 1; i <= n; i++) {
    const f = deal.get(i)!.challengeFrame;
    counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  const cap = Math.max(1, Math.ceil(n / 3));
  for (const [f, c] of counts) assert.ok(c <= cap, `frame "${f}" used ${c}× exceeds ceil(1/3·N)=${cap}`);
});

test("W4 openerType/practiceShape honor the ceil(2/3·N) cap across the book", () => {
  const n = 12;
  const deal = dealBriefRotations("cap-book", n);
  const cap = Math.ceil((2 * n) / 3);
  const opener = new Map<string, number>();
  const practice = new Map<string, number>();
  for (let i = 1; i <= n; i++) {
    opener.set(deal.get(i)!.openerType, (opener.get(deal.get(i)!.openerType) ?? 0) + 1);
    practice.set(deal.get(i)!.practiceShape, (practice.get(deal.get(i)!.practiceShape) ?? 0) + 1);
  }
  for (const [, c] of opener) assert.ok(c <= cap, `openerType over cap ${cap}`);
  for (const [, c] of practice) assert.ok(c <= cap, `practiceShape over cap ${cap}`);
});

test("W4: renderBriefMd VARIETY section carries the three explicit instructions incl. the 24h stem ban", () => {
  withBook("w4-md", (roots) => {
    const { briefs } = compileChapterBriefs(BOOK, { roots });
    for (const brief of briefs) {
      const md = renderBriefMd(brief);
      assert.match(md, /## VARIETY/);
      assert.match(md, /OPENER:/);
      assert.match(md, /24-HOUR CHALLENGE:/);
      assert.match(md, /Do NOT use the "In the next 24 hours," stem\./);
      assert.match(md, /PRACTICE:/);
    }
  });
});

// ── BR6 / BR7 gate ────────────────────────────────────────────────────────────

test("W4 gate: a good brief set with dealt rotations passes (BR6/BR7 silent)", () => {
  withBook("w4-good", (roots) => {
    writeChapterBriefs(BOOK, { roots });
    const report = validateChapterBriefs(BOOK, roots);
    assert.equal(report.passed, true, JSON.stringify(report.findings));
    assert.equal(report.findings.filter((f) => f.checkId.startsWith("BR6") || f.checkId.startsWith("BR7")).length, 0);
  });
});

test("W4 gate: BR6 fires (fail-closed) when a brief is missing/invalid a rotation field", () => {
  withBook("w4-br6", (roots) => {
    writeChapterBriefs(BOOK, { roots });
    corruptBrief(roots, 1, (b) => { (b as Partial<ChapterBriefV1>).openerType = undefined as never; });
    corruptBrief(roots, 2, (b) => { b.challengeFrame = "not-a-frame" as never; });
    corruptBrief(roots, 3, (b) => { b.practiceShape = "" as never; });
    const report = validateChapterBriefs(BOOK, roots);
    assert.equal(report.passed, false);
    const br6 = report.findings.filter((f) => f.checkId === "BR6.rotation_field");
    assert.equal(br6.length, 3, JSON.stringify(report.findings));
    assert.ok(br6.every((f) => f.severity === "blocker"));
    assert.ok(br6.some((f) => /openerType/.test(f.message)));
    assert.ok(br6.some((f) => /challengeFrame/.test(f.message)));
    assert.ok(br6.some((f) => /practiceShape/.test(f.message)));
  });
});

test("W4 gate: BR7 fires when a hand-edited brief set over-concentrates a rotation", () => {
  withBook("w4-br7", (roots) => {
    writeChapterBriefs(BOOK, { roots });
    // Force every chapter's challengeFrame identical → 3/3 > no-repeat cap of 1.
    for (const n of [1, 2, 3]) corruptBrief(roots, n, (b) => { b.challengeFrame = "before-your-next-X"; });
    const report = validateChapterBriefs(BOOK, roots);
    assert.equal(report.passed, false);
    const br7 = report.findings.filter((f) => f.checkId === "BR7.rotation_cap");
    assert.ok(br7.some((f) => /challengeFrame/.test(f.message)), JSON.stringify(report.findings));
    assert.ok(br7.every((f) => f.severity === "blocker"));
  });
});

// ── BR6-v3 / BR8: STIER-2 dealt fields (plan docs/v24/STIER2-PLAN-2026-07-03.md) ──

test("STIER-2 gate: compiled v3 briefs pass whole; stripping ONE v3 field fires BR6.v3_partial (all-or-none, fail-closed)", () => {
  withBook("v3-gate", (roots) => {
    writeChapterBriefs(BOOK, { roots });
    const clean = validateChapterBriefs(BOOK, roots);
    assert.equal(clean.passed, true, JSON.stringify(clean.findings));
    assert.equal(clean.findings.filter((f) => f.checkId.startsWith("BR6.v3") || f.checkId === "BR8.rotation_cap").length, 0, "compile output is gate-clean by construction");
    // A v3-stamped brief that lost ONE deal must fail closed — a partial v3 brief
    // would silently ship that lever's house pattern (grill round-2b #10).
    corruptBrief(roots, 1, (b) => { b.limitsPlacement = undefined as never; });
    corruptBrief(roots, 2, (b) => { b.exampleArcs = (b.exampleArcs ?? []).slice(0, 1) as never; });
    const report = validateChapterBriefs(BOOK, roots);
    assert.equal(report.passed, false);
    const partial = report.findings.filter((f) => f.checkId === "BR6.v3_partial");
    assert.equal(partial.length, 2, JSON.stringify(report.findings));
    assert.ok(partial.some((f) => /limitsPlacement/.test(f.message)));
    assert.ok(partial.some((f) => /exampleArcs/.test(f.message)));
    // A brief with NO v3 markers at all is a legacy v2 brief and passes untouched.
    corruptBrief(roots, 3, (b) => {
      const rec = b as Record<string, unknown>;
      for (const k of ["rotationSchemaVersion", "exampleCount", "exampleArcs", "practiceSlotShapes", "quizStemShapes", "quizFailureModes", "questionFactOrder", "memorableShapes", "limitsPlacement", "groundingForm", "leadThread", "idiomFamilies", "shellRegister"]) delete rec[k];
    });
    const mixed = validateChapterBriefs(BOOK, roots);
    assert.ok(!mixed.findings.some((f) => f.checkId === "BR6.v3_partial" && /chapter 3 /.test(f.message)), "a clean v2 brief never trips the v3 gate");
  });
});
