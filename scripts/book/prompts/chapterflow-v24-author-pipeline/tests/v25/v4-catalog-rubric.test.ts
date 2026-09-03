/**
 * The catalog-rubric INSTRUMENT: weights, seeded sampling, strict reader
 * parsing, aggregation, gate adjudication and the scorecard layout.
 *
 * Everything here is pure — no model call, no filesystem, no run state. The
 * stage that spends money is tested in `v4-catalog-rubric-stage.test.ts`.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { REVIEW_FACTORS, type ReviewFactor } from "../../src/artifacts/artifactTypes.js";
import { REVIEW_WEIGHTS } from "../../src/review/readerReview.js";
import {
  CATALOG_RUBRIC_DEFAULT_BAR,
  CATALOG_RUBRIC_FACTOR_FLOOR,
  CATALOG_RUBRIC_WEIGHTS,
  CatalogRubricReaderError,
  aggregateCatalogRubric,
  assembleCatalogRubricReader,
  buildCatalogRubricReaderTask,
  buildRegisterHint,
  catalogRubricTier,
  judgeCatalogRubric,
  CATALOG_RUBRIC_TEXTURE_AXES,
  medianOf,
  medianSeverity,
  roundHalfToEven,
  parseCatalogRubricReaderJson,
  renderCatalogRubricScorecard,
  resolveRubricBar,
  selectRubricChapterIndexes,
  selectSeededChapterIndexes,
  type CatalogRubricReaderResultV1,
  type CatalogRubricSeverity,
  type CatalogRubricTextureAxis,
} from "../../src/review/catalogRubric.js";
import { finishV25Tests, requiredTest } from "./harness.js";

/** The weight table exactly as `.claude/skills/book-score/compose.py` declares
 *  it. Transcribed here as a LITERAL on purpose: if this test imported the
 *  pipeline's own table it would compare a value to itself and prove nothing. */
const COMPOSE_PY_WEIGHTS: Record<string, number> = {
  retention: 13, quizzes: 12, transfer: 11, practical: 11, summaries: 11,
  tone: 10, limits: 9, insight: 8, density: 8, beginner: 7,
};

function reader(
  number: number,
  overrides: Partial<Record<ReviewFactor, number>> & {
    gate?: "PASS" | "FAIL";
    gateFailures?: string;
    churn?: CatalogRubricSeverity;
    texture?: CatalogRubricSeverity;
    textureAxes?: Partial<Record<CatalogRubricTextureAxis, CatalogRubricSeverity>>;
    apparatusQuotes?: string;
    base?: number;
  } = {},
): CatalogRubricReaderResultV1 {
  const base = overrides.base ?? 82;
  const scores = Object.fromEntries(
    REVIEW_FACTORS.map((factor) => [factor, overrides[factor] ?? base]),
  ) as Record<ReviewFactor, number>;
  const texture = Object.fromEntries(
    CATALOG_RUBRIC_TEXTURE_AXES.map((axis) => [axis, overrides.textureAxes?.[axis] ?? overrides.texture ?? "LOW"]),
  ) as Record<CatalogRubricTextureAxis, CatalogRubricSeverity>;
  return {
    reader: number,
    gateVerdict: overrides.gate ?? "PASS",
    gateFailures: overrides.gateFailures ?? "none",
    scores,
    churn: overrides.churn ?? "LOW",
    texture,
    apparatusQuotes: overrides.apparatusQuotes ?? "none",
    textureNote: `reader ${number} texture note`,
    note: `reader ${number} note`,
  };
}

requiredTest("the catalog rubric uses the SAME weights as the per-chapter panel and as compose.py", () => {
  assert.deepEqual({ ...CATALOG_RUBRIC_WEIGHTS }, COMPOSE_PY_WEIGHTS);
  assert.deepEqual({ ...REVIEW_WEIGHTS }, COMPOSE_PY_WEIGHTS);
  // Same object, not a copy: a future edit to REVIEW_WEIGHTS cannot leave a
  // stale second table behind this gate.
  assert.equal(CATALOG_RUBRIC_WEIGHTS, REVIEW_WEIGHTS);
  assert.equal(Object.values(COMPOSE_PY_WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

requiredTest("seeded chapter selection reproduces score.py exactly", () => {
  // Expected values produced by running score.py's own select_idxs:
  //   python3 -c "import hashlib; ..."  (see the PR body for the transcript)
  assert.deepEqual([...selectSeededChapterIndexes("rubric-gate-book", 10)], [4, 5, 6, 7]);
  assert.deepEqual([...selectSeededChapterIndexes("rubric-gate-book", 13)], [0, 3, 6, 9]);
  assert.deepEqual([...selectSeededChapterIndexes("rubric-gate-book", 14)], [1, 6, 10, 11]);
  assert.deepEqual([...selectSeededChapterIndexes("rubric-gate-book", 23)], [2, 3, 13, 14]);
  assert.deepEqual([...selectSeededChapterIndexes("the-autobiography-of-benjamin-franklin", 10)], [0, 1, 2, 3]);
  assert.deepEqual([...selectSeededChapterIndexes("the-autobiography-of-benjamin-franklin", 13)], [0, 3, 7, 10]);
  assert.deepEqual([...selectSeededChapterIndexes("the-autobiography-of-benjamin-franklin", 23)], [2, 3, 14, 15]);
  assert.deepEqual([...selectSeededChapterIndexes("atomic-habits", 14)], [0, 4, 5, 9]);
  // Fewer chapters than the sample size: every chapter, never a duplicate.
  assert.deepEqual([...selectSeededChapterIndexes("atomic-habits", 3)], [0, 1, 2]);
  // Deterministic across calls (the seed is the book id, nothing else).
  assert.deepEqual(
    [...selectSeededChapterIndexes("atomic-habits", 14)],
    [...selectSeededChapterIndexes("atomic-habits", 14)],
  );
});

requiredTest("a book of six chapters or fewer is read WHOLE; a larger one is sampled", () => {
  assert.deepEqual([...selectRubricChapterIndexes("rubric-gate-book", 1)], [0]);
  assert.deepEqual([...selectRubricChapterIndexes("rubric-gate-book", 6)], [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([...selectRubricChapterIndexes("rubric-gate-book", 7)], [1, 3, 4, 6]);
  assert.deepEqual([...selectRubricChapterIndexes("rubric-gate-book", 14)], [1, 6, 10, 11]);
  assert.throws(() => selectRubricChapterIndexes("rubric-gate-book", 0), /positive chapter count/);
});

requiredTest("the reader block is strictly assembled — nothing is defaulted or repaired", () => {
  const clean = {
    reader: 2, gate_verdict: "PASS", gate_failures: "none",
    retention: 80, quizzes: 78, transfer: 81, practical: 77, summaries: 84,
    tone: 71, limits: 66, insight: 79, density: 74, beginner: 83,
    book3_churn: "MED",
    scene_skeleton: "LOW", repeated_unit: "MED", prop_stamp: "LOW", proxy_cast: "HIGH",
    apparatus_quotes: "none", texture_note: "no dominant repeated shape",
    note: "strongest summaries; weakest limits",
  };
  const assembled = assembleCatalogRubricReader(clean, 2);
  assert.equal(assembled.gateVerdict, "PASS");
  assert.equal(assembled.scores.limits, 66);
  assert.equal(assembled.churn, "MED");
  assert.equal(assembled.texture.proxy_cast, "HIGH");
  assert.equal(assembled.apparatusQuotes, "none");

  // Every field the v2 template declares is REQUIRED — a reader that answers
  // only the old shape is refused, never back-filled with a benign default.
  const { proxy_cast: _proxy, ...noTexture } = clean;
  assert.throws(() => assembleCatalogRubricReader(noTexture, 2), /"proxy_cast" must be LOW, MED or HIGH/);
  const { apparatus_quotes: _apparatus, ...noApparatus } = clean;
  assert.throws(() => assembleCatalogRubricReader(noApparatus, 2), /"apparatus_quotes" must be a non-empty string/);
  const { texture_note: _textureNote, ...noTextureNote } = clean;
  assert.throws(() => assembleCatalogRubricReader(noTextureNote, 2), /"texture_note" must be a non-empty string/);
  assert.throws(() => assembleCatalogRubricReader({ ...clean, scene_skeleton: "low" }, 2), /"scene_skeleton" must be/);

  // Wrong reader number: the seat identity is part of the contract.
  assert.throws(() => assembleCatalogRubricReader(clean, 3), CatalogRubricReaderError);
  // A missing factor is a refusal, not a zero.
  const { limits: _limits, ...missing } = clean;
  assert.throws(() => assembleCatalogRubricReader(missing, 2), /"limits" must be a number/);
  // Out of range.
  assert.throws(() => assembleCatalogRubricReader({ ...clean, tone: 101 }, 2), /"tone" must be a number/);
  // A FAIL with no quote is refused: the quote is the operator's only handle.
  assert.throws(
    () => assembleCatalogRubricReader({ ...clean, gate_verdict: "FAIL" }, 2),
    /a FAIL gate must quote the violation/,
  );
  // A churn value outside the frozen three.
  assert.throws(() => assembleCatalogRubricReader({ ...clean, book3_churn: "low" }, 2), /"book3_churn" must be/);
  assert.throws(() => assembleCatalogRubricReader("{}", 2), /output is not a JSON object/);
});

requiredTest("reader JSON is recovered from a prose-prefixed response", () => {
  const parsed = parseCatalogRubricReaderJson(
    'Here is my review.\n{"reader":1,"gate_verdict":"PASS","gate_failures":"none","note":"x"}\n',
  );
  assert.deepEqual(parsed, { reader: 1, gate_verdict: "PASS", gate_failures: "none", note: "x" });
  assert.equal(parseCatalogRubricReaderJson("no json here"), null);
  assert.equal(parseCatalogRubricReaderJson('{"broken": '), null);
  // A brace inside a string must not open a block.
  assert.deepEqual(parseCatalogRubricReaderJson('{"note":"a { brace"}'), { note: "a { brace" });
});

requiredTest("medians, composite, tier and the high-quality badge match compose.py's arithmetic", () => {
  assert.equal(medianOf([70, 90, 80]), 80);
  assert.equal(medianOf([70, 80]), 75);
  assert.equal(catalogRubricTier(90), "premium (90+)");
  assert.equal(catalogRubricTier(80), "strong/ships (80-90)");
  assert.equal(catalogRubricTier(79.9), "solid draft (70-80)");
  assert.equal(catalogRubricTier(60), "mediocre (60-70)");
  assert.equal(catalogRubricTier(59.9), "not-publishable (<60)");

  const aggregate = aggregateCatalogRubric([reader(1, { base: 84 }), reader(2, { base: 86 }), reader(3, { base: 82 })]);
  // Every factor median is 84, so the weighted composite is 84 exactly.
  assert.equal(aggregate.composite, 84);
  assert.equal(aggregate.gate, "PASS");
  assert.deepEqual({ ...aggregate.gateVotes }, { pass: 3, fail: 0 });
  assert.equal(aggregate.highQuality, false, "84 < 85 so the badge is not met");

  const standout = aggregateCatalogRubric([reader(1, { base: 88 }), reader(2, { base: 90 }), reader(3, { base: 86 })]);
  assert.equal(standout.composite, 88);
  assert.equal(standout.highQuality, true);
  // The badge is churn-sensitive exactly as compose.py's is.
  const churned = aggregateCatalogRubric([
    reader(1, { base: 88, churn: "HIGH" }), reader(2, { base: 90, churn: "HIGH" }), reader(3, { base: 86, churn: "LOW" }),
  ]);
  assert.equal(churned.churn, "HIGH");
  assert.equal(churned.highQuality, false);
});

requiredTest("churn and the texture axes use compose.py's SEVERITY MEDIAN, not a mode", () => {
  // compose.py: SEV_LBL[round(statistics.median([SEV.get(c, 1) for c in churns]))]
  assert.equal(medianSeverity(["LOW", "MED", "LOW"]), "LOW");
  assert.equal(medianSeverity(["HIGH", "HIGH", "MED"]), "HIGH");
  // THE ORDER-DEPENDENCE A MODE WOULD INTRODUCE. A 1/1/1 split is MED whichever
  // seat held which opinion; a mode would answer HIGH, LOW and MED for these
  // three orderings and decide promotion on seat order.
  assert.equal(medianSeverity(["HIGH", "LOW", "MED"]), "MED");
  assert.equal(medianSeverity(["LOW", "MED", "HIGH"]), "MED");
  assert.equal(medianSeverity(["MED", "HIGH", "LOW"]), "MED");
  // Python's round() is half-to-EVEN, which matters only for an even panel.
  assert.equal(roundHalfToEven(0.5), 0);
  assert.equal(roundHalfToEven(1.5), 2);
  assert.equal(roundHalfToEven(2.5), 2);
  assert.equal(medianSeverity(["LOW", "MED"]), "LOW", "median 0.5 rounds to even → LOW");
  assert.equal(medianSeverity(["MED", "HIGH"]), "HIGH", "median 1.5 rounds to even → HIGH");

  // The same rule aggregates every texture axis, and the aggregate carries them.
  const aggregate = aggregateCatalogRubric([
    reader(1, { churn: "HIGH", textureAxes: { proxy_cast: "HIGH", scene_skeleton: "MED" } }),
    reader(2, { churn: "LOW", textureAxes: { proxy_cast: "HIGH", scene_skeleton: "LOW" } }),
    reader(3, { churn: "MED", textureAxes: { proxy_cast: "MED", scene_skeleton: "LOW" } }),
  ]);
  assert.equal(aggregate.churn, "MED");
  assert.equal(aggregate.texture.proxy_cast, "HIGH");
  assert.equal(aggregate.texture.scene_skeleton, "LOW");
  assert.equal(aggregate.texture.prop_stamp, "LOW");
  assert.deepEqual([...aggregate.textureHigh], ["proxy_cast"]);
  // A 1/1/1 churn split is promotable at MED — with a mode it would have been
  // refused as HIGH purely because reader 1 spoke first.
  assert.equal(judgeCatalogRubric(aggregate, 80).promotable, true);
});

requiredTest("apparatus leaks are collected as a defect class and never gate the book", () => {
  const aggregate = aggregateCatalogRubric([
    reader(1, { base: 88, apparatusQuotes: "\"the official guide puts Results in Part 2\"" }),
    reader(2, { base: 88, apparatusQuotes: "none" }),
    reader(3, { base: 88, apparatusQuotes: "NONE" }),
  ]);
  assert.deepEqual(
    aggregate.apparatusQuotes.map((entry) => entry.reader),
    [1],
    "\"none\" answers are dropped exactly as compose.py drops them, case-insensitively",
  );
  assert.equal(aggregate.gate, "PASS", "an apparatus leak is a defect class, not a correctness-gate hit");
  const verdict = judgeCatalogRubric(aggregate, 80);
  assert.equal(verdict.promotable, true, "the package's promotion rule is gate/composite/floor/churn only");
  const card = renderCatalogRubricScorecard({
    title: "T", chapterLabels: ["1"], readers: [reader(1, { base: 88, apparatusQuotes: "x" })], aggregate, verdict,
  });
  assert.match(card, /\*\*Apparatus leakage quoted by the panel\*\*/);
  assert.match(card, /the official guide puts Results in Part 2/);
  assert.match(card, /\*\*Texture-sameness axes \(panel median\):\*\*/);
});

requiredTest("a weighted composite uses the weights, not the mean of the factors", () => {
  // retention (weight 13) at 100, everything else at 70: the unweighted mean is
  // 73, the weighted composite is 70 + 30*0.13 = 73.9.
  const skewed = (n: number): CatalogRubricReaderResultV1 => reader(n, { base: 70, retention: 100 });
  const aggregate = aggregateCatalogRubric([skewed(1), skewed(2), skewed(3)]);
  assert.equal(Number(aggregate.composite.toFixed(4)), 73.9);
});

requiredTest("a unanimous FAIL gate fails closed as RUBRIC_GATE_FAIL, whatever the composite says", () => {
  const aggregate = aggregateCatalogRubric([
    reader(1, { base: 95, gate: "FAIL", gateFailures: "Q3 key contradicts the prose" }),
    reader(2, { base: 95, gate: "FAIL", gateFailures: "the Whitfield study is fabricated" }),
    reader(3, { base: 95, gate: "FAIL", gateFailures: "scaffold token 'Fact 4' bleeds into the deep read" }),
  ]);
  assert.equal(aggregate.gate, "FAIL");
  assert.equal(aggregate.composite, 95);
  assert.equal(aggregate.highQuality, false);
  const verdict = judgeCatalogRubric(aggregate, 80);
  assert.equal(verdict.promotable, false);
  assert.equal(verdict.failureCode, "RUBRIC_GATE_FAIL");
  assert.match(verdict.message ?? "", /Q3 key contradicts the prose/);
  assert.match(verdict.message ?? "", /the Whitfield study is fabricated/);
  assert.equal(aggregate.gateFailures.length, 3);
});

requiredTest("a SPLIT gate fails CLOSED with the disputed quotes — never a mechanical majority PASS", () => {
  const aggregate = aggregateCatalogRubric([
    reader(1, { base: 90 }),
    reader(2, { base: 90 }),
    reader(3, { base: 90, gate: "FAIL", gateFailures: "the Ruskin Institute cited in ch2 does not exist" }),
  ]);
  // compose.py would rule PASS here (2 >= 1). This stage does not.
  assert.equal(aggregate.gate, "SPLIT");
  assert.deepEqual({ ...aggregate.gateVotes }, { pass: 2, fail: 1 });
  const verdict = judgeCatalogRubric(aggregate, 80);
  assert.equal(verdict.promotable, false);
  assert.equal(verdict.failureCode, "RUBRIC_GATE_SPLIT");
  assert.match(verdict.message ?? "", /never resolved by majority/);
  assert.match(verdict.message ?? "", /the Ruskin Institute cited in ch2 does not exist/);
  assert.deepEqual([...aggregate.gateFailures], [{ reader: 3, quoted: "the Ruskin Institute cited in ch2 does not exist" }]);
});

requiredTest("promotion needs the composite AND every factor AND churn — and the message names the factors", () => {
  const passing = aggregateCatalogRubric([reader(1, { base: 82 }), reader(2, { base: 84 }), reader(3, { base: 80 })]);
  assert.equal(judgeCatalogRubric(passing, 80).promotable, true);
  assert.equal(judgeCatalogRubric(passing, 82).promotable, true);
  // Raising the bar above the composite re-decides the SAME stored panel.
  const raised = judgeCatalogRubric(passing, 90);
  assert.equal(raised.promotable, false);
  assert.equal(raised.failureCode, "RUBRIC_BELOW_BAR");
  assert.match(raised.message ?? "", /composite 82\.0 < bar 90/);

  // Composite clears the bar, one factor does not.
  const collapsed = aggregateCatalogRubric([
    reader(1, { base: 90, limits: 60, density: 64 }),
    reader(2, { base: 90, limits: 62, density: 66 }),
    reader(3, { base: 90, limits: 58, density: 62 }),
  ]);
  assert.equal(collapsed.composite >= 80, true);
  const floored = judgeCatalogRubric(collapsed, 80);
  assert.equal(floored.promotable, false);
  assert.equal(floored.failureCode, "RUBRIC_BELOW_BAR");
  assert.match(floored.message ?? "", /factor medians below 70: limits 60, density 64/);
  assert.deepEqual([...floored.belowFloorFactors], ["limits", "density"]);

  // Churn HIGH blocks on its own.
  const churny = aggregateCatalogRubric([
    reader(1, { base: 88, churn: "HIGH" }), reader(2, { base: 88, churn: "HIGH" }), reader(3, { base: 88, churn: "MED" }),
  ]);
  const churnVerdict = judgeCatalogRubric(churny, 80);
  assert.equal(churnVerdict.promotable, false);
  assert.match(churnVerdict.message ?? "", /book-3 churn is HIGH/);

  assert.equal(CATALOG_RUBRIC_FACTOR_FLOOR, 70, "the whole-book factor floor is the documented 70");
  assert.throws(() => judgeCatalogRubric(passing, 59), /rubric bar must be an integer 60-95/);
  assert.throws(() => judgeCatalogRubric(passing, 96), /rubric bar must be an integer 60-95/);
});

requiredTest("the bar resolves from the flag, then the env, and fails closed on anything else", () => {
  const previous = process.env.CHAPTERFLOW_RUBRIC_BAR;
  try {
    delete process.env.CHAPTERFLOW_RUBRIC_BAR;
    assert.equal(resolveRubricBar(), CATALOG_RUBRIC_DEFAULT_BAR);
    assert.equal(CATALOG_RUBRIC_DEFAULT_BAR, 80);
    assert.equal(resolveRubricBar(75), 75);
    process.env.CHAPTERFLOW_RUBRIC_BAR = "88";
    assert.equal(resolveRubricBar(), 88);
    // The explicit flag wins over the env.
    assert.equal(resolveRubricBar(70), 70);
    process.env.CHAPTERFLOW_RUBRIC_BAR = "";
    assert.equal(resolveRubricBar(), CATALOG_RUBRIC_DEFAULT_BAR);
    process.env.CHAPTERFLOW_RUBRIC_BAR = "80.5";
    assert.throws(() => resolveRubricBar(), /not an integer/);
    process.env.CHAPTERFLOW_RUBRIC_BAR = "99";
    assert.throws(() => resolveRubricBar(), /must be 60-95/);
    process.env.CHAPTERFLOW_RUBRIC_BAR = "40";
    assert.throws(() => resolveRubricBar(), /must be 60-95/);
    assert.throws(() => resolveRubricBar(59), /rubric bar must be an integer 60-95/);
  } finally {
    if (previous === undefined) delete process.env.CHAPTERFLOW_RUBRIC_BAR;
    else process.env.CHAPTERFLOW_RUBRIC_BAR = previous;
  }
});

/**
 * THE PORT GUARD (blocking finding 1).
 *
 * The previous version of this case asserted substrings of the module's OWN
 * output, which is a tautology: it froze whatever the prompt happened to say and
 * could not see a criterion that had been dropped. This one holds the built task
 * against a CHECKED-IN COPY of the skill's step-3 template
 * (`fixtures/book-score-skill-step3-reader-prompt.txt`, lines 73-157 of
 * `.claude/skills/book-score/SKILL.md` in the canonical books worktree,
 * sha256 8c74b696…). Every non-blank template line must appear in the task
 * VERBATIM unless it is named in ADAPTED_LINES below with a reason — so deleting
 * a gate criterion, softening a factor definition or dropping a JSON field fails
 * this test instead of shipping as a "verbatim port".
 */
const SKILL_TEMPLATE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/book-score-skill-step3-reader-prompt.txt",
);
/** Pins the fixture itself: re-copying the block from a DIFFERENT skill revision
 *  (there are two copies of this skill on disk and they disagree) is then a
 *  deliberate, reviewable edit rather than a silent instrument swap. */
const SKILL_TEMPLATE_SHA256 = "dfe721c0d66663b3b699bb47051146562d9de0ad6467b0bedd3849a58d6be9e6";

/** 1-based line numbers in the fixture whose text this port does NOT carry
 *  verbatim, each with the reason. Nothing else may differ. */
const ADAPTED_LINES: Readonly<Record<number, string>> = Object.freeze({
  2: "the «TITLE»/«AUTHOR»/register-hint slot line — filled, and asserted separately below",
  3: "continuation of the «ONE-LINE REGISTER HINT» slot description",
  4: "continuation of the «ONE-LINE REGISTER HINT» slot description",
  6: "BOOK PACKAGE: «PKG» — a candidate is not a released package; the chapters ride inline",
  7: "the python3 extraction instruction — there is no package file to extract from",
  8: "the python3 extraction one-liner — same reason",
  9: "the PACKAGE-FIELD list (hook/counterintuition/breakdown.…) — the readers get the rendered",
  10: "reader page, whose sections are named differently and which has no counterintuition field",
  11: "so the port names the document's own sections instead",
});

requiredTest("the reader task is the skill's step-3 template, line for line, except the declared adaptations", () => {
  const template = readFileSync(SKILL_TEMPLATE_PATH, "utf8");
  assert.equal(
    createHash("sha256").update(template, "utf8").digest("hex"),
    SKILL_TEMPLATE_SHA256,
    "the checked-in skill template changed; re-derive the port before re-pinning this hash",
  );
  const task = buildCatalogRubricReaderTask({
    readerNumber: 2,
    title: "The Autobiography",
    author: "Benjamin Franklin",
    registerHint: "The source author's register is plainspoken. Judge Tone on fidelity to that voice.",
    // FOUR chapters, so the template's own "4 chapters" needs no substitution.
    chapterNumbers: [2, 7, 11, 12],
    totalChapters: 14,
  });
  const missing: string[] = [];
  template.split("\n").forEach((line, index) => {
    const lineNumber = index + 1;
    if (line.trim().length === 0) return;
    if (ADAPTED_LINES[lineNumber] !== undefined) return;
    const filled = line.replaceAll("«N»", "2").replaceAll("«AUTHOR»", "Benjamin Franklin");
    if (!task.includes(filled)) missing.push(`line ${lineNumber}: ${filled}`);
  });
  assert.deepEqual(missing, [], `the port dropped or reworded skill lines:\n${missing.join("\n")}`);

  // The adapted header still says what the skill's header says, with the slots filled.
  assert.match(task, /of the AI-generated learning book "The Autobiography" by Benjamin Franklin\./);
  assert.match(task, /The source author's register is plainspoken\./);
  // The mechanism the pipeline does NOT have must not be instructed.
  assert.equal(task.includes("python3 -c"), false);
  assert.equal(task.includes("book-packages/"), false);
  // Every scored factor is named in the definitions block.
  for (const factor of REVIEW_FACTORS) assert.match(task, new RegExp(`\\n - ${factor}( \\(lens>tactic\\))?: `));
});

requiredTest("the register hint prefers the run's own voice card and never forwards content lines", () => {
  const card = [
    "voice: plain, concrete register with dry self-aware irony; third-person retelling; varied cadence",
    "do: name the concrete thing (the object, the sum, the errand) before naming what it proves",
    "never: grandeur, moralizing",
    "Match how this sounds. Never quote this card, never mention the author, never import content from other books.",
  ].join("\n");
  const fromCard = buildRegisterHint({ author: "Benjamin Franklin", voiceCard: card });
  assert.match(fromCard, /plain, concrete register with dry self-aware irony/);
  assert.equal(fromCard.includes("do: name the concrete thing"), false, "content lines must never reach the reader");
  assert.equal(fromCard.includes("Match how this sounds"), false, "the card's guard line is card-internal");
  assert.match(fromCard, /Judge Tone on fidelity to that voice/);

  const fromRegister = buildRegisterHint({ author: "Benjamin Franklin", voiceCard: null, register: "plainspoken" });
  assert.match(fromRegister, /The source author's register is plainspoken\./);

  const none = buildRegisterHint({ author: "Benjamin Franklin" });
  assert.match(none, /No register profile was recorded for Benjamin Franklin/);
  assert.match(none, /infer the intended voice from the pages themselves/);
});

requiredTest("the scorecard prints compose.py's table plus the promotion verdict", () => {
  const readers = [reader(1, { base: 78, limits: 64 }), reader(2, { base: 80, limits: 66 }), reader(3, { base: 76, limits: 62 })];
  const aggregate = aggregateCatalogRubric(readers);
  const verdict = judgeCatalogRubric(aggregate, 80);
  const card = renderCatalogRubricScorecard({
    title: "The Autobiography",
    chapterLabels: ["2", "7", "11", "12"],
    readers,
    aggregate,
    verdict,
  });
  assert.match(card, /^## The Autobiography — scorecard \(ch 2, 7, 11, 12\)/);
  assert.match(card, /\*\*Gate:\*\* PASS {2}\(unanimous\) {3}· {3}\*\*Book-3 churn:\*\* LOW/);
  assert.match(card, /\| Factor \| wt \| R1 \| R2 \| R3 \| \*\*Median\*\* \| status \|/);
  assert.match(card, /\| Retention \| 13 \| 78 \| 80 \| 76 \| \*\*78\*\* \| ~ weak \|/);
  assert.match(card, /\| Honesty about limits \| 9 \| 64 \| 66 \| 62 \| \*\*64\*\* \| !! <75 \|/);
  assert.match(card, /\| \*\*COMPOSITE\*\* \|/);
  assert.match(card, /\*\*High-quality bar\*\*/);
  assert.match(card, /\*\*Below standard \(<75\):\*\* Honesty about limits/);
  assert.match(card, /\*\*Promotion bar\*\* \(composite >=80 · every factor >=70 · churn != HIGH · gate PASS\): \*\*NOT MET — RUBRIC_BELOW_BAR\*\*/);
  // Two compose.py lines must NOT be fabricated from inputs this stage lacks.
  assert.equal(card.includes("**Deterministic:**"), false);
  assert.equal(card.includes("**Placement:**"), false);

  const clean = [reader(1, { base: 84 }), reader(2, { base: 86 }), reader(3, { base: 82 })];
  const cleanAggregate = aggregateCatalogRubric(clean);
  const cleanCard = renderCatalogRubricScorecard({
    title: "The Autobiography",
    chapterLabels: ["1"],
    readers: clean,
    aggregate: cleanAggregate,
    verdict: judgeCatalogRubric(cleanAggregate, 80),
  });
  assert.match(cleanCard, /\*\*Promotion bar\*\*.*\*\*MET\*\*/);
  assert.equal(cleanCard.includes("**CAPPED**"), false);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
