/**
 * IMP-11 — experiment spec validation + the seal (prompt inst. 2, 5-8, 17).
 *
 * `sealExperiment` freezes EVERYTHING before any live call could happen:
 * the spec bytes (copied into the run root — later edits to the operator's
 * file are irrelevant), the per-book shared inputs (hashed on canonical disk;
 * the experiment NEVER compiles — missing inputs halt with instructions), the
 * per-stack card templates (current builders re-rendered with the placeholder;
 * snapshots verified against their declared pin), the thresholds file (copied +
 * hashed), the deterministic schedule, instrument/policy versions, the judge
 * panel, and the price snapshot.
 *
 * `verifySealIntact` re-derives every hash; ANY drift is returned as findings
 * and the conductor halts rather than silently mixing conditions (§16 stop
 * criteria). Tuning a sealed experiment is therefore structurally impossible —
 * a changed spec/thresholds/stack no longer matches its seal, and a NEW
 * experiment id is the only way forward (inst. 6, 17).
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import { ensureTrailingNewline } from "../../lib/atomicWrite.js";
import { voiceCard } from "../../lib/voiceCard.js";
import { buildAuthorCard, resolveAuthorIo } from "../../orchestrator/authorRun.js";
import { ROUTE_POLICY_VERSION } from "../../orchestrator/modelPolicy.js";
import { AUTHOR_CHAPTER_BAR, READER_RUBRIC_VERSION, REVIEW_DOC_HASH_VERSION } from "../../review/readerReview.js";
import { CARD_OUTPUT_PLACEHOLDER, collectSharedInputPaths } from "../freeze.js";
import { PIPELINE_DIR, combineHashes, pipelineRel, sha256Hex } from "../paths.js";
import type { FrozenFileV1 } from "../types.js";
import {
  CHAPTER_STRATA,
  HISTORICAL_BASELINE_55,
  MIGRATION_SEALED_SCHEMA,
  MIGRATION_SPEC_SCHEMA,
  REPAIR_PROJECTION_VERSION,
  type ExperimentSpecV1,
  type SealedManifestV1,
} from "./experimentTypes.js";
import { MigrationGuardError, rootedWrite, type MigrationRoots } from "./guards.js";
import { buildSampleSchedule } from "./schedule.js";
import { validateThresholds } from "./thresholds.js";

export class SealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SealError";
  }
}

// The confirmatory four-way design. The `55-H`/`55-XH` cells are the HISTORICAL
// gpt-5.5 comparison arm (HISTORICAL_BASELINE_55) — a frozen data identity, NOT
// the live baseline. They MUST stay distinct from the `56S-*` SOL cells; aliasing
// them to BASELINE_MODEL silently collapsed the design (55-H == 56S-H) once the
// live baseline flipped to gpt-5.6-sol (WP-302). Frozen per WP-501 Part 3.
const CONFIRMATORY_CELLS: Array<{ cellId: string; model: string; effort: string }> = [
  { cellId: "55-H", model: HISTORICAL_BASELINE_55, effort: "high" },
  { cellId: "55-XH", model: HISTORICAL_BASELINE_55, effort: "xhigh" },
  { cellId: "56S-H", model: "gpt-5.6-sol", effort: "high" },
  { cellId: "56S-XH", model: "gpt-5.6-sol", effort: "xhigh" },
];

/** Structural + design-rule validation. Returns problems ([] = valid). */
export function validateExperimentSpec(spec: ExperimentSpecV1): string[] {
  const problems: string[] = [];
  if (spec.schema !== MIGRATION_SPEC_SCHEMA) problems.push(`schema must be ${MIGRATION_SPEC_SCHEMA}`);
  if (!spec.experimentId || !/^[a-z0-9][a-z0-9-]{2,63}$/.test(spec.experimentId)) {
    problems.push("experimentId must be a stable slug (lowercase, 3-64 chars)");
  }
  if (spec.stage !== "diagnostic" && spec.stage !== "confirmatory") problems.push("stage must be diagnostic|confirmatory");
  if (!spec.randomizationSeed) problems.push("randomizationSeed is required (frozen randomization)");

  const cellIds = new Set<string>();
  const stackIds = new Set(spec.stacks.map((s) => s.id));
  for (const c of spec.cells ?? []) {
    if (cellIds.has(c.cellId)) problems.push(`duplicate cellId ${c.cellId}`);
    cellIds.add(c.cellId);
    if (!stackIds.has(c.stackId)) problems.push(`cell ${c.cellId} references unknown stack ${c.stackId}`);
  }
  if ((spec.cells ?? []).length === 0) problems.push("cells must be non-empty");
  if ((spec.stacks ?? []).length === 0) problems.push("stacks must be non-empty");

  if (spec.stage === "confirmatory") {
    // Inst. 7: byte-identical inputs, only model/effort differ — ONE stack.
    const stacksUsed = new Set(spec.cells.map((c) => c.stackId));
    if (stacksUsed.size !== 1) problems.push("confirmatory cells must share ONE final stack (only model/effort may differ)");
    for (const want of CONFIRMATORY_CELLS) {
      const got = spec.cells.find((c) => c.cellId === want.cellId);
      if (!got) problems.push(`confirmatory design requires cell ${want.cellId}`);
      else if (got.model !== want.model || got.effort !== want.effort) {
        problems.push(`cell ${want.cellId} must be ${want.model} @ ${want.effort} (got ${got.model} @ ${got.effort})`);
      }
    }
    if (spec.cells.length !== CONFIRMATORY_CELLS.length) problems.push("confirmatory design is exactly the four model/effort cells");
    if ((spec.books ?? []).length < 2) problems.push("confirmatory design requires at least two books (inst. 8)");
  } else {
    // Inst. 5: the minimum diagnostic factorial — 55-XH on both stacks, SOL
    // high/xhigh on both stacks (6 cells; 55-H cells optional). The 55-XH arm is
    // the HISTORICAL gpt-5.5 baseline (HISTORICAL_BASELINE_55), frozen so it stays
    // distinct from the SOL arms after the live baseline flip (WP-501 Part 3).
    if (stackIds.size < 2) problems.push("diagnostic design compares at least two stacks (legacy vs SOL-native)");
    const need: Array<{ model: string; effort: string }> = [
      { model: HISTORICAL_BASELINE_55, effort: "xhigh" },
      { model: "gpt-5.6-sol", effort: "high" },
      { model: "gpt-5.6-sol", effort: "xhigh" },
    ];
    for (const n of need) {
      for (const stackId of stackIds) {
        if (!spec.cells.some((c) => c.model === n.model && c.effort === n.effort && c.stackId === stackId)) {
          problems.push(`diagnostic design requires ${n.model} @ ${n.effort} on stack ${stackId}`);
        }
      }
    }
  }

  const strataSeen = new Set<string>();
  for (const b of spec.books ?? []) {
    if ((b.chapters ?? []).length === 0) problems.push(`book ${b.bookId} lists no chapters`);
    const seen = new Set<number>();
    for (const ch of b.chapters ?? []) {
      if (seen.has(ch.chapterNumber)) problems.push(`book ${b.bookId} lists ch${ch.chapterNumber} twice`);
      seen.add(ch.chapterNumber);
      if (!(CHAPTER_STRATA as readonly string[]).includes(ch.stratum)) {
        problems.push(`book ${b.bookId} ch${ch.chapterNumber}: unknown stratum "${ch.stratum}"`);
      }
      strataSeen.add(ch.stratum);
    }
  }
  for (const s of CHAPTER_STRATA) {
    if (!strataSeen.has(s)) problems.push(`no chapter covers the "${s}" stratum (all four are required; inst. 8)`);
  }

  if (!Number.isInteger(spec.samplesPerCell) || spec.samplesPerCell < 2) {
    problems.push("samplesPerCell must be ≥ 2 (multiple independent samples per cell)");
  }
  const sc = spec.screening;
  if (!sc || !Number.isInteger(sc.samplesPerCell) || sc.samplesPerCell < 1 || sc.samplesPerCell > spec.samplesPerCell) {
    problems.push("screening.samplesPerCell must be in [1, samplesPerCell]");
  }
  if (sc && sc.maxSamplesPerCell !== spec.samplesPerCell) {
    problems.push("screening.maxSamplesPerCell must equal samplesPerCell (one source of truth for the maximum sample)");
  }
  if (sc && sc.expandWhen.length === 0 && sc.samplesPerCell < spec.samplesPerCell) {
    problems.push("screening below the maximum requires frozen expandWhen rules");
  }
  if ((spec.judgePanel ?? []).length === 0) problems.push("judgePanel must be non-empty");
  if (!spec.thresholdsRelPath) problems.push("thresholdsRelPath is required");
  for (const c of spec.cells ?? []) {
    if (!(c.model in (spec.priceSnapshot ?? {}))) {
      problems.push(`priceSnapshot has no entry for ${c.model} (declare prices or an explicit null)`);
    }
  }
  if ((spec.precision?.primaryEndpoints ?? []).length === 0) problems.push("precision.primaryEndpoints must be declared before execution");
  if ((spec.stopping?.rules ?? []).length === 0) problems.push("stopping.rules must be frozen before execution");
  const replayable = new Set(spec.infraReplay?.replayableOutcomes ?? []);
  if (spec.infraReplay?.maxPerSample !== 1) problems.push("infraReplay.maxPerSample must be exactly 1 (prespecified bounded replay)");
  if (replayable.has("provider_safeguard_or_refusal" as never) || replayable.has("content_invalid" as never)) {
    problems.push("safeguard/refusal and content failures are NEVER replayable (§16 control 5)");
  }
  return problems;
}

export type SealDeps = {
  expectedChapterNumbers: (bookId: string) => number[];
  /** Test seam. Default: freeze.collectSharedInputPaths + hashing (canonical disk). */
  freezeBookInputs?: (bookId: string, chapterNumbers: number[]) => { files: FrozenFileV1[]; combinedSha256: string };
  /** Test seam. Default: buildAuthorCard over resolveAuthorIo() + voiceCard with
   *  the CARD_OUTPUT_PLACEHOLDER (byte-identical across cells by construction). */
  renderCurrentCard?: (bookId: string, chapterNumber: number, totalChapters: number) => string;
};

function defaultFreezeBookInputs(bookId: string, chapterNumbers: number[]): { files: FrozenFileV1[]; combinedSha256: string } {
  const files = collectSharedInputPaths(bookId, chapterNumbers).map((abs) => {
    const bytes = readFileSync(abs);
    return { relPath: pipelineRel(abs), sha256: sha256Hex(bytes), bytes: bytes.length };
  });
  return { files, combinedSha256: combineHashes(files) };
}

function defaultRenderCurrentCard(bookId: string, chapterNumber: number, totalChapters: number): string {
  const io = resolveAuthorIo();
  const briefMd = io.readBriefMd(bookId, chapterNumber);
  const packet = io.readPacket(bookId, chapterNumber);
  if (!briefMd || !packet) {
    throw new SealError(`cannot render the ${bookId} ch${String(chapterNumber).padStart(2, "0")} card template — brief md or packet unreadable (compile the book OUTSIDE the experiment first)`);
  }
  return buildAuthorCard({
    bookId,
    chapterNumber,
    totalChapters,
    briefMd,
    packet,
    voice: voiceCard(bookId),
    brief: io.readBrief(bookId, chapterNumber),
    outputRelPath: CARD_OUTPUT_PLACEHOLDER,
  });
}

function chKey(bookId: string, n: number): string {
  return `${bookId}:ch${String(n).padStart(2, "0")}`;
}

export function snapshotCardPath(snapshotDirRelPath: string, bookId: string, n: number): string {
  return resolve(PIPELINE_DIR, snapshotDirRelPath, `${bookId}.ch${String(n).padStart(2, "0")}.card.txt`);
}

function freezeStacks(spec: ExperimentSpecV1, deps: Required<Pick<SealDeps, "renderCurrentCard">> & Pick<SealDeps, "expectedChapterNumbers">, totalByBook: Map<string, number>): SealedManifestV1["stacks"] {
  const out: SealedManifestV1["stacks"] = [];
  for (const stack of spec.stacks) {
    const cardTemplateSha256: Record<string, string> = {};
    for (const book of spec.books) {
      for (const ch of book.chapters) {
        if (stack.source === "current-builders") {
          const card = deps.renderCurrentCard(book.bookId, ch.chapterNumber, totalByBook.get(book.bookId) ?? book.chapters.length);
          cardTemplateSha256[chKey(book.bookId, ch.chapterNumber)] = sha256Hex(card);
        } else {
          const p = snapshotCardPath(stack.snapshotDirRelPath, book.bookId, ch.chapterNumber);
          if (!existsSync(p)) {
            throw new SealError(`stack ${stack.id}: snapshot card template missing for ${chKey(book.bookId, ch.chapterNumber)} (${pipelineRel(p)})`);
          }
          const bytes = readFileSync(p, "utf8");
          if (!bytes.includes(CARD_OUTPUT_PLACEHOLDER)) {
            throw new SealError(`stack ${stack.id}: snapshot template ${pipelineRel(p)} lacks the ${CARD_OUTPUT_PLACEHOLDER} output placeholder`);
          }
          cardTemplateSha256[chKey(book.bookId, ch.chapterNumber)] = sha256Hex(bytes);
        }
      }
    }
    const combined = combineHashes(Object.entries(cardTemplateSha256).map(([relPath, sha256]) => ({ relPath, sha256 })));
    if (stack.source === "snapshot" && combined !== stack.combinedSha256) {
      throw new SealError(`stack ${stack.id}: snapshot content hashes to ${combined.slice(0, 16)}, spec pins ${stack.combinedSha256.slice(0, 16)} — refusing to seal a drifted stack`);
    }
    out.push({ id: stack.id, source: stack.source, cardTemplateSha256, combinedSha256: combined });
  }
  return out;
}

/** Seal the experiment: validate, copy spec + thresholds into the run root,
 *  freeze books/stacks/instruments, write the deterministic schedule, and
 *  persist sealed.json. Fail-closed on ANY missing/drifted input. */
export function sealExperiment(specAbsPath: string, roots: MigrationRoots, deps: SealDeps): SealedManifestV1 {
  // Hashes are computed over the exact bytes the sealed COPIES hold (the write
  // primitive normalizes the trailing newline — hash the same normalization).
  const specBytes = ensureTrailingNewline(readFileSync(specAbsPath, "utf8"));
  let spec: ExperimentSpecV1;
  try {
    spec = JSON.parse(specBytes) as ExperimentSpecV1;
  } catch (err) {
    throw new SealError(`spec is not valid JSON: ${(err as Error).message}`);
  }
  const problems = validateExperimentSpec(spec);
  if (problems.length > 0) {
    throw new SealError(`spec fails validation:\n- ${problems.join("\n- ")}`);
  }

  // Books: chapters must exist in the real index; totalChapters = index length
  // (the content-device deal must gate exactly like production authoring).
  const totalByBook = new Map<string, number>();
  for (const book of spec.books) {
    const index = deps.expectedChapterNumbers(book.bookId);
    if (index.length === 0) throw new SealError(`book ${book.bookId}: no chapter index — the experiment never compiles; prepare the book first`);
    const missing = book.chapters.filter((c) => !index.includes(c.chapterNumber)).map((c) => c.chapterNumber);
    if (missing.length > 0) throw new SealError(`book ${book.bookId}: chapters not in the index: ${missing.join(", ")}`);
    totalByBook.set(book.bookId, index.length);
  }

  const freezeBook = deps.freezeBookInputs ?? defaultFreezeBookInputs;
  const renderCard = deps.renderCurrentCard ?? defaultRenderCurrentCard;
  const books: SealedManifestV1["books"] = spec.books.map((b) => ({
    bookId: b.bookId,
    totalChapters: totalByBook.get(b.bookId)!,
    frozen: freezeBook(b.bookId, b.chapters.map((c) => c.chapterNumber)),
  }));
  const stacks = freezeStacks(spec, { renderCurrentCard: renderCard, expectedChapterNumbers: deps.expectedChapterNumbers }, totalByBook);

  const thresholdsAbs = resolve(PIPELINE_DIR, spec.thresholdsRelPath);
  if (!existsSync(thresholdsAbs)) throw new SealError(`thresholds file missing: ${spec.thresholdsRelPath}`);
  const thresholdsBytes = ensureTrailingNewline(readFileSync(thresholdsAbs, "utf8"));
  const thresholdProblems = validateThresholds(thresholdsBytes);
  if (thresholdProblems.length > 0) {
    throw new SealError(`thresholds file invalid:\n- ${thresholdProblems.join("\n- ")}`);
  }

  const schedule = buildSampleSchedule(spec);
  const scheduleBytes = ensureTrailingNewline(JSON.stringify(schedule, null, 2));

  const contractManifestAbs = resolve(PIPELINE_DIR, "src", "contracts", "contract-manifest.json");
  const sealed: SealedManifestV1 = {
    schema: MIGRATION_SEALED_SCHEMA,
    experimentId: spec.experimentId,
    specSha256: sha256Hex(specBytes),
    sealedAt: new Date().toISOString(),
    randomizationSeed: spec.randomizationSeed,
    scheduleSha256: sha256Hex(scheduleBytes),
    thresholdsSha256: sha256Hex(thresholdsBytes),
    books,
    stacks,
    instruments: {
      readerRubricVersion: READER_RUBRIC_VERSION,
      reviewDocHashVersion: REVIEW_DOC_HASH_VERSION,
      authorChapterBar: AUTHOR_CHAPTER_BAR,
      routePolicyVersion: ROUTE_POLICY_VERSION,
      contractManifestSha256: sha256Hex(readFileSync(contractManifestAbs)),
      repairProjectionVersion: REPAIR_PROJECTION_VERSION,
    },
    judgePanel: spec.judgePanel,
    priceSnapshot: spec.priceSnapshot,
    expectedCells: spec.cells.map((c) => c.cellId),
  };

  rootedWrite(roots, roots.specCopyPath, specBytes);
  rootedWrite(roots, roots.thresholdsCopyPath, thresholdsBytes);
  rootedWrite(roots, roots.schedulePath, scheduleBytes);
  rootedWrite(roots, roots.sealedPath, JSON.stringify(sealed, null, 2));
  return sealed;
}

export function readSealed(roots: MigrationRoots): SealedManifestV1 {
  if (!existsSync(roots.sealedPath)) throw new MigrationGuardError("experiment is not sealed — run seal first");
  const sealed = JSON.parse(readFileSync(roots.sealedPath, "utf8")) as SealedManifestV1;
  if (sealed.schema !== MIGRATION_SEALED_SCHEMA) throw new MigrationGuardError(`sealed.json has schema ${String(sealed.schema)} — expected ${MIGRATION_SEALED_SCHEMA}`);
  return sealed;
}

export function readSealedSpec(roots: MigrationRoots): ExperimentSpecV1 {
  return JSON.parse(readFileSync(roots.specCopyPath, "utf8")) as ExperimentSpecV1;
}

/** Re-derive every sealed hash; [] = intact. The conductor calls this before
 *  EVERY phase — drift halts the run instead of mixing conditions. */
export function verifySealIntact(roots: MigrationRoots, deps: SealDeps): string[] {
  const problems: string[] = [];
  let sealed: SealedManifestV1;
  let spec: ExperimentSpecV1;
  try {
    sealed = readSealed(roots);
    spec = readSealedSpec(roots);
  } catch (err) {
    return [(err as Error).message];
  }
  if (sha256Hex(readFileSync(roots.specCopyPath, "utf8")) !== sealed.specSha256) problems.push("sealed spec copy drifted");
  if (sha256Hex(readFileSync(roots.thresholdsCopyPath, "utf8")) !== sealed.thresholdsSha256) problems.push("sealed thresholds copy drifted");
  if (sha256Hex(readFileSync(roots.schedulePath, "utf8")) !== sealed.scheduleSha256) problems.push("schedule drifted");
  for (const book of sealed.books) {
    for (const f of book.frozen.files) {
      const abs = resolve(PIPELINE_DIR, f.relPath);
      if (!existsSync(abs)) {
        problems.push(`frozen input missing: ${f.relPath}`);
        continue;
      }
      const now = sha256Hex(readFileSync(abs));
      if (now !== f.sha256) problems.push(`frozen input drifted: ${f.relPath} (${f.sha256.slice(0, 12)} → ${now.slice(0, 12)})`);
    }
  }
  // Stacks: re-render current builders / re-hash snapshots — builder-code drift
  // between seal and run is a condition change and must halt.
  const renderCard = deps.renderCurrentCard ?? defaultRenderCurrentCard;
  const totalByBook = new Map(sealed.books.map((b) => [b.bookId, b.totalChapters] as const));
  for (const stack of sealed.stacks) {
    const specStack = spec.stacks.find((s) => s.id === stack.id);
    for (const [key, sha] of Object.entries(stack.cardTemplateSha256)) {
      const [bookId, chPart] = key.split(":");
      const n = Number(chPart.replace("ch", ""));
      try {
        const now = stack.source === "current-builders"
          ? sha256Hex(renderCard(bookId, n, totalByBook.get(bookId) ?? 0))
          : sha256Hex(readFileSync(snapshotCardPath((specStack as { snapshotDirRelPath: string }).snapshotDirRelPath, bookId, n), "utf8"));
        if (now !== sha) problems.push(`stack ${stack.id}: card template drifted for ${key}`);
      } catch (err) {
        problems.push(`stack ${stack.id}: card template unverifiable for ${key} (${(err as Error).message.split("\n")[0]})`);
      }
    }
  }
  return problems;
}
