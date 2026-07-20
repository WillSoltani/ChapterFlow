/**
 * Model bake-off — the deterministic conductor.
 *
 * Phase ladder (each phase completes durably in manifest.json; a rerun with the
 * same run id re-enters at the first incomplete phase and reuses verified work):
 *
 *   intake     — draft → immutable hashed artifact + identity resolution
 *   research   — ONE draft-grounded research session (existing contract:
 *                state/indexes/<id>.json + fresh source-v2 sidecars)
 *   freeze     — compile chain (existing verbs) + hash every shared input
 *   preflight  — codex version + ALL candidate models + the judge model answer
 *                a trivial pinned-model probe; any failure halts BEFORE any
 *                expensive generation
 *   candidates — N isolated complete books (existing whole-chapter writer)
 *   validate   — existing deterministic batteries per candidate (no QC rounds)
 *   review     — blinded, fixed-judge comparison under opaque labels
 *   select     — pure quality-first hierarchy (cost only inside the tie band)
 *   report     — permanent JSON + Markdown comparison report
 *
 * This route is screening-only. It never promotes, opens QC, publishes, changes
 * current.json, or writes a production package.
 */

import { BASELINE_MODEL } from "../orchestrator/modelPolicy.js";
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { resolve } from "path";

import {
  acquireBookLock,
  buildSourcePrewriteRepairTask,
  resolveDeps,
  type AutopilotDeps,
  type BookLock,
  type VerbResult,
} from "../orchestrator/autopilot.js";
import { findCodexBinary } from "../orchestrator/codexAgent.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { normSlug } from "../lib/chapterPaths.js";
import type {
  BakeoffManifestV1,
  BakeoffPhase,
  CandidateReviewV1,
  CandidateSpec,
  CandidateStateV1,
  CandidateValidationV1,
  ReasoningEffort,
} from "./types.js";
import { BAKEOFF_MANIFEST_SCHEMA } from "./types.js";
import { PIPELINE_DIR, bakeoffRoots, candidateDir, modelSlug, pipelineRel, sha256File, type BakeoffRoots } from "./paths.js";
import { intakeDraft, resolveBookIdForDraft, type ExtractorDeps, type IntakeOverrides } from "./intake.js";
import { freezeSharedInputs, verifySharedInputs } from "./freeze.js";
import { defaultValidateInputs, generateCandidate, validateCandidate } from "./candidates.js";
import { assignBlindLabels, combinedContentHash, forbiddenReviewTokens, BAKEOFF_NOISE_BAND } from "./review.js";
import { selectWinner, type SelectionInputs } from "./selection.js";
import { writeReports, type ReportInputs } from "./report.js";
import type { LegacyBakeoffStateAdapter } from "../release/legacyBakeoffStateAdapter.js";

export const DEFAULT_BAKEOFF_MODELS = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];
export const DEFAULT_BAKEOFF_EFFORT: ReasoningEffort = "xhigh";
export const DEFAULT_JUDGE_MODEL = BASELINE_MODEL; // IMP-02: judge default rides the policy baseline until IMP-11 qualification
export const DEFAULT_JUDGE_EFFORT: ReasoningEffort = "high";
const RESEARCH_TIMEOUT_MS = 45 * 60 * 1000;
const PREFLIGHT_TIMEOUT_MS = 5 * 60 * 1000;
const SOURCE_REPAIR_MAX_PASSES = 3;

/** Legacy test seam only. Screening conductor never invokes delegation. */
export type DelegateVerb = (args: string[], env: Record<string, string>, onLine: (line: string) => void) => Promise<VerbResult>;

export type BakeoffDeps = AutopilotDeps & {
  /** Injected randomness (blind-label shuffle). Tests pin it. */
  rng: () => number;
  /** `codex --version` (recorded in the report); null when unavailable. */
  codexVersion: () => string | null;
  readonly delegate?: DelegateVerb;
};

function defaultCodexVersion(): string | null {
  try {
    return execFileSync(findCodexBinary(), ["--version"], { encoding: "utf8", timeout: 20_000 }).trim() || null;
  } catch {
    return null;
  }
}

export function resolveBakeoffDeps(d?: Partial<BakeoffDeps>): BakeoffDeps {
  const base = resolveDeps(d);
  return {
    ...base,
    rng: d?.rng ?? Math.random,
    codexVersion: d?.codexVersion ?? defaultCodexVersion,
  };
}

/** The phase implementations, injectable so conductor tests drive the REAL
 *  phase logic (ordering, resume, blinding, halts, mutation boundaries) with
 *  synthetic stage outputs; each default is the real implementation and has its
 *  own focused unit tests. */
export type BakeoffStages = {
  freezeInputs: typeof freezeSharedInputs;
  verifyInputs: typeof verifySharedInputs;
  generate: typeof generateCandidate;
  validate: typeof validateCandidate;
};

function resolveStages(over?: Partial<BakeoffStages>): BakeoffStages {
  return {
    freezeInputs: over?.freezeInputs ?? freezeSharedInputs,
    verifyInputs: over?.verifyInputs ?? verifySharedInputs,
    generate: over?.generate ?? generateCandidate,
    validate: over?.validate ?? validateCandidate,
  };
}

export type RunBakeoffOptions = {
  draftPath: string;
  bookId?: string;
  runId?: string;
  models?: string[];
  effort?: ReasoningEffort;
  judgeModel?: string;
  judgeEffort?: ReasoningEffort;
  maxParallel?: number;
  /** Concurrent chapter writers WITHIN one candidate. */
  chapterParallel?: number;
  /** Compare over this chapter SUBSET instead of the whole index. A subset run
   *  is automatically COMPARE-ONLY: candidates, validation, blinded review,
   *  selection, and the report run normally, but a partial book is never
   *  promoted into canonical state, never QC'd, never published. */
  chapters?: number[];
  publish?: boolean;
  plan?: boolean;
  force?: boolean;
  overrides?: IntakeOverrides;
  deps?: Partial<BakeoffDeps>;
  extractor?: ExtractorDeps;
  /** Lock factory override (tests). Default: the autopilot book lock. */
  acquireLock?: (bookId: string) => BookLock;
  /** Alternate state root for the run tree (tests use a tmp dir). */
  stateRoot?: string;
  /** Stage implementations override (tests). */
  stages?: Partial<BakeoffStages>;
  /** Required V4 compatibility edge, composed below this disposable run root. */
  v4: LegacyBakeoffStateAdapter;
};

export type BakeoffOutcome = {
  status: "complete" | "ready" | "published" | "halt" | "plan" | "compared";
  bookId: string;
  runId: string;
  winner: string | null;
  reason?: string;
  reportJsonPath?: string;
  reportMdPath?: string;
  /** Set when publication identity is ambiguous — the ONE question to answer. */
  publicationQuestion?: string;
};

// ── Manifest IO ───────────────────────────────────────────────────────────────

export function readManifest(roots: BakeoffRoots): BakeoffManifestV1 | null {
  if (!existsSync(roots.manifestPath)) return null;
  try {
    const m = JSON.parse(readFileSync(roots.manifestPath, "utf8")) as BakeoffManifestV1;
    return m.schemaVersion === BAKEOFF_MANIFEST_SCHEMA ? m : null;
  } catch {
    return null;
  }
}

export function writeManifest(roots: BakeoffRoots, manifest: BakeoffManifestV1): void {
  manifest.updatedAt = new Date().toISOString();
  mkdirSync(roots.runRoot, { recursive: true });
  writeFileAtomic(roots.manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

function phaseDone(m: BakeoffManifestV1, phase: BakeoffPhase): boolean {
  return m.completedPhases.includes(phase);
}

function markDone(roots: BakeoffRoots, m: BakeoffManifestV1, phase: BakeoffPhase): void {
  if (!m.completedPhases.includes(phase)) m.completedPhases.push(phase);
  writeManifest(roots, m);
}

// ── Candidate artifact IO (durable per-candidate records) ─────────────────────

function generationPath(roots: BakeoffRoots, slug: string): string {
  return resolve(candidateDir(roots, slug), "generation.json");
}
function validationPath(roots: BakeoffRoots, slug: string): string {
  return resolve(candidateDir(roots, slug), "validation.json");
}
function reviewPath(roots: BakeoffRoots, label: string): string {
  return resolve(roots.reviewsDir, label, "review.json");
}

function readJsonIf<T>(p: string): T | null {
  try {
    return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;
  } catch {
    return null;
  }
}

// ── The conductor ─────────────────────────────────────────────────────────────

export async function runBakeoff(opts: RunBakeoffOptions): Promise<BakeoffOutcome> {
  const deps = resolveBakeoffDeps(opts.deps);
  const stages = resolveStages(opts.stages);
  const log = deps.log;
  const models = (opts.models?.length ? opts.models : DEFAULT_BAKEOFF_MODELS).map((m) => m.trim()).filter(Boolean);
  if (new Set(models).size !== models.length) throw new Error("duplicate model ids in --models");
  const effort = opts.effort ?? DEFAULT_BAKEOFF_EFFORT;
  const judge = { model: opts.judgeModel ?? DEFAULT_JUDGE_MODEL, effort: opts.judgeEffort ?? DEFAULT_JUDGE_EFFORT };
  const overrides = opts.overrides ?? {};
  if (opts.publish === true) {
    throw new Error("model-bakeoff is SCREENING_ONLY; promotion, QC, and publication are unavailable");
  }

  // Identity + run root. Default run id is DERIVED FROM THE DRAFT HASH so a
  // re-paste of the same task resumes the same run without remembering ids.
  const bookId = normSlug(opts.bookId ?? resolveBookIdForDraft(opts.draftPath, overrides, opts.extractor));
  const draftSha = sha256File(resolve(opts.draftPath));
  const runId = opts.runId ?? `bo-${draftSha.slice(0, 10)}`;
  const roots = bakeoffRoots(bookId, runId, opts.stateRoot);

  let manifest = readManifest(roots);
  if (!manifest) {
    manifest = {
      schemaVersion: BAKEOFF_MANIFEST_SCHEMA,
      runId,
      bookId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      candidates: models.map((model, i) => ({ model, slug: modelSlug(model), slot: `w${i + 1}`, effort })),
      judge,
      maxParallel: Math.max(1, opts.maxParallel ?? 3),
      publish: false,
      blindMap: {},
      completedPhases: [],
    };
  } else {
    // A resumed run keeps its recorded candidate set; a DIFFERENT --models list
    // under the same run id is an operator error, not a silent re-mix.
    const recorded = manifest.candidates.map((c) => c.model);
    if (opts.models?.length && JSON.stringify([...models].sort()) !== JSON.stringify([...recorded].sort())) {
      throw new Error(`run ${runId} already compares [${recorded.join(", ")}] — pass a new --run-id to compare a different model set`);
    }
    manifest.publish = false;
  }
  // --force re-opens everything downstream of the frozen shared inputs: the
  // candidates regenerate, and every derived decision (validation, blinded
  // reviews, selection, report) recomputes from the fresh bytes.
  // Intake/research/freeze stay — the comparison inputs are still the run's
  // identity. Existing immutable V4 candidate IDs accept only identical bytes.
  if (opts.force) {
    manifest.completedPhases = manifest.completedPhases.filter((p) => ["intake", "research", "freeze", "preflight"].includes(p));
    manifest.selection = undefined;
    manifest.promotion = undefined;
    manifest.qc = undefined;
  }
  const specs = manifest.candidates;

  if (opts.plan) {
    const planLines = [
      `[bakeoff] PLAN for ${bookId} (run ${runId})`,
      `  draft: ${opts.draftPath} (sha256 ${draftSha.slice(0, 16)})`,
      `  candidates: ${specs.map((s) => `${s.model} @ ${s.effort} → work/${s.slot}`).join("; ")}`,
      `  judge (fixed): ${judge.model} @ ${judge.effort}`,
      `  authority: SCREENING_ONLY (no promotion/QC/publish/current/package write)`,
      `  run root: ${pipelineRel(roots.runRoot)}`,
      `  phases: intake → research → freeze → preflight → candidates → validate → review → select → report`,
      `  completed so far: ${manifest.completedPhases.join(", ") || "(none)"}`,
    ];
    for (const l of planLines) log(l);
    return { status: "plan", bookId, runId, winner: manifest.selection?.winner ?? null };
  }

  const lockFactory = opts.acquireLock ?? ((id: string) => acquireBookLock(resolve(roots.runRoot, "locks"), id));
  const lock = lockFactory(bookId);
  if (!lock.ok) {
    return { status: "halt", bookId, runId, winner: null, reason: `another run holds the ${bookId} lock (${lock.heldBy ?? "unknown owner"}) — remove state/autopilot-locks/${bookId}.lock only if you are sure it is stale.` };
  }
  const heartbeat = (): boolean => (lock.refresh ? lock.refresh() : true);
  const halt = (reason: string): BakeoffOutcome => {
    manifest!.haltReason = reason;
    writeManifest(roots, manifest!);
    log(`[bakeoff] HALT: ${reason}`);
    return { status: "halt", bookId, runId, winner: manifest!.selection?.winner ?? null, reason };
  };

  try {
    writeManifest(roots, manifest);

    // ── Phase: intake ─────────────────────────────────────────────────────────
    if (!phaseDone(manifest, "intake")) {
      log(`[bakeoff] intake: ${opts.draftPath}`);
      manifest.intake = intakeDraft(opts.draftPath, roots, overrides, opts.extractor);
      log(`[bakeoff] intake: "${manifest.intake.title ?? "(title unresolved)"}"${manifest.intake.author ? ` by ${manifest.intake.author}` : ""} → bookId ${manifest.intake.bookId} (identity ${manifest.intake.identityConfident ? "confident" : "PROVISIONAL"})`);
      markDone(roots, manifest, "intake");
    }
    const intake = manifest.intake!;

    // ── Phase: research (ONCE, draft-grounded, existing handoff contract) ────
    if (!phaseDone(manifest, "research")) {
      if (deps.expectedChapterNumbers(bookId).length > 0) {
        log(`[bakeoff] research: chapter index already exists — reusing existing research (shared across all candidates)`);
      } else {
        const outcome = await doDraftResearch(bookId, intake.storedTextRelPath, intake.title, intake.author, deps, log);
        if (outcome) return halt(outcome);
      }
      markDone(roots, manifest, "research");
    }

    // ── Phase: freeze (compile chain once + hash everything) ─────────────────
    if (!phaseDone(manifest, "freeze")) {
      const src = await ensureSourceReady(bookId, deps, log, heartbeat);
      if (src) return halt(src);
      for (const verb of [
        ["compile-source-packets"], ["source-packet-gate"],
        ["compile-book-design"], ["book-design-gate"],
        ["compile-chapter-briefs"], ["chapter-brief-gate"],
      ]) {
        const r = await deps.runVerb([...verb, bookId]);
        if (r.code !== 0) return halt(`compile step '${verb[0]}' failed:\n${(r.stdout || r.stderr).slice(0, 1600)}`);
        log(`[bakeoff] freeze: ${verb[0]} ok`);
      }
      const indexChapters = deps.expectedChapterNumbers(bookId);
      let chapterNumbers = indexChapters;
      if (opts.chapters?.length) {
        const bad = opts.chapters.filter((n) => !indexChapters.includes(n));
        if (bad.length > 0) {
          return halt(`--chapters names chapters not in the index: ${bad.join(", ")} (the index has ${indexChapters.join(", ")})`);
        }
        chapterNumbers = [...new Set(opts.chapters)].sort((a, b) => a - b);
      }
      manifest.freeze = stages.freezeInputs(bookId, chapterNumbers);
      log(`[bakeoff] freeze: ${manifest.freeze.files.length} shared inputs frozen (combined ${manifest.freeze.combinedSha256.slice(0, 16)}); ${chapterNumbers.length} chapters; card templates hashed`);
      markDone(roots, manifest, "freeze");
    }
    const freeze = manifest.freeze!;
    // A resumed run keeps its FROZEN chapter set; a different --chapters list
    // under the same run id is an operator error, never a silent re-mix.
    if (opts.chapters?.length) {
      const wanted = [...new Set(opts.chapters)].sort((a, b) => a - b);
      if (JSON.stringify(wanted) !== JSON.stringify(freeze.chapterNumbers)) {
        throw new Error(`run ${runId} froze chapters [${freeze.chapterNumbers.join(", ")}] — pass a new --run-id to compare a different chapter subset`);
      }
    }
    // COMPARE-ONLY: a chapter subset can answer "which model writes better" but
    // must never become a partial canonical book — promotion/QC/publish are
    // skipped after selection, by construction rather than by flag.
    const fullIndexCount = deps.expectedChapterNumbers(bookId).length;
    const compareOnly = fullIndexCount > 0 && freeze.chapterNumbers.length < fullIndexCount;

    // ── Phase: preflight (models must exist BEFORE expensive generation) ─────
    if (!phaseDone(manifest, "preflight")) {
      const probes = [...specs.map((s) => s.model), judge.model];
      const results: Array<{ model: string; ok: boolean; detail: string }> = [];
      for (const model of probes) {
        const r = await preflightModel(model, deps);
        results.push(r);
        log(`[bakeoff] preflight: ${model} → ${r.ok ? "ok" : `FAILED (${r.detail})`}`);
      }
      manifest.preflight = { checkedAt: new Date().toISOString(), codexVersion: deps.codexVersion(), models: results };
      writeManifest(roots, manifest);
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        return halt(
          `model preflight failed — refusing to start generation. ` +
          failed.map((f) => `${f.model}: ${f.detail}`).join(" | ") +
          `. Check the Codex workspace entitlement for the failed model id(s); no model is silently substituted.`,
        );
      }
      markDone(roots, manifest, "preflight");
    }

    // ── Phase: candidates (isolated complete books) ──────────────────────────
    if (!phaseDone(manifest, "candidates")) {
      const drift = stages.verifyInputs(freeze);
      if (drift.length > 0) return halt(`shared inputs drifted BEFORE generation:\n- ${drift.join("\n- ")}`);
      await mapPool(specs, manifest.maxParallel, async (spec) => {
        const prior = readJsonIf<CandidateStateV1>(generationPath(roots, spec.slug));
        if (!opts.force && prior?.status === "complete") {
          log(`[bakeoff] ${spec.model}: generation already complete — reusing (resume)`);
          return;
        }
        log(`[bakeoff] ${spec.model}: generating ${freeze.chapterNumbers.length} chapters into work/${spec.slot} (@ ${spec.effort})`);
        await stages.generate(bookId, spec, deps, roots, {
          chapterNumbers: freeze.chapterNumbers,
          chapterParallel: Math.max(1, opts.chapterParallel ?? 2),
          force: opts.force,
          prior,
          heartbeat,
          log,
        }, (state) => {
          mkdirSync(candidateDir(roots, spec.slug), { recursive: true });
          writeFileAtomic(generationPath(roots, spec.slug), JSON.stringify(state, null, 2) + "\n");
        });
      });
      const postDrift = stages.verifyInputs(freeze);
      if (postDrift.length > 0) return halt(`shared inputs drifted DURING generation (comparison invalidated):\n- ${postDrift.join("\n- ")}`);
      markDone(roots, manifest, "candidates");
    }

    // ── Phase: validate (existing deterministic batteries; no QC rounds) ─────
    if (!phaseDone(manifest, "validate")) {
      for (const spec of specs) {
        const staged = await opts.v4.stageCandidate({
          bookId,
          runId,
          spec,
          chapterNumbers: freeze.chapterNumbers,
          createdAt: new Date().toISOString(),
        });
        if (!staged.ok) return halt(`candidate ${spec.model} V4 staging failed: [${staged.error.code}] ${staged.error.message}`);
        const chapters = opts.v4.candidateChapters(staged.value);
        if (!chapters.ok) return halt(`candidate ${spec.model} V4 reopen failed: [${chapters.error.code}] ${chapters.error.message}`);
        const inputs = { ...defaultValidateInputs(), chapterNumbers: freeze.chapterNumbers, chapters: chapters.value };
        const validation = await stages.validate(bookId, spec, roots, inputs);
        writeFileAtomic(validationPath(roots, spec.slug), JSON.stringify(validation, null, 2) + "\n");
        log(`[bakeoff] validate ${spec.model}: ${validation.hardFailures.length === 0 ? "clean" : `${validation.hardFailures.length} hard failure(s)`} (book-gate ${validation.bookGatePassed ? "PASS" : "FAIL"}, rubric ${validation.rubricVerdict})`);
      }
      markDone(roots, manifest, "validate");
    }

    // ── Phase: review (blinded, fixed judge, opaque labels) ──────────────────
    if (Object.keys(manifest.blindMap).length === 0) {
      manifest.blindMap = assignBlindLabels(specs, deps.rng);
      writeManifest(roots, manifest);
    }
    const labelOf = (model: string): string => {
      const found = Object.entries(manifest!.blindMap).find(([, m]) => m === model);
      if (!found) throw new Error(`no blind label for ${model}`);
      return found[0];
    };
    if (!phaseDone(manifest, "review")) {
      const forbidden = forbiddenReviewTokens(specs);
      for (const spec of specs) {
        const label = labelOf(spec.model) as "A";
        const generation = readJsonIf<CandidateStateV1>(generationPath(roots, spec.slug));
        const validation = readJsonIf<CandidateValidationV1>(validationPath(roots, spec.slug));
        if (generation?.status !== "complete" || !validation || validation.hardFailures.length > 0) {
          log(`[bakeoff] review: skipping ${spec.model} (label ${label}) — ineligible before review (${generation?.status !== "complete" ? "incomplete book" : "deterministic hard failures"})`);
          continue;
        }
        const opened = await opts.v4.openCandidate(bookId, spec);
        if (!opened.ok) return halt(`candidate ${spec.model} V4 reopen before review failed: [${opened.error.code}] ${opened.error.message}`);
        const chapters = opts.v4.candidateChapters(opened.value);
        if (!chapters.ok) return halt(`candidate ${spec.model} V4 chapter read before review failed: [${chapters.error.code}] ${chapters.error.message}`);
        const screening = await opts.v4.screening(bookId, spec, label);
        if (!screening.ok || screening.value.outcome !== "SHORTLIST") {
          const detail = screening.ok ? screening.value.outcome : `[${screening.error.code}] ${screening.error.message}`;
          return halt(`candidate ${label} screening authorization failed: ${detail}`);
        }
        const prior = readJsonIf<CandidateReviewV1>(reviewPath(roots, label));
        if (!opts.force && prior && prior.contentSha256 === combinedContentHash([...chapters.value])) {
          log(`[bakeoff] review: label ${label} already reviewed at these bytes — reusing (resume)`);
          continue;
        }
        log(`[bakeoff] review: label ${label} — ${chapters.value.length} blinded chapter reads + 2 whole-book reads (judge ${judge.model} @ ${judge.effort})`);
        if (!heartbeat()) return halt("lost the run lock during review");
        const reviewed = await opts.v4.reviewForSelection({
          bookId,
          spec,
          label,
          deps,
          options: {
            runId,
            judge,
            forbidden,
            heartbeat,
            log,
            chapterParallel: Math.max(1, opts.chapterParallel ?? 2),
          },
        });
        if (!reviewed.ok) return halt(`candidate ${label} screening review failed: [${reviewed.error.code}] ${reviewed.error.message}`);
      }
      markDone(roots, manifest, "review");
    }

    // ── Phase: select ─────────────────────────────────────────────────────────
    const selectionInputs: SelectionInputs = specs.map((spec) => ({
      spec,
      label: labelOf(spec.model),
      generation: readJsonIf<CandidateStateV1>(generationPath(roots, spec.slug)),
      validation: readJsonIf<CandidateValidationV1>(validationPath(roots, spec.slug)),
      review: readJsonIf<CandidateReviewV1>(reviewPath(roots, labelOf(spec.model))),
    }));
    if (!phaseDone(manifest, "select")) {
      manifest.selection = selectWinner(selectionInputs, BAKEOFF_NOISE_BAND);
      mkdirSync(roots.selectionDir, { recursive: true });
      writeFileAtomic(resolve(roots.selectionDir, "selection.json"), JSON.stringify(manifest.selection, null, 2) + "\n");
      for (const r of manifest.selection.reasons) log(`[bakeoff] select: ${r}`);
      markDone(roots, manifest, "select");
    }
    const selection = manifest.selection!;
    if (!selection.winner) {
      finishReport(roots, manifest, selectionInputs, "not started (no eligible winner)", "not published", deps);
      return halt("no eligible candidate — screening ended. See report for per-candidate disqualifications.");
    }
    const scope = compareOnly ? "chapter-subset" : "complete-book";
    log(`[bakeoff] screening complete (${scope}); winner ${selection.winner}. No promotion, QC, publication, current-pointer, or package write is authorized.`);
    const { jsonPath, mdPath } = finishReport(
      roots,
      manifest,
      selectionInputs,
      `not run (SCREENING_ONLY ${scope} bakeoff)`,
      "not applicable (SCREENING_ONLY)",
      deps,
    );
    markDone(roots, manifest, "report");

    return {
      status: compareOnly ? "compared" : "complete",
      bookId,
      runId,
      winner: selection.winner,
      reportJsonPath: jsonPath,
      reportMdPath: mdPath,
    };
  } finally {
    lock.release();
  }
}

function finishReport(
  roots: BakeoffRoots,
  manifest: BakeoffManifestV1,
  selectionInputs: SelectionInputs,
  qcOutcome: string,
  publishOutcome: string,
  deps: BakeoffDeps,
): { jsonPath: string; mdPath: string } {
  const inputs: ReportInputs = {
    manifest,
    roots,
    candidates: selectionInputs.map((s) => ({
      model: s.spec.model,
      label: s.label,
      generation: s.generation,
      validation: s.validation,
      review: s.review,
    })),
    selection: manifest.selection ?? null,
    qcOutcome,
    publishOutcome,
    codexVersion: manifest.preflight?.codexVersion ?? deps.codexVersion(),
  };
  return writeReports(inputs);
}

// ── Draft-grounded research (the existing research contract, seeded) ─────────

const RESEARCH_MAX_PASSES = 2;

export function buildDraftResearchTask(
  bookId: string,
  draftTextRelPath: string,
  title: string | null,
  author: string | null,
  basePrompt: string,
  pass: number,
  previousNote = "",
): string {
  return `${basePrompt}

---
AUTOPILOT RESEARCH TASK (MODEL-BAKEOFF DRAFT INTAKE)
bookId: ${bookId}
pass: ${pass}/${RESEARCH_MAX_PASSES}

You are already running from the ChapterFlow pipeline root. Do NOT cd into an old v21/v22 folder. Do NOT write chapters, QC, or publish.

DRAFT SOURCE (primary)
The operator supplied the book's manuscript draft. Its extracted text is at:
  ${draftTextRelPath}
Treat the DRAFT as the PRIMARY source text: derive the chapter index (table of contents) and every source-v2 sidecar's concepts, testable facts, named examples, and frameworks from the draft itself. Read it fully before writing any sidecar. Use live web research ONLY to verify real-world entities the draft names (people, studies, institutions) — never to replace draft material with outside material. Do not modify the draft file.
${title ? `Known title: ${title}` : "Title: infer from the draft, verify before writing the index."}${author ? `\nKnown author: ${author}` : "\nAuthor: infer from the draft if stated; leave provisional otherwise."}
${previousNote}
MANDATORY HANDOFF CONTRACT
Continue running the research/next-task loop until BOTH are true:
1. state/indexes/${bookId}.json exists and contains the full chapter list.
2. book-status reports phase write-chapter OR generating.
Stop immediately after the handoff contract is satisfied.`;
}

async function doDraftResearch(
  bookId: string,
  draftTextRelPath: string,
  title: string | null,
  author: string | null,
  deps: BakeoffDeps,
  log: (m: string) => void,
): Promise<string | null> {
  const promptPath = resolve(PIPELINE_DIR, "agent-prompts", "RESEARCH-CODEX-SESSION.md");
  const basePrompt = deps.readTask(promptPath);
  let previousNote = "";
  for (let pass = 1; pass <= RESEARCH_MAX_PASSES; pass++) {
    const task = buildDraftResearchTask(bookId, draftTextRelPath, title, author, basePrompt, pass, previousNote);
    log(`[bakeoff] research: draft-grounded research session ${pass}/${RESEARCH_MAX_PASSES}`);
    const passStartMs = Date.now();
    const r = await deps.spawn({
      task,
      role: "bakeoff-aux",
      sessionId: deps.mkSessionId(pass === 1 ? "bakeoff-research" : `bakeoff-research-retry-${pass}`),
      cwd: PIPELINE_DIR,
      sandbox: "workspace-write",
      writableRoots: [resolve(PIPELINE_DIR, ".chapterflow")],
      timeoutMs: RESEARCH_TIMEOUT_MS,
      reasoningEffort: "high",
    });
    try { deps.logSession(bookId, "bakeoff-research", r); } catch { /* best-effort */ }
    if (!r.ok) return `research session exited ${r.exitCode} before creating the chapter index:\n${(r.stderr || r.stdout).slice(0, 1600)}`;
    if (deps.expectedChapterNumbers(bookId).length > 0) {
      const violation = deps.researchFreshness(bookId, passStartMs);
      if (!violation) return null;
      previousNote = `\nPREVIOUS RESEARCH SESSION FAILED THE FRESHNESS CHECK: ${violation}\nProduce the chapter index and source-v2 sidecars FRESH from the DRAFT in THIS session — restoring archived runs is a task failure.\n`;
      log(`[bakeoff] research: pass ${pass} failed the freshness check: ${violation}`);
      continue;
    }
    previousNote = `\nPREVIOUS RESEARCH SESSION EXITED 0 WITHOUT SATISFYING THE HANDOFF CONTRACT (no chapter index).\n`;
    log(`[bakeoff] research: pass ${pass} did not create state/indexes/${bookId}.json`);
  }
  return `research did not produce the chapter index after ${RESEARCH_MAX_PASSES} draft-grounded sessions — inspect the draft extraction (${draftTextRelPath}) and re-run.`;
}

/** Bounded source-readiness loop before compile (mirrors the autopilot's
 *  prewrite gate + repair sessions, reusing its exported repair task). */
async function ensureSourceReady(bookId: string, deps: BakeoffDeps, log: (m: string) => void, heartbeat: () => boolean): Promise<string | null> {
  for (let attempt = 0; attempt <= SOURCE_REPAIR_MAX_PASSES; attempt++) {
    if (!heartbeat()) return "lost the run lock during source readiness";
    const gate = await deps.runVerb(["source-v2-gate", bookId, "--prewrite"]);
    if (gate.code === 0) return null;
    const report = (gate.stdout || gate.stderr).trim();
    if (attempt === SOURCE_REPAIR_MAX_PASSES) {
      return `source-v2 sidecars are not authoring-ready after ${SOURCE_REPAIR_MAX_PASSES} repair passes:\n${report.slice(0, 1800)}`;
    }
    log(`[bakeoff] source gate not ready (attempt ${attempt + 1}) — spawning one bounded source-repair session`);
    const r = await deps.spawn({
      task: buildSourcePrewriteRepairTask(bookId, report.slice(0, 6000), attempt + 1, SOURCE_REPAIR_MAX_PASSES),
      role: "bakeoff-aux",
      sessionId: deps.mkSessionId(`bakeoff-source-repair-${attempt + 1}`),
      cwd: PIPELINE_DIR,
      sandbox: "workspace-write",
      writableRoots: [resolve(PIPELINE_DIR, ".chapterflow")],
      timeoutMs: RESEARCH_TIMEOUT_MS,
      reasoningEffort: "high",
    });
    try { deps.logSession(bookId, "bakeoff-source-repair", r); } catch { /* best-effort */ }
  }
  return null;
}

// ── Model preflight ───────────────────────────────────────────────────────────

export async function preflightModel(model: string, deps: Pick<BakeoffDeps, "spawn" | "mkSessionId">): Promise<{ model: string; ok: boolean; detail: string }> {
  try {
    const r = await deps.spawn({
      task: "Reply with exactly: MODEL-OK",
      role: "bakeoff-aux",
      sessionId: deps.mkSessionId(`bakeoff-preflight-${modelSlug(model)}`),
      cwd: PIPELINE_DIR,
      sandbox: "read-only",
      skipGitRepoCheck: true,
      model,
      timeoutMs: PREFLIGHT_TIMEOUT_MS,
    });
    if (r.ok && /MODEL-OK/.test(r.finalMessage + r.stdout)) return { model, ok: true, detail: "responded" };
    return { model, ok: false, detail: `exit ${r.exitCode}: ${(r.stderr || r.stdout).trim().split("\n").slice(-3).join(" / ").slice(0, 300) || "no MODEL-OK response"}` };
  } catch (err) {
    return { model, ok: false, detail: (err as Error).message.slice(0, 300) };
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
