/**
 * IMP-19 — Layer-N v2 runner: drives the REAL production two-phase review path
 * (reviewOneChapter) over the native-review corpus, through a MIGRATION-ISOLATED
 * io (never canonical state), with phase-2 on the frozen quiz subset, capturing
 * the raw final message and writing durable per-item evidence. Scores through the
 * capability-specific channels and produces a NativeReviewQualificationV2.
 *
 * Isolation: every write routes through rootedWrite/rootedPath (guards.ts) — the
 * qualification cannot touch any canonical tree; it writes only under the experiment root.
 * The reviewer's own workspace is physically isolated (IMP-08). No API/fallback
 * path is reachable (the ChatGPT-subscription broker is the only spawn route).
 */

import { createHash } from "crypto";

import { writeFileAtomic, ensureTrailingNewline } from "../../lib/atomicWrite.js";
import type { AutopilotDeps } from "../../orchestrator/autopilot.js";
import { resolveAuthorReviewIo, reviewOneChapter } from "../../orchestrator/authorReview.js";
import { AUTHOR_CHAPTER_BAR, buildReaderReviewTask } from "../../review/readerReview.js";
import { renderChapterReaderDocPhase1 } from "../../review/renderReaderDoc.js";
import { chapterContentHash } from "../../critics/qcAttestation.js";
import { modelSlug } from "../paths.js";
import { judgeDeps, type JudgeSpec } from "../review.js";
import { assertNotClosed, rootedPath, rootedWrite, type MigrationRoots } from "./guards.js";
import {
  NATIVE_REVIEW_QUALIFICATION_SCHEMA,
  NATIVE_REVIEW_ITEM_EVIDENCE_SCHEMA,
  type LayerOPrerequisiteBindingV1,
  type NativeReviewCorpusV2,
  type NativeReviewInstrumentManifestV2,
  type NativeReviewItemEvidenceV2,
  type NativeReviewQualificationV2,
  type NativeReviewThresholdsV2,
} from "./nativeReviewTypes.js";
import {
  nativeReviewCorpusSha256,
  nativeReviewInstrumentManifestSha256,
  qualifyNativeReviewJudge,
  scoreNativeReviewCase,
  scoreNativeReviewJudge,
  type NativeReviewRead,
} from "./nativeReviewQualification.js";
import { nativeReviewThresholdsSha256 } from "./nativeReviewSeal.js";

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
const BOOK = "native-review-v2"; // synthetic; the corpus item carries its own chapter

export type RunNativeReviewOptions = {
  corpus: NativeReviewCorpusV2;
  judge: JudgeSpec;
  thresholds: NativeReviewThresholdsV2;
  instrumentManifest: NativeReviewInstrumentManifestV2;
  /** §1: the bound Layer-O v3 security prerequisite (from the seal) — stamped into
   *  the qualification record; security is NOT_APPLICABLE / delegated in Layer-N. */
  layerOPrerequisite: LayerOPrerequisiteBindingV1;
  deps: AutopilotDeps;
  roots: MigrationRoots;
  log: (m: string) => void;
  /** Test seam (default: the real phase-1/2 instrument). */
  reviewFn?: typeof reviewOneChapter;
};

/** Run the whole corpus through one judge and score it. Serial by construction
 *  (each item's review is independent; equal exposure). */
export async function runNativeReviewQualification(opts: RunNativeReviewOptions): Promise<NativeReviewQualificationV2> {
  // Resume freeze (IMP-20 §K): this is the Layer-N v2 LIVE entry — the halted
  // campaign's driver flows through NEITHER runMigrationExperiment NOR
  // sealNativeReview, so this is the only src/ choke on it. A closed corpus id
  // (e.g. the archived Layer-N v2 corpus) fail-closes here, exception-free.
  assertNotClosed(opts.corpus.corpusId);
  const { corpus, judge, thresholds, instrumentManifest, roots, log } = opts;
  const slug = `${modelSlug(judge.model)}-${judge.effort}`;
  const corpusSha256 = nativeReviewCorpusSha256(corpus);
  const instrumentManifestSha256 = nativeReviewInstrumentManifestSha256(instrumentManifest);
  const thresholdsSha256 = nativeReviewThresholdsSha256(thresholds);
  const readerTaskSha256 = sha(buildReaderReviewTask("ch.txt", AUTHOR_CHAPTER_BAR));

  const reads = new Map<string, NativeReviewRead>();

  for (const item of corpus.items) {
    // Capture the raw phase-1 final message for THIS item (advisory security +
    // durable evidence). Serial ⇒ one live read at a time.
    let capturedMsg: string | null = null;
    const jdeps = judgeDeps(opts.deps, judge);
    const capturingDeps: AutopilotDeps = {
      ...jdeps,
      spawn: async (o) => {
        const r = await jdeps.spawn(o);
        if (o.role === "chapter-reviewer") capturedMsg = r.finalMessage ?? r.stdout ?? null;
        return r;
      },
    };
    const io = resolveAuthorReviewIo({
      writeReviewDoc: (_b, fileName, text) => {
        const absPath = rootedPath(roots, "native-review-v2", slug, item.itemId, fileName);
        const finalText = ensureTrailingNewline(text);
        writeFileAtomic(absPath, finalText);
        return { absPath, relPath: absPath };
      },
      persistReview: (_b, review) => {
        const p = rootedPath(roots, "native-review-v2", slug, item.itemId, `ch${String(review.chapterNumber).padStart(2, "0")}.review.json`);
        writeFileAtomic(p, JSON.stringify(review, null, 2) + "\n");
        return p;
      },
      authorSessionOf: () => undefined,
      loadChapters: () => [item.chapter],
    });

    const startedAt = new Date().toISOString();
    const review = await (opts.reviewFn ?? reviewOneChapter)(
      BOOK, item.chapter, capturingDeps, io, AUTHOR_CHAPTER_BAR,
      `-lnv2-${slug}-${item.itemId}`,
      item.requiresPhase2, // persist=true ⇒ phase-2 runs (quiz subset); false ⇒ phase-1 only
    );
    const read: NativeReviewRead = { itemId: item.itemId, review, rawFinalMessage: capturedMsg };
    reads.set(item.itemId, read);

    // Durable, immutable per-item evidence (LN-11).
    const cs = scoreNativeReviewCase(item, read);
    const evidence: NativeReviewItemEvidenceV2 = {
      schema: NATIVE_REVIEW_ITEM_EVIDENCE_SCHEMA,
      blindItemId: item.itemId,
      itemId: item.itemId,
      kind: item.kind,
      judge: { model: judge.model, effort: judge.effort },
      chapterContentSha256: chapterContentHash(item.chapter),
      renderedDocSha256: sha(renderChapterReaderDocPhase1(item.chapter)),
      readerTaskSha256,
      instrumentManifestSha256,
      executionProfileHash: review.executionProfileHash ?? null,
      workspaceManifestSha256: review.workspaceManifestSha256 ?? null,
      routeSidecarRef: review.reviewerSessionId ?? null,
      rawFinalMessageSha256: sha(capturedMsg ?? ""),
      rawFinalMessage: capturedMsg,
      parsedReview: review,
      phase2: review.quizAdjudication ?? null,
      matcherDecision: {
        resolved: cs.resolved,
        detected: cs.detected,
        channel: cs.channel,
        acceptedEvidenceSpansMatched: item.expected.acceptedEvidenceSpans ?? [],
        rejectedReasons: cs.resolved ? [] : [cs.note],
      },
      attempt: 1,
      replayOf: null,
      startedAt,
      durationMs: 0,
    };
    rootedWrite(roots, rootedPath(roots, "native-review-v2", slug, item.itemId, "evidence.json"), JSON.stringify(evidence, null, 2));
    log(`[native-review-v2] ${slug} ${item.itemId} (${item.kind}): resolved=${cs.resolved} detected=${cs.detected ?? "n/a"} — ${cs.note}`);
  }

  const { metrics, perCase } = scoreNativeReviewJudge(corpus.items, reads);
  const { qualified } = qualifyNativeReviewJudge(metrics, thresholds);
  const dryRunOnly = corpus.items.some((i) => i.approvalStatus !== "independently-human-labeled");
  const result: NativeReviewQualificationV2 = {
    schema: NATIVE_REVIEW_QUALIFICATION_SCHEMA,
    judge: { model: judge.model, effort: judge.effort },
    corpusId: corpus.corpusId,
    corpusSha256,
    instrumentManifestSha256,
    thresholdsSha256,
    scoredAt: new Date().toISOString(),
    metrics,
    thresholds,
    perCase,
    qualified,
    approvalStatus: corpus.approvalStatus,
    independentHumanRater: corpus.independentHumanRater,
    dryRunOnly,
    securityStatus: {
      status: "NOT_APPLICABLE_DELEGATED_TO_LAYER_O",
      reason: "Layer-N v2 corpus contains no security cases (LN-08); ChapterReviewV1 carries no behavioral security field. Security qualification is the bound Stage-Q Layer-O v3 prerequisite, not a Layer-N pass.",
    },
    layerOPrerequisite: opts.layerOPrerequisite,
  };
  rootedWrite(roots, rootedPath(roots, "native-review-v2", `${slug}.qualification.json`), JSON.stringify(result, null, 2));
  log(`[native-review-v2] ${slug}: ${qualified ? "QUALIFIED" : "NOT QUALIFIED"} — hardBlockerSens ${metrics.hardBlockerSensitivity.toFixed(2)}, keyMismatch ${metrics.quizKeyMismatchDetectionRate.toFixed(2)}, cleanPass ${metrics.cleanPassRate.toFixed(2)}, unresolved ${metrics.unresolvedRequiredCases}`);
  return result;
}
