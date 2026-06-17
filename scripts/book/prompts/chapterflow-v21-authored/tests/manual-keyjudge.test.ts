import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { makeChapter, PIPELINE_DIR, STATE_CHAPTERS, TMP_DIR, writeFixtureBook } from "./helpers.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import { openQcRound, qcRoundPath } from "../src/qc/qcRound.js";
import {
  checkManualKeyJudge,
  keyDerivationPath,
  keyPackDir,
  manualKeyJudgePath,
  resolveManualKeyJudges,
  validateAndWriteKeyDerivation,
  writeKeyPacks,
} from "../src/qc/manualKeyJudge.js";

const BOOK = "zz-fixture-manual-key";
const RUN = "20260612T000000Z";

function sourceSidecar(chapterNumber: number): any {
  return {
    schemaVersion: "source-v2",
    chapterNumber,
    chapterTitle: `Chapter ${chapterNumber}`,
    centralConcept: { id: `ch${chapterNumber}.concept`, name: "Fixture concept", plainDefinition: "A test concept with concrete checks." },
    keyClaims: ["The fixture claim holds."],
    namedExamples: [
      { id: `ch${chapterNumber}.ex.a`, label: "Case Alpha", summary: "Alpha shows the move.", hardSpecifics: ["Alpha", "1999"], realWorld: true },
      { id: `ch${chapterNumber}.ex.b`, label: "Case Beta", summary: "Beta shows the miss.", hardSpecifics: ["Beta", "Toronto"], realWorld: true },
      { id: `ch${chapterNumber}.ex.c`, label: "Case Gamma", summary: "Gamma shows the limit.", hardSpecifics: ["Gamma", "42"], realWorld: true },
    ],
    hardEdge: "Do not invert the fixture claim.",
    paraphraseNotes: "Synthetic notes for a unit test.",
    testableFacts: Array.from({ length: 9 }, (_, i) => ({
      id: `fact${i}`,
      claim: `Claim ${i} is true.`,
      becauseMechanism: `Because mechanism ${i} explains the fixture.`,
      commonError: `Mistake ${i} is plausible.`,
      errorIsWhy: `Mistake ${i} ignores the mechanism.`,
    })),
  };
}

function setup(): { chapter: ReturnType<typeof makeChapter>; tokens: ReturnType<typeof openQcRound>["tokens"]; roundId: string } {
  cleanup();
  mkdirSync(TMP_DIR, { recursive: true });
  const chapter = makeChapter(BOOK, 1);
  writeFixtureBook(STATE_CHAPTERS, [chapter]);
  const sourceDir = resolve(REPO_ROOT, ".chapterflow/runs", BOOK, RUN, "sidecars/source");
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(resolve(sourceDir, "ch01.source.json"), JSON.stringify(sourceSidecar(1), null, 2), "utf8");
  const roundId = "r-manual";
  const { tokens } = openQcRound(BOOK, roundId);
  writeKeyPacks(BOOK, roundId);
  return { chapter, tokens, roundId };
}

function cleanup(): void {
  rmSync(resolve(REPO_ROOT, ".chapterflow/runs", BOOK), { recursive: true, force: true });
  rmSync(resolve(TMP_DIR, `${BOOK}.answers.json`), { force: true });
  rmSync(keyPackDir(BOOK, "r-manual"), { recursive: true, force: true });
  rmSync(qcRoundPath(BOOK, "r-manual"), { force: true });
  rmSync(manualKeyJudgePath(BOOK, 1), { force: true });
  rmSync(keyDerivationPath(BOOK, "r-manual", "keyA"), { force: true });
  rmSync(keyDerivationPath(BOOK, "r-manual", "keyB"), { force: true });
  rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch01.v21-native.chapter.json`), { force: true });
}

function writeAnswers(chapter: ReturnType<typeof makeChapter>, wrong = false, partial = false, confidence: number | "low" | "medium" | "high" = 0.95, omitFacts = false): string {
  const answers = chapter.quiz.questions.map((q, i) => ({
    questionIndex: i,
    choiceIndex: wrong ? (q.correctIndex + 1) % 3 : q.correctIndex,
    confidence,
    reason: `The source fact fact${i} supports this choice because it matches the fixture mechanism and rejects the plausible error.`,
    sourceFactIds: omitFacts ? [] : [`fact${i}`],
  }));
  const payload = {
    chapters: [{
      chapterNumber: 1,
      packHash: JSON.parse(readFileSync(resolve(keyPackDir(BOOK, "r-manual"), "ch01.key-pack.json"), "utf8")).packHash,
      answers: partial ? answers.slice(0, 8) : answers,
    }],
  };
  const p = resolve(TMP_DIR, `${BOOK}.answers.json`);
  writeFileSync(p, JSON.stringify(payload, null, 2), "utf8");
  return p;
}

test("manual keyjudge: missing A/B derivations block", () => {
  try {
    setup();
    const result = resolveManualKeyJudges(BOOK, "r-manual");
    assert.equal(result.records[0].status, "BLOCK");
    assert.match(result.records[0].reason, /missing keyA\/keyB/);
  } finally {
    cleanup();
  }
});

test("manual keyjudge: answer reasons are required and must be substantial", () => {
  try {
    const { chapter, tokens, roundId } = setup();
    const answers = writeAnswers(chapter);
    const raw = JSON.parse(readFileSync(answers, "utf8"));
    raw.chapters[0].answers[0].reason = "too short";
    writeFileSync(answers, JSON.stringify(raw, null, 2), "utf8");
    const result = validateAndWriteKeyDerivation(BOOK, roundId, "keyA", tokens.keyA, answers);
    assert.ok(result.errors.some((e) => /reason must be at least 40/.test(e)), result.errors.join("\n"));
  } finally {
    cleanup();
  }
});

test("manual keyjudge: keyA + keyB clean agreement passes", () => {
  try {
    const { chapter, tokens, roundId } = setup();
    const answers = writeAnswers(chapter);
    assert.deepEqual(validateAndWriteKeyDerivation(BOOK, roundId, "keyA", tokens.keyA, answers).errors, []);
    assert.deepEqual(validateAndWriteKeyDerivation(BOOK, roundId, "keyB", tokens.keyB, answers).errors, []);
    const result = resolveManualKeyJudges(BOOK, roundId);
    assert.equal(result.records[0].status, "PASS");
    assert.deepEqual(checkManualKeyJudge(chapter, true), []);
  } finally {
    cleanup();
  }
});

test("manual keyjudge: keyA + keyB derived in the SAME session block under enforcement; distinct sessions pass", () => {
  const prevEnforce = process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
  const prevSession = process.env.CHAPTERFLOW_SESSION_ID;
  try {
    const { chapter, tokens, roundId } = setup();
    const answers = writeAnswers(chapter);
    process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE = "1";
    // Same session derives BOTH "blind" keys → they are not independent → BLOCK.
    process.env.CHAPTERFLOW_SESSION_ID = "qc-keys-shared";
    assert.deepEqual(validateAndWriteKeyDerivation(BOOK, roundId, "keyA", tokens.keyA, answers).errors, []);
    assert.deepEqual(validateAndWriteKeyDerivation(BOOK, roundId, "keyB", tokens.keyB, answers).errors, []);
    let result = resolveManualKeyJudges(BOOK, roundId);
    assert.equal(result.records[0].status, "BLOCK");
    assert.match(result.records[0].reason, /SAME session/);

    // Re-derive keyB in a DISTINCT session → independence restored → PASS.
    process.env.CHAPTERFLOW_SESSION_ID = "qc-keyB-distinct";
    assert.deepEqual(validateAndWriteKeyDerivation(BOOK, roundId, "keyB", tokens.keyB, answers).errors, []);
    result = resolveManualKeyJudges(BOOK, roundId);
    assert.equal(result.records[0].status, "PASS");
  } finally {
    if (prevEnforce === undefined) delete process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
    else process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE = prevEnforce;
    if (prevSession === undefined) delete process.env.CHAPTERFLOW_SESSION_ID;
    else process.env.CHAPTERFLOW_SESSION_ID = prevSession;
    cleanup();
  }
});

test("manual keyjudge: keyA + keyB agreeing against the stored key records CORRUPTION", () => {
  try {
    const { chapter, tokens, roundId } = setup();
    const answers = writeAnswers(chapter, true);
    assert.deepEqual(validateAndWriteKeyDerivation(BOOK, roundId, "keyA", tokens.keyA, answers).errors, []);
    assert.deepEqual(validateAndWriteKeyDerivation(BOOK, roundId, "keyB", tokens.keyB, answers).errors, []);
    const result = resolveManualKeyJudges(BOOK, roundId);
    assert.equal(result.records[0].status, "CORRUPTION");
    assert.equal(checkManualKeyJudge(chapter, true)[0].checkId, "QC2.manual_keyjudge_not_pass");
  } finally {
    cleanup();
  }
});

test("manual keyjudge: low confidence forces adjudication even when readers agree with stored key", () => {
  try {
    const { chapter, tokens, roundId } = setup();
    const answers = writeAnswers(chapter, false, false, "low");
    assert.deepEqual(validateAndWriteKeyDerivation(BOOK, roundId, "keyA", tokens.keyA, answers).errors, []);
    assert.deepEqual(validateAndWriteKeyDerivation(BOOK, roundId, "keyB", tokens.keyB, answers).errors, []);
    const result = resolveManualKeyJudges(BOOK, roundId);
    assert.equal(result.records[0].status, "NEEDS_ADJUDICATION");
    assert.match(result.records[0].reason, /low confidence|adjudication/);
  } finally {
    cleanup();
  }
});

test("manual keyjudge: medium confidence can pass only when both readers and stored key agree with source facts", () => {
  try {
    const { chapter, tokens, roundId } = setup();
    const answers = writeAnswers(chapter, false, false, "medium");
    assert.deepEqual(validateAndWriteKeyDerivation(BOOK, roundId, "keyA", tokens.keyA, answers).errors, []);
    assert.deepEqual(validateAndWriteKeyDerivation(BOOK, roundId, "keyB", tokens.keyB, answers).errors, []);
    const result = resolveManualKeyJudges(BOOK, roundId);
    assert.equal(result.records[0].status, "PASS");
  } finally {
    cleanup();
  }
});

test("manual keyjudge: medium confidence against stored key needs adjudication, not immediate corruption", () => {
  try {
    const { chapter, tokens, roundId } = setup();
    const answers = writeAnswers(chapter, true, false, "medium");
    assert.deepEqual(validateAndWriteKeyDerivation(BOOK, roundId, "keyA", tokens.keyA, answers).errors, []);
    assert.deepEqual(validateAndWriteKeyDerivation(BOOK, roundId, "keyB", tokens.keyB, answers).errors, []);
    const result = resolveManualKeyJudges(BOOK, roundId);
    assert.equal(result.records[0].status, "NEEDS_ADJUDICATION");
  } finally {
    cleanup();
  }
});

test("manual keyjudge: partial answer file blocks derivation", () => {
  try {
    const { chapter, tokens, roundId } = setup();
    const answers = writeAnswers(chapter, false, true);
    const result = validateAndWriteKeyDerivation(BOOK, roundId, "keyA", tokens.keyA, answers);
    assert.ok(result.errors.some((e) => /partial answer coverage/.test(e)), result.errors.join("\n"));
  } finally {
    cleanup();
  }
});

test("manual keyjudge: stale content hash blocks a previously clean record", () => {
  try {
    const { chapter, tokens, roundId } = setup();
    const answers = writeAnswers(chapter);
    validateAndWriteKeyDerivation(BOOK, roundId, "keyA", tokens.keyA, answers);
    validateAndWriteKeyDerivation(BOOK, roundId, "keyB", tokens.keyB, answers);
    assert.equal(resolveManualKeyJudges(BOOK, roundId).records[0].status, "PASS");
    const edited = structuredClone(chapter);
    edited.title = `${edited.title} edited`;
    assert.equal(checkManualKeyJudge(edited, true)[0].checkId, "QC2.manual_keyjudge_stale");
  } finally {
    cleanup();
  }
});
