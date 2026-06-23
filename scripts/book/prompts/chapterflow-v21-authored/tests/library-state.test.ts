import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { chapterContentHash } from "../src/critics/qcAttestation.js";
import {
  acquireLibraryLease,
  createEmptyLibraryState,
  ingestChapter,
  LibraryStateLockError,
  loadLibraryState,
  rebuildLibraryState,
  removeChapterContribution,
  saveLibraryState,
  verifyLibraryState,
  type LibraryState,
  type LibraryStateOptions,
} from "../src/librarian/libraryState.js";
import { buildAuthoringGuardrails, formatGuardrails } from "../src/librarian/authoringGuardrails.js";
import { loadNameBank, planNames } from "../src/librarian/namePlan.js";
import { test } from "./harness.js";
import { makeChapter, TMP_DIR } from "./helpers.js";

function tempState(name: string): { stateDir: string; bookPackagesDir: string } {
  const stateDir = resolve(TMP_DIR, "library-state", name);
  rmSync(stateDir, { recursive: true, force: true });
  mkdirSync(resolve(stateDir, "name-plans"), { recursive: true });
  mkdirSync(resolve(stateDir, "chapters"), { recursive: true });
  const bookPackagesDir = resolve(stateDir, "book-packages");
  mkdirSync(bookPackagesDir, { recursive: true });
  return { stateDir, bookPackagesDir };
}

function writeNamePlan(stateDir: string, bookId: string, allocation: Record<number, string[]>): void {
  mkdirSync(resolve(stateDir, "name-plans"), { recursive: true });
  writeFileSync(
    resolve(stateDir, "name-plans", `${bookId}.name-plan.json`),
    JSON.stringify(
      {
        bookId,
        fromChapter: Math.min(...Object.keys(allocation).map(Number)),
        toChapter: Math.max(...Object.keys(allocation).map(Number)),
        perChapter: 7,
        allocation,
      },
      null,
      2,
    ),
    "utf8",
  );
}

function namedChapter(bookId: string, n: number, name: string, correctIndex: number, phrase: string) {
  const base = makeChapter(bookId, n);
  return makeChapter(bookId, n, {
    overrides: {
      examples: [
        {
          ...base.examples[0],
          scenario: `${name} checks the clinic log before adding a new entry.`,
        },
      ],
      quiz: {
        passingScorePercent: 70,
        questions: [
          {
            questionId: "q01",
            prompt: `Which check belongs first for ${name}?`,
            choices: ["choice zero", "choice one", "choice two"],
            correctIndex,
            explanation: phrase,
            bloomsLevel: "apply",
            depthLevel: "standard",
          },
        ],
      },
    },
  });
}

function contributionAnswerSum(state: LibraryState): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  for (const book of Object.values(state.books)) {
    for (const c of Object.values(book.chapterContributions)) {
      out[0] += c.answerPositionCounts[0];
      out[1] += c.answerPositionCounts[1];
      out[2] += c.answerPositionCounts[2];
    }
  }
  return out;
}

function quietWarn<T>(fn: () => T): T {
  const oldWarn = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = oldWarn;
  }
}

test("live library leases cannot be stolen after the stale timeout", async () => {
  const { stateDir } = tempState("live-lock");
  let clock = 0;
  const base: LibraryStateOptions = {
    stateDir,
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    hostname: "test-host",
    lock: { leaseMs: 10_000, staleAfterMs: 10_000, maxWaitMs: 50, pollMs: 10, heartbeatMs: 0 },
  };

  const leaseA = await acquireLibraryLease({
    ...base,
    pid: 101,
    randomToken: () => "owner-a",
  });
  clock = 11_000;
  await assert.rejects(
    () => acquireLibraryLease({
      ...base,
      pid: 202,
      randomToken: () => "owner-b",
      ownerLiveness: (record) => record.token === "owner-a" ? "alive" : "unknown",
    }),
    LibraryStateLockError,
  );
  const lock = JSON.parse(readFileSync(resolve(stateDir, "library-state.json.lock"), "utf8"));
  assert.equal(lock.token, "owner-a");
  assert.equal(leaseA.release(), true);
});

test("dead-owner recovery can hand off the lease, and the old owner cannot release the successor", async () => {
  const { stateDir } = tempState("dead-lock");
  let clock = 0;
  const base: LibraryStateOptions = {
    stateDir,
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    hostname: "test-host",
    lock: { leaseMs: 10_000, staleAfterMs: 10_000, maxWaitMs: 50, pollMs: 10, heartbeatMs: 0 },
  };

  const leaseA = await acquireLibraryLease({ ...base, pid: 101, randomToken: () => "owner-a" });
  clock = 11_000;
  const leaseB = await acquireLibraryLease({
    ...base,
    pid: 202,
    randomToken: () => "owner-b",
    ownerLiveness: (record) => record.token === "owner-a" ? "dead" : "alive",
  });

  assert.equal(leaseA.release(), false);
  let lock = JSON.parse(readFileSync(resolve(stateDir, "library-state.json.lock"), "utf8"));
  assert.equal(lock.token, "owner-b");
  assert.equal(leaseB.release(), true);
  assert.equal(existsSync(resolve(stateDir, "library-state.json.lock")), false);

  const journal = readFileSync(resolve(stateDir, "library-state.json.journal.jsonl"), "utf8");
  assert.match(journal, /library-lock-recovery-v1/);
});

test("stale locks with unknowable owner liveness fail safely", async () => {
  const { stateDir } = tempState("unknown-lock");
  let clock = 0;
  const base: LibraryStateOptions = {
    stateDir,
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    hostname: "test-host",
    lock: { leaseMs: 10_000, staleAfterMs: 10_000, maxWaitMs: 50, pollMs: 10, heartbeatMs: 0 },
  };
  const leaseA = await acquireLibraryLease({ ...base, pid: 101, randomToken: () => "owner-a", hostname: "remote-host" });
  clock = 11_000;
  await assert.rejects(
    () => acquireLibraryLease({ ...base, pid: 202, randomToken: () => "owner-b", ownerLiveness: () => "unknown" }),
    /owner liveness is unknowable/,
  );
  assert.equal(leaseA.release(), true);
});

test("ingesting a revised chapter replaces old names, phrases, answers, and content hash exactly once", () => {
  const { stateDir } = tempState("revision");
  const opts: LibraryStateOptions = { stateDir, now: () => 0 };
  const state = createEmptyLibraryState(opts);
  const v1 = namedChapter("zz-library-revision", 1, "Marta", 0, "The feeling is not evidence when the log is drifting.");
  const v2 = namedChapter("zz-library-revision", 1, "Nadia", 1, "Difficulty alerts the team that the log needs evidence.");

  writeNamePlan(stateDir, "zz-library-revision", { 1: ["Marta"] });
  ingestChapter(state, "zz-library-revision", "Revision Fixture", "Test Author", v1, opts);
  const oldHash = chapterContentHash(v1);

  writeNamePlan(stateDir, "zz-library-revision", { 1: ["Nadia"] });
  ingestChapter(state, "zz-library-revision", "Revision Fixture", "Test Author", v2, opts);
  ingestChapter(state, "zz-library-revision", "Revision Fixture", "Test Author", v2, opts);

  const book = state.books["zz-library-revision"];
  assert.deepEqual(book.namesUsed, ["Nadia"]);
  assert.deepEqual(book.answerPositionCounts, [0, 1, 0]);
  assert.deepEqual(state.globalAnswerPositionCounts, [0, 1, 0]);
  assert.equal(state.globalPhraseUsage["the feeling is not evidence"], undefined);
  assert.equal(state.globalPhraseUsage["difficulty alerts"]?.total, 1);
  assert.equal(book.chapterContributions["1"].contentHash, chapterContentHash(v2));
  assert.notEqual(book.chapterContributions["1"].contentHash, oldHash);

  removeChapterContribution(state, "zz-library-revision", 1, opts);
  assert.equal(state.books["zz-library-revision"], undefined);
  assert.deepEqual(state.globalAnswerPositionCounts, [0, 0, 0]);
});

test("rebuild from authoritative fixtures is logically equivalent to incremental state", async () => {
  const { stateDir, bookPackagesDir } = tempState("rebuild");
  const bookId = "zz-library-rebuild";
  const opts: LibraryStateOptions = {
    stateDir,
    bookPackagesDir,
    bookMetadata: { [bookId]: { title: "Rebuild Fixture", author: "Test Author" } },
    now: () => 0,
    lock: { heartbeatMs: 0 },
  };
  const chapter = namedChapter(bookId, 1, "Iris", 2, "Ease disarms the team unless the evidence is checked.");
  writeNamePlan(stateDir, bookId, { 1: ["Iris"] });
  writeFileSync(resolve(stateDir, "chapters", `${bookId}-ch01.v21-native.chapter.json`), JSON.stringify(chapter, null, 2), "utf8");

  const incremental = createEmptyLibraryState(opts);
  ingestChapter(incremental, bookId, "Rebuild Fixture", "Test Author", chapter, opts);
  await saveLibraryState(incremental, opts);

  const rebuilt = rebuildLibraryState(opts);
  assert.deepEqual(rebuilt.globalAnswerPositionCounts, incremental.globalAnswerPositionCounts);
  assert.deepEqual(rebuilt.books[bookId].chapterContributions, incremental.books[bookId].chapterContributions);
  assert.equal(verifyLibraryState(opts).drift, false);
});

test("planner and guardrails use the same catalog cooldown name policy", async () => {
  const { stateDir, bookPackagesDir } = tempState("name-policy");
  const newBook = "zz-library-policy-new";
  const priorBook = "zz-library-policy-prior";
  const opts: LibraryStateOptions = { stateDir, bookPackagesDir, now: () => 0, lock: { heartbeatMs: 0 } };

  const candidate = quietWarn(() => planNames(newBook, 1, 1, 7, { stateDir, forceFresh: true })).allocation[1][0];
  assert.ok(candidate, "fixture needs at least one dealable name");

  writeNamePlan(stateDir, priorBook, { 1: [candidate] });
  const prior = namedChapter(priorBook, 1, candidate, 0, "The feeling is not evidence.");
  const state = createEmptyLibraryState(opts);
  ingestChapter(state, priorBook, "Prior Fixture", "Test Author", prior, opts);
  await saveLibraryState(state, opts);

  const planned = quietWarn(() => planNames(newBook, 1, 1, loadNameBank().length, { stateDir, forceFresh: true }));
  assert.ok(!planned.allocation[1].includes(candidate), `${candidate} must be blocked by the shared cooldown policy`);
  assert.equal(planned.diagnostics.policyExcluded, 1);

  const guardrails = quietWarn(() => buildAuthoringGuardrails(newBook, { chapters: 1, stateDir }));
  assert.equal(guardrails.namePolicy.policyId, planned.namePolicy.policyId);
  assert.ok(!guardrails.allocation[1].includes(candidate), "guardrails must use the same planner policy");
  assert.match(formatGuardrails(guardrails), new RegExp(planned.namePolicy.policyId));
});

test("fault-injected writes leave the previous complete state internally consistent", async () => {
  const { stateDir, bookPackagesDir } = tempState("fault");
  const bookId = "zz-library-fault";
  let clock = 0;
  const opts: LibraryStateOptions = {
    stateDir,
    bookPackagesDir,
    now: () => clock,
    randomToken: () => "writer-token",
    lock: { heartbeatMs: 0 },
  };
  writeNamePlan(stateDir, bookId, { 1: ["Opal"] });
  const v1 = namedChapter(bookId, 1, "Opal", 0, "Neither do I is a phrase this ledger tracks.");
  const base = createEmptyLibraryState(opts);
  ingestChapter(base, bookId, "Fault Fixture", "Test Author", v1, opts);
  await saveLibraryState(base, opts);

  clock = 1_000;
  writeNamePlan(stateDir, bookId, { 1: ["Priya"] });
  const v2 = namedChapter(bookId, 1, "Priya", 2, "Knowing is not the same as checking the evidence.");
  const attempted = loadLibraryState(opts);
  ingestChapter(attempted, bookId, "Fault Fixture", "Test Author", v2, opts);
  await assert.rejects(
    () => saveLibraryState(attempted, { ...opts, faultInjection: { afterTmpWrite: true } }),
    /fault injection: afterTmpWrite/,
  );

  const loaded = loadLibraryState(opts);
  assert.deepEqual(loaded.globalAnswerPositionCounts, contributionAnswerSum(loaded));
  assert.deepEqual(loaded.globalAnswerPositionCounts, [1, 0, 0]);
  assert.deepEqual(loaded.books[bookId].namesUsed, ["Opal"]);
  assert.equal(loaded.globalPhraseUsage["knowing is not the same as"], undefined);
});
