import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve } from "path";

import { ChapterV21 } from "../types.js";
import { CANONICAL_STATE, CHAPTERS_DIR, isSiblingFile, parseChapterId } from "../lib/chapterPaths.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { loadQcRound, verifyQcRoundToken } from "./qcRound.js";
import { currentSessionId, sessionsCollide } from "./sessionProvenance.js";
import { loadSourceV2Sidecar, sourceFactsForPack, sourceHashFor, type SourceFactForPack } from "./sourceV2Gate.js";

export const QC_PACKS_DIR = resolve(CANONICAL_STATE, "qc-packs");
export const QC_DIR = resolve(CANONICAL_STATE, "qc");

export type BlindQuestion = {
  questionIndex: number;
  prompt: string;
  choices: string[];
};

export type KeyPack = {
  schemaVersion: "manual-key-pack-v1";
  bookId: string;
  roundId: string;
  chapterNumber: number;
  chapterId: string;
  createdAt: string;
  contentHash: string;
  sourceHash: string;
  sourceFacts: SourceFactForPack[];
  questions: BlindQuestion[];
  packHash: string;
};

export type KeyAnswer = {
  questionIndex: number;
  choiceIndex: number;
  confidence: number | "low" | "medium" | "high";
  reason: string;
  sourceFactIds: string[];
};

export type KeyDerivation = {
  schemaVersion: "manual-key-derive-v2";
  bookId: string;
  roundId: string;
  role: "keyA" | "keyB";
  /** The reviewer session that derived this key (CHAPTERFLOW_SESSION_ID at submit). When
   *  present on both keys and equal under enforcement, the two "blind" keys were NOT
   *  independent — sessionsCollide blocks (see resolveManualKeyJudges). */
  reviewerSessionId?: string;
  derivedAt: string;
  chapters: Array<{
    chapterNumber: number;
    chapterId: string;
    packHash: string;
    contentHash: string;
    sourceHash: string;
    answers: KeyAnswer[];
  }>;
};

export type ManualKeyJudgeRecord = {
  schemaVersion: "manual-keyjudge-v1";
  bookId: string;
  chapterNumber: number;
  chapterId: string;
  roundId: string;
  resolvedAt: string;
  status: "PASS" | "CORRUPTION" | "NEEDS_ADJUDICATION" | "BLOCK";
  contentHash: string;
  sourceHash: string;
  packHash: string;
  reason: string;
  mismatches?: Array<{ questionIndex: number; storedIndex: number; agreedIndex: number }>;
  disagreements?: number[];
};

export type ManualKeyFinding = { checkId: string; severity: "blocker" | "advisory"; message: string };

function shaJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex").slice(0, 16);
}

function packWithoutHash(pack: Omit<KeyPack, "packHash">): Omit<KeyPack, "packHash"> {
  return pack;
}

export function keyPackDir(bookId: string, roundId: string): string {
  return resolve(QC_PACKS_DIR, bookId, roundId);
}

export function keyPackPath(bookId: string, roundId: string, chapterNumber: number): string {
  return resolve(keyPackDir(bookId, roundId), `ch${String(chapterNumber).padStart(2, "0")}.key-pack.json`);
}

export function keyDerivationPath(bookId: string, roundId: string, role: "keyA" | "keyB"): string {
  return resolve(keyPackDir(bookId, roundId), `${role}.answers.json`);
}

export function manualKeyJudgePath(bookId: string, chapterNumber: number): string {
  return resolve(QC_DIR, `${bookId}-ch${String(chapterNumber).padStart(2, "0")}.manual-keyjudge.json`);
}

export function loadBookChapters(bookId: string): ChapterV21[] {
  return readdirSync(CHAPTERS_DIR)
    .filter((f) => isSiblingFile(f, bookId))
    .sort()
    .map((f) => {
      // Per-file parse so a single corrupt/half-written chapter (the documented
      // agent metadata-drift failure mode) names itself, instead of surfacing a
      // path-less SyntaxError from deep inside a QC/finalize call.
      try {
        return JSON.parse(readFileSync(resolve(CHAPTERS_DIR, f), "utf8")) as ChapterV21;
      } catch (err) {
        throw new Error(`Failed to parse chapter file ${resolve(CHAPTERS_DIR, f)}: ${(err as Error).message}`);
      }
    })
    .sort((a, b) => a.number - b.number);
}

export function buildKeyPack(bookId: string, roundId: string, chapter: ChapterV21): KeyPack {
  const sourceHash = sourceHashFor(bookId, chapter.number);
  const sc = loadSourceV2Sidecar(bookId, chapter.number);
  if (!sourceHash || !sc) throw new Error(`Missing source-v2 sidecar for ${bookId}-ch${String(chapter.number).padStart(2, "0")}.`);
  const raw: Omit<KeyPack, "packHash"> = {
    schemaVersion: "manual-key-pack-v1",
    bookId,
    roundId,
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId,
    createdAt: new Date().toISOString(),
    contentHash: chapterContentHash(chapter),
    sourceHash,
    sourceFacts: sourceFactsForPack(sc),
    questions: (chapter.quiz?.questions ?? []).map((q, i) => ({
      questionIndex: i,
      prompt: q.prompt,
      choices: q.choices,
    })),
  };
  return { ...raw, packHash: shaJson(packWithoutHash(raw)) };
}

export function writeKeyPacks(bookId: string, roundId: string): string[] {
  mkdirSync(keyPackDir(bookId, roundId), { recursive: true });
  const paths: string[] = [];
  for (const ch of loadBookChapters(bookId)) {
    const pack = buildKeyPack(bookId, roundId, ch);
    const p = keyPackPath(bookId, roundId, ch.number);
    writeFileSync(p, JSON.stringify(pack, null, 2), "utf8");
    paths.push(p);
  }
  return paths;
}

export function loadKeyPack(bookId: string, roundId: string, chapterNumber: number): KeyPack | null {
  const p = keyPackPath(bookId, roundId, chapterNumber);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as KeyPack;
  } catch {
    return null;
  }
}

function confidenceValid(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 && value <= 1;
  return value === "low" || value === "medium" || value === "high";
}

function normalizeAnswer(raw: any): KeyAnswer {
  return {
    questionIndex: Number(raw.questionIndex ?? raw.q ?? raw.index),
    choiceIndex: Number(raw.choiceIndex ?? raw.answerIndex ?? raw.choice),
    confidence: raw.confidence,
    reason: String(raw.reason ?? raw.rationale ?? ""),
    sourceFactIds: Array.isArray(raw.sourceFactIds) ? raw.sourceFactIds.map(String) : [],
  };
}

function answersByChapter(raw: any, packs: KeyPack[]): Map<number, { packHash?: string; answers: KeyAnswer[] }> {
  const out = new Map<number, { packHash?: string; answers: KeyAnswer[] }>();
  if (Array.isArray(raw?.chapters)) {
    for (const entry of raw.chapters) {
      out.set(Number(entry.chapterNumber), { packHash: entry.packHash, answers: (entry.answers ?? []).map(normalizeAnswer) });
    }
    return out;
  }
  if (raw?.chapterAnswers && typeof raw.chapterAnswers === "object") {
    for (const [chapter, entry] of Object.entries(raw.chapterAnswers as Record<string, any>)) {
      out.set(Number(chapter), { packHash: entry.packHash, answers: (entry.answers ?? []).map(normalizeAnswer) });
    }
    return out;
  }
  if (Array.isArray(raw?.answers) && packs.length === 1) {
    out.set(Number(raw.chapterNumber ?? packs[0].chapterNumber), { packHash: raw.packHash, answers: raw.answers.map(normalizeAnswer) });
  }
  return out;
}

export function validateAndWriteKeyDerivation(bookId: string, roundId: string, role: "keyA" | "keyB", token: string, answersFile: string): { path?: string; errors: string[] } {
  if (!verifyQcRoundToken(bookId, roundId, role, token)) {
    return { errors: [`Invalid ${role} token for ${bookId} round ${roundId}.`] };
  }
  const packs = loadBookChapters(bookId).map((ch) => loadKeyPack(bookId, roundId, ch.number)).filter(Boolean) as KeyPack[];
  if (packs.length === 0) return { errors: [`No key packs found for ${bookId} round ${roundId}. Run key-pack first.`] };
  let raw: any;
  try {
    raw = JSON.parse(readFileSync(resolve(answersFile), "utf8"));
  } catch (err) {
    return { errors: [`Could not read answers file: ${(err as Error).message}`] };
  }
  const byChapter = answersByChapter(raw, packs);
  const errors: string[] = [];
  const chapters: KeyDerivation["chapters"] = [];
  for (const pack of packs) {
    const entry = byChapter.get(pack.chapterNumber);
    if (!entry) {
      errors.push(`ch${pack.chapterNumber}: missing answers`);
      continue;
    }
    if (entry.packHash !== pack.packHash) errors.push(`ch${pack.chapterNumber}: packHash mismatch`);
    const seen = new Set<number>();
    const validFactIds = new Set(pack.sourceFacts.map((f) => f.id));
    for (const ans of entry.answers) {
      if (!Number.isInteger(ans.questionIndex) || ans.questionIndex < 0 || ans.questionIndex >= pack.questions.length) errors.push(`ch${pack.chapterNumber}: invalid questionIndex ${ans.questionIndex}`);
      if (seen.has(ans.questionIndex)) errors.push(`ch${pack.chapterNumber}: duplicate answer for question ${ans.questionIndex}`);
      seen.add(ans.questionIndex);
      const q = pack.questions[ans.questionIndex];
      if (!Number.isInteger(ans.choiceIndex) || !q || ans.choiceIndex < 0 || ans.choiceIndex >= q.choices.length) errors.push(`ch${pack.chapterNumber}: invalid choiceIndex ${ans.choiceIndex} for q${ans.questionIndex}`);
      if (!confidenceValid(ans.confidence)) errors.push(`ch${pack.chapterNumber}: invalid confidence for q${ans.questionIndex}`);
      if (ans.reason.trim().length < 40) errors.push(`ch${pack.chapterNumber}: q${ans.questionIndex} reason must be at least 40 characters`);
      if (ans.sourceFactIds.length === 0) errors.push(`ch${pack.chapterNumber}: q${ans.questionIndex} has no sourceFactIds`);
      for (const id of ans.sourceFactIds) if (!validFactIds.has(id)) errors.push(`ch${pack.chapterNumber}: q${ans.questionIndex} cites unknown sourceFactId ${id}`);
    }
    if (seen.size !== pack.questions.length) errors.push(`ch${pack.chapterNumber}: partial answer coverage (${seen.size}/${pack.questions.length})`);
    chapters.push({
      chapterNumber: pack.chapterNumber,
      chapterId: pack.chapterId,
      packHash: pack.packHash,
      contentHash: pack.contentHash,
      sourceHash: pack.sourceHash,
      answers: entry.answers,
    });
  }
  if (errors.length > 0) return { errors };
  const rec: KeyDerivation = {
    schemaVersion: "manual-key-derive-v2",
    bookId,
    roundId,
    role,
    reviewerSessionId: currentSessionId(),
    derivedAt: new Date().toISOString(),
    chapters,
  };
  mkdirSync(keyPackDir(bookId, roundId), { recursive: true });
  const path = keyDerivationPath(bookId, roundId, role);
  writeFileSync(path, JSON.stringify(rec, null, 2), "utf8");
  return { path, errors: [] };
}

function loadDerivation(bookId: string, roundId: string, role: "keyA" | "keyB"): KeyDerivation | null {
  const p = keyDerivationPath(bookId, roundId, role);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as KeyDerivation;
  } catch {
    return null;
  }
}

function confidenceBand(value: KeyAnswer["confidence"]): "low" | "medium" | "high" {
  if (value === "low" || value === "medium" || value === "high") return value;
  if (value < 0.5) return "low";
  if (value < 0.8) return "medium";
  return "high";
}

function citesSourceFacts(ans: KeyAnswer | undefined): boolean {
  return !!ans && ans.sourceFactIds.length > 0;
}

export function loadManualKeyJudge(bookId: string, chapterNumber: number): ManualKeyJudgeRecord | null {
  const p = manualKeyJudgePath(bookId, chapterNumber);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as ManualKeyJudgeRecord;
  } catch {
    return null;
  }
}

/** Round ids that have key packs for this book, most-recent first (round ids are
 *  timestamp-prefixed, so lexical-desc == chronological-desc). */
function roundIdsForBook(bookId: string): string[] {
  const dir = resolve(QC_PACKS_DIR, bookId);
  if (!existsSync(dir)) return [];
  const ids = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  // Order by the round's actual openedAt (chronological DESC), NOT the dir name — so the
  // "most recent matching round" tie-break is correct even for custom (non-timestamp)
  // round ids: a later FIXED round supersedes an older one, never masking a newer
  // CORRUPTION with an older PASS. Fall back to the id string if round.json is absent.
  const openedAt = (id: string): string => loadQcRound(bookId, id)?.openedAt ?? id;
  return ids.sort((x, y) => {
    const ox = openedAt(x);
    const oy = openedAt(y);
    return ox > oy ? -1 : ox < oy ? 1 : 0;
  });
}

/** The round whose keyA AND keyB derived this chapter on its CURRENT content+source.
 *  Prefers the current round (a re-QC'd chapter); else the most recent prior round that
 *  still matches (a carried chapter keeps its resolution across incremental rounds rather
 *  than being clobbered to "missing keyA/keyB derivation"). Returns null when no round
 *  derived this chapter on its current content — i.e. it genuinely needs a fresh key. */
function derivationForChapter(
  bookId: string,
  chapterNumber: number,
  contentHash: string,
  sourceHash: string,
  currentRoundId: string,
  orderedRoundIds: string[],
): { roundId: string; a: KeyDerivation; b: KeyDerivation; ca: KeyDerivation["chapters"][number]; cb: KeyDerivation["chapters"][number] } | null {
  const ordered = [currentRoundId, ...orderedRoundIds.filter((r) => r !== currentRoundId)];
  for (const rid of ordered) {
    const a = loadDerivation(bookId, rid, "keyA");
    const b = loadDerivation(bookId, rid, "keyB");
    if (!a || !b) continue;
    const ca = a.chapters.find((c) => c.chapterNumber === chapterNumber);
    const cb = b.chapters.find((c) => c.chapterNumber === chapterNumber);
    if (ca && cb && ca.contentHash === contentHash && cb.contentHash === contentHash && ca.sourceHash === sourceHash && cb.sourceHash === sourceHash) {
      return { roundId: rid, a, b, ca, cb };
    }
  }
  return null;
}

export function resolveManualKeyJudges(bookId: string, roundId: string): { records: ManualKeyJudgeRecord[]; errors: string[] } {
  const chapters = loadBookChapters(bookId);
  const errors: string[] = [];
  const records: ManualKeyJudgeRecord[] = [];
  mkdirSync(QC_DIR, { recursive: true });
  const orderedRounds = roundIdsForBook(bookId); // chronological desc; computed once
  for (const ch of chapters) {
    const contentHash = chapterContentHash(ch);
    const sourceHash = sourceHashFor(bookId, ch.number) ?? "";
    // Content-addressed carry-forward: resolve each chapter from the latest round whose
    // keyA AND keyB derived it on its CURRENT content. Without this, an incremental round
    // — which only re-derives the re-QC'd chapters — clobbers every CARRIED chapter's
    // valid record to "missing keyA/keyB derivation", and the publish preflight then
    // blocks on chapters QC already passed (the eat-that-frog publish failure).
    const found = derivationForChapter(bookId, ch.number, contentHash, sourceHash, roundId, orderedRounds);
    const recRoundId = found?.roundId ?? roundId;
    const a = found?.a ?? null;
    const b = found?.b ?? null;
    const ca = found?.ca;
    const cb = found?.cb;
    const pack = loadKeyPack(bookId, recRoundId, ch.number);
    let status: ManualKeyJudgeRecord["status"] = "BLOCK";
    let reason = "";
    const mismatches: ManualKeyJudgeRecord["mismatches"] = [];
    const disagreements: number[] = [];
    if (!pack) reason = "missing key pack";
    else if (!a || !b || !ca || !cb) reason = "missing keyA/keyB derivation";
    else if (sessionsCollide(a.reviewerSessionId, b.reviewerSessionId)) reason = `keyA and keyB were derived in the SAME session (${a.reviewerSessionId}) — the two blind keys must be independent; re-derive keyB in a separate session`;
    else if (pack.contentHash !== contentHash || ca.contentHash !== contentHash || cb.contentHash !== contentHash) reason = "stale content hash";
    else if (pack.sourceHash !== sourceHash || ca.sourceHash !== sourceHash || cb.sourceHash !== sourceHash) reason = "stale source hash";
    else if (ca.packHash !== pack.packHash || cb.packHash !== pack.packHash) reason = "stale pack hash";
    else {
      for (let i = 0; i < ch.quiz.questions.length; i++) {
        const aa = ca.answers.find((ans) => ans.questionIndex === i);
        const bb = cb.answers.find((ans) => ans.questionIndex === i);
        if (!aa || !bb) {
          reason = "partial derivation";
          break;
        }
        const aBand = confidenceBand(aa.confidence);
        const bBand = confidenceBand(bb.confidence);
        if (aBand === "low" || bBand === "low") {
          disagreements.push(i);
          continue;
        }
        if (aa.choiceIndex !== bb.choiceIndex) {
          disagreements.push(i);
        } else {
          const stored = ch.quiz.questions[i].correctIndex;
          if ((aBand === "medium" || bBand === "medium") && (aa.choiceIndex !== stored || !citesSourceFacts(aa) || !citesSourceFacts(bb))) {
            disagreements.push(i);
            continue;
          }
          if (aa.choiceIndex !== stored) mismatches.push({ questionIndex: i, storedIndex: stored, agreedIndex: aa.choiceIndex });
        }
      }
      if (!reason) {
        if (disagreements.length > 0) {
          status = "NEEDS_ADJUDICATION";
          reason = `keyA/keyB need adjudication on ${disagreements.length} question(s) because of disagreement, low confidence, or medium confidence without stored-key/source-fact agreement`;
        } else if (mismatches.length > 0) {
          status = "CORRUPTION";
          reason = `keyA/keyB agree against stored key on ${mismatches.length} question(s)`;
        } else {
          status = "PASS";
          reason = "keyA/keyB agree with stored key";
        }
      }
    }
    const rec: ManualKeyJudgeRecord = {
      schemaVersion: "manual-keyjudge-v1",
      bookId,
      chapterNumber: ch.number,
      chapterId: ch.chapterId,
      roundId: recRoundId,
      resolvedAt: new Date().toISOString(),
      status,
      contentHash,
      sourceHash,
      packHash: pack?.packHash ?? "",
      reason,
      mismatches: mismatches.length ? mismatches : undefined,
      disagreements: disagreements.length ? disagreements : undefined,
    };
    writeFileSync(manualKeyJudgePath(bookId, ch.number), JSON.stringify(rec, null, 2), "utf8");
    records.push(rec);
    if (status !== "PASS") errors.push(`ch${ch.number}: ${status} — ${reason}`);
  }
  return { records, errors };
}

export function checkManualKeyJudge(chapter: ChapterV21, enforce: boolean): ManualKeyFinding[] {
  const sev: "blocker" | "advisory" = enforce ? "blocker" : "advisory";
  const parsed = parseChapterId(chapter.chapterId);
  const bookId = parsed?.bookId ?? chapter.chapterId.replace(/-ch\d+$/i, "");
  const rec = loadManualKeyJudge(bookId, chapter.number);
  if (!rec) return [{ checkId: "QC2.manual_keyjudge_missing", severity: sev, message: `No manual keyjudge record for ${chapter.chapterId}. Run key-pack, key-derive for keyA/keyB, then key-resolve.` }];
  const round = loadQcRound(rec.bookId, rec.roundId);
  if (!round?.roles?.keyA || !round.roles.keyB) return [{ checkId: "QC2.manual_keyjudge_round_missing", severity: sev, message: `Manual keyjudge record is not backed by an existing QC round file. Re-open a round and repeat key-pack/key-derive/key-resolve.` }];
  if (rec.contentHash !== chapterContentHash(chapter)) return [{ checkId: "QC2.manual_keyjudge_stale", severity: sev, message: `Manual keyjudge record is stale for ${chapter.chapterId}.` }];
  const sourceHash = sourceHashFor(bookId, chapter.number);
  if (!sourceHash || rec.sourceHash !== sourceHash) return [{ checkId: "QC2.manual_keyjudge_source_stale", severity: sev, message: `Manual keyjudge source hash is stale/missing for ${chapter.chapterId}.` }];
  if (rec.status !== "PASS") return [{ checkId: "QC2.manual_keyjudge_not_pass", severity: sev, message: `Manual keyjudge status is ${rec.status}: ${rec.reason}` }];
  return [];
}
