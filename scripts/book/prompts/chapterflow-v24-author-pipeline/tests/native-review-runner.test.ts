/**
 * IMP-19 — Layer-N v2 runner INTEGRATION: drives the REAL production
 * reviewOneChapter path (render → isolated workspace → parse → adjudicate →
 * score → durable evidence) via a FAKE SPAWN returning canned model output — NOT
 * a perfect-oracle reviewFn. Proves the review runs, is scored through the real
 * instrument, writes ONLY under the experiment root, and makes NO canonical write.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { resolveDeps } from "../src/orchestrator/autopilot.js";
import { migrationRoots } from "../src/bakeoff/migration/guards.js";
import { renderChapterReaderDocPhase1 } from "../src/review/renderReaderDoc.js";
import { runNativeReviewQualification } from "../src/bakeoff/migration/nativeReviewRunner.js";
import { buildLayerOPrerequisiteBinding, buildNativeReviewInstrumentManifest, nativeReviewThresholdsSha256 } from "../src/bakeoff/migration/nativeReviewSeal.js";
import type { NativeReviewCorpusV2, NativeReviewThresholdsV2 } from "../src/bakeoff/migration/nativeReviewTypes.js";
import type { JudgeSpec } from "../src/bakeoff/review.js";
import type { ChapterV21 } from "../src/types.js";
import { fakeAutopilotDeps, tmpRoot } from "./model-bakeoff-helpers.js";

const OI = resolve("state/migration-experiments/_owner-inputs");
const CORPUS_PATH = resolve(OI, "stage-q/layer-n-v2-corpus.json");
const THRESHOLDS_PATH = resolve(OI, "native-review-thresholds.v2.json");

/** A canned CLEAN reader-review whose quote byte-verifies against the doc and
 *  whose derived answers match the stored key (so keyCheck is clean). */
function cleanReviewJson(chapter: ChapterV21): string {
  const doc = renderChapterReaderDocPhase1(chapter);
  const quote = (doc.split("\n").find((l) => l.trim().length > 30) ?? "the chapter").trim().slice(0, 40);
  const answers = (chapter.quiz?.questions ?? []).map((q) => "abc"[(q as { correctIndex: number }).correctIndex]);
  const body = {
    quizDerivation: { answers, mechanisms: answers.map(() => "clear from the text"), confidence: answers.map(() => "high"), ambiguities: answers.map(() => ""), tells: [] },
    scores: { retention: 90, quizzes: 90, transfer: 90, practical: 90, summaries: 90, tone: 90, limits: 90, insight: 90, density: 90, beginner: 90 },
    ship84: true,
    quotes: [{ quote, why: "a strong, representative line" }],
    complaints: [],
    oneParagraphVerdict: "A complete, well-formed, shippable chapter.",
  };
  return "```json\n" + JSON.stringify(body) + "\n```";
}

test("runner drives the REAL reviewOneChapter path via a fake spawn, scores a clean item, and writes ONLY isolated evidence (no canonical write)", async () => {
  if (!existsSync(CORPUS_PATH)) return;
  const corpus = JSON.parse(readFileSync(CORPUS_PATH, "utf8")) as NativeReviewCorpusV2;
  const thresholds = JSON.parse(readFileSync(THRESHOLDS_PATH, "utf8")) as NativeReviewThresholdsV2;
  const clean = corpus.items.find((i) => i.kind === "clean-pass")!;
  // Use a NON-closed corpus id: the real corpusId (s16-layer-n-native-review-v2)
  // is frozen by the IMP-20 §K resume freeze (assertNotClosed at the top of
  // runNativeReviewQualification). This smoke test asserts runner mechanics
  // (roles/perCase/metrics/evidence), none of which depend on the corpus id.
  const oneItem: NativeReviewCorpusV2 = { ...corpus, corpusId: "lnv2-runner-smoke", items: [clean] };

  const roles: string[] = [];
  const spawn = (async (opts: { role?: string; cwd?: string }) => {
    roles.push(opts.role ?? "?");
    // canonical-write firewall proof: the reviewer's cwd must be a temp workspace,
    // never inside the repo's canonical trees.
    assert.ok(!String(opts.cwd ?? "").includes("/state/chapters"), "reviewer cwd must not be canonical state");
    return { finalMessage: cleanReviewJson(clean.chapter), stdout: cleanReviewJson(clean.chapter), stderr: "", exitCode: 0 };
  }) as unknown as AutopilotDeps["spawn"];

  const deps = resolveDeps(fakeAutopilotDeps({ spawn }) as Partial<AutopilotDeps>);
  const judge: JudgeSpec = { model: "gpt-5.5", effort: "high" };
  const roots = migrationRoots("lnv2-int", tmpRoot("lnv2-int-"));
  const thresholdsSha256 = nativeReviewThresholdsSha256(thresholds);
  const instrumentManifest = buildNativeReviewInstrumentManifest(thresholdsSha256);
  const layerOPrerequisite = buildLayerOPrerequisiteBinding(OI);

  const result = await runNativeReviewQualification({ corpus: oneItem, judge, thresholds, instrumentManifest, layerOPrerequisite, deps, roots, log: () => {} });

  // §1: the qualification record binds the Layer-O v3 security prerequisite.
  assert.equal(result.layerOPrerequisite.instrument, "stage-q-layer-o-v3");
  assert.equal(result.securityStatus.status, "NOT_APPLICABLE_DELEGATED_TO_LAYER_O");

  // The REAL phase-1 instrument ran (a chapter-reviewer spawn happened).
  assert.ok(roles.includes("chapter-reviewer"), "the real reviewOneChapter path must spawn a chapter-reviewer");
  // The clean item was scored through the real instrument and is a correct clean-pass.
  assert.equal(result.perCase[0].resolved, true);
  assert.equal(result.metrics.cleanPassRate, 1, "a clean chapter shipped with clean keys and no mustFix scores cleanPass=1");
  // Durable evidence written ONLY under the experiment root (never canonical).
  const ev = resolve(roots.runRoot, "native-review-v2", "gpt-5-5-high", clean.itemId, "evidence.json");
  assert.ok(existsSync(ev), "per-item evidence written under the experiment root");
  assert.ok(ev.startsWith(roots.runRoot), "evidence path is inside the experiment root");
  const record = JSON.parse(readFileSync(ev, "utf8")) as { schema: string; rawFinalMessageSha256: string; parsedReview: { valid: boolean; pass: boolean } };
  assert.equal(record.schema, "migration-native-review-item-evidence-v2");
  assert.equal(record.parsedReview.valid, true);
  assert.equal(record.parsedReview.pass, true);
});
