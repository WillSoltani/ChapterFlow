import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, dirname, resolve } from "path";

import { runBookGate } from "../../critics/bookGate.js";
import { runShipGate } from "../../critics/finalGate.js";
import { checkAuthoringContract } from "../../critics/authoringContract.js";
import { loadChapterSidecar } from "../../critics/sourceGrounding.js";
import { chapterContentHash } from "../../critics/qcAttestation.js";
import { AXIS_WEIGHTS } from "../../critics/semantic/publishableBar.js";
import type { ChapterV21 } from "../../types.js";
import { runIntraBookChecks } from "../../critics/intraBook.js";
import { writeBarPack } from "../barReview.js";
import { keyDerivationPath, loadBookChapters, loadKeyPack, writeKeyPacks, type KeyDerivation } from "../manualKeyJudge.js";
import { isNoApiCodexQcMode } from "../noApiMode.js";
import { openQcRound, qcRoundPath, verifyQcRoundToken, type QcRoundRole } from "../qcRound.js";
import { checkSourceV2Gate } from "../sourceV2Gate.js";
import { writeSweepPack } from "../sweep.js";
import {
  orchestratorRoundDir,
  qcSummaryPath,
  repairLedgerPath,
  roundRecordPath,
  submissionsDir,
  taskCardsDir,
  writeBarReadArtifact,
  writeConfirmReadArtifact,
} from "./artifacts.js";
import { appendFindingsFromSubmission, appendStatusEvents, effectiveLedger, ledgerStatusSummary } from "./ledger.js";
import { writeRepairBrief, writeRepairPrompt } from "./repairBrief.js";
import { SUBMISSION_ROLES, validateSubmission, type SubmissionRole, type ValidatedKeyDeriveSubmission, type ValidatedSubmission } from "./schemas.js";
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
  if (!existsSync(ledger)) writeFileSync(ledger, "", "utf8");
}

function writeText(path: string, text: string): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
  return path;
}

function cardHeader(bookId: string, roundId: string, role: string, token: string): string {
  return [
    `# ChapterFlow QC task — ${bookId} ${roundId}`,
    "",
    `Role: ${role}`,
    `Token: ${token}`,
    "",
    "Work from `scripts/book/prompts/chapterflow-v21-authored`.",
    "Do not edit chapter files.",
    "",
  ].join("\n");
}

function taskCardPaths(bookId: string, roundId: string, chapters: ChapterV21[], tokens: Record<QcRoundRole, string>): string[] {
  const root = taskCardsDir(bookId, roundId);
  const paths: string[] = [];
  paths.push(writeText(resolve(root, "00-sweep.md"), cardHeader(bookId, roundId, "sweep", tokens.sweep) + [
    "Read the sweep pack only for the cross-chapter sweep.",
    "Check all four families: scene_skeleton, persona_drift, repeated_unit, location_stamping.",
    "Submit `qc-sweep-submission-v1` with checkedFamilies and verbatim findings.",
    `Command: npx tsx src/cli.ts qc-submit ${bookId} --round ${roundId} --role sweep --token ${tokens.sweep} --file <submission.json>`,
    "",
  ].join("\n")));
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
    paths.push(writeText(resolve(root, "confirm", `ch${String(ch.number).padStart(2, "0")}.md`), cardHeader(bookId, roundId, `confirm ch${String(ch.number).padStart(2, "0")}`, tokens.confirm) + [
      "Use this only after a bar read marks the chapter as a PUBLISHABLE candidate.",
      "Confirm the candidate or return REVISE/CORRUPTION with exact findings.",
      `Required schema: qc-confirm-read-v1.`,
      `Submit: npx tsx src/cli.ts qc-submit ${bookId} --round ${roundId} --role confirm --token ${tokens.confirm} --file <submission.json>`,
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

export function createQcOrchestrationRound(bookId: string, options: { chapters?: number[]; roundId?: string } = {}): OrchestratorResult {
  const errors: string[] = [];
  const messages: string[] = [];
  if (!isNoApiCodexQcMode()) {
    return { ok: false, roundId: options.roundId ?? "", roundDir: options.roundId ? orchestratorRoundDir(bookId, options.roundId) : "", errors: ["qc-orchestrate --create requires CHAPTERFLOW_NO_API_CODEX_QC=1."], messages };
  }
  let opened: ReturnType<typeof openQcRound>;
  try {
    opened = openQcRound(bookId, options.roundId);
  } catch (err) {
    return { ok: false, roundId: options.roundId ?? "", roundDir: options.roundId ? orchestratorRoundDir(bookId, options.roundId) : "", errors: [(err as Error).message], messages };
  }
  const roundId = opened.record.roundId;
  ensureRoundLayout(bookId, roundId);

  const allChapters = loadBookChapters(bookId);
  const only = options.chapters?.length ? new Set(options.chapters) : null;
  const selected = allChapters.filter((ch) => !only || only.has(ch.number));

  const source = checkSourceV2Gate(bookId, selected.map((ch) => ch.number));
  messages.push(`source-v2-gate: ${source.passed ? "PASS" : "BLOCK"} (${source.findings.length} blocker(s))`);
  const bookGate = runBookGate(bookId, allChapters);
  messages.push(`book-gate: ${bookGate.passed ? "PASS" : "BLOCK"} (${bookGate.findings.length} finding(s))`);

  let keyPackPaths: string[] = [];
  let keyPackError: string | undefined;
  try {
    keyPackPaths = writeKeyPacks(bookId, roundId);
    messages.push(`key-pack: wrote ${keyPackPaths.length} pack(s)`);
  } catch (err) {
    keyPackError = (err as Error).message;
    errors.push(`key-pack failed: ${keyPackError}`);
  }
  let sweepPackPath: string | undefined;
  let sweepPackError: string | undefined;
  try {
    sweepPackPath = writeSweepPack(bookId, roundId);
    messages.push(`sweep-pack: wrote ${sweepPackPath}`);
  } catch (err) {
    sweepPackError = (err as Error).message;
    errors.push(`sweep-pack failed: ${sweepPackError}`);
  }
  const barPack = writeBarPack(bookId, roundId);
  if (barPack.errors.length) {
    errors.push(...barPack.errors.map((e) => `bar-pack failed: ${e}`));
  } else {
    messages.push(`bar-pack: wrote ${barPack.packPath}`);
  }
  const cards = taskCardPaths(bookId, roundId, selected, opened.tokens);
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
  };
  writeText(roundRecordPath(bookId, roundId), JSON.stringify(record, null, 2) + "\n");
  writeText(qcSummaryPath(bookId, roundId), JSON.stringify({ bookId, roundId, createdAt: record.createdAt, submissions: 0, ledger: {}, attestationsWritten: 0 }, null, 2) + "\n");
  writeRepairBrief(bookId, roundId);
  return { ok: errors.length === 0, roundId, roundDir: orchestratorRoundDir(bookId, roundId), errors, messages };
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

export function submitQcArtifact(bookId: string, roundId: string, role: SubmissionRole, file: string, token: string): { ok: boolean; path?: string; errors: string[]; messages: string[] } {
  if (!SUBMISSION_ROLES.includes(role)) return { ok: false, errors: [`Unknown role ${role}.`], messages: [] };
  if (!token) return { ok: false, errors: [`qc-submit requires --token for role ${role}.`], messages: [] };
  if (!verifyQcRoundToken(bookId, roundId, role as QcRoundRole, token)) {
    return { ok: false, errors: [`Invalid ${role} token for ${bookId} round ${roundId}.`], messages: [] };
  }
  let raw: any;
  try {
    raw = loadJsonFile(file);
  } catch (err) {
    return { ok: false, errors: [`Could not read submission file: ${(err as Error).message}`], messages: [] };
  }
  const validation = validateSubmission(bookId, roundId, role, raw);
  if (validation.ok === false) return { ok: false, errors: validation.errors, messages: [] };
  const dir = submissionsDir(bookId, roundId, role);
  mkdirSync(dir, { recursive: true });
  const safeName = basename(file).replace(/[^a-zA-Z0-9._-]/g, "_");
  const dest = resolve(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.${safeName}`);
  writeFileSync(dest, JSON.stringify(stripPlaintextSecrets(raw), null, 2) + "\n", "utf8");
  writeFileSync(`${dest}.meta.json`, JSON.stringify({
    roleVerified: true,
    verifiedRole: role,
    submittedAt: new Date().toISOString(),
    copiedFrom: resolve(file),
  }, null, 2) + "\n", "utf8");
  const messages = [`submission stored: ${dest}`];
  if (validation.submission.schemaVersion === "qc-bar-read-v1" || validation.submission.schemaVersion === "qc-bar-read-v2") {
    const artifact = writeBarReadArtifact(validation.submission);
    messages.push(`bar-read artifact stored: ${artifact}`);
  }
  if (validation.submission.schemaVersion === "qc-confirm-read-v1") {
    const artifact = writeConfirmReadArtifact(validation.submission);
    messages.push(`confirm-read artifact stored: ${artifact}`);
  }
  return { ok: true, path: dest, errors: [], messages };
}

function submissionFiles(bookId: string, roundId: string): Array<{ role: SubmissionRole; path: string }> {
  const out: Array<{ role: SubmissionRole; path: string }> = [];
  for (const role of SUBMISSION_ROLES) {
    const dir = submissionsDir(bookId, roundId, role);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((name) => name.endsWith(".json") && !name.endsWith(".meta.json")).sort()) {
      const p = resolve(dir, f);
      if (/^ch\d+\.bar-read\.json$/.test(f) || /^ch\d+\.confirm-read\.json$/.test(f)) continue;
      out.push({ role, path: p });
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
    derivedAt: new Date().toISOString(),
    chapters,
  };
  const path = keyDerivationPath(submission.bookId, submission.roundId, submission.role);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(rec, null, 2), "utf8");
  return path;
}

export function collectQcRound(bookId: string, roundId: string): { ok: boolean; errors: string[]; summary: Record<string, unknown> } {
  const errors: string[] = [];
  let submissions = 0;
  let appended = 0;
  let duplicates = 0;
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
    if (validation.submission.schemaVersion === "qc-bar-read-v1" || validation.submission.schemaVersion === "qc-bar-read-v2") writeBarReadArtifact(validation.submission);
    if (validation.submission.schemaVersion === "qc-confirm-read-v1") writeConfirmReadArtifact(validation.submission);
    if (validation.submission.schemaVersion === "qc-key-derive-v2") writeKeyDerivationFromSubmission(validation.submission);
    const merged = appendFindingsFromSubmission({ bookId, roundId, role: item.role, submissionFile: item.path, submission: validation.submission as ValidatedSubmission });
    appended += merged.appended;
    duplicates += merged.duplicates;
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
}

function isSemanticFinding(sourceRoles: string[], repairClass: string): boolean {
  const axes = new Set(Object.keys(AXIS_WEIGHTS));
  if (axes.has(repairClass)) return true;
  return sourceRoles.some((role) => role === "bar" || role === "confirm" || role === "keyA" || role === "keyB" || role === "sweep");
}

export function verifyRepair(bookId: string, roundId: string): { ok: boolean; summary: Record<string, unknown>; errors: string[] } {
  const findings = effectiveLedger(bookId, roundId);
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

  const validationByChapter = new Map<number, { authorFindings: number; gateBlockers: number; intraBlockers: number }>();
  for (const n of edited) {
    const ch = byNumber.get(n);
    if (!ch) continue;
    const authorFindings = checkAuthoringContract(ch, { sidecar: loadChapterSidecar(ch.chapterId), filePath: `state/chapters/${ch.chapterId}.v21-native.chapter.json` }).length;
    const gate = runShipGate(ch);
    const intra = runIntraBookChecks(ch, chapters.filter((other) => other.number < ch.number));
    validationByChapter.set(n, { authorFindings, gateBlockers: gate.blockers.length, intraBlockers: intra.filter((f) => f.severity === "blocker").length });
  }
  const bookGate = runBookGate(bookId, chapters);
  const bookBlockers = bookGate.findings.filter((f) => f.severity === "blocker").length;

  for (const f of findings) {
    if (updates.some((u) => u.findingId === f.findingId)) continue;
    const validation = f.chapterNumber !== undefined ? validationByChapter.get(f.chapterNumber) : undefined;
    const validationClean = !!validation && validation.authorFindings === 0 && validation.gateBlockers === 0 && validation.intraBlockers === 0 && bookBlockers === 0;
    if (!validationClean) {
      updates.push({ findingId: f.findingId, status: "still_open", reason: "chapter changed but validation commands still report blockers/findings", validation: { ...validation, bookBlockers } });
      continue;
    }
    const semantic = isSemanticFinding(f.sources.map((s) => s.sourceRole), f.repairClass);
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
}

export function renderRepair(bookId: string, roundId: string): string {
  return writeRepairBrief(bookId, roundId);
}

export function ledgerStatus(bookId: string, roundId: string): { summary: Record<string, number>; findings: ReturnType<typeof effectiveLedger> } {
  return { summary: ledgerStatusSummary(bookId, roundId), findings: effectiveLedger(bookId, roundId) };
}
