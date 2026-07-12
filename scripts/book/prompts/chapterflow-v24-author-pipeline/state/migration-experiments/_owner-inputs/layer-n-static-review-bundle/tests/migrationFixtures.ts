/**
 * IMP-12 item 6 — generic, synthetic fixture factories for every migration
 * artifact. NO deleted book prose, NO title-specific logic: each factory emits
 * schema-valid defaults with an override hook, so a test asks for exactly the
 * shape it needs and nothing more. Deterministic (no clock/random) — ids and
 * timestamps are passed in or derived from an injected sequence.
 *
 * These build the synthetic equivalents of the P0/P1 failure classes (item 7):
 * a source-bound case with one specific (no-scene), a constructed unit missing
 * framing, a causal-overreach unit, a candidate with an unexpected write, a
 * stale-base attempt, a repair finding carrying a forbidden control field.
 */

import { V21_SCHEMA_VERSION, type ChapterV21 } from "../src/types.js";
import type { SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import { SOURCE_PACKET_SCHEMA_VERSION } from "../src/artifacts/artifactTypes.js";
import type { SourceUsePlanUnitV1, SourceUsePlanV1 } from "../src/contracts/sourceUsePlan.js";
import type { AttemptIdentityV1, CandidateRecordV1, CommitManifestV1 } from "../src/contracts/candidateTransaction.js";
import type { RepairFindingV1, ChapterPatchV1 } from "../src/contracts/repairContracts.js";
import type { RouteResultV1 } from "../src/contracts/routeContracts.js";
import type { AttemptEvidenceManifestV1 } from "../src/contracts/attemptEvidence.js";

type Over<T> = Partial<T>;

// ── source packet ─────────────────────────────────────────────────────────────

export function fxFact(id: string, over: Over<SourcePacketV1["facts"][number]> = {}): SourcePacketV1["facts"][number] {
  return {
    id,
    claim: `Synthetic claim ${id}: a bounded practice improves a measured skill.`,
    mechanism: `Mechanism ${id}: tighter feedback shortens the error loop.`,
    commonError: "Unfocused volume is enough.",
    whyWrong: "Volume without feedback plateaus.",
    allowedClaimTypes: [],
    groundedNumbers: [],
    groundedEntities: [],
    groundedPlaces: [],
    verificationRefs: [],
    ...over,
  };
}

export function fxCase(id: string, over: Over<SourcePacketV1["namedCases"][number]> = {}): SourcePacketV1["namedCases"][number] {
  return {
    id,
    label: `Synthetic case ${id}`,
    summary: `A documented instance for ${id}.`,
    realWorld: true,
    hardSpecifics: ["a documented place", "a documented method"],
    allowedUses: [],
    forbiddenUses: [],
    doNotRestamp: [],
    ...over,
  };
}

export function fxPacket(over: Over<SourcePacketV1> = {}): SourcePacketV1 {
  const bookId = over.bookId ?? "zz-fixture-book";
  const n = over.chapterNumber ?? 1;
  const facts = over.facts ?? [fxFact("ch01.fact.1"), fxFact("ch01.fact.2"), fxFact("ch01.fact.3"), fxFact("ch01.fact.4"), fxFact("ch01.fact.5"), fxFact("ch01.fact.6")];
  const namedCases = over.namedCases ?? [fxCase("ch01.ex.a")];
  return {
    schemaVersion: SOURCE_PACKET_SCHEMA_VERSION,
    bookId,
    chapterId: over.chapterId ?? `${bookId}-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    chapterTitle: over.chapterTitle ?? "Synthetic Chapter",
    sourceSidecarPath: null,
    sourceHash: null,
    facts,
    namedCases,
    frameworks: [],
    allowedAnchors: over.allowedAnchors ?? [
      { id: "ch01.concept.core", kind: "concept", label: "core", text: "the central concept", supportsClaimTypes: [] },
      ...facts.map((f) => ({ id: f.id, kind: "testable_fact" as const, label: f.claim, text: f.claim, supportsClaimTypes: [] })),
      ...namedCases.map((c) => ({ id: c.id, kind: "named_example" as const, label: c.label, text: c.summary, supportsClaimTypes: [] })),
    ],
    allowedNumbers: [],
    allowedEntities: [],
    allowedPlaces: [],
    forbiddenClaims: [],
    forbiddenLeakage: [],
    sourceQuality: { status: "adequate", risks: [] },
    ...over,
  };
}

// ── source-use plan units (P0/P1 synthetic invalids, item 7/12) ──────────────

export function fxPlanUnit(over: Over<SourceUsePlanUnitV1> = {}): SourceUsePlanUnitV1 {
  return {
    unitId: "unit.fact.ch01.fact.1",
    origin: "source_bound",
    form: "explanation",
    claimStrength: "descriptive",
    anchorIds: ["ch01.fact.1"],
    allowedDetailTypes: ["concept"],
    forbiddenDetailTypes: ["invented_scene"],
    detailSufficiency: "concept_only",
    framingRequired: false,
    ...over,
  };
}

/** The forbidden-combination catalog (item 12) — each is a DISTINCT contract
 *  violation the frozen validator must reject. */
export const FORBIDDEN_PLAN_UNITS: Record<string, SourceUsePlanUnitV1> = {
  sourcedWithoutEvidence: fxPlanUnit({ unitId: "u.bad.no-anchor", origin: "source_bound", form: "case", caseId: "c1", anchorIds: [] }),
  constructedWithoutFraming: fxPlanUnit({ unitId: "u.bad.no-framing", origin: "constructed", form: "application", framingRequired: false }),
  conceptOnlyScene: fxPlanUnit({ unitId: "u.bad.concept-scene", origin: "source_bound", form: "case", caseId: "c1", anchorIds: ["a"], detailSufficiency: "concept_only" }),
  causalOverreach: fxPlanUnit({ unitId: "u.bad.causal", origin: "constructed", form: "application", framingRequired: true, claimStrength: "causal" }),
  caseWithoutBinding: fxPlanUnit({ unitId: "u.bad.no-case-id", origin: "source_bound", form: "case", anchorIds: ["a"] }),
};

export function fxPlan(over: Over<SourceUsePlanV1> = {}): SourceUsePlanV1 {
  return {
    schema: "source-use-plan-v1",
    planVersion: 1,
    bookId: over.bookId ?? "zz-fixture-book",
    chapterNumber: over.chapterNumber ?? 1,
    sourcePacketSha256: over.sourcePacketSha256 ?? "0".repeat(64),
    compilerVersion: over.compilerVersion ?? "fixture-compiler/1",
    units: over.units ?? [fxPlanUnit()],
    ...over,
  };
}

// ── chapter (minimal valid-shaped; item 6) ────────────────────────────────────

export function fxChapter(over: Over<ChapterV21> = {}): ChapterV21 {
  const bookId = "zz-fixture-book";
  const n = over.number ?? 1;
  return {
    schemaVersion: V21_SCHEMA_VERSION,
    chapterId: over.chapterId ?? `${bookId}-ch${String(n).padStart(2, "0")}`,
    number: n,
    title: over.title ?? "Synthetic Chapter",
    ...over,
  } as ChapterV21;
}

// ── attempt / candidate / commit (item 11) ────────────────────────────────────

export function fxAttemptIdentity(over: Over<AttemptIdentityV1> = {}): AttemptIdentityV1 {
  return {
    schema: "attempt-identity-v1",
    attemptId: over.attemptId ?? "zz-fixture-book-ch01-author-initial-1-fixture",
    bookId: over.bookId ?? "zz-fixture-book",
    chapterNumber: over.chapterNumber ?? 1,
    designLineage: over.designLineage ?? "",
    attemptKind: over.attemptKind ?? "author-initial",
    attemptSequence: over.attemptSequence ?? 1,
    executionProfileHash: over.executionProfileHash ?? "e".repeat(64),
    promptSha256: over.promptSha256 ?? "p".repeat(64),
    inputHashes: over.inputHashes ?? {},
    outputSchemaVersion: over.outputSchemaVersion ?? V21_SCHEMA_VERSION,
    expectedBaseSha256: over.expectedBaseSha256 ?? null,
    expectedBaseGeneration: over.expectedBaseGeneration ?? 0,
    ...over,
  };
}

export function fxCandidateRecord(over: Over<CandidateRecordV1> = {}): CandidateRecordV1 {
  return {
    schema: "candidate-record-v1",
    attempt: over.attempt ?? fxAttemptIdentity(),
    candidateSha256: over.candidateSha256 ?? "c".repeat(64),
    candidatePath: over.candidatePath ?? "workspace/zz-fixture-book-ch01.v21-native.chapter.json",
    producedAtIso: over.producedAtIso ?? "2026-07-10T00:00:00.000Z",
    validations: over.validations ?? [{ check: "schema", ok: true }],
    outcome: over.outcome ?? "committed",
    ...over,
  };
}

export function fxCommitManifest(over: Over<CommitManifestV1> = {}): CommitManifestV1 {
  return {
    schema: "commit-manifest-v1",
    attemptId: over.attemptId ?? "zz-fixture-book-ch01-author-initial-1-fixture",
    bookId: over.bookId ?? "zz-fixture-book",
    chapterNumber: over.chapterNumber ?? 1,
    previousSha256: over.previousSha256 ?? null,
    committedSha256: over.committedSha256 ?? "c".repeat(64),
    committedGeneration: over.committedGeneration ?? 1,
    invalidated: over.invalidated ?? [],
    committedAtIso: over.committedAtIso ?? "2026-07-10T00:00:00.000Z",
    ...over,
  };
}

// ── repair (item 11) ──────────────────────────────────────────────────────────

export function fxRepairFinding(over: Over<RepairFindingV1> = {}): RepairFindingV1 {
  return {
    schema: "repair-finding-v1",
    findingId: over.findingId ?? "f1",
    category: over.category ?? "quiz-tell",
    severity: over.severity ?? "must_fix",
    unitIds: over.unitIds ?? ["unit.fact.ch01.fact.1"],
    evidenceQuotes: over.evidenceQuotes ?? ["the key is the longest choice"],
    violatedInvariantIds: over.violatedInvariantIds ?? ["QUIZ-TELL"],
    permittedRepairScope: over.permittedRepairScope ?? ["quiz.questions[1]"],
    prohibitedChanges: over.prohibitedChanges ?? ["examples"],
    sourcePlanDependencies: over.sourcePlanDependencies ?? [],
    recommendedRoute: over.recommendedRoute ?? "surgical",
    ...over,
  };
}

export function fxChapterPatch(over: Over<ChapterPatchV1> = {}): ChapterPatchV1 {
  return {
    schema: "chapter-patch-v1",
    chapterId: over.chapterId ?? "zz-fixture-book-ch01",
    expectedBaseHash: over.expectedBaseHash ?? "b".repeat(64),
    sourcePlanHash: over.sourcePlanHash ?? "s".repeat(64),
    findingIds: over.findingIds ?? ["f1"],
    operations: over.operations ?? [{ path: "quiz.questions[1].prompt", expectedOldValueHash: "o".repeat(64), replacement: "New prompt?", dependencyUnitIds: [] }],
    ...over,
  };
}

// ── route result / provider outcomes (item 6) ─────────────────────────────────

export function fxRouteResult(over: Over<RouteResultV1> = {}): RouteResultV1 {
  return {
    schema: "route-result-v1",
    taskClass: over.taskClass ?? "author-first-write",
    profileName: over.profileName ?? "baseline-55",
    routePolicyVersion: over.routePolicyVersion ?? "route-policy-v1.0",
    requestedModel: over.requestedModel ?? "gpt-5.5",
    requestedEffort: over.requestedEffort ?? "xhigh",
    executionProfileHash: over.executionProfileHash ?? "e".repeat(64),
    cliVersion: over.cliVersion ?? "codex-cli 0.144.1",
    outcome: over.outcome ?? "content_completed",
    driftFingerprint: over.driftFingerprint ?? "d".repeat(64),
    ...over,
  };
}

// ── evidence manifest (item 6/11) ─────────────────────────────────────────────

export function fxEvidenceManifest(over: Over<AttemptEvidenceManifestV1> = {}): AttemptEvidenceManifestV1 {
  return {
    schema: "attempt-evidence-manifest-v1",
    attemptId: over.attemptId ?? "zz-fixture-book-ch01-author-initial-1-fixture",
    taskClass: over.taskClass ?? "author-first-write",
    bookId: over.bookId ?? "zz-fixture-book",
    chapterNumber: over.chapterNumber ?? 1,
    inputHashes: over.inputHashes ?? { sourcePacket: "a".repeat(64) },
    executionContextManifestPath: over.executionContextManifestPath ?? "exec-logs/ctx.manifest.json",
    stateTransitions: over.stateTransitions ?? [{ state: "allocated", atIso: "2026-07-10T00:00:00.000Z" }],
    retentionClass: over.retentionClass ?? "migration-experiment",
    objects: over.objects ?? [{ kind: "task-card", sha256: "a".repeat(64), path: "card.txt", bytes: 100 }],
    ...over,
  };
}
