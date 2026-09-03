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

import { test } from "./harness.js";
import { compileSourcePacketFromSidecar } from "../src/compiler/sourcePacket.js";
import { compileChapterBlueprint, POSITIONAL_DEALS } from "../src/compiler/chapterBlueprint.js";
import { checkPositionalDeals, validateBlueprint } from "../src/compiler/blueprintGate.js";
import { rankedCaseIdsForFact, scoredCaseIdsForFact, CASE_LINKAGE_MIN_SCORE } from "../src/compiler/sourcePacketFacts.js";
import type { ChapterBlueprintV1, SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
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
