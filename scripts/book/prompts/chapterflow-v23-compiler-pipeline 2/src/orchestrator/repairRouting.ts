/**
 * repairRouting (P10, F3) — class-routed QC repair.
 *
 * The QC repair path used to do ONE thing to every finding: hand a repair agent the assembled
 * ChapterV21 JSON and let it freehand-edit. Two failure modes followed: (a) the blueprints +
 * section artifacts went stale under the edited chapter (provenance drift — a re-assembly would
 * resurrect the very defect the edit removed); (b) the GENERATIVE cause of a templating finding —
 * a shared DEALT slot (a scene frame, a stamped venue, a reused name) — survived, because it lives
 * in the deterministic blueprint, not in the prose.
 *
 * This module routes each finding to the repair LEVER that addresses its cause (see
 * src/qc/findingRouting.ts + config/finding-routing.json):
 *   - `redeal:*`        → bump the owning blueprint slot SALT, recompile the (pure) blueprint,
 *                         re-deal the section task cards, delete + REGENERATE only the affected
 *                         section artifact, re-assemble, re-stamp provenance, rebuild evidence.
 *                         (redealAndRegenerate)
 *   - `surgical`        → left for the existing per-chapter repair session; the caller then syncs
 *                         the edit back into the owning section artifacts (syncChapterEditsToArtifacts)
 *                         so a re-assembly reproduces the edited chapter (round-trip proof).
 *   - `escalate:research` → a templated-SOURCE finding no chapter edit can fix; HALT for re-research
 *                         (mirrors the existing SP14 templated-source halt).
 *
 * Blueprints are DETERMINISTIC, so "re-deal" is expressed as a persisted salt input, never an
 * in-place blueprint mutation: bumping state/book-design/<bookId>.slot-salts.json is the whole
 * re-deal, and compileChapterBlueprint mixes it into exactly one deal.
 */

import { appendFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { dirname } from "path";

import { chapterContentHash } from "../critics/qcAttestation.js";
import { effectiveLedgerResilient } from "../qc/orchestrator/ledger.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { sweepFamilyForRepairClass } from "../qc/sweep.js";
import { assembleSections } from "../sections/assembleSections.js";
import { REDEAL_LEVER_TARGETS, isRedealLever, routeFinding, type RedealLever, type RepairLever } from "../qc/findingRouting.js";
import {
  readJsonFile,
  repairRoutingLedgerPath,
  sectionPath,
  slotSaltsPath,
  writeJsonFile,
  type CompilerStoreRoots,
} from "../artifacts/artifactStore.js";
import type { ActionPackV1, ExamplePackV1, LearningPackV1, SectionKind, SummaryPackV1 } from "../artifacts/artifactTypes.js";
import { readSlotSalts, type ChapterSlotSalts } from "../compiler/chapterBlueprint.js";
import { regenerateSectionArtifact, stampCompilerAssemblyProvenance } from "./compilerRun.js";
import { normSlug } from "../lib/chapterPaths.js";
import type { ChapterV21 } from "../types.js";
import type { AutopilotDeps, AutopilotOutcome } from "./autopilot.js";

// ── Env / mode ───────────────────────────────────────────────────────────────────
export const REPAIR_ROUTING_ENV = "CHAPTERFLOW_REPAIR_ROUTING";
export type RepairRoutingMode = "enforce" | "surgical-only";

/** `enforce` (default) routes redeal + escalate levers; `surgical-only` is the safe fallback —
 *  today's behavior (every finding stays a surgical chapter edit) PLUS the artifact-sync round
 *  trip, with NO re-deals and NO source escalation. */
export function repairRoutingMode(env: NodeJS.ProcessEnv = process.env): RepairRoutingMode {
  return env[REPAIR_ROUTING_ENV] === "surgical-only" ? "surgical-only" : "enforce";
}

// The redeal cap — at most this many DISTINCT re-deal operations per chapter per QC round. Beyond
// it, further redeal-classed findings fall back to a surgical edit (and are flagged in the ledger),
// so a pathological chapter can never spin the compiler regenerating the same slots indefinitely.
export const MAX_REDEALS_PER_CHAPTER = 2;

// ── Finding shape the router consumes ─────────────────────────────────────────────
export type RoutableRepairFinding = {
  findingId: string;
  family?: string | null;
  repairClass?: string | null;
  unitId?: string | null;
  chapterNumber: number;
};

// ── Ledger ─────────────────────────────────────────────────────────────────────
export type RepairRoutingOutcomeTag = "redealed" | "surgical" | "cap-fallback-surgical" | "escalate" | "error";
export type RepairRoutingLedgerEntry = {
  at: string;
  bookId: string;
  roundId: string;
  findingId: string;
  family: string | null;
  repairClass: string | null;
  unitId: string | null;
  chapterNumber: number;
  lever: RepairLever;
  saltField: keyof ChapterSlotSalts | null;
  saltBumpedTo: number | null;
  outcome: RepairRoutingOutcomeTag;
  note?: string;
};

function appendRoutingLedger(entry: RepairRoutingLedgerEntry, roots: CompilerStoreRoots): void {
  const path = repairRoutingLedgerPath(entry.bookId, roots);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(entry) + "\n", "utf8");
}

// ── Salt bump ─────────────────────────────────────────────────────────────────
/** Increment ONE chapter's named slot salt in the repair-owned sidecar, returning the new value.
 *  This IS the whole re-deal input — compileChapterBlueprint reads the file and mixes the bumped
 *  salt into exactly the matching deal. */
export function bumpSlotSalt(bookId: string, chapterNumber: number, field: keyof ChapterSlotSalts, roots: CompilerStoreRoots = {}): number {
  const salts = readSlotSalts(bookId, roots);
  const key = String(chapterNumber);
  const current = salts.chapters[key] ?? {};
  const prev = Number(current[field]);
  const next = (Number.isInteger(prev) && prev > 0 ? prev : 0) + 1;
  salts.chapters[key] = { ...current, [field]: next };
  writeJsonFile(slotSaltsPath(bookId, roots), salts);
  return next;
}

// ── Halt helper ─────────────────────────────────────────────────────────────────
function halt(bookId: string, reason: string, category: "infra" | "content" = "content"): AutopilotOutcome {
  return { status: "halt", bookId, phase: "qc", category, reason };
}

function verbOut(r: { stdout?: string; stderr?: string }): string {
  return (r.stdout || r.stderr || "").trim();
}

type RegenDeps = Parameters<typeof regenerateSectionArtifact>[3];
export type RedealDeps = RegenDeps & Pick<AutopilotDeps, "runVerb" | "mkSessionId" | "log">;

// ── The redeal lever ─────────────────────────────────────────────────────────────
/**
 * Re-deal ONE chapter's slot family, then regenerate everything downstream of the blueprint so the
 * repaired book's ARTIFACTS still produce its chapter (no provenance drift). Steps:
 *   1. bump the named salt (the persisted re-deal input)
 *   2. recompile blueprints book-wide — pure, so only the bumped chapter's blueprint changes
 *   3. re-deal the section task cards (so the regenerated writer sees the new slots)
 *   4. delete ONLY the affected section artifact, then regenerate + validate it (chapter/kind-scoped)
 *   5. re-assemble → ChapterV21, re-stamp assembly provenance, rebuild the evidence map
 * Returns null on success, or a halt outcome at the first failing step.
 */
export async function redealAndRegenerate(
  bookId: string,
  chapterNumber: number,
  lever: RepairLever,
  deps: RedealDeps,
  opts: { roots?: CompilerStoreRoots; heartbeat?: () => boolean; ownerEnv?: Record<string, string> } = {},
): Promise<{ halt: AutopilotOutcome | null; saltField: keyof ChapterSlotSalts | null; saltValue: number | null; kind: SectionKind | null }> {
  if (!isRedealLever(lever)) return { halt: null, saltField: null, saltValue: null, kind: null };
  const normalized = normSlug(bookId);
  const roots = opts.roots ?? {};
  const ownerEnv = opts.ownerEnv ?? {};
  const pad = String(chapterNumber).padStart(2, "0");
  const { salt: saltField, kind } = REDEAL_LEVER_TARGETS[lever];
  const saltValue = bumpSlotSalt(normalized, chapterNumber, saltField, roots);
  deps.log(`[autopilot] redeal ${lever} ch${pad}: bumped ${saltField} salt → ${saltValue}; recompiling blueprint + regenerating ${kind}`);

  for (const args of [["compile-blueprints", normalized], ["deal-section-tasks", normalized]]) {
    const r = await deps.runVerb(args, ownerEnv);
    if (r.code !== 0) return { halt: halt(bookId, `redeal ${lever} ch${pad}: \`${args[0]}\` failed (exit ${r.code}).\n${verbOut(r).slice(0, 1200)}`, r.code >= 2 ? "infra" : "content"), saltField, saltValue, kind };
  }

  // Delete ONLY the affected section artifact so regenerateSectionArtifact sees it as missing and
  // re-authors it against the fresh blueprint slots. Sibling artifacts (and every other chapter)
  // are untouched.
  const artifactPath = sectionPath(normalized, chapterNumber, kind, roots);
  if (existsSync(artifactPath)) rmSync(artifactPath, { force: true });

  const regenHalt = await regenerateSectionArtifact(normalized, chapterNumber, kind, deps, { heartbeat: opts.heartbeat, ownerEnv, roots });
  if (regenHalt) return { halt: regenHalt, saltField, saltValue, kind };

  const asm = await deps.runVerb(["assemble-sections", normalized], ownerEnv);
  if (asm.code !== 0) return { halt: halt(bookId, `redeal ${lever} ch${pad}: assemble-sections failed (exit ${asm.code}).\n${verbOut(asm).slice(0, 1200)}`, asm.code >= 2 ? "infra" : "content"), saltField, saltValue, kind };

  try { stampCompilerAssemblyProvenance(normalized, deps); }
  catch (err) { deps.log(`[autopilot] redeal ${lever} ch${pad}: assembly-provenance warning: ${(err as Error).message}`); }

  const ev = await deps.runVerb(["build-evidence-maps", normalized], ownerEnv);
  if (ev.code !== 0) return { halt: halt(bookId, `redeal ${lever} ch${pad}: build-evidence-maps failed (exit ${ev.code}).\n${verbOut(ev).slice(0, 1200)}`, "infra"), saltField, saltValue, kind };

  return { halt: null, saltField, saltValue, kind };
}

// ── The router/executor ───────────────────────────────────────────────────────────
export type RepairRoutingResult = {
  mode: RepairRoutingMode;
  /** Chapters whose slot family was re-dealt + regenerated this round. */
  redealedChapters: number[];
  /** Findings the caller must still repair with a surgical chapter edit (routed surgical, or a
   *  redeal that hit the per-chapter cap and fell back). */
  surgicalFindings: RoutableRepairFinding[];
  /** A halt to return instead of repairing (a templated-source escalation, or a redeal failure). */
  halt: AutopilotOutcome | null;
};

/**
 * Partition a round's findings by route, then execute the re-deals (redeal levers change content
 * WHOLESALE, so they run first), leaving the remainder for the caller's existing surgical fan-out.
 *   - `escalate:research`  → HALT immediately (a templated source dooms the whole book; do not burn
 *                            re-deals on it). Only in `enforce` mode.
 *   - `redeal:*`           → dedup to one op per (chapter, slot-family); apply MAX_REDEALS_PER_CHAPTER;
 *                            over-cap ops fall back to surgical (flagged in the ledger).
 *   - `surgical` / everything in `surgical-only` mode → returned in `surgicalFindings`.
 * Every decision is appended to state/books/<bookId>.repair-routing.jsonl.
 */
export async function routeAndExecuteRepairs(
  bookId: string,
  roundId: string,
  findings: RoutableRepairFinding[],
  deps: RedealDeps,
  opts: { mode?: RepairRoutingMode; roots?: CompilerStoreRoots; heartbeat?: () => boolean; ownerEnv?: Record<string, string>; now?: () => string } = {},
): Promise<RepairRoutingResult> {
  const mode = opts.mode ?? repairRoutingMode();
  const roots = opts.roots ?? {};
  const now = opts.now ?? (() => new Date().toISOString());
  const normalized = normSlug(bookId);
  const surgicalFindings: RoutableRepairFinding[] = [];
  const redealedChapters = new Set<number>();

  const ledger = (f: RoutableRepairFinding, lever: RepairLever, outcome: RepairRoutingOutcomeTag, saltField: keyof ChapterSlotSalts | null, saltBumpedTo: number | null, note?: string) =>
    appendRoutingLedger({
      at: now(), bookId: normalized, roundId, findingId: f.findingId,
      family: f.family ?? null, repairClass: f.repairClass ?? null, unitId: f.unitId ?? null,
      chapterNumber: f.chapterNumber, lever, saltField, saltBumpedTo, outcome, note,
    }, roots);

  // surgical-only: today's behavior — everything is a surgical edit. No redeal, no escalation.
  if (mode === "surgical-only") {
    for (const f of findings) { ledger(f, "surgical", "surgical", null, null, "surgical-only mode"); surgicalFindings.push(f); }
    return { mode, redealedChapters: [], surgicalFindings, halt: null };
  }

  // Route every finding once.
  const routed = findings.map((f) => ({ f, lever: routeFinding({ family: f.family, repairClass: f.repairClass, unitId: f.unitId }) }));

  // (1) Escalation short-circuits: a templated-source finding cannot be fixed by editing chapters.
  const escalations = routed.filter((r) => r.lever === "escalate:research");
  if (escalations.length) {
    for (const { f, lever } of escalations) ledger(f, lever, "escalate", null, null, "templated source — re-research required");
    const chapters = [...new Set(escalations.map((r) => r.f.chapterNumber))].sort((a, b) => a - b).map((n) => `ch${String(n).padStart(2, "0")}`);
    return {
      mode, redealedChapters: [], surgicalFindings: [],
      halt: halt(bookId, `QC surfaced a TEMPLATED-SOURCE finding on ${chapters.join(", ")} (${escalations.length} finding(s)) — the source packets deal book-wide boilerplate, so no chapter edit converges. RE-RESEARCH the book for chapter-distinct facts, then re-run (mirrors the SP14 templated-source halt). Inspect: npx tsx src/cli.ts qc-diagnose ${bookId} --round ${roundId}`, "content"),
    };
  }

  // (2) Re-deals — dedup to one operation per (chapter, slot-family), apply the per-chapter cap.
  const redealOps = new Map<string, { chapterNumber: number; lever: RedealLever; findings: RoutableRepairFinding[] }>();
  for (const { f, lever } of routed) {
    if (!isRedealLever(lever)) continue;
    const { salt } = REDEAL_LEVER_TARGETS[lever];
    const key = `${f.chapterNumber}:${salt}`; // dedup by slot FAMILY (venue+example share example-pack but are distinct salts)
    if (!redealOps.has(key)) redealOps.set(key, { chapterNumber: f.chapterNumber, lever, findings: [] });
    redealOps.get(key)!.findings.push(f);
  }
  const redealsByChapter = new Map<number, number>();
  // Deterministic order: chapter asc, then lever name — so the cap picks the same ops run-to-run.
  for (const op of [...redealOps.values()].sort((a, b) => a.chapterNumber - b.chapterNumber || a.lever.localeCompare(b.lever))) {
    const used = redealsByChapter.get(op.chapterNumber) ?? 0;
    if (used >= MAX_REDEALS_PER_CHAPTER) {
      for (const f of op.findings) { ledger(f, op.lever, "cap-fallback-surgical", REDEAL_LEVER_TARGETS[op.lever].salt, null, `redeal cap ${MAX_REDEALS_PER_CHAPTER}/chapter exceeded — falling back to surgical`); surgicalFindings.push(f); }
      continue;
    }
    const res = await redealAndRegenerate(bookId, op.chapterNumber, op.lever, deps, { roots, heartbeat: opts.heartbeat, ownerEnv: opts.ownerEnv });
    if (res.halt) {
      const reason = res.halt.status === "halt" ? res.halt.reason : "";
      for (const f of op.findings) ledger(f, op.lever, "error", res.saltField, res.saltValue, reason.slice(0, 200));
      return { mode, redealedChapters: [...redealedChapters].sort((a, b) => a - b), surgicalFindings, halt: res.halt };
    }
    redealsByChapter.set(op.chapterNumber, used + 1);
    redealedChapters.add(op.chapterNumber);
    for (const f of op.findings) ledger(f, op.lever, "redealed", res.saltField, res.saltValue);
  }

  // (3) Everything routed surgical.
  for (const { f, lever } of routed) {
    if (lever === "surgical") { ledger(f, lever, "surgical", null, null); surgicalFindings.push(f); }
  }

  return { mode, redealedChapters: [...redealedChapters].sort((a, b) => a - b), surgicalFindings, halt: null };
}

// ── Surgical-edit → artifact sync (round-trip proof) ──────────────────────────────
/** Which section artifact owns each editable ChapterV21 field — the REVERSE of assembleSections.ts's
 *  forward mapping. breakdown/hook/keyTakeaway live in the summary pack; examples in the example
 *  pack; quiz/cards in the learning pack; implementationPlan + tryThisNow in the action pack. */
export type ArtifactSyncResult = { ok: true } | { ok: false; halt: AutopilotOutcome };

/**
 * After a SURGICAL chapter edit, write the edited reader-facing FIELDS back into their owning
 * section artifacts, so a re-assembly reproduces the edited chapter (no artifact drift). Then
 * re-assert the round trip: re-run assemble-sections and require the resulting chapter's content
 * hash to equal the edited chapter's — on mismatch, HALT (never publish drifted artifacts).
 *
 * `assemble` is injected (the caller passes the real assembleSections, or a test passes a stub) so
 * this stays unit-testable without wiring the whole verb layer.
 */
export function syncChapterEditsToArtifacts(
  bookId: string,
  chapterNumber: number,
  editedChapter: ChapterV21,
  roots: CompilerStoreRoots,
  assemble: (bookId: string, roots: CompilerStoreRoots) => { findings: string[] },
  reloadChapter: (bookId: string, chapterNumber: number) => ChapterV21 | null,
): ArtifactSyncResult {
  const normalized = normSlug(bookId);
  const editedHash = chapterContentHash(editedChapter);

  // Read the four section artifacts, overwrite their content fields from the edited chapter, and
  // write them back. Anchor ids / ids are preserved (they are excluded from the content hash and
  // owned by the writer/blueprint — a surgical edit must not touch grounding).
  try {
    const summary = readJsonFile<SummaryPackV1>(sectionPath(normalized, chapterNumber, "summary-pack", roots));
    summary.hook = { ...summary.hook, hook: editedChapter.hook, counterintuition: editedChapter.counterintuition ?? summary.hook.counterintuition };
    summary.breakdown = { ...summary.breakdown, fastRead: editedChapter.breakdown.fastRead, deepRead: editedChapter.breakdown.deepRead, fullRead: editedChapter.breakdown.fullRead };
    summary.keyTakeaway = editedChapter.keyTakeaway;
    if (editedChapter.tryThisNow !== undefined) summary.tryThisNow = editedChapter.tryThisNow;
    writeJsonFile(sectionPath(normalized, chapterNumber, "summary-pack", roots), summary);

    const examples = readJsonFile<ExamplePackV1>(sectionPath(normalized, chapterNumber, "example-pack", roots));
    examples.examples = examples.examples.map((ex, i) => {
      const src = editedChapter.examples[i];
      return src ? { ...ex, title: src.title, scenario: src.scenario, whatToDo: src.whatToDo, whyItMatters: src.whyItMatters } : ex;
    });
    writeJsonFile(sectionPath(normalized, chapterNumber, "example-pack", roots), examples);

    const learning = readJsonFile<LearningPackV1>(sectionPath(normalized, chapterNumber, "learning-pack", roots));
    learning.quiz.questions = learning.quiz.questions.map((q, i) => {
      const src = editedChapter.quiz.questions[i];
      return src ? { ...q, prompt: src.prompt, choices: src.choices, correctIndex: src.correctIndex, explanation: src.explanation, bloomsLevel: src.bloomsLevel, depthLevel: src.depthLevel } : q;
    });
    learning.cards.cards = learning.cards.cards.map((c, i) => {
      const src = editedChapter.reviewCards[i];
      return src ? { ...c, front: src.front, back: src.back, difficulty: src.difficulty } : c;
    });
    writeJsonFile(sectionPath(normalized, chapterNumber, "learning-pack", roots), learning);

    const action = readJsonFile<ActionPackV1>(sectionPath(normalized, chapterNumber, "action-pack", roots));
    if (editedChapter.tryThisNow !== undefined) action.tryThisNow = editedChapter.tryThisNow;
    action.implementationPlan = { ...action.implementationPlan, ...editedChapter.implementationPlan };
    writeJsonFile(sectionPath(normalized, chapterNumber, "action-pack", roots), action);
  } catch (err) {
    return { ok: false, halt: halt(bookId, `artifact sync ch${chapterNumber}: could not read/write a section artifact (${(err as Error).message}) — refusing to publish possibly-drifted artifacts.`, "infra") };
  }

  // Round-trip proof: re-assemble from the synced artifacts and require byte-equal content.
  const asm = assemble(normalized, roots);
  if (asm.findings.some((f) => f.startsWith(`ch${String(chapterNumber).padStart(2, "0")}:`))) {
    return { ok: false, halt: halt(bookId, `artifact sync ch${chapterNumber}: re-assembly reported findings after sync — ${asm.findings.filter((f) => f.startsWith(`ch${String(chapterNumber).padStart(2, "0")}:`)).join("; ").slice(0, 600)}`, "content") };
  }
  const reassembled = reloadChapter(normalized, chapterNumber);
  if (!reassembled) return { ok: false, halt: halt(bookId, `artifact sync ch${chapterNumber}: could not reload the re-assembled chapter to verify the round trip.`, "infra") };
  const reHash = chapterContentHash(reassembled);
  if (reHash !== editedHash) {
    return { ok: false, halt: halt(bookId, `artifact sync ch${chapterNumber}: round-trip MISMATCH — the section artifacts do not reproduce the edited chapter (edited ${editedHash} vs re-assembled ${reHash}). A surgical edit touched a field the artifacts do not own; halting rather than publish drifted artifacts.`, "content") };
  }
  return { ok: true };
}

// ── Autopilot wiring (thin entry points doQcWithRepair calls) ─────────────────────
//
// Both entry points are FAIL-SAFE and env-GATED: in `surgical-only` they no-op (redeals) / still
// sync; on any unexpected error while GATHERING state they log + fall through to today's pure
// surgical path, so a book with no ledger/artifacts on disk (e.g. a stubbed unit test) is never
// broken by the routing layer. Only a deliberate escalation or a genuine round-trip mismatch halts.

/** Build the round's routable findings from the effective ledger, recovering the sweep FAMILY from
 *  each finding's repairClass verb (the ledger stores "vary_scene_engine", not "scene_skeleton").
 *  One entry per (finding, affected chapter). Fail-safe → [] so a missing/corrupt ledger never
 *  throws into the QC loop. */
export function gatherRoutableFindings(bookId: string, roundId: string): RoutableRepairFinding[] {
  let findings;
  try { findings = effectiveLedgerResilient(bookId, roundId); }
  catch { return []; }
  const active = findings.filter((f) => f.status === "open" || f.status === "still_open" || f.status === "needs_qc_rerun");
  const out: RoutableRepairFinding[] = [];
  for (const f of active) {
    const chapters = f.chapterNumber !== undefined ? [f.chapterNumber] : (f.chapters ?? []);
    const family = sweepFamilyForRepairClass(f.repairClass) ?? undefined;
    for (const ch of chapters) {
      if (Number.isInteger(ch) && ch > 0) out.push({ findingId: f.findingId, family, repairClass: f.repairClass, unitId: f.unitId, chapterNumber: ch });
    }
  }
  return out;
}

/** Run the class-routed re-deal pass for a QC repair round, BEFORE the caller's surgical fan-out.
 *  Returns a halt to propagate (templated-source escalation, or a redeal failure) or null. */
export async function runRoutedRedeals(bookId: string, roundId: string, deps: RedealDeps, opts: { heartbeat?: () => boolean } = {}): Promise<AutopilotOutcome | null> {
  const mode = repairRoutingMode();
  const findings = gatherRoutableFindings(bookId, roundId);
  if (!findings.length) return null;
  const result = await routeAndExecuteRepairs(bookId, roundId, findings, deps, { mode, heartbeat: opts.heartbeat });
  if (result.halt) return result.halt;
  if (result.redealedChapters.length) {
    deps.log(`[autopilot] repair-routing (${mode}): re-dealt ${result.redealedChapters.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")} at their dealt-slot source; ${result.surgicalFindings.length} finding(s) remain for surgical repair`);
  }
  return null;
}

/** After the surgical fan-out, sync each edited chapter's fields back into its section artifacts and
 *  prove the round trip (assemble → same content hash). Enforce-only; skips chapters with no section
 *  artifacts on disk (nothing to sync). Returns a halt on a genuine round-trip MISMATCH. */
export function runArtifactSync(bookId: string, chapterNumbers: number[], deps: Pick<AutopilotDeps, "log">): AutopilotOutcome | null {
  if (repairRoutingMode() !== "enforce") return null;
  const normalized = normSlug(bookId);
  let chapters: ChapterV21[];
  try { chapters = loadBookChapters(normalized); }
  catch { return null; }
  const byNumber = new Map(chapters.map((c) => [c.number, c] as const));
  for (const n of [...new Set(chapterNumbers)].sort((a, b) => a - b)) {
    if (!existsSync(sectionPath(normalized, n, "summary-pack"))) continue; // not a compiler-path book — nothing to sync
    const chapter = byNumber.get(n);
    if (!chapter) continue;
    const res = syncChapterEditsToArtifacts(
      normalized, n, chapter, {},
      (b, r) => assembleSections(b, r),
      (b, num) => loadBookChapters(b).find((c) => c.number === num) ?? null,
    );
    if (!res.ok) return res.halt;
    deps.log(`[autopilot] artifact sync ch${String(n).padStart(2, "0")}: surgical edit written back into section artifacts; re-assembly round-trip verified`);
  }
  return null;
}
