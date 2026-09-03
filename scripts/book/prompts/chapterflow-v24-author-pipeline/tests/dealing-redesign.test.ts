/**
 * Package 1C — "the blueprint deals what the chapter needs, not what position says."
 *
 * Property-style tests over MANY bookIds x chapter counts, compiled through the real
 * production path (compileChapterBlueprint / deriveBookDesign), pinning the dealing
 * redesign's behavioural claims:
 *
 *   - case cues follow FACT RELEVANCE, not slot position (R-062/R-101/R-119/R-125);
 *   - every positional pool gets a per-chapter permutation, not a marching rotation
 *     (R-102/R-104), while BPV11's round-robin cap still holds by construction;
 *   - fact routing spreads facts across surfaces and covers every teaching fact
 *     (R-126/R-127);
 *   - the name window never reuses a name inside a chapter and never collides across
 *     chapters (R-120), and forbiddenNames carries no bank filler (R-114/R-115);
 *   - venues/frames are the chapter's own, never another chapter's tokens (R-065/R-103/R-113).
 */
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { compileSourcePacketFromSidecar } from "../src/compiler/sourcePacket.js";
import { compileChapterBlueprint, POSITIONAL_DEALS, resolvedPoolsForBook } from "../src/compiler/chapterBlueprint.js";
import { checkPositionalDeals, poolSizeOverrides, validateBlueprint } from "../src/compiler/blueprintGate.js";
import { buildGenrePools, deriveBookDesign, genreForBook, rankedTopicsForPacket, validateBookDesign } from "../src/compiler/bookDesign.js";
import { properNounTokens, rankedCaseIdsForFact, scoredCaseIdsForFact, CASE_LINKAGE_MIN_SCORE } from "../src/compiler/sourcePacketFacts.js";
import { bookDesignPath, sourcePacketPath, writeJsonFile, type CompilerStoreRoots } from "../src/artifacts/artifactStore.js";
import type { BookDesignV1, ChapterBlueprintV1, SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import type { ChapterSpec } from "../src/generateChapter.js";
import type { SourceSidecarV2 } from "../src/source/sidecarSchema.js";

// ── a realistic multi-case, multi-fact synthetic book ──────────────────────────────
// Each chapter carries 5 named cases with DISTINCT vocabularies and 11 facts whose
// wording deliberately overlaps ONE of those cases, so "the fact's best case" is a
// checkable ground truth rather than an accident of ordering.
const CASE_VOCAB = [
  { key: "fire", words: "fire company bucket ladder hook brigade neighbourhood watch" },
  { key: "militia", words: "militia lottery muskets cannon battery volunteer defence" },
  { key: "hospital", words: "hospital subscription matching grant ward physician charity" },
  { key: "junto", words: "junto club questions essays discussion mutual improvement" },
  { key: "library", words: "library subscription books borrowing shelves catalogue readers" },
];

function sidecar(chapterNumber: number, title: string): SourceSidecarV2 {
  const facts = Array.from({ length: 11 }, (_, i) => {
    const v = CASE_VOCAB[i % CASE_VOCAB.length];
    return {
      id: `ch${chapterNumber}.fact.${i + 1}`,
      claim: `The ${v.words.split(" ").slice(0, 3).join(" ")} shows how ${title} works in practice ${i + 1}.`,
      becauseMechanism: `Because the ${v.words.split(" ").slice(0, 4).join(" ")} changes who acts first, ${title} transfers.`,
      commonError: `Readers treat the ${v.key} story as decoration instead of the mechanism ${i + 1}.`,
      errorIsWhy: `The ${v.words.split(" ").slice(2, 5).join(" ")} is what makes the lesson hold ${i + 1}.`,
    };
  });
  return {
    schemaVersion: "source-v2",
    chapterNumber,
    chapterTitle: title,
    centralConcept: { id: `ch${chapterNumber}.concept`, name: title, plainDefinition: `${title} definition.`, whyItMatters: `${title} matters to the reader.` },
    keyClaims: facts.map((f) => f.claim),
    namedExamples: CASE_VOCAB.map((v) => ({
      id: `ch${chapterNumber}.case.${v.key}`,
      label: `The ${v.key} project`,
      summary: `A grounded account of the ${v.words} and what it changed.`,
      teachesWhat: `Teaches the ${v.key} move.`,
      hardSpecifics: [`${v.key} specific one`, `${v.key} specific two`],
      realWorld: true,
    })),
    hardEdge: "Do not overclaim the mechanism.",
    paraphraseNotes: "Keep claims bounded to the tested facts.",
    testableFacts: facts,
    frameworks: [{ name: "Test framework", members: ["a", "b"] }],
  };
}

function chapterSpec(bookId: string, n: number): ChapterSpec {
  return { chapterId: `${bookId}-ch${String(n).padStart(2, "0")}`, chapterNumber: n, chapterTitle: `Chapter ${n}` };
}

function compileBook(bookId: string, totalChapters: number): { blueprints: ChapterBlueprintV1[]; packets: SourcePacketV1[] } {
  const blueprints: ChapterBlueprintV1[] = [];
  const packets: SourcePacketV1[] = [];
  for (let n = 1; n <= totalChapters; n++) {
    const spec = chapterSpec(bookId, n);
    const packet = compileSourcePacketFromSidecar({ bookId, chapter: spec, sidecar: sidecar(n, spec.chapterTitle), sidecarPath: `/tmp/${bookId}-ch${n}.source.json`, sourceHash: `hash${n}` });
    packets.push(packet);
    blueprints.push(compileChapterBlueprint({ bookId, chapter: spec, packet, packetPath: `/tmp/${bookId}-ch${n}.source-packet.json`, totalChapters }));
  }
  return { blueprints, packets };
}

// Many bookIds x chapter counts — the deal is seeded per book, so one book proves nothing.
const BOOK_IDS = ["zz-deal-alpha", "zz-deal-bravo", "zz-deal-charlie", "zz-deal-delta", "zz-deal-echo"];
const CHAPTER_COUNTS = [4, 9, 12, 21];

// ── R-062 / R-101 / R-119 / R-125 — case cues follow fact relevance ────────────────

test("R-101: every dealt case cue is a top-scoring case for its slot's fact (within one point of the best)", () => {
  for (const bookId of BOOK_IDS) {
    const { blueprints, packets } = compileBook(bookId, 9);
    blueprints.forEach((bp, idx) => {
      const packet = packets[idx];
      const check = (factIds: string[], cueIds: string[], where: string) => {
        if (cueIds.length === 0) return;
        const scored = scoredCaseIdsForFact(packet, factIds[0], 0);
        assert.ok(scored.length > 0, `${where}: no scored cases`);
        const top = scored[0].score;
        for (const cue of cueIds) {
          const entry = scored.find((s) => s.id === cue);
          assert.ok(entry, `${bookId} ch${bp.chapterNumber} ${where}: cue ${cue} is not a case of this packet`);
          assert.ok(entry!.score >= top - 1, `${bookId} ch${bp.chapterNumber} ${where}: cue ${cue} scores ${entry!.score} against a top of ${top} — load-balancing must stay inside one point of the best-linked case`);
        }
      };
      // Quiz and card cues are STRICTLY inside the head: they are optional, so there is never a
      // reason to reach past it. Example cues are mandatory (BPV10), so a slot may spill outside
      // the head once every head case has taken its fair share — this packet's five cases over
      // six slots leaves the head un-exhausted, so the strict rule still holds here.
      bp.sections.examples.forEach((ex, i) => check(ex.requiredFactIds, ex.requiredCaseIds, `example ${i}`));
      bp.sections.quiz.forEach((q, i) => check(q.requiredFactIds, q.caseCueIds, `quiz ${i}`));
      bp.sections.cards.forEach((c, i) => check(c.requiredFactIds, c.caseCueIds, `card ${i}`));
    });
  }
});

test("R-062/R-119: a quiz or card case cue is only dealt when the slot's fact is genuinely LINKED to that case", () => {
  for (const bookId of BOOK_IDS) {
    const { blueprints, packets } = compileBook(bookId, 6);
    blueprints.forEach((bp, idx) => {
      const packet = packets[idx];
      for (const [where, slots] of [["quiz", bp.sections.quiz], ["card", bp.sections.cards]] as const) {
        slots.forEach((slot: { requiredFactIds: string[]; caseCueIds: string[] }, i: number) => {
          if (slot.caseCueIds.length === 0) return;
          const scored = scoredCaseIdsForFact(packet, slot.requiredFactIds[0], 0);
          assert.ok(
            scored[0].score >= CASE_LINKAGE_MIN_SCORE,
            `${bookId} ch${bp.chapterNumber} ${where} ${i}: a case cue was dealt for a fact whose best case scores ${scored[0]?.score} — below the ${CASE_LINKAGE_MIN_SCORE} linkage floor, so SEC56 would force an unrelated case into the stem`,
          );
        });
      }
    });
  }
});

test("R-119/R-125: no single case is cued by more than two learning units (quiz + cards) in a chapter", () => {
  for (const bookId of BOOK_IDS) {
    for (const C of CHAPTER_COUNTS) {
      const { blueprints } = compileBook(bookId, C);
      for (const bp of blueprints) {
        const counts = new Map<string, number>();
        for (const slot of [...bp.sections.quiz, ...bp.sections.cards]) {
          for (const id of slot.caseCueIds) counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        for (const [id, c] of counts) {
          assert.ok(c <= 2, `${bookId} ch${bp.chapterNumber}: case ${id} is cued by ${c} learning units; the cap is 2`);
        }
      }
    }
  }
});

test("R-125: card case cues never collapse onto two book-wide offsets when the packet has an EVEN number of cases", () => {
  // The old stride was (n*2 + i) % |cases|: with |cases| even it takes only even residues.
  const bookId = "zz-deal-even-cases";
  const built = compileBook(bookId, 12);
  // Force an even case count by dropping one case from each packet and recompiling.
  const blueprints = built.packets.map((packet, idx) => {
    const trimmed: SourcePacketV1 = { ...packet, namedCases: packet.namedCases.slice(0, 4) };
    return compileChapterBlueprint({ bookId, chapter: chapterSpec(bookId, idx + 1), packet: trimmed, packetPath: `/tmp/${bookId}.json`, totalChapters: 12 });
  });
  // Case ids are chapter-namespaced, so compare the case KIND (the suffix) across chapters.
  // The old stride `(n*2 + i) % 4` pins a fixed card slot to two kinds for the whole book.
  const kind = (id: string): string => id.replace(/^ch\d+\.case\./, "");
  const columns = Array.from({ length: 7 }, (_, slot) => blueprints.map((bp) => bp.sections.cards[slot].caseCueIds.map(kind)[0]).filter((v): v is string => !!v));
  const cued = columns.filter((col) => col.length >= 6);
  assert.ok(cued.length >= 3, `expected at least three card slots to carry cues across the book, got ${cued.length}`);
  for (const col of cued) {
    assert.ok(new Set(col).size >= 3, `a card slot reaches only ${new Set(col).size} distinct case kind(s) over ${col.length} cued chapters: ${col.join(",")}`);
  }
  const allKinds = new Set(columns.flat());
  assert.ok(allKinds.size >= 4, `card cues reach only ${allKinds.size} of the packet's 4 cases book-wide: ${[...allKinds].join(", ")}`);
});

// ── R-126 / R-127 — fact routing spreads, and covers ───────────────────────────────

test("R-127: every teaching fact reaches at least one learning unit (example, quiz or card) in its chapter", () => {
  for (const bookId of BOOK_IDS) {
    for (const C of [4, 12]) {
      const { blueprints, packets } = compileBook(bookId, C);
      blueprints.forEach((bp, idx) => {
        const packet = packets[idx];
        const teaching = packet.facts.filter((f) => !f.bookWideDuplicate).map((f) => f.id);
        const used = new Set<string>([
          ...bp.sections.examples.flatMap((e) => e.requiredFactIds),
          ...bp.sections.quiz.flatMap((q) => q.requiredFactIds),
          ...bp.sections.cards.flatMap((c) => c.requiredFactIds),
        ]);
        const orphans = teaching.filter((id) => !used.has(id));
        assert.deepEqual(orphans, [], `${bookId} ch${bp.chapterNumber}: teaching facts reach no learning unit: ${orphans.join(", ")}`);
      });
    }
  }
});

test("R-127: card fact routing varies by chapter — card slot i does not teach the same rank in every chapter", () => {
  for (const bookId of BOOK_IDS) {
    const { blueprints } = compileBook(bookId, 9);
    // Compare the *rank position* dealt to a fixed card slot across chapters: the old dealer
    // was `ids[i % ids.length]` with no chapter term, so the suffix was constant per slot.
    for (let slot = 0; slot < 7; slot++) {
      const suffixes = new Set(blueprints.map((bp) => (bp.sections.cards[slot].requiredFactIds[0] ?? "").replace(/^ch\d+\./, "")));
      assert.ok(suffixes.size > 1, `${bookId}: card slot ${slot} teaches the identical fact position in all 9 chapters (${[...suffixes].join(", ")})`);
    }
  }
});

test("R-126: the action step and the summaries spine do not key the identical fact triple", () => {
  for (const bookId of BOOK_IDS) {
    const { blueprints } = compileBook(bookId, 9);
    for (const bp of blueprints) {
      assert.notDeepEqual(
        bp.sections.action.requiredFactIds,
        bp.sections.summaries.requiredFactIds,
        `${bookId} ch${bp.chapterNumber}: action and summaries mandate the same fact triple`,
      );
    }
  }
});

// ── R-102 / R-104 — per-chapter permutation, not a marching rotation ───────────────

test("R-102: consecutive chapters are not index-rotations of one another for any positional pool", () => {
  const isRotation = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length || a.length < 3) return false;
    for (let k = 1; k < a.length; k++) {
      if (a.every((v, i) => v === b[(i + k) % b.length])) return true;
    }
    return false;
  };
  for (const bookId of BOOK_IDS) {
    const { blueprints } = compileBook(bookId, 9);
    for (const d of POSITIONAL_DEALS) {
      if (d.slots < 3) continue;
      for (let n = 1; n < blueprints.length; n++) {
        const a = d.extract(blueprints[n - 1]);
        const b = d.extract(blueprints[n]);
        assert.ok(!isRotation(a, b), `${bookId} ${d.poolKey}: ch${n + 1} is ch${n}'s list rotated — the deal is still a marching shift`);
      }
    }
  }
});

test("R-104: example formats are not the identical six-format sequence in every chapter", () => {
  for (const bookId of BOOK_IDS) {
    const { blueprints } = compileBook(bookId, 9);
    const sequences = new Set(blueprints.map((bp) => bp.plan.exampleSpecs.map((s) => s.format).join("|")));
    assert.ok(sequences.size > 1, `${bookId}: all 9 chapters ship the identical example-format sequence`);
    for (const bp of blueprints) {
      const formats = bp.plan.exampleSpecs.map((s) => s.format);
      assert.equal(new Set(formats).size, formats.length, `${bookId} ch${bp.chapterNumber}: example formats repeat inside one chapter (BPV3 blocks this)`);
    }
  }
});

test("R-104/R-128: exampleFormat is registered in POSITIONAL_DEALS so BPV11 audits it", () => {
  const keys = POSITIONAL_DEALS.map((d) => d.poolKey);
  for (const key of ["exampleFormat", "examplePurpose", "exampleSceneMode", "cardFact", "quizCaseCue", "cardCaseCue", "hookShapeSection", "sceneMechanism", "reservedSceneMode"]) {
    assert.ok(keys.includes(key), `POSITIONAL_DEALS is missing "${key}" — BPV11 cannot see it`);
  }
});

test("BPV11 stays clean under the redesigned deal for many books x chapter counts", () => {
  for (const bookId of BOOK_IDS) {
    for (const C of CHAPTER_COUNTS) {
      const { blueprints } = compileBook(bookId, C);
      const blockers = checkPositionalDeals(blueprints).filter((f) => f.checkId === "BPV11.positional_collision");
      assert.deepEqual(blockers, [], `${bookId} (${C} chapters): ${JSON.stringify(blockers.map((b) => b.message))}`);
      for (const bp of blueprints) {
        const blueprintBlockers = validateBlueprint(bp).filter((f) => f.severity === "blocker");
        assert.deepEqual(blueprintBlockers, [], `${bookId} ch${bp.chapterNumber}: ${JSON.stringify(blueprintBlockers)}`);
      }
    }
  }
});

// ── R-120 / R-114 — the name window ────────────────────────────────────────────────

test("R-120: no name is dealt to two example slots in one chapter, and chapters never share a name", () => {
  for (const bookId of BOOK_IDS) {
    for (const C of CHAPTER_COUNTS) {
      const { blueprints } = compileBook(bookId, C);
      const seenByChapter = new Map<string, number>();
      for (const bp of blueprints) {
        const dealt = bp.sections.examples.flatMap((e) => e.allowedNames);
        assert.equal(new Set(dealt).size, dealt.length, `${bookId} ch${bp.chapterNumber}: a name plays two example slots (${dealt.join(", ")})`);
        for (const name of new Set(dealt)) {
          const prior = seenByChapter.get(name);
          assert.equal(prior, undefined, `${bookId}: name "${name}" is dealt to both ch${prior} and ch${bp.chapterNumber}`);
          seenByChapter.set(name, bp.chapterNumber);
        }
      }
    }
  }
});

test("R-114: forbiddenNames never contradicts a name this chapter (or any sibling) was actually dealt", () => {
  for (const bookId of BOOK_IDS) {
    const { blueprints } = compileBook(bookId, 12);
    const dealtByChapter = new Map<number, Set<string>>(blueprints.map((bp) => [bp.chapterNumber, new Set(bp.reservedVariety.allowedNames)]));
    for (const bp of blueprints) {
      for (const forbidden of bp.reservedVariety.forbiddenNames) {
        assert.ok(!dealtByChapter.get(bp.chapterNumber)!.has(forbidden), `${bookId} ch${bp.chapterNumber} forbids "${forbidden}" and also deals it`);
        for (const [n, names] of dealtByChapter) {
          assert.ok(!names.has(forbidden), `${bookId} ch${bp.chapterNumber} forbids "${forbidden}" but ch${n} is dealt it — the guidance contradicts the book's own later deals`);
        }
      }
    }
  }
});

// ── R-113 — forbiddenVenues ─────────────────────────────────────────────────────────

test("R-113: forbiddenVenues never lists a venue this chapter's own palette carries, and is not the same list book-wide", () => {
  for (const bookId of BOOK_IDS) {
    const { blueprints } = compileBook(bookId, 9);
    const lists = new Set<string>();
    for (const bp of blueprints) {
      const palette = new Set(bp.reservedVariety.venuePalette);
      for (const ex of bp.sections.examples) {
        for (const v of ex.forbiddenVenues) {
          assert.ok(!palette.has(v), `${bookId} ch${bp.chapterNumber}: forbids "${v}" while dealing it in the same chapter's palette`);
        }
        lists.add(ex.forbiddenVenues.join("|"));
      }
    }
    assert.ok(lists.size > 1, `${bookId}: every chapter carries the identical forbiddenVenues list`);
  }
});

// ── R-111 — the plan domain is a venue, not a concatenated staging string ───────────

test("R-111: plan.exampleSpecs[].domain is exactly the slot's venue (no ': ' / '; ' concatenation)", () => {
  for (const bookId of BOOK_IDS) {
    const { blueprints } = compileBook(bookId, 5);
    for (const bp of blueprints) {
      bp.plan.exampleSpecs.forEach((spec, i) => {
        assert.equal(spec.domain, bp.sections.examples[i].venue, `${bookId} ch${bp.chapterNumber} ex${i}: domain must be the venue alone`);
        assert.ok(!spec.domain.includes("; "), `${bookId} ch${bp.chapterNumber} ex${i}: domain still concatenates the scene fields`);
      });
    }
  }
});

// ── R-118 — one hook-shape deal ─────────────────────────────────────────────────────

test("R-118: sections.hook.shape is the dealt reservedVariety.hookShape (no competing binary)", () => {
  for (const bookId of BOOK_IDS) {
    const { blueprints } = compileBook(bookId, 9);
    for (const bp of blueprints) {
      assert.equal(bp.sections.hook.shape, bp.reservedVariety.hookShape, `${bookId} ch${bp.chapterNumber}: two hook shapes disagree`);
    }
    const shapes = new Set(blueprints.map((bp) => bp.sections.hook.shape));
    assert.ok(shapes.size > 2, `${bookId}: hook shapes collapse to ${shapes.size} values book-wide`);
  }
});

// ── R-117 — one scene taxonomy ──────────────────────────────────────────────────────

test("R-117: sceneMechanism and sceneMode are drawn from DIFFERENT vocabularies", () => {
  for (const bookId of BOOK_IDS) {
    const { blueprints } = compileBook(bookId, 9);
    const mechanisms = new Set(blueprints.map((bp) => bp.reservedVariety.sceneMechanism));
    const modes = new Set(blueprints.map((bp) => bp.reservedVariety.sceneMode));
    for (const m of mechanisms) {
      assert.ok(!modes.has(m), `${bookId}: "${m}" is dealt as both a sceneMechanism and a sceneMode — one list, two labels`);
    }
  }
});

// ── determinism ─────────────────────────────────────────────────────────────────────

test("the redesigned deal is still deterministic: a twice-compiled book is byte-identical", () => {
  for (const bookId of BOOK_IDS.slice(0, 2)) {
    assert.deepEqual(compileBook(bookId, 7).blueprints, compileBook(bookId, 7).blueprints);
  }
});

test("rankedCaseIdsForFact and scoredCaseIdsForFact agree on order", () => {
  const { packets } = compileBook("zz-deal-alpha", 1);
  const packet = packets[0];
  for (const fact of packet.facts) {
    assert.deepEqual(scoredCaseIdsForFact(packet, fact.id, 0).map((s) => s.id), rankedCaseIdsForFact(packet, fact.id, 0));
  }
});

// ── R-116 — the sentence-initial filter on properNounTokens ─────────────────────────

test("R-116: a capitalized word that only ever opens a sentence is not a proper noun", () => {
  assert.deepEqual(properNounTokens("Readers treat the story as decoration. Environments can be redesigned."), []);
  assert.deepEqual(properNounTokens("Repetition builds myelin so retrieval becomes faster."), []);
});

test("R-116: a real proper noun survives even when it opens a sentence", () => {
  // First word of the run is grammar, the rest is the name.
  assert.ok(properNounTokens("Readers treat it as decoration. Then Franklin ruled the page.").includes("Franklin"));
  // …and a name that recurs mid-sentence is kept outright.
  assert.ok(properNounTokens("Franklin ruled the page. The clerk handed Franklin the ledger.").includes("Franklin"));
});

test("R-116: mid-sentence proper nouns are untouched", () => {
  const out = properNounTokens("The club met at Philadelphia every Friday with Deborah Read.");
  assert.ok(out.some((t) => t.includes("Philadelphia")), out.join(" | "));
  assert.ok(out.some((t) => t.includes("Deborah")), out.join(" | "));
});

// ── R-065 / R-103 / R-105 — per-chapter derivation and the memoir genre ──────────────

test("R-065: derived staging is chapter-keyed and the book-wide pools carry no mined material", () => {
  const { packets } = compileBook("zz-deal-derived", 4);
  const design = deriveBookDesign("zz-deal-derived", { packets, chapters: 4 });
  const minedFragments = new Set(Object.values(design.perChapter ?? {}).flatMap((d) => d.topics));
  assert.ok(minedFragments.size > 0, "the fixture packets must yield some mined topics or this proves nothing");
  for (const [key, pool] of Object.entries(design.pools)) {
    for (const entry of pool as string[]) {
      for (const topic of minedFragments) {
        assert.ok(!entry.includes(topic), `pools.${key} carries mined topic "${topic}" — a book-wide pool is dealt positionally, so that lands in another chapter`);
      }
    }
  }
});

test("R-065: a chapter only ever receives its OWN mined staging", () => {
  const { packets } = compileBook("zz-deal-derived", 4);
  const design = deriveBookDesign("zz-deal-derived", { packets, chapters: 4 });
  for (const [chapterKey, derived] of Object.entries(design.perChapter ?? {})) {
    const own = new Set(packets[Number(chapterKey) - 1].namedCases.flatMap((c) => c.hardSpecifics.map((h) => h.toLowerCase())));
    for (const topic of derived.topics) {
      assert.ok([...own].some((h) => h.includes(topic)), `ch${chapterKey} derived topic "${topic}" is not in its own packet's hardSpecifics`);
    }
  }
});

test("R-103: mined topics are ranked by teaching value, not alphabetically", () => {
  // A packet whose BEST-taught case is alphabetically LAST. The old `minedTopics` ended in
  // `.sort()`, so it would return "age twelve" first; the rank must return the specific from the
  // case the chapter's top-priority fact is linked to.
  const packet = compileSourcePacketFromSidecar({
    bookId: "zz-deal-rank",
    chapter: chapterSpec("zz-deal-rank", 1),
    sidecar: {
      schemaVersion: "source-v2",
      chapterNumber: 1,
      chapterTitle: "Ranking",
      centralConcept: { id: "c", name: "Ranking", plainDefinition: "d.", whyItMatters: "w." },
      keyClaims: [],
      namedExamples: [
        { id: "ch1.case.aardvark", label: "Aardvark note", summary: "An aardvark note nobody teaches from.", teachesWhat: "nothing much", hardSpecifics: ["age twelve"], realWorld: true },
        { id: "ch1.case.zephyr", label: "Zephyr subscription", summary: "The zephyr subscription library lending shelves catalogue readers borrowing.", teachesWhat: "the lever", hardSpecifics: ["subscription library"], realWorld: true },
      ],
      hardEdge: "h",
      paraphraseNotes: "p",
      testableFacts: Array.from({ length: 9 }, (_, i) => ({
        id: `ch1.fact.${i + 1}`,
        claim: `The zephyr subscription library lending shelves changed who could read ${i + 1}.`,
        becauseMechanism: `Because the subscription library catalogue readers borrowing shelves pooled the cost ${i + 1}.`,
        commonError: `Readers treat the library as charity ${i + 1}.`,
        errorIsWhy: `The lending shelves catalogue readers borrowing is the mechanism ${i + 1}.`,
      })),
      frameworks: [{ name: "f", members: ["a", "b"] }],
    } as SourceSidecarV2,
    sidecarPath: "/tmp/x",
    sourceHash: "h",
  });
  const ranked = rankedTopicsForPacket(packet, 4);
  assert.ok(ranked.length > 0, "the fixture must yield mined topics");
  assert.equal(ranked[0], "subscription library", `the best-taught specific must lead; got ${ranked.join(" | ")}`);
  assert.ok(ranked.indexOf("age twelve") > 0 || !ranked.includes("age twelve"), "the alphabetically-first, untaught specific must not lead");
});

test("R-105: the memoir-history genre exists, is period-neutral, and Franklin resolves to it", () => {
  assert.equal(genreForBook("the-autobiography-of-benjamin-franklin"), "memoir-history", "the books.json entry must route Franklin to the memoir genre");
  const pools = buildGenrePools("memoir-history", 8);
  const contemporary = /\b(kitchen table|shared calendar invite|sticky note on the fridge|reminder on a phone|text thread|budget app|spreadsheet|dashboard|slack|email)\b/i;
  const leaked = pools.venues.filter((v) => contemporary.test(v));
  assert.deepEqual(leaked, [], `memoir-history venues must be period-neutral; leaked: ${leaked.join(", ")}`);
  const findings = validateBookDesign({ schemaVersion: "book-design-v1", bookId: "x", genre: "memoir-history", pools, provenance: { source: "genre-fallback" } }, 8);
  assert.deepEqual(findings.filter((f) => f.severity === "blocker"), [], "the memoir-history pools must pass the BD gate");
});

test("R-105: a books.json `genre` field is honoured without a categories entry", () => {
  assert.equal(genreForBook("zz-not-in-books-json"), "generic");
  assert.equal(genreForBook("zz-anything", { genre: "memoir-history" }), "memoir-history");
});

// ── R-106 / R-107 / R-108 — the gates that now run and are enforced ──────────────────

test("R-108: BPV9/BPV10 catch an unknown fact or case id in a QUIZ or CARD slot, not only in examples", () => {
  const { blueprints } = compileBook("zz-deal-alpha", 1);
  const bp = JSON.parse(JSON.stringify(blueprints[0])) as ChapterBlueprintV1;
  assert.deepEqual(validateBlueprint(bp).filter((f) => f.severity === "blocker"), []);

  const withBadQuizFact = JSON.parse(JSON.stringify(bp)) as ChapterBlueprintV1;
  withBadQuizFact.sections.quiz[0].requiredFactIds = ["ch99.fact.999"];
  assert.ok(validateBlueprint(withBadQuizFact).some((f) => f.checkId === "BPV9.unknown_fact" && f.severity === "blocker" && /quiz slot 0/.test(f.message)));

  const withBadCardCue = JSON.parse(JSON.stringify(bp)) as ChapterBlueprintV1;
  withBadCardCue.sections.cards[2].caseCueIds = ["ch99.case.nope"];
  assert.ok(validateBlueprint(withBadCardCue).some((f) => f.checkId === "BPV10.unknown_case" && f.severity === "blocker" && /card slot 2/.test(f.message)));

  const withBadActionFact = JSON.parse(JSON.stringify(bp)) as ChapterBlueprintV1;
  withBadActionFact.sections.action.requiredFactIds = ["ch99.fact.1"];
  assert.ok(validateBlueprint(withBadActionFact).some((f) => f.checkId === "BPV9.unknown_fact" && /action step/.test(f.message)));
});

test("BPV14: an over-cued case raises an advisory and never a blocker", () => {
  const { blueprints } = compileBook("zz-deal-alpha", 1);
  const bp = JSON.parse(JSON.stringify(blueprints[0])) as ChapterBlueprintV1;
  const oneCase = bp.constraints.allowedCaseIds[0];
  for (const q of bp.sections.quiz) q.caseCueIds = [oneCase];
  const findings = validateBlueprint(bp);
  const bpv14 = findings.find((f) => f.checkId === "BPV14.case_cue_multiplicity");
  assert.ok(bpv14, "nine quiz slots cueing one case must raise BPV14");
  assert.equal(bpv14!.severity, "advisory", "BPV14 must never block a run");
  assert.deepEqual(findings.filter((f) => f.severity === "blocker"), [], "over-cueing is an advisory, not a compile failure");
});

test("BPV13: a content-driven column stuck on one value raises an advisory (the R-127 shape), and never blocks", () => {
  const { blueprints } = compileBook("zz-deal-alpha", 9);
  assert.deepEqual(
    checkPositionalDeals(blueprints).filter((f) => f.checkId === "BPV13.content_column_concentration"),
    [],
    "the redesigned deal must not trip BPV13 on a healthy book",
  );
  // Re-create the old rank-pinned card dealer EXACTLY: card slot i teaches rank-i fact in every
  // chapter of the book, so each column is pinned to a single value.
  const pinned = blueprints.map((bp) => {
    const clone: ChapterBlueprintV1 = JSON.parse(JSON.stringify(bp));
    clone.sections.cards = clone.sections.cards.map((c, i) => ({ ...c, requiredFactIds: [`fact.rank.${i}`] }));
    return clone;
  });
  const pinnedFindings = checkPositionalDeals(pinned).filter((f) => f.checkId === "BPV13.content_column_concentration");
  assert.equal(pinnedFindings.length, 7, `all seven pinned card columns must raise BPV13; got ${pinnedFindings.length}`);
  assert.ok(pinnedFindings.every((f) => f.severity === "advisory"), "BPV13 must never block a run");
  assert.ok(pinnedFindings.every((f) => /pinned to the single value/.test(f.message)), pinnedFindings.map((f) => f.message).join("\n"));

  // And the softer shape: two distinct values, one taking more than an even spread would give.
  const lopsided = blueprints.map((bp, idx) => {
    const clone: ChapterBlueprintV1 = JSON.parse(JSON.stringify(bp));
    clone.sections.cards[0].requiredFactIds = [idx === 0 ? "fact.rare" : "fact.common"];
    return clone;
  });
  const lopsidedFindings = checkPositionalDeals(lopsided).filter((f) => f.checkId === "BPV13.content_column_concentration" && f.path === "/positional/cardFact/0");
  assert.equal(lopsidedFindings.length, 1, "an 8-of-9 column over 2 observed values must raise BPV13");
  assert.equal(lopsidedFindings[0].severity, "advisory");
});

// ── the disk-backed compile: derived staging and neighbour casts only exist with roots ─────
//
// Every helper above compiles with NO roots, so `pools.chapterDerived(n)` is always null and
// `siblingUsedNames` always empty — the two code paths R-065 and R-114 are ABOUT. This one
// materializes the book the way the pipeline does (chapter index + source packets + the design
// artifact) so those paths are actually exercised.
function withBookOnDisk<T>(
  bookId: string,
  totalChapters: number,
  fn: (ctx: { blueprints: ChapterBlueprintV1[]; packets: SourcePacketV1[]; roots: CompilerStoreRoots; design: BookDesignV1 }) => T,
  sidecarFor: (n: number) => SourceSidecarV2 = (n) => sidecar(n, `Chapter ${n}`),
): T {
  const stateRoot = resolve(tmpdir(), `cf-dealing-ondisk-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const roots: CompilerStoreRoots = { stateRoot };
  try {
    const specs = Array.from({ length: totalChapters }, (_, i) => chapterSpec(bookId, i + 1));
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", `${bookId}.json`), specs);
    const packets = specs.map((spec) =>
      compileSourcePacketFromSidecar({
        bookId,
        chapter: spec,
        sidecar: sidecarFor(spec.chapterNumber),
        sidecarPath: `/tmp/${bookId}-ch${spec.chapterNumber}.source.json`,
        sourceHash: `hash${spec.chapterNumber}`,
      }),
    );
    for (const packet of packets) writeJsonFile(sourcePacketPath(bookId, packet.chapterNumber, roots), packet);
    const design = deriveBookDesign(bookId, { roots });
    writeJsonFile(bookDesignPath(bookId, roots), design);
    const blueprints = specs.map((spec, i) =>
      compileChapterBlueprint({ bookId, chapter: spec, packet: packets[i], packetPath: sourcePacketPath(bookId, spec.chapterNumber, roots), roots, totalChapters }),
    );
    return fn({ blueprints, packets, roots, design });
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
}

// ── R-065 / R-106 — derived staging is CONTENT, and content may legitimately repeat ─────────

test("R-065/R-106: a mined specific two chapters share is not a BPV11 blocker — it is reported as content", () => {
  // The fixture's hardSpecifics carry no chapter term, so every chapter's best-taught specific is
  // the SAME phrase — the "recurring institution" case (a memoir whose junto club runs through
  // half the book). The derived staging then puts one byte-identical string in example slot 0,
  // slot 1 and the practice constraint of every chapter.
  withBookOnDisk("zz-deal-derived-collision", 12, ({ blueprints, roots, design }) => {
    const derived = design.perChapter?.["1"];
    assert.ok(derived?.frameDecision, "the fixture must produce derived staging or this proves nothing");
    assert.equal(blueprints[0].sections.examples[0].sceneFrame, derived!.frameDecision, "slot 0 must carry the chapter's own derived frame");
    assert.equal(
      blueprints.filter((bp) => bp.sections.examples[0].sceneFrame === blueprints[0].sections.examples[0].sceneFrame).length >= 2,
      true,
      "the fixture must give at least two chapters the identical derived frame",
    );
    const pools = resolvedPoolsForBook("zz-deal-derived-collision", roots);
    const findings = checkPositionalDeals(blueprints, poolSizeOverrides(pools), pools.chapterDerived);
    const blockers = findings.filter((f) => f.severity === "blocker");
    assert.deepEqual(blockers, [], `a book whose chapters share a mined specific must still compile: ${JSON.stringify(blockers.map((b) => b.message))}`);
    // …but the repetition is still SEEN: the derived column is audited as content (advisory).
    const advisory = findings.find((f) => f.checkId === "BPV13.content_column_concentration" && f.path === "/positional/exampleSceneFrame/0");
    assert.ok(advisory, `the shared derived staging must still be reported: ${JSON.stringify(findings.map((f) => f.checkId + " " + f.path))}`);
    assert.equal(advisory!.severity, "advisory");
  });
});

test("R-065/R-106: a POOL-dealt frame colliding at the same slot is still a BPV11 blocker", () => {
  // The exemption is scoped to the value the chapter's own design derived. A hand-edited (or
  // regressed) blueprint that repeats a GENRE-POOL frame at a fixed slot must still block —
  // otherwise the fix would have turned BPV11 off for the column instead of narrowing it.
  withBookOnDisk("zz-deal-derived-collision", 12, ({ blueprints, roots }) => {
    const pools = resolvedPoolsForBook("zz-deal-derived-collision", roots);
    const tampered = blueprints.map((bp) => {
      const clone: ChapterBlueprintV1 = JSON.parse(JSON.stringify(bp));
      clone.sections.examples[2].sceneFrame = pools.sceneFramesDecision[0];
      return clone;
    });
    const blockers = checkPositionalDeals(tampered, poolSizeOverrides(pools), pools.chapterDerived)
      .filter((f) => f.checkId === "BPV11.positional_collision" && f.path === "/positional/exampleSceneFrame/2");
    assert.equal(blockers.length, 1, "a pool value repeated at a fixed non-derived slot must still block");
  });
});

test("R-065: two chapters with a spare mined specific do not get the identical staging", () => {
  // Where the material offers an alternative, the deriver takes it: chapter B's frame falls to its
  // OWN second-ranked specific rather than repeating chapter A's phrase. (Still chapter-local —
  // only the CHOICE among this chapter's own topics is coordinated, never another chapter's token.)
  const shared = "the junto club minutes";
  const spare = (n: number) => `the ledger page from year ${n}`;
  const sidecarFor = (n: number): SourceSidecarV2 => {
    const base = sidecar(n, `Chapter ${n}`);
    return {
      ...base,
      namedExamples: base.namedExamples.map((c, i) => (i === 0 ? { ...c, hardSpecifics: [shared, spare(n)] } : c)),
    };
  };
  withBookOnDisk("zz-deal-derived-spare", 4, ({ design }) => {
    const frames = Object.values(design.perChapter ?? {}).map((d) => d.frameDecision).filter(Boolean);
    assert.ok(frames.length >= 2, "the fixture must derive a frame for at least two chapters");
    assert.equal(new Set(frames).size, frames.length, `chapters repeat a derived frame while a spare specific was available: ${frames.join(" | ")}`);
  }, sidecarFor);
});
