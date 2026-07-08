/**
 * authorReview — the v24 AUTHOR architecture's REVIEW phase (component B4).
 *
 * Replaces doQcWithRepair for architecture === "author":
 *
 *   1. Every chapter gets ONE blinded independent reader (readerReview.ts):
 *      rendered doc → read-only codex session → parse → deterministic
 *      adjudication (byte-verified quotes + positional key check + weighted
 *      composite) → persisted ChapterReviewV1.
 *   2. A failing chapter is REGENERATED (authorWriteOneChapter with the
 *      review's complaints — regeneration with complaints, never blind
 *      patching), then re-reviewed. CAP: 2 total write attempts per chapter
 *      (the original + one regen). Still failing → halt content.
 *   3. Book acceptance: the owner's book-score instrument shape — a seeded
 *      4-chapter sample doc read by AUTHOR_BOOK_READERS (=3, Q5) independent
 *      book readers, composed by composeBookVerdict. ACCEPT when gate === "PASS"
 *      AND medianComposite >= FLOOR(74) AND >= beatShipped+MARGIN(5) AND validCount
 *      >= quorum (churn = telemetry + repair routing, never an accept veto —
 *      publish calibration 2026-07-04)
 *      (Q4). The book readers are the author arch's CONFIRMING function (the
 *      sweep-confirmation analog — runAutopilot's author branch substitutes this
 *      acceptance for deps.sweepConfirmed).
 *   4. On acceptance: FIRST produce the independent publish evidence the
 *      no-API promote gate additionally enforces (component B5,
 *      authorEvidence.ts) — the per-chapter manual key-judge records (blind
 *      key packs + TWO independent key-reader sessions fed through the real
 *      key-derive/key-resolve writers, round roles keyA/keyB) and the
 *      book-level sweep attestation (one independent sweep read submitted
 *      through the real qc-submit path, backed by roles.sweep) — then write
 *      the QC attestation + bar/confirm records in the shapes the promote
 *      gate reads (verdict PUBLISHABLE, bound to chapterContentHash, reviewer
 *      sessions from the review artifacts). A failure in either evidence step
 *      is a fail-closed halt (infra/content), never a skip.
 *
 *      HISTORY — the closed B4 KNOWN LIMITATION (verifier finding 2026-07-02):
 *      promote-book force-sets CHAPTERFLOW_NO_API_CODEX_QC=1 and in that mode
 *      ALSO enforces checkManualKeyJudge (keyA/keyB key-pack/derive/resolve
 *      records per chapter) and checkSweep (a sweep attestation backed by
 *      roles.sweep) — record families only the legacy/compiler QC round
 *      machinery produced, so an author-arch book reached READY but could not
 *      pass promote-book. B5 (2026-07-02) closed it by producing those exact
 *      record families as REAL independent evidence through the existing
 *      writers (never by touching promote/manualKeyJudge/sweep check code):
 *      see authorEvidence.ts runKeyJudgeEvidence + runSweepEvidence, wired in
 *      below at the acceptance step.
 *   5. On rejection: ONE targeted regen round (book complaints mapped to their
 *      chapters, cap 3), re-review, then re-run acceptance ONCE; still
 *      failing → halt content.
 *
 * Returns the same outcome shapes doQcWithRepair returns (AutopilotOutcome |
 * null; null = phase complete, re-loop) so runAutopilot handles ready/halt
 * identically. Compiler/legacy QC behavior is byte-untouched.
 */

import { readFileSync, writeFileSync } from "fs";
import { mkdirSync, existsSync, readdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

import { CANONICAL_STATE, CHAPTERS_DIR, chapterFileName } from "../lib/chapterPaths.js";
import type { AutopilotDeps, AutopilotOutcome } from "./autopilot.js";
import type { ChapterV21 } from "../types.js";
import {
  CHAPTER_REVIEW_SCHEMA_VERSION,
  REVIEW_FACTORS,
  type ChapterReviewV1,
  type ChapterReviewComplaint,
  type ReviewFactor,
} from "../artifacts/artifactTypes.js";
import {
  adjudicateReview,
  assertChapterReaderDocIntegrity,
  AUTHOR_CHAPTER_BAR,
  buildReaderReviewTask,
  parseReaderReview,
  writeChapterReview,
} from "../review/readerReview.js";
import { renderChapterReaderDoc } from "../review/renderReaderDoc.js";
import {
  adjudicateBookReview,
  assertBookSampleDocIntegrity,
  buildBookReviewTask,
  composeBookVerdict,
  DocIntegrityError,
  parseBookReview,
  renderBookSampleDoc,
  selectAcceptanceSample,
  type BookReaderResult,
  type BookVerdict,
} from "../review/evalBookProxy.js";
import { buildChurnEvidenceReport, rankSaturationContributors } from "../critics/readerBudgets.js";
import { structuralSamenessSnapshot, type StructuralSamenessSnapshot } from "../critics/structuralSamenessSnapshot.js";
import { chapterContentHash, writeAttestation, type QcAttestation } from "../critics/qcAttestation.js";
import { restoreAuthorProvenance } from "../qc/sessionProvenance.js";
import { AXIS_WEIGHTS, computeVerdict, type AxisId, type AxisScore } from "../critics/semantic/publishableBar.js";
import { writeBarReadArtifact, writeConfirmReadArtifact } from "../qc/orchestrator/artifacts.js";
import type { ValidatedBarReadSubmission, ValidatedConfirmReadSubmission } from "../qc/orchestrator/schemas.js";
import { openQcRound, type QcRoundRole } from "../qc/qcRound.js";
import { writeFileAtomic, ensureTrailingNewline } from "../lib/atomicWrite.js";
import {
  runKeyJudgeEvidence,
  runSweepEvidence,
  type AuthorEvidenceResult,
  type AuthorEvidenceRound,
} from "./authorEvidence.js";
import {
  authorChapterId,
  authorWriteOneChapter,
  ensureReaderBudgetsClean,
  resolveAuthorIo,
  type AuthorIo,
} from "./authorRun.js";
import {
  appendReopenNote,
  appendReviewHistory,
  appendTiebreakNote,
  carryReviewFor,
  loadTiebreakNotes,
  reviewHistoryPath,
  writeReviewClearsLedger,
  type ReopenNote,
} from "./authorReviewLedger.js";
import {
  RegenLedgerError,
  computeRegenLineage,
  loadAuthorRegenLedger,
  migrateLegacyRegenCounts,
  recordRegenConsumed,
  recordRepairConsumed,
  regenConsumedFor,
  repairConsumedFor,
} from "./authorRegenLedger.js";
import { classifyRepairEligibility, doRepairOneChapter, RepairRestoreError, reviewRepairEnabled } from "./authorRepair.js";
import { resolveBeatShippedBar, type BeatShippedResult } from "./shippedControl.js";
// F-04 (Prompt 4): the bounded content-device repair lane. TYPE-ONLY import — the
// runtime `doContentDeviceRepair` is loaded lazily inside resolveAuthorReviewIo's
// default so the authorReview↔bookSamenessRun module cycle never resolves at import
// time (bookSamenessRun imports reviewOneChapter et al. from THIS module).
import type { BookSamenessOptions, ContentRepairResult } from "./bookSamenessRun.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");

/** Total write attempts per chapter across write+review: the original authoring
 *  + ONE review-complaint regeneration. */
export const AUTHOR_REGEN_CAP = 2;
/** Book-acceptance rejection: at most this many chapters get the targeted regen. */
export const AUTHOR_BOOK_REGEN_CHAPTER_CAP = 3;
/** Independent book-level readers per acceptance round. THREE (Q5, owner
 *  decision 2026-07-03) restores parity with the owner-instrument replica (whose
 *  CLI default is 3) and compose.py's median/majority-of-odd-panel semantics:
 *  median-of-3 clips a single outlier composite (a lone hallucinating reader no
 *  longer drags the mean), the gate becomes a true majority (2P/1F PASS, 1P/2F
 *  FAIL — FAIL no longer needs unanimity), and churn resolves by real majority
 *  (the only remaining tie is a LOW/MEDIUM/HIGH one-each split, still decided by
 *  first-inserted). Was 2. */
export const AUTHOR_BOOK_READERS = 3;

// ── Injectable IO (extends the write phase's AuthorIo) ────────────────────────

export type AcceptanceWriters = {
  /** Open a REAL QC round (state/qc-rounds/<book>.<roundId>.json) and return its id
   *  PLUS the role tokens — checkQcAttestation's no-API path requires the attestation's
   *  roundId/roundRole to resolve against an existing round record, and the B5 evidence
   *  writers (key-derive / qc-submit) verify their role tokens against the same round. */
  openRound: (bookId: string) => { roundId: string; tokens: Partial<Record<QcRoundRole, string>> };
  writeBar: (submission: ValidatedBarReadSubmission) => string;
  writeConfirm: (submission: ValidatedConfirmReadSubmission) => string;
  writeAttestation: (att: QcAttestation) => string;
};

/** B5 — the independent publish-evidence steps (injectable so unit tests stub
 *  them; the real implementations live in authorEvidence.ts). */
export type EvidenceRunners = {
  runKeyJudge: (bookId: string, chapters: ChapterV21[], deps: AutopilotDeps, io: AuthorReviewIo, round: AuthorEvidenceRound) => Promise<AuthorEvidenceResult>;
  runSweep: (bookId: string, chapters: ChapterV21[], deps: AutopilotDeps, io: AuthorReviewIo, round: AuthorEvidenceRound) => Promise<AuthorEvidenceResult>;
};

/** Q6 — the durable per-round acceptance record. Every adjudicated reader result
 *  (scores, gate, churn, quotes tally, keyCheck, structuralScreen, invalidReason)
 *  + the composed verdict + the bar it was judged at + the beat-shipped floor +
 *  the sampled chapter numbers + a sha256 of the EXACT docText the readers scored
 *  + an ISO timestamp. Written to state/reviews/<bookId>/acceptance.<roundLabel>.json
 *  so forensics no longer depend on ~/.codex rollouts outside the repo. */
export type AuthorAcceptanceRecord = {
  schemaVersion: "author-acceptance-v1";
  bookId: string;
  roundLabel: string;
  at: string;
  bar: number;
  beatShipped: number | null;
  accepted: boolean;
  sampledChapters: number[];
  docSha256: string;
  verdict: BookVerdict;
  readers: BookReaderResult[];
  /** Multi-read median (FINAL-HARDENING-PLAN 2026-07-04, additive to v1): the
   *  pooled state at the moment this read was persisted — how many same-docSha
   *  quorum-met reads pooled, the TRUE-median composite, the sticky gate, the
   *  noise band in force, and whether the per-doc panel cap was reached. The
   *  record-level `accepted` above IS the pooled decision, which is what
   *  deriveDurableAcceptance corroborates. */
  pooled?: {
    reads: number;
    composite: number;
    gate: "PASS" | "FAIL";
    noiseBand: number;
    capped: boolean;
  };
  /** F-06 (additive telemetry, 2026-07-08): the DETERMINISTIC sameness snapshot of
   *  the whole book at acceptance time — which ARCH skeleton axes and content-
   *  machinery devices were over-saturated. Read-only attribution: it does NOT
   *  feed the `accepted` predicate and is computed from the chapters (never the
   *  docText), so it leaves docSha256 / the pooling key untouched. Lets a
   *  churn-HIGH rejection be cross-checked against deterministic saturation. */
  structuralSameness?: StructuralSamenessSnapshot;
};

export type AuthorReviewIo = AuthorIo & {
  /** Persist a review input doc under scratch/review/<book>/; returns both paths. */
  writeReviewDoc: (bookId: string, fileName: string, text: string) => { absPath: string; relPath: string };
  /** Persist a chapter's ChapterReviewV1 artifact. */
  persistReview: (bookId: string, review: ChapterReviewV1) => string;
  /** Q6 — persist a durable acceptance-round record; returns the path written.
   *  APPEND-ONLY (F1): the default impl writes one file per read and never
   *  overwrites a prior read of the same label. */
  persistAcceptance: (bookId: string, record: AuthorAcceptanceRecord) => string;
  /** Multi-read pool (F1/F3): every durable quorum-met read of these exact
   *  bytes. Injectable so unit tests pool from an in-memory set. */
  listAcceptanceReads: (bookId: string, docSha256: string) => AuthorAcceptanceRecord[];
  acceptance: AcceptanceWriters;
  evidence: EvidenceRunners;
  /** AUTO control-read: resolve the beat-shipped bar (env override / git-pinned
   *  shipped-package 3-reader control read / none). Injectable so tests never
   *  spawn a real reader or shell out to git. */
  resolveBeatShipped: (bookId: string, deps: AutopilotDeps, io: AuthorReviewIo) => Promise<BeatShippedResult>;
  /** E2 regen-cap persistence — how many REGENERATIONS a chapter has consumed
   *  across prior conductor entries AGAINST ITS CURRENT DESIGN LINEAGE (v2,
   *  durable). Throws RegenLedgerError when the lineage is uncomputable —
   *  an infra halt, never a fail-open cap. Injectable so tests exercise the
   *  GLOBAL cap without leaking into real state/. Default reads the on-disk
   *  ledger. */
  regenConsumedFor: (bookId: string, chapterNumber: number) => number;
  /** Record ONE more consumed regeneration for a chapter's current lineage
   *  (durable). Throws RegenLedgerError on uncomputable lineage. Injectable;
   *  default appends to the on-disk ledger. */
  recordRegenConsumed: (bookId: string, chapterNumber: number) => void;
  /** Stamp v1 legacy counts onto their on-disk design lineages (idempotent;
   *  see migrateLegacyRegenCounts). Called at phase entry BEFORE any regen
   *  decision. Throws RegenLedgerError when legacy counts exist but a lineage
   *  is uncomputable. */
  migrateRegenLedger: (bookId: string, log?: (m: string) => void) => void;
  /** Repair lane (plan R6): repairs consumed against the chapter's CURRENT
   *  design lineage (durable; cap 1). Injectable like the regen pair. */
  repairConsumedFor: (bookId: string, chapterNumber: number) => number;
  recordRepairConsumed: (bookId: string, chapterNumber: number) => void;
  /** F-03: append a durable reopen note (why a passing chapter was reopened by an
   *  acceptance rejection). Injectable so unit tests capture notes in memory
   *  instead of writing real state/. Default = the SAME appendReopenNote ledger
   *  the budget lane uses. Best-effort at the call site (a note failure never
   *  converts a decided regen into a halt). */
  appendReopenNote: (bookId: string, note: ReopenNote) => void;
  /** F-04 (Prompt 4): the bounded content-device repair lane (planner + driver +
   *  device-verify + revert), the SAME core the `content-repair-book` CLI verb
   *  runs. Injectable so the churn router drives it before spending regen, and so
   *  tests exercise the routing without spawning the real writer. Default = the
   *  real doContentDeviceRepair, imported lazily to break the module cycle. */
  contentDeviceRepair: (bookId: string, deps: AutopilotDeps, opts: BookSamenessOptions) => Promise<ContentRepairResult>;
};

/** F-04 kill switch (Prompt 4): a churn-HIGH acceptance rejection tries the bounded
 *  content-device repair lane BEFORE spending any global regen write. Default ON;
 *  `CHAPTERFLOW_CHURN_CONTENT_REPAIR=0` restores the pre-P4 named+saturation regen
 *  routing byte-for-byte. Mirrors CHAPTERFLOW_REVIEW_REPAIR (authorRepair.ts:30-32). */
export function churnContentRepairEnabled(): boolean {
  return process.env.CHAPTERFLOW_CHURN_CONTENT_REPAIR !== "0";
}

/** Default io lineage resolution: uncomputable lineage = infra, never no-cap. */
function requireLineage(bookId: string, chapterNumber: number): string {
  const lineage = computeRegenLineage(bookId, chapterNumber);
  if (!lineage) {
    throw new RegenLedgerError(
      `regen lineage uncomputable for ch${String(chapterNumber).padStart(2, "0")} of ${bookId} (brief or source packet unreadable) — cannot honor the regen cap honestly`,
    );
  }
  return lineage;
}

/** Thrown when the AUTO control-read is required (a shipped package exists, no
 *  env override) but cannot be produced — a fail-closed infra halt, never a
 *  silent drop of the beat-shipped protection. Caught by doAuthorReview like
 *  DocIntegrityError. */
export class ControlReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ControlReadError";
  }
}

export function resolveAuthorReviewIo(over?: Partial<AuthorReviewIo>): AuthorReviewIo {
  const base = resolveAuthorIo(over);
  return {
    ...base,
    writeReviewDoc: over?.writeReviewDoc ?? ((bookId, fileName, text) => {
      const relPath = `scratch/review/${bookId}/${fileName}`;
      const absPath = resolve(PIPELINE_DIR, relPath);
      mkdirSync(dirname(absPath), { recursive: true });
      // Q1 central choke point: EVERY reader-facing doc written here (per-chapter
      // reader doc, book-sample doc, key-judge doc, sweep-submission/answers JSON)
      // is guaranteed to end with a trailing newline. See ensureTrailingNewline.
      writeFileAtomic(absPath, ensureTrailingNewline(text));
      return { absPath, relPath };
    }),
    persistReview: over?.persistReview ?? ((bookId, review) => {
      // Latest-pointer artifact (state/reviews/<book>/ch<NN>.review.json) — the
      // existing per-chapter review file every prior consumer reads.
      const path = writeChapterReview(bookId, review);
      // E2: append to the immutable content-keyed history + rebuild the
      // materialized clears cache. Best-effort — a ledger write must never
      // convert a valid review into a halt; the reuse predicate reverifies the
      // history bytes anyway and the cache is rebuildable.
      try {
        appendReviewHistory(bookId, review);
        writeReviewClearsLedger(bookId);
      } catch { /* forensic ledger; never fail the review on it */ }
      return path;
    }),
    persistAcceptance: over?.persistAcceptance ?? ((bookId, record) => {
      // F1: append-only — find the first free read index for this (label, docSha)
      // instead of overwriting the per-label slot. A prior read is a durable vote.
      let path = "";
      for (let k = 1; k <= 99; k++) {
        const candidate = acceptanceReadRecordPath(bookId, record.roundLabel, record.docSha256, k);
        if (!existsSync(candidate)) { path = candidate; break; }
      }
      if (!path) throw new Error(`persistAcceptance: 99 read records already exist for ${bookId} ${record.roundLabel} ${record.docSha256.slice(0, 8)} — refusing to overwrite`);
      mkdirSync(dirname(path), { recursive: true });
      writeFileAtomic(path, JSON.stringify(record, null, 2) + "\n");
      return path;
    }),
    listAcceptanceReads: over?.listAcceptanceReads ?? ((bookId, docSha256) => listAcceptanceReads(bookId, docSha256)),
    acceptance: over?.acceptance ?? {
      openRound: (bookId) => {
        const opened = openQcRound(bookId);
        return { roundId: opened.record.roundId, tokens: opened.tokens };
      },
      writeBar: (submission) => writeBarReadArtifact(submission),
      writeConfirm: (submission) => writeConfirmReadArtifact(submission),
      writeAttestation: (att) => writeAttestation(att),
    },
    evidence: over?.evidence ?? {
      runKeyJudge: runKeyJudgeEvidence,
      runSweep: runSweepEvidence,
    },
    resolveBeatShipped: over?.resolveBeatShipped ?? ((bookId, deps, io) => resolveBeatShippedBar(bookId, deps, io)),
    regenConsumedFor: over?.regenConsumedFor ?? ((bookId, n) => regenConsumedFor(loadAuthorRegenLedger(bookId), n, requireLineage(bookId, n))),
    recordRegenConsumed: over?.recordRegenConsumed ?? ((bookId, n) => { recordRegenConsumed(bookId, n, requireLineage(bookId, n)); }),
    migrateRegenLedger: over?.migrateRegenLedger ?? ((bookId, log) => { migrateLegacyRegenCounts(bookId, undefined, log); }),
    repairConsumedFor: over?.repairConsumedFor ?? ((bookId, n) => repairConsumedFor(loadAuthorRegenLedger(bookId), n, requireLineage(bookId, n))),
    recordRepairConsumed: over?.recordRepairConsumed ?? ((bookId, n) => { recordRepairConsumed(bookId, n, requireLineage(bookId, n)); }),
    appendReopenNote: over?.appendReopenNote ?? ((bookId, note) => { appendReopenNote(bookId, note); }),
    contentDeviceRepair: over?.contentDeviceRepair ?? (async (bookId, deps, o) => {
      // Lazy import breaks the authorReview↔bookSamenessRun cycle (the real driver
      // imports reviewOneChapter/resolveAuthorReviewIo from this module).
      const { doContentDeviceRepair } = await import("./bookSamenessRun.js");
      return doContentDeviceRepair(bookId, deps, o);
    }),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function halt(bookId: string, category: "infra" | "content" | "progress", reason: string): AutopilotOutcome {
  return { status: "halt", bookId, phase: "qc", category, reason };
}

/** Canonical on-disk path of an author chapter's bytes (the file the writer,
 *  gates, and promote all read/write). Mirrors bookSamenessRun's chapterPath so
 *  the acceptance-regen restore snapshots/restores the exact same bytes. */
function chapterFilePath(bookId: string, chapterNumber: number): string {
  return resolve(CHAPTERS_DIR, chapterFileName(authorChapterId(bookId, chapterNumber)));
}

// ── F-03: acceptance-regen regression safety ──────────────────────────────────

/** The outcome of an acceptance-round regen of a (previously passing) chapter. */
export type AcceptanceRegenOutcome = "keep" | "restore-fail" | "restore-regress";

/**
 * PURE decision (F-03): should an acceptance-round regen draft be KEPT, or the
 * prior passing bytes RESTORED? Testable without spawning. An acceptance regen
 * may never leave a chapter worse than it found it:
 *   - the regen WRITE failed (`regenOk=false`)                → restore-fail
 *   - the regen's independent review FAILs (`reviewPass=false`) → restore-fail
 *   - the regen PASSES but its composite fell more than `band` BELOW the prior
 *     review                                                   → restore-regress
 *     (the complaint was not addressed at equal quality — a 74-draft must never
 *      silently replace an 85-draft; the documented ch04 85.6→73.4 class)
 *   - the regen PASSES within/above the band                  → keep
 *
 * The band is a tolerance (not keep-if-strictly-better): a diversified chapter
 * may legitimately dip slightly, mirroring the sameness driver's `bar - band`
 * philosophy. BOUNDARY: composite === prior − band is WITHIN band → keep. The
 * prior composite is compared per-round against the PRE-REOPEN snapshot the
 * caller passes (never an accumulating baseline), so multi-round reopens cannot
 * ratchet quality down one band at a time. When the prior composite is unknown
 * (no prior review to compare), regression cannot be judged, so a PASS is kept.
 */
export function decideAcceptanceRegenOutcome(input: {
  regenOk: boolean;
  reviewPass: boolean;
  composite: number;
  priorComposite: number | undefined;
  band: number;
}): AcceptanceRegenOutcome {
  if (!input.regenOk) return "restore-fail";
  if (!input.reviewPass) return "restore-fail";
  if (
    typeof input.priorComposite === "number" &&
    Number.isFinite(input.priorComposite) &&
    input.composite < input.priorComposite - input.band
  ) {
    return "restore-regress";
  }
  return "keep";
}

/** Normalize an acceptance round label ("" → "round1"; "-round2" → "round2") to
 *  a filesystem-safe segment. Exported for the durable-record test. */
export function acceptanceRoundSegment(roundLabel: string): string {
  const seg = (roundLabel || "").replace(/^-/, "").trim() || "round1";
  return seg.replace(/[^A-Za-z0-9._-]/g, "_");
}

/** Path of a durable acceptance record under `stateRoot` (default: canonical
 *  pipeline state dir). Injectable root so tests write to a tmp dir.
 *  LEGACY single-slot path — kept for fixtures/back-compat reads; production
 *  writes go through acceptanceReadRecordPath (append-only, F1 fix). */
export function acceptanceRecordPath(bookId: string, roundLabel: string, stateRoot: string = CANONICAL_STATE): string {
  return resolve(stateRoot, "reviews", bookId, `acceptance.${acceptanceRoundSegment(roundLabel)}.json`);
}

/** Append-only per-read acceptance record path (F1, FINAL-HARDENING-PLAN
 *  2026-07-04): the old per-label single slot meant every re-entry OVERWROTE the
 *  prior read, so gate-FAIL stickiness decayed after exactly one re-entry and the
 *  pool never saw more than one prior. One file per panel read, keyed by round
 *  segment + docSha prefix + read index — nothing ever overwrites a prior read. */
export function acceptanceReadRecordPath(
  bookId: string,
  roundLabel: string,
  docSha256: string,
  readIndex: number,
  stateRoot: string = CANONICAL_STATE,
): string {
  const seg = acceptanceRoundSegment(roundLabel);
  return resolve(stateRoot, "reviews", bookId, `acceptance.${seg}.${docSha256.slice(0, 8)}.r${readIndex}.json`);
}

/** Every durable QUORUM-MET acceptance read of these EXACT bytes, oldest first.
 *  Scans acceptance.*.json (legacy single-slot records pool too — their docSha
 *  keys them honestly). Quorum-failed reads are infra noise, not votes: their
 *  composites are composed over a shrunken panel, so they join neither the
 *  median nor the sticky-gate set. Torn/foreign files are skipped. */
export function listAcceptanceReads(
  bookId: string,
  docSha256: string,
  stateRoot: string = CANONICAL_STATE,
): AuthorAcceptanceRecord[] {
  const dir = resolve(stateRoot, "reviews", bookId);
  if (!existsSync(dir)) return [];
  const out: AuthorAcceptanceRecord[] = [];
  for (const f of readdirSync(dir)) {
    if (!/^acceptance\..+\.json$/.test(f)) continue;
    try {
      const rec = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as AuthorAcceptanceRecord;
      if (!rec || rec.schemaVersion !== "author-acceptance-v1" || rec.bookId !== bookId) continue;
      if (rec.docSha256 !== docSha256) continue;
      if ((rec.verdict?.validCount ?? 0) < AUTHOR_BOOK_READERS) continue;
      if (typeof rec.verdict?.medianComposite !== "number" || !Number.isFinite(rec.verdict.medianComposite)) continue;
      out.push(rec);
    } catch { /* torn/foreign record — skip */ }
  }
  return out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

/** TRUE median (F2 fix): the old pooled decision used the UPPER median, which on
 *  the typical two reads is max(prev, cur) — a bias TOWARD acceptance, inverting
 *  the re-roll guard. Even count → mean of the two middle values. */
export function trueMedian(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Panel reads per docSha256, TOTAL and durable across conductor re-entries (F3):
 *  read 1 always runs on unseen bytes; extra reads run only while the pooled
 *  decision sits inside the noise band; at the cap the pooled decision FREEZES
 *  for those bytes — further entries reuse it and spawn nothing. */
export const PANEL_READS_PER_DOC_CAP = 3;

/** Measured same-bytes acceptance-panel noise (execution campaign 2026-07-04:
 *  a fixed 9-chapter board read 75.0–78.7 across 5 panels — ±3.7). */
export const PANEL_NOISE_BAND_DEFAULT = 3.7;

/** Multi-read config error — set-but-invalid env must halt, never silently fall
 *  back (the BREAK-1 lesson from the beat-shipped override). */
export class AcceptanceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcceptanceConfigError";
  }
}

/** CHAPTERFLOW_PANEL_NOISE_BAND: unset/empty → the measured default; a
 *  set-but-non-finite or negative value throws (fail closed). 0 disables the
 *  multi-read trigger (every decision counts as clear). */
export function resolvePanelNoiseBand(): number {
  const raw = process.env.CHAPTERFLOW_PANEL_NOISE_BAND;
  if (raw === undefined || raw.trim() === "") return PANEL_NOISE_BAND_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new AcceptanceConfigError(
      `CHAPTERFLOW_PANEL_NOISE_BAND is set but not a finite non-negative number ("${raw}") — unset it or export a real band (default ${PANEL_NOISE_BAND_DEFAULT}).`,
    );
  }
  return n;
}

/** CHAPTERFLOW_CHAPTER_BAR: unset/empty → AUTHOR_CHAPTER_BAR (80); a
 *  set-but-non-finite or out-of-range (not 0-100) value throws (fail closed —
 *  same discipline as the panel band; a typo must halt, never silently ship at
 *  a bogus bar). Resolved ONCE at the review entry and threaded explicitly. */
export function resolveChapterBar(): number {
  const raw = process.env.CHAPTERFLOW_CHAPTER_BAR;
  if (raw === undefined || raw.trim() === "") return AUTHOR_CHAPTER_BAR;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new AcceptanceConfigError(
      `CHAPTERFLOW_CHAPTER_BAR is set but not a finite 0-100 number ("${raw}") — unset it or export a real bar (default ${AUTHOR_CHAPTER_BAR}).`,
    );
  }
  return n;
}

/** The chapter-gate near-bar noise band (Phase 3). Reuses the measured
 *  same-bytes panel noise (±3.7) as the default: a chapter whose composite sits
 *  within ±band of the bar is in the flap zone and earns bounded extra reads
 *  before a regen is spent. CHAPTERFLOW_CHAPTER_NOISE_BAND overrides; 0 disables
 *  the chapter-gate tiebreak entirely (every FAIL goes straight to regen). */
export const CHAPTER_NOISE_BAND_DEFAULT = PANEL_NOISE_BAND_DEFAULT;

export function resolveChapterNoiseBand(): number {
  const raw = process.env.CHAPTERFLOW_CHAPTER_NOISE_BAND;
  if (raw === undefined || raw.trim() === "") return CHAPTER_NOISE_BAND_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new AcceptanceConfigError(
      `CHAPTERFLOW_CHAPTER_NOISE_BAND is set but not a finite non-negative number ("${raw}") — unset it or export a real band (default ${CHAPTER_NOISE_BAND_DEFAULT}).`,
    );
  }
  return n;
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

/**
 * QC CALIBRATION BACKSTOP (CONVERGENCE-SAFE PASS, 2026-07-05): does a mustFix
 * complaint name a CONCRETE reader-harming defect in a RESERVED category, or is
 * it subjective taste dressed as a blocker?
 *
 * The reviewer prompt now defines mustFix as reserved-category harm only, but
 * reader classification still drifts run-to-run — the single biggest churn lever
 * is a reviewer stamping mustFix on a thin example / weak distractor / prose
 * polish, which alone blocks near-bar conversion and forces a full regen. This
 * code-side check makes the narrowing DURABLE regardless of reader drift, while
 * defaulting to TRUST so it can never HIDE a real blocker. F-09 replaced the two
 * blunt substring nets with the context-anchored classifier below:
 *   - ASSERTS a reserved harm (the KEY/answer/fact is wrong, a section is missing/
 *     broken, unsafe advice, fabrication, self-contradiction, unusable) → TRUE.
 *   - clearly aesthetic (a quiz-tell / thin-but-usable example / prose polish /
 *     a key-SOUNDNESS affirmation) with NO block signal → FALSE (downgraded).
 *   - ambiguous (neither signal) → TRUE (default trust — never hide a blocker).
 * A downgraded complaint is still EMITTED by complaintsOf and still rides to the
 * repair/regen lane; downgrading changes ONLY whether it blocks the near-bar
 * conversion. Keys (matches===of / anyKeyDefect) and quotes (valid) are wholly
 * independent paths this never touches, and medianComposite ≥ bar is still
 * required — so this can only relax a SUBJECTIVE block, never a structural one.
 */
// ── F-09: harm-SEMANTIC classifier (replaces the two blunt substring nets) ─────
//
// The prior RESERVED_HARM_RX matched bare substrings anywhere in the complaint —
// "answer", "key", "wrong", "missing", "harm", "render", "invalid" — so an
// AESTHETIC complaint that merely used one of those words ("the answer feels
// generic", "distractors are broadly wrong", "creating answer-key tells") was
// classified as reserved harm and blocked a near-bar conversion / burned a regen.
// SUBJECTIVE_ONLY_RX conversely carried "thin"/"filler", so a genuine "filler
// example → unusable" could get DOWNGRADED. Both are wrong on harm-semantics.
//
// The rewrite is table-driven and context-anchored, decided over three signals:
//   1. BLOCK signal — the complaint ASSERTS a reserved-category defect
//      (safety / factual-wrong / fabrication / KEY-or-ANSWER-is-wrong /
//      structural-missing-or-broken / unusable / self-contradiction). Anchored so
//      a "wrong" that describes a DISTRACTOR (correct design) or a "tell" never
//      fires it, and "not a broken key" / "keys are sound" never fires it.
//   2. AESTHETIC signal — quiz-tell / thin-but-usable / taste / density / a
//      key-SOUNDNESS AFFIRMATION.
//   3. Decision: BLOCK wins over AESTHETIC (so "filler … unusable" blocks); a
//      lone AESTHETIC signal downgrades; NEITHER → ambiguous → BLOCK (default
//      trust — the fail-direction is unchanged: never hide a blocker).
// The full labeled corpus that pins this lives in tests/reserved-harm-corpus.test.ts.

type HarmClass = "block" | "downgrade" | "ambiguous";

/** A "wrong / broken / missing key or answer" defect ASSERTED of the key/answer/
 *  item itself (subject-then-defect within a clause), NOT of a distractor. */
const BLOCK_PATTERNS: ReadonlyArray<{ name: string; rx: RegExp }> = [
  // (1) SAFETY
  { name: "unsafe", rx: /\b(?:unsafe|dangerous|hazardous?|reckless|harmful|safety)\b/ },
  { name: "could-harm-reader", rx: /\bcould\b[^.]{0,40}\b(?:hurt|harm|harmed|injure|injur\w*|endanger|damage)\b|\b(?:hurt|harm|injur\w*)\b[^.]{0,30}\breader|\breader\b[^.]{0,30}\b(?:hurt|harm|injur\w*)\b/ },
  // (2) FACTUALLY WRONG / UNTRUE (the FACT/date/number/quote is wrong, not a distractor)
  { name: "factually-wrong", rx: /\bfactual(?:ly)?\b[^.]{0,25}\b(?:wrong|incorrect|false|error|mistaken|inaccurate)\b|\b(?:incorrect|false|inaccurate|untrue|mistaken|wrong)\b[^.]{0,20}\b(?:fact|facts|date|dates|number|numbers|figure|figures|statistic\w*|quote|quotes|claim|claims|attribution)\b|\b(?:fact|facts|date|number|figure|statistic|quote|claim)\b[^.]{0,20}\b(?:is|are|was|were)\b[^.]{0,12}\b(?:wrong|incorrect|false|inaccurate|untrue|mistaken)\b/ },
  { name: "untrue", rx: /\buntrue\b|\bnot true\b|\bis false\b|\bimplies something (?:untrue|false)\b/ },
  { name: "misleading", rx: /\bmislead(?:s|ing)?\b|\bmisattribut\w*|\bmisrepresent\w*/ },
  { name: "fabricated", rx: /\bfabricat\w*|\bmade[- ]?up\b|\bdid not (?:happen|exist|occur)\b|\bnever (?:happened|existed)\b|\bno such (?:study|person|place|event|company|quote|source)\b/ },
  { name: "misname", rx: /\bmisnames?\b|\bmisnamed\b|\bmisidentif\w*|\bmislabel\w*/ },
  // (3) KEY / ANSWER is WRONG (correctness) — anchored subject-then-defect
  { name: "key-defect", rx: /\b(?:key|keys|keyed|answer|answers|correct (?:option|choice|answer)|item|stem)\b[^.]{0,30}\b(?:wrong|incorrect|unsound|invalid|mis-?key\w*|misnames?|mismatch\w*|does not match|doesn't match|not supported|unsupported|no support|two correct|multiple correct|both correct|confusing|contradict\w*)\b/ },
  { name: "wrong-key", rx: /\b(?:wrong|incorrect|unsound|invalid|mis-?keyed)\s+(?:key|keys|keyed|answer|answers)\b|\bkeys?\s+(?:the\s+)?wrong\b|\bwrong\s+(?:choice|option)\s+is\s+keyed\b/ },
  { name: "multiple-correct", rx: /\b(?:two|three|multiple|several|both|more than one)\b[^.]{0,20}\b(?:correct|right|valid)\b[^.]{0,12}\b(?:answer|answers|option|options|choice|choices)\b|\b(?:two|three|multiple|both|several)\b[^.]{0,15}\b(?:choices|options|answers)\b[^.]{0,10}\b(?:are|is)\b[^.]{0,6}\b(?:correct|right|valid)\b|\bno correct (?:answer|option|choice)\b|\bmore than one (?:correct|right)\b/ },
  // (4) STRUCTURAL — a section/quiz missing, duplicated, broken, or non-rendering
  { name: "missing-section", rx: /\b(?:missing|absent|omitted|dropped)\b[^.]{0,20}\b(?:section|summary|summaries|quiz|fast[- ]read|deep[- ]read|full[- ]read|heading|question|answer key|read)\b|\b(?:section|summary|summaries|quiz|heading)\b[^.]{0,15}\b(?:is|are)?\s*(?:missing|absent|omitted|duplicated)\b/ },
  { name: "duplicate", rx: /\bduplicat\w*/ },
  { name: "broken-render", rx: /(?<!not )(?<!not a )\bbroken\b|\bmalformed\b|\bcrash\w*|\bwon't render\b|\bfails? to render\b|\brenders?\b[^.]{0,20}\b(?:wrong|incorrectly|broken|blank)\b/ },
  // (6) UNUSABLE
  { name: "unusable", rx: /\bunusable\b|\bunreadable\b|\billegible\b|\bincoheren\w*|\bnonsense\b|\bcannot (?:learn|apply|use|follow)\b|\bcould not (?:learn|apply|use|follow)\b|\bcan't (?:learn|apply|follow)\b|\bteaches? (?:nothing|no one|nobody)\b|\bteaches? no \b|\bimpossible to (?:follow|apply|learn|use)\b|\bno one could (?:learn|apply|use)\b/ },
  // (4) SOURCE-CONTRADICTORY — contradicts the chapter's OWN material (possessive/
  //     self anchor; a distractor that "contradicts the chapter" is fair design).
  { name: "self-contradiction", rx: /\bcontradicts?\b[^.]{0,35}\b(?:its own|the chapter's own|the chapter's|the source|the prose|earlier|elsewhere|itself|what it (?:says|claims|taught|showed))\b|\b(?:the chapter|the prose|the source|the hook)\b[^.]{0,20}\bcontradict/ },
];

const AESTHETIC_PATTERNS: ReadonlyArray<{ name: string; rx: RegExp }> = [
  // quiz-tell / guessable / too-easy distractor craft (keys are SOUND)
  { name: "quiz-tell", rx: /\btells?\b|\bgiveaway\b|\btelegraph\w*|\bguess(?:able|ed|ing)?\b|\btest[- ]?wise\b|\beasy to (?:guess|reject|eliminate|spot|answer)\b|\btoo (?:easy|obvious|obviously)\b|\bobviously (?:wrong|bad|weak|overbroad)\b|\bby elimination\b|\beliminat\w*|\boverclaim\w*|\boverbroad\b|\boverreach\w*|\bovergeneral\w*|\bcaricatur\w*|\bstraw\b|\babsolut(?:e|ist|es)\b|\bcartoonish\b|\bshortcut\w*/ },
  // thin-but-usable example (real, on-topic, but a slot-filler)
  { name: "thin-usable", rx: /\bthin\b|\bslot[- ]?filler\b|\bfiller\b|\bplaceholder\b|\bmanufactured\b|\bconstructed\b|\binvented (?:name|names|role|roles|people|person|workplace)\b|\binsular\b|\bunresolved\b|\bscene (?:dressing|texture)\b|\bthin[- ]but[- ]usable\b|\busable but\b/ },
  // taste / prose polish / density / beginner-abstraction
  { name: "taste", rx: /\bgeneric\b|\bricher\b|\bcould be richer\b|\bpolish\w*|\bprefer\w*|\bbland\b|\bdry\b|\bpadding\b|\brepetit\w*|\bredundan\w*|\buneven\b|\bmonoton\w*|\brhythm\b|\bpacing\b|\btone\b|\bengag\w*|\bstylish\b|\bstyle\b|\bsmooth\w*|\bflow\b|\bvague\w*|\bunderdefined\b|\babstract\w*|\bfeels?\b|\bscaffold\w*|\btemplate\b|\bslightly\b|\bsomewhat\b|\ba bit\b|\ba little\b|\bweak(?:er|ly|ened|ness)?\b|\blower(?:s|ing)? density\b|\bcold beginner\b|\bmany labels\b|\bcould be\b|\bwould be nicer\b/ },
  // key-SOUNDNESS AFFIRMATION — explicitly says the key/answer is fine
  { name: "key-sound-affirm", rx: /\bkey[- ]?sound\b|\bkeys? (?:are|is) (?:basically |essentially )?sound\b|\bkeyed answer is (?:basically |essentially )?sound\b|\bnot a broken key\b|\bnot broken\b|\bsound key\b|\bstill (?:the )?best answer\b|\bbasically sound\b|\bsound but\b|\bquiz tell\b/ },
];

/** Pure harm classifier over the complaint text. Exported for the corpus test.
 *  BLOCK wins over AESTHETIC; neither → ambiguous (caller defaults to block). */
export function classifyComplaintHarm(text: string): HarmClass {
  const t = (text ?? "").toLowerCase();
  if (BLOCK_PATTERNS.some((p) => p.rx.test(t))) return "block";
  if (AESTHETIC_PATTERNS.some((p) => p.rx.test(t))) return "downgrade";
  return "ambiguous";
}

export function complaintNamesReservedHarm(c: ChapterReviewComplaint): boolean {
  const t = `${c.unit ?? ""} ${c.problem ?? ""}`;
  // ambiguous → DEFAULT TRUST (never hide a blocker); only a clearly-aesthetic
  // complaint with NO block signal is downgraded.
  return classifyComplaintHarm(t) !== "downgrade";
}

/** Actionable complaint lines for a failed review: the reader's explicit
 *  complaints, else quote whys + key disagreements, else a generic line. */
export function complaintsOf(review: ChapterReviewV1): string[] {
  const explicit = (review.complaints ?? [])
    .map((c) => `${c.unit}: ${c.problem}${c.mustFix ? " (must fix)" : ""}`)
    .filter((s) => s.trim().length > 2);
  if (explicit.length > 0) return explicit;
  const fallback = [
    ...(review.quotes ?? []).map((q) => q.why).filter((w) => typeof w === "string" && w.trim().length > 0),
    ...(review.keyCheck?.disagreements ?? []).map((d) => `quiz key disagreement — ${d}`),
  ];
  if (fallback.length > 0) return fallback;
  return [`independent reader refused to ship this chapter (composite ${review.composite}, ship84=${review.ship84}, valid=${review.valid})`];
}

/** An invalid placeholder review for a reader whose output stayed unparseable
 *  after the retry — pass=false so the chapter routes to regeneration. */
function unparseableReview(chapter: ChapterV21, reviewerSessionId: string): ChapterReviewV1 {
  const scores = Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 0])) as Record<ReviewFactor, number>;
  return {
    schemaVersion: CHAPTER_REVIEW_SCHEMA_VERSION,
    chapterId: chapter.chapterId,
    chapterNumber: chapter.number,
    contentHash: chapterContentHash(chapter),
    reviewerSessionId,
    scores,
    composite: 0,
    ship84: false,
    pass: false,
    valid: false,
    keyCheck: { derived: [], matches: 0, of: chapter.quiz?.questions?.length ?? 0, disagreements: [] },
    quotes: [],
    tells: [],
    complaints: [{ unit: "review", problem: "reader session produced no parseable review after a retry", mustFix: true }],
    oneParagraphVerdict: "INVALID: unparseable reader output after retry",
  };
}

/** Map book readers' complaints to sampled chapter numbers (cap 3): key-check
 *  disagreement lines carry "chN Q…"; verdict prose may name "chapter N" /
 *  "chNN". Falls back to the first `cap` sampled chapters carrying the
 *  readers' verdict prose when nothing chapter-specific was named. */
export function mapBookComplaintsToChapters(
  readers: Array<Pick<BookReaderResult, "keyCheck" | "oneParagraphVerdict" | "gateVerdict" | "churn"> & { valid?: boolean }>,
  sampledNumbers: number[],
  cap: number = AUTHOR_BOOK_REGEN_CHAPTER_CAP,
): Map<number, string[]> {
  // Q7 — complaint-targeting guard: only a still-VALID reader (post-Q3 screen)
  // may steer a targeted regen. A disproven structural claim invalidated its
  // reader (adjudicateBookReview), and that reader's complaints must NOT burn an
  // innocent chapter's regen budget (the POM round-1 ch05 waste). A reader
  // missing `valid` (older Pick call sites in tests) is treated as valid.
  const readersValid = readers.filter((r) => r.valid !== false);
  // No valid reader left → no VALID complaint to target; return no targets so the
  // caller halts on "nothing actionable" rather than burning an innocent chapter
  // on a disproven claim (Q7). Quorum (Q4) already blocks accepting such a round.
  if (readersValid.length === 0) return new Map();
  const sampledSet = new Set(sampledNumbers);
  const byChapter = new Map<number, string[]>();
  const add = (n: number, line: string): void => {
    if (!sampledSet.has(n)) return;
    const list = byChapter.get(n) ?? [];
    if (!list.includes(line)) list.push(line);
    byChapter.set(n, list);
  };
  for (const reader of readersValid) {
    for (const line of reader.keyCheck?.disagreements ?? []) {
      const m = line.match(/\bch(?:apter)?\s*0*(\d+)\b/i);
      if (m) add(Number(m[1]), `book reader key check: ${line}`);
    }
    const verdict = reader.oneParagraphVerdict ?? "";
    for (const m of verdict.matchAll(/\bch(?:apter)?\s*0*(\d+)\b/gi)) {
      add(Number(m[1]), `book reader verdict: ${verdict.slice(0, 500)}`);
    }
  }
  if (byChapter.size === 0) {
    const generic = readersValid
      .map((r) => r.oneParagraphVerdict?.trim())
      .filter((v): v is string => !!v && v.length > 0)
      .map((v) => `book reader verdict: ${v.slice(0, 500)}`);
    const lines = generic.length
      ? generic
      : [`book acceptance rejected (gate ${readersValid.map((r) => r.gateVerdict).join("/")}, churn ${readersValid.map((r) => r.churn).join("/")})`];
    for (const n of sampledNumbers.slice(0, cap)) byChapter.set(n, [...lines]);
  }
  // Deterministic cap: keep the lowest-numbered chapters first.
  const capped = [...byChapter.entries()].sort((a, b) => a[0] - b[0]).slice(0, cap);
  return new Map(capped);
}

/** C2/#21: ONLY the complaints that explicitly NAME a chapter ("ch3 Q2…",
 *  "chapter 5's examples…") — no fallback. Used by the churn-driven repair
 *  router so reader-named defects outrank measured-saturation targets. Same
 *  Q7 valid-reader guard as mapBookComplaintsToChapters. */
export function mapNamedBookComplaints(
  readers: Array<Pick<BookReaderResult, "keyCheck" | "oneParagraphVerdict" | "gateVerdict" | "churn"> & { valid?: boolean }>,
  sampledNumbers: number[],
): Map<number, string[]> {
  const readersValid = readers.filter((r) => r.valid !== false);
  const sampledSet = new Set(sampledNumbers);
  const byChapter = new Map<number, string[]>();
  const add = (n: number, line: string): void => {
    if (!sampledSet.has(n)) return;
    const list = byChapter.get(n) ?? [];
    if (!list.includes(line)) list.push(line);
    byChapter.set(n, list);
  };
  for (const reader of readersValid) {
    for (const line of reader.keyCheck?.disagreements ?? []) {
      const m = line.match(/\bch(?:apter)?\s*0*(\d+)\b/i);
      if (m) add(Number(m[1]), `book reader key check: ${line}`);
    }
    const verdict = reader.oneParagraphVerdict ?? "";
    for (const m of verdict.matchAll(/\bch(?:apter)?\s*0*(\d+)\b/gi)) {
      add(Number(m[1]), `book reader verdict: ${verdict.slice(0, 500)}`);
    }
  }
  return byChapter;
}

/** C2/#21: the three divergence assignments dealt (deterministically, by target
 *  index) to churn-round regen writers — three writers handed ONE identical
 *  churn pack converge on identical avoidance moves; distinct lanes prevent
 *  the repaired chapters from matching each other instead of the book. */
export const CHURN_DIVERGENCE_ASSIGNMENTS = [
  "YOUR DIVERGENCE LANE — VOCABULARY: rewrite the teaching through your own cases' concrete referents (names, artifacts, numbers). Respect the framework-vocabulary budget ruthlessly; where the old draft leaned on the framework nouns, this one names the person, the document, the number.",
  "YOUR DIVERGENCE LANE — SCENE ARCHITECTURE: recast your examples into your dealt lenses. No more than ONE person-handling-a-document tableau in the whole chapter — deliberately TIGHTER than your brief's cap of two; this lane overrides the brief on that one number. Lead with ledgers, postmortems, walkthroughs, dialogue, or counterfactual reasoning instead.",
  "YOUR DIVERGENCE LANE — QUIZ SEMANTICS: rebuild every distractor from the packet's commonError material (defensible operational alternatives); kill every tone-giveaway option; every explanation names why the tempting wrong answer fails, in varied phrasing.",
] as const;

// ── One blinded chapter review ───────────────────────────────────────────────

export async function reviewOneChapter(
  bookId: string,
  chapter: ChapterV21,
  deps: AutopilotDeps,
  io: AuthorReviewIo,
  bar: number,
  labelSuffix = "",
  // C3 (#1): tiebreak reads are adjudicated WITHOUT persistence — the deciding
  // read is persisted LAST by the tiebreak composer, so a lone PASS completing
  // after a majority FAIL can never own the latest-pointer or mint a carryable
  // clear. Default true preserves every existing call site.
  persist = true,
): Promise<ChapterReviewV1> {
  const nn = String(chapter.number).padStart(2, "0");
  // docText carries the trailing newline the reader's FILE has (writeReviewDoc
  // adds it centrally) so adjudication + the Q2/Q3 recount see the exact reader
  // bytes; quotes are interior substrings, so byte-verification is unaffected.
  const docText = ensureTrailingNewline(renderChapterReaderDoc(chapter));
  // Q2 (chapter analog): certify the doc BEFORE spawning — a truncated/
  // mis-rendered chapter doc is an infra halt, never a reader verdict.
  assertChapterReaderDocIntegrity(docText, chapter);
  const { relPath } = io.writeReviewDoc(bookId, `ch${nn}.txt`, docText);
  const authorSid = io.authorSessionOf(chapter.chapterId);
  const task = buildReaderReviewTask(relPath, bar);

  let lastSessionId = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    // INDEPENDENCE: a fresh session per read; NEVER the chapter's recorded
    // author session (mirrors the qc reviewers' author≠reviewer invariant).
    let sessionId = deps.mkSessionId(`author-review-ch${nn}${labelSuffix}${attempt > 1 ? "-r2" : ""}`);
    if (authorSid && sessionId === authorSid) sessionId = deps.mkSessionId(`author-review-ch${nn}${labelSuffix}-indep`);
    lastSessionId = sessionId;
    const r = await deps.spawn({
      task,
      sessionId,
      cwd: PIPELINE_DIR,
      sandbox: "read-only",
      skipGitRepoCheck: true,
      reasoningEffort: "high",
    });
    try { deps.logSession(bookId, `author-review-ch${nn}${labelSuffix}`, r); } catch { /* best-effort */ }
    const parsed = parseReaderReview(r.finalMessage) ?? parseReaderReview(r.stdout);
    if (!parsed) {
      deps.log(`[autopilot] author review ch${nn}: attempt ${attempt} unparseable (exit ${r.exitCode})${attempt === 1 ? " — respawning once" : ""}`);
      continue;
    }
    const review = adjudicateReview(parsed, docText, chapter, { bar, reviewerSessionId: sessionId });
    if (review.valid || attempt === 2) {
      if (persist) io.persistReview(bookId, review);
      deps.log(`[autopilot] author review ch${nn}${labelSuffix}: composite ${review.composite} ship=${review.ship84} keys ${review.keyCheck.matches}/${review.keyCheck.of} → ${review.pass ? "PASS" : "FAIL"}${review.valid ? "" : " (INVALID quotes)"}`);
      return review;
    }
    deps.log(`[autopilot] author review ch${nn}${labelSuffix}: attempt ${attempt} failed quote verification — respawning once`);
  }
  const review = unparseableReview(chapter, lastSessionId);
  if (persist) io.persistReview(bookId, review);
  return review;
}

// ── C3: the in-pipeline near-bar tiebreak (the owner-approved ch07 protocol) ──
//
// A single-reader FAIL with the FLIP SIGNATURE — valid, composite ≥ bar, keys
// 9/9, ship=false — is a proven coin-flip surface (POM forensics: 3/12 verdicts
// flipped on byte-identical bytes; this run: ch01/ch03/ch05/ch07). Before any
// regen budget is consumed, spawn TWO more independent readers over the SAME
// bytes; the chapter converts to PASS iff BOTH ship clean (2/3 majority with
// the original FAIL). Strictly MORE scrutiny than the status quo (a regen's
// PASS rests on ONE fresh read; conversion here needs two). A keyCheck
// disagreement is NOT a flip (#2) — a real key defect must regen, not vote.
//
// Persistence discipline (#1): the extra reads never self-persist. On majority-
// SHIP the deciding PASS is persisted LAST (latest-pointer + history + clears);
// on fail-stands the losing PASS is persisted NOWHERE (a persisted PASS at the
// current content hash would mint a carryable clear). The overridden read's
// complaints are preserved in a tiebreak note either way (#4).

export function isFlipSignature(review: ChapterReviewV1, bar: number): boolean {
  return review.valid === true
    && review.pass === false
    && review.ship84 === false
    && review.composite >= bar
    && review.keyCheck.matches === review.keyCheck.of;
}

/** Phase 3 — the GENERALIZED near-bar trigger for the chapter-gate noise
 *  tolerance. A FAIL is "near the bar" (noise, not a settled defect) when it is
 *  valid, has NO key defect (a key mismatch is a deterministic true blocker that
 *  must regen, never vote), and its composite sits within `band` BELOW the bar
 *  OR at/above it. This strictly SUPERSETS isFlipSignature (which is the
 *  composite ≥ bar, ship=false special case): it additionally rescues a chapter
 *  a hair UNDER the bar (e.g. 79.x at bar 80, or the shipped-reader whose
 *  composite fell just short) from a needless regen. A composite far below the
 *  band is a clear FAIL → one read, straight to regen. The DECISION is still
 *  median-of-3 + ship-majority (see tiebreakNearBarVerdict); this predicate only
 *  decides WHO earns the extra reads. band=0 disables it (flip case still fires
 *  via the composite ≥ bar arm). */
export function isNearBar(review: ChapterReviewV1, bar: number, band: number): boolean {
  return review.valid === true
    && review.pass === false
    && review.keyCheck.matches === review.keyCheck.of
    && review.composite >= bar - band;
}

/** F-09 — the SUB-BAND second-opinion trigger. A single FAIL read that is
 *  (a) valid, (b) clean-keyed — a key defect is a deterministic true blocker that
 *  must regen, never vote — (c) sub-band (composite < bar−band, i.e. NOT already
 *  handled by the near-bar tiebreak), and (d) names NO reserved harm across ALL
 *  its complaints, is one reader's TASTE about to burn a lifetime regen write.
 *  Such a chapter earns exactly ONE independent read before the regen is spent
 *  (see subBandSecondOpinion). It is the strict complement of isNearBar on the
 *  clean-keyed valid-FAIL surface: near-bar → 2-read tiebreak; sub-band-clean →
 *  1-read second opinion; a key defect or any reserved-harm complaint → neither,
 *  straight to regen. band=band keeps the two triggers mutually exclusive. */
export function needsSecondOpinion(review: ChapterReviewV1, bar: number, band: number): boolean {
  return review.valid === true
    && review.pass === false
    && review.ship84 === false
    && review.keyCheck.matches === review.keyCheck.of
    && !isNearBar(review, bar, band)                                  // sub-band only
    // Demonstrable TASTE requires an ARTICULATED complaint that is aesthetic: at
    // least one complaint, and none naming reserved harm. An unexplained FAIL (no
    // complaints at all) is NOT "one reader's taste" — it takes the normal regen
    // path unchanged. This also keeps the guard from firing on the empty-complaint
    // FAILs that drive the existing review→book regen-cap flow.
    && review.complaints.length > 0
    && !review.complaints.some((c) => complaintNamesReservedHarm(c)); // no reserved harm
}

async function tiebreakNearBarVerdict(
  bookId: string,
  chapter: ChapterV21,
  original: ChapterReviewV1,
  deps: AutopilotDeps,
  io: AuthorReviewIo,
  bar: number,
): Promise<{ review: ChapterReviewV1; extraComplaints: string[]; upheldReadSets?: string[][]; upheldComposites?: number[] }> {
  const nn = String(chapter.number).padStart(2, "0");
  deps.log(`[autopilot] author review ch${nn}: FAIL is near the bar (composite ${original.composite}, bar ${bar}, keys ${original.keyCheck.matches}/${original.keyCheck.of}, ship=${original.ship84}) — spawning 2 tiebreak readers (median-of-3, no cap consumed)`);
  const extras: ChapterReviewV1[] = [];
  for (const suffix of ["-tiebreak-r2", "-tiebreak-r3"]) {
    extras.push(await reviewOneChapter(bookId, chapter, deps, io, bar, suffix, /* persist */ false));
  }
  // Decide by MEDIAN composite + ship-MAJORITY over the VALID reads (mirrors the
  // book-level multi-read median). True blockers STICK: a key defect on ANY
  // valid read is deterministic (never noise) and blocks conversion; an invalid
  // read is excluded from the vote, and conversion needs a ≥2 valid-read quorum
  // — so the median can never manufacture a PASS from a single lucky read.
  const allReads = [original, ...extras];
  const validReads = allReads.filter((r) => r.valid);
  const anyKeyDefect = validReads.some((r) => r.keyCheck.matches !== r.keyCheck.of);
  const medianComposite = validReads.length > 0 ? trueMedian(validReads.map((r) => r.composite)) : 0;
  const shipCount = validReads.filter((r) => r.ship84).length;
  const shipMajority = shipCount * 2 > validReads.length; // strict majority of the valid reads
  // The directive's pass condition is "median ≥ bar with NO TRUE BLOCKER." The
  // reader's OWN mustFix flag is the true-blocker signal — a manufactured example
  // that fails the learning promise, an unsound key, a missing section all get
  // marked mustFix ("whether you would block shipping on it"). So a chapter that
  // clears the bar with clean keys/quotes and NO mustFix across THREE independent
  // reads has, by the directive's definition, no true blocker — even if the
  // holistic ship84 gestalt stayed false. Convert on ship-majority OR a
  // unanimous no-mustFix; the ship84 boolean alone no longer blocks a ≥bar,
  // blocker-free chapter (that residual brittleness is exactly what the bar drop
  // targeted). ANY mustFix on ANY read keeps the FAIL → true blockers stay strict.
  // A mustFix blocks conversion ONLY if it names a concrete reserved-category
  // harm (complaintNamesReservedHarm — default-trust, so a real blocker is never
  // hidden); a subjective-only mustFix (thin example, weak distractor, polish)
  // is downgraded and cannot block a ≥bar, clean-keyed chapter alone.
  const noMustFix = validReads.length > 0 && validReads.every((r) => !r.complaints.some((c) => c.mustFix && complaintNamesReservedHarm(c)));
  const convertReason = shipMajority ? "ship-majority" : noMustFix ? "no-mustFix (no true blocker)" : "";
  const converted = validReads.length >= 2 && !anyKeyDefect && medianComposite >= bar && (shipMajority || noMustFix);
  const reads = allReads.map((r) => ({
    reviewerSessionId: r.reviewerSessionId, composite: r.composite, ship: r.ship84, valid: r.valid,
  }));
  if (converted) {
    // Prefer a ship+clean read as the persisted decider; fall back to the highest
    // clean-keys read for the no-mustFix path (no reader shipped, but none named a
    // blocker). Force pass=true — the tiebreak is the collective decision that
    // overrides the individual ship gestalt when no true blocker exists.
    const cleanKeyed = (r: ChapterReviewV1) => r.keyCheck.matches === r.keyCheck.of;
    const shipCandidates = validReads.filter((r) => r.ship84 && cleanKeyed(r));
    const pool = shipCandidates.length > 0 ? shipCandidates : validReads.filter(cleanKeyed);
    const base = [...pool].sort((a, b) => b.composite - a.composite)[0];
    const deciding: ChapterReviewV1 = base.pass ? base : { ...base, pass: true };
    // Deciding PASS persists LAST — it owns the latest-pointer and the history
    // slot for this content hash; the clears ledger rebuild sees the PASS.
    io.persistReview(bookId, deciding);
    try {
      appendTiebreakNote(bookId, {
        chapterNumber: chapter.number,
        contentHash: original.contentHash,
        at: new Date().toISOString(),
        outcome: "converted-to-pass",
        overriddenComplaints: complaintsOf(original),
        reads,
      });
    } catch { /* forensic note; never fail a decided review on it */ }
    deps.log(`[autopilot] author review ch${nn}: tiebreak median ${medianComposite} ≥ bar ${bar} via ${convertReason} (ship ${shipCount}/${validReads.length}, reads ${allReads.map((r) => r.composite).join(", ")}) — deciding PASS ${deciding.composite} persisted; original FAIL's complaints preserved in tiebreak notes`);
    return { review: deciding, extraComplaints: [] };
  }
  // Fail stands. Never persist a losing PASS (it would mint a clear at this
  // content hash), and extra FAILs share the one history slot anyway — the
  // original FAIL persists LAST as the canonical latest-pointer, and the extra
  // valid FAILs' complaints ride to the regen via extraComplaints.
  const extraComplaints = extras.filter((r) => r.valid && !r.ship84).flatMap((r) => complaintsOf(r));
  io.persistReview(bookId, original);
  try {
    appendTiebreakNote(bookId, {
      chapterNumber: chapter.number,
      contentHash: original.contentHash,
      at: new Date().toISOString(),
      outcome: "fail-stands",
      overriddenComplaints: extraComplaints,
      reads,
    });
  } catch { /* forensic note */ }
  deps.log(`[autopilot] author review ch${nn}: tiebreak upheld the FAIL (median ${medianComposite}${anyKeyDefect ? " KEY-DEFECT sticks" : ""}, reads ${extras.map((r) => `${r.composite}${r.ship84 ? " ship" : ""}${r.valid ? "" : " invalid"}`).join(", ")}) — regen proceeds with merged complaints`);
  // Repair-lane inputs (plan R1): per-read must-fix sets and composites of the
  // valid reads (`validReads` = [original, ...valid extras]), so the caller can
  // test scope-level complaint convergence.
  return {
    review: original,
    extraComplaints,
    upheldReadSets: validReads.filter((r) => !r.ship84).map((r) => complaintsOf(r)),
    upheldComposites: validReads.map((r) => r.composite),
  };
}

// ── F-09: the SUB-BAND second-opinion guard (bounded, one extra read) ─────────
//
// A sub-band single-read FAIL that names NO reserved harm (needsSecondOpinion)
// is one reader's taste about to consume 1 of the 2 lifetime regen writes. Spawn
// exactly ONE independent read over the SAME bytes; the regen proceeds only if
// that read ALSO fails. If the second read genuinely PASSES (valid, ships, ≥bar,
// clean keys), the better read STANDS — the deciding PASS is persisted LAST
// (owns the latest-pointer / clears, mirroring the tiebreak's persistence
// discipline) and no regen is spent. This is STRICTLY narrower than the near-bar
// tiebreak (one read, not two) and can only ever PREVENT a regen — it never
// manufactures a ship of a chapter with a true blocker, because the guard fires
// only when keys are clean AND no reserved-harm complaint exists.
async function subBandSecondOpinion(
  bookId: string,
  chapter: ChapterV21,
  original: ChapterReviewV1,
  deps: AutopilotDeps,
  io: AuthorReviewIo,
  bar: number,
): Promise<{ review: ChapterReviewV1; extraComplaints: string[] }> {
  const nn = String(chapter.number).padStart(2, "0");
  deps.log(`[autopilot] author review ch${nn}: sub-band taste FAIL (composite ${original.composite}, bar ${bar}, keys ${original.keyCheck.matches}/${original.keyCheck.of}, no reserved-harm complaint) — spawning ONE second-opinion reader before any regen`);
  // The extra read never self-persists; the decider is persisted LAST below.
  const second = await reviewOneChapter(bookId, chapter, deps, io, bar, "-2nd", /* persist */ false);
  const reads = [original, second].map((r) => ({
    reviewerSessionId: r.reviewerSessionId, composite: r.composite, ship: r.ship84, valid: r.valid,
  }));
  // The better read stands ONLY on a genuine independent PASS (valid, ships, ≥bar,
  // clean keys — that is exactly review.pass). Anything else — a second FAIL, a
  // near-bar FAIL, an invalid read — leaves the original FAIL standing and lets
  // the regen proceed with both readers' complaints.
  if (second.valid && second.pass) {
    const deciding: ChapterReviewV1 = second.pass ? second : { ...second, pass: true };
    io.persistReview(bookId, deciding); // deciding PASS persists LAST
    try {
      appendTiebreakNote(bookId, {
        chapterNumber: chapter.number,
        contentHash: original.contentHash,
        at: new Date().toISOString(),
        outcome: "converted-to-pass",
        overriddenComplaints: complaintsOf(original),
        reads,
      });
    } catch { /* forensic note; never fail a decided review on it */ }
    deps.log(`[autopilot] author review ch${nn}: second opinion SHIPPED (${deciding.composite}) — the better read stands, no regen spent; original FAIL's complaints preserved in tiebreak notes`);
    return { review: deciding, extraComplaints: [] };
  }
  // Second read also failed — the FAIL is corroborated; original persists LAST as
  // the canonical latest-pointer and the second read's complaints ride the regen.
  const extraComplaints = second.valid && !second.ship84 ? complaintsOf(second) : [];
  io.persistReview(bookId, original);
  try {
    appendTiebreakNote(bookId, {
      chapterNumber: chapter.number,
      contentHash: original.contentHash,
      at: new Date().toISOString(),
      outcome: "fail-stands",
      overriddenComplaints: extraComplaints,
      reads,
    });
  } catch { /* forensic note */ }
  deps.log(`[autopilot] author review ch${nn}: second opinion also FAILED (${second.composite}${second.valid ? "" : " invalid"}) — regen proceeds with merged complaints`);
  return { review: original, extraComplaints };
}

// ── Book acceptance ───────────────────────────────────────────────────────────

export type BookAcceptanceResult = {
  accepted: boolean;
  verdict: BookVerdict;
  readers: BookReaderResult[];
  readerSessionIds: string[];
  sampledNumbers: number[];
};

/** PREMIUM telemetry target — NOT an accept gate (F-05, 2026-07-08 rename from
 *  the gate-sounding AUTHOR_BOOK_ACCEPT_BAR). The verified accept predicate is
 *  quorum ∧ sticky-gate PASS ∧ median>=AUTHOR_BOOK_ACCEPT_FLOOR(74) ∧
 *  (no shipped control ∨ median>=shipped+BEAT_SHIPPED_MARGIN); this 80 value is
 *  logged and stamped into the acceptance record's `bar` field as an aspirational
 *  reference only, and NOTHING gates on it. See docs/v24/ACCEPTANCE-GATE-POLICY.md
 *  for the standing predicate and the two open owner-decision questions (should
 *  churn ever veto; should fresh books face more than the 74 floor). The name was
 *  changed because the old one implied a gate: the calibration note below records
 *  why 80 corresponds to an owner-84/85 book on this instrument, which is exactly
 *  why it remains a useful telemetry target even though it does not block.
 *
 *  Calibration (retained): the book-level instrument reads ~4-5 points harsher
 *  than the owner's own scores — Phase-0: atomic-habits (owner 85.3, #1 of 131)
 *  scores 80.2; the LIVE shipped POM scores 80.0 with a unanimous correctness-gate
 *  FAIL; no real book has ever scored >=84 on this read. 80 therefore corresponds
 *  to an owner-84/85 book. */
export const AUTHOR_BOOK_PREMIUM_TARGET = 80;

/** Publish calibration (2026-07-04): the ACCEPT floor. 74 sits below the
 *  demonstrated good-book noise band (a 9×85.7-88.9 chapter board read 75.0-78.7
 *  across 5 panels, ±3.7 on identical bytes) and above every correctness-broken
 *  era reading. The 80 bar above remains the premium telemetry target. */
export const AUTHOR_BOOK_ACCEPT_FLOOR = 74;

/** A regen must beat its shipped control by a REAL margin, not by noise. */
export const BEAT_SHIPPED_MARGIN = 5;

export async function runBookAcceptance(
  bookId: string,
  chapters: ChapterV21[],
  deps: AutopilotDeps,
  io: AuthorReviewIo,
  bar: number,
  roundLabel: string,
  // C4: round 2 salts the sample with its raw roundLabel and FORCE-INCLUDES the
  // regen targets, so the re-accept always re-reads the repaired bytes and never
  // re-judges only the identical round-1 four. Round 1 passes nothing — its
  // sample stays byte-identical to the score.py-parity path (and to the
  // shipped-control read, which never salts).
  sampleOpts?: { salt?: string; forceInclude?: number[] },
): Promise<BookAcceptanceResult> {
  // AUTO control-read: resolve the beat-shipped bar BEFORE spawning any reader,
  // so a regen's acceptance is judged against the book it replaces on the same
  // instrument. Env override → that value; a tracked shipped package with no
  // override → the git-pinned 3-reader control read (cached by pin); no shipped
  // package → null (bar-80-only). A required control read that cannot be
  // produced throws ControlReadError → doAuthorReview halts infra (never a silent
  // drop of the beat-shipped protection).
  const beat = await io.resolveBeatShipped(bookId, deps, io);
  if (!beat.ok) throw new ControlReadError(beat.reason);
  const shipped = beat.composite;
  const sampled = selectAcceptanceSample(bookId, chapters, 4, sampleOpts?.salt ?? "", sampleOpts?.forceInclude ?? []);
  const docText = renderBookSampleDoc(sampled);
  // Q2 — doc-integrity postcondition: certify the rendered bytes BEFORE any
  // reader spawns. Per sampled chapter, question-line count === quiz question
  // count === combined-key-row count, and the doc ends with a newline. A
  // mismatch throws DocIntegrityError (caught by doAuthorReview → halt infra),
  // so no reader ever scores a truncated/mis-rendered doc and any later "key
  // omits chapter N Q<k>" claim is provably a reader error (Q3).
  assertBookSampleDocIntegrity(docText, sampled);
  const { relPath } = io.writeReviewDoc(bookId, "book-sample.txt", docText);
  const task = buildBookReviewTask(relPath);

  /** One full independent 3-reader panel over the SAME doc bytes. `panelSuffix`
   *  disambiguates session ids for multi-read panels (-p2, -p3). */
  const spawnPanel = async (panelSuffix: string): Promise<{ readers: BookReaderResult[]; sessionIds: string[] }> => {
    deps.log(`[autopilot] author acceptance${roundLabel}${panelSuffix}: sampled ch ${sampled.map((c) => c.number).join(", ")} → ${docText.length} chars; spawning ${AUTHOR_BOOK_READERS} independent book readers`);
    const sessionIds: string[] = [];
    const readers = await mapPool(
      Array.from({ length: AUTHOR_BOOK_READERS }, (_, i) => i + 1),
      AUTHOR_BOOK_READERS,
      async (readerNo) => {
        let lastSessionId = `author-book-reader-${readerNo}-invalid`;
        for (let attempt = 1; attempt <= 2; attempt++) {
          const sessionId = deps.mkSessionId(`author-book-reader-${readerNo}${roundLabel}${panelSuffix}${attempt > 1 ? "-r2" : ""}`);
          lastSessionId = sessionId;
          const r = await deps.spawn({
            task,
            sessionId,
            cwd: PIPELINE_DIR,
            sandbox: "read-only",
            skipGitRepoCheck: true,
            reasoningEffort: "high",
          });
          try { deps.logSession(bookId, `author-book-reader-${readerNo}${roundLabel}${panelSuffix}`, r); } catch { /* best-effort */ }
          const parsed = parseBookReview(r.finalMessage) ?? parseBookReview(r.stdout);
          if (!parsed) {
            deps.log(`[autopilot] author acceptance${roundLabel}${panelSuffix} r${readerNo}: attempt ${attempt} unparseable (exit ${r.exitCode})`);
            continue;
          }
          const adjudicated = adjudicateBookReview(parsed, docText, sampled, sessionId);
          if (adjudicated.valid || attempt === 2) {
            if (!adjudicated.valid) deps.log(`[autopilot] author acceptance${roundLabel}${panelSuffix} r${readerNo}: INVALID — ${adjudicated.invalidReason}`);
            sessionIds.push(sessionId);
            return adjudicated;
          }
          deps.log(`[autopilot] author acceptance${roundLabel}${panelSuffix} r${readerNo}: attempt ${attempt} failed verification (${adjudicated.invalidReason}) — respawning once`);
        }
        sessionIds.push(lastSessionId);
        return adjudicateBookReview(
          {
            gate_verdict: "FAIL",
            book3_churn: "HIGH",
            quizDerivation: {},
            scores: Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 0])) as Record<ReviewFactor, number>,
            quotes: [],
            oneParagraphVerdict: "INVALID: unparseable after retry",
          },
          docText,
          sampled,
          lastSessionId,
        );
      },
    );
    return { readers, sessionIds };
  };

  // ── Multi-read median (FINAL-HARDENING-PLAN 2026-07-04; replaces the BREAK-2
  //    pooling guard, which a boundedness audit broke two ways: per-label records
  //    OVERWROTE — gate-FAIL stickiness decayed after one re-entry — and the
  //    even-count "median" was the UPPER median, i.e. max(prev,cur) on the typical
  //    two reads, a bias TOWARD acceptance). Semantics now: every quorum-met panel
  //    read of these EXACT bytes is a durable append-only vote; read 1 always runs
  //    on unseen bytes; extra reads run ONLY while the pooled TRUE-median sits
  //    within the noise band of the binding boundary AND the per-doc cap (3) has
  //    room; a gate FAIL on any read sticks for these bytes (never outvoted); at
  //    the cap the pooled decision FREEZES — re-entries reuse it and spawn
  //    NOTHING (the ±3.7 re-roll casino is closed in both directions). ──────────
  const docSha = createHash("sha256").update(docText).digest("hex");
  // F-06 telemetry: deterministic sameness snapshot of the WHOLE book (not the
  // sampled doc) — attribution only, computed once, never feeds the accept
  // predicate and never touches docText/docSha.
  const structuralSameness = structuralSamenessSnapshot(chapters);
  const noiseBand = resolvePanelNoiseBand();
  // The binding composite boundary: the floor, or the shipped control + margin
  // when that is higher. Distance from it decides whether a decision is "clear".
  const binding = shipped === null ? AUTHOR_BOOK_ACCEPT_FLOOR : Math.max(AUTHOR_BOOK_ACCEPT_FLOOR, shipped + BEAT_SHIPPED_MARGIN);

  const pool = io.listAcceptanceReads(bookId, docSha); // durable quorum-met reads of these bytes, oldest first
  const readComposites: number[] = pool.map((r) => r.verdict.medianComposite as number);
  let gateFailStuck = pool.some((r) => r.verdict.gate === "FAIL");
  let totalReads = pool.length;
  let verdict: BookVerdict | null = pool.length > 0 ? pool[pool.length - 1].verdict : null;
  let readers: BookReaderResult[] = pool.length > 0 ? pool[pool.length - 1].readers : [];
  let readerSessionIds: string[] = [];
  // Q4 — valid-count QUORUM (fail-closed): a book is NEVER accepted below full
  // panel. Pooled reads met quorum by construction (listAcceptanceReads filters);
  // a fresh panel below quorum rejects this entry and is never a pooled vote.
  let quorumMet = totalReads > 0;
  let spawnedThisEntry = 0;

  while (true) {
    const pooledNow = readComposites.length > 0 ? trueMedian(readComposites) : null;
    const needRead =
      totalReads === 0 ||
      (!gateFailStuck &&
        pooledNow !== null &&
        Math.abs(pooledNow - binding) <= noiseBand &&
        totalReads < PANEL_READS_PER_DOC_CAP);
    if (!needRead) {
      if (spawnedThisEntry === 0 && totalReads > 0) {
        deps.log(`[autopilot] author acceptance${roundLabel}: REUSING ${totalReads} durable same-doc read(s) (${gateFailStuck ? "gate-FAIL stuck" : totalReads >= PANEL_READS_PER_DOC_CAP ? "panel cap reached — decision FROZEN for these bytes" : "pooled decision clear of the noise band"}) — no panel spawned`);
      }
      break;
    }
    const readNo = totalReads + 1;
    if (readNo > 1) {
      deps.log(`[autopilot] author acceptance${roundLabel}: pooled composite ${pooledNow} is within ±${noiseBand} of the binding boundary ${binding} — spawning independent panel read ${readNo}/${PANEL_READS_PER_DOC_CAP}`);
    }
    const panel = await spawnPanel(readNo > 1 ? `-p${readNo}` : "");
    spawnedThisEntry++;
    verdict = composeBookVerdict(bookId, sampled.map((c) => c.number), panel.readers);
    readers = panel.readers;
    readerSessionIds = panel.sessionIds;
    quorumMet = verdict.validCount >= AUTHOR_BOOK_READERS;
    const comp = verdict.medianComposite ?? 0;
    if (quorumMet) {
      readComposites.push(comp);
      totalReads++;
      if (verdict.gate === "FAIL") gateFailStuck = true;
    }
    // Q6 — durable per-read record over the EXACT bytes scored (append-only).
    // The per-doc read CAP survives re-entry ONLY through these durable records
    // (a fresh entry seeds totalReads from listAcceptanceReads). So a quorum-met
    // read that cannot be persisted must FAIL CLOSED (red-team #1, FINAL-
    // HARDENING-PLAN 2026-07-04): silently continuing would let the next entry
    // re-seed totalReads=0 and re-spawn up to CAP panels, laundering the cap and
    // reopening the ±3.7 re-roll across entries. A quorum-FAILED read is not a
    // vote and never counts toward the cap, so its write failure only warns.
    try {
      const pooledComp = readComposites.length > 0 ? trueMedian(readComposites) : comp;
      const gatePooledNow: "PASS" | "FAIL" = gateFailStuck ? "FAIL" : "PASS";
      const record: AuthorAcceptanceRecord = {
        schemaVersion: "author-acceptance-v1",
        bookId,
        roundLabel,
        at: new Date().toISOString(),
        // Serialized field name `bar` kept stable (persisted record schema); the
        // VALUE is the renamed premium-telemetry target, not a gate.
        bar: AUTHOR_BOOK_PREMIUM_TARGET,
        beatShipped: shipped,
        accepted: quorumMet
          && gatePooledNow === "PASS"
          && pooledComp >= AUTHOR_BOOK_ACCEPT_FLOOR
          && (shipped === null || pooledComp >= shipped + BEAT_SHIPPED_MARGIN),
        sampledChapters: sampled.map((c) => c.number),
        docSha256: docSha,
        verdict,
        readers,
        pooled: {
          reads: totalReads,
          composite: pooledComp,
          gate: gatePooledNow,
          noiseBand,
          capped: totalReads >= PANEL_READS_PER_DOC_CAP,
        },
        structuralSameness,
      };
      const path = io.persistAcceptance(bookId, record);
      deps.log(`[autopilot] author acceptance${roundLabel}: durable read record → ${path}`);
    } catch (err) {
      if (quorumMet) {
        throw new AcceptanceConfigError(
          `could not persist a quorum-met acceptance read for ${bookId}${roundLabel} (${(err as Error).message}) — the per-doc read cap cannot be enforced across re-entries without it; halting rather than re-rolling the panel next entry.`,
        );
      }
      deps.log(`[autopilot] author acceptance${roundLabel}: WARNING durable record write failed for a sub-quorum read (not a vote): ${(err as Error).message}`);
    }
    if (!quorumMet) break; // infra-degraded panel: reject this entry; not a vote
  }

  // Publish calibration (owner decision 2026-07-04, plan docs/v24/
  // PUBLISH-CALIBRATION-PLAN-2026-07-04.md): ACCEPT is multi-signal — the
  // correctness gate stays a HARD blocker (now sticky per docSha across all
  // pooled reads), the TRUE-median pooled composite must clear the absolute
  // FLOOR and beat the shipped control by a real MARGIN. Churn is telemetry +
  // repair routing, never an accept-time veto. AUTHOR_BOOK_PREMIUM_TARGET (80)
  // remains in the record as the premium telemetry target.
  const compPooled = readComposites.length > 0 ? trueMedian(readComposites) : (verdict?.medianComposite ?? 0);
  const gatePooled: "PASS" | "FAIL" = gateFailStuck ? "FAIL" : "PASS";
  const accepted = quorumMet
    && gatePooled === "PASS"
    && compPooled >= AUTHOR_BOOK_ACCEPT_FLOOR
    && (shipped === null || compPooled >= shipped + BEAT_SHIPPED_MARGIN);
  deps.log(`[autopilot] author acceptance${roundLabel}: pooled composite ${compPooled} over ${totalReads} read(s) (band ±${noiseBand}) gate ${gatePooled} churn ${verdict?.churn ?? "?"} valid ${verdict?.validCount ?? 0}/${AUTHOR_BOOK_READERS} vs floor ${AUTHOR_BOOK_ACCEPT_FLOOR}${shipped === null ? "" : ` + beat-shipped ${shipped}+${BEAT_SHIPPED_MARGIN}`} (premium target ${AUTHOR_BOOK_PREMIUM_TARGET}) → ${accepted ? "ACCEPT" : `REJECT${quorumMet ? "" : " (below valid-reader quorum)"}`}`);

  if (!verdict) {
    // Unreachable by construction (read 1 always runs when the pool is empty),
    // but fail closed rather than fabricate a verdict.
    throw new DocIntegrityError(`author acceptance${roundLabel}: no panel verdict and no pooled reads for ${bookId} — refusing to decide`);
  }
  return { accepted, verdict, readers, readerSessionIds, sampledNumbers: sampled.map((c) => c.number) };
}

// ── Acceptance records (what the promote gate reads) ─────────────────────────

/** Write the PUBLISHABLE records promote-book verifies for every chapter: one
 *  qc-attest-v1 attestation (verdict PUBLISHABLE, hashVersion v2 bound to
 *  chapterContentHash, approved codex-qc reviewer role, the chapter reader's
 *  session id, backed by a REAL opened QC round) plus the round's bar-read and
 *  confirm-read artifacts (matching contentHash; confirm decision PUBLISHABLE)
 *  that checkBarConfirmArtifactsForPublishable requires in no-API mode.
 *  The caller opens the round (writers.openRound) so the B5 evidence steps can
 *  share it; returns the roundId used. Exported for tests. */
export function writeAuthorAcceptance(
  bookId: string,
  chapters: ChapterV21[],
  reviews: Map<number, ChapterReviewV1>,
  acceptance: BookAcceptanceResult,
  writers: AcceptanceWriters,
  openedRoundId?: string,
): string {
  const roundId = openedRoundId ?? writers.openRound(bookId).roundId;
  const reviewedAt = new Date().toISOString();
  const barReaderSession = acceptance.readerSessionIds[0] ?? `author-book-reader:${roundId}`;
  for (const chapter of chapters) {
    const review = reviews.get(chapter.number);
    if (!review) throw new Error(`writeAuthorAcceptance: no review for chapter ${chapter.number}`);
    const contentHash = chapterContentHash(chapter);
    const score = Math.max(0, Math.min(1, review.composite / 100));
    const axes: AxisScore[] = (Object.keys(AXIS_WEIGHTS) as AxisId[]).map((axis) => ({
      axis,
      score,
      tier: "PUBLISHABLE",
      hits: [],
    }));
    writers.writeBar({
      schemaVersion: "qc-bar-read-v1",
      bookId,
      roundId,
      role: "bar",
      reviewer: `codex-qc:author-book-reader:${roundId}`,
      reviewerSessionId: barReaderSession,
      chapterNumber: chapter.number,
      chapterId: chapter.chapterId,
      contentHash,
      axes,
      verdict: computeVerdict(chapter.chapterId, axes),
    });
    writers.writeConfirm({
      schemaVersion: "qc-confirm-read-v1",
      bookId,
      roundId,
      role: "confirm",
      reviewer: `codex-qc:author-review:${roundId}`,
      reviewerSessionId: review.reviewerSessionId,
      chapterNumber: chapter.number,
      chapterId: chapter.chapterId,
      contentHash,
      decision: "PUBLISHABLE",
      reason: `v24 author-arch independent reader: composite ${review.composite}, ship=${review.ship84}, keys ${review.keyCheck.matches}/${review.keyCheck.of}`,
      findings: [],
    });
    writers.writeAttestation({
      schemaVersion: "qc-attest-v1",
      bookId,
      chapterNumber: chapter.number,
      chapterId: chapter.chapterId,
      verdict: "PUBLISHABLE",
      contentHash,
      hashVersion: "v2",
      reviewer: `codex-qc:author-review:${roundId}`,
      reviewedAt,
      roundId,
      roundRole: "confirm",
      reviewerSessionId: review.reviewerSessionId,
      dimensions: {
        readerReviewPass: true,
        quoteByteVerified: review.valid,
        keysCorrect: review.keyCheck.matches === review.keyCheck.of,
        bookAcceptance: true,
      },
      findings: [],
      notes:
        `v24 author-arch acceptance: chapter composite ${review.composite} (bar pass), book verdict ` +
        `${acceptance.verdict.medianComposite ?? "n/a"} gate ${acceptance.verdict.gate ?? "?"} churn ${acceptance.verdict.churn} ` +
        `(${acceptance.readers.length} independent book readers).`,
    });
  }
  return roundId;
}

// ── The review phase ──────────────────────────────────────────────────────────

export type AuthorReviewOptions = {
  maxParallel: number;
  bar?: number;
  heartbeat?: () => boolean;
  io?: Partial<AuthorReviewIo>;
};

/** Public entry: run the review phase, converting any DocIntegrityError (Q2 doc
 *  postcondition or a Q3 CONFIRMED structural claim, from either the chapter or
 *  book path) into a fail-closed infra halt — machine truth about a broken doc
 *  must halt the run, never surface as a content verdict or an unhandled throw. */
export async function doAuthorReview(
  bookId: string,
  deps: AutopilotDeps,
  opts: AuthorReviewOptions,
): Promise<AutopilotOutcome | null> {
  try {
    return await doAuthorReviewInner(bookId, deps, opts);
  } catch (err) {
    if (err instanceof DocIntegrityError) return halt(bookId, "infra", `author review: ${err.message}`);
    // A required AUTO control-read that cannot be produced is a fail-closed infra
    // halt — never a silent drop of the beat-shipped protection.
    if (err instanceof ControlReadError) return halt(bookId, "infra", `author acceptance beat-shipped control read: ${err.message}`);
    // Multi-read config: a set-but-invalid noise band halts, never a silent
    // fallback (BREAK-1 lesson).
    if (err instanceof AcceptanceConfigError) return halt(bookId, "infra", `author acceptance multi-read config: ${err.message}`);
    // F6: a rejected repair whose byte restore ALSO failed — disk diverges from
    // the persisted review pointers; halt infra before any further routing.
    if (err instanceof RepairRestoreError) return halt(bookId, "infra", `author review repair lane: ${err.message}`);
    // A regen cap that cannot be honored honestly (unreadable ledger, or a
    // chapter whose design lineage is uncomputable) is an infra halt — never a
    // fail-open cap and never a faked content cap-exhaustion (#8).
    if (err instanceof RegenLedgerError) return halt(bookId, "infra", `author review regen ledger: ${err.message}`);
    throw err;
  }
}

async function doAuthorReviewInner(
  bookId: string,
  deps: AutopilotDeps,
  opts: AuthorReviewOptions,
): Promise<AutopilotOutcome | null> {
  const io = resolveAuthorReviewIo(opts.io);
  const heartbeat = opts.heartbeat ?? (() => true);
  // Phase 2: the chapter soft bar (default AUTHOR_CHAPTER_BAR=80, CHAPTERFLOW_CHAPTER_BAR
  // override). Phase 3: the near-bar noise band that earns bounded extra reads.
  // Both fail closed on a set-but-garbage env (AcceptanceConfigError → infra halt).
  const bar = opts.bar ?? resolveChapterBar();
  const noiseBand = resolveChapterNoiseBand();

  let chapters: ChapterV21[];
  try {
    chapters = [...io.loadChapters(bookId)].sort((a, b) => a.number - b.number);
  } catch (err) {
    return halt(bookId, "infra", `author review: could not load chapters: ${(err as Error).message}`);
  }
  if (chapters.length === 0) return halt(bookId, "infra", `author review: no chapters on disk for ${bookId}`);

  // C1 (#7): stamp any v1 legacy regen counts onto their on-disk design lineages
  // BEFORE any regen decision reads the ledger. Idempotent; throws RegenLedgerError
  // (→ infra halt via the doAuthorReview wrapper) when a legacy count's lineage is
  // uncomputable. The write phase migrates too — first one in wins.
  io.migrateRegenLedger(bookId, deps.log);

  // Reader budgets hold at THIS entry too (live-caught 2026-07-03): a budgets
  // BLOCK halts the write phase, but a re-entry conductor routes gate→qc past
  // the write phase entirely — without this check the flagged bytes would reach
  // reviewers with the block never re-run. Deterministic and instant when clean;
  // on a block it runs the same ONE bounded repair round, then re-checks.
  const budgetOutcome = await ensureReaderBudgetsClean(bookId, deps, io, {
    maxParallel: opts.maxParallel,
    heartbeat,
    haltPhase: "qc",
    label: "author review budgets",
    io: opts.io,
    // CONVERGENCE-SAFE PASS (2026-07-05): pass the live review bar so the budget
    // round is carry-aware — a chapter holding a durable PASS at this bar is never
    // full-re-authored to satisfy a book-wide budget a sibling shifted.
    bar,
  });
  if (budgetOutcome) return budgetOutcome;
  // The repair round may have rewritten chapters — reload so reviews score the
  // repaired bytes (carries for rewritten chapters correctly miss on contentHash).
  try {
    chapters = [...io.loadChapters(bookId)].sort((a, b) => a.number - b.number);
  } catch (err) {
    return halt(bookId, "infra", `author review: could not reload chapters after the budget check: ${(err as Error).message}`);
  }

  // ── F5 (FINAL-HARDENING-PLAN 2026-07-04): dead-end pre-check BEFORE any
  //    reader spawns. The exhaustion halt below (regen budget) used to fire only
  //    AFTER fresh reviews + tiebreaks ran, so every re-entry of a capped-out
  //    book re-burned up to N×2 reads + 2 tiebreak reads on bytes that already
  //    failed — pure noise re-rolls (a FAIL is never carryable by design). A
  //    chapter whose EXACT current bytes hold a persisted FAILing review, with
  //    the regen budget exhausted AND the repair lane spent (or disabled),
  //    cannot progress without a byte change — halt before spending reads. ─────
  {
    const deadEnds: Array<{ n: number; composite: number }> = [];
    for (const chapter of chapters) {
      if (io.regenConsumedFor(bookId, chapter.number) < (AUTHOR_REGEN_CAP - 1)) continue;
      let repairSpent = !reviewRepairEnabled();
      if (!repairSpent) {
        try { repairSpent = io.repairConsumedFor(bookId, chapter.number) >= 1; } catch { repairSpent = true; } // unreadable ledger → fail closed
      }
      if (!repairSpent) continue;
      try {
        const p = reviewHistoryPath(bookId, chapter.number, chapterContentHash(chapter));
        if (!existsSync(p)) continue;
        const rec = JSON.parse(readFileSync(p, "utf8")) as ChapterReviewV1;
        if (rec && rec.valid !== false && rec.pass === false) deadEnds.push({ n: chapter.number, composite: rec.composite ?? 0 });
      } catch { /* unreadable history — a fresh read is legitimate */ }
    }
    if (deadEnds.length > 0) {
      const table = deadEnds.map((d) => `  ch${String(d.n).padStart(2, "0")} — persisted review FAIL (composite ${d.composite}) on the exact current bytes; regen + repair budgets exhausted`).join("\n");
      return halt(bookId, "content", `author review: ${deadEnds.length} chapter(s) are DEAD-ENDED — their current bytes already failed a durable review and every write budget is spent; spawning fresh readers would only re-roll noise (F5):\n${table}`);
    }
  }

  // ── 1. One blinded reader per chapter — UNLESS a durable review can be
  //       CARRIED for the current bytes (E2). A carry hits only when a persisted
  //       PASS+valid review binds to this chapter's CURRENT content AND the exact
  //       reader-doc bytes AND the current bar AND schema/hash versions, with a
  //       reviewer that is not the chapter's current author. A carry spawns
  //       NOTHING; any miss falls through to a fresh independent read. ─────────
  deps.log(`[autopilot] author review: ${chapters.length} chapter(s), one blinded reader each (parallel ≤${opts.maxParallel}, bar ${bar})`);
  const reviews = new Map<number, ChapterReviewV1>();
  let carryHits = 0;
  await mapPool(chapters, opts.maxParallel, async (chapter) => {
    heartbeat();
    const carry = carryReviewFor(bookId, chapter, bar, io.authorSessionOf(chapter.chapterId));
    if (carry.hit) {
      carryHits++;
      deps.noteReviewCarry?.(true); // C5: the cost report's review-carry tally
      const nn = String(chapter.number).padStart(2, "0");
      deps.log(`[autopilot] author review ch${nn}: CARRIED durable review (composite ${carry.review.composite}, reviewer ${carry.review.reviewerSessionId}) — no reader spawned`);
      reviews.set(chapter.number, carry.review);
      return;
    }
    deps.noteReviewCarry?.(false);
    reviews.set(chapter.number, await reviewOneChapter(bookId, chapter, deps, io, bar));
  });
  if (carryHits > 0) deps.log(`[autopilot] author review: carried ${carryHits}/${chapters.length} chapter review(s) unchanged — spawned ${chapters.length - carryHits} fresh reader(s)`);
  if (!heartbeat()) return halt(bookId, "infra", `lost the run lock for ${bookId} during author review — halting to avoid two conductors on the same book.`);

  // ── 2. Regenerate failing chapters WITH the review complaints (cap: the
  //       original + ONE regen = AUTHOR_REGEN_CAP total write attempts). ──────
  // E2 regen-cap PERSISTENCE: the in-memory `regenerated` set is created fresh
  // every conductor entry, so a re-entry used to silently RESET each chapter's
  // regen budget. Load the durable per-chapter consumed-regen ledger and treat a
  // chapter that already consumed AUTHOR_REGEN_CAP-1 regens (across prior entries)
  // as exhausted, so the GLOBAL cap survives re-entry. A carried PASS is not a
  // regen and never touches the ledger.
  const regenExhausted = (n: number): boolean => io.regenConsumedFor(bookId, n) >= (AUTHOR_REGEN_CAP - 1);

  // ── C3: near-bar tiebreak BEFORE any regen decision. A flip-signature FAIL
  //    (valid, composite ≥ bar, keys 9/9, ship=false) gets two more independent
  //    reads; 2/3 SHIP converts it — a ~1-minute answer to a proven coin-flip
  //    surface, instead of a ~14-minute regen + a consumed durable cap. ────────
  const tiebreakExtraComplaints = new Map<number, string[]>();
  const tiebreakReadEvidence = new Map<number, { readSets: string[][]; composites: number[] }>();
  {
    const flips = chapters.filter((chapter) => {
      const r = reviews.get(chapter.number)!;
      return !r.pass && isNearBar(r, bar, noiseBand);
    });
    await mapPool(flips, opts.maxParallel, async (chapter) => {
      heartbeat();
      const outcome = await tiebreakNearBarVerdict(bookId, chapter, reviews.get(chapter.number)!, deps, io, bar);
      reviews.set(chapter.number, outcome.review);
      if (outcome.extraComplaints.length > 0) tiebreakExtraComplaints.set(chapter.number, outcome.extraComplaints);
      if (outcome.upheldReadSets) tiebreakReadEvidence.set(chapter.number, { readSets: outcome.upheldReadSets, composites: outcome.upheldComposites ?? [] });
    });
  }
  if (!heartbeat()) return halt(bookId, "infra", `lost the run lock for ${bookId} during the review tiebreak — halting to avoid two conductors on the same book.`);

  // ── F-09: sub-band second-opinion guard BEFORE any regen. A sub-band, clean-
  //    keyed, reserved-harm-free FAIL (mutually exclusive with the near-bar
  //    tiebreak above) is one reader's taste about to burn a lifetime regen —
  //    give it ONE independent read; regen proceeds only if that read also fails.
  //    Only chapters that could still regen are eligible (an exhausted chapter
  //    halts below regardless, so a read there would be wasted). This runs AFTER
  //    the F5 dead-end pre-check (which halts the whole run before any reader when
  //    a chapter's exact bytes already hold a durable FAIL with budgets spent), so
  //    it can never resurrect a dead-ended chapter. ─────────────────────────────
  {
    const subBand = chapters.filter((chapter) => {
      const r = reviews.get(chapter.number)!;
      return !r.pass && !regenExhausted(chapter.number) && needsSecondOpinion(r, bar, noiseBand);
    });
    await mapPool(subBand, opts.maxParallel, async (chapter) => {
      heartbeat();
      const outcome = await subBandSecondOpinion(bookId, chapter, reviews.get(chapter.number)!, deps, io, bar);
      reviews.set(chapter.number, outcome.review);
      if (outcome.extraComplaints.length > 0) {
        const prev = tiebreakExtraComplaints.get(chapter.number) ?? [];
        tiebreakExtraComplaints.set(chapter.number, [...new Set([...prev, ...outcome.extraComplaints])]);
      }
    });
  }
  if (!heartbeat()) return halt(bookId, "infra", `lost the run lock for ${bookId} during the review second-opinion guard — halting to avoid two conductors on the same book.`);

  const failing = chapters.filter((chapter) => !reviews.get(chapter.number)!.pass);
  const regenerated = new Set<number>(); // chapters that consumed their single regen THIS entry (unioned with the durable ledger for the GLOBAL cap)
  if (failing.length > 0) {
    // A failing chapter that already exhausted its durable regen budget cannot be
    // written again — that is a fail-closed content halt (the cap is global).
    const exhaustedFailing = failing.filter((c) => regenExhausted(c.number));
    if (exhaustedFailing.length > 0) {
      const table = exhaustedFailing
        .sort((a, b) => a.number - b.number)
        .map((c) => `  ch${String(c.number).padStart(2, "0")} — ${complaintsOf(reviews.get(c.number)!).join("; ").slice(0, 400)}`)
        .join("\n");
      return halt(bookId, "content", `author review: ${exhaustedFailing.length} chapter(s) fail independent review and have ALREADY consumed their durable regen budget across prior entries (cap ${AUTHOR_REGEN_CAP} write attempts/chapter, global):\n${table}`);
    }
    deps.log(`[autopilot] author review: ${failing.length} chapter(s) failed independent review — regenerating with complaints (1 regen each; ${AUTHOR_REGEN_CAP} total attempts/chapter, durable ledger loaded)`);
    const stillFailing: Array<{ chapterNumber: number; summary: string }> = [];
    await mapPool(failing, opts.maxParallel, async (chapter) => {
      heartbeat();
      const nn = String(chapter.number).padStart(2, "0");
      // C3 (#4): a tiebreak that UPHELD the fail contributes its corroborating
      // reads' complaints — the regen writer sees every independent objection.
      let complaints = [...new Set([
        ...complaintsOf(reviews.get(chapter.number)!),
        ...(tiebreakExtraComplaints.get(chapter.number) ?? []),
      ])];
      // ── Repair lane (plan docs/v24/REPAIR-LANE-PLAN-2026-07-04.md): when the
      //    upheld tiebreak's must-fixes CONVERGE on field scopes, try ONE
      //    surgical repair before spending the regen. The confirming read is
      //    the normal repair-unaware review of the new content hash; a
      //    withheld confirm falls through to regen with the CONFIRM round's
      //    complaints (hash-scoped — pre-repair complaints about fixed
      //    defects never reach the regen writer). ─────────────────────────────
      const evidence = tiebreakReadEvidence.get(chapter.number);
      // Classify FIRST (pure); consult the durable cap only for eligible
      // chapters, and treat an uncomputable lineage as "lane unavailable" —
      // the regen path owns the infra-halt semantics for that case.
      let repairCapFree = false;
      const cls = reviewRepairEnabled() && evidence ? classifyRepairEligibility(evidence.readSets, evidence.composites) : undefined;
      if (cls?.eligible) {
        try { repairCapFree = io.repairConsumedFor(bookId, chapter.number) === 0; } catch { repairCapFree = false; }
      }
      if (cls && evidence) {
        if (cls.eligible && repairCapFree) {
          deps.log(`[autopilot] author review ch${nn}: repair lane ENGAGED (${cls.reason}) — one surgical repair before any regen`);
          io.recordRepairConsumed(bookId, chapter.number);
          const rep = await doRepairOneChapter(bookId, chapter.number, deps, { io, scopes: cls.scopes, complaints });
          if (rep.ok) {
            const repaired = io.loadChapters(bookId).find((c) => c.number === chapter.number);
            if (repaired) {
              let confirm = await reviewOneChapter(bookId, repaired, deps, io, bar, "-repair");
              if (!confirm.pass && isNearBar(confirm, bar, noiseBand)) {
                const tb = await tiebreakNearBarVerdict(bookId, repaired, confirm, deps, io, bar);
                confirm = tb.review;
                tiebreakExtraComplaints.set(chapter.number, tb.extraComplaints);
              }
              reviews.set(chapter.number, confirm);
              if (confirm.pass) {
                deps.log(`[autopilot] author review ch${nn}: repair CONFIRMED by a fresh read (${confirm.composite}) — no regen spent`);
                return;
              }
              deps.log(`[autopilot] author review ch${nn}: repair confirm withheld (${confirm.composite}) — escalating to regen with the confirm round's complaints`);
              complaints = [...new Set([
                ...complaintsOf(confirm),
                ...(tiebreakExtraComplaints.get(chapter.number) ?? []),
              ])];
            }
          } else {
            if (rep.restoreFailed) {
              // F6: disk holds unreviewed repair bytes and the original could not
              // be restored — routing on as if bytes matched the persisted review
              // would let a regen-exhausted book halt "content" over divergent
              // state. Infra halt; the operator restores from git/state history.
              throw new RepairRestoreError(`ch${nn}: repair rejected (${rep.reason ?? "unknown"}) AND the original bytes could not be restored — disk no longer matches the persisted review; halting before any further routing`);
            }
            deps.log(`[autopilot] author review ch${nn}: repair rejected (${rep.reason ?? "unknown"}) — regen proceeds`);
          }
        } else {
          deps.log(`[autopilot] author review ch${nn}: repair lane not eligible (${cls.reason}) — regen proceeds`);
        }
      }
      if (regenExhausted(chapter.number)) {
        // The repair path consumed wall-clock; re-check the durable budget
        // before spending a regen (another conductor could have moved it).
        stillFailing.push({ chapterNumber: chapter.number, summary: `ch${nn}: regen budget exhausted after repair path` });
        return;
      }
      regenerated.add(chapter.number);
      io.recordRegenConsumed(bookId, chapter.number); // durable: this write attempt counts across re-entries
      const regen = await authorWriteOneChapter(bookId, chapter.number, deps, { complaints, io: opts.io });
      if (!regen.ok) {
        stillFailing.push({ chapterNumber: chapter.number, summary: regen.reason });
        return;
      }
      const fresh = io.loadChapters(bookId).find((c) => c.number === chapter.number);
      if (!fresh) {
        stillFailing.push({ chapterNumber: chapter.number, summary: `ch${nn}: regenerated file missing after write` });
        return;
      }
      let review = await reviewOneChapter(bookId, fresh, deps, io, bar, "-regen");
      // C3 on the post-regen read too: with the cap now consumed, a near-bar
      // flap here would otherwise halt the book on a coin toss (the ch07 scenario).
      if (!review.pass && isNearBar(review, bar, noiseBand)) {
        review = (await tiebreakNearBarVerdict(bookId, fresh, review, deps, io, bar)).review;
      }
      reviews.set(chapter.number, review);
      if (!review.pass) stillFailing.push({ chapterNumber: chapter.number, summary: complaintsOf(review).join("; ").slice(0, 400) });
    });
    if (stillFailing.length > 0) {
      const table = stillFailing
        .sort((a, b) => a.chapterNumber - b.chapterNumber)
        .map((f) => `  ch${String(f.chapterNumber).padStart(2, "0")} — ${f.summary}`)
        .join("\n");
      return halt(bookId, "content", `author review: ${stillFailing.length} chapter(s) still fail independent review after the regen cap (${AUTHOR_REGEN_CAP} write attempts each):\n${table}`);
    }
    chapters = [...io.loadChapters(bookId)].sort((a, b) => a.number - b.number);
  }

  // ── 3. Book acceptance (the author arch's confirming function). ────────────
  //   A DocIntegrityError from the Q2 postcondition or a Q3 CONFIRMED structural
  //   claim is machine truth about a broken doc, never a content verdict — halt
  //   infra so the operator repairs the render, don't spawn/compose readers.
  let acceptance: BookAcceptanceResult;
  try {
    acceptance = await runBookAcceptance(bookId, chapters, deps, io, bar, "");
  } catch (err) {
    if (err instanceof DocIntegrityError) return halt(bookId, "infra", `author acceptance: ${err.message}`);
    throw err;
  }
  if (!acceptance.accepted) {
    // ONE targeted regen round, then re-run acceptance ONCE.
    //
    // C2: when the rejection is CHURN-DRIVEN (book-wide sameness), the old
    // ch-ref router degraded to "first three sampled chapters" and the writers
    // got no cross-chapter evidence — the halted execution run regened ch03 by
    // lowest-number fallback and the composite DROPPED. Churn routing instead:
    // reader-NAMED chapters first, measured saturation contributors fill to the
    // cap, and every target gets the deterministic churn-evidence report + a
    // DISTINCT divergence lane (+ any tiebreak-overridden complaints for that
    // chapter). Non-churn rejections keep the existing complaint mapping.
    const churnDriven = acceptance.verdict.churn === "HIGH";

    // F-04 (Prompt 4): a churn-HIGH rejection tries the BOUNDED, revert-protected,
    // device-verified content-device repair lane BEFORE spending any global regen
    // write. Content-machinery saturation is the measured churn driver; the lane is
    // single-grant-per-lineage (contentRepairConsumed) and shares the CLI verb's
    // core. Chapters it KEEPS (byte-changed + re-reviewed PASS) are the round's
    // action; only chapters it could NOT fix fall through to the (F-03 guarded)
    // regen targeting. Gated by CHAPTERFLOW_CHURN_CONTENT_REPAIR (default ON).
    const contentFixed = new Set<number>();    // kept + authoritative PASS → no regen
    const contentUnfixed = new Set<number>();  // reverted/persisted/skipped-cap/write-failed OR kept-then-FAIL → regen fallthrough
    let contentLaneRan = false;
    if (churnDriven && churnContentRepairEnabled()) {
      const contentResult = await io.contentDeviceRepair(bookId, deps, {
        io: opts.io,
        maxParallel: opts.maxParallel,
        heartbeat,
      });
      contentLaneRan = contentResult.fired;
      if (contentResult.fired) {
        const kept = contentResult.outcomes.filter((o) => o.status === "diversified").map((o) => o.chapterNumber);
        for (const o of contentResult.outcomes) {
          if (o.status !== "diversified") contentUnfixed.add(o.chapterNumber);
        }
        // Refresh the AUTHORITATIVE review for each kept (byte-changed) chapter so the
        // publish attestation + latest-pointer reflect the repaired bytes — exactly as
        // the regen loop does after a kept re-author. The content lane keeps near-bar
        // drafts for the conductor to formalize (its self-check is non-persisting), so
        // a C3 tiebreak formalizes them here. A kept draft the authoritative read still
        // FAILs is never left as a fake success: it falls through to the regen lane, and
        // its fresh failing review now matches the on-disk bytes so the F-03 guard below
        // snapshots a consistent prior.
        for (const n of kept) {
          const fresh = io.loadChapters(bookId).find((c) => c.number === n);
          if (!fresh) { contentUnfixed.add(n); continue; }
          let review = await reviewOneChapter(bookId, fresh, deps, io, bar, "-contentrepair");
          if (!review.pass && isNearBar(review, bar, noiseBand)) {
            review = (await tiebreakNearBarVerdict(bookId, fresh, review, deps, io, bar)).review;
          }
          reviews.set(n, review);
          if (review.pass) contentFixed.add(n);
          else contentUnfixed.add(n);
        }
        chapters = [...io.loadChapters(bookId)].sort((a, b) => a.number - b.number);
        deps.log(`[autopilot] author acceptance: content-device repair lane ran — kept+PASS ${[...contentFixed].map((n) => `ch${String(n).padStart(2, "0")}`).join(", ") || "none"}; unfixed→regen ${[...contentUnfixed].map((n) => `ch${String(n).padStart(2, "0")}`).join(", ") || "none"}.`);
      } else {
        deps.log(`[autopilot] author acceptance: content-device repair lane found no device over the ubiquity cap — falling back to regen routing for the churn rejection.`);
      }
    }

    let allTargets: Map<number, string[]>;
    if (churnDriven) {
      const named = mapNamedBookComplaints(acceptance.readers, acceptance.sampledNumbers);
      const report = buildChurnEvidenceReport(chapters);
      // B19 (live, twice-proven negative): SATURATION-FILL never re-rolls a
      // strong-pass chapter (latest review ships at >= 87) — ch03's 87.5 v4
      // bytes re-rolled to an 0-3 upheld 84.7 and halted the round. Reader-NAMED
      // chapters stay routable at any score (a named defect is evidence; a
      // saturation rank is a coin flip). The honest lever for strong old
      // chapters is an owner-decided refresh round, not churn-routed variance.
      const strongPass = (n: number): boolean => {
        const r = reviews.get(n);
        return !!r && r.pass && r.composite >= 87;
      };
      let targetNums: number[];
      if (contentLaneRan) {
        // F-04: regen ONLY the chapters the content lane could not fix; content-fixed
        // chapters keep their improved bytes and are never re-rolled by the regen lane.
        // The strong-pass guard still applies (never re-roll a >=87 restored baseline).
        targetNums = [...contentUnfixed].filter((n) => !strongPass(n)).sort((a, b) => a - b).slice(0, AUTHOR_BOOK_REGEN_CHAPTER_CAP);
      } else {
        const contributors = rankSaturationContributors(chapters).filter((n) => acceptance.sampledNumbers.includes(n) && !strongPass(n));
        targetNums = [...named.keys()].sort((a, b) => a - b).slice(0, AUTHOR_BOOK_REGEN_CHAPTER_CAP);
        for (const n of contributors) {
          if (targetNums.length >= AUTHOR_BOOK_REGEN_CHAPTER_CAP) break;
          if (!targetNums.includes(n)) targetNums.push(n);
        }
      }
      const verdictLines = acceptance.readers
        .filter((r) => r.valid !== false)
        .map((r) => `book reader verdict: ${(r.oneParagraphVerdict ?? "").slice(0, 350)}`);
      const notes = loadTiebreakNotes(bookId);
      allTargets = new Map(targetNums.map((n, i) => [n, [
        "book acceptance REJECTED with churn HIGH — the book reads as one template stamped repeatedly. Your rewrite must DIVERGE from the book-wide patterns below; improving the chapter in place while keeping the shared machine will fail again.",
        ...(named.get(n) ?? []),
        ...verdictLines,
        ...report,
        CHURN_DIVERGENCE_ASSIGNMENTS[i % CHURN_DIVERGENCE_ASSIGNMENTS.length],
        ...notes
          .filter((t) => t.chapterNumber === n && t.overriddenComplaints.length > 0)
          .flatMap((t) => t.overriddenComplaints.map((c) => `earlier independent-review complaint (tiebreak-preserved): ${c}`)),
      ]]));
      deps.log(`[autopilot] author acceptance: churn-driven repair routing — targets ${targetNums.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")} (named: ${[...named.keys()].join(",") || "none"}; saturation-ranked fill), churn pack ${report.length} measured line(s)`);
    } else {
      allTargets = mapBookComplaintsToChapters(acceptance.readers, acceptance.sampledNumbers);
    }
    // A chapter is skipped when it consumed its regen THIS entry (in-memory set)
    // OR across a prior entry (durable ledger) — the GLOBAL cap survives re-entry.
    const consumedGlobally = (n: number): boolean => regenerated.has(n) || regenExhausted(n);
    const targets = new Map([...allTargets.entries()].filter(([n]) => !consumedGlobally(n)));
    const skipped = [...allTargets.keys()].filter((n) => consumedGlobally(n));
    if (skipped.length > 0) {
      deps.log(`[autopilot] author acceptance: ${skipped.length} target chapter(s) already consumed their regen (${AUTHOR_REGEN_CAP} total write attempts is a GLOBAL cap): ${skipped.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}`);
    }
    if (targets.size === 0) {
      const readerLines = acceptance.readers
        .map((r) => `  reader ${r.reviewerSessionId}: comp=${r.composite} gate=${r.gateVerdict} churn=${r.churn} — ${r.oneParagraphVerdict.slice(0, 300)}`)
        .join("\n");
      if (contentFixed.size > 0) {
        // F-04: the content lane already CHANGED bytes (kept + PASS) and no chapter
        // needs a regen fallthrough — the round HAS its action. Skip the (empty) regen
        // round and re-run acceptance below on the NEW docSha (fresh pool). Do NOT halt.
        deps.log(`[autopilot] author acceptance: content-device repair changed bytes on ${[...contentFixed].map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")} with no regen fallthrough needed — re-running acceptance on the new docSha.`);
      } else if (churnDriven && contentLaneRan) {
        // F-04 (Req 3): churn HIGH and BOTH bounded lanes are spent for every
        // content-repair target — the content lane kept nothing (all reverted /
        // devices-persisted / grant-consumed) AND each such chapter is regen-exhausted
        // (or a protected strong-pass baseline). Halt with the manual escape hatch
        // instead of burning remaining regen writes on unrelated chapters.
        const unfixedList = [...contentUnfixed].sort((a, b) => a - b).map((n) => `ch${String(n).padStart(2, "0")}`).join(", ") || "(none)";
        return halt(bookId, "content",
          `author acceptance REJECTED (churn HIGH) and BOTH bounded repair lanes are spent for every content-repair target:\n` +
          `  content-device lane: kept no chapter (reverted / devices-persisted / grant-consumed) on ${unfixedList}\n` +
          `  global regen lane: exhausted for those chapters (cap ${AUTHOR_REGEN_CAP} write attempts/chapter)\n` +
          `Manual escape hatch — reset a chapter's content-repair grant and force one fresh attempt, then re-run book acceptance:\n` +
          `  content-repair-book ${bookId} --only <ch[,ch...]> [--force]\n` +
          `Readers:\n${readerLines}`);
      } else {
        // Non-churn, kill switch off, or the content lane never fired: unchanged
        // behavior — every targeted chapter has already consumed its regen budget.
        return halt(bookId, "content", `author acceptance REJECTED and every targeted chapter has already consumed its regen budget (cap ${AUTHOR_REGEN_CAP} write attempts/chapter, global across review + acceptance rounds):\n${readerLines}`);
      }
    }
    if (targets.size > 0) {
      deps.log(`[autopilot] author acceptance REJECTED — one targeted regen round over ${targets.size} chapter(s): ${[...targets.keys()].map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}`);
    }
    const regenFailures: string[] = [];
    await mapPool([...targets.entries()], opts.maxParallel, async ([chapterNumber, complaints]) => {
      heartbeat();
      const nn = String(chapterNumber).padStart(2, "0");
      // F-03: this is the churn lane that actually spends the book's regen budget,
      // and it reopens PASSING chapters. Give it the budget lane's protections —
      // snapshot the prior passing bytes + review composite BEFORE reopening, so a
      // regressing regen can NEVER be left on disk. The reopen note fires here
      // (before the spawn) because the INTENT to reopen a passing chapter is the
      // event to attribute — it is recorded even if the write below never spawns.
      const path = chapterFilePath(bookId, chapterNumber);
      const priorBytes = existsSync(path) ? readFileSync(path, "utf8") : null;
      const priorReview = reviews.get(chapterNumber);
      const priorComposite = priorReview?.composite;
      try {
        io.appendReopenNote(bookId, {
          chapterNumber,
          contentHash: priorReview?.contentHash ?? "",
          at: new Date().toISOString(),
          decision: "reopened-for-acceptance",
          trigger: "acceptance-regen",
          detail: complaints.slice(0, 3).join(" | ").slice(0, 400) || undefined,
        });
      } catch { /* forensic note; never fail the regen round on it */ }

      // Restore the prior passing bytes AND re-persist the prior review so the
      // latest-pointer matches the restored content again (the regen's review was
      // persisted over the now-discarded bytes). The prior review is unchanged in
      // the content-keyed history, so carryReviewFor still hits the restored bytes
      // on the next entry — no re-review spawn for bytes we put back. The grant is
      // NOT refunded (consumed at spawn, below): a restore spends the attempt.
      const restore = (logWhy: string, failLine: string): void => {
        if (priorBytes !== null) {
          writeFileSync(path, priorBytes);
          // The discarded regen re-stamped author provenance with its OWN session/hash;
          // roll it back to the restored bytes' true author so the independence gate
          // does not flag the wrong reviewer. Best-effort — never fail a restore on it.
          try {
            const priorChapter = JSON.parse(priorBytes) as ChapterV21;
            restoreAuthorProvenance(authorChapterId(bookId, chapterNumber), chapterContentHash(priorChapter), deps.log);
          } catch { /* unparseable prior bytes / provenance write — non-fatal */ }
        }
        if (priorReview) {
          io.persistReview(bookId, priorReview);
          reviews.set(chapterNumber, priorReview);
        }
        deps.log(`[autopilot] author acceptance ch${nn}: ${logWhy} — restored prior passing bytes.`);
        regenFailures.push(failLine);
      };

      regenerated.add(chapterNumber);
      io.recordRegenConsumed(bookId, chapterNumber); // durable: the acceptance-round regen also counts against the global cap
      const regen = await authorWriteOneChapter(bookId, chapterNumber, deps, { complaints, io: opts.io });
      if (!regen.ok) {
        // Write failure: restore in case a partial/failed write touched the bytes.
        restore(`regen write failed (${regen.reason.slice(0, 160)})`, regen.reason);
        return;
      }
      const fresh = io.loadChapters(bookId).find((c) => c.number === chapterNumber);
      if (!fresh) {
        restore("regenerated file missing after write", `ch${nn}: regenerated file missing after write`);
        return;
      }
      let review = await reviewOneChapter(bookId, fresh, deps, io, bar, "-bookregen");
      // C3 applies here too: this chapter's budget is now consumed — a near-bar
      // flap on this read would otherwise halt the whole book on a coin toss.
      if (!review.pass && isNearBar(review, bar, noiseBand)) {
        review = (await tiebreakNearBarVerdict(bookId, fresh, review, deps, io, bar)).review;
      }
      const outcome = decideAcceptanceRegenOutcome({
        regenOk: true,
        reviewPass: review.pass,
        composite: review.composite,
        priorComposite,
        band: noiseBand,
      });
      if (outcome === "restore-fail") {
        // The regen's review FAILs — a previously-PASSING chapter must not be left
        // FAILING by an acceptance round.
        restore(`regen review FAILed (composite ${review.composite})`, `ch${nn}: ${complaintsOf(review).join("; ").slice(0, 400)}`);
        return;
      }
      if (outcome === "restore-regress") {
        // The regen PASSES but scored materially below the prior review — the
        // complaint was not addressed at equal quality. Count it as a failure for
        // the halt (the rejection stands) rather than shipping a quality slide.
        restore(
          `regressed-quality restored (composite ${review.composite} < prior ${priorComposite ?? "n/a"} − band ${noiseBand})`,
          `ch${nn}: acceptance regen regressed quality (composite ${review.composite} < prior ${priorComposite ?? "n/a"} − band ${noiseBand}); the complaint was not addressed at equal quality`,
        );
        return;
      }
      reviews.set(chapterNumber, review);
    });
    if (regenFailures.length > 0) {
      return halt(bookId, "content", `author acceptance: targeted regen round failed:\n${regenFailures.map((f) => `  ${f}`).join("\n")}`);
    }
    chapters = [...io.loadChapters(bookId)].sort((a, b) => a.number - b.number);
    try {
      // C4: salt = the raw round label; regen targets force-included so the
      // re-accept provably re-reads the repaired bytes (#5/#6).
      acceptance = await runBookAcceptance(bookId, chapters, deps, io, bar, "-round2", {
        salt: "-round2",
        // F-04: force-include BOTH the regen targets and the content-lane-fixed
        // chapters so the re-accept provably re-reads every byte that changed.
        forceInclude: [...new Set([...contentFixed, ...targets.keys()])],
      });
    } catch (err) {
      if (err instanceof DocIntegrityError) return halt(bookId, "infra", `author acceptance (round2): ${err.message}`);
      throw err;
    }
    if (!acceptance.accepted) {
      const readerLines = acceptance.readers
        .map((r) => `  reader ${r.reviewerSessionId}: comp=${r.composite} gate=${r.gateVerdict} churn=${r.churn} valid=${r.valid ? "yes" : `NO (${r.invalidReason})`} — ${r.oneParagraphVerdict.slice(0, 300)}`)
        .join("\n");
      return halt(bookId, "content", `author acceptance still REJECTED after the one targeted regen round (composite ${acceptance.verdict.medianComposite ?? "n/a"}, gate ${acceptance.verdict.gate ?? "?"}, churn ${acceptance.verdict.churn}, floor ${AUTHOR_BOOK_ACCEPT_FLOOR}):\n${readerLines}`);
    }
  }

  // ── 4. Accepted: produce the independent publish evidence (B5), then write
  //       the records the promote gate reads. The evidence steps drive the
  //       REAL key-pack/key-derive/key-resolve and qc-submit/sweep-record
  //       writers against the SAME opened round the attestations cite; a
  //       failure in either is a fail-closed halt, never a skip. ─────────────
  let opened: AuthorEvidenceRound;
  try {
    opened = io.acceptance.openRound(bookId);
  } catch (err) {
    return halt(bookId, "infra", `author acceptance passed but opening the QC round failed: ${(err as Error).message}`);
  }
  const keyEvidence = await io.evidence.runKeyJudge(bookId, chapters, deps, io, opened);
  if (!keyEvidence.ok) {
    return halt(bookId, keyEvidence.category, `author publish evidence (manual key-judge) failed for round ${opened.roundId}: ${keyEvidence.reason}`);
  }
  const sweepEvidence = await io.evidence.runSweep(bookId, chapters, deps, io, opened);
  if (!sweepEvidence.ok) {
    return halt(bookId, sweepEvidence.category, `author publish evidence (sweep) failed for round ${opened.roundId}: ${sweepEvidence.reason}`);
  }
  try {
    const roundId = writeAuthorAcceptance(bookId, chapters, reviews, acceptance, io.acceptance, opened.roundId);
    deps.log(`[autopilot] author acceptance PASSED — key-judge + sweep evidence complete; wrote ${chapters.length} PUBLISHABLE attestation(s) + bar/confirm artifacts (round ${roundId})`);
  } catch (err) {
    return halt(bookId, "infra", `author acceptance passed but the attestation write failed: ${(err as Error).message}`);
  }
  return null;
}
