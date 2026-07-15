/** reader-gold-dev-docs — key-free rendering + selection binding (Phase 2b).
 * Proves: no quiz-key surface leaks into a reader document; docs bind the
 * frozen selection (absent/tampered selection fails closed); deterministic
 * create-once materialization against the REAL frozen pool. */

import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  buildReaderGoldDevDocs,
  renderKeyFreeReaderDocument,
} from "../src/bakeoff/migration/readerGoldDevDocs.js";
import { READER_GOLD_DEV_POOL_MANIFEST_REL_PATH } from "../src/bakeoff/migration/readerGoldDevPool.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");

const CHAPTER = {
  number: 3,
  title: "Test Chapter",
  hook: "A hook.",
  counterintuition: "A twist.",
  tryThisNow: "Try it.",
  keyTakeaway: "Take it away.",
  breakdown: { fastRead: "Fast.", deepRead: "Deep.", fullRead: "Full." },
  examples: [{ title: "Ex", scenario: "S", whatToDo: "W", whyItMatters: "M" }],
  quiz: {
    questions: [{
      prompt: "Which?",
      choices: ["first", "second", "third"],
      correctIndex: 1,
      explanation: "SECRET-KEY-RATIONALE the second is right",
    }],
  },
  reviewCards: [{ front: "F", back: "B" }],
  implementationPlan: {
    coreSkill: "C",
    ifThenPlans: [{ context: "commute", plan: "if x then y" }],
    twentyFourHourChallenge: "24h",
    weeklyPractice: "weekly",
  },
  memorableLines: [{ text: "memorable" }],
};

test("key-free rendering: prompts and choices present, key surface and explanation absent", () => {
  const doc = renderKeyFreeReaderDocument({ bookId: "test-book", chapter: CHAPTER });
  assert.ok(doc.includes("Which?"));
  assert.ok(doc.includes("a) first") && doc.includes("b) second") && doc.includes("c) third"));
  assert.ok(!doc.includes("SECRET-KEY-RATIONALE"), "quiz key explanation must never reach a reader document");
  assert.ok(!doc.includes("correctIndex"));
  assert.ok(doc.includes("## Review cards") && doc.includes("Back: B"), "review cards are reader-visible content");
  assert.ok(doc.includes("If-then (commute): if x then y"), "if-then plans render context and plan text");
});

test("serialization-leak regression (Adjudicator B, 2026-07-15): object interpolation fails closed", () => {
  const corrupted = structuredClone(CHAPTER) as unknown as {
    memorableLines: Array<{ text: unknown }>;
  };
  corrupted.memorableLines = [{ text: { nested: "object" } }];
  assert.throws(
    () => renderKeyFreeReaderDocument({ bookId: "test-book", chapter: corrupted as never }),
    /serialization leak/,
    "a non-string field reaching the template must fail the build, never ship [object Object]");
  const realDocs = buildReaderGoldDevDocs({ repositoryRoot: REPOSITORY_ROOT });
  for (const [relPath, document] of realDocs.documents) {
    assert.ok(!document.includes("[object Object]"), `${relPath} contains a serialization leak`);
  }
});

test("docs bind the REAL frozen selection: 24 docs, per-doc hashes, selection pin", () => {
  const built = buildReaderGoldDevDocs({ repositoryRoot: REPOSITORY_ROOT });
  assert.equal(built.manifest.docs.length, 24);
  assert.match(built.manifest.selectionSha256, /^[a-f0-9]{64}$/);
  const again = buildReaderGoldDevDocs({ repositoryRoot: REPOSITORY_ROOT });
  assert.deepEqual(built.manifest, again.manifest, "doc build must be deterministic");
  for (const doc of built.manifest.docs) {
    assert.ok((built.documents.get(doc.relPath) ?? "").length > 500, `${doc.relPath} suspiciously small`);
  }
});

test("a missing or tampered frozen selection fails closed before any prose is rendered", () => {
  const root = mkdtempSync(resolve(tmpdir(), "reader-gold-docs-"));
  try {
    assert.throws(() => buildReaderGoldDevDocs({ repositoryRoot: root }), /selection manifest must exist/);
    const selectionPath = resolve(root, READER_GOLD_DEV_POOL_MANIFEST_REL_PATH);
    mkdirSync(dirname(selectionPath), { recursive: true });
    const real = readFileSync(resolve(REPOSITORY_ROOT, READER_GOLD_DEV_POOL_MANIFEST_REL_PATH), "utf8");
    writeFileSync(selectionPath, real.replace("\"totalSelected\": 24", "\"totalSelected\": 23"));
    assert.throws(() => buildReaderGoldDevDocs({ repositoryRoot: root }), /invalid/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
