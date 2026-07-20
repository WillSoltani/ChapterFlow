/**
 * Model bake-off — conductor behaviors over injected stages: shared research
 * reuse, immutable V4 candidates, blind-map persistence, model-unavailable
 * fail-closed, resume, screening-only authority, and JSON+MD reports.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { test } from "./harness.js";
import { createBookContentReader } from "../src/books/bookContentReader.js";
import { createBookWriteLock } from "../src/books/bookLease.js";
import { createCandidateStore } from "../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../src/books/currentPointer.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { bakeoffRoots } from "../src/bakeoff/paths.js";
import { slotChapterAbsPath } from "../src/bakeoff/candidates.js";
import { combinedContentHash } from "../src/bakeoff/review.js";
import { runBakeoff, type BakeoffStages, type RunBakeoffOptions } from "../src/bakeoff/runBakeoff.js";
import { createReviewServiceFactory } from "../src/review/reviewService.js";
import { LegacyBakeoffStateAdapter } from "../src/release/legacyBakeoffStateAdapter.js";
import type {
  BakeoffManifestV1,
  CandidateReviewV1,
  CandidateStateV1,
  CandidateValidationV1,
  SharedInputsFreezeV1,
} from "../src/bakeoff/types.js";
import { fixtureChapter, tmpRoot, fakeBakeoffDeps } from "./model-bakeoff-helpers.js";

const MODELS = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];
const CONFIDENT_DRAFT = "---\ntitle: The Focus Ledger\nauthor: Ada Writer\n---\n# The Focus Ledger\n\n" + "Attention is a budget you spend on purpose. ".repeat(20);
const BOOK_ID = "the-focus-ledger";

type World = ReturnType<typeof makeWorld>;

function makeWorld(draftBody = CONFIDENT_DRAFT, compositesBySlot: Record<string, number> = { w1: 84, w2: 76, w3: 74 }) {
  const dir = tmpRoot("cf-bakeoff-conductor-");
  const draftPath = join(dir, "draft.md");
  writeFileSync(draftPath, draftBody);
  const stateRoot = join(dir, "state");
  const bundle = fakeBakeoffDeps();
  const calls = { generate: [] as string[], validate: [] as string[], review: [] as string[] };

  const freeze: SharedInputsFreezeV1 = {
    schemaVersion: "model-bakeoff-shared-inputs-v1",
    frozenAt: "t",
    files: [],
    combinedSha256: "shared-hash",
    taskCardTemplateSha256: { ch01: "tpl" },
    retryBudget: { gateRetries: 1, leadDegradeRetries: 1 },
    chapterNumbers: [1],
  };

  const stages: Partial<BakeoffStages> = {
    freezeInputs: () => freeze,
    verifyInputs: () => [],
    generate: (async (bookId, spec, _deps, roots, _opts, persist) => {
      calls.generate.push(spec.model);
      const ch = fixtureChapter(bookId, 1, spec.slot);
      const abs = slotChapterAbsPath(roots, spec.slot, bookId, 1);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, JSON.stringify(ch, null, 2));
      const state: CandidateStateV1 = {
        schemaVersion: "model-bakeoff-candidate-v1",
        spec,
        status: "complete",
        chapters: [{
          chapterNumber: 1, ok: true, firstAttemptPass: true, totalDurationMs: 60_000,
          attempts: [{ attempt: 1, sessionId: `auto-bakeoff-${spec.slot}-author-ch01#1`, ok: true, durationMs: 60_000, failure: "" }],
          contentSha256: chapterContentHash(ch),
        }],
        totalDurationMs: 60_000,
        totalRetries: 0,
        firstAttemptPasses: 1,
      };
      persist(state);
      return state;
    }) as BakeoffStages["generate"],
    validate: (async (_bookId, spec) => {
      calls.validate.push(spec.model);
      return {
        schemaVersion: "model-bakeoff-candidate-validation-v1",
        model: spec.model, validatedAt: "t", complete: true, hardFailures: [], advisories: [],
        bookGatePassed: true, rubricVerdict: "pass", readerBudgetBlockers: 0, shipGateBlockers: 0,
      } as CandidateValidationV1;
    }) as BakeoffStages["validate"],
  };
  const reviewStage = async (_bookId: string, label: CandidateReviewV1["label"], chapters: readonly ReturnType<typeof fixtureChapter>[], roots: ReturnType<typeof bakeoffRoots>) => {
      calls.review.push(label);
      const slot = (chapters[0].title.match(/w\d/) ?? ["w1"])[0];
      const composite = compositesBySlot[slot] ?? 70;
      const review: CandidateReviewV1 = {
        schemaVersion: "model-bakeoff-candidate-review-v1",
        label: label as CandidateReviewV1["label"],
        contentSha256: combinedContentHash([...chapters]),
        chapterReviews: [{ chapterNumber: 1, composite, ship: true, keysClean: true, valid: true, pass: true, reviewerSessionId: "r" }],
        bookReads: [],
        bookComposite: composite,
        bookGate: "PASS",
        bookChurn: "LOW",
        meanChapterComposite: composite,
        minChapterComposite: composite,
        chapterPassRate: 1,
        sampledChapterNumbers: [1],
        reviewedAt: "t",
      };
      const p = join(roots.reviewsDir, label, "review.json");
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify(review, null, 2));
      return review;
  };

  const roots = bakeoffRoots(BOOK_ID, "bo-test", stateRoot);
  mkdirSync(roots.v4BooksRoot, { recursive: true });
  const writeLock = createBookWriteLock({ booksRoot: roots.v4BooksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointerStore = createCurrentPointerStore({ booksRoot: roots.v4BooksRoot, writeLock });
  const candidateStore = createCandidateStore({ booksRoot: roots.v4BooksRoot, writeLock, currentPointerStore: pointerStore });
  const reader = createBookContentReader({ booksRoot: roots.v4BooksRoot, currentPointerStore: pointerStore });
  const reviewService = createReviewServiceFactory({ booksRoot: roots.v4BooksRoot, contentReader: reader }).create({
    async evaluate() { return { ok: false, error: { code: "SCREENING_ONLY", message: "canonical review forbidden" } }; },
  });
  const v4 = new LegacyBakeoffStateAdapter({
    roots,
    candidateStore,
    contentReader: reader,
    reviewService,
    selectionReviewer: {
      root: roots.reviewsDir,
      review: ({ bookId, label, chapters }) => reviewStage(bookId, label, chapters as ReturnType<typeof fixtureChapter>[], roots),
    },
  });
  const opts = (over?: Partial<RunBakeoffOptions>): RunBakeoffOptions => ({
    draftPath,
    runId: "bo-test",
    models: MODELS,
    publish: false,
    deps: bundle.deps,
    stateRoot,
    stages,
    v4,
    ...over,
  });

  return { dir, draftPath, stateRoot, bundle, calls, stages, opts, roots, freeze };
}

function manifestOf(w: World): BakeoffManifestV1 {
  return JSON.parse(readFileSync(w.roots.manifestPath, "utf8")) as BakeoffManifestV1;
}

// ── happy path: 3, 5, 7, 17, 18/19 (delegation), 20, 22, 23 ───────────────────

test("conductor happy path stays SCREENING_ONLY with immutable V4 candidates and reports", async () => {
  const w = makeWorld();
  const outcome = await runBakeoff(w.opts());
  assert.equal(outcome.status, "complete");
  assert.equal(outcome.winner, "gpt-5.6-sol", "slot w1 (highest blinded composite) wins");

  // 3. shared research reused: expectedChapterNumbers → [1] means NO research spawn.
  assert.equal(w.bundle.spawns.filter((s) => s.task.includes("RESEARCH")).length, 0, "no research session — existing research shared");
  // Preflight probed all 3 candidates + the judge, each with a pinned model.
  const probes = w.bundle.spawns.filter((s) => s.task === "Reply with exactly: MODEL-OK");
  assert.deepEqual(probes.map((p) => p.model).sort(), [...MODELS, "gpt-5.5"].sort());

  // 7. blind labels randomized once and persisted; mapping covers all models.
  const manifest = manifestOf(w);
  assert.deepEqual(Object.keys(manifest.blindMap).sort(), ["A", "B", "C"]);
  assert.deepEqual(Object.values(manifest.blindMap).sort(), [...MODELS].sort());

  // Selection has no canonical crossing and invokes no QC/publish verb.
  const forbiddenVerbs = ["publish", "publish-final", "publish-after-qc", "register-web", "promote-book", "qc-auto", "qc-attest", "qc-open-round", "qc-diagnose", "qc-orchestrate"];
  for (const v of w.bundle.verbs) {
    assert.ok(!forbiddenVerbs.includes(v[0]), `bake-off must never run '${v[0]}' itself — the existing conductor owns it`);
  }
  assert.equal(w.bundle.delegations.length, 0);

  // 22. losing candidates retained (durable candidates/ tree + slot originals).
  for (const slot of ["w2", "w3"]) {
    assert.ok(existsSync(slotChapterAbsPath(w.roots, slot, BOOK_ID, 1)), `${slot} chapters retained`);
  }
  assert.ok(readdirSync(join(w.roots.v4BooksRoot, BOOK_ID, "candidates")).length >= 3, "immutable V4 candidates retained");

  // 23. JSON + MD reports.
  assert.ok(existsSync(w.roots.reportJsonPath) && existsSync(w.roots.reportMdPath));
  const report = JSON.parse(readFileSync(w.roots.reportJsonPath, "utf8"));
  assert.equal(report.selection.winner, "gpt-5.6-sol");
  assert.equal(report.selection.authority, "SCREENING_ONLY");
  assert.equal(report.promotion, null);
  assert.deepEqual(Object.values(report.blindMapping).sort(), [...MODELS].sort());
  const md = readFileSync(w.roots.reportMdPath, "utf8");
  assert.ok(md.includes("Blind mapping") && md.includes("gpt-5.6-sol") && md.includes("Why the winner won"));
});

// ── 21. PUBLISH=true authorizes ONLY the existing verified publisher ───────────

test("publish request is rejected because bakeoff has screening authority only", async () => {
  const w = makeWorld();
  await assert.rejects(runBakeoff(w.opts({ publish: true })), /SCREENING_ONLY/);
  assert.equal(w.bundle.delegations.length, 0);
});

// ── 14. model-unavailable fail-closed ─────────────────────────────────────────

test("a missing candidate model fails the preflight closed — no generation, the exact model named, no substitution", async () => {
  const w = makeWorld();
  const deps = {
    ...w.bundle.deps,
    spawn: (async (o: { task: string; model?: string; sessionId: string }) => {
      if (o.task === "Reply with exactly: MODEL-OK" && o.model === "gpt-5.6-terra") {
        return { ok: false, exitCode: 1, finalMessage: "", stdout: "", stderr: "unknown model 'gpt-5.6-terra' for this workspace", durationMs: 2, sessionId: o.sessionId };
      }
      return { ok: true, exitCode: 0, finalMessage: "MODEL-OK", stdout: "MODEL-OK", stderr: "", durationMs: 2, sessionId: o.sessionId };
    }) as never,
  };
  const outcome = await runBakeoff(w.opts({ deps }));
  assert.equal(outcome.status, "halt");
  assert.ok(outcome.reason?.includes("gpt-5.6-terra"), "the failed model is named exactly");
  assert.ok(outcome.reason?.includes("entitlement"), "actionable entitlement hint");
  assert.ok(/no model is silently substituted/.test(outcome.reason ?? ""));
  assert.equal(w.calls.generate.length, 0, "no expensive generation started");
});

// ── 13. interrupted-run resume ────────────────────────────────────────────────

test("a rerun with the same run id reuses verified completed candidates and continues where it stopped", async () => {
  const w = makeWorld();
  // First run (serial for determinism): sol completes, then terra dies mid-run.
  const crashingStages: Partial<BakeoffStages> = {
    ...w.stages,
    generate: (async (bookId, spec, deps, roots, opts, persist) => {
      if (spec.model === "gpt-5.6-terra") throw new Error("simulated interrupt");
      return (w.stages.generate as BakeoffStages["generate"])(bookId, spec, deps, roots, opts, persist);
    }) as BakeoffStages["generate"],
  };
  await assert.rejects(runBakeoff(w.opts({ stages: crashingStages, maxParallel: 1 })), /simulated interrupt/);
  assert.deepEqual(w.calls.generate, ["gpt-5.6-sol"], "sol completed before the interrupt; luna never started");

  // Second run, same run id: sol is NOT regenerated; the rest completes.
  w.calls.generate.length = 0;
  const outcome = await runBakeoff(w.opts({ maxParallel: 1 }));
  assert.equal(outcome.status, "complete");
  assert.ok(!w.calls.generate.includes("gpt-5.6-sol"), "verified completed candidate reused, not regenerated");
  assert.deepEqual(w.calls.generate, ["gpt-5.6-terra", "gpt-5.6-luna"]);

  // …and --force regenerates everything under a fresh consent.
  w.calls.generate.length = 0;
  const forced = await runBakeoff(w.opts({ force: true }));
  assert.equal(forced.status, "complete");
  assert.equal(w.calls.generate.length, 3, "--force regenerates all candidates");
});

test("a resumed run refuses a different --models set under the same run id", async () => {
  const w = makeWorld();
  await runBakeoff(w.opts());
  await assert.rejects(
    runBakeoff(w.opts({ models: ["gpt-5.6-sol", "gpt-5.6-terra", "some-other-model"] })),
    /already compares/,
  );
});

// ── 9-adjacent (conductor): disqualified candidates are never reviewed ─────────

test("a candidate with deterministic hard failures is skipped by the blinded review and cannot win", async () => {
  // terra (w2) clears luna (w3) by more than the noise band, so the expected
  // winner is decided on quality, not the operational tiebreak.
  const w = makeWorld(CONFIDENT_DRAFT, { w1: 84, w2: 80, w3: 70 });
  const stages: Partial<BakeoffStages> = {
    ...w.stages,
    validate: (async (_bookId, spec) => ({
      schemaVersion: "model-bakeoff-candidate-validation-v1",
      model: spec.model, validatedAt: "t", complete: true,
      hardFailures: spec.model === "gpt-5.6-sol" ? ["book-gate: [AS5] templated quiz across chapters"] : [],
      advisories: [], bookGatePassed: spec.model !== "gpt-5.6-sol", rubricVerdict: "pass",
      readerBudgetBlockers: 0, shipGateBlockers: 0,
    })) as BakeoffStages["validate"],
  };
  const outcome = await runBakeoff(w.opts({ stages }));
  assert.equal(outcome.status, "complete");
  assert.equal(outcome.winner, "gpt-5.6-terra", "the next-best ELIGIBLE candidate wins");
  assert.equal(w.calls.review.length, 2, "the disqualified candidate got no review spend");
});

// ── chapter subset → compare-only (selection + report, no canonical crossing) ─

test("--chapters subset runs COMPARE-ONLY: winner + report land, but promotion/QC/publish never run", async () => {
  const w = makeWorld();
  const stages: Partial<BakeoffStages> = {
    ...w.stages,
    freezeInputs: ((_bookId: string, chapterNumbers: number[]) => ({ ...w.freeze, chapterNumbers: [...chapterNumbers] })) as BakeoffStages["freezeInputs"],
  };
  const deps = { ...w.bundle.deps, expectedChapterNumbers: () => [1, 2] };
  const outcome = await runBakeoff(w.opts({ stages, deps, chapters: [1] }));
  assert.equal(outcome.status, "compared");
  assert.equal(outcome.winner, "gpt-5.6-sol");
  assert.equal(w.bundle.delegations.length, 0, "no formal QC / publish delegation");
  assert.ok(existsSync(w.roots.reportJsonPath), "comparison report written");
  const report = JSON.parse(readFileSync(w.roots.reportJsonPath, "utf8"));
  assert.ok(/SCREENING_ONLY chapter-subset/.test(report.qcOutcome), "report records screening-only subset outcome");
  // A different subset under the same run id is refused (frozen set wins).
  await assert.rejects(runBakeoff(w.opts({ stages, deps, chapters: [1, 2] })), /froze chapters/);
});

test("no eligible candidate → halt with a full report; nothing promoted, nothing delegated", async () => {
  const w = makeWorld();
  const stages: Partial<BakeoffStages> = {
    ...w.stages,
    validate: (async (_bookId, spec) => ({
      schemaVersion: "model-bakeoff-candidate-validation-v1",
      model: spec.model, validatedAt: "t", complete: false,
      hardFailures: ["incomplete book: missing ch 1"], advisories: [],
      bookGatePassed: false, rubricVerdict: "fail", readerBudgetBlockers: 0, shipGateBlockers: 1,
    })) as BakeoffStages["validate"],
  };
  const outcome = await runBakeoff(w.opts({ stages }));
  assert.equal(outcome.status, "halt");
  assert.ok(/no eligible candidate/.test(outcome.reason ?? ""));
  assert.equal(w.bundle.delegations.length, 0, "no formal QC, no publish");
  assert.ok(existsSync(w.roots.reportJsonPath), "the comparison report still lands (evidence)");
});
