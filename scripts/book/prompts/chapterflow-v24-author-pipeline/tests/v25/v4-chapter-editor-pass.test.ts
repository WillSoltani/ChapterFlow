/**
 * Package 2B — the chapter editor pass, hermetically.
 *
 * Every case drives `runChapterEditorPass` with a FAKE model runner over the
 * compliant credit fixture, so the real section gates, the real assembly
 * projection and the real preservation guard all run while nothing reaches a
 * provider. THIRTEEN cases; what each pins:
 *
 *   E1  a good edit is accepted, once, and the card carries the contract, the
 *       brief, the scars and the source span.
 *   E1b the read-only reader view is clamped to the writer's own tier caps.
 *   E2  an edit the SECTION GATE rejects is retried once with the blockers and
 *       then skipped, keeping the unedited chapter.
 *   E3  an edit that moves a quiz key is refused by the deterministic guard even
 *       though every gate passes.
 *   E3b an edit that PERMUTES a question's choices and leaves correctIndex alone
 *       is refused by the same guard, and the blocker reaches the retry card.
 *   E4  a cached verdict replays with zero model calls, for EDITED and SKIPPED.
 *   E4b a changed voice card, or anything else the CARD renders, re-edits.
 *   E5  the disable flag records DISABLED and spends nothing.
 *   E6  a provider block propagates; transient failures exhaust the budget into
 *       ERROR, and ERROR is never cached.
 *   E7  the advisory pass is off by default and, when the operator turns it on,
 *       spends one extra INVOCATION whose card carries the advisories.
 *   E7b a refused advisory edit is recorded as the ADVISORY's verdict on a
 *       chapter the standing pass edited, and the replay does not launder it —
 *       and that invocation's own budget is MAX_EDITOR_ATTEMPTS, not one call.
 *   E8  a malformed edit is refused rather than trusted.
 *   E9  cancellation propagates instead of being recorded as a skip.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  CHAPTER_EDITOR_ADVISORY_ENV,
  CHAPTER_EDITOR_ENABLED_ENV,
  MAX_EDITOR_ATTEMPTS,
  runChapterEditorPass,
  type ChapterEditorPassDependencies,
} from "../../src/app/chapterEditorPass.js";
import { CHAPTER_EDIT_SCHEMA_VERSION, readerChapterView } from "../../src/app/chapterEditorContract.js";
import { CHAPTER_PROSE_CARD_CAPS } from "../../src/sections/chapterProse.js";
import { assembleSections } from "../../src/sections/assembleSections.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createFileChapterEditCache } from "../../src/books/chapterEditCache.js";
import { createFileReviewAdvisoryStore } from "../../src/books/reviewAdvisoryStore.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type { ChapterEditPacks } from "../../src/sections/chapterEditGuard.js";
import type { ActionPackV1, LearningPackV1, SummaryPackV1 } from "../../src/artifacts/artifactTypes.js";
import type { ChapterV21 } from "../../src/types.js";
import { compileCreditFixture, creditChapterSpec, creditSidecarFixture } from "../fixtures/creditBookFixture.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const BOOK = "editor-pass-book";
const SPAN = "The Autobiography records that a score commonly sits on a published scale.";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function basePacks(): ChapterEditPacks {
  const fixture = compileCreditFixture(BOOK);
  return {
    "summary-pack": clone(fixture.summary) as unknown as Record<string, unknown>,
    "example-pack": clone(fixture.examples) as unknown as Record<string, unknown>,
    "learning-pack": clone(fixture.learning) as unknown as Record<string, unknown>,
    "action-pack": clone(fixture.action) as unknown as Record<string, unknown>,
  } as ChapterEditPacks;
}

/** The chapter the four fixture packs assemble into, exactly as the compile stage
 *  produces it. */
function assembledBytes(packs: ChapterEditPacks): Uint8Array {
  const fixture = compileCreditFixture(BOOK);
  const chapter = creditChapterSpec(BOOK);
  const encoder = new TextEncoder();
  const files = [
    { kind: "SIDECAR" as const, mediaType: "application/json" as const, logicalPath: "compiler/ch01/blueprint.json", bytes: encoder.encode(JSON.stringify(fixture.blueprint)) },
    { kind: "SIDECAR" as const, mediaType: "application/json" as const, logicalPath: "compiler/ch01/source-packet.json", bytes: encoder.encode(JSON.stringify(fixture.packet)) },
    { kind: "SIDECAR" as const, mediaType: "application/json" as const, logicalPath: "inputs/ch01.source.json", bytes: encoder.encode(JSON.stringify(creditSidecarFixture())) },
    ...(["summary-pack", "example-pack", "learning-pack", "action-pack"] as const).map((kind) => ({
      kind: "SIDECAR" as const,
      mediaType: "application/json" as const,
      logicalPath: `compiler/ch01/${kind}.json`,
      bytes: encoder.encode(JSON.stringify(packs[kind])),
    })),
  ].map((file) => ({ ...file, byteLength: file.bytes.byteLength }));
  const result = assembleSections(BOOK, {}, {
    content: {
      bookId: BOOK,
      selector: { kind: "CANDIDATE", candidateId: "input" },
      snapshot: {
        manifest: {
          schemaVersion: "1",
          bookId: BOOK,
          candidateId: "input",
          createdByRunId: "input-run",
          entries: files.map(({ bytes: _bytes, ...file }) => file),
          manifestDigest: "a".repeat(64),
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        files,
      },
    },
    chapters: [{
      chapterNumber: 1,
      blueprint: "compiler/ch01/blueprint.json",
      sourcePacket: "compiler/ch01/source-packet.json",
      sourceSidecar: "inputs/ch01.source.json",
      summary: "compiler/ch01/summary-pack.json",
      examples: "compiler/ch01/example-pack.json",
      learning: "compiler/ch01/learning-pack.json",
      action: "compiler/ch01/action-pack.json",
      output: `content/chapters/${chapter.chapterId}.v21-native.chapter.json`,
    }],
  });
  assert.deepEqual(result.findings, [], "fixture must assemble cleanly before the editor runs");
  assert.ok(result.candidateFiles && result.candidateFiles.length === 1);
  return result.candidateFiles[0].bytes;
}

/** An edit that changes wording only: no number, name, id, key or citation moves. */
function reworded(packs: ChapterEditPacks): ChapterEditPacks {
  const edited = clone(packs);
  const action = edited["action-pack"] as unknown as ActionPackV1;
  action.implementationPlan.weeklyPractice =
    "Once a week, look at the visible balance and decide whether a small payment or a reminder would leave the signal cleaner.";
  return edited;
}

/** An edit the SECTION GATE rejects: a hook far under SEC3's length floor. */
function gateFailing(packs: ChapterEditPacks): ChapterEditPacks {
  const edited = clone(packs);
  (edited["summary-pack"] as unknown as SummaryPackV1).hook.hook = "Too short.";
  return edited;
}

/** An edit every gate accepts and the preservation guard refuses: the key moves. */
function keyMoved(packs: ChapterEditPacks): ChapterEditPacks {
  const edited = reworded(packs);
  const learning = edited["learning-pack"] as unknown as LearningPackV1;
  const question = learning.quiz.questions[0];
  question.correctIndex = (question.correctIndex + 1) % 3;
  return edited;
}

/** The same corruption with the index left alone: the three choices are permuted,
 *  so the answer at `correctIndex` is now a distractor. Every id, count, citation
 *  and chapter-wide number/entity set is untouched, which is exactly why the
 *  guard has to compare the keyed answer's TEXT. */
function choicesPermuted(packs: ChapterEditPacks): ChapterEditPacks {
  const edited = reworded(packs);
  const learning = edited["learning-pack"] as unknown as LearningPackV1;
  const question = learning.quiz.questions[0];
  const other = (question.correctIndex + 1) % 3;
  const keyed = question.choices[question.correctIndex];
  question.choices[question.correctIndex] = question.choices[other];
  question.choices[other] = keyed;
  return edited;
}

type RigOptions = Readonly<{
  outputs?: ((attempt: number) => unknown)[];
  env?: Record<string, string | undefined>;
  cacheRoot?: string;
  advisoryRoot?: string;
  failures?: (attempt: number) => { outcome: "FAILED" | "TIMED_OUT" | "CANCELLED" | "UNKNOWN"; code: string; message: string } | null;
  abortAt?: number;
}>;

function rig(context: TestContext, suffix: string, options: RigOptions = {}) {
  const packs = basePacks();
  const fixture = compileCreditFixture(BOOK);
  const cards: string[] = [];
  const attemptIds: string[] = [];
  const controller = new AbortController();
  let calls = 0;
  const runner: ModelTaskRunner = {
    async run(request) {
      calls += 1;
      attemptIds.push(request.context.attemptId);
      const card = request.prompt.inputs.find((entry) => entry.name === "task_card");
      cards.push(card ? Buffer.from(card.bytes).toString("utf8") : "");
      // The editor's control text and task card are source-controlled task
      // instructions, so they are marked trusted and render outside the
      // untrusted records (the candidate content they quote is JSON-escaped
      // inside the card's own ```json blocks).
      assert.deepEqual(
        request.prompt.inputs.filter((entry) => entry.trust !== undefined).map((entry) => `${entry.name}:${entry.trust}`),
        ["control:instruction", "task_card:instruction"],
      );
      assert.equal(request.role, "author", "the editor is an author-role call");
      if (options.abortAt === calls) controller.abort();
      const failure = options.failures?.(calls) ?? null;
      if (failure) {
        return { attemptId: request.context.attemptId, outcome: failure.outcome, error: { code: failure.code, message: failure.message } };
      }
      const produce = options.outputs?.[Math.min(calls - 1, options.outputs.length - 1)];
      const edited = produce ? produce(calls) : reworded(packs);
      if (edited === null || typeof edited !== "object" || Array.isArray(edited)) {
        return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: edited as never };
      }
      const asPacks = edited as Record<string, unknown>;
      const wrapped = asPacks.schemaVersion === CHAPTER_EDIT_SCHEMA_VERSION
        ? asPacks
        : { schemaVersion: CHAPTER_EDIT_SCHEMA_VERSION, chapterId: fixture.blueprint.chapterId, sections: asPacks };
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: wrapped };
    },
  };
  const booksRoot = options.cacheRoot ?? options.advisoryRoot ?? resolve(context.roots.tempRoot, `books-${suffix}`);
  mkdirSync(booksRoot, { recursive: true });
  const writeLock = createBookWriteLock({ booksRoot });
  const dependencies: ChapterEditorPassDependencies = {
    runner,
    ...(options.cacheRoot === undefined && options.advisoryRoot === undefined
      ? {}
      : { cache: createFileChapterEditCache({ booksRoot, writeLock }), advisories: createFileReviewAdvisoryStore({ booksRoot, writeLock }) }),
    ...(options.env === undefined ? {} : { env: options.env }),
    sleep: async () => {},
  };
  const input = {
    bookId: BOOK,
    runId: `run-${suffix}`,
    stageId: "compiler-candidate",
    profileId: "attempt-read-json-v1",
    workDir: resolve(context.roots.attemptsRoot, suffix),
    signal: controller.signal,
    voiceCard: "voice: direct and warm",
    bookScars: { bookId: BOOK, phrases: ["reused phrase"], frames: [], notes: [], prohibitions: ["Never promise an exact score."] },
    chapter: {
      chapterNumber: 1,
      chapterId: fixture.blueprint.chapterId,
      chapterTitle: fixture.blueprint.title,
      operationId: "editor-ch01",
      attemptIdBase: `edt-${createHash("sha256").update(`run-${suffix}`).update("\0editor-ch01").digest("hex").slice(0, 40)}`,
      packs,
      assembledChapterBytes: assembledBytes(packs),
      blueprint: fixture.blueprint,
      packet: fixture.packet,
      sidecar: creditSidecarFixture(),
      sourceSpan: { text: SPAN, excerpted: false, omittedChars: 0 },
    },
  };
  return { dependencies, input, packs, cards, attemptIds, booksRoot, controller, calls: () => calls };
}

requiredTest("E1 a good edit is accepted after one call and the card carries every contract the writers had", async (context) => {
  const subject = rig(context, "accepted");
  const result = await runChapterEditorPass(subject.dependencies, subject.input);
  assert.equal(result.status, "EDITED");
  assert.equal(result.replayed, false);
  assert.equal(subject.calls(), 1);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.attemptIds.length, 1);
  const edited = result.packs as unknown as Record<string, ActionPackV1>;
  assert.match(edited["action-pack"].implementationPlan.weeklyPractice, /look at the visible balance/);

  const card = subject.cards[0];
  // The writing contract the section writers wrote under, on the editor lane.
  assert.match(card, /Tier floors: fastRead >=350 chars/);
  assert.match(card, /CHOICE PARITY METHOD/);
  assert.match(card, /the same four section packs, whole, in the schema you were given/);
  assert.doesNotMatch(card, /one complete ChapterV21 JSON object/);
  // The brief, the preservation rule, the scars, the reader view and the span.
  assert.match(card, /EDITOR BRIEF: the defect classes readers flagged/);
  assert.match(card, /PRESERVE EXACTLY/);
  assert.match(card, /NON-NEGOTIABLE RULES FOR THIS BOOK/);
  assert.match(card, /Never promise an exact score\./);
  assert.match(card, /THE CHAPTER AS THE READER MEETS IT/);
  assert.match(card, /THE FOUR SECTION PACKS YOU EDIT AND RETURN/);
  assert.ok(card.includes(SPAN), "the frozen source span reaches the editor");
  // No advisory block unless the operator asked for one.
  assert.doesNotMatch(card, /READER ADVISORIES/);
});

requiredTest("E1b the read-only reader view is clamped to the same tier caps the writer's prose block uses", () => {
  // Nothing enforces a tier CEILING (SEC6 checks floors), so without this clamp a
  // runaway chapter would decide how large the editor card is. Driven directly on
  // the pure projection: an over-long tier cannot reach it through a real compile,
  // because assembly's own gate refuses the chapter first.
  const chapter = JSON.parse(Buffer.from(assembledBytes(basePacks())).toString("utf8")) as ChapterV21;
  const runaway = {
    ...chapter,
    breakdown: { ...chapter.breakdown, fullRead: `${chapter.breakdown.fullRead} ${"overrun ".repeat(2000)}` },
  };
  const view = readerChapterView(runaway) as { fullRead: string; keyTakeaway: string };
  assert.ok(view.fullRead.endsWith("[…prose truncated]"), "an over-long tier is cut and says so");
  assert.ok(
    view.fullRead.length <= CHAPTER_PROSE_CARD_CAPS.fullRead + 32,
    `fullRead rendered at ${view.fullRead.length} against a ${CHAPTER_PROSE_CARD_CAPS.fullRead} cap`,
  );
  // Prose inside its band is never touched. (The fixture's own deepRead runs past
  // its 2,200-char cap, which is exactly the runaway class this clamp exists for,
  // so the in-band assertion uses a field that is genuinely in band.)
  assert.equal(view.keyTakeaway, chapter.keyTakeaway);
  assert.ok(chapter.keyTakeaway.length < CHAPTER_PROSE_CARD_CAPS.keyTakeaway);
});

requiredTest("E2 a gate-rejected edit is retried once with its blockers, then skipped with the chapter unedited", async (context) => {
  const subject = rig(context, "gate-fail", { outputs: [() => gateFailing(basePacks())] });
  const result = await runChapterEditorPass(subject.dependencies, subject.input);
  assert.equal(result.status, "SKIPPED");
  assert.equal(subject.calls(), MAX_EDITOR_ATTEMPTS);
  assert.equal(result.packs, null, "a skipped chapter carries no packs: the unedited ones ship");
  assert.ok(result.blockers.some((line) => line.includes("SEC3")), result.blockers.join(" | "));
  // The retry card echoes the blockers verbatim; the first card does not.
  assert.doesNotMatch(subject.cards[0], /YOUR PREVIOUS EDIT WAS REJECTED/);
  assert.match(subject.cards[1], /YOUR PREVIOUS EDIT WAS REJECTED/);
  assert.ok(subject.cards[1].includes("SEC3"));
  assert.notEqual(subject.attemptIds[0], subject.attemptIds[1], "a retry admits a fresh attempt id");
});

requiredTest("E3 an edit that moves a quiz key is refused by the preservation guard, not by a gate", async (context) => {
  const moved = keyMoved(basePacks());
  const subject = rig(context, "key-moved", { outputs: [() => moved] });
  const result = await runChapterEditorPass(subject.dependencies, subject.input);
  assert.equal(result.status, "SKIPPED");
  assert.equal(result.packs, null);
  assert.ok(result.blockers.some((line) => line.includes("EDIT.quiz_key")), result.blockers.join(" | "));
  assert.equal(subject.calls(), MAX_EDITOR_ATTEMPTS);
});

requiredTest("E3b a permuted choice list is refused inside the pass, with the blocker the retry card carries", async (context) => {
  const permuted = choicesPermuted(basePacks());
  const subject = rig(context, "choices-permuted", { outputs: [() => permuted] });
  const result = await runChapterEditorPass(subject.dependencies, subject.input);
  assert.equal(result.status, "SKIPPED");
  assert.equal(result.packs, null);
  assert.ok(
    result.blockers.some((line) => line.includes("EDIT.quiz_key_text")),
    result.blockers.join(" | "),
  );
  assert.equal(subject.calls(), MAX_EDITOR_ATTEMPTS);
});

requiredTest("E4 a cached verdict replays with zero model calls, for an edit and for a skip", async (context) => {
  const cacheRoot = resolve(context.roots.tempRoot, "books-cache");
  const first = rig(context, "cache-a", { cacheRoot });
  const before = await runChapterEditorPass(first.dependencies, first.input);
  assert.equal(before.status, "EDITED");
  assert.equal(first.calls(), 1);

  const replay = rig(context, "cache-b", { cacheRoot });
  const after = await runChapterEditorPass(replay.dependencies, replay.input);
  assert.equal(after.status, "EDITED");
  assert.equal(after.replayed, true);
  assert.equal(replay.calls(), 0, "a resume must not spend on a chapter it has already edited");
  assert.deepEqual(after.packs, before.packs);

  const skipRoot = resolve(context.roots.tempRoot, "books-cache-skip");
  const skipped = rig(context, "cache-skip-a", { cacheRoot: skipRoot, outputs: [() => gateFailing(basePacks())] });
  const skipResult = await runChapterEditorPass(skipped.dependencies, skipped.input);
  assert.equal(skipResult.status, "SKIPPED");
  assert.equal(skipped.calls(), MAX_EDITOR_ATTEMPTS);
  const skipReplay = rig(context, "cache-skip-b", { cacheRoot: skipRoot, outputs: [() => gateFailing(basePacks())] });
  const skipAgain = await runChapterEditorPass(skipReplay.dependencies, skipReplay.input);
  assert.equal(skipAgain.status, "SKIPPED");
  assert.equal(skipAgain.replayed, true);
  assert.equal(skipReplay.calls(), 0, "a refused edit must not be re-paid for on every resume");
  assert.deepEqual(skipAgain.blockers, skipResult.blockers);
});

requiredTest("E4b a changed contract, or anything else the CARD renders, re-edits instead of replaying", async (context) => {
  const cacheRoot = resolve(context.roots.tempRoot, "books-cache-key");
  const first = rig(context, "key-a", { cacheRoot });
  await runChapterEditorPass(first.dependencies, first.input);
  assert.equal(first.calls(), 1);

  const otherVoice = rig(context, "key-b", { cacheRoot });
  const result = await runChapterEditorPass(otherVoice.dependencies, {
    ...otherVoice.input,
    voiceCard: "voice: clipped and technical",
  });
  assert.equal(result.replayed, false);
  assert.equal(otherVoice.calls(), 1, "a different voice card is a different question");

  // R-164's class: the SOURCE SPAN is rendered into the card but is not the
  // chapter, the brief or the contract. Only the card digest catches it, and
  // without that a span change would serve an edit made under the old prompt.
  const otherSpan = rig(context, "key-c", { cacheRoot });
  const spanChanged = await runChapterEditorPass(otherSpan.dependencies, {
    ...otherSpan.input,
    chapter: {
      ...otherSpan.input.chapter,
      sourceSpan: { text: `${SPAN} It also records a second sentence.`, excerpted: false, omittedChars: 0 },
    },
  });
  assert.equal(spanChanged.replayed, false);
  assert.equal(otherSpan.calls(), 1, "a different source span is a different question");

  // …and the same inputs a third time DO replay, so the key is not simply always
  // missing.
  const same = rig(context, "key-d", { cacheRoot });
  const replayed = await runChapterEditorPass(same.dependencies, same.input);
  assert.equal(replayed.replayed, true);
  assert.equal(same.calls(), 0);
});

requiredTest("E5 the disable flag records 'editor disabled' in provenance and spends nothing", async (context) => {
  const subject = rig(context, "disabled", { env: { [CHAPTER_EDITOR_ENABLED_ENV]: "0" } });
  const result = await runChapterEditorPass(subject.dependencies, subject.input);
  assert.equal(result.status, "DISABLED");
  assert.equal(result.packs, null);
  assert.equal(subject.calls(), 0);
  assert.deepEqual(result.blockers, [`editor disabled by ${CHAPTER_EDITOR_ENABLED_ENV}=0`]);
});

requiredTest("E6 a provider block propagates; exhausted transient failures record ERROR and are never cached", async (context) => {
  const blocked = rig(context, "blocked", {
    failures: () => ({ outcome: "FAILED", code: "MODEL_PROCESS_FAILED", message: "429 weekly limit reached; resets Sunday" }),
  });
  await assert.rejects(
    runChapterEditorPass(blocked.dependencies, blocked.input),
    /CHAPTER_EDIT_PROVIDER_BLOCKED/,
  );
  assert.equal(blocked.calls(), 1, "a provider block is not retried inside the exhausted window");

  const cacheRoot = resolve(context.roots.tempRoot, "books-error");
  const transient = rig(context, "transient", {
    cacheRoot,
    failures: () => ({ outcome: "FAILED", code: "MODEL_PROCESS_FAILED", message: "socket hang up" }),
  });
  const result = await runChapterEditorPass(transient.dependencies, transient.input);
  assert.equal(result.status, "ERROR", "an infrastructure failure is never a manufactured skip");
  assert.equal(result.packs, null);
  assert.equal(transient.calls(), MAX_EDITOR_ATTEMPTS);
  assert.ok(result.blockers.some((line) => line.includes("socket hang up")), result.blockers.join(" | "));

  const retry = rig(context, "transient-retry", { cacheRoot });
  const recovered = await runChapterEditorPass(retry.dependencies, retry.input);
  assert.equal(recovered.status, "EDITED", "an ERROR must not be frozen into the cache");
  assert.equal(recovered.replayed, false);
  assert.equal(retry.calls(), 1);
});

requiredTest("E7 the advisory pass is off by default and costs one extra invocation when the operator turns it on", async (context) => {
  const booksRoot = resolve(context.roots.tempRoot, "books-advisory");
  const seed = rig(context, "advisory-seed", { advisoryRoot: booksRoot });
  const store = seed.dependencies.advisories;
  assert.ok(store);
  await store.write(
    { bookId: BOOK, chapterId: seed.input.chapter.chapterId },
    {
      reviewId: "review-pass-1",
      entries: [
        { code: "READER.CHURN", message: "ch01 repeats the utilization idea in every tier." },
        { code: "READER.CARD", message: "ch01 card backs announce their own angle." },
      ],
    },
  );

  const off = rig(context, "advisory-off", { advisoryRoot: booksRoot });
  const defaulted = await runChapterEditorPass(off.dependencies, off.input);
  assert.equal(defaulted.status, "EDITED");
  assert.equal(off.calls(), 1, "the advisory pass costs nothing unless it is switched on");
  assert.equal(defaulted.advisory.applied, false);
  assert.doesNotMatch(off.cards[0], /READER ADVISORIES/);

  const on = rig(context, "advisory-on", {
    advisoryRoot: booksRoot,
    env: { [CHAPTER_EDITOR_ADVISORY_ENV]: "1" },
  });
  const applied = await runChapterEditorPass(on.dependencies, on.input);
  assert.equal(applied.status, "EDITED");
  assert.equal(on.calls(), 2, "one standing edit plus one advisory edit");
  assert.equal(applied.advisory.applied, true);
  assert.equal(applied.advisory.reviewId, "review-pass-1");
  assert.equal(applied.advisory.count, 2);
  assert.doesNotMatch(on.cards[0], /READER ADVISORIES/);
  assert.match(on.cards[1], /READER ADVISORIES FROM THE LAST PANEL ON THIS BOOK/);
  assert.ok(on.cards[1].includes("card backs announce their own angle"));
});

requiredTest("E7b a refused advisory edit is recorded as the advisory's own verdict, not read as an applied one", async (context) => {
  const booksRoot = resolve(context.roots.tempRoot, "books-advisory-refused");
  const seed = rig(context, "advisory-refused-seed", { advisoryRoot: booksRoot });
  const store = seed.dependencies.advisories;
  assert.ok(store);
  await store.write(
    { bookId: BOOK, chapterId: seed.input.chapter.chapterId },
    { reviewId: "review-pass-2", entries: [{ code: "READER.CHURN", message: "ch01 repeats the utilization idea in every tier." }] },
  );

  // The standing edit is accepted; the advisory invocation then moves a quiz key
  // and is refused on both of its attempts. The chapter ships EDITED — by the
  // STANDING pass — and the record has to say that the advisories did NOT land.
  const subject = rig(context, "advisory-refused", {
    advisoryRoot: booksRoot,
    env: { [CHAPTER_EDITOR_ADVISORY_ENV]: "1" },
    outputs: [() => reworded(basePacks()), () => keyMoved(basePacks())],
  });
  const result = await runChapterEditorPass(subject.dependencies, subject.input);
  assert.equal(result.status, "EDITED");
  assert.deepEqual(result.blockers, [], "the chapter's own blockers belong to the chapter, not to the advisory");
  assert.equal(result.advisory.applied, true);
  assert.equal(result.advisory.outcome, "REFUSED");
  assert.ok(
    result.advisory.blockers.some((line) => line.includes("EDIT.quiz_key")),
    result.advisory.blockers.join(" | "),
  );
  // One standing call plus the advisory invocation's OWN budget: the worst case
  // is MAX_EDITOR_ATTEMPTS per invocation, not one extra call.
  assert.equal(subject.calls(), 1 + MAX_EDITOR_ATTEMPTS);

  const replay = rig(context, "advisory-refused-replay", {
    advisoryRoot: booksRoot,
    env: { [CHAPTER_EDITOR_ADVISORY_ENV]: "1" },
  });
  const replayed = await runChapterEditorPass(replay.dependencies, replay.input);
  assert.equal(replay.calls(), 0, "the verdict replays for nothing");
  assert.equal(replayed.status, "EDITED");
  assert.equal(replayed.advisory.outcome, "REFUSED", "a replay must not launder a refused advisory into an applied one");
  assert.deepEqual(replayed.advisory.blockers, result.advisory.blockers);
});

requiredTest("E8 a malformed edit is refused rather than trusted", async (context) => {
  const cases: Array<[string, unknown]> = [
    ["not an object", "edited"],
    ["wrong schema", { schemaVersion: "chapter-edit-v0", chapterId: `${BOOK}-ch01`, sections: {} }],
    ["missing pack", { schemaVersion: CHAPTER_EDIT_SCHEMA_VERSION, chapterId: `${BOOK}-ch01`, sections: { "summary-pack": {} } }],
  ];
  for (const [label, output] of cases) {
    const subject = rig(context, `malformed-${label.replace(/\s+/g, "-")}`, { outputs: [() => output] });
    const result = await runChapterEditorPass(subject.dependencies, subject.input);
    assert.equal(result.status, "SKIPPED", label);
    assert.equal(result.packs, null, label);
    assert.ok(result.blockers.length > 0, label);
  }
});

requiredTest("E9 cancellation propagates instead of being recorded as a skip", async (context) => {
  const subject = rig(context, "cancelled", { abortAt: 1 });
  await assert.rejects(runChapterEditorPass(subject.dependencies, subject.input), /MODEL_RUN_CANCELLED/);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
