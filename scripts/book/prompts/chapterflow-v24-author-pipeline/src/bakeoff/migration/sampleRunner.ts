/**
 * IMP-11 — one experiment sample = ONE first-write attempt of one chapter under
 * one cell (model × effort × stack), in a sample-isolated tree (prompt inst. 9;
 * §16 controls 2-5).
 *
 * Reuses the production writer verbatim (authorWriteOneChapter: IMP-01 isolated
 * attempt workspace, in-process gate/rubric/contract validation, IMP-10
 * evidence) with exactly three orchestration differences:
 *   1. firstWriteOnly — the ONE quality attempt; no gate retry, no lead
 *      degradation, no complaint feedback (assertOneAttemptOpts enforces);
 *   2. sample-local io — chapters/provenance/attempts under samples/<blindId>/,
 *      writes guarded by the experiment root;
 *   3. per-cell model/effort pins + (snapshot stacks) the frozen card template.
 *
 * Provider outcomes ride the IMP-02 disjoint taxonomy. ONE prespecified
 * infrastructure replay is permitted under the SAME sample identity; content
 * failures and safeguard/refusals are NEVER replayed. Every non-completed
 * spawn's redacted tail is preserved content-addressed — the raw material the
 * empty SAFEGUARD_MARKERS list (modelPolicy) is waiting on.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "fs";
import { dirname, resolve } from "path";

import { chapterContentHash } from "../../critics/qcAttestation.js";
import { checkSourceRegister } from "../../critics/sourceRegister.js";
import { putEvidenceObject, redactEvidence } from "../../evidence/evidenceStore.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import { chapterFileName } from "../../lib/chapterPaths.js";
import type { AutopilotDeps } from "../../orchestrator/autopilot.js";
import {
  authorChapterId,
  authorWriteOneChapter,
  resolveAuthorIo,
  type AuthorIo,
} from "../../orchestrator/authorRun.js";
import { classifyProviderOutcome } from "../../orchestrator/modelPolicy.js";
import { extractCausalClaims } from "../../review/causalClaims.js";
import { extractDiversityFeatures } from "../../telemetry/diversityFeatures.js";
import type { ProviderOutcomeV1 } from "../../contracts/routeContracts.js";
import type { ChapterV21 } from "../../types.js";
import { pipelineRel, sha256Hex } from "../paths.js";
import { CARD_OUTPUT_PLACEHOLDER } from "../freeze.js";
import {
  MIGRATION_SAMPLE_SCHEMA,
  type ExperimentSpecV1,
  type MigrationSampleRecordV1,
  type SampleScheduleEntryV1,
  type SealedManifestV1,
} from "./experimentTypes.js";
import { assertOneAttemptOpts, MigrationGuardError, rootedPath, rootedWrite, type MigrationRoots } from "./guards.js";
import { snapshotCardPath } from "./spec.js";

export function sampleDirOf(roots: MigrationRoots, blindSampleId: string): string {
  return rootedPath(roots, "samples", blindSampleId);
}

export function sampleRecordPath(roots: MigrationRoots, blindSampleId: string): string {
  return rootedPath(roots, "records", `${blindSampleId}.json`);
}

/** Sample-local AuthorIo: everything the writer touches lives under the sample
 *  dir; every write path is guard-checked. Lead overrides are structurally
 *  unreachable (one attempt ⇒ no degradation) and refuse loudly if ever hit. */
export function experimentSampleIo(roots: MigrationRoots, blindSampleId: string): Partial<AuthorIo> {
  const dir = sampleDirOf(roots, blindSampleId);
  const chaptersDir = resolve(dir, "chapters");
  const provenanceDir = resolve(dir, "provenance");
  const chapterAbs = (bookId: string, n: number): string =>
    rootedPath(roots, "samples", blindSampleId, "chapters", chapterFileName(authorChapterId(bookId, n)));
  return {
    chapterExists: (bookId, n) => existsSync(chapterAbs(bookId, n)),
    readChapterFile: (bookId, n) => {
      const p = chapterAbs(bookId, n);
      try { return existsSync(p) ? readFileSync(p, "utf8") : null; } catch { return null; }
    },
    writeChapterFile: (bookId, n, bytes) => {
      const p = chapterAbs(bookId, n);
      mkdirSync(dirname(p), { recursive: true });
      writeFileAtomic(p, bytes);
    },
    removeChapterFile: (bookId, n) => rmSync(chapterAbs(bookId, n), { force: true }),
    loadChapters: () => {
      if (!existsSync(chaptersDir)) return [];
      return readdirSync(chaptersDir)
        .filter((f) => f.endsWith(".chapter.json"))
        .map((f) => JSON.parse(readFileSync(resolve(chaptersDir, f), "utf8")) as ChapterV21)
        .sort((a, b) => a.number - b.number);
    },
    authorSessionOf: () => undefined,
    recordProvenance: (chapterId, sessionId, contentHash) => {
      const p = rootedPath(roots, "samples", blindSampleId, "provenance", `${chapterId}.json`);
      mkdirSync(provenanceDir, { recursive: true });
      writeFileAtomic(p, JSON.stringify({ schemaVersion: "migration-sample-provenance-v1", chapterId, authorSessionId: sessionId, contentHash: contentHash ?? null, stampedAt: new Date().toISOString() }, null, 2) + "\n");
    },
    readLeadOverride: () => null,
    writeLeadOverride: () => {
      throw new MigrationGuardError("lead degradation is structurally disabled in a one-attempt experiment sample");
    },
    attemptsRoot: () => resolve(dir, "attempts"),
  };
}

type SpawnObservationFull = {
  sessionId: string;
  completed: boolean;
  exitCode?: number;
  errorMessage?: string;
  stderr?: string;
  finalMessage?: string;
  durationMs: number;
};

export type RunSampleOptions = {
  entry: SampleScheduleEntryV1;
  spec: ExperimentSpecV1;
  sealed: SealedManifestV1;
  roots: MigrationRoots;
  deps: AutopilotDeps;
  /** Test fixture inputs (briefs/packets/plan/voice) merged OVER the sample io. */
  ioOverrides?: Partial<AuthorIo>;
  log: (m: string) => void;
};

function preserveSpawnTail(roots: MigrationRoots, o: SpawnObservationFull, outcome: ProviderOutcomeV1): void {
  try {
    putEvidenceObject(roots.evidenceRoot, "migration-spawn-tail", redactEvidence(JSON.stringify({
      sessionId: o.sessionId,
      classifiedOutcome: outcome,
      exitCode: o.exitCode ?? null,
      errorMessage: (o.errorMessage ?? "").slice(-2000),
      stderrTail: (o.stderr ?? "").slice(-2000),
      finalMessageTail: (o.finalMessage ?? "").slice(-2000),
    }, null, 2)));
  } catch { /* evidence preservation is best-effort — it never gates the record */ }
}

/** Run (or resume) ONE sample. A completed record is immutable — re-invocation
 *  returns it untouched (resume), never re-rolls an inconvenient sample. */
export async function runOneSample(opts: RunSampleOptions): Promise<MigrationSampleRecordV1> {
  const { entry, spec, sealed, roots } = opts;
  const recordPath = sampleRecordPath(roots, entry.blindSampleId);
  if (existsSync(recordPath)) {
    return JSON.parse(readFileSync(recordPath, "utf8")) as MigrationSampleRecordV1;
  }
  const cell = spec.cells.find((c) => c.cellId === entry.cellId);
  if (!cell) throw new MigrationGuardError(`schedule entry ${entry.blindSampleId} names unknown cell ${entry.cellId}`);
  const stack = spec.stacks.find((s) => s.id === cell.stackId);
  if (!stack) throw new MigrationGuardError(`cell ${cell.cellId} names unknown stack ${cell.stackId}`);
  const sealedBook = sealed.books.find((b) => b.bookId === entry.bookId);
  if (!sealedBook) throw new MigrationGuardError(`schedule entry ${entry.blindSampleId} names unsealed book ${entry.bookId}`);
  const sealedStack = sealed.stacks.find((s) => s.id === stack.id);
  const chKey = `${entry.bookId}:ch${String(entry.chapterNumber).padStart(2, "0")}`;

  // Snapshot stacks substitute their FROZEN template; the template must still
  // hash to the sealed pin at use time (a drifted snapshot halts, §16 stop 10).
  let cardOverride: ((base: string, ctx: { bookId: string; chapterNumber: number; outputRelPath: string }) => string) | undefined;
  if (stack.source === "snapshot") {
    const templatePath = snapshotCardPath(stack.snapshotDirRelPath, entry.bookId, entry.chapterNumber);
    cardOverride = (_base, ctx) => {
      const template = readFileSync(templatePath, "utf8");
      const expected = sealedStack?.cardTemplateSha256[chKey];
      if (!expected || sha256Hex(template) !== expected) {
        throw new MigrationGuardError(`stack ${stack.id}: snapshot template for ${chKey} does not match the sealed hash — refusing to author under a drifted stack`);
      }
      return template.split(CARD_OUTPUT_PLACEHOLDER).join(ctx.outputRelPath);
    };
  }

  const io: Partial<AuthorIo> = { ...experimentSampleIo(roots, entry.blindSampleId), ...(opts.ioOverrides ?? {}) };
  const observations: SpawnObservationFull[] = [];
  const observingDeps: AutopilotDeps = {
    ...opts.deps,
    mkSessionId: (label) => opts.deps.mkSessionId(`mig-${entry.blindSampleId}-${label}`),
    spawn: async (spawnOpts) => {
      const startedAt = Date.now();
      try {
        const r = await opts.deps.spawn(spawnOpts);
        observations.push({
          sessionId: r.sessionId,
          completed: true,
          exitCode: r.exitCode,
          stderr: r.stderr,
          finalMessage: r.finalMessage,
          durationMs: r.durationMs,
        });
        return r;
      } catch (err) {
        observations.push({
          sessionId: spawnOpts.sessionId,
          completed: false,
          errorMessage: (err as Error).message,
          durationMs: Date.now() - startedAt,
        });
        throw err;
      }
    },
  };

  const writeOpts = {
    io,
    totalChapters: sealedBook.totalChapters,
    outputRelPath: pipelineRel(resolve(sampleDirOf(roots, entry.blindSampleId), "chapters", chapterFileName(authorChapterId(entry.bookId, entry.chapterNumber)))),
    model: cell.model,
    effort: cell.effort,
    firstWriteOnly: true as const,
    cardOverride,
  };
  assertOneAttemptOpts(writeOpts);

  const attemptOnce = async (): Promise<{ ok: boolean; reason: string; outcome: ProviderOutcomeV1 }> => {
    const before = observations.length;
    const r = await authorWriteOneChapter(entry.bookId, entry.chapterNumber, observingDeps, writeOpts);
    const spawned = observations.slice(before);
    const last = spawned[spawned.length - 1];
    let outcome: ProviderOutcomeV1;
    if (!last) {
      // The writer refused before any spawn (missing brief/packet/plan) — a
      // policy-layer rejection, never replayed as infrastructure.
      outcome = "policy_preflight_failure";
    } else if (r.ok) {
      outcome = "content_completed";
    } else {
      const classified = classifyProviderOutcome({
        completed: last.completed,
        exitCode: last.exitCode,
        errorMessage: last.errorMessage,
        stderr: last.stderr,
        finalMessage: last.finalMessage,
      });
      // A clean spawn whose output failed write-time validation is a CONTENT
      // failure — visible as its own class, never replayable.
      outcome = classified === "content_completed" ? "content_invalid" : classified;
    }
    if (last && outcome !== "content_completed") preserveSpawnTail(roots, last, outcome);
    return { ok: r.ok, reason: r.ok ? "" : r.reason, outcome };
  };

  let replayed = false;
  let originalOutcome: ProviderOutcomeV1 | undefined;
  let result = await attemptOnce();
  if (!result.ok && spec.infraReplay.replayableOutcomes.includes(result.outcome) && spec.infraReplay.maxPerSample >= 1) {
    opts.log(`[migration] sample ${entry.blindSampleId}: ${result.outcome} — one prespecified infrastructure replay under the same sample identity`);
    originalOutcome = result.outcome;
    replayed = true;
    result = await attemptOnce();
  }

  // Deterministic critics ONCE on the committed candidate (§16 control 8).
  let contentSha256: string | null = null;
  let chapterRelPath: string | null = null;
  let critics: MigrationSampleRecordV1["critics"] = null;
  if (result.ok) {
    const mergedIo = resolveAuthorIo(io);
    const chapter = mergedIo.loadChapters(entry.bookId).find((c) => c.number === entry.chapterNumber);
    if (chapter) {
      contentSha256 = chapterContentHash(chapter);
      chapterRelPath = writeOpts.outputRelPath;
      let plan = null;
      try { plan = mergedIo.readSourcePlan(entry.bookId, entry.chapterNumber); } catch { plan = null; }
      const c37 = checkSourceRegister(chapter, plan);
      const countOf = (needle: string): number => c37.filter((f) => String(f.checkId).includes(needle)).length;
      critics = {
        c37Overreach: countOf("claim_strength_overreach"),
        c37SceneCompletion: countOf("unsupported_scene_completion"),
        c37GenericLeak: countOf("generic_specific_leak"),
        registerAdvisories: c37.length,
        causalClaims: extractCausalClaims(chapter, plan).claims.length,
        diversity: extractDiversityFeatures(entry.bookId, chapter, plan).features,
      };
    }
  }

  const record: MigrationSampleRecordV1 = {
    schema: MIGRATION_SAMPLE_SCHEMA,
    experimentId: spec.experimentId,
    stage: spec.stage,
    blindSampleId: entry.blindSampleId,
    cellId: entry.cellId,
    bookId: entry.bookId,
    chapterNumber: entry.chapterNumber,
    stratum: entry.stratum,
    sampleIndex: entry.sampleIndex,
    executionOrder: entry.executionOrder,
    outcome: {
      providerOutcome: result.outcome,
      replayed,
      ...(originalOutcome ? { originalProviderOutcome: originalOutcome } : {}),
      firstWriteDeterministicPass: result.ok,
      ...(result.ok ? {} : { failureReason: result.reason.slice(0, 600) }),
      durationMs: observations.reduce((s, o) => s + o.durationMs, 0),
      writerSessionIds: observations.map((o) => o.sessionId),
    },
    artifact: { contentSha256, chapterRelPath },
    critics,
    review: null,
    tokens: null,
    unavailableFields: ["tokens", "cost"],
    recordedAt: new Date().toISOString(),
  };
  rootedWrite(roots, recordPath, JSON.stringify(record, null, 2));
  return record;
}
