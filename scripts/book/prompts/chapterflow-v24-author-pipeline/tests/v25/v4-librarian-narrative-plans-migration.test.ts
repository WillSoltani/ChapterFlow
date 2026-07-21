import assert from "node:assert/strict";
import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createCandidateStore, type CandidateInputFile } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import type { PlannedArtifact } from "../../src/contracts/v4Core.js";
import type { TestRoots } from "../testRoots.js";
import { loadCallbackPlan } from "../../src/librarian/callbackPlan.js";
import { planExemplars } from "../../src/librarian/exemplarPlan.js";
import { planNames } from "../../src/librarian/namePlan.js";
import { planPedagogy } from "../../src/librarian/pedagogyPlan.js";
import { loadRhetoricPlan } from "../../src/librarian/rhetoricPlan.js";
import { loadSceneMechanismPlan } from "../../src/librarian/sceneMechanismPlan.js";
import { loadSceneModePlan } from "../../src/librarian/sceneModePlan.js";
import { planShapes } from "../../src/librarian/shapePlan.js";
import { loadTimingPlan } from "../../src/librarian/timingPlan.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const BOOK = "librarian-book";
const CANDIDATE = "candidate-history-2";
const CANDIDATE_PLAN_JSON = {
  callback: '{"schemaVersion":"callback-plan-v1","bookId":"librarian-book","createdAt":"legacy-frozen","allocation":{"1":{"callbackChapter":0,"frameId":"first-principle","directive":"Recall principle"},"2":{"callbackChapter":1,"frameId":"contrast","directive":"Contrast prior chapter"}},"diagnostics":{"frameCounts":{"first-principle":1,"contrast":1}}}',
  rhetoric: '{"schemaVersion":"rhetoric-plan-v1","bookId":"librarian-book","createdAt":"legacy-frozen","allocation":{"1":{"counterShape":"tradeoff","counterDirective":"Show tradeoff","hookOpenerClass":"question","hookDirective":"Open question"},"2":{"counterShape":"reversal","counterDirective":"Reverse premise","hookOpenerClass":"image","hookDirective":"Open image"}},"diagnostics":{"counterShapeCounts":{"tradeoff":1,"reversal":1},"hookOpenerClassCounts":{"question":1,"image":1}}}',
  mechanism: '{"schemaVersion":"scene-mechanism-plan-v1","bookId":"librarian-book","createdAt":"legacy-frozen","allocation":{"1":{"mechanismId":"threshold","directive":"Cross threshold"},"2":{"mechanismId":"handoff","directive":"Use handoff"}},"diagnostics":{"mechanismCounts":{"threshold":1,"handoff":1}}}',
  mode: '{"schemaVersion":"scene-mode-plan-v1","bookId":"librarian-book","createdAt":"legacy-frozen","allocation":{"1":{"stance":"close-third","directive":"Close third"},"2":{"stance":"retrospective-first","directive":"Retrospective first"}},"diagnostics":{"stanceCounts":{"close-third":1,"retrospective-first":1}}}',
  timing: '{"schemaVersion":"timing-plan-v1","bookId":"librarian-book","createdAt":"legacy-frozen","allocation":{"1":{"triggerId":"next_reply","directive":"Before next reply"},"2":{"triggerId":"next_handoff","directive":"At next handoff"}},"diagnostics":{"triggerCounts":{"next_reply":1,"next_handoff":1}}}',
} as const;

const FROZEN_LOADER_BASELINES = {
  callback: { schemaVersion: "callback-plan-v1", bookId: "librarian-book", createdAt: "legacy-frozen", allocation: { 1: { callbackChapter: 0, frameId: "first-principle", directive: "Recall principle" }, 2: { callbackChapter: 1, frameId: "contrast", directive: "Contrast prior chapter" } }, diagnostics: { frameCounts: { "first-principle": 1, contrast: 1 } } },
  rhetoric: { schemaVersion: "rhetoric-plan-v1", bookId: "librarian-book", createdAt: "legacy-frozen", allocation: { 1: { counterShape: "tradeoff", counterDirective: "Show tradeoff", hookOpenerClass: "question", hookDirective: "Open question" }, 2: { counterShape: "reversal", counterDirective: "Reverse premise", hookOpenerClass: "image", hookDirective: "Open image" } }, diagnostics: { counterShapeCounts: { tradeoff: 1, reversal: 1 }, hookOpenerClassCounts: { question: 1, image: 1 } } },
  mechanism: { schemaVersion: "scene-mechanism-plan-v1", bookId: "librarian-book", createdAt: "legacy-frozen", allocation: { 1: { mechanismId: "threshold", directive: "Cross threshold" }, 2: { mechanismId: "handoff", directive: "Use handoff" } }, diagnostics: { mechanismCounts: { threshold: 1, handoff: 1 } } },
  mode: { schemaVersion: "scene-mode-plan-v1", bookId: "librarian-book", createdAt: "legacy-frozen", allocation: { 1: { stance: "close-third", directive: "Close third" }, 2: { stance: "retrospective-first", directive: "Retrospective first" } }, diagnostics: { stanceCounts: { "close-third": 1, "retrospective-first": 1 } } },
  timing: { schemaVersion: "timing-plan-v1", bookId: "librarian-book", createdAt: "legacy-frozen", allocation: { 1: { triggerId: "next_reply", directive: "Before next reply" }, 2: { triggerId: "next_handoff", directive: "At next handoff" } }, diagnostics: { triggerCounts: { next_reply: 1, next_handoff: 1 } } },
} as const;

const FROZEN_EXEMPLAR_BASELINE = JSON.parse('{"schemaVersion":"exemplar-plan-v1","bookId":"librarian-book","createdAt":"<normalized>","fromChapter":1,"toChapter":1,"allocation":{"1":{"assigned":["Ada Lovelace","Lovelace"],"forbidden":[]}},"diagnostics":{"contested":0,"chaptersWithoutSidecar":[]}}');
const FROZEN_SHAPE_BASELINE = JSON.parse('{"schemaVersion":"shape-plan-v1","bookId":"librarian-book","createdAt":"<normalized>","perChapter":6,"allocation":{"1":["dialogue"]},"carriedChapters":[1]}');
const FROZEN_PEDAGOGY_BASELINE = JSON.parse('{"schemaVersion":"pedagogy-plan-v1","bookId":"librarian-book","fromChapter":1,"toChapter":1,"bookMix":{"hookShapes":["concrete-ironic-image","pressure-test-question","your-hidden-default"],"dominantHookShape":"concrete-ironic-image","tryThisNowGrammars":["notice-and-record","ask-one-person","deliberate-abstention"],"tacticFamilies":["breath-counting","write-one-line","subtract-one-thing","environment-move","single-question-conversation","timer-block","object-relocation","read-aloud","walk-and-decide","comparison-of-two","calendar-edit","checklist-mark","observation-log","teach-someone","rehearse-once","boundary-script","stop-doing-list","threshold-cue","ranking-pass","replacement-rule","handoff-note","friction-add","friction-remove","error-review"],"quizOpeners":["compare-two-responses","what-happens-next"]},"allocation":{"1":{"hookShape":"your-hidden-default","tryThisNowGrammar":"ask-one-person","tacticFamily":"write-one-line","quizOpeners":["what-happens-next","compare-two-responses"]}},"carriedChapters":[1]}');
const FROZEN_NAME_BASELINE = JSON.parse('{"bookId":"librarian-book","fromChapter":1,"toChapter":1,"perChapter":2,"allocation":{"1":["Mireille","Ruby"]},"bannedConnectives":["has to decide whether to","now has to choose between","is trying to figure out","stares at the screen and","stops and looks at the","takes a deep breath and","leans back in the chair","glances at the clock and","stops arguing and points to","we cannot keep pretending this","catches the edge of the","the room goes quiet as","feels the weight of the","knows the answer but cannot","is about to find out","has been doing this for","looks up from the desk","the same thing happens again","wants nothing more than to","cannot shake the feeling that","is faced with a choice","has to make a call","sits down to write the","opens the laptop and starts","runs the numbers one more","the point is","the question is whether","that is the lesson","that is the move","a louder scoreboard","the scoreboard"],"connectivePrinciple":"Never let a 5-word run repeat across chapters. Vary the GRAMMAR of how a scene opens, how a decision is framed, and how a consequence lands — not just the nouns. If two of your scenarios could swap their opening clause without anyone noticing, rewrite one.","namePolicy":{"schemaVersion":"name-policy-v1","policyId":"catalog-cooldown-v1","description":"Planner-allocated protagonist names are unique within a book and cannot be dealt again if they appear in the last 10 other ledgered books."},"diagnostics":{"bankSize":502,"excludedCount":0,"crossBookReused":0,"availableCount":494,"shortChapters":[],"alreadyAuthored":[],"sourceFigureExcluded":0,"policyExcluded":0}}');

function fixtureFiles(): CandidateInputFile[] {
  const raw: Array<[string, string]> = [
    [`state/callback-plans/${BOOK}.callback-plan.json`, CANDIDATE_PLAN_JSON.callback],
    [`state/rhetoric-plans/${BOOK}.rhetoric-plan.json`, CANDIDATE_PLAN_JSON.rhetoric],
    [`state/scene-mechanism-plans/${BOOK}.scene-mechanism-plan.json`, CANDIDATE_PLAN_JSON.mechanism],
    [`state/scene-mode-plans/${BOOK}.scene-mode-plan.json`, CANDIDATE_PLAN_JSON.mode],
    [`state/timing-plans/${BOOK}.timing-plan.json`, CANDIDATE_PLAN_JSON.timing],
    ["sidecars/ch01.json", '{"chapterNumber":1,"namedExamples":[{"label":"Ada Lovelace","summary":"Ada Lovelace built an analytical engine."}],"properNouns":["Ada Lovelace"]}'],
    ["state/library-state.json", '{"version":"2.0.0","lastUpdatedAt":"1970-01-01T00:00:00.000Z","revision":0,"policy":{"namePolicyVersion":"name-policy-v1","namePolicyId":"catalog-cooldown-v1"},"books":{},"globalNameUsage":{},"globalPhraseUsage":{},"globalAnswerPositionCounts":[0,0,0]}'],
    [`state/chapters/${BOOK}-ch01.v21-native.chapter.json`, '{"chapterId":"librarian-book-ch01","number":1,"title":"One","examples":[{"scenario":"Mira enters the workshop.","planSpec":{"format":"dialogue"}}]}'],
  ];
  return raw.map(([logicalPath, value]) => {
    const bytes = Buffer.from(value);
    return { kind: "SIDECAR" as const, logicalPath, mediaType: "application/json" as const, bytes };
  });
}

function setup(roots: TestRoots) {
  const lock = createBookWriteLock({ booksRoot: roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointer = createCurrentPointerStore({ booksRoot: roots.booksRoot, writeLock: lock });
  return {
    store: createCandidateStore({ booksRoot: roots.booksRoot, writeLock: lock, currentPointerStore: pointer }),
    reader: createBookContentReader({ booksRoot: roots.booksRoot, currentPointerStore: pointer }),
  };
}

async function stage(store: ReturnType<typeof setup>["store"], candidateId: string, files: CandidateInputFile[]): Promise<void> {
  const expectedInventory: PlannedArtifact[] = files.map(({ bytes: _bytes, ...entry }) => entry);
  const result = await store.stage({ bookId: BOOK, candidateId, createdByRunId: "run-2", expectedInventory, files, createdAt: "2026-07-20T12:00:00.000Z" });
  assert.equal(result.ok, true, result.ok ? "" : result.error.message);
}

function tree(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const visit = (path: string): void => {
    const stat = lstatSync(path);
    const key = relative(root, path).split(sep).join("/") || ".";
    out[key] = `${stat.mode}:${stat.mtimeMs}:${stat.isFile() ? readFileSync(path).toString("base64") : "directory"}`;
    if (stat.isDirectory()) for (const name of readdirSync(path).sort()) visit(join(path, name));
  };
  visit(root);
  return out;
}

requiredTest("narrative loaders use only explicit historical candidate", async ({ roots }) => {
  const subject = setup(roots);
  await stage(subject.store, CANDIDATE, fixtureFiles());
  const before = tree(roots.base);
  assert.deepEqual(await loadCallbackPlan(BOOK, subject.reader, CANDIDATE), FROZEN_LOADER_BASELINES.callback);
  assert.deepEqual(await loadRhetoricPlan(BOOK, subject.reader, CANDIDATE), FROZEN_LOADER_BASELINES.rhetoric);
  assert.deepEqual(await loadSceneMechanismPlan(BOOK, subject.reader, CANDIDATE), FROZEN_LOADER_BASELINES.mechanism);
  assert.deepEqual(await loadSceneModePlan(BOOK, subject.reader, CANDIDATE), FROZEN_LOADER_BASELINES.mode);
  assert.deepEqual(await loadTimingPlan(BOOK, subject.reader, CANDIDATE), FROZEN_LOADER_BASELINES.timing);
  assert.deepEqual(tree(roots.base), before);
});

requiredTest("candidate narrative inputs preserve independent legacy calculations", async ({ roots }) => {
  writeFileSync(join(roots.stateRoot, "legacy-difference"), "must-not-be-read");
  const subject = setup(roots);
  await stage(subject.store, CANDIDATE, fixtureFiles());
  const before = tree(roots.base);
  const exemplar = await planExemplars(BOOK, 1, 1, subject.reader, CANDIDATE);
  assert.deepEqual({ ...exemplar, createdAt: "<normalized>" }, FROZEN_EXEMPLAR_BASELINE);
  const shapes = await planShapes(BOOK, 1, 1, 6, { forceFresh: false }, subject.reader, CANDIDATE);
  assert.deepEqual({ ...shapes, createdAt: "<normalized>" }, FROZEN_SHAPE_BASELINE);
  const pedagogy = await planPedagogy(BOOK, 1, 1, { forceFresh: false }, subject.reader, CANDIDATE);
  assert.deepEqual(pedagogy, FROZEN_PEDAGOGY_BASELINE);
  const names = await planNames(BOOK, 1, 1, 2, { forceFresh: true }, subject.reader, CANDIDATE);
  assert.deepEqual(names, FROZEN_NAME_BASELINE);
  assert.deepEqual(tree(roots.base), before);
});

requiredTest("all narrative routes block absent reader or entries and preserve filesystem", async ({ roots }) => {
  assert.equal(loadCallbackPlan.length, 3);
  assert.equal(planExemplars.length, 5);
  assert.equal(planNames.length, 7);
  assert.equal(planPedagogy.length, 6);
  assert.equal(planShapes.length, 7);
  const subject = setup(roots);
  await stage(subject.store, "missing-sidecar", fixtureFiles().filter((file) => file.logicalPath !== "sidecars/ch01.json"));
  const before = tree(roots.base);
  await assert.rejects(planExemplars(BOOK, 1, 1, subject.reader, "missing-sidecar"), /CANDIDATE_ENTRY_MISSING/);
  assert.deepEqual(tree(roots.base), before);
});

finishV25Tests().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
