import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR, STATE_CHAPTERS, TMP_DIR, cleanTmp, makeChapter } from "./helpers.js";
import { buildChapterCacheInputs, generateChapter } from "../src/generateChapter.js";
import {
  currentProviderIdentity,
  stringDependency,
  validateStageCache,
  writeStageCacheManifest,
} from "../src/cache/stageCache.js";
import type { BookMeta, ChapterSpec } from "../src/generateChapter.js";
import type { ChapterV21 } from "../src/types.js";

const BOOK = "zz-cache-validation";
const CHAPTER_ID = `${BOOK}-ch01`;
const CHAPTER_PATH = resolve(STATE_CHAPTERS, `${CHAPTER_ID}.v21-native.chapter.json`);
const LEDGER_PATH = resolve(PIPELINE_DIR, "state", "library-state.json");
const INDEX_PATH = resolve(PIPELINE_DIR, "state", "indexes", `${BOOK}.json`);
const BOOK_META: BookMeta = { bookId: BOOK, title: "Cache Validation Fixture", author: "Test Author" };

function chapterSpec(title = "The harbor principle"): ChapterSpec {
  return { chapterId: CHAPTER_ID, chapterNumber: 1, chapterTitle: title };
}

function snapshot(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function restore(path: string, value: string | null): void {
  if (value === null) {
    rmSync(path, { force: true });
  } else {
    writeFileSync(path, value, "utf8");
  }
}

function cleanup(): void {
  rmSync(CHAPTER_PATH, { force: true });
  rmSync(`${CHAPTER_PATH}.cache-manifest.json`, { force: true });
  rmSync(INDEX_PATH, { force: true });
}

async function withEnv<T>(updates: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const prior = Object.fromEntries(Object.keys(updates).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function writeIndex(spec = chapterSpec()): void {
  mkdirSync(resolve(PIPELINE_DIR, "state", "indexes"), { recursive: true });
  writeFileSync(INDEX_PATH, JSON.stringify([spec], null, 2), "utf8");
}

function cacheCleanChapter(): ChapterV21 {
  const chapter = makeChapter(BOOK, 1, { overrides: { memorableLines: undefined } });
  const formats = ["decision_point", "dialogue", "postmortem", "audit", "text_thread", "mistake_recovery"];
  const names = ["Avery", "Bianca", "Corin", "Devon", "Iris", "Jules"];
  const places = ["Riverside clinic", "North Pier warehouse", "Maple Street school", "Cedar credit union", "Union kitchen", "Westline studio"];
  const titles = ["A triage log before lunch", "A freight note at sunrise", "A classroom roster correction", "A loan packet before approval", "A catering count under deadline", "A studio invoice before delivery"];
  const scenarios = [
    "Avery leans over the Riverside clinic intake counter while a waiting-room aide asks whether the next patient can move. The bracelet count and the blue paper slip disagree, so Avery circles the older slip and checks the timestamp before anyone changes rooms.",
    "Bianca stands beside a North Pier pallet scale as a driver taps the bill of lading with a pen. The crate label says forty-two, the receiving note says forty-one, and Bianca opens the earlier note before signing the dock tablet.",
    "Corin holds Maple Street school's dismissal clipboard while the bus line starts forming near the gym door. One pickup name appears twice, so Corin calls the classroom aide and waits for the roster count before releasing the line.",
    "Devon reviews a Cedar credit union packet with an approval queue blinking on the monitor. The income worksheet and summary field disagree, so Devon flags the worksheet row and pauses the approval until the source note is checked.",
    "Iris counts plates in the Union kitchen while a runner asks whether service can begin. The ticket rail lists one more entree than the tray, so Iris recounts the rail before calling the room lead.",
    "Jules checks a Westline studio delivery folder as the client waits for final files. The invoice lists a motion cut that is absent from the export checklist, so Jules matches the two lists before sending the link.",
  ];
  chapter.examples = chapter.examples.map((ex, i) => ({
    ...ex,
    title: titles[i],
    tags: [formats[i], "practice"],
    planSpec: {
      ...ex.planSpec,
      format: formats[i],
      domain: ["clinic intake reconciliation", "warehouse receiving audit", "school roster handoff", "credit union approval queue", "catering prep count", "design studio billing review"][i],
      audience: "a careful operator",
      stakes: ["wrong patient routing", "lost inventory", "missed student pickup", "bad loan approval", "short event order", "unpaid client work"][i],
      requiredBeat: [
        "the clerk checks yesterday's paper slip before adding a new intake",
        "the receiver opens the crate note before signing the pallet through",
        "the teacher pauses the pickup list before sending children outside",
        "the analyst compares the stated income note before approving the file",
        "the cook counts plated meals before calling the runner",
        "the producer matches the invoice line before sending final files",
      ][i],
    },
    scenario: scenarios[i],
    whatToDo: `${names[i]} pauses the handoff, compares the visible record with the source note, marks the first mismatch, and resumes only after the cause is named.`,
    whyItMatters: `The ${places[i].toLowerCase()} check keeps one small record error from becoming a larger cleanup job for the next team.`,
  }));
  chapter.quiz.questions = Array.from({ length: 9 }, (_, i) => ({
    questionId: `q${String(i + 1).padStart(2, "0")}`,
    prompt: [
      "A nurse sees two intake totals before opening the waiting room. What is the best first move?",
      "A warehouse receiver finds a pallet count that conflicts with yesterday's note. What protects the handoff?",
      "A teacher sees the pickup roster and classroom count disagree. What should happen before dismissal?",
      "A loan analyst notices income notes that do not match the summary. What is the right sequence?",
      "A kitchen lead sees plated meals and tickets disagree before service. What should they do?",
      "A studio producer spots a mismatch between invoice and delivery checklist. What comes first?",
      "A volunteer coordinator sees badge counts differ from the signup sheet. What is the safest response?",
      "A lab assistant sees freezer labels and sample rows diverge. What should happen before storage?",
      "A dispatcher sees route totals disagree with the fuel log. What keeps the error small?",
    ][i],
    choices: [
      ["Compare the intake total with the source slip before moving anyone.", "Open the room and fix the total at closing time.", "Ask the last clerk to remember the number."],
      ["Trace the pallet count to the earlier note before signing.", "Average both counts and accept the shipment.", "Let the driver decide which count is newer."],
      ["Hold the line, compare the roster to the classroom count, then release.", "Send everyone outside and correct the paper later.", "Trust the printed roster because it looks official."],
      ["Check the income note against the summary before approving.", "Approve first and request documents tomorrow.", "Choose the larger number to reduce friction."],
      ["Recount plates against tickets before calling service ready.", "Serve now and comp the missing meals later.", "Ask guests to report problems themselves."],
      ["Match invoice lines to deliverables before sending files.", "Send the files and revise the invoice next week.", "Remove the confusing line without checking it."],
      ["Compare badges with the signup sheet before opening doors.", "Hand out spare badges and reconcile after lunch.", "Let each team estimate its own attendance."],
      ["Stop storage, compare labels to rows, and isolate the mismatch.", "Freeze everything now and audit during cleanup.", "Rewrite the label that looks least tidy."],
      ["Compare route totals with the fuel log before dispatch.", "Send the route and ask drivers to text corrections.", "Use the average because both systems are close."],
    ][i],
    correctIndex: 0,
    explanation: [
      "The intake slip is the cheapest place to catch the drift before it touches a patient.",
      "The earlier note is the source record, so checking it prevents a bad receiving handoff.",
      "Roster drift becomes dangerous at release, so the count must match before movement.",
      "Approval should wait until the summary agrees with the underlying note.",
      "Meal counts are cheapest to fix before service starts and roles scatter.",
      "Delivery should wait until billing and files describe the same work.",
      "Door opening amplifies a badge error, so the sheet check comes first.",
      "Sample storage must pause until the label and row identify the same material.",
      "Dispatch multiplies a route error, so the fuel log comparison belongs first.",
    ][i],
    bloomsLevel: "apply",
    depthLevel: "standard",
  }));
  chapter.reviewCards = Array.from({ length: 6 }, (_, i) => ({
    cardId: `card${String(i + 1).padStart(2, "0")}`,
    front: ["What record should Avery check before opening intake?", "What protects Bianca's freight handoff?", "When should Corin release the class line?", "What must Devon compare before approving the packet?", "What does Iris count before service starts?", "What should Jules match before sending files?"][i],
    back: ["The prior source slip, because intake drift is cheapest before any patient is routed.", "The earlier receiving note, because signing turns a small mismatch into inventory drift.", "Only after roster and classroom count agree, because movement makes the error harder to see.", "The income note against the summary, because approval should not rest on a copied number.", "Plates against tickets, because service pressure hides the cause once orders leave.", "Invoice lines against deliverables, because a clean send should describe the actual work."][i],
    difficulty: (["easy", "medium", "hard"] as const)[i % 3],
  }));
  return chapter;
}

function writeCachedChapter(chapter: ChapterV21): void {
  mkdirSync(STATE_CHAPTERS, { recursive: true });
  writeFileSync(CHAPTER_PATH, JSON.stringify(chapter, null, 2), "utf8");
  writeStageCacheManifest({
    artifactPath: CHAPTER_PATH,
    artifactType: "chapter",
    artifactId: CHAPTER_ID,
    inputs: buildChapterCacheInputs(BOOK_META, chapterSpec(chapter.title), currentProviderIdentity("writer")),
    generatorName: "generateChapter",
    provider: currentProviderIdentity("writer"),
  });
}

test("valid unchanged cached chapter reuses without provider call while gates still run", async () => {
  const ledger = snapshot(LEDGER_PATH);
  const previousProvider = process.env.CHAPTERFLOW_PROVIDER;
  const previousAllow = process.env.CHAPTERFLOW_ALLOW_MODEL_GEN;
  try {
    cleanup();
    writeIndex();
    await withEnv({ CHAPTERFLOW_PROVIDER: "openai-api", CHAPTERFLOW_ALLOW_MODEL_GEN: undefined }, () => {
      writeCachedChapter(cacheCleanChapter());
    });

    const produced = await withEnv({ CHAPTERFLOW_PROVIDER: "openai-api", CHAPTERFLOW_ALLOW_MODEL_GEN: undefined }, () =>
      generateChapter(BOOK_META, chapterSpec(), { logger: () => {} }),
    );

    assert.equal(produced.chapterId, CHAPTER_ID);
    const after = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
    assert.deepEqual(after.books[BOOK].chaptersIngested, [1], "validated cache is ingested after gates pass");
  } finally {
    cleanup();
    restore(LEDGER_PATH, ledger);
    if (previousProvider === undefined) delete process.env.CHAPTERFLOW_PROVIDER;
    else process.env.CHAPTERFLOW_PROVIDER = previousProvider;
    if (previousAllow === undefined) delete process.env.CHAPTERFLOW_ALLOW_MODEL_GEN;
    else process.env.CHAPTERFLOW_ALLOW_MODEL_GEN = previousAllow;
  }
});

test("fresh manifest cannot bless ship-failing cached chapter", async () => {
  const ledger = snapshot(LEDGER_PATH);
  try {
    cleanup();
    writeIndex();
    const broken = cacheCleanChapter();
    broken.quiz.questions[0].correctIndex = 9;
    writeCachedChapter(broken);

    await assert.rejects(
      () => generateChapter(BOOK_META, chapterSpec(), { logger: () => {} }),
      /ship gate|A5|current-gates|stale cache/i,
    );
    const after = existsSync(LEDGER_PATH) ? JSON.parse(readFileSync(LEDGER_PATH, "utf8")) : { books: {} };
    assert.equal(after.books?.[BOOK], undefined, "gate-failing cache must not mutate library state");
  } finally {
    cleanup();
    restore(LEDGER_PATH, ledger);
  }
});

test("cache invalidation names each changed dependency", () => {
  cleanTmp();
  mkdirSync(TMP_DIR, { recursive: true });
  const artifactPath = resolve(TMP_DIR, "stage-cache-artifact.json");
  writeFileSync(artifactPath, JSON.stringify({ ok: true }), "utf8");
  const provider = { tier: "writer" as const, provider: "anthropic-cli" as const, model: "model-a" };
  const baseInputs = [
    stringDependency("source:ch01", "source-a"),
    stringDependency("prompt:writer-hook.system.md", "prompt-a"),
    stringDependency("config:critic-rubric.json", "config-a"),
    stringDependency("chapter-plan:manual", "plan-a"),
    stringDependency("stage-cache-schema-version", "schema-a"),
  ];
  writeStageCacheManifest({
    artifactPath,
    artifactType: "support",
    artifactId: "fixture",
    inputs: baseInputs,
    generatorName: "test-generator",
    provider,
    codeVersion: "code-a",
  });

  const cases: Array<{ name: string; changed: string; inputs?: typeof baseInputs; provider?: typeof provider; codeVersion?: string }> = [
    { name: "source", changed: "source:ch01", inputs: [stringDependency("source:ch01", "source-b"), ...baseInputs.slice(1)] },
    { name: "prompt", changed: "prompt:writer-hook.system.md", inputs: [baseInputs[0], stringDependency("prompt:writer-hook.system.md", "prompt-b"), ...baseInputs.slice(2)] },
    { name: "config", changed: "config:critic-rubric.json", inputs: [baseInputs[0], baseInputs[1], stringDependency("config:critic-rubric.json", "config-b"), ...baseInputs.slice(3)] },
    { name: "plan", changed: "chapter-plan:manual", inputs: [...baseInputs.slice(0, 3), stringDependency("chapter-plan:manual", "plan-b"), baseInputs[4]] },
    { name: "schema", changed: "stage-cache-schema-version", inputs: [...baseInputs.slice(0, 4), stringDependency("stage-cache-schema-version", "schema-b")] },
    { name: "model", changed: "model", provider: { ...provider, model: "model-b" } },
    { name: "code", changed: "generator-code-version", codeVersion: "code-b" },
  ];

  for (const c of cases) {
    const result = validateStageCache({
      artifactPath,
      artifactType: "support",
      artifactId: "fixture",
      inputs: c.inputs ?? baseInputs,
      generatorName: "test-generator",
      provider: c.provider ?? provider,
      codeVersion: c.codeVersion ?? "code-a",
    });
    assert.equal(result.ok, false, `${c.name} change should invalidate`);
    assert.ok(!result.ok && result.changedDependencies.includes(c.changed), `${c.name} should report ${c.changed}, got ${!result.ok ? result.changedDependencies.join(", ") : "ok"}`);
  }
  cleanTmp();
});

test("valid manifest with corrupted output file fails integrity validation", async () => {
  const ledger = snapshot(LEDGER_PATH);
  try {
    cleanup();
    writeIndex();
    writeCachedChapter(cacheCleanChapter());
    writeFileSync(CHAPTER_PATH, "{ not valid json", "utf8");

    await assert.rejects(
      () => generateChapter(BOOK_META, chapterSpec(), { logger: () => {} }),
      /output hash changed|stale cache/i,
    );
    const after = existsSync(LEDGER_PATH) ? JSON.parse(readFileSync(LEDGER_PATH, "utf8")) : { books: {} };
    assert.equal(after.books?.[BOOK], undefined, "corrupted output must not mutate library state");
  } finally {
    cleanup();
    restore(LEDGER_PATH, ledger);
  }
});

test("invalid cached chapter is rejected before library-state ingestion", async () => {
  const ledger = snapshot(LEDGER_PATH);
  try {
    cleanup();
    const broken = makeChapter(BOOK, 1, {
      overrides: {
        quiz: {
          passingScorePercent: 70,
          questions: [
            {
              questionId: "q01",
              prompt: "What should the reader do when the cache validator is checking a malformed question?",
              choices: ["Use it anyway", "Reject the stale artifact", "Silently add it to the ledger"],
              correctIndex: 9,
              explanation: "The cache validator must run the current deterministic gate before accepting resumed content.",
              bloomsLevel: "apply",
              depthLevel: "standard",
            },
          ],
        },
      },
    });
    writeFileSync(CHAPTER_PATH, JSON.stringify(broken, null, 2), "utf8");

    await assert.rejects(
      () =>
        generateChapter(
          BOOK_META,
          chapterSpec(broken.title),
          { logger: () => {} },
        ),
      /stale cache|cache invalid|Ship gate|A5/i,
    );

    const after = existsSync(LEDGER_PATH) ? JSON.parse(readFileSync(LEDGER_PATH, "utf8")) : { books: {} };
    assert.equal(after.books?.[BOOK], undefined, "invalid cache must not mutate library state");
  } finally {
    cleanup();
    restore(LEDGER_PATH, ledger);
  }
});
