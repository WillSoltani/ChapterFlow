/**
 * chapterBlueprint.ts's answerPattern() dealer used to dedup only the FULL
 * 9-value correctIndex sequence, but final QC's BP14 (bookPatternAudit.ts)
 * blocks on TWO rules: (a) an identical full sequence across chapters, AND
 * (b) >=60% of chapters sharing the same Q1-Q5 prefix. The dealer never
 * constrained the prefix, so a book could pass blueprint-gate + section-gate
 * (which HARD-PINS correctIndex once dealt — a repair agent cannot change it)
 * and then fail final BP14 with no in-loop escape.
 *
 * Before this fix, compileChapterBlueprint() had no `totalChapters` parameter
 * at all, so there was no way for the dealer to know the book's real size and
 * cap prefix reuse against BP14's percentage rule — passing `totalChapters`
 * below is a compile error against the pre-fix signature.
 */
import assert from "node:assert/strict";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import { compileSourcePacketFromSidecar } from "../src/compiler/sourcePacket.js";
import { compileChapterBlueprint, maxSharedPrefixCount } from "../src/compiler/chapterBlueprint.js";
import { runBookPatternAudit } from "../src/critics/bookPatternAudit.js";
import type { ChapterSpec } from "../src/generateChapter.js";
import type { SourceSidecarV2 } from "../src/source/sidecarSchema.js";

const BOOK = "zz-fixture-bp14-prefix";

function sidecar(chapterNumber: number, title: string): SourceSidecarV2 {
  const facts = Array.from({ length: 9 }, (_, i) => ({
    id: `ch${chapterNumber}.fact.${i + 1}`,
    claim: `Test claim ${i + 1} for ${title}.`,
    becauseMechanism: `Because mechanism ${i + 1} explains ${title} concretely.`,
    commonError: `Common error ${i + 1}.`,
    errorIsWhy: `Why that error is wrong ${i + 1}.`,
  }));
  return {
    schemaVersion: "source-v2",
    chapterNumber,
    chapterTitle: title,
    centralConcept: { id: `ch${chapterNumber}.concept`, name: title, plainDefinition: `${title} definition.`, whyItMatters: `${title} matters to the reader.` },
    keyClaims: facts.map((f) => f.claim),
    namedExamples: [
      { id: `ch${chapterNumber}.case.a`, label: "Case A", summary: "Case A summary with enough detail to be usable as a grounded source case.", teachesWhat: "Teaches A.", hardSpecifics: ["specific A1", "specific A2"], realWorld: true },
      { id: `ch${chapterNumber}.case.b`, label: "Case B", summary: "Case B summary with enough detail to be usable as a grounded source case.", teachesWhat: "Teaches B.", hardSpecifics: ["specific B1", "specific B2"], realWorld: true },
    ],
    hardEdge: "Do not overclaim the mechanism.",
    paraphraseNotes: "Keep claims bounded to the tested facts.",
    testableFacts: facts,
    frameworks: [{ name: "Test framework", members: ["a", "b"] }],
  };
}

function chapterSpec(n: number, title: string): ChapterSpec {
  return { chapterId: `${BOOK}-ch${String(n).padStart(2, "0")}`, chapterNumber: n, chapterTitle: title };
}

/** Deals a full book's worth of answerIndexPatterns via the real production
 *  code path (compileChapterBlueprint with totalChapters set). */
function dealtPatternsForBook(totalChapters: number): number[][] {
  const patterns: number[][] = [];
  for (let n = 1; n <= totalChapters; n++) {
    const spec = chapterSpec(n, `Chapter ${n}`);
    const packet = compileSourcePacketFromSidecar({
      bookId: BOOK,
      chapter: spec,
      sidecar: sidecar(n, spec.chapterTitle),
      sidecarPath: `/tmp/${BOOK}-ch${n}.source.json`,
      sourceHash: `hash${n}`,
    });
    const bp = compileChapterBlueprint({
      bookId: BOOK,
      chapter: spec,
      packet,
      packetPath: `/tmp/${BOOK}-ch${n}.source-packet.json`,
      totalChapters,
    });
    patterns.push(bp.reservedVariety.answerIndexPattern);
  }
  return patterns;
}

test("maxSharedPrefixCount matches BP14's exact count>=3 && count/total>=0.6 rule", () => {
  // Below BP14's >=3-chapter floor, the prefix rule can never fire.
  assert.equal(maxSharedPrefixCount(2), Infinity);
  // total=3: 3 chapters sharing a prefix is already 100% >= 60% -> cap is 2.
  assert.equal(maxSharedPrefixCount(3), 2);
  // total=12: smallest unsafe count is 8 (8/12 = 0.667 >= 0.6) -> cap is 7.
  assert.equal(maxSharedPrefixCount(12), 7);
  // total=20: smallest unsafe count is 12 (12/20 = 0.6 exactly) -> cap is 11.
  assert.equal(maxSharedPrefixCount(20), 11);
});

for (const N of [12, 20]) {
  test(`v23 blueprint dealer's answerPatterns satisfy real BP14 audit for a ${N}-chapter book`, () => {
    const patterns = dealtPatternsForBook(N);

    // The dealer must actively enforce the cap, not just get lucky: no Q1-Q5
    // prefix may be dealt to more chapters than BP14's own rule tolerates.
    const cap = maxSharedPrefixCount(N);
    const prefixCounts = new Map<string, number>();
    for (const pattern of patterns) {
      const prefix = pattern.slice(0, 5).join(",");
      prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
    }
    for (const [prefix, count] of prefixCounts) {
      assert.ok(count <= cap, `Q1-Q5 prefix [${prefix}] dealt to ${count} of ${N} chapters, exceeds BP14-safe cap of ${cap}`);
    }

    // And the actual BP14 audit, run over real ChapterV21 quiz content built
    // from the dealt patterns, must report zero BP14 findings.
    const chapters = patterns.map((pattern, i) => {
      const n = i + 1;
      return makeChapter(BOOK, n, {
        overrides: {
          quiz: {
            passingScorePercent: 70,
            questions: pattern.map((correctIndex, qi) => ({
              questionId: `q${String(qi + 1).padStart(2, "0")}`,
              prompt: `Chapter ${n} quiz question ${qi + 1} asks about the core move in a concrete scenario.`,
              choices: [
                `Chapter ${n} option A for question ${qi + 1}`,
                `Chapter ${n} option B for question ${qi + 1}`,
                `Chapter ${n} option C for question ${qi + 1}`,
              ],
              correctIndex,
              explanation: `The correct choice for chapter ${n} question ${qi + 1} follows directly from the chapter's tested mechanism, not from surface wording.`,
              bloomsLevel: "apply" as const,
              depthLevel: "standard" as const,
            })),
          },
        },
      });
    });

    const report = runBookPatternAudit({ bookId: BOOK, chapters, requirePlanArtifacts: false, checkSourceAlignment: false });
    const bp14Findings = report.findings.filter((f) => f.code === "BP14");
    assert.deepEqual(bp14Findings, [], `expected zero BP14 findings for a ${N}-chapter book, got: ${JSON.stringify(bp14Findings, null, 2)}`);
  });
}
