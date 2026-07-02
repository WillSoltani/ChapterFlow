import { existsSync, mkdirSync, readFileSync, readdirSync } from "fs";
import { dirname, resolve } from "path";

import { runBookGate } from "../../critics/bookGate.js";
import { runShipGate } from "../../critics/finalGate.js";
import { canonicalJsonSha256 } from "../../lib/canonicalJson.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import { checkPlanEnforcement } from "../planEnforcement.js";
import { evaluateDeterministic } from "./deterministicGate.js";
import { checkAuthoringContract } from "../../critics/authoringContract.js";
import { loadChapterSidecar } from "../../critics/sourceGrounding.js";
import { chapterContentHash, isApprovedReviewer, approvedReviewerRoles, isAttestationFresh, loadAttestation } from "../../critics/qcAttestation.js";
import { AXIS_WEIGHTS, combineBarAxes, computeVerdict, type PublishableVerdict } from "../../critics/semantic/publishableBar.js";
import type { ChapterV21 } from "../../types.js";
import { runIntraBookChecks } from "../../critics/intraBook.js";
import { writeBarPack } from "../barReview.js";
import { keyDerivationPath, loadBookChapters, loadKeyPack, loadManualKeyJudge, resolveManualKeyJudges, writeKeyPacks, type KeyDerivation } from "../manualKeyJudge.js";
import { unresolvedMajors } from "../majorDisposition.js";
import { isNoApiCodexQcMode } from "../noApiMode.js";
import { openQcRound, qcRoundPath, verifyQcRoundToken, type QcRoundRole } from "../qcRound.js";
import { checkSourceV2Gate, sourceHashFor } from "../sourceV2Gate.js";
import { carryForwardSweep, loadSweepRecord, sweepCarryable, sweepChapterStatus, writeSweepPack, writeSweepRecordFromSubmission, REQUIRED_SWEEP_FAMILIES } from "../sweep.js";
import { writeReviewPacket } from "./reviewPacket.js";
export { reviewPacketPath } from "./reviewPacket.js";
import { nondistinctiveRepetitionQuote, quoteGroundedInChapter, searchableChapterText } from "./findingValidity.js";
import {
  orchestratorRoundDir,
  confirmCandidatesPath,
  qcSummaryPath,
  repairLedgerPath,
  roundRecordPath,
  submissionsDir,
  taskCardsDir,
  loadBarReadArtifact,
  loadAllBarReads,
  BAR_READ_VARIANTS,
  type BarReadVariant,
  writeBarReadArtifact,
  writeConfirmReadArtifact,
  writeCraftReadArtifact,
} from "./artifacts.js";
import { craftReadMode, CRAFT_AXIS_WEIGHTS } from "../../critics/semantic/craftBar.js";
import { appendStatusEvents, effectiveLedger, effectiveLedgerResilient, ledgerStatusSummary } from "./ledger.js";
import { writeRepairBrief, writeRepairPrompt } from "./repairBrief.js";
import { SUBMISSION_ROLES, validateSubmission, type SubmissionRole, type ValidatedKeyDeriveSubmission, type ValidatedSubmission, type ValidatedSweepSubmission } from "./schemas.js";
import { currentSessionId } from "../sessionProvenance.js";
import { withQcTransaction, QC_SUBMIT_CONTEND_WAIT_MS } from "./transaction.js";
export { finalizeQcRound } from "./finalize.js";

export type QcOrchestratorRoundRecord = {
  schemaVersion: "qc-orchestrator-round-v1";
  bookId: string;
  roundId: string;
  createdAt: string;
  chapters: number[];
  qcRoundFile: string;
  preflight: {
    sourceV2Gate: { passed: boolean; findings: number };
    bookGate: { passed: boolean; findings: number };
    keyPack: { paths: string[]; error?: string };
    sweepPack: { path?: string; error?: string };
    barPack: { packPath?: string; templatePath?: string; errors: string[] };
  };
  taskCards: string[];
  chapterContentHashes?: Record<string, string>;
  /** P2 incremental re-QC (present only on incremental rounds). `chapters` stays
   *  the FULL book (finalize must span it for the cross-chapter sweep);
   *  `reviewChapters` got fresh per-chapter bar/key/confirm cards this round,
   *  `carriedChapters` inherit their last fresh PUBLISHABLE attestation. */
  reviewChapters?: number[];
  carriedChapters?: number[];
  /** WS-1 self-consistency tiebreak (present only when `--tiebreak`). When set, a
   *  chapter whose first bar read lands borderline gets 2 extra independent reads
   *  (t2/t3) and the per-axis MEDIAN decides — variance-smoothing the 84/85 flap. */
  tiebreak?: boolean;
  /** Item-B confirmation over a frozen all-carried book: only the fresh sweep
   *  reviewer is required; per-chapter key/bar/major sessions would be waste. */
  sweepOnlyConfirmation?: boolean;
};

export type OrchestratorResult = {
  ok: boolean;
  roundId: string;
  roundDir: string;
  errors: string[];
  messages: string[];
};

function uniqSorted(nums: number[]): number[] {
  return [...new Set(nums.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
}

export function parseChapterList(raw: string | boolean | undefined): number[] | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return uniqSorted(raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)));
}

function ensureRoundLayout(bookId: string, roundId: string): void {
  mkdirSync(taskCardsDir(bookId, roundId), { recursive: true });
  for (const role of SUBMISSION_ROLES) mkdirSync(submissionsDir(bookId, roundId, role), { recursive: true });
  const ledger = repairLedgerPath(bookId, roundId);
  if (!existsSync(ledger)) writeFileAtomic(ledger, "");
}

function chapterHashRecord(chapters: ChapterV21[]): Record<string, string> {
  return Object.fromEntries(chapters.map((ch) => [String(ch.number), chapterContentHash(ch)]));
}

/** P2 — a chapter is "carryable" in an incremental round when its last
 *  attestation is a PUBLISHABLE on byte-identical content. The attestation (NOT
 *  the round record) is the authority: a forged round can never carry a chapter
 *  no independent reviewer has passed at these exact bytes. */
export function carryableChapter(bookId: string, ch: ChapterV21): boolean {
  const att = loadAttestation(bookId, ch.number);
  return !!att && att.verdict === "PUBLISHABLE" && isAttestationFresh(att, ch);
}

function writeText(path: string, text: string): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileAtomic(path, text);
  return path;
}

function cardHeader(bookId: string, roundId: string, role: string, token: string): string {
  return [
    `# ChapterFlow QC task — ${bookId} ${roundId}`,
    "",
    `Role: ${role}`,
    `Token: ${token}`,
    "",
    "Work from the ChapterFlow pipeline root that contains `src/cli.ts` and `package.json`.",
    "Do not edit chapter files.",
    "",
  ].join("\n");
}

function taskCardPaths(bookId: string, roundId: string, chapters: ChapterV21[], tokens: Record<QcRoundRole, string>, opts: { skipSweep?: boolean; sweepOnly?: boolean } = {}): string[] {
  const root = taskCardsDir(bookId, roundId);
  const paths: string[] = [];
  // When the book is byte-identical to a prior PASS sweep the sweep is carried forward
  // (no card emitted ⇒ the driver, which derives its reviewer set + completion from the
  // cards on disk, never spawns or waits for a sweep session this round).
  if (!opts.skipSweep) paths.push(writeText(resolve(root, "00-sweep.md"), cardHeader(bookId, roundId, "sweep", tokens.sweep) + [
    "Read the sweep pack only for the cross-chapter sweep.",
    "Check all four families: scene_skeleton, persona_drift, repeated_unit, location_stamping. List every family you checked in `checkedFamilies`.",
    "Emit a finding ONLY for a family that ACTUALLY fired. Do NOT add an empty or placeholder finding for a family that is clean.",
    "EVERY finding MUST set `chapters` to the affected chapter numbers (at least one) and quote the shared shell verbatim — a finding with no `chapters` is rejected.",
    "If no family fired, submit verdict PASS with findings: []. Otherwise verdict REVISE (or CORRUPTION) with only the fired-family findings.",
    "Submit `qc-sweep-submission-v1`.",
    `Command: npx tsx src/cli.ts qc-submit ${bookId} --round ${roundId} --role sweep --token ${tokens.sweep} --file <submission.json>`,
    "",
  ].join("\n")));
  if (opts.sweepOnly) return paths;
  for (const role of ["keyA", "keyB"] as const) {
    paths.push(writeText(resolve(root, role === "keyA" ? "01-keyA.md" : "02-keyB.md"), cardHeader(bookId, roundId, role, tokens[role]) + [
      "Read ONLY the blind key packs and their sourceFacts.",
      "Never open `state/chapters` and never inspect stored correctIndex values.",
      "Derive every answer from the stripped prompt/choices plus source facts.",
      "Every answer needs `confidence`, a `reason` of at least 40 characters, and `sourceFactIds`.",
      `Submit \`qc-key-derive-v2\`: npx tsx src/cli.ts qc-submit ${bookId} --round ${roundId} --role ${role} --token ${tokens[role]} --file <submission.json>`,
      "",
    ].join("\n")));
  }
  for (const ch of chapters) {
    paths.push(writeText(resolve(root, "bar", `ch${String(ch.number).padStart(2, "0")}.md`), cardHeader(bookId, roundId, `bar ch${String(ch.number).padStart(2, "0")}`, tokens.bar) + [
      "Read the chapter through the publishable-bar rubric and score every axis.",
      `Required schema: qc-bar-read-v2. Score every non-key publishableBar axis; quiz_key_correctness is injected from manual keyjudge. Required artifact contentHash: ${chapterContentHash(ch)}.`,
      `Submit: npx tsx src/cli.ts qc-submit ${bookId} --round ${roundId} --role bar --token ${tokens.bar} --file <submission.json>`,
      "",
    ].join("\n")));
  }
  paths.push(writeText(resolve(root, "majors.md"), cardHeader(bookId, roundId, "major triage", tokens.major) + [
    "Triage current major findings only. Use the major token for any major-disposition command.",
    "Silent ignores do not count as pass; every current major needs a concrete status: open, waived_false_positive, or waived_accepted_debt.",
    `Submit: npx tsx src/cli.ts qc-submit ${bookId} --round ${roundId} --role major --token ${tokens.major} --file <submission.json>`,
    "",
  ].join("\n")));
  return paths;
}

function confirmTaskCard(bookId: string, roundId: string, chapter: ChapterV21, token = "<confirm-token from REVIEW-PACKET.md>"): string {
  return cardHeader(bookId, roundId, `confirm ch${String(chapter.number).padStart(2, "0")}`, token) + [
    "Confirm this publishable candidate or return REVISE/CORRUPTION with exact findings.",
    "Only use this card if the chapter is listed in confirm-candidates.json.",
    `Required schema: qc-confirm-read-v1. Required artifact contentHash: ${chapterContentHash(chapter)}.`,
    // The plaintext confirm token only survives in REVIEW-PACKET.md (the round persists
    // salted hashes), so a card written at confirm-candidates time cannot embed it —
    // point the operator there, exactly like the bar-tiebreak card does. Without this
    // pointer the emitted command's <confirm-token> fails qc-submit verbatim.
    `Submit (use the round's confirm token from REVIEW-PACKET.md): npx tsx src/cli.ts qc-submit ${bookId} --round ${roundId} --role confirm --token <confirm-token> --file <submission.json>`,
    "",
  ].join("\n");
}

function selectedRoundChapters(bookId: string, roundId: string, chapters?: number[]): ChapterV21[] {
  const all = loadBookChapters(bookId);
  const explicit = chapters?.length ? new Set(chapters) : null;
  if (explicit) return all.filter((ch) => explicit.has(ch.number));
  const round = existsSync(roundRecordPath(bookId, roundId)) ? JSON.parse(readFileSync(roundRecordPath(bookId, roundId), "utf8")) as QcOrchestratorRoundRecord : null;
  const fromRound = Array.isArray(round?.chapters) && round.chapters.length ? new Set(round.chapters.map(Number)) : null;
  return fromRound ? all.filter((ch) => fromRound.has(ch.number)) : all;
}

export function checkRoundFreshness(bookId: string, roundId: string, chapters?: number[]): { fresh: boolean; staleChapters: number[]; missingHashes: boolean } {
  const round = existsSync(roundRecordPath(bookId, roundId)) ? JSON.parse(readFileSync(roundRecordPath(bookId, roundId), "utf8")) as QcOrchestratorRoundRecord : null;
  const selected = selectedRoundChapters(bookId, roundId, chapters);
  const hashes = round?.chapterContentHashes;
  // Fail CLOSED: a round with no recorded creation-time hashes cannot prove its
  // submissions reviewed the content as it is now. (The old behaviour returned
  // fresh:true here, and finalize backfilled CURRENT content as the baseline —
  // which blessed any edit landed between round creation and first finalize.)
  // Treat the whole selected set as stale so the operator starts a fresh round.
  if (!hashes) return { fresh: false, staleChapters: selected.map((ch) => ch.number), missingHashes: true };
  const staleChapters = selected
    // A selected chapter missing from the hash map is also stale, not fresh —
    // no recorded baseline means no proof the review matched current content.
    .filter((ch) => !hashes[String(ch.number)] || hashes[String(ch.number)] !== chapterContentHash(ch))
    .map((ch) => ch.number);
  return { fresh: staleChapters.length === 0, staleChapters, missingHashes: false };
}

export function createQcOrchestrationRound(bookId: string, options: { chapters?: number[]; roundId?: string; allowDirtyPreflight?: boolean; incremental?: boolean; tiebreak?: boolean; noSweepCarry?: boolean } = {}): OrchestratorResult {
  const errors: string[] = [];
  const messages: string[] = [];
  if (!isNoApiCodexQcMode()) {
    return { ok: false, roundId: options.roundId ?? "", roundDir: options.roundId ? orchestratorRoundDir(bookId, options.roundId) : "", errors: ["qc-orchestrate --create requires CHAPTERFLOW_NO_API_CODEX_QC=1."], messages };
  }
  // Deterministic preflight runs BEFORE the round is opened. F6a: these gates were
  // computed but only pushed to `messages` — a source-v2-dirty or book-gate-dirty
  // (even book-gate-BLOCKER) book still opened a round, so reviewers graded content
  // that cannot pass and a finalize could bless book-wide defects. Now they BLOCK:
  // a dirty book never opens a round. (book-gate.passed fails on BLOCKERS; the
  // shadow-major sweep families surface but don't block, per their calibration.)
  const allChapters = loadBookChapters(bookId);
  const only = options.chapters?.length ? new Set(options.chapters) : null;
  const selected = allChapters.filter((ch) => !only || only.has(ch.number));

  const source = checkSourceV2Gate(bookId, selected.map((ch) => ch.number));
  messages.push(`source-v2-gate: ${source.passed ? "PASS" : "BLOCK"} (${source.findings.length} blocker(s))`);
  const bookGate = runBookGate(bookId, allChapters);
  messages.push(`book-gate: ${bookGate.passed ? "PASS" : "BLOCK"} (${bookGate.findings.length} finding(s))`);
  const productionMajors = unresolvedMajors(bookId, selected, true);
  messages.push(`major-status: ${productionMajors.length === 0 ? "PASS" : "BLOCK"} (${productionMajors.length} unresolved major(s))`);
  // `allowDirtyPreflight` is an explicit operator/test override: round-MECHANICS
  // unit tests use minimal synthetic fixtures that intentionally fail book-gate,
  // and an operator may force a diagnostic round. Production entrypoints (qc-auto,
  // qc-orchestrate --create) never set it, so the block is live for real books.
  if (!options.allowDirtyPreflight && (!source.passed || !bookGate.passed || productionMajors.length > 0)) {
    if (!source.passed) errors.push(`source-v2-gate BLOCK (${source.findings.length} blocker(s)) — fix sources before opening a QC round.`);
    if (!bookGate.passed) errors.push(`book-gate BLOCK (${bookGate.findings.filter((f) => f.severity === "blocker").length} blocker(s)) — fix book-wide blockers before opening a QC round.`);
    if (productionMajors.length > 0) {
      const preview = productionMajors.slice(0, 5).map((f) => `${f.scope} ${f.checkId}: ${f.message}`).join("; ");
      errors.push(`major-status BLOCK (${productionMajors.length} unresolved major(s)) — run major-status ${bookId}, fix or round-backed waive the current majors before opening a QC round.${preview ? ` First: ${preview}` : ""}`);
    }
    return { ok: false, roundId: "", roundDir: "", errors, messages };
  }

  // P2 — incremental re-QC (default OFF). Re-review only chapters whose content
  // changed since their last PUBLISHABLE; carry the rest. The book-wide SWEEP
  // still runs over ALL chapters (writeSweepPack loads the whole book), and
  // finalize re-evaluates every cross-chapter signal for carried chapters, so a
  // sibling's repair that introduces a new cross-chapter collision still demotes
  // a carried chapter. Never enabled on an explicit `--chapters` subset.
  const incremental = !!options.incremental && !only;
  const carriedChapters = incremental ? selected.filter((ch) => carryableChapter(bookId, ch)) : [];
  const carriedNumbers = new Set(carriedChapters.map((ch) => ch.number));
  const reviewChapters = incremental ? selected.filter((ch) => !carriedNumbers.has(ch.number)) : selected;
  const sweepOnlyConfirmation = incremental && !!options.noSweepCarry && reviewChapters.length === 0;
  // All per-chapter reviews carry ⇒ normally nothing to re-QC, skip the round. EXCEPT when
  // noSweepCarry is set (the item-B confirming round): the book-wide SWEEP must still run fresh
  // over the frozen book to produce an INDEPENDENT second read, even though no chapter needs a
  // fresh bar/confirm/key. So open the round and let the (un-carried) sweep run.
  if (incremental && reviewChapters.length === 0 && !options.noSweepCarry) {
    return { ok: true, roundId: "", roundDir: "", errors: [], messages: [...messages, `incremental: all ${selected.length} chapters carry a fresh PUBLISHABLE attestation — nothing to re-QC, no round opened.`] };
  }

  let opened: ReturnType<typeof openQcRound>;
  try {
    opened = openQcRound(bookId, options.roundId);
  } catch (err) {
    return { ok: false, roundId: options.roundId ?? "", roundDir: options.roundId ? orchestratorRoundDir(bookId, options.roundId) : "", errors: [(err as Error).message], messages };
  }
  const roundId = opened.record.roundId;
  ensureRoundLayout(bookId, roundId);

  // Content-addressed sweep carry-forward (incremental rounds only — the first/full round
  // always sweeps fresh). When the whole book is byte-identical to a prior PASS sweep, the
  // codex sweep can only re-roll its stochastic verdict, so re-stamp that real PASS onto
  // this round and skip the session. ANY changed/added/removed chapter ⇒ a fresh sweep.
  // `noSweepCarry` forces a FRESH sweep even when carryable — used by the item-B confirming
  // round, which needs a genuinely INDEPENDENT second read (a carry would just copy the prior).
  let priorSweep: ReturnType<typeof loadSweepRecord> = null;
  try {
    priorSweep = loadSweepRecord(bookId);
  } catch (err) {
    errors.push(`sweep-history failed: ${(err as Error).message}`);
  }
  const sweepCarried = incremental && !options.noSweepCarry && sweepCarryable(priorSweep, selected);
  if (sweepCarried && priorSweep) carryForwardSweep(bookId, priorSweep, roundId);

  let keyPackPaths: string[] = [];
  let keyPackError: string | undefined;
  if (sweepOnlyConfirmation) {
    messages.push("key-pack: skipped for sweep-only confirmation round");
  } else {
    try {
      keyPackPaths = writeKeyPacks(bookId, roundId, reviewChapters);
      messages.push(`key-pack: wrote ${keyPackPaths.length} pack(s)`);
    } catch (err) {
      keyPackError = (err as Error).message;
      errors.push(`key-pack failed: ${keyPackError}`);
    }
  }
  let sweepPackPath: string | undefined;
  let sweepPackError: string | undefined;
  if (sweepCarried) {
    messages.push("sweep: carried a prior PASS forward (book byte-identical) — skipping the sweep session");
  } else {
    try {
      sweepPackPath = writeSweepPack(bookId, roundId);
      messages.push(`sweep-pack: wrote ${sweepPackPath}`);
    } catch (err) {
      sweepPackError = (err as Error).message;
      errors.push(`sweep-pack failed: ${sweepPackError}`);
    }
  }
  const barPack = sweepOnlyConfirmation ? { packPath: undefined, templatePath: undefined, errors: [] } : writeBarPack(bookId, roundId);
  if (sweepOnlyConfirmation) {
    messages.push("bar-pack: skipped for sweep-only confirmation round");
  } else if (barPack.errors.length) {
    errors.push(...barPack.errors.map((e) => `bar-pack failed: ${e}`));
  } else {
    messages.push(`bar-pack: wrote ${barPack.packPath}`);
  }
  const cards = taskCardPaths(bookId, roundId, reviewChapters, opened.tokens, { skipSweep: sweepCarried, sweepOnly: sweepOnlyConfirmation });
  // Self-contained reviewer packet (content/rubric pointers + per-role submit
  // commands + invalid-until-filled JSON skeletons). Written here because the
  // plaintext round tokens only exist at creation time.
  let reviewPacket: string | undefined;
  try {
    reviewPacket = writeReviewPacket(bookId, roundId, reviewChapters, opened.tokens);
    messages.push(`review-packet: wrote ${reviewPacket}`);
  } catch (err) {
    errors.push(`review-packet failed: ${(err as Error).message}`);
  }
  const record: QcOrchestratorRoundRecord = {
    schemaVersion: "qc-orchestrator-round-v1",
    bookId,
    roundId,
    createdAt: new Date().toISOString(),
    chapters: selected.map((ch) => ch.number),
    qcRoundFile: qcRoundPath(bookId, roundId),
    preflight: {
      sourceV2Gate: { passed: source.passed, findings: source.findings.length },
      bookGate: { passed: bookGate.passed, findings: bookGate.findings.length },
      keyPack: { paths: keyPackPaths, error: keyPackError },
      sweepPack: { path: sweepPackPath, error: sweepPackError },
      barPack: { packPath: barPack.packPath, templatePath: barPack.templatePath, errors: barPack.errors },
    },
    taskCards: cards,
    chapterContentHashes: chapterHashRecord(selected),
    ...(incremental ? { reviewChapters: reviewChapters.map((ch) => ch.number), carriedChapters: carriedChapters.map((ch) => ch.number) } : {}),
    ...(options.tiebreak ? { tiebreak: true } : {}),
    ...(sweepOnlyConfirmation ? { sweepOnlyConfirmation: true } : {}),
  };
  writeText(roundRecordPath(bookId, roundId), JSON.stringify(record, null, 2) + "\n");
  writeText(qcSummaryPath(bookId, roundId), JSON.stringify({ bookId, roundId, createdAt: record.createdAt, submissions: 0, ledger: {}, attestationsWritten: 0 }, null, 2) + "\n");
  writeRepairBrief(bookId, roundId);
  return { ok: errors.length === 0, roundId, roundDir: orchestratorRoundDir(bookId, roundId), errors, messages };
}

// WS-1 self-consistency tiebreak: bands around the GREEN/YELLOW boundary (85) and the
// 0.6 axis floor where one noisy model sample flips the verdict. A chapter here gets
// extra independent reads combined by per-axis median. A RED (cited corruption) is
// decisive, never borderline.
const BORDERLINE_OVERALL_LO = 83, BORDERLINE_OVERALL_HI = 87;
const BORDERLINE_AXIS_LO = 0.55, BORDERLINE_AXIS_HI = 0.65;

function isBorderlineVerdict(v: PublishableVerdict): boolean {
  if (v.gate === "RED") return false;
  if (v.overall >= BORDERLINE_OVERALL_LO && v.overall < BORDERLINE_OVERALL_HI) return true;
  return v.axes.some((a) => a.score >= BORDERLINE_AXIS_LO && a.score < BORDERLINE_AXIS_HI);
}

/** Emit the bar-tiebreak task cards still missing for a borderline chapter (t2/t3).
 *  `existingReads` includes the primary, so 1 → [t2,t3], 2 → [t3]. */
function emitTiebreakCards(bookId: string, roundId: string, ch: ChapterV21, existingReads: number): string[] {
  const missing = BAR_READ_VARIANTS.slice(Math.max(0, existingReads - 1));
  const nn = String(ch.number).padStart(2, "0");
  return missing.map((v) => writeText(
    resolve(taskCardsDir(bookId, roundId), "bar-tiebreak", `ch${nn}-${v}.md`),
    cardHeader(bookId, roundId, `bar-tiebreak ${v} ch${nn}`, "<bar-token from REVIEW-PACKET.md>") + [
      `TIEBREAK READ (${v}): this chapter's bar read landed borderline (overall 83–87, or an axis near the 0.6 floor).`,
      "Score it INDEPENDENTLY — do NOT read the prior bar submission. The CLI combines all reads of this chapter by per-axis MEDIAN, so one noisy sample cannot flip the verdict (a cited corruption still RED-gates).",
      `Required schema: qc-bar-read-v2. Required artifact contentHash: ${chapterContentHash(ch)}.`,
      `Submit (use the round's bar token from REVIEW-PACKET.md): npx tsx src/cli.ts qc-submit ${bookId} --round ${roundId} --role bar --variant ${v} --token <bar-token> --file <submission.json>`,
      "",
    ].join("\n"),
  ));
}

export function generateConfirmCandidates(bookId: string, roundId: string, options: { chapters?: number[] } = {}): { ok: boolean; path: string; taskCards: string[]; candidates: number[]; skipped: Array<{ chapterNumber: number; blockers: string[] }>; errors: string[] } {
  const errors: string[] = [];
  const chapters = selectedRoundChapters(bookId, roundId, options.chapters);
  const allChapters = loadBookChapters(bookId);
  resolveManualKeyJudges(bookId, roundId, chapters);
  const roundRecord = existsSync(roundRecordPath(bookId, roundId)) ? JSON.parse(readFileSync(roundRecordPath(bookId, roundId), "utf8")) as QcOrchestratorRoundRecord : null;
  const tiebreakOn = roundRecord?.tiebreak === true;
  let sweep: ReturnType<typeof loadSweepRecord> = null;
  try {
    sweep = loadSweepRecord(bookId);
  } catch (err) {
    errors.push(`sweep-history failed: ${(err as Error).message}`);
  }
  // E1: the SIX deterministic gates (source-v2, ship-gate, author-check, intra-book,
  // book-gate, plan-enforcement) come from the SHARED evaluator that finalize + qc-converge
  // use, so a chapter's confirm-candidate eligibility can't DRIFT from finalize's
  // deterministic battery — the plan-enforcement gap this once had (a candidate confirmed
  // then REVISE'd at finalize on a plan it failed) cannot recur. The round-specific SEMANTIC
  // evidence (sweep, manual-key-judge, bar/tiebreak, ledger, majors) is checked per chapter
  // below; evaluateDeterministic does NOT cover those.
  const detReport = evaluateDeterministic(bookId, chapters, allChapters);
  const DET_GATES = ["sourceV2", "shipGate", "authorCheck", "intraBook", "bookGate", "planEnforcement"] as const;
  const majorFindings = unresolvedMajors(bookId, chapters, true);
  const taskCards: string[] = [];
  const candidates: number[] = [];
  const skipped: Array<{ chapterNumber: number; blockers: string[] }> = [];

  for (const ch of chapters) {
    const blockers: string[] = [];
    const contentHash = chapterContentHash(ch);
    const keyJudge = loadManualKeyJudge(bookId, ch.number);
    const bar = loadBarReadArtifact(bookId, roundId, ch.number);
    // WS-1: combine the primary read with any matching tiebreak variants (t2/t3) so the
    // GREEN check uses the variance-smoothed per-axis median, not one noisy sample.
    const barReads = loadAllBarReads(bookId, roundId, ch.number).filter((r) => r.chapterId === ch.chapterId && r.contentHash === chapterContentHash(ch));
    const ledgerFindings = effectiveLedgerResilient(bookId, roundId).filter((f) => {
      if (!(f.status === "open" || f.status === "still_open" || f.status === "needs_qc_rerun")) return false;
      if (f.chapterNumber === undefined && (!f.chapters || f.chapters.length === 0)) return true;
      if (f.chapterNumber === ch.number) return true;
      return (f.chapters ?? []).includes(ch.number);
    });
    const chapterMajorFindings = majorFindings.filter((f) => f.scope === "book" || f.scope.startsWith(`chapter:${ch.number}:`));

    // The six DETERMINISTIC gates, sourced from the shared evaluator (drift-proof; matches
    // finalize by construction). The semantic round-evidence gates follow.
    const det = detReport.perChapter.get(ch.number);
    for (const gate of DET_GATES) if (det && det.checks[gate] !== "PASS") blockers.push(gate);
    if (sweepBlocksConfirm(sweep, ch, contentHash, roundId)) blockers.push("sweep");
    if (!keyJudge || keyJudge.contentHash !== contentHash || keyJudge.sourceHash !== (sourceHashFor(bookId, ch.number) ?? "") || keyJudge.status !== "PASS") blockers.push("manualKeyJudge");
    if (!bar || bar.chapterId !== ch.chapterId || bar.contentHash !== contentHash) {
      blockers.push("barRead");
    } else {
      const verdict = computeVerdict(ch.chapterId, [
        { axis: "quiz_key_correctness", score: 1, tier: "PUBLISHABLE", hits: [] },
        ...combineBarAxes(barReads.map((r) => r.axes)),
      ], true);
      if (tiebreakOn && barReads.length < 3 && isBorderlineVerdict(verdict)) {
        // Borderline → gather extra independent reads before deciding. Emit the missing
        // t2/t3 cards and block this chapter until they're combined (next collect).
        taskCards.push(...emitTiebreakCards(bookId, roundId, ch, barReads.length));
        blockers.push("tiebreak");
      } else if (verdict.gate !== "GREEN") {
        blockers.push("barRead");
      }
    }
    // Mirror finalize's `openSerious` (finalize.ts): only a blocker/major open finding (or a
    // needs_qc_rerun flag) bars a chapter from confirm. Advisory/minor findings are non-blocking
    // by design — finalize publishes a chapter that carries only those (repairLedger=NO_OPEN_BLOCKERS),
    // so withholding its confirm read here strands it in NEEDS_MORE_QC forever (a clean, sweep-passing
    // chapter with one advisory factual-accuracy nit can never certify). Keep this gate consistent
    // with finalize so confirm-eligibility can't be STRICTER than the publish decision it feeds.
    if (ledgerFindings.some((f) => f.status === "needs_qc_rerun" || f.severity === "blocker" || f.severity === "major")) blockers.push("repairLedger");
    if (chapterMajorFindings.length > 0) blockers.push("majors");

    if (blockers.length === 0) {
      candidates.push(ch.number);
      taskCards.push(writeText(resolve(taskCardsDir(bookId, roundId), "confirm", `ch${String(ch.number).padStart(2, "0")}.md`), confirmTaskCard(bookId, roundId, ch)));
    } else {
      skipped.push({ chapterNumber: ch.number, blockers });
    }
  }

  const path = confirmCandidatesPath(bookId, roundId);
  writeText(path, JSON.stringify({ schemaVersion: "qc-confirm-candidates-v1", bookId, roundId, generatedAt: new Date().toISOString(), candidates, taskCards, skipped }, null, 2) + "\n");
  return { ok: errors.length === 0, path, taskCards, candidates, skipped, errors };
}

// INVARIANT: this groundedness re-check (naming/grounded below) must stay byte-for-byte identical
// to finalize.ts's per-chapter override (~494-499 there) and to the ledger's mirror in
// appendFindings (ledger.ts) — all three read the SAME quoteGroundedInChapter/searchableChapterText
// and must reach the SAME PASS/FAIL decision for a given sweep record + chapter, or confirm-eligibility
// drifts from the publish decision it feeds. See tests/qc-finalize-evidence.test.ts "PARAPHRASE: ..."
// for the regression that pins this parity.
//
// KNOWN, ACCEPTED LIMIT: quoteGroundedInChapter is a literal substring check, so it cannot tell a
// FABRICATED sweep quote (the-undoing-project / the-power-of-full-engagement incidents — a stochastic
// cross-chapter sweep invents or over-names a quote that exists in no chapter) apart from a quote that
// describes a REAL defect in the reviewer's own words instead of verbatim. Both are "ungrounded" and
// both clear here. This is intentional: a fabricated finding must not gate the whole book, and the
// sweep is not the only line of defense — a real defect the sweep merely paraphrased still has to
// survive this chapter's OWN independent bar + confirm reads, which see the actual text and can quote
// it verbatim. Tightening this function alone (without an actual ability to distinguish the two cases)
// would only reintroduce the fabrication-blocks-the-book regressions already covered by the "P2 GUARD"
// and "confirm-candidates mirrors finalize" gold tests above — it would not catch a determined
// paraphrase, since the same literal check still can't tell them apart.
function sweepBlocksConfirm(sweep: ReturnType<typeof loadSweepRecord>, ch: ChapterV21, contentHash: string, roundId: string): boolean {
  const status = sweepChapterStatus(sweep, ch.number, contentHash, roundId);
  if (status === "PASS") return false;
  if (status !== "FAIL" || !sweep) return true;
  const naming = (sweep.findings ?? []).filter(
    (f) => f.severity !== "advisory" && !nondistinctiveRepetitionQuote(f) && (f.chapters ?? []).includes(ch.number),
  );
  const grounded = naming.some((f) => quoteGroundedInChapter(f.quote, searchableChapterText(ch)));
  return !(naming.length > 0 && !grounded);
}

function loadJsonFile(path: string): any {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function stripPlaintextSecrets(raw: any): any {
  if (Array.isArray(raw)) return raw.map(stripPlaintextSecrets);
  if (raw && typeof raw === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key.toLowerCase() === "token") continue;
      out[key] = stripPlaintextSecrets(value);
    }
    return out;
  }
  return raw;
}

function safePathComponent(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function submissionContentHash(raw: unknown): string {
  return canonicalJsonSha256(raw).replace(/^sha256:/, "");
}

function submissionIdentity(submission: ValidatedSubmission, variant?: BarReadVariant): string {
  const rec = submission as any;
  const reviewer = typeof rec.reviewer === "string" && rec.reviewer.trim() ? rec.reviewer.trim() : "anonymous";
  const session = typeof rec.reviewerSessionId === "string" && rec.reviewerSessionId.trim() ? rec.reviewerSessionId.trim() : "legacy-unknown";
  const target = rec.role === "bar" || rec.role === "confirm" || rec.role === "craft"
    ? `ch${String(rec.chapterNumber).padStart(2, "0")}${variant ? `-${variant}` : ""}`
    : rec.role;
  return safePathComponent(`${rec.role}.${target}.${reviewer}.${session}`);
}

function findExistingSubmissionForIdentity(dir: string, identity: string): string[] {
  if (!existsSync(dir)) return [];
  const prefix = `${identity}.`;
  return readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json") && !name.endsWith(".meta.json"))
    .sort()
    .map((name) => resolve(dir, name));
}

export function submitQcArtifact(bookId: string, roundId: string, role: SubmissionRole, file: string, token: string, variant?: BarReadVariant): { ok: boolean; path?: string; errors: string[]; messages: string[] } {
  if (!SUBMISSION_ROLES.includes(role)) return { ok: false, errors: [`Unknown role ${role}.`], messages: [] };
  if (!token) return { ok: false, errors: [`qc-submit requires --token for role ${role}.`], messages: [] };
  if (variant && role !== "bar") return { ok: false, errors: [`--variant is only valid for role bar (the self-consistency tiebreak), not ${role}.`], messages: [] };
  if (!verifyQcRoundToken(bookId, roundId, role as QcRoundRole, token)) {
    return { ok: false, errors: [`Invalid ${role} token for ${bookId} round ${roundId}.`], messages: [] };
  }
  return withQcTransaction(bookId, roundId, "submit", () => {
    let raw: any;
    try {
      raw = loadJsonFile(file);
    } catch (err) {
      return { ok: false, errors: [`Could not read submission file: ${(err as Error).message}`], messages: [] };
    }
    // Capture the SUBMITTER's session (CHAPTERFLOW_SESSION_ID) as the authoritative
    // reviewerSessionId — taken from the ENV, never the file (a subagent can't claim
    // whose session produced it). Fresh qc-submit requires it; legacy files remain
    // parseable through collect without satisfying independence certification.
    const reviewerSessionId = currentSessionId();
    if (raw && typeof raw === "object") {
      if (reviewerSessionId) raw.reviewerSessionId = reviewerSessionId;
      else delete raw.reviewerSessionId;
    }
    const validation = validateSubmission(bookId, roundId, role, raw, { requireReviewerSessionId: true });
    if (validation.ok === false) return { ok: false, errors: validation.errors, messages: [] };
    // Reviewer-identity gate at the fresh-ingest door. A submission's reviewer must
    // carry an approved QC role prefix (codex-qc:/claude-qc:/harness:/human:), so a
    // writer can't self-certify under an arbitrary string. Enforced here (not in the
    // schema validator) so re-collecting historical rounds with legacy bare-string
    // reviewers is unaffected. keyA/keyB carry an optional reviewer and are exempt.
    if (role !== "keyA" && role !== "keyB") {
      const reviewer = (validation.submission as { reviewer?: unknown }).reviewer;
      if (typeof reviewer === "string" && !isApprovedReviewer(reviewer)) {
        return { ok: false, errors: [`reviewer "${reviewer}" is not an approved QC role (${approvedReviewerRoles().join(", ")}). Use e.g. "codex-qc:<id>" (set CHAPTERFLOW_QC_REVIEWERS to change allowed roles).`], messages: [] };
      }
    }
    const dir = submissionsDir(bookId, roundId, role);
    mkdirSync(dir, { recursive: true });
    const sanitized = stripPlaintextSecrets(raw);
    const identity = submissionIdentity(validation.submission, variant);
    const contentHash = submissionContentHash(sanitized);
    const dest = resolve(dir, `${identity}.${contentHash}.json`);
    const existing = findExistingSubmissionForIdentity(dir, identity);
    if (existing.length > 0 && !existing.includes(dest)) {
      return {
        ok: false,
        errors: [`Submission identity ${identity} already exists with different content. Start a fresh QC round or use a different reviewer session instead of overwriting evidence.`],
        messages: [],
      };
    }
    const submittedAt = new Date().toISOString();
    if (!existsSync(dest)) {
      writeFileAtomic(dest, JSON.stringify(sanitized, null, 2) + "\n");
      writeFileAtomic(`${dest}.meta.json`, JSON.stringify({
        roleVerified: true,
        verifiedRole: role,
        submittedAt,
        copiedFrom: resolve(file),
        identity,
        contentHash: `sha256:${contentHash}`,
        idempotent: true,
        ...(variant ? { variant } : {}),
      }, null, 2) + "\n");
    }
    const messages = [`submission stored: ${dest}`];
    if (validation.submission.schemaVersion === "qc-bar-read-v1" || validation.submission.schemaVersion === "qc-bar-read-v2") {
      const artifact = writeBarReadArtifact(validation.submission, variant, dest);
      messages.push(`bar-read${variant ? ` (${variant})` : ""} artifact stored: ${artifact}`);
    }
    if (validation.submission.schemaVersion === "qc-confirm-read-v1") {
      const artifact = writeConfirmReadArtifact(validation.submission, dest);
      messages.push(`confirm-read artifact stored: ${artifact}`);
    }
    if (validation.submission.schemaVersion === "qc-craft-read-v1") {
      const artifact = writeCraftReadArtifact(validation.submission, dest);
      messages.push(`craft-read artifact stored: ${artifact}`);
    }
    return { ok: true, path: dest, errors: [], messages };
  }, { contendWaitMs: QC_SUBMIT_CONTEND_WAIT_MS });
}

function submissionFiles(bookId: string, roundId: string): Array<{ role: SubmissionRole; path: string; variant?: BarReadVariant }> {
  const out: Array<{ role: SubmissionRole; path: string; variant?: BarReadVariant }> = [];
  for (const role of SUBMISSION_ROLES) {
    const dir = submissionsDir(bookId, roundId, role);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir)
      .filter((name) => name.endsWith(".json") && !name.endsWith(".meta.json"))
      .sort((a, b) => {
        const av = existsSync(`${resolve(dir, a)}.meta.json`) ? 1 : 0;
        const bv = existsSync(`${resolve(dir, b)}.meta.json`) ? 1 : 0;
        return av - bv || a.localeCompare(b);
      });
    for (const f of files) {
      const p = resolve(dir, f);
      // Skip the derived bar/confirm/craft artifact files (incl. tiebreak variants ch03.bar-read-t2.json) — they are NOT submissions.
      if (/^ch\d+\.bar-read(-t\d+)?\.json$/.test(f) || /^ch\d+\.confirm-read\.json$/.test(f) || /^ch\d+\.craft-read\.json$/.test(f)) continue;
      let variant: BarReadVariant | undefined;
      try {
        const meta = existsSync(`${p}.meta.json`) ? loadJsonFile(`${p}.meta.json`) : null;
        if (meta?.variant === "t2" || meta?.variant === "t3") variant = meta.variant;
      } catch { /* malformed/absent meta → treat as the primary read */ }
      out.push({ role, path: p, variant });
    }
  }
  return out;
}

function writeKeyDerivationFromSubmission(submission: ValidatedKeyDeriveSubmission): string {
  const chapters: KeyDerivation["chapters"] = submission.chapters.map((entry) => {
    const pack = loadKeyPack(submission.bookId, submission.roundId, entry.chapterNumber);
    return {
      chapterNumber: entry.chapterNumber,
      chapterId: entry.chapterId ?? pack?.chapterId ?? `${submission.bookId}-ch${String(entry.chapterNumber).padStart(2, "0")}`,
      packHash: entry.packHash,
      contentHash: entry.contentHash ?? pack?.contentHash ?? "",
      sourceHash: entry.sourceHash ?? pack?.sourceHash ?? "",
      answers: entry.answers,
    };
  });
  const rec: KeyDerivation = {
    schemaVersion: "manual-key-derive-v2",
    bookId: submission.bookId,
    roundId: submission.roundId,
    role: submission.role,
    reviewerSessionId: submission.reviewerSessionId,
    derivedAt: new Date().toISOString(),
    chapters,
  };
  const path = keyDerivationPath(submission.bookId, submission.roundId, submission.role);
  mkdirSync(dirname(path), { recursive: true });
  writeFileAtomic(path, JSON.stringify(rec, null, 2) + "\n");
  return path;
}

export function collectQcRound(bookId: string, roundId: string): { ok: boolean; errors: string[]; summary: Record<string, unknown> } {
  return withQcTransaction(bookId, roundId, "collect", () => {
  const errors: string[] = [];
  let submissions = 0;
  let appended = 0;
  let duplicates = 0;
  let latestSweep: { submission: ValidatedSweepSubmission; path: string } | null = null;
  for (const item of submissionFiles(bookId, roundId)) {
    let raw: any;
    try {
      raw = loadJsonFile(item.path);
    } catch (err) {
      errors.push(`${item.path}: ${(err as Error).message}`);
      continue;
    }
    const validation = validateSubmission(bookId, roundId, item.role, raw);
    if (validation.ok === false) {
      errors.push(`${item.path}: ${validation.errors.join("; ")}`);
      continue;
    }
    submissions++;
    if (validation.submission.schemaVersion === "qc-bar-read-v1" || validation.submission.schemaVersion === "qc-bar-read-v2") writeBarReadArtifact(validation.submission, item.variant, item.path);
    if (validation.submission.schemaVersion === "qc-confirm-read-v1") writeConfirmReadArtifact(validation.submission, item.path);
    if (validation.submission.schemaVersion === "qc-craft-read-v1") writeCraftReadArtifact(validation.submission, item.path);
    if (validation.submission.schemaVersion === "qc-key-derive-v2") writeKeyDerivationFromSubmission(validation.submission);
    if (validation.submission.schemaVersion === "qc-sweep-submission-v1") latestSweep = { submission: validation.submission as ValidatedSweepSubmission, path: item.path };
  }
  // Write the durable sweep record from the newest valid sweep submission (submissionFiles
  // is oldest→newest, so the last one wins — matching finalize's latestValidSubmission).
  // collect runs BEFORE generateConfirmCandidates, which reads loadSweepRecord; without this
  // the first candidate pass sees no fresh record and falsely blocks every chapter on "sweep".
  if (latestSweep) {
    try {
      writeSweepRecordFromSubmission(latestSweep.submission, latestSweep.path);
    } catch (err) {
      errors.push(`sweep-record failed: ${(err as Error).message}`);
    }
  }
  const briefPath = writeRepairBrief(bookId, roundId);
  const promptPath = writeRepairPrompt(bookId, roundId);
  const summary = {
    bookId,
    roundId,
    collectedAt: new Date().toISOString(),
    submissions,
    ledger: ledgerStatusSummary(bookId, roundId),
    findingsAppended: appended,
    duplicateSources: duplicates,
    attestationsWritten: 0,
    repairBrief: briefPath,
    repairPrompt: promptPath,
    errors,
  };
  writeText(qcSummaryPath(bookId, roundId), JSON.stringify(summary, null, 2) + "\n");
  return { ok: errors.length === 0, errors, summary };
  });
}

// A "semantic" finding is one a clean deterministic re-gate CANNOT prove fixed
// (publishable-bar axes, the cross-chapter sweep families, the manual key
// judge). verifyRepair must NOT stale these on a cosmetic edit — they require a
// fresh QC round. The classification keys on the finding's own repairClass AND
// globalTheme (a known semantic theme), not just its source role: the finalizer
// re-injects sweep/axis findings with sourceRole "finalizer" (not "sweep"/"bar"),
// so a role-only check would mislabel them deterministic and let a byte-change
// clear a real templating/wrong-key defect. We do NOT treat an arbitrary
// non-empty globalTheme as semantic (deterministic finalizer themes like
// "book_gate"/"intra_book"/"source_v2" must still go stale_after_repair on a
// clean re-gate).
const SEMANTIC_THEMES: ReadonlySet<string> = new Set<string>([
  ...Object.keys(AXIS_WEIGHTS),
  ...Object.keys(CRAFT_AXIS_WEIGHTS),
  ...REQUIRED_SWEEP_FAMILIES,
  "manual_keyjudge",
  "confirm",
  "confirm_read",
]);

export function isSemanticFinding(sourceRoles: string[], repairClass: string, globalTheme?: string): boolean {
  if (SEMANTIC_THEMES.has(repairClass)) return true;
  if (globalTheme && SEMANTIC_THEMES.has(globalTheme)) return true;
  return sourceRoles.some((role) => role === "bar" || role === "confirm" || role === "keyA" || role === "keyB" || role === "sweep");
}

export function verifyRepair(bookId: string, roundId: string): { ok: boolean; summary: Record<string, unknown>; errors: string[] } {
  return withQcTransaction(bookId, roundId, "verify-repair", () => {
  const findings = effectiveLedgerResilient(bookId, roundId);
  const chapters = loadBookChapters(bookId);
  const byNumber = new Map(chapters.map((ch) => [ch.number, ch]));
  const edited = new Set<number>();
  const updates: Array<{ findingId: string; status: "stale_after_repair" | "still_open" | "needs_qc_rerun"; reason: string; validation?: Record<string, unknown> }> = [];
  for (const f of findings) {
    if (f.chapterNumber === undefined || !f.contentHashAtFinding) {
      updates.push({ findingId: f.findingId, status: "still_open", reason: "book-wide finding cannot be verified by a single chapter content hash" });
      continue;
    }
    const ch = byNumber.get(f.chapterNumber);
    if (!ch) {
      updates.push({ findingId: f.findingId, status: "still_open", reason: `chapter ${f.chapterNumber} is missing` });
      continue;
    }
    const now = chapterContentHash(ch);
    if (now === f.contentHashAtFinding) {
      updates.push({ findingId: f.findingId, status: "still_open", reason: "chapter content hash has not changed since the finding was recorded", validation: { contentHash: now } });
      continue;
    }
    edited.add(f.chapterNumber);
  }

  // SP plan-conformance over the whole book (exemplar ownership is cross-chapter);
  // a repair that silently changed a dealt scene shape or used a forbidden exemplar
  // is caught HERE, in the repair loop, before the round re-QCs — not deferred to publish.
  const planFindings = checkPlanEnforcement(bookId, chapters);
  const validationByChapter = new Map<number, { authorFindings: number; gateBlockers: number; intraBlockers: number; planBlockers: number }>();
  for (const n of edited) {
    const ch = byNumber.get(n);
    if (!ch) continue;
    const authorFindings = checkAuthoringContract(ch, { sidecar: loadChapterSidecar(ch.chapterId), filePath: `state/chapters/${ch.chapterId}.v21-native.chapter.json` }).length;
    const gate = runShipGate(ch);
    const intra = runIntraBookChecks(ch, chapters.filter((other) => other.number < ch.number));
    const planBlockers = planFindings.filter((f) => f.chapterNumber === n).length;
    validationByChapter.set(n, { authorFindings, gateBlockers: gate.blockers.length, intraBlockers: intra.filter((f) => f.severity === "blocker").length, planBlockers });
  }
  const bookGate = runBookGate(bookId, chapters);
  const bookBlockers = bookGate.findings.filter((f) => f.severity === "blocker").length;

  for (const f of findings) {
    if (updates.some((u) => u.findingId === f.findingId)) continue;
    const validation = f.chapterNumber !== undefined ? validationByChapter.get(f.chapterNumber) : undefined;
    const validationClean = !!validation && validation.authorFindings === 0 && validation.gateBlockers === 0 && validation.intraBlockers === 0 && validation.planBlockers === 0 && bookBlockers === 0;
    if (!validationClean) {
      updates.push({ findingId: f.findingId, status: "still_open", reason: "chapter changed but validation commands still report blockers/findings", validation: { ...validation, bookBlockers } });
      continue;
    }
    const semantic = isSemanticFinding(f.sources.map((s) => s.sourceRole), f.repairClass, f.globalTheme);
    updates.push({
      findingId: f.findingId,
      status: semantic ? "needs_qc_rerun" : "stale_after_repair",
      reason: semantic
        ? "chapter changed and gates pass, but semantic findings require a fresh QC round before publishability can be certified"
        : "chapter changed and deterministic validation is clean; old finding is stale after repair",
      validation: { ...validation, bookBlockers },
    });
  }
  const wrote = appendStatusEvents(bookId, roundId, updates);
  const briefPath = writeRepairBrief(bookId, roundId);
  const summary = {
    bookId,
    roundId,
    verifiedAt: new Date().toISOString(),
    findingsChecked: findings.length,
    editedChapters: [...edited].sort((a, b) => a - b),
    statusUpdatesWritten: wrote,
    ledger: ledgerStatusSummary(bookId, roundId),
    validation: { byChapter: Object.fromEntries(validationByChapter), bookBlockers },
    repairBrief: briefPath,
  };
  writeText(qcSummaryPath(bookId, roundId), JSON.stringify(summary, null, 2) + "\n");
  return { ok: true, summary, errors: [] };
  });
}

export function renderRepair(bookId: string, roundId: string): string {
  return writeRepairBrief(bookId, roundId);
}

export function ledgerStatus(bookId: string, roundId: string): { summary: Record<string, number>; findings: ReturnType<typeof effectiveLedger> } {
  return { summary: ledgerStatusSummary(bookId, roundId), findings: effectiveLedgerResilient(bookId, roundId) };
}
