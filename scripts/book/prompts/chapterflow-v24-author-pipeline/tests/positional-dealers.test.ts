/**
 * P11 — positional dealer. dealPositional() generalizes answerPattern's
 * alignment-by-construction to EVERY positional blueprint shape, so a fixed
 * chapter position (q01 promptShape, example slot-0 sceneFrame, hookShape, …)
 * never collides with a prior chapter's same position more than the pool size
 * makes unavoidable. Before this change, distractorTrap `(n*3+i)%9` gave only 3
 * distinct traps per position book-wide, experiential sceneFrame `(n*3+i*5)%12`
 * only 4, hookShape only 3, counterShape only 2 — the exact same-position
 * sameness AS5/AS6/AS8/AS9 and the scene_skeleton sweep then REVISE.
 *
 * These are property-style assertions over synthetic books of 5/12/34/40
 * chapters compiled through the real production path (compileChapterBlueprint).
 */
import assert from "node:assert/strict";

import { test } from "./harness.js";
import { compileSourcePacketFromSidecar } from "../src/compiler/sourcePacket.js";
import { compileChapterBlueprint, dealPositional, POSITIONAL_DEALS, type SlotSalts } from "../src/compiler/chapterBlueprint.js";
import { checkPositionalDeals } from "../src/compiler/blueprintGate.js";
import type { ChapterBlueprintV1 } from "../src/artifacts/artifactTypes.js";
import type { ChapterSpec } from "../src/generateChapter.js";
import type { SourceSidecarV2 } from "../src/source/sidecarSchema.js";

const BOOK = "zz-fixture-positional-dealers";

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

/** Compiles a whole book's blueprints via the real production code path. */
function compileBook(totalChapters: number, opts: { salts?: SlotSalts } = {}): ChapterBlueprintV1[] {
  const out: ChapterBlueprintV1[] = [];
  for (let n = 1; n <= totalChapters; n++) {
    const spec = chapterSpec(n, `Chapter ${n}`);
    const packet = compileSourcePacketFromSidecar({ bookId: BOOK, chapter: spec, sidecar: sidecar(n, spec.chapterTitle), sidecarPath: `/tmp/${BOOK}-ch${n}.source.json`, sourceHash: `hash${n}` });
    out.push(compileChapterBlueprint({ bookId: BOOK, chapter: spec, packet, packetPath: `/tmp/${BOOK}-ch${n}.source-packet.json`, totalChapters, salts: opts.salts ?? { chapters: {} } }));
  }
  return out;
}

const SIZES = [5, 12, 34, 40];

for (const N of SIZES) {
  test(`dealPositional: no avoidable same-position collisions in a ${N}-chapter book (checkPositionalDeals + direct)`, () => {
    const book = compileBook(N);

    // The book-level gate must report zero BPV11 blockers.
    const findings = checkPositionalDeals(book);
    const blockers = findings.filter((f) => f.checkId === "BPV11.positional_collision");
    assert.deepEqual(blockers, [], `expected zero BPV11 collisions for a ${N}-chapter book, got: ${JSON.stringify(blockers, null, 2)}`);

    // And directly: for each positional deal, at each slot, no value exceeds the
    // pool-size round-robin cap ceil(C / P) — i.e. no repeat until exhaustion.
    for (const d of POSITIONAL_DEALS) {
      const columns = book.map((bp) => d.extract(bp));
      for (let slot = 0; slot < d.slots; slot++) {
        const values = columns.map((c) => c[slot]).filter(Boolean);
        if (values.length === 0) continue;
        const P = d.poolSizeAt ? d.poolSizeAt(slot) : d.poolSize;
        const cap = Math.max(1, Math.ceil(values.length / P));
        const counts = new Map<string, number>();
        for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
        const worst = Math.max(...counts.values());
        assert.ok(worst <= cap, `${d.poolKey} slot ${slot}: a value repeats ${worst}x over ${values.length} chapters (pool ${P}, cap ${cap})`);
      }
    }
  });

  test(`dealPositional: within-chapter uniqueness for every poolKey in a ${N}-chapter book`, () => {
    const book = compileBook(N);
    for (const bp of book) {
      for (const d of POSITIONAL_DEALS) {
        const vals = d.extract(bp);
        // Even/odd example slots draw from disjoint pools; uniqueness is only
        // required within a pool. Split by parity for the parity-dealt fields.
        if (d.poolSizeAt) {
          const even = vals.filter((_, i) => i % 2 === 0);
          const odd = vals.filter((_, i) => i % 2 === 1);
          assert.equal(new Set(even).size, even.length, `ch${bp.chapterNumber} ${d.poolKey} even slots repeat: ${even.join(" | ")}`);
          assert.equal(new Set(odd).size, odd.length, `ch${bp.chapterNumber} ${d.poolKey} odd slots repeat: ${odd.join(" | ")}`);
        } else if (d.slots <= d.poolSize) {
          assert.equal(new Set(vals).size, vals.length, `ch${bp.chapterNumber} ${d.poolKey} slots repeat: ${vals.join(" | ")}`);
        }
      }
    }
  });
}

test("dealPositional: determinism — a twice-compiled book is byte-identical", () => {
  const a = compileBook(12);
  const b = compileBook(12);
  assert.deepEqual(a, b, "compiling the same book twice must be identical");
});

test("dealPositional: stable under totalChapters growth (property c) — already-dealt chapters do not shift", () => {
  const small = compileBook(12);
  const large = compileBook(40);
  for (let n = 1; n <= 12; n++) {
    // Every positional field for a chapter that exists in BOTH books must match:
    // the closed-form deal never consults totalChapters, so growth cannot shift it.
    const s = small[n - 1];
    const l = large[n - 1];
    for (const d of POSITIONAL_DEALS) {
      assert.deepEqual(d.extract(l), d.extract(s), `ch${n} ${d.poolKey} shifted when the book grew 12 -> 40`);
    }
  }
});

test("P10×P11: a per-chapter sidecar salt re-deals only its slot family, only in the salted chapter — and stays BPV11-clean", () => {
  const base = compileBook(12);
  // P10's repair lever: bump ch3's quizShapes salt (drives the quiz+card shape family).
  const salted = compileBook(12, { salts: { chapters: { "3": { quizShapes: 7 } } } });

  const promptOf = (bp: ChapterBlueprintV1) => bp.sections.quiz.map((q) => q.promptShape);
  const framesOf = (bp: ChapterBlueprintV1) => bp.sections.examples.map((e) => e.sceneFrame);

  // Ch3's quiz-shape family changes under the salt...
  assert.notDeepEqual(promptOf(salted[2]), promptOf(base[2]), "salt must change the salted chapter's promptShape deal");
  // ...but a DIFFERENT slot family in ch3 (exampleFrames) does not move...
  assert.deepEqual(framesOf(salted[2]), framesOf(base[2]), "a quizShapes salt must not disturb the example frames");
  // ...and no sibling chapter is disturbed at all (P10's pinned redeal contract).
  for (const n of [1, 2, 4, 12]) {
    assert.deepEqual(salted[n - 1], base[n - 1], `sibling ch${n} must be untouched by ch3's salt`);
  }
  // THE RECONCILIATION GUARANTEE: the salted chapter resolved through the sibling-replay scan,
  // so the re-deal cannot have created an avoidable same-position collision — the blueprint
  // gate's BPV11 blocker stays clean on the salted book (a naive rank shift fails this).
  const blockers = checkPositionalDeals(salted).filter((f) => f.checkId === "BPV11.positional_collision");
  assert.deepEqual(blockers, [], `salted book must stay BPV11-clean; got ${JSON.stringify(blockers.map((b) => b.message))}`);
  // And a heavier, multi-family salting across several chapters also stays clean.
  const heavy = compileBook(12, { salts: { chapters: { "2": { exampleFrames: 3 }, "3": { quizShapes: 7 }, "9": { quizShapes: 2, exampleFrames: 1 } } } });
  const heavyBlockers = checkPositionalDeals(heavy).filter((f) => f.checkId === "BPV11.positional_collision");
  assert.deepEqual(heavyBlockers, [], "multi-chapter multi-family salts must stay BPV11-clean");
});

test("dealPositional: 3+3 decision/experiential example parity is preserved (disjoint pools by slot parity)", () => {
  const book = compileBook(12);
  for (const bp of book) {
    const frames = bp.sections.examples.map((e) => e.sceneFrame);
    const beats = bp.sections.examples.map((e) => e.requiredBeat);
    for (const field of [frames, beats]) {
      const even = new Set(field.filter((_, i) => i % 2 === 0)); // decision pool
      const odd = new Set(field.filter((_, i) => i % 2 === 1));  // experiential pool
      assert.equal(even.size, 3, `ch${bp.chapterNumber}: expected 3 distinct decision-slot values`);
      assert.equal(odd.size, 3, `ch${bp.chapterNumber}: expected 3 distinct experiential-slot values`);
      for (const v of even) assert.ok(!odd.has(v), `ch${bp.chapterNumber}: decision value "${v}" also appears in an experiential slot — parity broken`);
    }
  }
});

test("dealPositional: hookShape uses >=9 distinct shapes over 12 chapters, repeats maximally spaced", () => {
  const book = compileBook(12);
  const hooks = book.map((bp) => bp.reservedVariety.hookShape);
  const distinct = new Set(hooks);
  // 9-shape pool over 12 chapters: exactly 9 distinct, 3 shapes used twice.
  assert.ok(distinct.size >= 9, `expected >=9 distinct hookShapes over 12 chapters, got ${distinct.size}: ${[...distinct].join(", ")}`);
  const counts = new Map<string, number>();
  for (const h of hooks) counts.set(h, (counts.get(h) ?? 0) + 1);
  const worst = Math.max(...counts.values());
  assert.ok(worst <= Math.ceil(12 / 9), `a hookShape repeats ${worst}x; round-robin cap is ${Math.ceil(12 / 9)}`);
});

test("BPV12.pool_floor advisory fires for thin per-chapter pools in a large book, and never blocks", () => {
  const book = compileBook(40); // floor = ceil(40/2) = 20; hookShape(9)/counterShape(6)/etc. are below it
  const findings = checkPositionalDeals(book);
  const advisories = findings.filter((f) => f.checkId === "BPV12.pool_floor");
  assert.ok(advisories.length > 0, "expected BPV12 pool-floor advisories for a 40-chapter book's thin per-chapter pools");
  assert.ok(advisories.every((f) => f.severity === "advisory"), "BPV12 must be advisory-only, never a blocker");
  // Small books stay clean: every per-chapter pool clears the ceil(5/2)=3 floor.
  assert.deepEqual(checkPositionalDeals(compileBook(5)).filter((f) => f.checkId === "BPV12.pool_floor"), []);
});

test("dealPositional: a broken (period-3) deal is caught by checkPositionalDeals as an avoidable collision", () => {
  // Sanity that BPV11 has teeth: synthesize a book whose quizDistractorTrap column
  // mimics the OLD `(n*3+i)%9` deal (period 3 at a fixed slot) and confirm it blocks.
  const good = compileBook(12);
  const broken = good.map((bp, idx) => {
    const n = idx + 1;
    const clone: ChapterBlueprintV1 = JSON.parse(JSON.stringify(bp));
    clone.sections.quiz = clone.sections.quiz.map((q, i) => ({ ...q, distractorTrap: `trap-${(n * 3 + i) % 9}` }));
    return clone;
  });
  const blockers = checkPositionalDeals(broken).filter((f) => f.checkId === "BPV11.positional_collision" && f.path?.includes("quizDistractorTrap"));
  assert.ok(blockers.length > 0, "a period-3 same-position deal must trip BPV11");
});

test("dealPositional throws on an empty pool", () => {
  assert.throws(() => dealPositional({ pool: [], bookId: BOOK, poolKey: "x", chapterNumber: 1, slotIndex: 0, totalChapters: 12 }), /empty pool/);
});
