/**
 * authorEvidence — B5: the v24 author architecture's PUBLISH-EVIDENCE step.
 *
 * promote-book force-sets CHAPTERFLOW_NO_API_CODEX_QC=1, and in that mode it
 * ADDITIONALLY enforces two record families that only the legacy/compiler QC
 * round machinery used to produce (the B4 KNOWN LIMITATION):
 *
 *   (a) checkManualKeyJudge (src/qc/manualKeyJudge.ts) — a per-chapter
 *       manual-keyjudge record resolved from TWO independent blind key
 *       derivations (round roles keyA/keyB), each validated against the
 *       round's blind key packs; and
 *   (b) checkSweep (src/qc/sweep.ts) — a book-level sweep attestation backed
 *       by roles.sweep on a real QC round.
 *
 * This module produces those records for an author-arch book as REAL
 * INDEPENDENT EVIDENCE — never synthetic lookalikes:
 *
 *   - every record is written THROUGH the existing writer functions the QC
 *     verbs drive (key-pack → writeKeyPacks; key-derive →
 *     validateAndWriteKeyDerivation; key-resolve → resolveManualKeyJudges;
 *     sweep → submitQcArtifact + writeSweepRecordFromSubmission, the exact
 *     qc-submit/collect path), so the bytes are the same bytes a legacy QC
 *     round writes and the untouchable check code validates them unchanged;
 *   - every derivation/attestation is backed by an actual reader SESSION that
 *     actually performed the function: two blind KEY READERS independently
 *     derive every chapter's quiz keys from the BLINDED chapter docs
 *     (renderChapterReaderDoc with the ANSWER KEY section and the
 *     per-question Explanation lines stripped — the same blinding the key
 *     packs apply: prompt + choices only), and one independent SWEEP READER
 *     reads the whole-book sweep pack against the canonical family rubric
 *     (renderSweepFamilyRubric — the ONE spec the formal sweep speaks);
 *   - session independence is enforced FAIL-CLOSED here: an evidence session
 *     matching a chapter's author session, or keyA colliding with keyB,
 *     halts the step. This does NOT rely on the env-gated sessionsCollide
 *     opt-in — the author arch refuses non-independent evidence regardless.
 *
 * Both steps are resumable/idempotent: the promote predicates themselves
 * (checkManualKeyJudge / checkSweep) decide "already satisfied", so a re-run
 * over unchanged content spawns nothing and writes no duplicate records.
 *
 * Cost shape (kept lean by design): 2 key readers + 1 sweep reader per BOOK.
 * Key derivations are BOOK-level records covering every chapter (the
 * granularity manualKeyJudge validates: one keyA/keyB answers file per
 * round), and the sweep is one whole-book read. checkSweep — the promote
 * predicate — needs ONE roles.sweep-backed, non-blocking attestation over the
 * current bytes; the two-independent-read bar (sweepTwoRoundConfirmed) is the
 * legacy/compiler AUTO-PUBLISH confirmation, which the author arch replaces
 * with its two-reader book acceptance (autopilot.ts substitutes acceptance
 * for deps.sweepConfirmed on the author branch), so one honest sweep read is
 * the correct evidence quantum here.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import type { AutopilotDeps } from "./autopilot.js";
import type { AuthorReviewIo } from "./authorReview.js";
import type { ChapterV21 } from "../types.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import {
  checkManualKeyJudge,
  loadKeyPack,
  resolveManualKeyJudges,
  validateAndWriteKeyDerivation,
  writeKeyPacks,
  type KeyPack,
} from "../qc/manualKeyJudge.js";
import { checkSweep, loadSweepRecord, writeSweepPack, writeSweepRecordFromSubmission } from "../qc/sweep.js";
import { renderSweepFamilyRubric, SWEEP_FAMILIES, SWEEP_SUBMISSION_SCHEMA_ID } from "../qc/sweepSpec.js";
import { validateSubmission, type ValidatedSweepSubmission } from "../qc/orchestrator/schemas.js";
import { submitQcArtifact } from "../qc/orchestrator/index.js";
import { sourceHashFor } from "../qc/sourceV2Gate.js";
import { renderChapterReaderDoc } from "../review/renderReaderDoc.js";
import type { QcRoundRole } from "../qc/qcRound.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");

// ── Shapes ────────────────────────────────────────────────────────────────────

/** The opened QC round the acceptance step owns: its id plus the role tokens
 *  the REAL writers require (key-derive and qc-submit verify tokens against
 *  the round record — evidence cannot be written without them). */
export type AuthorEvidenceRound = {
  roundId: string;
  tokens: Partial<Record<QcRoundRole, string>>;
};

export type AuthorEvidenceResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; category: "infra" | "content"; reason: string };

function infra(reason: string): AuthorEvidenceResult {
  return { ok: false, category: "infra", reason };
}

function content(reason: string): AuthorEvidenceResult {
  return { ok: false, category: "content", reason };
}

// ── Small helpers ─────────────────────────────────────────────────────────────

/** Run `fn` with CHAPTERFLOW_SESSION_ID set to the reader session that produced
 *  the evidence, so the EXISTING writers (validateAndWriteKeyDerivation,
 *  submitQcArtifact) stamp the real deriving session as reviewerSessionId —
 *  the conductor is only the scribe. Callers are strictly sequential (the
 *  evidence steps never overlap), so the env swap cannot race. */
function withSessionId<T>(sessionId: string, fn: () => T): T {
  const prev = process.env.CHAPTERFLOW_SESSION_ID;
  process.env.CHAPTERFLOW_SESSION_ID = sessionId;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_SESSION_ID;
    else process.env.CHAPTERFLOW_SESSION_ID = prev;
  }
}

/** Extract the first parseable JSON object from a reader reply (fenced
 *  ```json block preferred, then any fenced block, then the outermost
 *  {...} slice). Returns null when nothing parses to an object. */
export function parseJsonReply(text: string | undefined): any | null {
  if (!text) return null;
  const candidates: string[] = [];
  for (const m of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) candidates.push(m[1]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch { /* try the next candidate */ }
  }
  return null;
}

/**
 * The BLINDED chapter document a key reader derives from: the full
 * renderChapterReaderDoc MINUS (a) the trailing ANSWER KEY section and
 * (b) the entire quiz section — its per-question "Explanation:" lines argue
 * for the stored key, so they must never reach a blind reader. The questions
 * are re-rendered from the KEY PACK instead (prompt + choices ONLY, exactly
 * how the packs blind them), with authoritative question/choice indexes.
 */
export function renderBlindedChapterDoc(ch: ChapterV21): string {
  let doc = renderChapterReaderDoc(ch);
  const keyAt = doc.indexOf("\n## ANSWER KEY");
  if (keyAt >= 0) doc = doc.slice(0, keyAt);
  const quizAt = doc.indexOf("\n## Quiz\n");
  if (quizAt >= 0) {
    const rest = doc.slice(quizAt + 1);
    const nextAt = rest.indexOf("\n## ");
    doc = nextAt >= 0 ? doc.slice(0, quizAt) + rest.slice(nextAt) : doc.slice(0, quizAt);
  }
  return doc;
}

/** The one document BOTH key readers get: per chapter, the blinded prose, the
 *  citable source facts, and the pack's blinded questions with indexes. */
export function buildKeyJudgeDoc(bookId: string, roundId: string, chapters: ChapterV21[], packs: Map<number, KeyPack>): string {
  const L: string[] = [];
  L.push(`BLIND KEY-DERIVATION PACKS — book "${bookId}", QC round ${roundId}`);
  L.push("For each chapter: the blinded chapter document, its SOURCE FACTS, then the blinded questions.");
  for (const ch of chapters) {
    const pack = packs.get(ch.number);
    if (!pack) continue;
    L.push("", `════ CHAPTER ${ch.number} — ${ch.chapterId} (packHash ${pack.packHash}) ════`, "");
    L.push(renderBlindedChapterDoc(ch));
    L.push("", "SOURCE FACTS (the only citable evidence — cite these ids in sourceFactIds):");
    for (const f of pack.sourceFacts) {
      L.push(`- ${f.id}: ${f.claim}${f.becauseMechanism ? ` | mechanism: ${f.becauseMechanism}` : ""}${f.commonError ? ` | common error: ${f.commonError}` : ""}`);
    }
    L.push("", "BLINDED QUESTIONS (derive each answer from the chapter prose + source facts alone):");
    for (const q of pack.questions) {
      L.push(`Q${q.questionIndex}. ${q.prompt}`);
      q.choices.forEach((c, ci) => L.push(`   [${ci}] ${c}`));
    }
  }
  return L.join("\n");
}

/** The key reader's task card. The reader's ONLY job is blind key derivation. */
export function buildKeyReaderTask(bookId: string, roundId: string, role: "keyA" | "keyB", docRelPath: string): string {
  return [
    `You are the ${role} BLIND QUIZ-KEY reader for book "${bookId}" (QC round ${roundId}).`,
    "Your ONLY task: read the blinded chapter documents and independently derive the correct answer",
    "to EVERY quiz question from the chapter prose + source facts alone. You never see the stored",
    "answer key — do not try to guess it; report what the prose actually supports.",
    "",
    `Read this file (relative to the current directory): ${docRelPath}`,
    "",
    "Then output ONE fenced json block, exactly this shape (and nothing after it):",
    "```json",
    `{"chapters":[{"chapterNumber":1,"packHash":"<copy from the chapter header>","answers":[{"questionIndex":0,"choiceIndex":0,"confidence":"high","reason":"<at least 40 chars: the prose/mechanism that forces this choice>","sourceFactIds":["<a fact id from SOURCE FACTS>"]}]}]}`,
    "```",
    "Rules:",
    "- Answer EVERY question of EVERY chapter (questionIndex exactly as printed; choiceIndex = the [n] you pick).",
    '- confidence: "high" only when the prose alone forces the choice; "medium" when it strongly implies it; "low" when unsure. NEVER inflate confidence.',
    "- reason: at least 40 characters, naming the prose/mechanism that decides it.",
    "- sourceFactIds: at least one fact id (from that chapter's SOURCE FACTS list) supporting the choice.",
  ].join("\n");
}

/** The sweep reader's task card — rendered FROM the canonical family rubric so
 *  this read speaks the exact spec the formal sweep validates. */
export function buildSweepReaderTask(bookId: string, roundId: string, packRelPath: string): string {
  return [
    `You are the INDEPENDENT CROSS-CHAPTER SWEEP reader for book "${bookId}" (QC round ${roundId}).`,
    "One read over the whole book: detect cross-chapter TEMPLATING (a shell reused across chapters",
    "with only the content swapped). You are NOT re-grading per-chapter quality.",
    "",
    `Read the sweep pack (every chapter's reader-facing units side by side): ${packRelPath}`,
    "",
    renderSweepFamilyRubric(),
    "",
    `Then output ONE fenced json block — a ${SWEEP_SUBMISSION_SCHEMA_ID} submission:`,
    "```json",
    `{"schemaVersion":"${SWEEP_SUBMISSION_SCHEMA_ID}","bookId":"${bookId}","roundId":"${roundId}","role":"sweep","reviewer":"codex-qc:author-sweep","verdict":"PASS","checkedFamilies":${JSON.stringify([...SWEEP_FAMILIES])},"findings":[]}`,
    "```",
    "Rules:",
    "- Check ALL FOUR families and list every family you actually checked in checkedFamilies.",
    "- verdict PASS only when no family gates the book; REVISE/CORRUPTION require at least one finding.",
    '- Each finding: {"family","severity" ("blocker"|"advisory"),"chapters":[..],"unitId":"<field, e.g. examples[0].scenario>","repairClass":"<the family id>","quote":"<VERBATIM distinctive quote from the pack>","problem":"...","expectedFix":"..."}.',
    "- Quotes must be verbatim and DISTINCTIVE (a generic common phrase cannot prove structural reuse).",
  ].join("\n");
}

/** Fail-closed independence: no evidence session may be a chapter's author
 *  session (the author must never supply the independent evidence for their
 *  own chapter). Returns the offending author session, or null. */
function authorCollision(sessionId: string, authorSessions: Set<string>): boolean {
  return authorSessions.has(sessionId);
}

function authorSessionsOf(chapters: ChapterV21[], io: AuthorReviewIo): Set<string> {
  const out = new Set<string>();
  for (const ch of chapters) {
    const sid = io.authorSessionOf(ch.chapterId);
    if (sid) out.add(sid);
  }
  return out;
}

type ReaderSpawnResult = { ok: true; sessionId: string; parsed: any } | { ok: false; reason: string };

/** Spawn one lightweight read-only reader (with ONE respawn on unparseable
 *  output) and return its parsed JSON reply + the session that produced it.
 *  Fails CLOSED (no retry, no remint) when a minted session id collides with a
 *  chapter's author session — independence is a hard invariant, not a hint. */
async function spawnJsonReader(args: {
  bookId: string;
  label: string;
  task: string;
  deps: AutopilotDeps;
  authorSessions: Set<string>;
  forbiddenSessions?: Set<string>;
  reasoningEffort: "low" | "medium";
}): Promise<ReaderSpawnResult> {
  const { deps } = args;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const sessionId = deps.mkSessionId(`${args.label}${attempt > 1 ? "-r2" : ""}`);
    if (authorCollision(sessionId, args.authorSessions)) {
      return { ok: false, reason: `evidence session ${sessionId} matches a chapter's author session — the author cannot supply the independent publish evidence for their own book. Halting (fail closed).` };
    }
    if (args.forbiddenSessions?.has(sessionId)) {
      return { ok: false, reason: `evidence session ${sessionId} collides with another evidence role's session — the two blind reads must be independent. Halting (fail closed).` };
    }
    const r = await deps.spawn({
      task: args.task,
      sessionId,
      cwd: PIPELINE_DIR,
      sandbox: "read-only",
      skipGitRepoCheck: true,
      reasoningEffort: args.reasoningEffort,
    });
    try { deps.logSession(args.bookId, args.label, r); } catch { /* best-effort */ }
    const parsed = parseJsonReply(r.finalMessage) ?? parseJsonReply(r.stdout);
    if (parsed) return { ok: true, sessionId, parsed };
    deps.log(`[autopilot] author evidence ${args.label}: attempt ${attempt} produced no parseable JSON (exit ${r.exitCode})${attempt === 1 ? " — respawning once" : ""}`);
  }
  return { ok: false, reason: `${args.label}: reader produced no parseable JSON after a retry` };
}

// ── (a) Manual key-judge evidence: key-pack → keyA/keyB key-derive → key-resolve ──

/**
 * Produce the keyA + keyB evidence for EVERY chapter of the book, exactly as
 * checkManualKeyJudge validates it: blind key packs for the round, two
 * INDEPENDENT reader sessions each deriving every chapter's answers from the
 * blinded docs, both fed through the real key-derive writer (token-verified,
 * schema-validated, reviewer-session-stamped), then key-resolve writing the
 * per-chapter manual-keyjudge records. A non-PASS resolution (CORRUPTION /
 * NEEDS_ADJUDICATION / BLOCK) is surfaced as a fail-closed CONTENT failure —
 * that is the wrong-key catch working, never something to auto-pass.
 */
export async function runKeyJudgeEvidence(
  bookId: string,
  chapters: ChapterV21[],
  deps: AutopilotDeps,
  io: AuthorReviewIo,
  round: AuthorEvidenceRound,
): Promise<AuthorEvidenceResult> {
  if (chapters.length === 0) return infra(`key-judge evidence: no chapters for ${bookId}`);
  const ordered = [...chapters].sort((a, b) => a.number - b.number);

  // Idempotency: the promote predicate ITSELF decides "already satisfied" —
  // fresh PASS records over the current content+source need no new evidence.
  try {
    if (ordered.every((ch) => checkManualKeyJudge(ch, true).length === 0)) {
      deps.log(`[autopilot] author evidence: manual key-judge already PASS for all ${ordered.length} chapter(s) — skipping`);
      return { ok: true, skipped: true };
    }
  } catch { /* unreadable prior records → rebuild the evidence below */ }

  const authorSessions = authorSessionsOf(ordered, io);

  // Key packs for THIS round. Packs and derivations are book-level (one
  // keyA/keyB answers file covers every pack), so partial reuse cannot help:
  // if ANY pack is missing or stale on the current content/source, rewrite
  // them all via the real key-pack writer and re-derive both keys.
  const allPacksFresh = ordered.every((ch) => {
    const pack = loadKeyPack(bookId, round.roundId, ch.number);
    return !!pack
      && pack.contentHash === chapterContentHash(ch)
      && pack.sourceHash === (sourceHashFor(bookId, ch.number) ?? "");
  });
  if (!allPacksFresh) {
    try {
      writeKeyPacks(bookId, round.roundId, ordered);
    } catch (err) {
      return infra(`key-pack failed for ${bookId} round ${round.roundId}: ${(err as Error).message}`);
    }
  }
  const packs = new Map<number, KeyPack>();
  for (const ch of ordered) {
    const pack = loadKeyPack(bookId, round.roundId, ch.number);
    if (!pack) return infra(`key pack missing for ${bookId} ch${ch.number} after key-pack`);
    packs.set(ch.number, pack);
  }

  // ONE blinded doc, read by BOTH independent key readers.
  const docText = buildKeyJudgeDoc(bookId, round.roundId, ordered, packs);
  const { relPath } = io.writeReviewDoc(bookId, `key-judge-${round.roundId}.txt`, docText);

  const usedSessions = new Set<string>();
  for (const role of ["keyA", "keyB"] as const) {
    const token = round.tokens[role];
    if (!token) return infra(`no ${role} token for round ${round.roundId} — the acceptance step must pass the opened round's tokens`);

    const read = await spawnJsonReader({
      bookId,
      label: `author-key-${role}`,
      task: buildKeyReaderTask(bookId, round.roundId, role, relPath),
      deps,
      authorSessions,
      forbiddenSessions: usedSessions,
      reasoningEffort: "low",
    });
    if (!read.ok) return infra(`key-judge evidence (${role}): ${read.reason}`);
    usedSessions.add(read.sessionId);

    // Normalize into the exact answers-file shape key-derive expects. The
    // packHash is stamped from the pack the doc was BUILT from (the reader
    // read exactly that pack; echo-transcription must not flake the binding).
    // Answers are the reader's verbatim output — a missing/partial chapter
    // fails closed in the real validator below.
    const byNumber = new Map<number, any>();
    if (Array.isArray(read.parsed?.chapters)) {
      for (const entry of read.parsed.chapters) byNumber.set(Number(entry?.chapterNumber), entry);
    }
    const answersFileObj = {
      chapters: ordered.map((ch) => ({
        chapterNumber: ch.number,
        packHash: packs.get(ch.number)!.packHash,
        answers: Array.isArray(byNumber.get(ch.number)?.answers) ? byNumber.get(ch.number).answers : [],
      })),
    };
    const { absPath } = io.writeReviewDoc(bookId, `${role}.answers-${round.roundId}.json`, JSON.stringify(answersFileObj, null, 2));

    // THE real key-derive writer: token-verified against the round, schema-
    // validated (coverage, confidence, 40-char reasons, source-fact
    // citations), reviewerSessionId stamped from the reader session.
    const derived = withSessionId(read.sessionId, () => validateAndWriteKeyDerivation(bookId, round.roundId, role, token, absPath));
    if (derived.errors.length > 0) {
      return infra(`key-derive (${role}) rejected the reader's derivation: ${derived.errors.slice(0, 6).join("; ")}${derived.errors.length > 6 ? ` (+${derived.errors.length - 6} more)` : ""}`);
    }
    deps.log(`[autopilot] author evidence: ${role} derivation written by session ${read.sessionId} (${ordered.length} chapter(s))`);
  }

  // THE real key-resolve: per-chapter manual-keyjudge records. A non-PASS
  // record is the QC signal working — surface it, never auto-pass it.
  let resolved: ReturnType<typeof resolveManualKeyJudges>;
  try {
    resolved = resolveManualKeyJudges(bookId, round.roundId, ordered);
  } catch (err) {
    return infra(`key-resolve failed for ${bookId} round ${round.roundId}: ${(err as Error).message}`);
  }
  if (resolved.errors.length > 0) {
    return content(`manual key-judge did not PASS — the independent blind keys dispute the stored keys (records persisted; promote will block): ${resolved.errors.join("; ")}`);
  }
  deps.log(`[autopilot] author evidence: manual key-judge PASS for all ${ordered.length} chapter(s) (round ${round.roundId})`);
  return { ok: true };
}

// ── (b) Sweep evidence: sweep-pack → independent sweep read → qc-submit → record ──

/**
 * Produce the book-level sweep attestation checkSweep validates: write the
 * real sweep pack for the round, spawn ONE independent sweep reader over it
 * (the canonical family rubric), submit its qc-sweep-submission-v1 through the
 * REAL qc-submit path (token-verified, schema-validated, raw submission
 * preserved as evidence), and write the sweep record exactly the way the QC
 * collect path does. A sweep read that gates chapters fails the step CLOSED —
 * a sweep-FAIL book must not become READY.
 */
export async function runSweepEvidence(
  bookId: string,
  chapters: ChapterV21[],
  deps: AutopilotDeps,
  io: AuthorReviewIo,
  round: AuthorEvidenceRound,
): Promise<AuthorEvidenceResult> {
  if (chapters.length === 0) return infra(`sweep evidence: no chapters for ${bookId}`);
  const ordered = [...chapters].sort((a, b) => a.number - b.number);

  // Idempotency: checkSweep is the promote predicate — when a roles.sweep-
  // backed attestation already covers the current bytes cleanly, skip.
  try {
    if (loadSweepRecord(bookId) && checkSweep(ordered, true).length === 0) {
      deps.log(`[autopilot] author evidence: sweep attestation already covers the current book — skipping`);
      return { ok: true, skipped: true };
    }
  } catch { /* torn/absent history → produce fresh evidence below */ }

  const token = round.tokens.sweep;
  if (!token) return infra(`no sweep token for round ${round.roundId} — the acceptance step must pass the opened round's tokens`);

  try {
    writeSweepPack(bookId, round.roundId);
  } catch (err) {
    return infra(`sweep-pack failed for ${bookId} round ${round.roundId}: ${(err as Error).message}`);
  }
  const packRelPath = `state/qc-packs/${bookId}/${round.roundId}/sweep-pack.json`;

  const read = await spawnJsonReader({
    bookId,
    label: "author-sweep",
    task: buildSweepReaderTask(bookId, round.roundId, packRelPath),
    deps,
    authorSessions: authorSessionsOf(ordered, io),
    reasoningEffort: "medium",
  });
  if (!read.ok) return infra(`sweep evidence: ${read.reason}`);

  // Normalize ONLY the envelope (identity/routing fields the conductor owns —
  // same precedent as writeAuthorAcceptance's reviewer strings). The reader's
  // JUDGMENT (verdict, checkedFamilies, findings) is passed through verbatim
  // into the real validator.
  const submission = {
    ...read.parsed,
    schemaVersion: SWEEP_SUBMISSION_SCHEMA_ID,
    bookId,
    roundId: round.roundId,
    role: "sweep",
    reviewer: `codex-qc:author-sweep:${round.roundId}`,
  };
  const { absPath } = io.writeReviewDoc(bookId, `sweep-submission-${round.roundId}.json`, JSON.stringify(submission, null, 2));

  // THE real submission path (qc-submit): token check, schema validation,
  // immutable raw-submission storage, reviewerSessionId stamped from the
  // reader session (taken from the env, never the file — a reader cannot
  // claim another session's identity).
  const submitted = withSessionId(read.sessionId, () => submitQcArtifact(bookId, round.roundId, "sweep", absPath, token));
  if (submitted.errors.length > 0 || !submitted.path) {
    return infra(`sweep qc-submit rejected the reader's submission: ${submitted.errors.join("; ") || "no stored path"}`);
  }

  // Write the durable sweep record from the stored submission — the exact
  // call the QC collect path makes (validate the stored bytes, then
  // writeSweepRecordFromSubmission with the raw file as evidence source).
  let storedRaw: unknown;
  try {
    storedRaw = JSON.parse(readFileSync(submitted.path, "utf8"));
  } catch (err) {
    return infra(`stored sweep submission unreadable at ${submitted.path}: ${(err as Error).message}`);
  }
  const validation = validateSubmission(bookId, round.roundId, "sweep", storedRaw);
  if (validation.ok === false) {
    return infra(`stored sweep submission failed validation: ${validation.errors.join("; ")}`);
  }
  try {
    writeSweepRecordFromSubmission(validation.submission as ValidatedSweepSubmission, submitted.path);
  } catch (err) {
    return infra(`sweep record write failed: ${(err as Error).message}`);
  }

  // The promote predicate over the fresh record: blocking findings (or an
  // unexplained non-PASS / CORRUPTION) fail the step CLOSED.
  let findings: ReturnType<typeof checkSweep>;
  try {
    findings = checkSweep(ordered, true);
  } catch (err) {
    return infra(`checkSweep failed after the sweep record write: ${(err as Error).message}`);
  }
  if (findings.length > 0) {
    return content(`sweep read did not clear the book (record persisted; promote will block): ${findings.map((f) => `${f.checkId}: ${f.message}`).join("; ")}`);
  }
  deps.log(`[autopilot] author evidence: sweep attestation written by session ${read.sessionId} (round ${round.roundId})`);
  return { ok: true };
}
