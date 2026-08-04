import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { STATE_CHAPTERS, makeChapter, writeFixtureBook } from "./helpers.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { manualKeyJudgePath } from "../src/qc/manualKeyJudge.js";
import { openQcRound, qcRoundPath } from "../src/qc/qcRound.js";
import { orchestratorRoundDir, roundRecordPath } from "../src/qc/orchestrator/artifacts.js";
import { finalizeQcRound } from "../src/qc/orchestrator/finalize.js";
import {
  evaluateDeterministic,
  renderConvergeReport,
  type ConvergeFinding,
  type DeterministicChecks,
  type DeterministicReport,
} from "../src/qc/orchestrator/deterministicGate.js";
import { classDefectBanner, groupByClassDefect, unitContainer } from "../src/qc/orchestrator/findingGrouping.js";
import type { ChapterV21 } from "../src/types.js";

const BOOK = "zz-fixture-converge";
const ROUND = "r-converge";

type TestFileSnapshot = {
  path: string;
  existed: boolean;
  bytes: Buffer | null;
  atime: Date | null;
  mtime: Date | null;
};

function snapshotTestFile(path: string): TestFileSnapshot {
  if (!existsSync(path)) return { path, existed: false, bytes: null, atime: null, mtime: null };
  const stat = statSync(path);
  return { path, existed: true, bytes: readFileSync(path), atime: stat.atime, mtime: stat.mtime };
}

function restoreTestFile(snapshot: TestFileSnapshot): void {
  if (!snapshot.existed) {
    rmSync(snapshot.path, { force: true });
    return;
  }
  mkdirSync(dirname(snapshot.path), { recursive: true });
  writeFileSync(snapshot.path, snapshot.bytes!);
  utimesSync(snapshot.path, snapshot.atime!, snapshot.mtime!);
}

function snapshotParentDirs(paths: string[]): Array<{ path: string; existed: boolean }> {
  return [...new Set(paths)]
    .sort((a, b) => b.split("/").length - a.split("/").length)
    .map((path) => ({ path, existed: existsSync(path) }));
}

function pruneAbsentEmptyParents(parents: Array<{ path: string; existed: boolean }>): void {
  for (const parent of parents) {
    if (!parent.existed && existsSync(parent.path) && readdirSync(parent.path).length === 0) rmSync(parent.path, { recursive: true, force: true });
  }
}

function cleanup(): void {
  for (const f of readdirSync(STATE_CHAPTERS)) {
    if (f.startsWith(`${BOOK}-ch`)) rmSync(resolve(STATE_CHAPTERS, f), { force: true });
  }
  rmSync(resolve(REPO_ROOT, ".chapterflow/runs", BOOK), { recursive: true, force: true });
  rmSync(orchestratorRoundDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(qcRoundPath(BOOK, ROUND), { force: true });
}

// Minimal round record (mirrors createQcOrchestrationRound) so finalize sees a
// fresh round and runs its full deterministic computation. dryRun writes nothing.
function writeRoundRecord(chapters: ChapterV21[]): void {
  const path = roundRecordPath(BOOK, ROUND);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({
    schemaVersion: "qc-orchestrator-round-v1",
    bookId: BOOK,
    roundId: ROUND,
    createdAt: "2026-06-19T00:00:00.000Z",
    chapters: chapters.map((c) => c.number),
    qcRoundFile: qcRoundPath(BOOK, ROUND),
    preflight: {
      sourceV2Gate: { passed: false, findings: 0 },
      bookGate: { passed: true, findings: 0 },
      keyPack: { paths: [], error: undefined },
      sweepPack: { path: undefined, error: undefined },
      barPack: { packPath: undefined, templatePath: undefined, errors: [] },
    },
    taskCards: [],
    chapterContentHashes: Object.fromEntries(chapters.map((c) => [String(c.number), chapterContentHash(c)])),
  }, null, 2) + "\n", "utf8");
}

const DETERMINISTIC_KEYS: (keyof DeterministicChecks)[] = [
  "sourceV2", "shipGate", "authorCheck", "intraBook", "bookGate", "planEnforcement",
];

test("evaluateDeterministic flags a ship-gate blocker (em-dash B5) and reports DIRTY", () => {
  try {
    cleanup();
    // An em-dash trips B5 (the em-dash ban) — a pure-on-object ship-gate blocker.
    const ch = makeChapter(BOOK, 1, { overrides: { hook: "The lantern fades — and the harbor waits." } });
    const report = evaluateDeterministic(BOOK, [ch], [ch]);
    assert.equal(report.clean, false, "a chapter with a ship-gate blocker is not deterministic-clean");
    const chFindings = report.perChapter.get(1)!.findings;
    assert.ok(
      chFindings.some((f) => f.gate === "shipGate" && f.catalogId === "B5"),
      `expected a B5 ship-gate finding, got: ${JSON.stringify(chFindings.map((f) => `${f.gate}:${f.catalogId}`))}`,
    );
    assert.equal(report.perChapter.get(1)!.checks.shipGate, "FAIL");
  } finally {
    cleanup();
  }
});

test("FIDELITY: evaluateDeterministic's six checks EQUAL finalize's (no drift — they share the evaluator)", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  const oldWarn = console.warn;
  const manualKeySnapshots = [1, 2].map((n) => snapshotTestFile(manualKeyJudgePath(BOOK, n)));
  const runBookDir = resolve(REPO_ROOT, ".chapterflow/runs", BOOK);
  const parentSnapshots = snapshotParentDirs([
    dirname(manualKeyJudgePath(BOOK, 1)),
    dirname(orchestratorRoundDir(BOOK, ROUND)),
    dirname(dirname(orchestratorRoundDir(BOOK, ROUND))),
    dirname(qcRoundPath(BOOK, ROUND)),
    dirname(runBookDir),
    dirname(dirname(runBookDir)),
  ]);
  try {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    console.warn = () => {};
    cleanup();
    // Two chapters so the cross-chapter checks (intra-book siblings, book-gate) run.
    const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
    writeFixtureBook(STATE_CHAPTERS, chapters);
    openQcRound(BOOK, ROUND);
    writeRoundRecord(chapters);

    // finalize computes the SAME six deterministic checks (plus the semantic ones,
    // which read MISSING here). dryRun: compute, write nothing.
    const result = finalizeQcRound(BOOK, ROUND, { chapters: [1, 2], dryRun: true });
    const det = evaluateDeterministic(BOOK, chapters, chapters);

    for (const n of [1, 2]) {
      const fc = result.chapters.find((c) => c.chapterNumber === n)!.checks;
      const dc = det.perChapter.get(n)!.checks;
      for (const key of DETERMINISTIC_KEYS) {
        assert.equal(dc[key], fc[key], `drift on ch0${n} ${key}: evaluator=${dc[key]} finalize=${fc[key]}`);
      }
    }
    // The whole point: clean iff finalize raises no deterministic finding on any chapter.
    const finalizeDeterministicClean = [1, 2].every((n) => {
      const fc = result.chapters.find((c) => c.chapterNumber === n)!.checks;
      return DETERMINISTIC_KEYS.every((k) => fc[k] === "PASS");
    });
    assert.equal(det.clean, finalizeDeterministicClean, "report.clean must match finalize's deterministic verdict");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    console.warn = oldWarn;
    cleanup();
    for (const snapshot of manualKeySnapshots) restoreTestFile(snapshot);
    pruneAbsentEmptyParents(parentSnapshots);
  }
});

// ── Pure renderer + grouping tests (no disk) ─────────────────────────────────
function reportWith(clean: boolean, bookFindings: ConvergeFinding[], chapterFindings: ConvergeFinding[]): DeterministicReport {
  const allPass: DeterministicChecks = { sourceV2: "PASS", shipGate: "PASS", authorCheck: "PASS", intraBook: "PASS", bookGate: "PASS", planEnforcement: "PASS" };
  return {
    bookId: "x-book",
    clean,
    bookGate: { passed: bookFindings.length === 0 } as DeterministicReport["bookGate"],
    bookFindings,
    perChapter: new Map([[1, {
      chapterNumber: 1,
      chapterId: "x-book-ch01",
      checks: clean ? allPass : { ...allPass, shipGate: "FAIL" },
      raw: {} as never,
      findings: chapterFindings,
    }]]),
  };
}

test("renderConvergeReport CLEAN never implies publishability (names the remaining semantic round)", () => {
  const out = renderConvergeReport(reportWith(true, [], []));
  assert.match(out, /DETERMINISTIC-CLEAN/);
  assert.match(out, /semantic/i);
  assert.match(out, /formal qc-auto round/i);
});

test("renderConvergeReport DIRTY groups a repeated catalogId into ONE CLASS DEFECT banner", () => {
  const f = (unit: string): ConvergeFinding => ({ scope: "chapter", chapterNumber: 1, gate: "shipGate", catalogId: "E7", severity: "blocker", unit, message: "sentence exceeds 34 words" });
  const out = renderConvergeReport(reportWith(false, [], [f("example[2]"), f("example[4]")]));
  assert.match(out, /DETERMINISTIC-DIRTY/);
  assert.match(out, /CLASS DEFECT: E7 × 2 on `example`/);
});

test("groupByClassDefect collapses sibling units; classDefectBanner has the shared wording", () => {
  const items = [
    { c: "E7", u: "example[2]" },
    { c: "E7", u: "example[4]" },
    { c: "B5", u: "hook" },
  ];
  const groups = groupByClassDefect(items, (i) => i.c, (i) => i.u);
  const e7 = groups.find((g) => g.repairClass === "E7")!;
  const b5 = groups.find((g) => g.repairClass === "B5")!;
  assert.equal(e7.container, "example");
  assert.equal(e7.isClassDefect, true, "two E7s on example[] are one class defect");
  assert.equal(b5.isClassDefect, false, "a lone finding is not a class defect");
  assert.equal(unitContainer("implementationPlan.ifThenPlans[3]"), "implementationPlan.ifThenPlans");
  assert.match(classDefectBanner("E7", 2, "example"), /^CLASS DEFECT: E7 × 2 on `example` — fix ALL instances/);
});
