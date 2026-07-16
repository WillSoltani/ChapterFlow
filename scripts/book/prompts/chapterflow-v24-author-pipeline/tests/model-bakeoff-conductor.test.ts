/**
 * Model bake-off — conductor behaviors over injected stages: shared research
 * reuse, no-canonical-mutation-before-selection, blind-map persistence,
 * model-unavailable fail-closed, resume, QC-only-after-selection, PUBLISH
 * boundaries, losing-candidate retention, and JSON+MD reports.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { test } from "./harness.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { bakeoffRoots } from "../src/bakeoff/paths.js";
import { slotChapterAbsPath } from "../src/bakeoff/candidates.js";
import { combinedContentHash } from "../src/bakeoff/review.js";
import { runBakeoff, type BakeoffStages, type RunBakeoffOptions } from "../src/bakeoff/runBakeoff.js";
import type {
  BakeoffManifestV1,
  CandidateReviewV1,
  CandidateStateV1,
  CandidateValidationV1,
  PromotionRecordV1,
  SharedInputsFreezeV1,
} from "../src/bakeoff/types.js";
import { fixtureChapter, tmpRoot, fakeBakeoffDeps } from "./model-bakeoff-helpers.js";

const MODELS = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];
const CONFIDENT_DRAFT = "---\ntitle: The Focus Ledger\nauthor: Ada Writer\n---\n# The Focus Ledger\n\n" + "Attention is a budget you spend on purpose. ".repeat(20);
const PROVISIONAL_DRAFT = "# The Focus Ledger\n\n" + "Attention is a budget you spend on purpose. ".repeat(20);
const BOOK_ID = "the-focus-ledger";

type World = ReturnType<typeof makeWorld>;

function makeWorld(draftBody = CONFIDENT_DRAFT, compositesBySlot: Record<string, number> = { w1: 84, w2: 76, w3: 74 }) {
  const dir = tmpRoot("cf-bakeoff-conductor-");
  const draftPath = join(dir, "draft.md");
  writeFileSync(draftPath, draftBody);
  const stateRoot = join(dir, "state");
  const canonical = join(dir, "canonical-chapters");
  const bundle = fakeBakeoffDeps();
  const calls = { generate: [] as string[], validate: [] as string[], review: [] as string[], promote: [] as string[] };

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
    review: (async (_bookId, label, chapters, _deps, roots) => {
      calls.review.push(label);
      const slot = (chapters[0].title.match(/w\d/) ?? ["w1"])[0];
      const composite = compositesBySlot[slot] ?? 70;
      const review: CandidateReviewV1 = {
        schemaVersion: "model-bakeoff-candidate-review-v1",
        label: label as CandidateReviewV1["label"],
        contentSha256: combinedContentHash(chapters),
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
    }) as BakeoffStages["review"],
    promote: ((args) => {
      calls.promote.push(args.winner.model);
      mkdirSync(canonical, { recursive: true });
      writeFileSync(join(canonical, `${args.bookId}-ch01.v21-native.chapter.json`), "PROMOTED");
      const rec: PromotionRecordV1 = {
        schemaVersion: "model-bakeoff-promotion-v1",
        promotedAt: "t",
        winnerModel: args.winner.model,
        winnerEffort: args.winner.effort,
        runId: args.manifest.runId,
        chapterFiles: [],
        byteIdentityVerified: true,
        sharedInputsSha256: "shared-hash",
        taskCardTemplateSha256: {},
        candidateChapterHashes: args.candidateChapterHashes,
        authorSessionIds: {},
      };
      return rec;
    }) as BakeoffStages["promote"],
  };

  const opts = (over?: Partial<RunBakeoffOptions>): RunBakeoffOptions => ({
    draftPath,
    runId: "bo-test",
    models: MODELS,
    // WP-501: the judge model is REQUIRED and explicit — no silent writer default.
    // Pinned to a 5.6 id here (directive-1: gpt-5.5 is void); the fixed judging
    // instrument is a caller decision, never inherited from BASELINE_MODEL.
    judgeModel: "gpt-5.6-sol",
    publish: false,
    deps: bundle.deps,
    stateRoot,
    stages,
    ...over,
  });

  const roots = bakeoffRoots(BOOK_ID, "bo-test", stateRoot);
  return { dir, draftPath, stateRoot, canonical, bundle, calls, stages, opts, roots, freeze };
}

function manifestOf(w: World): BakeoffManifestV1 {
  return JSON.parse(readFileSync(w.roots.manifestPath, "utf8")) as BakeoffManifestV1;
}

// ── happy path: 3, 5, 7, 17, 18/19 (delegation), 20, 22, 23 ───────────────────

test("conductor happy path (PUBLISH=false): shared research reused, blinded selection, promotion before QC, delegation with --no-publish, reports written, losers retained", async () => {
  const w = makeWorld();
  const outcome = await runBakeoff(w.opts());
  assert.equal(outcome.status, "ready");
  assert.equal(outcome.winner, "gpt-5.6-sol", "slot w1 (highest blinded composite) wins");

  // 3. shared research reused: expectedChapterNumbers → [1] means NO research spawn.
  assert.equal(w.bundle.spawns.filter((s) => s.task.includes("RESEARCH")).length, 0, "no research session — existing research shared");
  // Preflight probed all 3 candidates + the explicit judge, each with a pinned
  // model (WP-501: the judge is required, not the silent writer default).
  const probes = w.bundle.spawns.filter((s) => s.task === "Reply with exactly: MODEL-OK");
  assert.deepEqual(probes.map((p) => p.model).sort(), [...MODELS, "gpt-5.6-sol"].sort());

  // 7. blind labels randomized once and persisted; mapping covers all models.
  const manifest = manifestOf(w);
  assert.deepEqual(Object.keys(manifest.blindMap).sort(), ["A", "B", "C"]);
  assert.deepEqual(Object.values(manifest.blindMap).sort(), [...MODELS].sort());

  // 5. no canonical mutation before selection: promote ran exactly once, and the
  // bake-off itself never invoked any QC/publish/registry verb.
  assert.deepEqual(w.calls.promote, ["gpt-5.6-sol"]);
  const forbiddenVerbs = ["publish", "publish-final", "publish-after-qc", "register-web", "promote-book", "qc-auto", "qc-attest", "qc-open-round", "qc-diagnose", "qc-orchestrate"];
  for (const v of w.bundle.verbs) {
    assert.ok(!forbiddenVerbs.includes(v[0]), `bake-off must never run '${v[0]}' itself — the existing conductor owns it`);
  }
  // The full deterministic preflight re-ran on canonical bytes after promotion.
  assert.ok(w.bundle.verbs.some((v) => v[0] === "qc-converge"), "qc-converge re-ran post-promotion");

  // 17-19. formal QC starts ONLY after selection+promotion, delegated verbatim to
  // book-autopilot --author (which owns qc-diagnose + fresh-round governance).
  assert.equal(w.bundle.delegations.length, 1);
  const d = w.bundle.delegations[0];
  assert.equal(d.args[0], "book-autopilot");
  assert.ok(d.args.includes(BOOK_ID) && d.args.includes("--author"));
  // 20. PUBLISH=false → --no-publish rides the delegation.
  assert.ok(d.args.includes("--no-publish"));
  // WP-301: the CHAPTERFLOW_AUTHOR_MODEL/EFFORT env surface was DELETED — the
  // production author (write + repair) now resolves from the central model policy
  // (resolveRoute, tier="normal-profile"), so a cross-process env pin can no longer
  // steer the delegated subprocess. The delegation therefore carries NO author env
  // pin (the winner is measured on its first-write candidate, not the QC repairs).
  assert.equal(d.env.CHAPTERFLOW_AUTHOR_MODEL, undefined);
  assert.equal(d.env.CHAPTERFLOW_AUTHOR_EFFORT, undefined);

  // 22. losing candidates retained (durable candidates/ tree + slot originals).
  for (const slot of ["w2", "w3"]) {
    assert.ok(existsSync(slotChapterAbsPath(w.roots, slot, BOOK_ID, 1)), `${slot} chapters retained`);
  }
  assert.ok(readdirSync(w.roots.candidatesDir).length >= 3, "durable candidates/ per model retained");

  // 23. JSON + MD reports.
  assert.ok(existsSync(w.roots.reportJsonPath) && existsSync(w.roots.reportMdPath));
  const report = JSON.parse(readFileSync(w.roots.reportJsonPath, "utf8"));
  assert.equal(report.selection.winner, "gpt-5.6-sol");
  assert.deepEqual(Object.values(report.blindMapping).sort(), [...MODELS].sort());
  const md = readFileSync(w.roots.reportMdPath, "utf8");
  assert.ok(md.includes("Blind mapping") && md.includes("gpt-5.6-sol") && md.includes("Why the winner won"));
});

// ── 21. PUBLISH=true authorizes ONLY the existing verified publisher ───────────

test("PUBLISH=true with confident identity delegates WITHOUT --no-publish and never runs git/publish itself", async () => {
  const w = makeWorld();
  const outcome = await runBakeoff(w.opts({ publish: true }));
  assert.equal(outcome.status, "published");
  const d = w.bundle.delegations[0];
  assert.ok(!d.args.includes("--no-publish"), "verified publish path authorized through the existing conductor");
  for (const v of w.bundle.verbs) {
    assert.ok(!/^(publish|publish-final|publish-after-qc|register-web|promote-book|git)$/.test(v[0]));
  }
});

test("PUBLISH=true with PROVISIONAL identity withholds publication and asks exactly one concise question", async () => {
  const w = makeWorld(PROVISIONAL_DRAFT);
  const outcome = await runBakeoff(w.opts({ publish: true }));
  assert.equal(outcome.status, "ready", "publication withheld");
  assert.ok(outcome.publicationQuestion && /is the book/i.test(outcome.publicationQuestion), "one concise identity question");
  assert.ok(w.bundle.delegations[0].args.includes("--no-publish"), "delegation stays no-publish");
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
  assert.equal(outcome.status, "ready");
  assert.ok(!w.calls.generate.includes("gpt-5.6-sol"), "verified completed candidate reused, not regenerated");
  assert.deepEqual(w.calls.generate, ["gpt-5.6-terra", "gpt-5.6-luna"]);

  // …and --force regenerates everything under a fresh consent.
  w.calls.generate.length = 0;
  const forced = await runBakeoff(w.opts({ force: true }));
  assert.equal(forced.status, "ready");
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
  assert.equal(outcome.status, "ready");
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
  assert.equal(w.calls.promote.length, 0, "a partial book is never promoted");
  assert.equal(w.bundle.delegations.length, 0, "no formal QC / publish delegation");
  assert.ok(existsSync(w.roots.reportJsonPath), "comparison report written");
  const report = JSON.parse(readFileSync(w.roots.reportJsonPath, "utf8"));
  assert.ok(/compare-only/.test(report.qcOutcome), "report records the compare-only outcome");
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
  assert.equal(w.calls.promote.length, 0, "no promotion");
  assert.equal(w.bundle.delegations.length, 0, "no formal QC, no publish");
  assert.ok(existsSync(w.roots.reportJsonPath), "the comparison report still lands (evidence)");
});
