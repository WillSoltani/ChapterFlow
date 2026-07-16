/**
 * WP-101 — fresh-emit cross-boundary adapter test (V25 S-Tier §8 Lane 1).
 *
 * V25-08: no test drove a FRESH pipeline emission through the two real,
 * hand-maintained web consumer adapters. Every prior adapter test (this
 * file's siblings `v21-adapter.test.ts` / `validate-book-package.test.ts`,
 * and `app/book/lib/v21-adapter.test.ts`) either hand-builds a raw object or
 * reads an already-shipped `book-packages/*.v21.json` — never a package the
 * pipeline just produced.
 *
 * This test drives a FRESH deterministic emission — built by
 * `buildFreshEmission()` (scripts/book/prompts/chapterflow-v24-author-pipeline/
 * tests/freshEmitFixture.ts), which genuinely runs the pipeline's real
 * assemble -> ship-gate -> strip -> write machinery (`promoteBook`) against a
 * hermetic one-chapter fixture book, zero live model/API calls — through:
 *
 *   • the REAL server path:  validateBookPackage -> isV21Raw/adaptV21ToV13
 *                            + enforceSemanticRules + enforceV21QuizFieldRules
 *   • the REAL client path:  normalizeAnyPackage -> normalizeV21Package
 *                            + extractV21ChapterExtras
 *
 * asserting field parity for every consumed field, INCLUDING the richness
 * fields an envelope-only contract check cannot see into: examples,
 * implementationPlan, reviewCards, hook, memorableLines, experiencePlan.
 *
 * CROSS-PACKAGE IMPORT NOTE. `buildFreshEmission` lives under the pipeline's
 * OWN tests/ dir and is imported here across the root/pipeline package
 * boundary (via the `@/*` alias, which covers the whole repo). This is safe
 * under `tsx` because Node/tsx module resolution is resolved relative to the
 * IMPORTING FILE's own location, not the entry point's cwd: files under
 * scripts/book/prompts/chapterflow-v24-author-pipeline resolve their own
 * bare-specifier deps (e.g. `ajv`) against that package's OWN node_modules
 * regardless of which test runner started the process. Confirmed empirically
 * before this file was written (a throwaway probe import of `promoteBook`
 * from this exact directory ran clean under `npx tsx --test`). This keeps the
 * "one fresh emission through both real chains" assertion in ONE test run
 * instead of two independent suites that would have to coordinate through a
 * shared file on disk.
 *
 * SCOPE: fresh emissions ONLY (V25 S-Tier §8 WP-101). This does not gate the
 * 140 shipped `book-packages/*.v21.json` packages — 5 have known pre-existing
 * envelope-parity drift (2 genuine) and are explicitly out of scope here; the
 * slim-contract test (`app/book/data/bookPackages.slim-contract.test.ts`)
 * already guards the shipped corpus.
 *
 * OUT OF SCOPE (do not fix here): a wrong-but-in-range quiz answer key passes
 * every structural adapter cleanly — that is the D7 semantic ship gate
 * (WP-401), not this test. This file documents that fact; it does not close it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildFreshEmission,
  cleanupFreshEmission,
  FRESH_EMIT_BOOK_ID,
  type FreshEmission,
} from "@/scripts/book/prompts/chapterflow-v24-author-pipeline/tests/freshEmitFixture";

import { validateBookPackage } from "./validate-book-package";
import { isBookApiError } from "./errors";
import { normalizeAnyPackage } from "@/app/book/data/book-package-core";
import { extractV21ChapterExtras } from "@/app/book/lib/v21-adapter";

/** Run `fn(emission)` against a freshly-built emission, guaranteeing cleanup
 *  (including on a thrown assertion) so a failing test never leaks the
 *  fixture book's on-disk state into the next test run. */
function withFreshEmission(fn: (emission: FreshEmission) => void): void {
  try {
    fn(buildFreshEmission());
  } finally {
    cleanupFreshEmission();
  }
}

function rawChapter(emission: FreshEmission): Record<string, unknown> {
  return (emission.parsed.chapters as Array<Record<string, unknown>>)[0];
}

test("fresh emission passes the REAL server validateBookPackage without throwing", () => {
  withFreshEmission((emission) => {
    const adapted = validateBookPackage(emission.parsed);
    assert.equal(adapted.schemaVersion, "chapterflow-v21-authored");
    assert.equal(adapted.chapters.length, 1);
    assert.equal(adapted.book.bookId, FRESH_EMIT_BOOK_ID);
  });
});

test("fresh emission normalizes client-side (normalizeAnyPackage) to 3 non-empty tiers + every quiz question in-range", () => {
  withFreshEmission((emission) => {
    const pkg = normalizeAnyPackage(emission.parsed, "direct");
    assert.equal(pkg.chapters.length, 1);
    const chapter = pkg.chapters[0];
    for (const tier of ["easy", "medium", "hard"] as const) {
      const variant = chapter.contentVariants[tier];
      assert.ok(variant, `contentVariants.${tier} must be present`);
      assert.ok((variant!.chapterBreakdown ?? "").length > 0, `contentVariants.${tier}.chapterBreakdown must be non-empty`);
    }
    assert.ok(chapter.quiz.questions.length > 0, "quiz must carry questions");
    for (const q of chapter.quiz.questions) {
      assert.equal(typeof q.correctIndex, "number", `${q.questionId} correctIndex must be a number`);
      assert.ok(
        (q.correctIndex as number) >= 0 && (q.correctIndex as number) < (q.choices?.length ?? 0),
        `${q.questionId} correctIndex ${q.correctIndex} must be in [0, ${q.choices?.length})`,
      );
    }
  });
});

test("field-parity: examples, implementationPlan, reviewCards, hook survive BOTH real adapters unchanged", () => {
  withFreshEmission((emission) => {
    const raw = rawChapter(emission);
    const rawExamples = raw.examples as Array<Record<string, unknown>>;
    const rawImpl = raw.implementationPlan as Record<string, unknown>;
    const rawCards = raw.reviewCards as Array<Record<string, unknown>>;

    // server
    const serverPkg = validateBookPackage(emission.parsed);
    const serverChapter = serverPkg.chapters[0];
    assert.equal(serverChapter.examples.length, rawExamples.length, "server: example count must round-trip");
    rawExamples.forEach((ex, i) => {
      assert.equal(serverChapter.examples[i].scenario, ex.scenario, `server: examples[${i}].scenario`);
      assert.equal(serverChapter.examples[i].whyItMatters, ex.whyItMatters, `server: examples[${i}].whyItMatters`);
    });
    assert.ok(serverChapter.implementationPlan, "server: implementationPlan must survive");
    // Server wraps prose in a tone-keyed {gentle,direct,competitive} object (all three
    // set to the same v21 canonical-voice string, since v21 books are tone-invariant).
    assert.equal(serverChapter.implementationPlan!.coreSkill?.direct, rawImpl.coreSkill, "server: implementationPlan.coreSkill");
    assert.equal(serverChapter.reviewCards?.length, rawCards.length, "server: reviewCards count must round-trip");
    assert.ok(serverChapter.v21Extras?.hook, "server: v21Extras.hook must survive");
    assert.equal(serverChapter.v21Extras!.hook, raw.hook, "server: hook text must be unchanged");

    // client
    const clientPkg = normalizeAnyPackage(emission.parsed, "direct");
    const clientChapter = clientPkg.chapters[0];
    assert.equal(clientChapter.examples.length, rawExamples.length, "client: example count must round-trip");
    rawExamples.forEach((ex, i) => {
      assert.equal(clientChapter.examples[i].scenario, ex.scenario, `client: examples[${i}].scenario`);
      assert.equal(clientChapter.examples[i].whyItMatters, ex.whyItMatters, `client: examples[${i}].whyItMatters`);
    });
    assert.ok(clientChapter.implementationPlan, "client: implementationPlan must survive");
    assert.equal(clientChapter.implementationPlan!.coreSkill, rawImpl.coreSkill, "client: implementationPlan.coreSkill");
    assert.equal(clientChapter.reviewCards?.length, rawCards.length, "client: reviewCards count must round-trip");

    const clientExtras = extractV21ChapterExtras(raw);
    assert.equal(clientExtras.hook, raw.hook, "client: extractV21ChapterExtras.hook must be unchanged");
    assert.equal(clientExtras.keyTakeaway, raw.keyTakeaway, "client: extractV21ChapterExtras.keyTakeaway must be unchanged");
  });
});

test("field-parity: experiencePlan (failureRecovery + transferPrompt + behaviorLoop) survives BOTH real adapters exactly", () => {
  withFreshEmission((emission) => {
    const raw = rawChapter(emission);
    const rawEp = raw.experiencePlan as Record<string, any>;
    assert.ok(rawEp.failureRecovery && rawEp.transferPrompt && rawEp.behaviorLoop, "fixture sanity: all three experiencePlan sub-objects must be present");

    // server (adaptV21ToV13 -> adaptV21Extras -> adaptExperiencePlan, surfaced on v21Extras)
    const serverPkg = validateBookPackage(emission.parsed);
    const serverEp = serverPkg.chapters[0].v21Extras?.experiencePlan;
    assert.ok(serverEp, "server: v21Extras.experiencePlan must survive");
    assert.deepEqual(serverEp!.failureRecovery, rawEp.failureRecovery, "server: failureRecovery must be byte-identical");
    assert.deepEqual(serverEp!.transferPrompt, rawEp.transferPrompt, "server: transferPrompt must be byte-identical");
    assert.deepEqual(serverEp!.behaviorLoop, rawEp.behaviorLoop, "server: behaviorLoop (readerPatterns) must be byte-identical");

    // client (extractV21ChapterExtras -> extractExperiencePlan)
    const clientExtras = extractV21ChapterExtras(raw);
    assert.ok(clientExtras.experiencePlan, "client: extractV21ChapterExtras.experiencePlan must survive");
    assert.deepEqual(clientExtras.experiencePlan!.failureRecovery, rawEp.failureRecovery, "client: failureRecovery must be byte-identical");
    assert.deepEqual(clientExtras.experiencePlan!.transferPrompt, rawEp.transferPrompt, "client: transferPrompt must be byte-identical");
    assert.deepEqual(clientExtras.experiencePlan!.behaviorLoop, rawEp.behaviorLoop, "client: behaviorLoop (readerPatterns) must be byte-identical");
  });
});

test("documented gap: memorableLines[].location/why and quiz.depthLevel never reach a fresh emission at all (pipeline strip, not an adapter drop)", () => {
  // The pipeline's OWN reader-content strip (readerContent.ts,
  // reader-content-strip-v3) removes memorableLines[].location/.why and
  // quizQuestion.depthLevel BEFORE promoteBook ever writes book-packages/. A
  // genuine fresh emission therefore never carries them — so the adapter code
  // that reads them (server v21-adapter.ts `adaptMemorableLines`/`adaptQuiz`,
  // client v21-adapter.ts `extractV21ChapterExtras`/`adaptQuiz`) can never
  // observe a real production value for them. WP-102's frozen parity contract
  // lists them as legitimately-CONSUMED optional fields (a hand-built fixture
  // like `app/book/lib/v21-adapter.test.ts` CAN inject them and "prove" the
  // adapter reads them) — but that scenario cannot occur from a real emission.
  // This is the deep-level gap an envelope-only contract check cannot see
  // (V25 S-Tier decision ledger L-17, rt102 NOTE). Documented here, not fixed:
  // fixing it would mean changing `stripInternalFields` or the strip policy,
  // which is out of this WP's scope (no adapter/validator source edits).
  withFreshEmission((emission) => {
    const raw = rawChapter(emission);
    for (const line of raw.memorableLines as Array<Record<string, unknown>>) {
      assert.ok(typeof line.text === "string" && line.text.length > 0, "memorableLines[].text must survive");
      assert.equal(line.location, undefined, "memorableLines[].location is stripped before emission, not just before the adapter");
      assert.equal(line.why, undefined, "memorableLines[].why is stripped before emission, not just before the adapter");
    }
    const questions = (raw.quiz as Record<string, unknown>).questions as Array<Record<string, unknown>>;
    for (const q of questions) {
      assert.equal(typeof q.bloomsLevel, "string", "quizQuestion.bloomsLevel DOES survive to a fresh emission");
      assert.equal(q.depthLevel, undefined, "quizQuestion.depthLevel is stripped before emission, not just before the adapter");
    }

    // Round-trip confirmation: since the raw bytes never carry location/why,
    // both real adapters legitimately produce undefined for them too — this
    // is consistent behavior, not a NEW loss introduced by the adapters.
    const clientExtras = extractV21ChapterExtras(raw);
    for (const line of clientExtras.memorableLines ?? []) {
      assert.equal(line.location, undefined);
      assert.equal(line.why, undefined);
    }
  });
});

test("documented (not fixed): a wrong-but-IN-RANGE quiz answer key passes both structural adapters cleanly", () => {
  // A content defect (the key points at the wrong choice, but the index is
  // still a valid 0..choices.length-1 slot) is INVISIBLE to both structural
  // adapters — neither knows which choice is semantically correct, only that
  // a number in range was supplied. Catching this is the D7 semantic ship
  // gate's job (WP-401), not this WP's. This test proves the claim rather
  // than asserting it in a comment: the mutation must NOT throw or misroute.
  withFreshEmission((emission) => {
    const mutated = JSON.parse(JSON.stringify(emission.parsed));
    const question = mutated.chapters[0].quiz.questions[0];
    const originalIndex = question.correctIndex as number;
    const wrongButInRangeIndex = (originalIndex + 1) % question.choices.length;
    assert.notEqual(wrongButInRangeIndex, originalIndex, "fixture sanity: choices must offer a distinct in-range alternative");
    question.correctIndex = wrongButInRangeIndex;

    const serverPkg = validateBookPackage(mutated); // must not throw
    assert.equal(serverPkg.chapters[0].quiz.questions[0].correctIndex, wrongButInRangeIndex);

    const clientPkg = normalizeAnyPackage(mutated, "direct"); // must not throw
    assert.equal(clientPkg.chapters[0].quiz.questions[0].correctIndex, wrongButInRangeIndex);
  });
});

test("negative: an out-of-range correctIndex fails the server path (422) and is caught (not silently accepted) on the client path", () => {
  withFreshEmission((emission) => {
    const mutated = JSON.parse(JSON.stringify(emission.parsed));
    const question = mutated.chapters[0].quiz.questions[0];
    const outOfRangeIndex = question.choices.length + 5;
    question.correctIndex = outOfRangeIndex;

    // Server: enforceV21QuizFieldRules rejects it outright.
    assert.throws(
      () => validateBookPackage(mutated),
      (err: unknown) => isBookApiError(err) && err.status === 422,
      "server must reject an out-of-range correctIndex with BookApiError(422)",
    );

    // Client: normalizeV21Package does NOT itself range-check correctIndex
    // (adaptQuiz passes any number through) — so the value SURVIVES to the
    // client output. The catch has to be an explicit field-parity assertion,
    // not adapter behavior. Prove that assertion actually has teeth here.
    const clientPkg = normalizeAnyPackage(mutated, "direct");
    const clientQuestion = clientPkg.chapters[0].quiz.questions[0];
    assert.equal(clientQuestion.correctIndex, outOfRangeIndex, "client adapter passes the mutated value through unchecked (documented, not a defect of this WP)");
    const inRange =
      typeof clientQuestion.correctIndex === "number" &&
      clientQuestion.correctIndex >= 0 &&
      clientQuestion.correctIndex < (clientQuestion.choices?.length ?? 0);
    assert.equal(inRange, false, "the field-parity assertion must catch the out-of-range key even though the client adapter didn't");
  });
});

test("negative: a missing top-level schemaVersion misroutes a v21 emission to the v13 parser and fails validation", () => {
  withFreshEmission((emission) => {
    const mutated = JSON.parse(JSON.stringify(emission.parsed));
    delete mutated.schemaVersion;
    assert.throws(
      () => validateBookPackage(mutated),
      (err: unknown) => isBookApiError(err) && err.status === 422,
      "a v21-shaped package with no schemaVersion must misroute to the v13 field parser and fail (BookApiError 422), not silently pass",
    );
  });
});
